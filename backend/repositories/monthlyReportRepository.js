const crypto = require('crypto');
const { postgresStore, normalizeText } = require('./common');

// Relatorio Mensal de Atividades — modelo relacional (header + projetos +
// atividades). O save e full-sync transacional: trava o header, checa version
// (concorrencia otimista) e reescreve projetos/atividades (delete + reinsert).

function genId(prefix) {
    return `${prefix}-${crypto.randomUUID()}`;
}

function toIsoDateString(value) {
    // Colunas DATE ja vem como 'YYYY-MM-DD' via to_char no SELECT.
    return value == null ? null : String(value);
}

function mapProjectRow(row) {
    return {
        id: row.id,
        linkedProjectId: row.linked_project_id || null,
        name: row.name || '',
        description: row.description || '',
        collapsed: !!row.collapsed,
        sortOrder: Number(row.sort_order) || 0,
    };
}

function mapActivityRow(row) {
    return {
        id: row.id,
        projectId: row.project_id || null,
        category: row.category,
        description: row.description || '',
        startDate: toIsoDateString(row.start_date),
        endDate: toIsoDateString(row.end_date),
    };
}

function hydrate(reportRow, projectRows, activityRows) {
    const payload = reportRow.payload && typeof reportRow.payload === 'object' ? reportRow.payload : {};
    return {
        id: reportRow.id,
        ownerUserId: reportRow.owner_user_id,
        refYear: Number(reportRow.ref_year),
        refMonth: Number(reportRow.ref_month),
        authorName: reportRow.author_name || '',
        status: reportRow.status || 'draft',
        version: Number(reportRow.version) || 1,
        holidayOverrides: Array.isArray(payload.holidayOverrides) ? payload.holidayOverrides : [],
        projects: projectRows.map(mapProjectRow),
        activities: activityRows.map(mapActivityRow),
        createdAt: reportRow.created_at instanceof Date ? reportRow.created_at.toISOString() : reportRow.created_at,
        updatedAt: reportRow.updated_at instanceof Date ? reportRow.updated_at.toISOString() : reportRow.updated_at,
        updatedBy: reportRow.updated_by || null,
    };
}

const SELECT_PROJECTS = `
    SELECT id, report_id, linked_project_id, name, description, collapsed, sort_order
    FROM monthly_report_projects
    WHERE report_id = $1
    ORDER BY sort_order ASC, id ASC
`;

const SELECT_ACTIVITIES = `
    SELECT id, report_id, project_id, category, description,
           to_char(start_date, 'YYYY-MM-DD') AS start_date,
           to_char(end_date, 'YYYY-MM-DD') AS end_date
    FROM monthly_report_activities
    WHERE report_id = $1
    ORDER BY start_date ASC, id ASC
`;

async function getFull(id, ownerUserId) {
    const reportId = normalizeText(id);
    const owner = normalizeText(ownerUserId);
    const reportRes = await postgresStore.query(
        `SELECT id, owner_user_id, ref_year, ref_month, author_name, status, version, payload, created_at, updated_at, updated_by
         FROM monthly_reports WHERE id = $1 AND owner_user_id = $2 LIMIT 1`,
        [reportId, owner],
    );
    if (reportRes.rows.length === 0) return null;

    const [projectsRes, activitiesRes] = await Promise.all([
        postgresStore.query(SELECT_PROJECTS, [reportId]),
        postgresStore.query(SELECT_ACTIVITIES, [reportId]),
    ]);
    return hydrate(reportRes.rows[0], projectsRes.rows, activitiesRes.rows);
}

async function getByPeriod(ownerUserId, refYear, refMonth) {
    const owner = normalizeText(ownerUserId);
    const res = await postgresStore.query(
        `SELECT id FROM monthly_reports WHERE owner_user_id = $1 AND ref_year = $2 AND ref_month = $3 LIMIT 1`,
        [owner, Number(refYear), Number(refMonth)],
    );
    if (res.rows.length === 0) return null;
    return getFull(res.rows[0].id, owner);
}

async function listByOwner(ownerUserId) {
    const owner = normalizeText(ownerUserId);
    const res = await postgresStore.query(
        `SELECT id, ref_year, ref_month, author_name, status, version, updated_at
         FROM monthly_reports WHERE owner_user_id = $1
         ORDER BY ref_year DESC, ref_month DESC`,
        [owner],
    );
    return res.rows.map((row) => ({
        id: row.id,
        refYear: Number(row.ref_year),
        refMonth: Number(row.ref_month),
        authorName: row.author_name || '',
        status: row.status || 'draft',
        version: Number(row.version) || 1,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    }));
}

