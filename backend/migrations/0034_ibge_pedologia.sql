-- Fase 3 (docs/plans/erosao-acessos-geodados.md): mapa de solos do IBGE
-- (BDiA Pedologia 1:250.000, versao 2026) recortado na area das torres, para
-- sugerir o tipo de solo na ficha e alimentar a erodibilidade (fator K) da RUSLE.
-- Dado de referencia, sem FK. Carga: ogr2ogr (imagem GDAL) num staging +
-- recorte pela area das cargas do OSM (osm_road_loads), ver plano.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS ibge_pedologia (
    id           BIGSERIAL PRIMARY KEY,
    simbolo      TEXT,
    legenda      TEXT,
    ordem        TEXT,
    subordem     TEXT,
    grande_grupo TEXT,
    textura      TEXT,
    relevo       TEXT,
    componente   TEXT,
    versao       TEXT NOT NULL DEFAULT '2026',
    geom         geography(MultiPolygon, 4326) NOT NULL,
    loaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ibge_pedologia_geom ON ibge_pedologia USING GIST (geom);
