const crypto = require('crypto');
const { postgresStore, normalizeText } = require('./common');

// Fichas PAEC por usina: header (paec_plants, concorrencia otimista via
// version) + uma linha por campo preenchido (paec_plant_fields). A API fala
// `fields: { chave: valor }`; a forma relacional (auditavel por campo) e
// detalhe deste repository. Save full-sync transacional no padrao do
// monthlyReportRepository (lock do header + rewrite dos filhos).

function genId() {
    return `PAEC-${crypto.randomUUID()}`;
}

function genListItemId() {
    return `PAECLI-${crypto.randomUUID()}`;
}

function hydrateHeader(row) {
    return {
        id: row.id,
        name: row.name,
        projectId: row.project_id || null,
        plantType: row.plant_type || null,
        installedCapacityMw: row.installed_capacity_mw == null ? null : Number(row.installed_capacity_mw),
        templateId: row.template_id,
        version: Number(row.version) || 1,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        updatedBy: row.updated_by || null,
    };
}

const SELECT_PLANT = `
    SELECT id, name, project_id, plant_type, installed_capacity_mw,
           template_id, version, created_at, updated_at, updated_by
    FROM paec_plants
`;

async function getFieldsMap(plantId) {
    const res = await postgresStore.query(
        'SELECT field_key, value FROM paec_plant_fields WHERE plant_id = $1 ORDER BY field_key ASC',
        [plantId],
    );
    const fields = {};
    for (const row of res.rows) {
        fields[row.field_key] = row.value;
    }
    return fields;
}

// Blocos tabulares (Fase 2 — brigadistas, recursos BEM, extintores, pontos de
// encontro etc.): uma linha por item, agrupada por list_key na ordem salva.
// A API fala `listItems: { listKey: [ {colKey: valor}, ... ] }`; a coluna
// `row` e JSONB porque as colunas variam por bloco/revisao do manifest.
async function getListItemsMap(plantId) {
    const res = await postgresStore.query(
        'SELECT list_key, row FROM paec_plant_list_items WHERE plant_id = $1 ORDER BY list_key ASC, sort_order ASC',
        [plantId],
    );
    const listItems = {};
    for (const row of res.rows) {
        if (!listItems[row.list_key]) listItems[row.list_key] = [];
        listItems[row.list_key].push(row.row);
    }
    return listItems;
}

// Secoes 12.1.x liga/desliga (Fase 3): so persiste linha pra secao que
// desvia do padrao (desligada ou com titulo customizado) — ausente =
// ligada com o titulo padrao do manifest.sections[].defaultTitle.
async function getSectionFlagsMap(plantId) {
    const res = await postgresStore.query(
        'SELECT section_key, enabled, title_override FROM paec_plant_section_flags WHERE plant_id = $1 ORDER BY section_key ASC',
        [plantId],
    );
    const flags = {};
    for (const row of res.rows) {
        flags[row.section_key] = { enabled: row.enabled, titleOverride: row.title_override || null };
    }
    return flags;
}

async function getFull(id) {
    const plantId = normalizeText(id);
    const res = await postgresStore.query(`${SELECT_PLANT} WHERE id = $1 LIMIT 1`, [plantId]);
    if (res.rows.length === 0) return null;
    return {
        ...hydrateHeader(res.rows[0]),
        fields: await getFieldsMap(plantId),
        listItems: await getListItemsMap(plantId),
        sectionFlags: await getSectionFlagsMap(plantId),
    };
}

// Lista resumida com contagem de campos preenchidos (a completude e computada
// na rota contra o manifest do template — aqui so o agregado barato).
async function list() {
    const res = await postgresStore.query(
        `SELECT p.id, p.name, p.project_id, p.plant_type, p.installed_capacity_mw,
                p.template_id, p.version,
                p.created_at, p.updated_at, p.updated_by,
                t.revision_label,
                COUNT(f.field_key)::int AS filled_fields
         FROM paec_plants p
         JOIN paec_templates t ON t.id = p.template_id
         LEFT JOIN paec_plant_fields f ON f.plant_id = p.id AND f.value <> ''
         GROUP BY p.id, t.revision_label
         ORDER BY LOWER(p.name) ASC`,
    );
    return res.rows.map((row) => ({
        ...hydrateHeader(row),
        templateRevisionLabel: row.revision_label,
        filledFields: Number(row.filled_fields) || 0,
    }));
}

