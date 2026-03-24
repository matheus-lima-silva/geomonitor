# Handoff Vivo - Migracao GeoMonitor + GeoRelat + Tigris

## Estado Atual

- Branch alvo: `codex/migracao-geomonitor-postgres-tigris-relatorios`
- Fase atual: `worker-python`, `project-dossier` e `relatorio-composto` parcialmente entregues; infra real, ETL e cutover ainda pendentes
- Status macro atual: `70/80` itens do checklist (`87,5%`) concluidos
- Objetivo do ciclo atual:
  - validar `project-dossier` e `report-compound` em Postgres real, com smoke manual do DOCX real
  - provisionar `Managed Postgres`, bucket `Tigris` e app `geomonitor-worker` no Fly
  - fechar a trilha completa de `mediaAssetRepository`, sobretudo na exportacao efemera
  - preparar o cutover controlado de `DATA_BACKEND` e `MEDIA_BACKEND`

## Ja Existia Antes Deste Ciclo

- desacoplamento inicial de perfis do Firestore
- `GET /api/users/me`
- `POST /api/users/bootstrap`
- rotas MVP de `media`, `report-workspaces` e `reports`
- aba web inicial de `Relatorios`

## Entregas Esperadas Neste Ciclo

- validacao real de `project-dossier` e `report-compound` em Postgres real
- homologacao manual do DOCX real com template base e indice automatico do Word
- provisionamento de `Managed Postgres`, `Tigris` e `geomonitor-worker` no Fly
- fechamento da trilha completa de `mediaAssetRepository` e do `KMZ com fotos` no worker

## Entregas Realizadas Neste Ciclo

- plano oficial salvo em `docs/plans/migracao-geomonitor-postgres-tigris-relatorios.md`
- handoff vivo e checklist salvos em `docs/plans/`
- camada `infra/schema` aberta com:
  - `backend/data/postgresStore.js`
  - `backend/migrations/0001_document_store.sql`
  - `backend/migrations/0002_reporting_scaffold.sql`
  - `backend/migrations/0003_workspace_ephemeral_requests.sql`
  - `backend/scripts/runMigrations.js`
  - suporte a `DATA_BACKEND=postgres` em `backend/data/index.js`
  - dependencia `pg` adicionada ao backend
- camada `repositorios-api` aberta com:
  - `backend/repositories/common.js`
  - `backend/repositories/reportDefaultsRepository.js`
  - `backend/repositories/reportWorkspaceRepository.js`
  - `backend/repositories/reportPhotoRepository.js`
  - `backend/repositories/projectPhotoExportRepository.js`
  - `backend/repositories/projectDossierRepository.js`
  - `backend/repositories/reportCompoundRepository.js`
  - `backend/repositories/reportJobRepository.js`
  - `backend/repositories/mediaAssetRepository.js`
  - `backend/repositories/workspaceImportRepository.js`
  - `backend/repositories/workspaceKmzRequestRepository.js`
  - `backend/repositories/projectRepository.js`
  - `backend/repositories/operatingLicenseRepository.js`
  - `backend/repositories/inspectionRepository.js`
  - `backend/repositories/userRepository.js`
  - `backend/repositories/erosionRepository.js`
  - `backend/repositories/reportDeliveryTrackingRepository.js`
- backend HATEOAS aberto para:
  - `GET/PUT /api/projects/:id/report-defaults`
  - `GET /api/projects/:id/photos`
  - `POST /api/projects/:id/photos/export`
  - `GET /api/projects/:id/photos/exports/:token`
  - `GET/POST/PUT /api/projects/:id/dossiers`
  - `POST /api/projects/:id/dossiers/:dossierId/preflight`
  - `POST /api/projects/:id/dossiers/:dossierId/generate`
  - `GET/POST/PUT /api/report-compounds`
  - `POST /api/report-compounds/:id/add-workspace`
  - `POST /api/report-compounds/:id/reorder`
  - `POST /api/report-compounds/:id/preflight`
  - `POST /api/report-compounds/:id/generate`
- `report-workspaces` expandido com:
  - `GET /api/report-workspaces/:id/photos`
  - `PUT /api/report-workspaces/:id/photos/:photoId`
  - `POST /api/report-workspaces/:id/photos/organize`
  - `POST /api/report-workspaces/:id/kmz`
  - `GET /api/report-workspaces/:id/kmz/:token`
