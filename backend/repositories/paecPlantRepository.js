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

function hydrateHeader(row) {
    return {
        id: row.id,
        name: row.name,
        projectId: row.project_id || null,
        templateId: row.template_id,
        version: Number(row.version) || 1,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        updatedBy: row.updated_by || null,
    };
}

const SELECT_PLANT = `
    SELECT id, name, project_id, template_id, version, created_at, updated_at, updated_by
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

async function getFull(id) {
    const plantId = normalizeText(id);
    const res = await postgresStore.query(`${SELECT_PLANT} WHERE id = $1 LIMIT 1`, [plantId]);
    if (res.rows.length === 0) return null;
    return {
        ...hydrateHeader(res.rows[0]),
        fields: await getFieldsMap(plantId),
    };
}

// Lista resumida com contagem de campos preenchidos (a completude e computada
// na rota contra o manifest do template — aqui so o agregado barato).
async function list() {
    const res = await postgresStore.query(
        `SELECT p.id, p.name, p.project_id, p.template_id, p.version,
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

// 23505 no indice LOWER(name) e traduzido pela rota em 409 NAME_EXISTS.
async function create(data) {
    const id = normalizeText(data.id) || genId();
    const updatedBy = normalizeText(data.updatedBy) || null;

    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO paec_plants (id, name, project_id, template_id, version, created_at, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, 1, NOW(), NOW(), $5)`,
            [
                id,
                normalizeText(data.name),
                normalizeText(data.projectId) || null,
                normalizeText(data.templateId),
                updatedBy,
            ],
        );
        if (data.copyFromId) {
            await client.query(
                `INSERT INTO paec_plant_fields (plant_id, field_key, value, updated_at, updated_by)
                 SELECT $1, field_key, value, NOW(), $3
                 FROM paec_plant_fields WHERE plant_id = $2`,
                [id, normalizeText(data.copyFromId), updatedBy],
            );
        } else {
            await rewriteFields(client, id, data.fields, updatedBy);
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
             SET name = $1, project_id = $2, version = version + 1,
                 updated_at = NOW(), updated_by = $3
             WHERE id = $4`,
            [
                normalizeText(data.name),
                normalizeText(data.projectId) || null,
                updatedBy,
                plantId,
            ],
        );
        await rewriteFields(client, plantId, data.fields, updatedBy);
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