function normalizeFields(fields) {
    const entries = [];
    if (fields && typeof fields === 'object') {
        for (const [key, value] of Object.entries(fields)) {
            const fieldKey = normalizeText(key);
            const fieldValue = value == null ? '' : String(value);
            if (fieldKey && fieldValue.trim() !== '') {
                entries.push([fieldKey, fieldValue]);
            }
        }
    }
    return entries;
}

// Reescreve os campos preservando updated_at/updated_by das linhas cujo valor
// nao mudou (auditoria por campo sobrevive ao full-sync do autosave).
async function rewriteFields(client, plantId, fields, updatedBy) {
    const entries = normalizeFields(fields);
    const keys = entries.map(([key]) => key);

    if (keys.length === 0) {
        await client.query('DELETE FROM paec_plant_fields WHERE plant_id = $1', [plantId]);
        return;
    }

    await client.query(
        'DELETE FROM paec_plant_fields WHERE plant_id = $1 AND NOT (field_key = ANY($2))',
        [plantId, keys],
    );
    for (const [key, value] of entries) {
        await client.query(
            `INSERT INTO paec_plant_fields (plant_id, field_key, value, updated_at, updated_by)
             VALUES ($1, $2, $3, NOW(), $4)
             ON CONFLICT (plant_id, field_key)
             DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
             WHERE paec_plant_fields.value IS DISTINCT FROM EXCLUDED.value`,
            [plantId, key, value, updatedBy],
        );
    }
}

function normalizeListItems(listItems) {
    const entries = [];
    if (listItems && typeof listItems === 'object') {
        for (const [listKey, rows] of Object.entries(listItems)) {
            const key = normalizeText(listKey);
            if (!key || !Array.isArray(rows)) continue;
            rows.forEach((row, index) => {
                if (row && typeof row === 'object' && !Array.isArray(row)) {
                    entries.push([key, index, row]);
                }
            });
        }
    }
    return entries;
}

// Replace-on-save integral (ao contrario de rewriteFields, que preserva
// updated_at por chave inalterada): a linha de um bloco tabular e uma
// unidade so, sem auditoria por celula, entao reescrever tudo a cada save
// e mais simples e evita diff de array reordenado.
async function rewriteListItems(client, plantId, listItems, updatedBy) {
    await client.query('DELETE FROM paec_plant_list_items WHERE plant_id = $1', [plantId]);
    const entries = normalizeListItems(listItems);
    for (const [listKey, sortOrder, row] of entries) {
        await client.query(
            `INSERT INTO paec_plant_list_items (id, plant_id, list_key, sort_order, row, created_at, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)`,
            [genListItemId(), plantId, listKey, sortOrder, JSON.stringify(row), updatedBy],
        );
    }
}

function normalizeSectionFlags(sectionFlags) {
    const entries = [];
    if (sectionFlags && typeof sectionFlags === 'object') {
        for (const [key, flag] of Object.entries(sectionFlags)) {
            const sectionKey = normalizeText(key);
            if (!sectionKey || !flag || typeof flag !== 'object') continue;
            const enabled = flag.enabled !== false;
            const titleOverride = normalizeText(flag.titleOverride) || null;
            if (enabled && !titleOverride) continue; // estado padrao, nao precisa de linha
            entries.push([sectionKey, enabled, titleOverride]);
        }
    }
    return entries;
}

