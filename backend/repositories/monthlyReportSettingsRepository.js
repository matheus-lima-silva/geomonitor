const { postgresStore, normalizeText } = require('./common');

// Config global do Relatorio Mensal por usuario (equipe + dados do contrato).
// Singleton por owner_user_id — upsert via ON CONFLICT.

function defaultContrato() {
    return { numero: '', objeto: '', contratante: '', contratada: '' };
}

function hydrate(row, ownerUserId) {
    const payload = row && row.payload && typeof row.payload === 'object' ? row.payload : {};
    const contrato = payload.contrato && typeof payload.contrato === 'object' ? payload.contrato : {};
    return {
        ownerUserId,
        team: Array.isArray(payload.team) ? payload.team : [],
        contrato: { ...defaultContrato(), ...contrato },
        updatedAt: row && row.updated_at instanceof Date ? row.updated_at.toISOString() : (row ? row.updated_at : null),
        updatedBy: row ? row.updated_by || null : null,
    };
}

async function getByOwner(ownerUserId) {
    const owner = normalizeText(ownerUserId);
    const res = await postgresStore.query(
        'SELECT payload, updated_at, updated_by FROM monthly_report_settings WHERE owner_user_id = $1 LIMIT 1',
        [owner],
    );
    return hydrate(res.rows[0] || null, owner);
}

async function saveByOwner(ownerUserId, data, updatedBy) {
    const owner = normalizeText(ownerUserId);
    const payload = {
        team: Array.isArray(data.team) ? data.team : [],
        contrato: { ...defaultContrato(), ...(data.contrato || {}) },
    };
    await postgresStore.query(
        `INSERT INTO monthly_report_settings (owner_user_id, payload, updated_at, updated_by)
         VALUES ($1, $2::jsonb, NOW(), $3)
         ON CONFLICT (owner_user_id)
         DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [owner, JSON.stringify(payload), normalizeText(updatedBy) || null],
    );
    return getByOwner(owner);
}

module.exports = {
    getByOwner,
    saveByOwner,
};
