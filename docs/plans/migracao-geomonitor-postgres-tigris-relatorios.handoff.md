# Handoff Vivo - Migracao GeoMonitor + GeoRelat + Tigris

## Estado Atual

- Branch alvo: `codex/migracao-geomonitor-postgres-tigris-relatorios`
- Fase atual: `media-tigris` em progresso, com `workspace-curadoria` iniciada
- Objetivo do ciclo atual:
  - expandir a trilha real de midia para o frontend de Relatorios
  - fechar a importacao inicial de `fotos soltas`
  - preparar o terreno para importacao estruturada e curadoria completa

## Ja Existia Antes Deste Ciclo

- desacoplamento inicial de perfis do Firestore
- `GET /api/users/me`
- `POST /api/users/bootstrap`
- rotas MVP de `media`, `report-workspaces` e `reports`
- aba web inicial de `Relatorios`

## Entregas Esperadas Neste Ciclo

- configuracoes canonicas do Fly para `homologacao` e `producao`
- scaffold minimo do `geomonitor-worker` para deploy
- scripts de bootstrap e deploy via `flyctl`
- alinhamento do workflow e da documentacao operacional com a referencia nova

## Entregas Realizadas Neste Ciclo

- plano oficial salvo em `docs/plans/migracao-geomonitor-postgres-tigris-relatorios.md`
- handoff vivo e checklist salvos em `docs/plans/`
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
- UI de `Relatorios` reestruturada com abas:
  - Workspaces
  - Biblioteca do Empreendimento
  - Dossie do Empreendimento
  - Relatorios Compostos
- tooltips ligados usando o `HintText` ja existente da base
- servicos frontend abertos para:
  - `projectPhotoLibrary`
  - `projectDossier`
  - `reportCompound`
- camada `infra/schema` aberta com:
  - `backend/data/postgresStore.js`
  - `backend/migrations/0001_document_store.sql`
  - `backend/migrations/0002_reporting_scaffold.sql`
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
  - `backend/repositories/index.js`
- rotas novas reamarradas para repositarios:
  - `projectReportDefaults`
  - `projectPhotos`
  - `projectDossiers`
  - `reportCompounds`
  - `reportWorkspaces`
- `server.js` corrigido para registrar novamente:
  - `media`
  - `reports`
  - `report-workspaces`
  - `project report defaults`
  - `project photos`
  - `project dossiers`
  - `report compounds`
- `utils/hateoas.js` restaurado com:
  - `resolveApiBaseUrl`
  - `createResourceHateoasResponse`
- `users.js` restaurado com:
  - `GET /api/users/me`
  - `POST /api/users/bootstrap`
- `reportWorkspaces` deixou de usar store generico para:
  - `workspaceImports`
  - `workspaceKmzRequests`
- novos repositarios:
  - `backend/repositories/workspaceImportRepository.js`
  - `backend/repositories/workspaceKmzRequestRepository.js`
- novos repositarios base:
  - `backend/repositories/createDocumentTableRepository.js`
  - `backend/repositories/projectRepository.js`
  - `backend/repositories/operatingLicenseRepository.js`
  - `backend/repositories/inspectionRepository.js`
  - `backend/repositories/userRepository.js`
  - `backend/repositories/erosionRepository.js`
  - `backend/repositories/reportDeliveryTrackingRepository.js`
- nova migracao:
  - `backend/migrations/0003_workspace_ephemeral_requests.sql`
- nova cobertura de integracao:
  - `backend/__tests__/reportWorkspaces.test.js`
- `crudFactory` passou a aceitar `repository` e as rotas base agora usam repositórios em:
  - `projects`
  - `licenses`
  - `inspections`
  - `report-delivery-tracking`
- `users` passou a carregar e persistir perfis via `userRepository`
- `authMiddleware` agora valida perfil ativo via `loadUserProfile`
- `erosions` passou a listar, buscar, salvar e remover via `erosionRepository`
- `projectDossiers` preflight saiu do `getDataStore().listDocs(...)` e agora conta via:
  - `inspectionRepository`
  - `operatingLicenseRepository`
  - `erosionRepository`
  - `reportDeliveryTrackingRepository`
  - `reportWorkspaceRepository`
  - `reportPhotoRepository`
- `projectDossiers` preflight agora também retorna `deliveryTrackingCount`
- teste de dossiê reforçado para provar as contagens de:
  - inspeções
  - licenças
  - erosões
  - entregas
- teste unitário de `authMiddleware` refeito para o fluxo atual de perfil via repositório
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
- workflow de deploy Fly apontado para as configuracoes canonicas em `deploy/fly/producao/*.toml`
- `docs/testing/ci-cd-fly-ops.md` alinhado com a nova referencia de deploy
- `media-tigris` aberto com:
  - `backend/repositories/mediaAssetRepository.js`
  - `backend/utils/mediaStorage.js`
  - `backend/routes/media.js` ajustada para signed URLs e fallback local
- o backend de midia agora:
  - preserva `PUT /api/media/:id/upload` para modo local
  - gera presigned `PUT` em `POST /api/media/upload-url` quando `MEDIA_BACKEND=tigris`
  - gera presigned `GET` em `GET /api/media/:id/access-url` quando a media usa Tigris
  - redireciona `GET /api/media/:id/content` para URL assinada em assets Tigris
  - remove objetos via S3/Tigris ou storage local conforme `sourceKind`