- dominios base reamarrados para repositarios:
  - `projects`
  - `licenses`
  - `inspections`
  - `users`
  - `erosions`
  - `report-delivery-tracking`
- `projectDossiers` preflight saiu do store generico e agora conta via:
  - `inspectionRepository`
  - `operatingLicenseRepository`
  - `erosionRepository`
  - `reportDeliveryTrackingRepository`
  - `reportWorkspaceRepository`
  - `reportPhotoRepository`
- UI de `Relatorios` reestruturada com abas:
  - Workspaces
  - Biblioteca do Empreendimento
  - Dossie do Empreendimento
  - Relatorios Compostos
- o frontend de `Relatorios` agora cobre:
  - criacao de workspace
  - importacao real de `fotos soltas`
  - entrada estruturada por `subpastas por torre`
  - registro de `KMZ organizado`
  - upload via signed URL Tigris ou fallback local
  - criacao de `report_photo` por arquivo importado
  - inferencia inicial de `towerId` por caminho da pasta em `subpastas por torre`
  - listagem de fotos do workspace alvo para curadoria
  - curadoria minima por foto com edicao de `caption`, `towerId` e `includeInReport`
  - persistencia manual da curadoria via `PUT /api/report-workspaces/:id/photos/:photoId`
  - autosave real do rascunho via `PUT /api/report-workspaces/:id` em `draftState.curationDrafts`
  - listagem agregada real de fotos por empreendimento
  - filtros operacionais da biblioteca por `workspace`, `torre`, `legenda` e `data`
  - CTA de exportacao efemera no frontend com download real do ZIP filtrado
  - criacao de dossies
  - builder de escopo editorial do dossie no frontend
  - acoes de `Rodar Preflight` e `Enfileirar Geracao` do dossie na UI
  - criacao de relatorios compostos
  - vinculacao de workspace ao relatorio composto na UI
  - reorder visual dedicado dos workspaces no relatorio composto
  - acoes de `Rodar Preflight` e `Enfileirar Geracao` do relatorio composto na UI
  - smoke funcional da trilha web de `project-dossier` e `relatorio-composto`
- processamento efetivo de `KMZ organizado` aberto com:
  - `backend/utils/kmzReader.js` — leitor ZIP/KMZ com suporte a STORE e DEFLATE
  - `backend/utils/kmlParser.js` — port CJS das funcoes de `kmlUtils.js` com `@xmldom/xmldom`
  - `backend/utils/kmzProcessor.js` — orquestrador de extracao de fotos, inferencia de torre e criacao de `report_photo`
  - `POST /api/report-workspaces/:id/kmz/process` — endpoint que recebe `mediaAssetId` e processa o KMZ completo
  - `processWorkspaceKmz` em `src/services/reportWorkspaceService.js`
  - frontend de `Relatorios` atualizado para chamar processamento apos upload e exibir sumario
  - inferencia de torre por pasta interna do KMZ (`kmz_folder`) e por placemark (`kmz_placemark`)
  - deteccao de duplicatas por sha256 no workspace
  - testes em `kmlParser`, `kmzReader`, `kmzProcessor` e endpoint `kmz/process`
- service frontend novo para curadoria/listagem do workspace:
  - `listReportWorkspacePhotos` em `src/services/reportWorkspaceService.js`
  - `updateReportWorkspace` em `src/services/reportWorkspaceService.js`
- cobertura de `ReportsView` ampliada para:
  - curadoria do workspace
  - persistencia de `caption`, `towerId` e `includeInReport`
  - autosave do `draftState` do workspace
- `photo-library` deixou de ser apenas scaffold e agora tem listagem agregada real por empreendimento via `GET /api/projects/:id/photos`
- `photo-library` agora tambem aplica filtros reais na listagem e na exportacao efemera via:
  - `workspaceId`
  - `towerId`
  - `captionQuery`
  - `dateFrom`
  - `dateTo`
- exportacao de fotos por empreendimento tem request efemero e download real via:
  - `POST /api/projects/:id/photos/export`
  - `GET /api/projects/:id/photos/exports/:token`
  - `GET /api/projects/:id/photos/exports/:token?download=1`
