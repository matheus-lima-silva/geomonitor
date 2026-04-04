-- 0005_user_signatories.sql
-- Tabelas de profissoes e signatarios do usuario

CREATE TABLE IF NOT EXISTS profissoes (
    id          TEXT PRIMARY KEY,
    nome        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO profissoes (id, nome) VALUES
    ('engenheiro-civil',        'Engenheiro Civil'),
    ('engenheiro-eletricista',  'Engenheiro Eletricista'),
    ('engenheiro-ambiental',    'Engenheiro Ambiental'),
    ('geologo',                 'Geólogo'),
    ('tecnico-agrimensura',     'Técnico em Agrimensura'),
    ('gestor-projetos',         'Gestor de Projetos'),
    ('engenheiro-mecanico',     'Engenheiro Mecânico'),
    ('biologo',                 'Biólogo')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS user_signatories (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nome                TEXT NOT NULL,
    profissao_id        TEXT REFERENCES profissoes(id),
    registro_conselho   TEXT NOT NULL DEFAULT '',
    registro_estado     TEXT NOT NULL DEFAULT '',
    registro_numero     TEXT NOT NULL DEFAULT '',
    registro_sufixo     TEXT NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_signatories_user_id ON user_signatories(user_id);
