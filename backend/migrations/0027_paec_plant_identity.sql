-- PAEC: identidade basica da usina no cadastro (fora do manifest tokenizado).
-- "Tipo" e "Potencia instalada" nao vieram destacados no modelo institucional
-- (nao sao {{placeholder}}), mas sao dados uteis desde o cadastro da ficha
-- (badge/filtro na lista, contexto para quem preenche). Vivem como colunas
-- proprias em paec_plants, nao como paec_plant_fields — nao entram no DOCX
-- gerado nesta fase.

ALTER TABLE paec_plants
    ADD COLUMN IF NOT EXISTS plant_type TEXT
        CHECK (plant_type IS NULL OR plant_type IN ('UHE', 'PCH', 'CGH', 'Subestacao')),
    ADD COLUMN IF NOT EXISTS installed_capacity_mw NUMERIC(10, 2)
        CHECK (installed_capacity_mw IS NULL OR installed_capacity_mw >= 0);
