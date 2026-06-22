// Factory de workspace com N owners. Usa SQL direto para nao depender dos
// repositories (evita que mudancas neles afetem isolamento do teste).
// Perfil 'Editor' propositalmente — evita bypass de requireWorkspaceWrite
// por GLOBAL_SUPERUSER, garantindo que a stack real de auth execute.
const crypto = require('crypto');

function uid(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
}

async function seedWorkspaceWithOwners(pool, { ownerCount }) {
    const workspaceId = uid('ws');
    const projectId = uid('proj');
    const ownerUserIds = [];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // O projeto pai precisa existir: a FK report_workspaces.project_id ->
        // projects (ON DELETE RESTRICT, migracao 0020) rejeita workspace orfao.
        await client.query(
            `INSERT INTO projects (id, payload) VALUES ($1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`,
            [projectId],
        );

        await client.query(
            `INSERT INTO report_workspaces (id, project_id, status) VALUES ($1, $2, 'draft')`,
            [workspaceId, projectId],
        );

        for (let i = 0; i < ownerCount; i += 1) {
            const userId = uid('user');
            const payload = {
                nome: `PBT Owner ${i}`,
                email: `owner-${i}-${userId}@pbt.test`,
                status: 'Ativo',
                perfil: 'Editor',
            };
            await client.query(
                `INSERT INTO users (id, payload) VALUES ($1, $2::jsonb)`,
                [userId, JSON.stringify(payload)],
            );
            await client.query(
                `INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
                 VALUES ($1, $2, 'owner', 'pbt-seed')`,
                [workspaceId, userId],
            );
            ownerUserIds.push(userId);
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    return { workspaceId, ownerUserIds };
}

module.exports = {
    seedWorkspaceWithOwners,
};