- novas coberturas de midia:
  - `backend/__tests__/mediaTigris.test.js`
  - `backend/utils/__tests__/mediaStorage.test.js`
- frontend de `Relatorios` agora possui primeira trilha real de upload:
  - `src/services/mediaService.js`
  - `src/services/reportWorkspaceService.js` com import/save de fotos
  - `src/features/reports/components/ReportsView.jsx` com importacao de `fotos soltas`
- o fluxo web atual cobre:
  - criar `media_asset`
  - enviar binario por URL assinada ou fallback local
  - concluir upload
  - registrar `report_photo` no workspace
  - registrar a importacao do workspace como `loose_photos`

## Macroetapa Atual

- `infra/schema`: parcialmente entregue
  - status: base pronta para Postgres por flag e migracoes iniciais versionadas
- `repositorios-api`: parcialmente entregue
  - status: rotas novas e os dominios base principais ja usam repositórios; restam consolidar mapeamentos finos e expandir a cobertura para o restante da trilha Postgres
- `fly-bootstrap-deploy`: em progresso
  - status: configuracoes versionadas de `web`, `api` e `worker` abertas para `homologacao` e `producao`; bootstrap via `flyctl` documentado e scripts de apoio criados
- `media-tigris`: em progresso
  - status: signed URLs reais abertas para Tigris com fallback local preservado; frontend ja consome a trilha para `fotos soltas`, faltando expandir para importacao estruturada/KMZ e processamento real dos assets no restante da trilha
- proxima macroetapa alvo: aprofundar `media-tigris` no frontend e abrir a integracao efetiva com jobs/worker

## Validacao Executada

- backend:
  - `npm test -- --runInBand`
  - `npm test -- --runInBand data/__tests__/index.test.js data/__tests__/postgresStore.test.js scripts/__tests__/runMigrations.test.js`
  - `npm test -- --runInBand __tests__/projectReportDefaults.test.js __tests__/projectPhotos.test.js __tests__/projectDossiers.test.js __tests__/reportCompounds.test.js __tests__/reports.test.js __tests__/media.test.js`
- frontend:
  - `npm test -- --run`
  - `npm test -- --run src/features/reports/components/__tests__/ReportsView.test.jsx`
  - `npm run build`
- deploy/bootstrap:
  - `python - <<tomllib parse de deploy/fly/*.toml>>`
  - `python - <<py_compile worker/app.py>>`
  - `powershell parser em scripts/fly/bootstrap.ps1 e scripts/fly/deploy.ps1`
  - `powershell -File scripts/fly/bootstrap.ps1 -Environment homologacao -Org demo-org`
- media:
  - `npm test -- --runInBand __tests__/media.test.js __tests__/mediaTigris.test.js utils/__tests__/mediaStorage.test.js`
  - `npm test -- --runInBand`
- frontend:
  - `npm test -- --run src/services/__tests__/authService.test.js src/features/reports/components/__tests__/ReportsView.test.jsx`
  - `npm run build`

## Resultado da Validacao

- backend verde em `18/18` suites e `82/82` testes
- backend verde apos fechar imports/KMZ em `19/19` suites e `84/84` testes
- backend segue verde apos migrar preflight do dossie e dominios base em `19/19` suites e `84/84` testes
- frontend verde em `47/47` arquivos e `249/249` testes
- suite nova de `ReportsView` verde
- build web verde
- deploy scaffold validado com parse de TOML para `deploy/fly/...` e compilacao do worker Python
- backend segue verde apos `media-tigris` em `21/21` suites e `87/87` testes
- frontend segue verde apos plugar upload basico de `fotos soltas` no modulo de Relatorios
- build web voltou a ficar verde

## Risco Residual Atual

- o backend ainda esta em store Firestore e nao em Postgres
- o `postgresStore` existe com repositórios para relatorios e dominios base principais, mas ainda faltam expansoes e cortes finais do store generico remanescente
- ainda nao houve bootstrap real em conta Fly; os artefatos e scripts estao versionados, mas os recursos cloud ainda dependem da execucao do playbook
- `media` ja possui backend Tigris por signed URL e o frontend consome a trilha basica de `fotos soltas`, mas ainda faltam `subpastas por torre`, `KMZ organizado` e curadoria completa por slot/torre
- worker Python ainda nao foi integrado
- exportacao de fotos, KMZ e geracao de dossie/composto ainda estao em scaffold de fila/metadata, nao em processamento real
- o build segue com warning de chunk grande no bundle principal

## Riscos Conhecidos

- Postgres e Tigris ainda nao estarao ativos neste primeiro ciclo.
- Worker Python ainda nao sera integrado nesta primeira entrega.
- Algumas rotas novas podem nascer em modo scaffold ate a troca de backend.

## Proximos Passos Imediatos

1. expandir o frontend de importacao para `subpastas por torre` e `KMZ organizado`
2. aprofundar curadoria real do workspace: fotos, ordenacao, legenda, torre e autosave
3. ligar a fila de jobs do worker a processamento efetivo de relatorios
4. abrir area de administracao de templates e fila real de jobs
5. consolidar o corte final do store generico remanescente