- `project-dossier` possui trilha real de CRUD, builder de escopo, preflight e enfileiramento:
  - cria e persiste `draftState`
  - roda preflight contra repositorios respeitando `scopeJson`
  - marca `canGenerate=false` quando o escopo editorial esta vazio
  - enfileira `report_job` com status `queued`
- `relatorio-composto` possui trilha real de CRUD, add/reorder, preflight e enfileiramento:
  - persiste `workspaceIds`, `orderJson` e `draftState`
  - valida workspaces no preflight
  - enfileira `report_job` com status `queued`
  - frontend agora expone adicao de workspace, reorder visual dedicado, preflight e geracao enfileirada
- `media-tigris` aberto com:
  - `backend/routes/media.js` ajustada para signed URLs e fallback local
  - `backend/utils/mediaStorage.js`
  - `backend/__tests__/mediaTigris.test.js`
  - `backend/utils/__tests__/mediaStorage.test.js`
- configuracoes canonicas do Fly abertas em:
  - `deploy/fly/homologacao/web.toml`
  - `deploy/fly/homologacao/api.toml`
  - `deploy/fly/homologacao/worker.toml`
  - `deploy/fly/producao/web.toml`
  - `deploy/fly/producao/api.toml`
  - `deploy/fly/producao/worker.toml`
- playbook de bootstrap do Fly documentado em:
  - `deploy/fly/README.md`
  - `scripts/fly/bootstrap.ps1`
  - `scripts/fly/deploy.ps1`
- scaffold minimo do worker Python aberto em:
  - `worker/app.py`
  - `worker/Dockerfile`

## Interfaces Relevantes

- `report-workspaces`
  - import
  - fotos
  - organizacao
  - KMZ
- `projects/:id/photos`
  - listagem agregada
  - export request por token
- `projects/:id/dossiers`
  - CRUD
  - preflight
  - geracao enfileirada
- `report-compounds`
  - CRUD
  - add/reorder
  - preflight
  - geracao enfileirada

## Macroetapa Atual

- `infra/schema`: parcialmente entregue
  - status: base pronta para Postgres por flag e migracoes iniciais versionadas
- `repositorios-api`: parcialmente entregue
  - status: rotas novas e dominios base principais ja usam repositorios; restam smoke real em Postgres e corte final do store generico
- `fly-bootstrap-deploy`: em progresso
  - status: configuracoes e scripts prontos; provisionamento cloud e deploy real ainda pendentes
- `media-tigris`: parcialmente entregue
  - status: upload assinado real aberto para curadoria e geracao (`DOCX`/`KMZ`), com fallback local preservado; falta fechar a trilha completa da exportacao efemera via `mediaAssetRepository`
- `workspace-curadoria`: entregue nesta fase
  - status: stepper, selecao obrigatoria, tres modos de entrada, curadoria minima, autosave e processamento efetivo de `KMZ organizado` entregues
- `photo-library`: entregue nesta fase
  - status: listagem agregada, filtros operacionais e ZIP efemero real entregues; refinamentos de selecao parcial dedicada podem evoluir sem bloquear o restante da frente
- `project-dossier`: parcialmente entregue
  - status: CRUD, builder de escopo, preflight, fila e DOCX final no worker entregues; falta validacao em Postgres real e smoke manual do documento final
- `relatorio-composto`: parcialmente entregue
  - status: CRUD, add/reorder, preflight, fila e documento final no worker entregues; falta smoke manual e homologacao com infra real
- `worker-python`: parcialmente entregue
  - status: scaffold bootstrap + cliente de jobs + runtime manual/poll + handlers reais de `DOCX` e `KMZ` + template real + staging temporario + provisionamento no Fly em homologacao entregues; falta smoke funcional dos fluxos de relatorio em Postgres real
- proxima macroetapa alvo: fechar a infra real (`Postgres`, `Tigris`, `Fly`) e preparar o cutover controlado

## Entregas Realizadas Neste Ciclo (continuacao - 2026-03-23)

