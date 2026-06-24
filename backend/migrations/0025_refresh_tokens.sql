-- 0025_refresh_tokens.sql
-- Estado server-side para ROTACAO single-use de refresh tokens com reuse
-- detection.
--
-- Antes desta tabela o refresh token era JWT puro stateless ({sub,type}): cada
-- /refresh emitia um novo, mas NAO invalidava o anterior — o token antigo seguia
-- valido ate o exp (7d). Sem single-use, dois /refresh concorrentes com o mesmo
-- token mintavam dois tokens validos (fork de familia) e um token roubado podia
-- ser reusado indefinidamente.
--
-- Modelo:
--  * jti        : id unico do token (claim jti do JWT). PK.
--  * family_id  : "familia" de uma sessao; a rotacao mantem a mesma familia. Um
--                 reuse detectado revoga a familia inteira.
--  * replaced_by: jti que sucedeu este na rotacao. Habilita a janela de graca
--                 (multi-aba): reuse concorrente do mesmo token dentro da graca
--                 devolve o MESMO sucessor em vez de revogar a familia.
--  * revoked_at : marcado na rotacao (token consumido) ou na revogacao de familia
--                 (reuse/logout).
--  * expires_at : espelha o TTL do refresh (7d); rotate trata expirados como invalidos.
--
-- FK CASCADE: tokens morrem com a credencial (auth_credentials.user_id e PK).
-- Tabela nova => FK declarada inline, sem backfill/VALIDATE.

CREATE TABLE IF NOT EXISTS refresh_tokens (
    jti TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth_credentials(user_id) ON DELETE CASCADE,
    family_id TEXT NOT NULL,
    replaced_by TEXT,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
