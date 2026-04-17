-- 0011_photo_archive.sql
-- Adiciona estado "arquivada" para fotos. Fluxo:
--   ativa     → deleted_at IS NULL   AND archived_at IS NULL
--   lixeira   → deleted_at NOT NULL  AND archived_at IS NULL
--   arquivada → archived_at NOT NULL
--
-- Transicoes suportadas: ativa↔lixeira (ja existiam); lixeira→arquivada e
-- arquivada→lixeira (novas). Nao ha transicao direta arquivada→ativa —
-- usuario precisa devolver para a lixeira primeiro e restaurar.

ALTER TABLE report_photos
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_report_photos_archived_at
    ON report_photos (archived_at) WHERE archived_at IS NOT NULL;
