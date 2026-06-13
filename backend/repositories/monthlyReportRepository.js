const crypto = require('crypto');
const { postgresStore, normalizeText } = require('./common');

// Relatorio Mensal de Acompanhamento dos Servicos — modelo relacional
// (header + engenheiros, cada um com atividades e projetos). O save e
// full-sync transacional: trava o header, checa version (concorrencia
// otimista) e reescreve a arvore de filhos (delete + reinsert).

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
        name: row.name || '',
        description: row.description || '',
        sortOrder: Number(row.sort_order) || 0,
    };
}

function mapActivityRow(row) {
    return {
        id: row.id,
        category: row.category,
        description: row.description || '',
        startDate: toIsoDateString(row.start_date),
        endDate: toIsoDateString(row.end_date),
    };
}

function hydrate(reportRow, engineerRows, projectRows, activityRows) {
    const payload = reportRow.payload && typeof reportRow.payload === 'object' ? reportRow.payload : {};
    const projectsByEngineer = new Map();
    for (const row of projectRows) {
        const list = projectsByEngineer.get(row.engineer_id) || [];
        list.push(mapProjectRow(row));
        projectsByEngineer.set(row.engineer_id, list);
    }
    const activitiesByEngineer = new Map();
    for (const row of activityRows) {
        const list = activitiesByEngineer.get(row.engineer_id) || [];
        list.push(mapActivityRow(row));
        activitiesByEngineer.set(row.engineer_id, list);
    }

    return {
        id: reportRow.id,
        ownerUserId: reportRow.owner_user_id,
        refYear: Number(reportRow.ref_year),
        refMonth: Number(reportRow.ref_month),
        authorName: reportRow.author_name || '',
        status: reportRow.status || 'draft',
        version: Number(reportRow.version) || 1,
        intro: reportRow.intro || '',
        conclusao: reportRow.conclusao || '',
        quadroStyle: reportRow.quadro_style || 'marcador',
        holidays: Array.isArray(payload.holidays) ? payload.holidays : [],
        engineers: engineerRows.map((row) => ({
            id: row.id,
            name: row.name || '',
            sortOrder: Number(row.sort_order) || 0,
            activities: activitiesByEngineer.get(row.id) || [],
            projects: projectsByEngineer.get(row.id) || [],
        })),
        createdAt: reportRow.created_at instanceof Date ? reportRow.created_at.toISOString() : reportRow.created_at,
        updatedAt: reportRow.updated_at instanceof Date ? reportRow.updated_at.toISOString() : reportRow.updated_at,
        updatedBy: reportRow.updated_by || null,
    };
}

const SELECT_ENGINEERS = `
    SELECT id, report_id, name, sort_order
    FROM monthly_report_engineers
    WHERE report_id = $1
    ORDER BY sort_order ASC, id ASC
`;

const SELECT_PROJECTS = `
    SELECT id, report_id, engineer_id, name, description, sort_order
    FROM monthly_report_projects
    WHERE report_id = $1
    ORDER BY sort_order ASC, id ASC
`;

