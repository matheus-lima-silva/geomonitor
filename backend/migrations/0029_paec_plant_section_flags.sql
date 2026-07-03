-- PAEC Fase 3 — secoes 12.1.x liga/desliga por usina (recursos internos:
-- nem toda usina tem todos os 18 recursos do modelo REV 10). Uma linha por
-- secao DESLIGADA ou com titulo customizado; secao ausente = ligada com o
-- titulo padrao do manifest (nao precisa de linha pra cada uma das ~18).

CREATE TABLE IF NOT EXISTS paec_plant_section_flags (
    plant_id       TEXT NOT NULL REFERENCES paec_plants(id) ON DELETE CASCADE,
    section_key    TEXT NOT NULL,               -- sectionKey do manifest (ex. '12_1_3_rede_de')
    enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    title_override TEXT,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by     TEXT,
    PRIMARY KEY (plant_id, section_key)
);
