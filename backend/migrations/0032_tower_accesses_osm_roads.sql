-- Fase 1b (docs/plans/erosao-acessos-geodados.md): acessos por torre e vias
-- publicas do OpenStreetMap usadas para pintar cada tracado por trecho
-- (asfalto / estrada de terra / acesso).

CREATE EXTENSION IF NOT EXISTS postgis;

-- Vias publicas do OSM (extrato carregado por scripts/loadOsmRoads.js). Dado de
-- referencia, sem FK: recarregar substitui por osm_id. surface_class vem da tag
-- `surface`; sem a tag, do tipo de via (surface_inferred = true).
CREATE TABLE IF NOT EXISTS osm_roads (
    osm_id           BIGINT PRIMARY KEY,
    highway          TEXT NOT NULL,
    surface          TEXT,
    surface_class    TEXT NOT NULL CHECK (surface_class IN ('asfalto', 'terra')),
    surface_inferred BOOLEAN NOT NULL DEFAULT false,
    name             TEXT,
    geom             geography(LineString, 4326) NOT NULL,
    loaded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osm_roads_geom ON osm_roads USING GIST (geom);

-- Registro das cargas (quais areas tem vias carregadas e quando).
CREATE TABLE IF NOT EXISTS osm_road_loads (
    id          BIGSERIAL PRIMARY KEY,
    bbox        geography(Polygon, 4326) NOT NULL,
    project_ids TEXT[] NOT NULL DEFAULT '{}',
    ways        INTEGER NOT NULL DEFAULT 0,
    source      TEXT NOT NULL DEFAULT 'overpass',
    loaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osm_road_loads_bbox ON osm_road_loads USING GIST (bbox);

-- Tracados de acesso (e rotas-guia) do empreendimento.
--  kind = 'acesso'    -> ligado a uma torre (tower_number), orientado entrada -> torre
--  kind = 'rota_guia' -> rota de chegada sem torre (camada de referencia)
-- segments: [{ tipo: 'asfalto'|'terra'|'acesso', inferido, manual, comprimentoM, coordinates }]
-- tower_number e texto (mesmo modelo das fotos/erosoes): renumerar torres exige remapear.
-- FK CASCADE: subordinado ao empreendimento (como imports/kmz_requests).
CREATE TABLE IF NOT EXISTS tower_accesses (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tower_number TEXT,
    kind         TEXT NOT NULL DEFAULT 'acesso' CHECK (kind IN ('acesso', 'rota_guia')),
    name         TEXT NOT NULL DEFAULT '',
    geom         geography(LineString, 4326) NOT NULL,
    length_m     DOUBLE PRECISION NOT NULL DEFAULT 0,
    segments     JSONB NOT NULL DEFAULT '[]'::jsonb,
    source       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by   TEXT,
    CONSTRAINT tower_accesses_tower_required CHECK (kind = 'rota_guia' OR tower_number IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tower_accesses_project ON tower_accesses (project_id, tower_number);
CREATE INDEX IF NOT EXISTS idx_tower_accesses_geom ON tower_accesses USING GIST (geom);