async function rewriteSectionFlags(client, plantId, sectionFlags, updatedBy) {
    const entries = normalizeSectionFlags(sectionFlags);
    const keys = entries.map(([key]) => key);

    if (keys.length === 0) {
        await client.query('DELETE FROM paec_plant_section_flags WHERE plant_id = $1', [plantId]);
        return;
    }

    await client.query(
        'DELETE FROM paec_plant_section_flags WHERE plant_id = $1 AND NOT (section_key = ANY($2))',
        [plantId, keys],
    );
    for (const [sectionKey, enabled, titleOverride] of entries) {
        await client.query(
            `INSERT INTO paec_plant_section_flags (plant_id, section_key, enabled, title_override, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, NOW(), $5)
             ON CONFLICT (plant_id, section_key)
             DO UPDATE SET enabled = EXCLUDED.enabled, title_override = EXCLUDED.title_override,
                            updated_at = NOW(), updated_by = EXCLUDED.updated_by
             WHERE paec_plant_section_flags.enabled IS DISTINCT FROM EXCLUDED.enabled
                OR paec_plant_section_flags.title_override IS DISTINCT FROM EXCLUDED.title_override`,
            [plantId, sectionKey, enabled, titleOverride, updatedBy],
        );
    }
}

// 23505 no indice LOWER(name) e traduzido pela rota em 409 NAME_EXISTS.
async function create(data) {
    const id = normalizeText(data.id) || genId();
    const updatedBy = normalizeText(data.updatedBy) || null;

    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO paec_plants (id, name, project_id, plant_type, installed_capacity_mw, template_id, version, created_at, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW(), $7)`,
            [
                id,
                normalizeText(data.name),
                normalizeText(data.projectId) || null,
                normalizeText(data.plantType) || null,
                data.installedCapacityMw == null ? null : Number(data.installedCapacityMw),
                normalizeText(data.templateId),
                updatedBy,
            ],
        );
        if (data.copyFromId) {
            const sourceId = normalizeText(data.copyFromId);
            await client.query(
                `INSERT INTO paec_plant_fields (plant_id, field_key, value, updated_at, updated_by)
                 SELECT $1, field_key, value, NOW(), $3
                 FROM paec_plant_fields WHERE plant_id = $2`,
                [id, sourceId, updatedBy],
            );
            await client.query(
                `INSERT INTO paec_plant_list_items (id, plant_id, list_key, sort_order, row, created_at, updated_at, updated_by)
                 SELECT gen_random_uuid()::text, $1, list_key, sort_order, row, NOW(), NOW(), $3
                 FROM paec_plant_list_items WHERE plant_id = $2`,
                [id, sourceId, updatedBy],
            );
            await client.query(
                `INSERT INTO paec_plant_section_flags (plant_id, section_key, enabled, title_override, updated_at, updated_by)
                 SELECT $1, section_key, enabled, title_override, NOW(), $3
                 FROM paec_plant_section_flags WHERE plant_id = $2`,
                [id, sourceId, updatedBy],
            );
        } else {
            await rewriteFields(client, id, data.fields, updatedBy);
            await rewriteListItems(client, id, data.listItems, updatedBy);
            await rewriteSectionFlags(client, id, data.sectionFlags, updatedBy);
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return getFull(id);
}

// Save full-sync com concorrencia otimista. Retorna:
//   { plant }                     em sucesso
//   { notFound: true }            se o id nao existir
//   { conflict, currentVersion }  se a version divergir
async function saveFull(id, data, expectedVersion) {
    const plantId = normalizeText(id);
    const updatedBy = normalizeText(data.updatedBy) || null;

    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');
        const lockRes = await client.query(
            'SELECT version FROM paec_plants WHERE id = $1 FOR UPDATE',
            [plantId],
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
            `UPDATE paec_plants
             SET name = $1, project_id = $2, plant_type = $3, installed_capacity_mw = $4,
                 version = version + 1, updated_at = NOW(), updated_by = $5
             WHERE id = $6`,
            [
                normalizeText(data.name),
                normalizeText(data.projectId) || null,
                normalizeText(data.plantType) || null,
                data.installedCapacityMw == null ? null : Number(data.installedCapacityMw),
                updatedBy,
                plantId,
            ],
        );
        await rewriteFields(client, plantId, data.fields, updatedBy);
        await rewriteListItems(client, plantId, data.listItems, updatedBy);
        await rewriteSectionFlags(client, plantId, data.sectionFlags, updatedBy);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return { plant: await getFull(plantId) };
}

async function remove(id) {
    await postgresStore.query('DELETE FROM paec_plants WHERE id = $1', [normalizeText(id)]);
}

module.exports = {
    getFull,
    list,
    create,
    saveFull,
    remove,
};
