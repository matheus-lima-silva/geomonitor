const { postgresStore, normalizeText, clone } = require('./common');

const VALID_TIPOS = new Set([
    'processos_erosivos',
    'prad',
    'supressao',
    'fauna',
    'emergencia',
    'comunicacao',
    'compensacao',
    'geral',
    'outro',
]);

function normalizeTipo(value) {
    const raw = normalizeText(value).toLowerCase();
    return VALID_TIPOS.has(raw) ? raw : 'geral';
}

function normalizeMeses(input) {
    if (!Array.isArray(input)) return [];
    const set = new Set();
    for (const raw of input) {
        const n = Number(raw);
        if (Number.isInteger(n) && n >= 1 && n <= 12) set.add(n);
    }
    return [...set].sort((a, b) => a - b);
}

function hydrateRow(row) {
    if (!row) return null;
    const payload = row.payload && typeof row.payload === 'object' ? clone(row.payload) : {};
    return {
        ...payload,
        id: row.id,
        licenseId: row.license_id,
        numero: row.numero,
        titulo: row.titulo || '',
        texto: row.texto || '',
        tipo: row.tipo || 'geral',
        prazo: row.prazo || '',
        periodicidadeRelatorio: row.periodicidade_relatorio || '',
        mesesEntrega: Array.isArray(row.meses_entrega) ? row.meses_entrega.slice() : [],
        ordem: Number.isInteger(row.ordem) ? row.ordem : 0,
        parecerTecnicoRef: row.parecer_tecnico_ref || '',
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        updatedBy: row.updated_by || null,
    };
}

async function listByLicense(licenseId) {
    const normalizedId = normalizeText(licenseId);
    if (!normalizedId) return [];
    const result = await postgresStore.query(
        `
            SELECT id, license_id, numero, titulo, texto, tipo, prazo,
                   periodicidade_relatorio, meses_entrega, ordem, parecer_tecnico_ref,
                   payload, created_at, updated_at, updated_by
            FROM license_conditions
            WHERE license_id = $1
            ORDER BY ordem ASC, numero ASC, id ASC
        `,
        [normalizedId],
    );
    return result.rows.map(hydrateRow);
}

async function getById(id) {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return null;
    const result = await postgresStore.query(
        `
            SELECT id, license_id, numero, titulo, texto, tipo, prazo,
                   periodicidade_relatorio, meses_entrega, ordem, parecer_tecnico_ref,
                   payload, created_at, updated_at, updated_by
            FROM license_conditions
            WHERE id = $1
            LIMIT 1
        `,
        [normalizedId],
    );
    if (result.rows.length === 0) return null;
    return hydrateRow(result.rows[0]);
}

async function countByLicense(licenseId) {
    const normalizedId = normalizeText(licenseId);
    if (!normalizedId) return 0;
    const result = await postgresStore.query(
        'SELECT COUNT(*)::int AS n FROM license_conditions WHERE license_id = $1',
        [normalizedId],
    );
    return result.rows[0]?.n || 0;
}

function buildPayload(input) {
    const payload = (input && typeof input.payload === 'object' && input.payload) ? clone(input.payload) : {};
    // Remove campos canonicos para nao duplicar no JSONB
    for (const k of [
        'id', 'licenseId', 'license_id', 'numero', 'titulo', 'texto', 'tipo',
        'prazo', 'periodicidadeRelatorio', 'periodicidade_relatorio',
        'mesesEntrega', 'meses_entrega', 'ordem', 'parecerTecnicoRef', 'parecer_tecnico_ref',
        'createdAt', 'updatedAt', 'updatedBy', 'updated_by', 'created_at', 'updated_at',
    ]) {
        delete payload[k];
    }
    return payload;
}

async function save(condition, { updatedBy } = {}) {
    const id = normalizeText(condition?.id);
    const licenseId = normalizeText(condition?.licenseId);
    const numero = normalizeText(condition?.numero);
    const texto = String(condition?.texto || '').trim();
    if (!id) throw new Error('licenseConditionRepository.save: id obrigatorio');
    if (!licenseId) throw new Error('licenseConditionRepository.save: licenseId obrigatorio');
    if (!numero) throw new Error('licenseConditionRepository.save: numero obrigatorio');
    if (!texto) throw new Error('licenseConditionRepository.save: texto obrigatorio');

    const row = {
        id,
        license_id: licenseId,
        numero,
        titulo: String(condition?.titulo || '').trim(),
        texto,
        tipo: normalizeTipo(condition?.tipo),
        prazo: String(condition?.prazo || '').trim(),
        periodicidade_relatorio: String(condition?.periodicidadeRelatorio || '').trim(),
        meses_entrega: normalizeMeses(condition?.mesesEntrega),
        ordem: Number.isInteger(condition?.ordem) ? condition.ordem : 0,
        parecer_tecnico_ref: String(condition?.parecerTecnicoRef || '').trim(),
        payload: buildPayload(condition),
        updated_by: normalizeText(updatedBy) || null,
    };

    const result = await postgresStore.query(
        `
            INSERT INTO license_conditions
                (id, license_id, numero, titulo, texto, tipo, prazo,
                 periodicidade_relatorio, meses_entrega, ordem, parecer_tecnico_ref,
                 payload, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
                license_id = EXCLUDED.license_id,
                numero = EXCLUDED.numero,
                titulo = EXCLUDED.titulo,
                texto = EXCLUDED.texto,
                tipo = EXCLUDED.tipo,
                prazo = EXCLUDED.prazo,
                periodicidade_relatorio = EXCLUDED.periodicidade_relatorio,
                meses_entrega = EXCLUDED.meses_entrega,
                ordem = EXCLUDED.ordem,
                parecer_tecnico_ref = EXCLUDED.parecer_tecnico_ref,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
            RETURNING id, license_id, numero, titulo, texto, tipo, prazo,
                      periodicidade_relatorio, meses_entrega, ordem, parecer_tecnico_ref,
                      payload, created_at, updated_at, updated_by
        `,
        [
            row.id, row.license_id, row.numero, row.titulo, row.texto, row.tipo, row.prazo,
            row.periodicidade_relatorio, row.meses_entrega, row.ordem, row.parecer_tecnico_ref,
            row.payload, row.updated_by,
        ],
    );
    return hydrateRow(result.rows[0]);
}

