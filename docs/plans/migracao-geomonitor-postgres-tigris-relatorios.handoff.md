# Handoff Vivo - Migracao GeoMonitor + GeoRelat + Tigris

## Estado Atual

- Branch alvo: `codex/migracao-geomonitor-postgres-tigris-relatorios`
- Fase atual: `workspace-curadoria` em progresso, com `photo-library`, `project-dossier` e `relatorio-composto` parcialmente entregues
- Objetivo do ciclo atual:
  - fechar o restante de `workspace-curadoria` com processamento efetivo de `KMZ organizado`
  - manter a trilha de curadoria e biblioteca estavel enquanto a fila real do worker nao entra
  - validar `project-dossier` em Postgres real e manter `relatorio-composto` estavel enquanto o worker nao entra

## Ja Existia Antes Deste Ciclo

- desacoplamento inicial de perfis do Firestore
- `GET /api/users/me`
- `POST /api/users/bootstrap`
- rotas MVP de `media`, `report-workspaces` e `reports`
- aba web inicial de `Relatorios`

## Entregas Esperadas Neste Ciclo

- processamento efetivo de `KMZ organizado`
- consolidacao da trilha de curadoria antes da integracao do worker
- validacao do preflight de `project-dossier` em Postgres real
- estabilizacao final da trilha web de `relatorio-composto`

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
  - status: upload assinado real aberto para `fotos soltas`, com fallback local preservado; falta expandir a trilha completa de curadoria, exportacao e geracao
- `workspace-curadoria`: entregue nesta fase
  - status: stepper, selecao obrigatoria, tres modos de entrada, curadoria minima, autosave e processamento efetivo de `KMZ organizado` entregues
- `photo-library`: entregue nesta fase
  - status: listagem agregada, filtros operacionais e ZIP efemero real entregues; refinamentos de selecao parcial dedicada podem evoluir sem bloquear o restante da frente
- `project-dossier`: parcialmente entregue
  - status: CRUD, builder de escopo, preflight e fila entregues; faltam validacao em Postgres real e DOCX final
- `relatorio-composto`: parcialmente entregue
  - status: CRUD, add/reorder, preflight e fila entregues; frontend agora expoe add workspace, reorder visual, preflight e geracao; falta documento final no worker
- `worker-python`: parcialmente entregue
  - status: scaffold bootstrap + cliente de jobs + runtime manual/poll entregues; faltam handlers reais de DOCX/KMZ
- proxima macroetapa alvo: fechar `workspace-curadoria` antes de abrir processamento efetivo no worker

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

## Validacao Executada

- data da rodada: `2026-03-23` (ciclo 4)
- backend:
  - `npm test -- --runInBand`
- worker:
  - `python -m unittest discover -s worker/tests -p "test_*.py"`

## Resultado da Validacao

- backend verde em `26/26` suites e `142/142` testes
- worker Python verde em `5/5` testes
- validacao web mais recente do ciclo anterior permaneceu:
  - frontend verde em `48/48` arquivos e `261/261` testes
  - build web verde
  - warning residual de chunk grande em `dist/assets/index-BFtwlLCV.js`

## Risco Residual Atual

- o backend principal ainda opera em store Firestore e nao em Postgres
- o `postgresStore` e os repositorios alvo ja existem, mas ainda falta smoke real com banco provisionado
- ainda nao houve bootstrap real em conta Fly; os artefatos e scripts estao versionados, mas os recursos cloud continuam pendentes
- `media` ja possui backend Tigris por signed URL e queries especializadas no repositorio; falta integrar na trilha completa
- dossie e composto ainda estao em fila/metadados e nao em processamento efetivo de documento
- o dossie ja possui builder de escopo e preflight por secao, mas ainda nao foi validado em Postgres real
- o relatorio composto ja possui comandos operacionais na UI, mas ainda nao ha documento final no worker
- o ambiente atual nao expoe `psql` nem `DATABASE_URL`, entao o smoke em Postgres real depende de ambiente provisionado
- o worker Python ja consegue consumir `report-jobs` por token interno, mas os handlers ainda estao em stub e retornam falha explicita para `project_dossier`, `report_compound` e `report_legacy`
- o auto-poll do worker segue desligado por padrao (`WORKER_AUTO_POLL=false`) ate os handlers reais entrarem
- `reports.js` segue com fallback legado de leitura, agora isolado em `legacyReportRepository`
- o build segue com warning de chunk grande no bundle principal

## Riscos Conhecidos

- Postgres e Tigris ainda nao estarao ativos neste primeiro ciclo.
- Worker Python ainda nao sera integrado nesta primeira entrega.
- Algumas rotas novas seguem em modo scaffold ate a troca de backend e o processamento real dos jobs.

## Proximos Passos Imediatos

1. validar `project-dossier` em Postgres real e ajustar qualquer gap de repositorio
2. provisionar Postgres e Tigris no Fly e fazer deploy inicial em homologacao
3. portar template base e staging temporario no worker para `project_dossier` e `report_compound`
4. usar `mediaAssetRepository` na trilha completa de curadoria, exportacao e geracao
5. consolidar o corte final do `document_store` generico remanescente