// Reescreve projetos + atividades de um relatorio dentro de uma transacao.
// Preserva ids fornecidos (estabilidade entre saves); gera quando ausentes.
async function rewriteChildren(client, reportId, projects, activities) {
    await client.query('DELETE FROM monthly_report_activities WHERE report_id = $1', [reportId]);
    await client.query('DELETE FROM monthly_report_projects WHERE report_id = $1', [reportId]);

    const validProjectIds = new Set();
    const projectList = Array.isArray(projects) ? projects : [];
    for (let i = 0; i < projectList.length; i += 1) {
        const p = projectList[i] || {};
        const pid = normalizeText(p.id) || genId('MRP');
        validProjectIds.add(pid);
        await client.query(
            `INSERT INTO monthly_report_projects
                (id, report_id, linked_project_id, name, description, collapsed, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                pid,
                reportId,
                normalizeText(p.linkedProjectId) || null,
                p.name || '',
                p.description || '',
                p.collapsed === true,
                Number.isFinite(Number(p.sortOrder)) ? Number(p.sortOrder) : i,
            ],
        );
    }

    const activityList = Array.isArray(activities) ? activities : [];
    for (const a of activityList) {
        const act = a || {};
        const aid = normalizeText(act.id) || genId('MRA');
        const linkedProject = normalizeText(act.projectId);
        const projectId = linkedProject && validProjectIds.has(linkedProject) ? linkedProject : null;
        await client.query(
            `INSERT INTO monthly_report_activities
                (id, report_id, project_id, category, description, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                aid,
                reportId,
                projectId,
                normalizeText(act.category),
                act.description || '',
                act.startDate,
                act.endDate,
            ],
        );
    }
}

async function create(data) {
    const owner = normalizeText(data.ownerUserId);
    const id = normalizeText(data.id) || genId('MR');
    const payload = { holidayOverrides: Array.isArray(data.holidayOverrides) ? data.holidayOverrides : [] };

    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO monthly_reports
                (id, owner_user_id, ref_year, ref_month, author_name, status, version, payload, created_at, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, 1, $7::jsonb, NOW(), NOW(), $8)`,
            [
                id,
                owner,
                Number(data.refYear),
                Number(data.refMonth),
                data.authorName || '',
                normalizeText(data.status) || 'draft',
                JSON.stringify(payload),
                normalizeText(data.updatedBy) || null,
            ],
        );
        await rewriteChildren(client, id, data.projects, data.activities);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return getFull(id, owner);
}

// Garante um relatorio para o periodo (cria vazio se nao existir).
async function ensureForPeriod(ownerUserId, refYear, refMonth, authorName) {
    const existing = await getByPeriod(ownerUserId, refYear, refMonth);
    if (existing) return existing;
    return create({
        ownerUserId,
        refYear,
        refMonth,
        authorName: authorName || '',
        status: 'draft',
        holidayOverrides: [],
        projects: [],
        activities: [],
        updatedBy: authorName || null,
    });
}

// Save full-sync com concorrencia otimista. Retorna:
//   { report }            em sucesso
//   { notFound: true }    se id/owner nao existir
//   { conflict, currentVersion } se version divergir
async function saveFull(id, ownerUserId, data, expectedVersion) {
    const reportId = normalizeText(id);
    const owner = normalizeText(ownerUserId);
    const payload = { holidayOverrides: Array.isArray(data.holidayOverrides) ? data.holidayOverrides : [] };

    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');
        const lockRes = await client.query(
            `SELECT version FROM monthly_reports WHERE id = $1 AND owner_user_id = $2 FOR UPDATE`,
            [reportId, owner],
        );
        if (lockRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return { notFound: true };
        }
        const currentVersion = Number(lockRes.rows[0].version) || 1;
        if (expectedVersion != null && Number(expectedVersion) !== currentVersion) {
            await client.query('ROLLBACK');
            return { conflict: true, currentVersion };
        }

        await client.query(
            `UPDATE monthly_reports
             SET ref_year = $1, ref_month = $2, author_name = $3, status = $4,
                 version = version + 1, payload = $5::jsonb, updated_at = NOW(), updated_by = $6
             WHERE id = $7`,
            [
                Number(data.refYear),
                Number(data.refMonth),
                data.authorName || '',
                normalizeText(data.status) || 'draft',
                JSON.stringify(payload),
                normalizeText(data.updatedBy) || null,
                reportId,
            ],
        );
        await rewriteChildren(client, reportId, data.projects, data.activities);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return { report: await getFull(reportId, owner) };
}

async function remove(id, ownerUserId) {
    await postgresStore.query(
        'DELETE FROM monthly_reports WHERE id = $1 AND owner_user_id = $2',
        [normalizeText(id), normalizeText(ownerUserId)],
    );
}

module.exports = {
    getFull,
    getByPeriod,
    listByOwner,
    ensureForPeriod,
    create,
    saveFull,
    remove,
};
