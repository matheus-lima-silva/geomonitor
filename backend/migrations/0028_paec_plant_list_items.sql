-- PAEC Fase 2 — blocos tabulares por usina (brigadistas, recursos materiais
-- da BEM, extintores, pontos de encontro etc.). Uma linha por item de lista,
-- na ordem de exibicao; as colunas variam por bloco/revisao do modelo
-- (manifest.blocks[].columns), entao a linha em si e JSONB — so a
-- pertinencia (plant_id + list_key) e relacional.
-- Mesmo padrao de concorrencia otimista do restante do modulo: qualquer
-- mudanca aqui passa pelo saveFull transacional de paec_plants, que
-- reescreve os itens e incrementa paec_plants.version.

CREATE TABLE IF NOT EXISTS paec_plant_list_items (
    id         TEXT PRIMARY KEY,
    plant_id   TEXT NOT NULL REFERENCES paec_plants(id) ON DELETE CASCADE,
    list_key   TEXT NOT NULL,               -- chave do bloco no manifest (ex. 'anexo_iv_relacao_de_brigadistas')
    sort_order INTEGER NOT NULL DEFAULT 0,  -- ordem de exibicao/geracao dentro do list_key
    row        JSONB NOT NULL,              -- { colKey: valor } conforme manifest.blocks[].columns
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_paec_plant_list_items_plant_list
    ON paec_plant_list_items (plant_id, list_key, sort_order);
