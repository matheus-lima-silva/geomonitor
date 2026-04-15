const { postgresStore, normalizeText } = require('./common');

const VALID_ROLES = new Set(['owner', 'editor', 'viewer']);

function normalizeRole(role) {
    const value = normalizeText(role).toLowerCase();
    if (!VALID_ROLES.has(value)) {
        throw new Error(`workspaceMemberRepository: role invalida "${role}"`);
    }
    return value;
}

function hydrateRow(row) {
    if (!row) return null;
    return {
        workspaceId: row.workspace_id,
        userId: row.user_id,
        role: row.role,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        createdBy: row.created_by || null,
    };
}

async function listByWorkspace(workspaceId) {
    const normalizedId = normalizeText(workspaceId);
    if (!normalizedId) return [];

    const result = await postgresStore.query(
        `
            SELECT workspace_id, user_id, role, created_at, created_by
            FROM workspace_members
            WHERE workspace_id = $1
            ORDER BY created_at ASC, user_id ASC
        `,
        [normalizedId],
    );

    return result.rows.map(hydrateRow);
}

async function listWorkspaceIdsByUser(userId) {
    const normalizedUserId = normalizeText(userId);
    if (!normalizedUserId) return [];

    const result = await postgresStore.query(
        `
            SELECT workspace_id
            FROM workspace_members
            WHERE user_id = $1
        `,
        [normalizedUserId],
    );

    return result.rows.map((row) => row.workspace_id);
}

/**
 * Devolve um Map<workspaceId, role> com a role local do usuario para cada
 * workspace informado. Workspaces sem membership para esse usuario ficam
 * ausentes do Map. Usado pelo handler GET / para anotar `currentUserRole`
 * em cada item sem disparar N queries.
 */
async function listRolesForUser(userId, workspaceIds = []) {
    const normalizedUserId = normalizeText(userId);
    if (!normalizedUserId || !Array.isArray(workspaceIds) || workspaceIds.length === 0) {
        return new Map();
    }

    const normalizedIds = workspaceIds
        .map((id) => normalizeText(id))
        .filter(Boolean);
    if (normalizedIds.length === 0) return new Map();

    const result = await postgresStore.query(
        `
            SELECT workspace_id, role
            FROM workspace_members
            WHERE user_id = $1 AND workspace_id = ANY($2::text[])
        `,
        [normalizedUserId, normalizedIds],
    );

    const map = new Map();
    for (const row of result.rows) {
        map.set(row.workspace_id, row.role);
    }
    return map;
}

async function getMember(workspaceId, userId) {
    const normalizedId = normalizeText(workspaceId);
    const normalizedUserId = normalizeText(userId);
    if (!normalizedId || !normalizedUserId) return null;

    const result = await postgresStore.query(
        `
            SELECT workspace_id, user_id, role, created_at, created_by
            FROM workspace_members
            WHERE workspace_id = $1 AND user_id = $2
            LIMIT 1
        `,
        [normalizedId, normalizedUserId],
    );

    if (result.rows.length === 0) return null;
    return hydrateRow(result.rows[0]);
}

async function addMember(workspaceId, userId, role, createdBy) {
    const normalizedId = normalizeText(workspaceId);
    const normalizedUserId = normalizeText(userId);
    const normalizedRole = normalizeRole(role);
    const normalizedCreatedBy = normalizeText(createdBy) || null;

    if (!normalizedId || !normalizedUserId) {
        throw new Error('workspaceMemberRepository.addMember: workspaceId e userId sao obrigatorios');
    }

    await postgresStore.query(
        `
            INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (workspace_id, user_id)
            DO UPDATE SET role = EXCLUDED.role
        `,
        [normalizedId, normalizedUserId, normalizedRole, normalizedCreatedBy],
    );

    return getMember(normalizedId, normalizedUserId);
}

async function removeMember(workspaceId, userId) {
    const normalizedId = normalizeText(workspaceId);
    const normalizedUserId = normalizeText(userId);
    if (!normalizedId || !normalizedUserId) return;

    await postgresStore.query(
        'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [normalizedId, normalizedUserId],
    );
}

async function countOwners(workspaceId) {
    const normalizedId = normalizeText(workspaceId);
    if (!normalizedId) return 0;

    const result = await postgresStore.query(
        `SELECT COUNT(*)::int AS count
         FROM workspace_members
         WHERE workspace_id = $1 AND role = 'owner'`,
        [normalizedId],
    );

    return result.rows[0]?.count || 0;
}

module.exports = {
    VALID_ROLES,
    listByWorkspace,
    listWorkspaceIdsByUser,
    listRolesForUser,
    getMember,
    addMember,
    removeMember,
    countOwners,
};
