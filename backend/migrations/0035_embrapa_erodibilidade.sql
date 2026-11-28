-- Fase 6 (docs/plans/erosao-acessos-geodados.md): mapa de erodibilidade dos solos
-- do Brasil da Embrapa Solos (2024, CNPS, CC BY-NC), recortado na area das torres.
-- Fornece o fator K oficial (k_solos, t h MJ-1 mm-1) por unidade de mapeamento para
-- a RUSLE, no lugar do K provisorio por ordem de solo. Dado de referencia, sem FK.
-- Uso nao comercial (estudo pessoal): ver licenca no plano.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS embrapa_erodibilidade (
    id          BIGSERIAL PRIMARY KEY,
    simbolo     TEXT,
    cod_um      TEXT,
    legenda     TEXT,
    classe_erod TEXT,
    fator_k_um  TEXT,
    k_solos     DOUBLE PRECISION,
    geom        geography(MultiPolygon, 4326) NOT NULL,
    loaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embrapa_erodibilidade_geom ON embrapa_erodibilidade USING GIST (geom);