- `templates-admin` aberto com:
  - `backend/repositories/reportTemplateRepository.js` — CRUD + activate com desativacao atomica por `sourceKind`
  - `backend/routes/reportTemplates.js` — endpoints HATEOAS: GET /, GET /:id, POST /, PUT /:id, DELETE /:id, POST /:id/activate
  - `backend/__tests__/reportTemplates.test.js` — CRUD completo, activate com desativacao, 404s
  - `src/services/reportTemplateService.js` — service frontend com list, create, update, delete, activate
  - `src/services/__tests__/reportTemplateService.test.js` — 7 testes
  - aba `Templates` adicionada ao `AdminView.jsx` com tabela, modal de criacao/edicao, ativacao e exclusao
  - `DashboardView.jsx` atualizado para buscar e passar templates ao AdminView
- `reportJobRepository` estendido com:
  - `list()`, `listQueued()`, `claimNext()` (atomico com `FOR UPDATE SKIP LOCKED` em Postgres), `markComplete()`, `markFailed()`
  - hydration completa com `buildMetadata` e colunas tipadas
- `backend/routes/reportJobs.js` aberto com:
  - GET / — listar jobs
  - GET /:id — detalhe
  - POST /claim — worker pega proximo job (204 se vazio)
  - PUT /:id/complete — marcar concluido com output media IDs
  - PUT /:id/fail — marcar falha com errorLog
  - `backend/__tests__/reportJobs.test.js` — 5 testes
- `rules.js` migrado de `getDocRef('config', 'rules')` para `rulesConfigRepository`
  - `backend/repositories/rulesConfigRepository.js` — singleton com id='default', dual-backend
- `reports.js` migrado de `getDataStore()` para `reportJobRepository` (generate) + fallback legado (GET /:id)
  - nenhuma rota em `backend/routes/` usa mais `getDocRef` diretamente
- `mediaAssetRepository` expandido com:
  - `listByLinkedResource(resourceType, resourceId)` — filtra por linked_resource_type/id
  - `listByPurpose(purpose)` — filtra por purpose
  - `markReady(id, sha256, sizeBytes)` — atualiza status para 'ready'
  - `markFailed(id, errorLog)` — atualiza status para 'failed'
  - hydration refatorada com `MEDIA_SELECT` + `hydrateRow` compartilhados

## Entregas Realizadas Neste Ciclo (continuacao - 2026-03-23 ciclo 3)

- `ReportsView` conectado ao `DashboardView`:
  - lazy import adicionado para `ReportsView`
  - case handler `georelat` adicionado a `renderTab()` — aba Relatorios agora renderiza corretamente
- padronizacao de `remove()` nos repositorios:
  - `deleteFirestoreDoc` helper adicionado a `backend/repositories/common.js`
  - 5 repositorios atualizados para usar `deleteFirestoreDoc` em vez de `require('../data').getDataStore().deleteDoc()` inline:
    - `mediaAssetRepository.js`
    - `reportTemplateRepository.js`
    - `erosionRepository.js`
    - `reportWorkspaceRepository.js`
    - `createDocumentTableRepository.js`
  - nenhum repositorio usa mais `require('../data').getDataStore().deleteDoc()` diretamente

## Entregas Realizadas Neste Ciclo (continuacao - 2026-03-23 ciclo 4)

- corte final do fallback generico nas rotas/reuso:
  - `backend/utils/crudFactory.js` agora exige repositorio e nao possui mais fallback de store inline
  - `backend/repositories/legacyReportRepository.js` isola a leitura legada da collection `reports`
  - `backend/routes/reports.js` passou a usar `legacyReportRepository` como fallback legado de leitura
- worker Python conectado a `report-jobs` via token interno:
  - `backend/utils/authMiddleware.js` ganhou `requireEditorOrWorker` com header `x-worker-token`
  - `backend/routes/reportJobs.js` agora aceita worker interno em `POST /claim`, `PUT /:id/complete` e `PUT /:id/fail`
  - `reportJobRepository` passou a registrar `updatedBy` do ator em `claimNext`, `markComplete` e `markFailed`
  - `backend/__tests__/reportJobs.test.js` cobre fluxo por token interno do worker
  - `backend/utils/__tests__/authMiddleware.test.js` cobre autenticacao do token interno
- runtime do worker ampliado com consumo real/manual:
  - `worker/runtime.py` â€” cliente HTTP da API + estado interno + `run_once()`
  - `worker/app.py` â€” endpoints `GET /health`, `GET /stats`, `POST /run-once`
  - `worker/tests/test_runtime.py` â€” 5 testes do runtime/cliente
  - `worker/Dockerfile` atualizado para rodar `python -m worker.app`
