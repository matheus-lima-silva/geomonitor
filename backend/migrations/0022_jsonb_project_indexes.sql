-- Fase 5a: indices de expressao JSONB para os UNICOS filtros por payload feitos
-- em SQL hoje — listByProject / countByProject das tabelas document-store
-- (createDocumentTableRepository.js). A expressao do indice casa EXATAMENTE a do
-- WHERE para que o planner possa usa-la:
--   WHERE UPPER(COALESCE(payload->>'projectId', payload->>'projetoId', '')) = $1
--
-- Cobre as 3 tabelas que usam esse caminho com projectIdFields = [projectId,
-- projetoId]: inspections, operating_licenses, report_delivery_tracking. As demais
-- (projects, users) nao filtram por projeto; erosions/report_photos/workspaces ja
-- usam coluna real project_id (indexada).
--
-- NOTA: os filtros de busca de projects/licenses/inspections por nome, numero,
-- orgao, tipo etc. acontecem HOJE no frontend (JS, sobre a lista carregada via
-- list()). Indices de expressao para esses campos NAO foram adicionados de
-- proposito: nenhuma query SQL os filtra ainda, entao seriam indices nunca usados
-- (custo de escrita sem ganho). So fazem sentido junto da Fase 5c (mover o filtro
-- para o servidor), que segue adiada.

CREATE INDEX IF NOT EXISTS idx_inspections_project_coalesce
    ON inspections ((UPPER(COALESCE(payload->>'projectId', payload->>'projetoId', ''))));

CREATE INDEX IF NOT EXISTS idx_operating_licenses_project_coalesce
    ON operating_licenses ((UPPER(COALESCE(payload->>'projectId', payload->>'projetoId', ''))));

CREATE INDEX IF NOT EXISTS idx_report_delivery_tracking_project_coalesce
    ON report_delivery_tracking ((UPPER(COALESCE(payload->>'projectId', payload->>'projetoId', ''))));
