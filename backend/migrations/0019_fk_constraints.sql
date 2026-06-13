-- Fase 4 (parte 1): converte as FKs virtuais SUBORDINADAS em FKs reais. Sao as
-- relacoes de baixo risco onde o filho pertence ao pai (CASCADE) ou apenas o
-- referencia de forma fraca (SET NULL).
--
-- Estrategia por constraint: ADD ... NOT VALID (nao varre a tabela, aceita o
-- estado atual) seguido de VALIDATE CONSTRAINT na mesma transacao.
--
-- SEGURANCA: para as relacoes CASCADE NAO fazemos DELETE automatico de orfaos —
-- se existirem orfaos, o VALIDATE falha e a migracao inteira da rollback (o
-- runner roda 1 transacao por arquivo). Isso e proposital: orfaos sao dados de
-- negocio e devem ser revisados via migrations/0018_fk_orphan_audit.sql antes,
-- nunca apagados silenciosamente por uma migracao. Para a relacao SET NULL a
-- limpeza e nao-destrutiva (so anula referencia pendente), entao a fazemos aqui.
--
-- Postgres nao tem ADD CONSTRAINT IF NOT EXISTS para FK: usamos guard em
-- pg_constraint para manter a migracao idempotente.

-- report_photos.workspace_id -> report_workspaces (CASCADE: fotos pertencem ao workspace)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_photos_workspace') THEN
    ALTER TABLE report_photos ADD CONSTRAINT fk_report_photos_workspace
      FOREIGN KEY (workspace_id) REFERENCES report_workspaces(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
ALTER TABLE report_photos VALIDATE CONSTRAINT fk_report_photos_workspace;

-- license_conditions.license_id -> operating_licenses (CASCADE: condicionantes pertencem a LO)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_license_conditions_license') THEN
    ALTER TABLE license_conditions ADD CONSTRAINT fk_license_conditions_license
      FOREIGN KEY (license_id) REFERENCES operating_licenses(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
ALTER TABLE license_conditions VALIDATE CONSTRAINT fk_license_conditions_license;

-- report_archives.compound_id -> report_compounds (CASCADE)
-- NOTA: archives sao entregas imutaveis; cascatear o delete do compound apaga o
-- historico de entrega. Mantido CASCADE conforme decisao do roadmap; reavaliar
-- para RESTRICT se a retencao do historico for requisito.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_archives_compound') THEN
    ALTER TABLE report_archives ADD CONSTRAINT fk_report_archives_compound
      FOREIGN KEY (compound_id) REFERENCES report_compounds(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
ALTER TABLE report_archives VALIDATE CONSTRAINT fk_report_archives_compound;

-- report_photos.media_asset_id -> media_assets (SET NULL: foto sobrevive sem o asset)
-- Limpeza nao-destrutiva de referencias pendentes antes de validar.
UPDATE report_photos
SET media_asset_id = NULL
WHERE media_asset_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM media_assets m WHERE m.id = report_photos.media_asset_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_photos_media_asset') THEN
    ALTER TABLE report_photos ADD CONSTRAINT fk_report_photos_media_asset
      FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
ALTER TABLE report_photos VALIDATE CONSTRAINT fk_report_photos_media_asset;