- runtime/deploy do worker alinhado:
  - `deploy/fly/homologacao/worker.toml` e `deploy/fly/producao/worker.toml` agora versionam `GEOMONITOR_API_URL`, `WORKER_AUTO_POLL` e `WORKER_POLL_INTERVAL_SECONDS`
  - `deploy/fly/README.md` e `scripts/fly/bootstrap.ps1` agora documentam `WORKER_API_TOKEN` compartilhado entre API e worker

## Entregas Realizadas Neste Ciclo (continuacao - 2026-03-23 ciclo 5)

- contexto de renderizacao normalizado do worker aberto com:
  - `backend/utils/reportJobContext.js` â€” builder de contexto para `project_dossier` e `report_compound`
  - `GET /api/report-jobs/:id/context` em `backend/routes/reportJobs.js`
  - HATEOAS de `report-jobs` agora expone link de `context`
- repositorios de dominios base ampliados para montagem do contexto:
  - `createDocumentTableRepository.js` ganhou `listByProject`
  - `erosionRepository.js` ganhou `listByProject`
  - `reportWorkspaceRepository.js` ganhou `listByProject`
- sincronizacao de status do job com o registro pai aberta em `reportJobRepository`:
  - `claimNext()` agora marca `project_dossier` / `report_compound` como `processing`
  - `markComplete()` agora persiste `status=completed` e `outputDocxMediaId`
  - `markFailed()` agora persiste `status=failed` e `lastError`
- autenticacao do worker ampliada nas trilhas de media:
  - `backend/utils/authMiddleware.js` ganhou `requireActiveUserOrWorker`
  - `backend/routes/media.js` agora aceita `x-worker-token` em `POST /upload-url`, `PUT /:id/upload`, `POST /complete` e `GET /:id/content`
- worker Python passou a gerar DOCX real ponta a ponta:
  - `worker/job_processor.py` â€” staging temporario, renderizacao, upload de output e conclusao da media
  - `worker/runtime.py` â€” cliente HTTP expandido com `get_job_context`, download de imagem, criacao/upload/conclusao de media
  - `worker/requirements.txt` â€” `python-docx`
  - `worker/assets/template_relatorio.docx` â€” template real portado para o repo
  - `worker/docx_renderer.py` â€” render baseado no template real, preservando cabecalho/sumario e regravando metadados no ZIP final
- melhoria editorial do DOCX:
  - as fotos agora entram em grupos `Heading 2` e cada imagem entra como `Heading 3`
  - isso torna as imagens rastreaveis no indice automatico do Word (`TOC \o "1-3"`)
- frontend de `Relatorios` refinado para acompanhar o output final:
  - `ReportsView.jsx` agora faz refresh curto enquanto houver itens `queued` / `processing`
  - dossies e compostos exibem `status`, `lastError` e botao `Baixar DOCX`
  - `mediaService.js` ganhou helper de download do artefato final
- cobertura automatizada ampliada:
  - `backend/__tests__/reportJobs.test.js` cobre contexto de renderizacao e sincronizacao do pai
  - `backend/__tests__/media.test.js` cobre upload/download de media por `x-worker-token`
  - `worker/tests/test_runtime.py` cobre `project_dossier`, `report_compound`, falha de upload e falha isolada de foto
  - `src/features/reports/components/__tests__/ReportsView.test.jsx` cobre polling curto e download do DOCX final

## Entregas Realizadas Neste Ciclo (continuacao - 2026-03-23 ciclo 6)

- `workspace_kmz` entrou na trilha real de jobs:
  - `POST /api/report-workspaces/:id/kmz` agora valida o workspace, cria `workspace_kmz_request` com `lastJobId` e enfileira `report_job` real do tipo `workspace_kmz`
  - `GET /api/report-workspaces/:id/kmz/:token` agora reflete `statusExecucao`, `lastError`, `outputKmzMediaId` e links HATEOAS para `job` e `download`
  - `reportJobRepository` agora sincroniza `workspace_kmz_request` em `claimNext`, `markComplete` e `markFailed`
