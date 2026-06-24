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

// Cria um report_compound minimo. report_archives.compound_id -> report_compounds(id)
// (FK CASCADE, migration 0019), entao o pai precisa existir para inserir archives.
async function seedCompound(pool) {
    const compoundId = uid('rc');
    await pool.query(
        `INSERT INTO report_compounds (id, nome, status) VALUES ($1, $2, 'completed')`,
        [compoundId, `PBT compound ${compoundId}`],
    );
    return compoundId;
}

// Cria uma foto num estado inicial ('active' | 'trash' | 'archived'). Semeia o
// project (FK RESTRICT) e o workspace (FK CASCADE) exigidos por report_photos.
// state codificado nos nulaveis deleted_at/archived_at — coluna geom e GERADA
// (nao inserir).
async function seedPhoto(pool, { state = 'trash' } = {}) {
    const projectId = uid('proj');
    const workspaceId = uid('ws');
    const photoId = uid('photo');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO projects (id, payload) VALUES ($1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`,
            [projectId],
        );
        await client.query(
            `INSERT INTO report_workspaces (id, project_id, status) VALUES ($1, $2, 'draft')`,
            [workspaceId, projectId],
        );
        const deletedAt = state === 'trash' ? 'NOW()' : 'NULL';
        const archivedAt = state === 'archived' ? 'NOW()' : 'NULL';
        await client.query(
            `INSERT INTO report_photos (id, workspace_id, project_id, deleted_at, archived_at)
             VALUES ($1, $2, $3, ${deletedAt}, ${archivedAt})`,
            [photoId, workspaceId, projectId],
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    return { photoId, workspaceId, projectId };
}

// Cria uma credencial minima. refresh_tokens.user_id -> auth_credentials(user_id)
// (FK CASCADE, migration 0025), entao a credencial precisa existir para emitir
// refresh tokens.
async function seedCredential(pool) {
    const userId = uid('user');
    await pool.query(
        `INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1, $2, $3)`,
        [userId, `${userId}@pbt.test`, 'pbt-hash'],
    );
    return userId;
}

module.exports = {
    seedWorkspaceWithOwners,
    seedCompound,
    seedPhoto,
    seedCredential,
};
