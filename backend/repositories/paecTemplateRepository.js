const crypto = require('crypto');
const { postgresStore, normalizeText } = require('./common');

// Revisoes do modelo canonico do PAEC: docx tokenizado ({{placeholders}}) no
// storage de midia + manifest JSONB (catalogo de campos/blocos/secoes gerado
// pelo tokenizer, worker/tools/paec_tokenizer.py). No maximo uma revisao
// ativa por name (indice unico parcial da 0026).

function genId() {
    return `PAECT-${crypto.randomUUID()}`;
}

function hydrate(row, { includeManifest = true } = {}) {
    return {
        id: row.id,
        name: row.name,
        revisionLabel: row.revision_label,
        status: row.status,
        sourceDocxMediaId: row.source_docx_media_id || null,
        tokenizedDocxMediaId: row.tokenized_docx_media_id,
        ...(includeManifest ? { manifest: row.manifest || {} } : {}),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        updatedBy: row.updated_by || null,
    };
}

const SELECT_TEMPLATE = `
    SELECT id, name, revision_label, status, source_docx_media_id,
           tokenized_docx_media_id, manifest, created_at, updated_at, updated_by
    FROM paec_templates
`;

async function getById(id) {
    const res = await postgresStore.query(
        `${SELECT_TEMPLATE} WHERE id = $1 LIMIT 1`,
        [normalizeText(id)],
    );
    return res.rows.length > 0 ? hydrate(res.rows[0]) : null;
}

// Lista resumida — sem o manifest (JSONB de dezenas de KB por revisao).
async function list() {
    const res = await postgresStore.query(
        `SELECT id, name, revision_label, status, source_docx_media_id,
                tokenized_docx_media_id, created_at, updated_at, updated_by
         FROM paec_templates
         ORDER BY name ASC, created_at DESC`,
    );
    return res.rows.map((row) => hydrate(row, { includeManifest: false }));
}

async function getActive(name) {
    const res = await postgresStore.query(
        `${SELECT_TEMPLATE} WHERE name = $1 AND status = 'active' LIMIT 1`,
        [normalizeText(name)],
    );
    return res.rows.length > 0 ? hydrate(res.rows[0]) : null;
}

async function create(data) {
    const id = normalizeText(data.id) || genId();
    await postgresStore.query(
        `INSERT INTO paec_templates
            (id, name, revision_label, status, source_docx_media_id,
             tokenized_docx_media_id, manifest, created_at, updated_at, updated_by)
         VALUES ($1, $2, $3, 'draft', $4, $5, $6::jsonb, NOW(), NOW(), $7)`,
        [
            id,
            normalizeText(data.name),
            normalizeText(data.revisionLabel),
            normalizeText(data.sourceDocxMediaId) || null,
            normalizeText(data.tokenizedDocxMediaId),
            JSON.stringify(data.manifest || {}),
            normalizeText(data.updatedBy) || null,
        ],
    );
    return getById(id);
}

// Ativa a revisao: a ativa anterior do mesmo name vira 'retired' na mesma
// transacao (o indice unico parcial garante no maximo uma ativa).
async function activate(id, meta = {}) {
    const templateId = normalizeText(id);
    const updatedBy = normalizeText(meta.updatedBy) || null;

    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');
        const res = await client.query(
            'SELECT id, name, status FROM paec_templates WHERE id = $1 FOR UPDATE',
            [templateId],
        );
        if (res.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }
        const { name } = res.rows[0];
        await client.query(
            `UPDATE paec_templates
             SET status = 'retired', updated_at = NOW(), updated_by = $2
             WHERE name = $1 AND status = 'active' AND id <> $3`,
            [name, updatedBy, templateId],
        );
        await client.query(
            `UPDATE paec_templates
             SET status = 'active', updated_at = NOW(), updated_by = $2
             WHERE id = $1`,
            [templateId, updatedBy],
        );
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return getById(templateId);
}

module.exports = {
    getById,
    list,
    getActive,
    create,
    activate,
};
