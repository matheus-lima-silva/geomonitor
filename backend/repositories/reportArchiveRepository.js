const {
    postgresStore,
    normalizeText,
    buildMetadata,
} = require('./common');

function hydrateRow(row) {
    if (!row) return null;
    const payload = row.snapshot_payload || {};
    return buildMetadata(
        {
            ...payload,
            id: row.id,
            compoundId: row.compound_id,
            version: row.version,
            deliveredAt: row.delivered_at instanceof Date ? row.delivered_at.toISOString() : row.delivered_at,
            deliveredBy: row.delivered_by,
            generatedMediaId: row.generated_media_id,
            generatedSha256: row.generated_sha256 || null,
            deliveredMediaId: row.delivered_media_id || null,
            deliveredSha256: row.delivered_sha256 || null,
            notes: row.notes || null,
            snapshotPayload: payload,
        },
        row,
    );
}

async function list({ compoundId } = {}) {
    const normalizedCompoundId = normalizeText(compoundId);
    const params = [];
    let whereClause = '';
    if (normalizedCompoundId) {
        whereClause = 'WHERE compound_id = $1';
        params.push(normalizedCompoundId);
    }
    const result = await postgresStore.query(
        `
            SELECT id, compound_id, version, delivered_at, delivered_by,
                   generated_media_id, generated_sha256,
                   delivered_media_id, delivered_sha256,
                   notes, snapshot_payload, created_at, updated_at
            FROM report_archives
            ${whereClause}
            ORDER BY compound_id ASC, version DESC
        `,
        params,
    );
    return result.rows.map(hydrateRow);
}

async function getById(id) {
    const normalizedId = normalizeText(id);
    const result = await postgresStore.query(
        `
            SELECT id, compound_id, version, delivered_at, delivered_by,
                   generated_media_id, generated_sha256,
                   delivered_media_id, delivered_sha256,
                   notes, snapshot_payload, created_at, updated_at
            FROM report_archives
            WHERE id = $1
            LIMIT 1
        `,
        [normalizedId],
    );
    if (result.rows.length === 0) return null;
    return hydrateRow(result.rows[0]);
}

async function getMaxVersionForCompound(compoundId) {
    const normalizedCompoundId = normalizeText(compoundId);
    const result = await postgresStore.query(
        'SELECT COALESCE(MAX(version), 0)::int AS max_version FROM report_archives WHERE compound_id = $1',
        [normalizedCompoundId],
    );
    return result.rows[0]?.max_version || 0;
}

async function create(payload) {
    const normalizedId = normalizeText(payload?.id);
    const compoundId = normalizeText(payload?.compoundId);
    const version = Number(payload?.version) || 1;
    const snapshotPayload = payload?.snapshotPayload && typeof payload.snapshotPayload === 'object'
        ? payload.snapshotPayload
        : {};
    await postgresStore.query(
        `
            INSERT INTO report_archives (
                id, compound_id, version, delivered_by,
                generated_media_id, generated_sha256,
                delivered_media_id, delivered_sha256,
                notes, snapshot_payload
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        `,
        [
            normalizedId,
            compoundId,
            version,
            normalizeText(payload?.deliveredBy) || null,
            normalizeText(payload?.generatedMediaId),
            normalizeText(payload?.generatedSha256) || null,
            normalizeText(payload?.deliveredMediaId) || null,
            normalizeText(payload?.deliveredSha256) || null,
            normalizeText(payload?.notes) || null,
            JSON.stringify(snapshotPayload),
        ],
    );
    return getById(normalizedId);
}

/**
 * Cria um archive alocando a proxima versao do compound de forma ATOMICA.
 *
 * O caminho antigo (getMaxVersionForCompound + create em statements separados)
 * tem race: duas entregas concorrentes do mesmo compound leem o mesmo
 * MAX(version)=N, ambas calculam N+1 e ambas inserem. Como existe
 * UNIQUE (compound_id, version) (migration 0010), a segunda estoura violacao de
 * unicidade (23505) e a rota devolve 500 — em vez de receber a versao N+2.
 *
 * Aqui um pg_advisory_xact_lock chaveado no compound serializa as entregas
 * concorrentes daquele compound (e liberado automaticamente no COMMIT/ROLLBACK),
 * de modo que cada uma le um MAX(version) ja atualizado e recebe v(N+1), v(N+2)...
 * O lock por compound nao bloqueia entregas de compounds diferentes. Diferente de
 * um SELECT ... FOR UPDATE nas linhas-filhas, funciona tambem na 1a entrega
 * (quando ainda nao ha nenhum archive para travar).
 */
async function createNextVersion(payload) {
    const normalizedId = normalizeText(payload?.id);
    const compoundId = normalizeText(payload?.compoundId);
    const snapshotPayload = payload?.snapshotPayload && typeof payload.snapshotPayload === 'object'
        ? payload.snapshotPayload
        : {};

    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [compoundId]);

        const maxRes = await client.query(
            'SELECT COALESCE(MAX(version), 0)::int AS max_version FROM report_archives WHERE compound_id = $1',
            [compoundId],
        );
        const nextVersion = (maxRes.rows[0]?.max_version || 0) + 1;

        const insertRes = await client.query(
            `
                INSERT INTO report_archives (
                    id, compound_id, version, delivered_by,
                    generated_media_id, generated_sha256,
                    delivered_media_id, delivered_sha256,
                    notes, snapshot_payload
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
                RETURNING id, compound_id, version, delivered_at, delivered_by,
                          generated_media_id, generated_sha256,
                          delivered_media_id, delivered_sha256,
                          notes, snapshot_payload, created_at, updated_at
            `,
            [
                normalizedId,
                compoundId,
                nextVersion,
                normalizeText(payload?.deliveredBy) || null,
                normalizeText(payload?.generatedMediaId),
                normalizeText(payload?.generatedSha256) || null,
                normalizeText(payload?.deliveredMediaId) || null,
                normalizeText(payload?.deliveredSha256) || null,
                normalizeText(payload?.notes) || null,
                JSON.stringify(snapshotPayload),
            ],
        );

        await client.query('COMMIT');
        return hydrateRow(insertRes.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

async function attachDeliveredMedia(id, { mediaId, sha256, notes }) {
    const normalizedId = normalizeText(id);
    const result = await postgresStore.query(
        `
            UPDATE report_archives
            SET delivered_media_id = $2,
                delivered_sha256 = $3,
                notes = COALESCE($4, notes),
                updated_at = NOW()
            WHERE id = $1 AND delivered_media_id IS NULL
            RETURNING id
        `,
        [
            normalizedId,
            normalizeText(mediaId),
            normalizeText(sha256) || null,
            notes === undefined ? null : (normalizeText(notes) || null),
        ],
    );
    if (result.rowCount === 0) return null;
    return getById(normalizedId);
}

async function remove(id) {
    const normalizedId = normalizeText(id);
    await postgresStore.query('DELETE FROM report_archives WHERE id = $1', [normalizedId]);
}

module.exports = {
    list,
    getById,
    getMaxVersionForCompound,
    create,
    createNextVersion,
    attachDeliveredMedia,
    remove,
};
