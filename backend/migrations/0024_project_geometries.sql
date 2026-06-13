-- Fase 6.2: materializa a geometria de cada projeto (eixo da LT como LineString e
-- as torres como MultiPoint) a partir de projects.payload.linhaCoordenadas /
-- torresCoordenadas. Serve de alvo para o auto-calculo de distancias (6.3/6.4):
-- distance_to_axis = ST_Distance(geom, axis), inside_right_of_way = ST_DWithin(...).
--
-- FK ON DELETE CASCADE: e uma projecao DERIVADA do proprio projeto (como
-- project_report_defaults) — deve sumir junto com o projeto, nao bloquear o delete.
--
-- A reconstrucao em runtime fica em repositories/projectGeometryRepository.js
-- (chamado no save do projeto). A query de build abaixo (backfill) e a MESMA
-- logica, parametrizada por projeto no repositorio. ST_Multi forca MultiPoint
-- mesmo com 1 torre; axis exige >=2 vertices validos (senao NULL); guarda regex
-- ignora coordenada nao-numerica.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS project_geometries (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    axis       geography(LineString,4326),
    towers     geography(MultiPoint,4326),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_geometries_axis ON project_geometries USING GIST (axis);
CREATE INDEX IF NOT EXISTS idx_project_geometries_towers ON project_geometries USING GIST (towers);

-- Backfill: reconstroi a geometria de TODOS os projetos existentes.
INSERT INTO project_geometries (project_id, axis, towers, updated_at)
SELECT
    p.id,
    (
        SELECT ST_MakeLine(ARRAY_AGG(pt ORDER BY ord))
        FROM (
            SELECT ord, ST_SetSRID(ST_MakePoint((e->>'longitude')::float8, (e->>'latitude')::float8), 4326) AS pt
            FROM jsonb_array_elements(p.payload->'linhaCoordenadas') WITH ORDINALITY AS t(e, ord)
            WHERE (e->>'longitude') ~ '^-?[0-9]+(\.[0-9]+)?$'
              AND (e->>'latitude')  ~ '^-?[0-9]+(\.[0-9]+)?$'
        ) s
        HAVING COUNT(*) >= 2
    )::geography AS axis,
    (
        SELECT ST_Multi(ST_Collect(ARRAY_AGG(pt)))
        FROM (
            SELECT ST_SetSRID(ST_MakePoint((e->>'longitude')::float8, (e->>'latitude')::float8), 4326) AS pt
            FROM jsonb_array_elements(p.payload->'torresCoordenadas') AS e
            WHERE (e->>'longitude') ~ '^-?[0-9]+(\.[0-9]+)?$'
              AND (e->>'latitude')  ~ '^-?[0-9]+(\.[0-9]+)?$'
        ) s
        HAVING COUNT(*) >= 1
    )::geography AS towers,
    NOW()
FROM projects p
ON CONFLICT (project_id) DO UPDATE SET
    axis = EXCLUDED.axis,
    towers = EXCLUDED.towers,
    updated_at = NOW();
