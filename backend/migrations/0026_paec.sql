-- PAEC (Plano de Atendimento as Emergencias da Central) — portal relat.
-- Fichas "titulo chave -> texto valor" por usina + revisoes do modelo canonico
-- tokenizado (docx com {{placeholders}} no MinIO + manifest JSONB).
-- Modelo relacional: header por usina (paec_plants) com concorrencia otimista
-- (version) + uma linha por campo preenchido (paec_plant_fields, auditavel por
-- campo). Save full-sync transacional identico ao monthly_reports.
-- Blocos tabulares, flags de secao e anexos de imagem entram em migracoes
-- futuras (paec_plant_list_items / _section_flags / _assets).
-- NOTA: report_jobs nao muda — o resultMeta (pendencias da geracao) viaja no
-- payload JSONB do job, como os demais campos especificos de kind.

CREATE TABLE IF NOT EXISTS paec_templates (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,               -- ex. 'PAEC AXIA'
    revision_label          TEXT NOT NULL,               -- ex. 'OOSEMB.PL.003.2026 REV 10'
    status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'active', 'retired')),
    source_docx_media_id    TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
    tokenized_docx_media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
    manifest                JSONB NOT NULL,              -- catalogo: fields/blocks/sections/imageSlots/pageAudit
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by              TEXT,
    UNIQUE (name, revision_label)
);

-- No maximo uma revisao ativa por modelo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_paec_templates_one_active
    ON paec_templates (name) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS paec_plants (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,                           -- ex. 'PCH Anta'
    project_id  TEXT,                                    -- link logico opcional a projects (sem FK)
    template_id TEXT NOT NULL REFERENCES paec_templates(id) ON DELETE RESTRICT,
    version     INTEGER NOT NULL DEFAULT 1,              -- concorrencia otimista (409)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paec_plants_name
    ON paec_plants (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_paec_plants_template
    ON paec_plants (template_id);

CREATE TABLE IF NOT EXISTS paec_plant_fields (
    plant_id   TEXT NOT NULL REFERENCES paec_plants(id) ON DELETE CASCADE,
    field_key  TEXT NOT NULL,                            -- chave do manifest (ex. 'usina_hidreletrica_de_marimbondo')
    value      TEXT NOT NULL,                            -- multilinha via \n
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT,
    PRIMARY KEY (plant_id, field_key)
);
