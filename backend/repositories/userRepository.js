const createDocumentTableRepository = require('./createDocumentTableRepository');
const { postgresStore, normalizeText } = require('./common');

const base = createDocumentTableRepository({
    tableName: 'users',
    projectIdFields: ['projectId', 'projetoId'],
});

// Atualiza apenas payload.lastLoginAt via JSONB merge, sem tocar em
// updated_at/updated_by (que rastreiam quem alterou o perfil, nao o login).
async function updateLastLogin(userId, timestampIso) {
    const id = normalizeText(userId);
    const ts = normalizeText(timestampIso);
    if (!id || !ts) return;
    await postgresStore.query(
        `UPDATE users
         SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('lastLoginAt', $1::text)
         WHERE id = $2`,
        [ts, id],
    );
}

module.exports = {
    ...base,
    updateLastLogin,
};