async function remove(id) {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return false;
    const result = await postgresStore.query(
        'DELETE FROM license_conditions WHERE id = $1',
        [normalizedId],
    );
    return (result.rowCount || 0) > 0;
}

async function removeByLicense(licenseId) {
    const normalizedId = normalizeText(licenseId);
    if (!normalizedId) return 0;
    const result = await postgresStore.query(
        'DELETE FROM license_conditions WHERE license_id = $1',
        [normalizedId],
    );
    return result.rowCount || 0;
}

/**
 * Substitui atomicamente a lista de condicionantes de uma LO pelas fornecidas.
 * Usa transacao: DELETE + INSERT em lote. Preserva created_at dos que continuam
 * (upsert por id). Retorna a lista final ordenada.
 */
async function bulkReplace(licenseId, conditions, { updatedBy } = {}) {
    const normalizedId = normalizeText(licenseId);
    if (!normalizedId) throw new Error('licenseConditionRepository.bulkReplace: licenseId obrigatorio');
    const items = Array.isArray(conditions) ? conditions : [];
    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');
        const keepIds = items.map((c) => normalizeText(c?.id)).filter(Boolean);
        if (keepIds.length === 0) {
            await client.query('DELETE FROM license_conditions WHERE license_id = $1', [normalizedId]);
        } else {
            await client.query(
                'DELETE FROM license_conditions WHERE license_id = $1 AND NOT (id = ANY($2::text[]))',
                [normalizedId, keepIds],
            );
        }
        for (const [idx, cond] of items.entries()) {
            const row = {
                id: normalizeText(cond?.id),
                license_id: normalizedId,
                numero: normalizeText(cond?.numero),
                titulo: String(cond?.titulo || '').trim(),
                texto: String(cond?.texto || '').trim(),
                tipo: normalizeTipo(cond?.tipo),
                prazo: String(cond?.prazo || '').trim(),
                periodicidade_relatorio: String(cond?.periodicidadeRelatorio || '').trim(),
                meses_entrega: normalizeMeses(cond?.mesesEntrega),
                ordem: Number.isInteger(cond?.ordem) ? cond.ordem : idx,
                parecer_tecnico_ref: String(cond?.parecerTecnicoRef || '').trim(),
                payload: buildPayload(cond),
                updated_by: normalizeText(updatedBy) || null,
            };
            if (!row.id || !row.numero || !row.texto) {
                throw new Error(`licenseConditionRepository.bulkReplace: item ${idx} invalido (id/numero/texto)`);
            }
            await client.query(
                `
                    INSERT INTO license_conditions
                        (id, license_id, numero, titulo, texto, tipo, prazo,
                         periodicidade_relatorio, meses_entrega, ordem, parecer_tecnico_ref,
                         payload, updated_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (id) DO UPDATE SET
                        license_id = EXCLUDED.license_id,
                        numero = EXCLUDED.numero,
                        titulo = EXCLUDED.titulo,
                        texto = EXCLUDED.texto,
                        tipo = EXCLUDED.tipo,
                        prazo = EXCLUDED.prazo,
                        periodicidade_relatorio = EXCLUDED.periodicidade_relatorio,
                        meses_entrega = EXCLUDED.meses_entrega,
                        ordem = EXCLUDED.ordem,
                        parecer_tecnico_ref = EXCLUDED.parecer_tecnico_ref,
                        payload = EXCLUDED.payload,
                        updated_at = NOW(),
                        updated_by = EXCLUDED.updated_by
                `,
                [
                    row.id, row.license_id, row.numero, row.titulo, row.texto, row.tipo, row.prazo,
                    row.periodicidade_relatorio, row.meses_entrega, row.ordem, row.parecer_tecnico_ref,
                    row.payload, row.updated_by,
                ],
            );
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
    return listByLicense(normalizedId);
}

module.exports = {
    VALID_TIPOS,
    listByLicense,
    getById,
    countByLicense,
    save,
    remove,
    removeByLicense,
    bulkReplace,
};