- contexto do worker ampliado para `workspace_kmz`:
  - `backend/utils/reportJobContext.js` agora monta `project`, `workspace`, `photos` e metadados da solicitacao efemera para o job de KMZ
  - `backend/__tests__/reportJobs.test.js` agora cobre contexto e sincronizacao da solicitacao `workspace_kmz`
- worker Python agora gera `KMZ com fotos` ponta a ponta:
  - `worker/kmz_renderer.py` gera `doc.kml`, reaproveita geometria do empreendimento (`linhaCoordenadas` / `torresCoordenadas`), embute fotos no pacote e inclui `README.txt` com observacoes quando houver degradacao parcial
  - `worker/job_processor.py` passou a despachar `workspace_kmz`, subir o artefato final via `/api/media`, concluir a media e reportar `outputKmzMediaId`
  - `worker/runtime.py` agora aceita `purpose` dinamico em `create_output_media`, permitindo `report_output_docx` e `report_output_kmz`
  - `worker/tests/test_runtime.py` agora cobre `workspace_kmz` alem de `project_dossier` e `report_compound`
- frontend de `Relatorios` passou a operar o KMZ final:
  - `src/services/reportWorkspaceService.js` ganhou `requestWorkspaceKmz()` e `getWorkspaceKmzRequest()`
  - `ReportsView.jsx` agora permite `Gerar KMZ com Fotos`, faz polling curto do request efemero e libera `Baixar KMZ` quando o worker conclui
  - `src/features/reports/components/__tests__/ReportsView.test.jsx` cobre o request e o download do `KMZ`

## Entregas Realizadas Neste Ciclo (continuacao - 2026-03-23 ciclo 7)

- trilha de exportacao efemera da biblioteca fechada com `mediaAssetRepository`:
  - `backend/routes/projectPhotos.js` agora persiste o ZIP gerado como `media_asset` (`purpose=project_photo_export_zip`, `linkedResourceType=project_photo_export`) e reaproveita o mesmo artefato em downloads subsequentes
  - `project_photo_export` passa a registrar `outputMediaAssetId`, `downloadFileName`, `generatedItemCount` e `skippedItemCount` no payload efemero
  - a resposta binaria continua sendo servida pelo endpoint existente, mas com leitura do arquivo persistido no storage configurado
- utilitario de storage ampliado para escrita server-side em ambos backends:
  - `backend/utils/mediaStorage.js` ganhou `writeStoredContent(asset, buffer)`
  - para `MEDIA_BACKEND=local`, reaproveita `writeLocalContent`
  - para `MEDIA_BACKEND=tigris`, grava via `PutObjectCommand` e devolve metadados (`etag`, `sha256`, tamanho)
- hardening de autenticacao interna do worker restaurado para evitar quebra das rotas de media:
  - `backend/utils/authMiddleware.js` voltou a exportar `requireEditorOrWorker` e `requireActiveUserOrWorker` com validacao de `x-worker-token`
  - `backend/jest.setup.js` foi alinhado com os novos middlewares para manter a suite de integracao operante
- cobertura automatizada ajustada para a nova trilha efemera:
  - `backend/__tests__/projectPhotos.test.js` agora valida status `ready`, `outputMediaAssetId` e reuso do mesmo ZIP no segundo download

## Entregas Realizadas Neste Ciclo (continuacao - 2026-03-23 ciclo 8)

- homologacao Fly provisionada com cleanup de duplicidade:
  - apps `geomonitor-api-hml`, `geomonitor-web-hml` e `geomonitor-worker-hml` criados e com deploy inicial concluido
  - `Managed Postgres` `geomonitor-pg-hml` provisionado e anexado a `geomonitor-api-hml` e `geomonitor-worker-hml`
  - bucket Tigris `geomonitor-media-hml` provisionado para homologacao
  - cluster MPG duplicado em estado `creating` foi limpo (`destroy`), mantendo apenas o cluster `ready` anexado aos apps
- runtime de homologacao configurado por secrets:
  - API homologacao com `DATA_BACKEND=postgres`, `MEDIA_BACKEND=tigris`, `REPORT_EXECUTION_BACKEND=python` e `WORKER_API_TOKEN`
  - Worker homologacao com `WORKER_API_TOKEN` compartilhado, `DATABASE_URL` anexada e credenciais de acesso ao bucket