const SELECT_ACTIVITIES = `
    SELECT id, report_id, engineer_id, category, description,
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
        `SELECT id, owner_user_id, ref_year, ref_month, author_name, status, version,
                intro, conclusao, quadro_style, payload, created_at, updated_at, updated_by
         FROM monthly_reports WHERE id = $1 AND owner_user_id = $2 LIMIT 1`,
        [reportId, owner],
    );
    if (reportRes.rows.length === 0) return null;

    const [engineersRes, projectsRes, activitiesRes] = await Promise.all([
        postgresStore.query(SELECT_ENGINEERS, [reportId]),
        postgresStore.query(SELECT_PROJECTS, [reportId]),
        postgresStore.query(SELECT_ACTIVITIES, [reportId]),
    ]);
    return hydrate(reportRes.rows[0], engineersRes.rows, projectsRes.rows, activitiesRes.rows);
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

// Reescreve engenheiros + projetos + atividades dentro de uma transacao.
// Preserva ids fornecidos (estabilidade de keys entre saves); gera quando
// ausentes — inclusive mapeando filhos para o id final do engenheiro.
async function rewriteChildren(client, reportId, engineers) {
    await client.query('DELETE FROM monthly_report_activities WHERE report_id = $1', [reportId]);
    await client.query('DELETE FROM monthly_report_projects WHERE report_id = $1', [reportId]);
    await client.query('DELETE FROM monthly_report_engineers WHERE report_id = $1', [reportId]);

    const engineerList = Array.isArray(engineers) ? engineers : [];
    for (let i = 0; i < engineerList.length; i += 1) {
        const eng = engineerList[i] || {};
        const engineerId = normalizeText(eng.id) || genId('MRE');
        await client.query(
            `INSERT INTO monthly_report_engineers (id, report_id, name, sort_order)
             VALUES ($1, $2, $3, $4)`,
            [
                engineerId,
                reportId,
                eng.name || '',
                Number.isFinite(Number(eng.sortOrder)) ? Number(eng.sortOrder) : i,
            ],
        );

        const projectList = Array.isArray(eng.projects) ? eng.projects : [];
        for (let j = 0; j < projectList.length; j += 1) {
            const p = projectList[j] || {};
            await client.query(
                `INSERT INTO monthly_report_projects (id, report_id, engineer_id, name, description, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    normalizeText(p.id) || genId('MRP'),
                    reportId,
                    engineerId,
                    p.name || '',
                    p.description || '',
                    Number.isFinite(Number(p.sortOrder)) ? Number(p.sortOrder) : j,
                ],
            );
        }

        const activityList = Array.isArray(eng.activities) ? eng.activities : [];
        for (const a of activityList) {
            const act = a || {};
            await client.query(
                `INSERT INTO monthly_report_activities
                    (id, report_id, engineer_id, category, description, start_date, end_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    normalizeText(act.id) || genId('MRA'),
                    reportId,
                    engineerId,
                    normalizeText(act.category),
                    act.description || '',
                    act.startDate,
                    act.endDate,
                ],
            );
        }
    }
}

function buildPayload(data) {
    return { holidays: Array.isArray(data.holidays) ? data.holidays : [] };
}

async function create(data) {
    const owner = normalizeText(data.ownerUserId);
    const id = normalizeText(data.id) || genId('MR');

    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO monthly_reports
                (id, owner_user_id, ref_year, ref_month, author_name, status, version,
                 intro, conclusao, quadro_style, payload, created_at, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $10::jsonb, NOW(), NOW(), $11)`,
            [
                id,
                owner,
                Number(data.refYear),
                Number(data.refMonth),
                data.authorName || '',
                normalizeText(data.status) || 'draft',
                data.intro || '',
                data.conclusao || '',
                normalizeText(data.quadroStyle) || 'marcador',
                JSON.stringify(buildPayload(data)),
                normalizeText(data.updatedBy) || null,
            ],
        );
        await rewriteChildren(client, id, data.engineers);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return getFull(id, owner);
}

// Garante um relatorio para o periodo (cria vazio se nao existir). O seed de
// equipe/textos-modelo e responsabilidade do frontend (primeiro PUT).
async function ensureForPeriod(ownerUserId, refYear, refMonth, authorName) {
    const existing = await getByPeriod(ownerUserId, refYear, refMonth);
    if (existing) return existing;
    return create({
        ownerUserId,
        refYear,
        refMonth,
        authorName: authorName || '',
        status: 'draft',
        holidays: [],
        engineers: [],
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
                 intro = $5, conclusao = $6, quadro_style = $7,
                 version = version + 1, payload = $8::jsonb, updated_at = NOW(), updated_by = $9
             WHERE id = $10`,
            [
                Number(data.refYear),
                Number(data.refMonth),
                data.authorName || '',
                normalizeText(data.status) || 'draft',
                data.intro || '',
                data.conclusao || '',
                normalizeText(data.quadroStyle) || 'marcador',
                JSON.stringify(buildPayload(data)),
                normalizeText(data.updatedBy) || null,
                reportId,
            ],
        );
        await rewriteChildren(client, reportId, data.engineers);
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
