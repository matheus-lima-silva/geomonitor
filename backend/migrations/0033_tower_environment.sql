-- Fases 3/4 (docs/plans/erosao-acessos-geodados.md): atributos do meio fisico por
-- torre, calculados por scripts/computeTowerEnvironment.js lendo so os trechos
-- necessarios de rasters publicos (Copernicus DEM GLO-30, ESA WorldCover).
--
-- tower_number e texto (mesmo modelo de fotos/erosoes/acessos): renumerar torres
-- exige recalcular. FK CASCADE: projecao derivada do empreendimento.
-- payload: { elevacaoM, declividadeMediaGraus, declividadeMaxGraus, orientacao,
--            cobertura: { classe: fracao }, usosSoloSugeridos: [], raioM, ... }
-- sources: { relevo: { nome, versao, url }, cobertura: { ... } }

CREATE TABLE IF NOT EXISTS tower_environment (
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tower_number TEXT NOT NULL,
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    sources      JSONB NOT NULL DEFAULT '{}'::jsonb,
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, tower_number)
);