- verificacoes operacionais de plataforma:
  - `flyctl status` com checks de health passando em `api-hml`, `worker-hml` e `web-hml`
  - inventario final sem duplicidade de cluster ativo e com bucket visivel na organizacao

## Entregas Realizadas Neste Ciclo (continuacao - 2026-03-23 ciclo 9)

- correcoes de runtime em homologacao apos primeiro smoke real:
  - `FIREBASE_SERVICE_ACCOUNT_JSON` da API foi corrigido para JSON valido (antes estava como literal `@backend/serviceAccountKey.json`)
  - migracoes SQL rodadas diretamente dentro da maquina da API (`/nodejs/bin/node scripts/runMigrations.js`) para criar schema no `Managed Postgres`
- smoke real de midia/Tigris concluido em homologacao:
  - `POST /api/media/upload-url` com `x-worker-token`
  - upload binario na URL assinada retornada
  - `POST /api/media/complete`
  - `GET /api/media/:id/content`
  - resultado: media criada e lida com sucesso (`statusExecucao=ready`, conteudo retornado confere)

## Entregas Realizadas Neste Ciclo (continuacao - 2026-03-24 ciclo 10)

- correcoes de integracao API <-> worker em homologacao:
  - causa raiz identificada para erro `API respondeu 404` no worker: rota `/api/report-jobs` nao estava montada em `backend/server.js`
  - hotfix aplicado com `app.use('/api/report-jobs', reportJobsRouter)` e deploy da API em homologacao usando `--dockerfile backend/Dockerfile`
  - `GEOMONITOR_API_URL` do worker normalizada para `https://geomonitor-api-hml.fly.dev`
- smoke real de relatorios em Postgres/Tigris concluido:
  - seed de dados minimos no Postgres homologacao para `project`, `workspace`, `project_dossier`, `report_compound` e `report_jobs`
  - execucao manual de `POST /run-once` no worker processou os dois jobs:
    - `JOB-SMOKE-DOSSIER-HML` -> `completed`
    - `JOB-SMOKE-COMPOUND-HML` -> `completed`
  - confirmacao em banco:
    - ambos `report_jobs` com `status_execucao=completed` e `output_docx_media_id` preenchido
    - `media_assets` correspondentes em `status_execucao=ready`, `purpose=report_output_docx` e `linked_resource_type=report_job`

## Validacao Executada

- data da rodada: `2026-03-24` (ciclos 9 e 10)
- frontend:
  - `npm test -- ReportsView.test.jsx`
- backend:
  - `npm test -- --runInBand reportJobs.test.js reportWorkspaces.test.js media.test.js`
  - `npm test -- --runInBand projectPhotos.test.js media.test.js`
  - `npm test -- reportJobs.test.js --runInBand`
- infraestrutura/deploy:
  - `flyctl apps list`
  - `flyctl mpg list`
  - `flyctl mpg status <cluster-id>`
  - `flyctl mpg attach <cluster-id> -a geomonitor-api-hml`
  - `flyctl mpg attach <cluster-id> -a geomonitor-worker-hml -u fly-user -d fly-db`
  - `flyctl storage create -a geomonitor-api-hml -n geomonitor-media-hml -o personal -y`
  - `flyctl deploy --config deploy/fly/homologacao/api.toml --dockerfile backend/Dockerfile --strategy rolling --remote-only --ha=false`
  - `flyctl deploy --config deploy/fly/homologacao/worker.toml --dockerfile worker/Dockerfile --strategy rolling --remote-only --ha=false`
  - `flyctl deploy --config deploy/fly/homologacao/web.toml --dockerfile Dockerfile --strategy rolling --remote-only --ha=false`
  - `flyctl status -a geomonitor-api-hml`
  - `flyctl status -a geomonitor-worker-hml`
  - `flyctl status -a geomonitor-web-hml`
  - `flyctl ssh console -a geomonitor-api-hml -C '/nodejs/bin/node scripts/runMigrations.js'`
  - smoke HTTP real da API homologacao via script Python (upload assinado/complete/content)
  - `flyctl deploy -c deploy/fly/homologacao/api.toml --dockerfile backend/Dockerfile --remote-only`
  - seed/verificacao SQL em homologacao via `flyctl ssh console` com script Node por stdin (`/nodejs/bin/node -`)
  - smoke manual do worker via `POST https://geomonitor-worker-hml.fly.dev/run-once` e `GET /stats`
