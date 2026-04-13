-- 0006: Adiciona soft-delete (lixeira) para fotos de workspace
ALTER TABLE report_photos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_report_photos_deleted_at
    ON report_photos (deleted_at) WHERE deleted_at IS NOT NULL;
