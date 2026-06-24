const crypto = require('crypto');
const { postgresStore, normalizeText } = require('./common');

// Janela de graca para reuse concorrente legitimo (multi-aba). O refresh token
// vive num cookie httpOnly compartilhado entre abas/subdominios (SSO): duas abas
// podem dar /refresh quase simultaneo com o MESMO token. Sem graca, a 2a viraria
// "reuse" e deslogaria o usuario. Dentro da graca, devolvemos o mesmo sucessor.
const GRACE_MS = 10_000;

function newId() {
    return crypto.randomUUID();
}

// Cria uma nova familia de sessao (login / migracao de token legado). Retorna o
// par { jti, familyId } a embutir no refresh token.
async function issueFamily(userId) {
    const normalizedUser = normalizeText(userId);
    const jti = newId();
    const familyId = newId();
    await postgresStore.query(
        `INSERT INTO refresh_tokens (jti, user_id, family_id, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
        [jti, normalizedUser, familyId],
    );
    return { jti, familyId };
}

/**
 * Consome (rotaciona) um refresh token de forma ATOMICA e detecta reuse.
 *
 * check-then-act protegido por SELECT ... FOR UPDATE na linha do jti:
 *  - jti desconhecido            => { reuse: true }      (nunca emitido / ja sumiu)
 *  - expirado                    => { expired: true }
 *  - revogado dentro da graca    => { jti: sucessor, ... , idempotent: true }
 *                                   (reuse concorrente legitimo: mesmo sucessor,
 *                                    familia preservada)
 *  - revogado fora da graca      => { reuse: true } + revoga a familia inteira
 *                                   (provavel roubo)
 *  - valido                      => { jti: novo, userId, familyId }
 *                                   (consome este, emite o sucessor na familia)
 *
 * Dois /refresh concorrentes com o mesmo token valido: o FOR UPDATE serializa; o
 * 1o segue o caminho feliz e cria o sucessor, o 2o re-le a linha ja revogada e
 * (dentro da graca) devolve o MESMO sucessor — convergem sem deslogar.
 */
async function rotate(presentedJti) {
    const jti = normalizeText(presentedJti);
    if (!jti) return { reuse: true };

    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');

        const res = await client.query(
            `SELECT jti, user_id, family_id, replaced_by, revoked_at, expires_at
             FROM refresh_tokens
             WHERE jti = $1
             FOR UPDATE`,
            [jti],
        );
        const row = res.rows[0];

        if (!row) {
            await client.query('ROLLBACK');
            return { reuse: true };
        }

        if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
            await client.query('ROLLBACK');
            return { expired: true, familyId: row.family_id };
        }

        if (row.revoked_at) {
            const revokedAtMs = new Date(row.revoked_at).getTime();
            const withinGrace = (Date.now() - revokedAtMs) <= GRACE_MS;
            if (withinGrace && row.replaced_by) {
                const successor = await client.query(
                    `SELECT jti, user_id, family_id FROM refresh_tokens WHERE jti = $1`,
                    [row.replaced_by],
                );
                await client.query('COMMIT');
                const s = successor.rows[0];
                if (!s) return { reuse: true };
                return {
                    jti: s.jti,
                    userId: s.user_id,
                    familyId: s.family_id,
                    idempotent: true,
                };
            }

            // Reuse fora da graca: provavel roubo -> revoga a familia inteira.
            await client.query(
                `UPDATE refresh_tokens
                 SET revoked_at = COALESCE(revoked_at, NOW())
                 WHERE family_id = $1 AND revoked_at IS NULL`,
                [row.family_id],
            );
            await client.query('COMMIT');
            return { reuse: true, familyId: row.family_id };
        }

        // Caminho feliz: emite o sucessor e marca este como consumido.
        const nextJti = newId();
        await client.query(
            `INSERT INTO refresh_tokens (jti, user_id, family_id, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
            [nextJti, row.user_id, row.family_id],
        );
        await client.query(
            `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $2 WHERE jti = $1`,
            [jti, nextJti],
        );
        await client.query('COMMIT');
        return { jti: nextJti, userId: row.user_id, familyId: row.family_id };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

// Revoga toda a familia do jti apresentado (logout). Idempotente.
async function revokeFamilyByJti(jti) {
    const normalized = normalizeText(jti);
    if (!normalized) return;
    await postgresStore.query(
        `UPDATE refresh_tokens
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE jti = $1)
           AND revoked_at IS NULL`,
        [normalized],
    );
}

module.exports = {
    GRACE_MS,
    issueFamily,
    rotate,
    revokeFamilyByJti,
};
