-- 0007_workspace_members.sql
-- Associacao usuario <-> workspace para controle de acesso por usuario.
-- Regras aplicadas no backend (middleware workspaceAccess):
--  * Usuarios com perfil global Admin/Administrador/Gerente veem todos os
--    workspaces independentemente desta tabela.
--  * Demais usuarios so podem ler/editar workspaces em que sao membros.
--  * Role local 'owner' e 'editor' permitem escrita; 'viewer' so leitura.

CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL REFERENCES report_workspaces(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   TEXT,
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
    ON workspace_members (user_id);

-- Backfill: garante pelo menos um owner em workspaces pre-existentes.
-- Usa o primeiro usuario ativo com perfil Administrador encontrado (fallback
-- seguro: nao tenta adivinhar o dono real). Admins globais continuam vendo
-- tudo via middleware, entao a falta de membro explicito em workspaces
-- antigos nao bloqueia operacao.
INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
SELECT w.id, u.id, 'owner', 'migration:0007'
FROM report_workspaces w
CROSS JOIN LATERAL (
    SELECT id
    FROM users
    WHERE payload->>'status' = 'Ativo'
      AND payload->>'perfil' IN ('Admin', 'Administrador')
    ORDER BY id ASC
    LIMIT 1
) u
ON CONFLICT DO NOTHING;
