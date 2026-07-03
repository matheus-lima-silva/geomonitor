-- PAEC Fase 4 — anexos com imagem por usina (rota de fuga, unifilar).
-- Uma linha por imagem de um slot (manifest.imageSlots[].assetKey), na ordem
-- de exibicao/insercao no DOCX. FK REAL pra media_assets com RESTRICT
-- (mesmo padrao de paec_templates.tokenized_docx_media_id): a imagem E o
-- conteudo da linha — nao faz sentido linha orfa, e apagar a midia com a
-- ficha ainda referenciando deve falhar alto, nao silenciar.
-- Tabela nova sem dado existente: FK nasce validada, sem o ritual NOT VALID
-- + auditoria de orfaos dos retrofits (0018/0019).

CREATE TABLE IF NOT EXISTS paec_plant_assets (
    plant_id       TEXT NOT NULL REFERENCES paec_plants(id) ON DELETE CASCADE,
    asset_key      TEXT NOT NULL,               -- assetKey do manifest (ex. 'anexo_vii_rota_de_fuga')
    sort_order     INTEGER NOT NULL DEFAULT 0,  -- ordem das imagens dentro do slot
    media_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by     TEXT,
    PRIMARY KEY (plant_id, asset_key, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_paec_plant_assets_media
    ON paec_plant_assets (media_asset_id);
