-- Indices parciais para os caminhos quentes de leitura/claim que hoje varrem a
-- tabela inteira. Aditivo e idempotente; nenhuma coluna nova.
--
-- report_photos: filtros de estado (ativa / lixeira) sempre por workspace_id, com
-- ORDER BY estavel. As colunas do indice acompanham o ORDER BY das queries em
-- reportPhotoRepository.js (listByWorkspace / listTrashedByWorkspace).
-- report_jobs: a fila (claimNext / listQueued) e a recuperacao de jobs travados
-- (reclaimStuckJobs) filtram por status_execucao.

-- Fotos ativas de um workspace (listByWorkspace)
CREATE INDEX IF NOT EXISTS idx_report_photos_ws_active
    ON report_photos (workspace_id, sort_order, updated_at DESC)
    WHERE deleted_at IS NULL AND archived_at IS NULL;

-- Lixeira do workspace (listTrashedByWorkspace / archiveAllTrashed / removeAllTrashed)
CREATE INDEX IF NOT EXISTS idx_report_photos_ws_trashed
    ON report_photos (workspace_id, deleted_at DESC)
    WHERE deleted_at IS NOT NULL AND archived_at IS NULL;

-- Fila de jobs (listQueued / claimNext)
CREATE INDEX IF NOT EXISTS idx_report_jobs_queued
    ON report_jobs (created_at ASC)
    WHERE status_execucao = 'queued';

-- Jobs travados em processing (reclaimStuckJobs)
CREATE INDEX IF NOT EXISTS idx_report_jobs_processing
    ON report_jobs (updated_at)
    WHERE status_execucao = 'processing';

-- Lookup de media asset por foto (cleanup da lixeira + FK futura)
CREATE INDEX IF NOT EXISTS idx_report_photos_media_asset_id
    ON report_photos (media_asset_id)
    WHERE media_asset_id IS NOT NULL;
