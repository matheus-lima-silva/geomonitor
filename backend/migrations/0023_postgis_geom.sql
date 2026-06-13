-- Fase 6.1: habilita PostGIS e adiciona colunas geograficas GERADAS (Opcao A:
-- a fonte de verdade e o payload). Cada geom referencia direto a fonte
-- nao-gerada (payload JSONB em erosions; colunas gps em report_photos), entao
-- nao ha encadeamento de coluna gerada (proibido no Postgres) e nao precisa de
-- trigger — verificado em PostGIS 3.4.
--
-- A geom de erosions deriva do payload preferindo locationCoordinates (estrutura
-- canonica no frontend e na leitura) e caindo para os campos planos latitude/
-- longitude. O CASE+regex evita que um payload com valor nao-numerico quebre o
-- INSERT (vira NULL). geography(Point,4326) => ST_Distance/ST_DWithin em METROS.
--
-- As colunas legadas erosions.latitude/longitude (DOUBLE PRECISION, escritas a
-- mao e hoje inertes — sem indice, sem query que as leia) NAO sao tocadas aqui;
-- convertê-las para geradas e um cleanup opcional separado.

CREATE EXTENSION IF NOT EXISTS postgis;

-- erosions.geom <- payload (Opcao A)
ALTER TABLE erosions ADD COLUMN IF NOT EXISTS geom geography(Point,4326)
    GENERATED ALWAYS AS (
        CASE
            WHEN COALESCE(payload->'locationCoordinates'->>'longitude', payload->>'longitude') ~ '^-?[0-9]+(\.[0-9]+)?$'
             AND COALESCE(payload->'locationCoordinates'->>'latitude',  payload->>'latitude')  ~ '^-?[0-9]+(\.[0-9]+)?$'
            THEN ST_SetSRID(
                ST_MakePoint(
                    COALESCE(payload->'locationCoordinates'->>'longitude', payload->>'longitude')::float8,
                    COALESCE(payload->'locationCoordinates'->>'latitude',  payload->>'latitude')::float8
                ), 4326)::geography
        END
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_erosions_geom ON erosions USING GIST (geom);

-- report_photos.geom <- colunas gps reais
ALTER TABLE report_photos ADD COLUMN IF NOT EXISTS geom geography(Point,4326)
    GENERATED ALWAYS AS (
        CASE
            WHEN gps_lat IS NOT NULL AND gps_lon IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint(gps_lon, gps_lat), 4326)::geography
        END
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_report_photos_geom ON report_photos USING GIST (geom);
