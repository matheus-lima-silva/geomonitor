-- 0031_refresh_tokens_cleanup.sql
-- Indice para dar suporte a limpeza de refresh tokens ha muito expirados.
--
-- A tabela refresh_tokens (0025) so cresce: cada rotacao insere um sucessor e
-- marca o anterior como revoked, e nada apaga as linhas mortas. O repositorio
-- passou a rodar um DELETE oportunista (refreshTokenRepository.deleteExpired,
-- acionado no login com throttle de 1h/processo) com o predicado
--   expires_at < NOW() - INTERVAL '1 day'
-- Este indice casa esse predicado e evita seq scan na limpeza. Idempotente.

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);