- worker:
  - `python -m unittest discover -s worker/tests -p "test_*.py"`
- observacao:
  - nesta continuacao, alem dos testes focados de backend, houve validacao real de deploy/health em homologacao Fly

## Resultado da Validacao

- frontend verde em `1/1` arquivo e `10/10` testes focados
- backend verde em `3/3` suites e `18/18` testes focados
- backend verde em `2/2` suites e `6/6` testes focados da continuacao (`projectPhotos` + `media`)
- worker Python verde em `10/10` testes
- homologacao Fly verde em healthcheck basico de `api-hml`, `worker-hml` e `web-hml`
- homologacao Fly verde no smoke real de midia com `MEDIA_BACKEND=tigris`
- homologacao Fly verde no smoke real de jobs `project_dossier` e `report_compound` com `DATA_BACKEND=postgres` + `MEDIA_BACKEND=tigris`
- ultima validacao ampla registrada antes desta rodada permaneceu:
  - backend verde em `26/26` suites e `142/142` testes
  - frontend verde em `48/48` arquivos e `261/261` testes
  - build web verde
  - warning residual de chunk grande em `dist/assets/index-BFtwlLCV.js`

## Risco Residual Atual

- o backend principal ainda opera em store Firestore e nao em Postgres
- o `postgresStore` e os repositorios alvo ja existem, o banco de homologacao foi provisionado/anexado e as migracoes foram aplicadas; o smoke funcional de jobs de relatorio em `DATA_BACKEND=postgres` foi validado, restando validacao manual/editorial do DOCX final no Word
- `media` ja possui backend Tigris por signed URL e queries especializadas no repositorio; falta fechar a trilha completa de curadoria/exportacao/geracao em ambiente real
- dossie e composto ja possuem processamento efetivo de DOCX no worker, mas ainda faltam smoke manual no Word e validacao em Postgres real
- o dossie ja possui builder de escopo, preflight e DOCX final, mas ainda nao foi validado em Postgres real
- o relatorio composto ja possui comandos operacionais na UI e documento final no worker; homologacao funcional via worker em infra real foi validada, faltando rodada manual completa via UI + revisao editorial no Word
- o ambiente ja possui trilha validada para migracoes via `fly ssh` no app API; ainda falta automatizar esse passo em script operacional
- o worker Python ja possui handlers reais para `project_dossier`, `report_compound` e `workspace_kmz`, com template real e staging temporario, e agora esta provisionado em homologacao; homologacao funcional de jobs DOCX foi validada, faltando consolidar `workspace_kmz` em homologacao real
- o auto-poll do worker segue desligado por padrao (`WORKER_AUTO_POLL=false`) ate a homologacao em infra real
- `reports.js` segue com fallback legado de leitura, agora isolado em `legacyReportRepository`
- o `document_store` generico ainda nao foi removido por completo das areas remanescentes
- ETL e cutover (`DATA_BACKEND` / `MEDIA_BACKEND`) ainda nao foram executados
- o build segue com warning de chunk grande no bundle principal

## Riscos Conhecidos

- `Managed Postgres`, bucket `Tigris` e `geomonitor-worker` ja foram provisionados em homologacao; ainda falta ensaio funcional de geracao de relatorios usando esse ambiente.
- ETL de migracao e cutover operacional ainda nao foram executados.
- `KMZ com fotos` foi entregue localmente, mas ainda falta homologacao em ambiente real com `MEDIA_BACKEND=tigris`.
- Algumas rotas novas ainda dependem de validacao em Postgres real para serem consideradas prontas para cutover.

## Proximos Passos Imediatos

1. executar validacao manual/editorial dos DOCX gerados em homologacao (Word: sumario, estilos, imagens, quebras e metadados)
2. consolidar `workspace_kmz` em homologacao real com `MEDIA_BACKEND=tigris` e fechar matriz de smoke dos 3 tipos de job
3. usar `mediaAssetRepository` na trilha completa de curadoria, exportacao e geracao em ambiente real
4. consolidar ETL, corte final do `document_store` generico e plano de cutover (`DATA_BACKEND` / `MEDIA_BACKEND`)
5. preparar o ensaio de promote com worker python ligado apos a homologacao funcional completa do Fly
