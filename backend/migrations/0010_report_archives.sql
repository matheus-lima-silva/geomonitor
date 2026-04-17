-- 0010_report_archives.sql
-- Arquivos imutaveis de entrega de relatorio composto.
--
-- Cada entrega registra:
--  * generated_media_id: copia (por referencia) do output_docx_media_id do
--    compound no momento da entrega. Permanece acessivel mesmo se o compound
--    for regerado posteriormente.
--  * delivered_media_id: upload do PDF/DOCX final alterado externamente
--    (opcional no momento da criacao; preenchido quando o frontend conclui
--    o upload via signed URL e chama /attach-delivered).
--  * sha256 em ambas variantes para verificacao de integridade.
--  * snapshot_payload: copia defensiva do payload do compound, de modo que
--    mesmo se o compound original for alterado, a entrega mantem o estado
--    visual daquele ponto.
--
-- Version e sequencial por compound (v1, v2, v3...) via UNIQUE (compound_id, version).
-- Nao ha FK fisica: compound_id referencia report_compounds(id) por convencao
-- document-store (payload JSONB). Integridade validada no route handler.

CREATE TABLE IF NOT EXISTS report_archives (
    id TEXT PRIMARY KEY,
    compound_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_by TEXT,
    generated_media_id TEXT NOT NULL,
    generated_sha256 TEXT,
    delivered_media_id TEXT,
    delivered_sha256 TEXT,
    notes TEXT,
    snapshot_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_archives_compound_id
    ON report_archives (compound_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_archives_compound_version
    ON report_archives (compound_id, version);
