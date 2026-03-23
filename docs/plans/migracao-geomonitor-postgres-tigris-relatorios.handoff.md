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
- `workspace-curadoria`: em progresso
  - status: stepper, selecao obrigatoria, tres modos de entrada no frontend, curadoria minima e autosave entregues; falta processamento efetivo de `KMZ organizado`
- `photo-library`: entregue nesta fase
  - status: listagem agregada, filtros operacionais e ZIP efemero real entregues; refinamentos de selecao parcial dedicada podem evoluir sem bloquear o restante da frente
- `project-dossier`: parcialmente entregue
  - status: CRUD, builder de escopo, preflight e fila entregues; faltam validacao em Postgres real e DOCX final
- `relatorio-composto`: parcialmente entregue
  - status: CRUD, add/reorder, preflight e fila entregues; frontend agora expoe add workspace, reorder visual, preflight e geracao; falta documento final no worker
- `worker-python`: parcialmente entregue
  - status: apenas scaffold bootstrap aberto; sem processamento real de jobs
- proxima macroetapa alvo: fechar `workspace-curadoria` antes de abrir processamento efetivo no worker

## Validacao Executada

- data da rodada: `2026-03-22`
- backend:
  - `npm test -- --runInBand`
- frontend:
  - `npm test`
  - `npm run build`

## Resultado da Validacao

- backend verde em `21/21` suites e `90/90` testes
- frontend verde em `47/47` arquivos e `254/254` testes
- build web verde
- warning residual de chunk grande em `dist/assets/index-DriIH0Q6.js`

## Risco Residual Atual

- o backend principal ainda opera em store Firestore e nao em Postgres
- o `postgresStore` e os repositorios alvo ja existem, mas ainda falta smoke real com banco provisionado
- ainda nao houve bootstrap real em conta Fly; os artefatos e scripts estao versionados, mas os recursos cloud continuam pendentes
- `media` ja possui backend Tigris por signed URL e o frontend cobre os tres modos de entrada, mas `KMZ organizado` ainda fica em registro/metadata e nao em processamento efetivo
- dossie e composto ainda estao em fila/metadados e nao em processamento efetivo de documento
- o dossie ja possui builder de escopo e preflight por secao, mas ainda nao foi validado em Postgres real
- o relatorio composto ja possui comandos operacionais na UI, reorder visual dedicado e smoke funcional na web, mas ainda nao ha documento final no worker
- o ambiente atual nao expoe `psql` nem `DATABASE_URL`, entao o smoke em Postgres real depende de ambiente provisionado
- worker Python ainda nao foi integrado ao consumo real de jobs
- o build segue com warning de chunk grande no bundle principal

## Riscos Conhecidos

- Postgres e Tigris ainda nao estarao ativos neste primeiro ciclo.
- Worker Python ainda nao sera integrado nesta primeira entrega.
- Algumas rotas novas seguem em modo scaffold ate a troca de backend e o processamento real dos jobs.

## Proximos Passos Imediatos

1. transformar `KMZ organizado` de registro em processamento efetivo de importacao
2. validar `project-dossier` em Postgres real e ajustar qualquer gap de repositorio
3. abrir area de administracao de templates e fila real de jobs
4. consolidar o corte final do store generico remanescente e validar smoke em Postgres real
5. expandir `mediaAssetRepository` para a trilha completa de curadoria, exportacao e geracao
