# Backend — convencoes (HATEOAS + Postgres + S3)

Regras obrigatorias para toda mudanca em `backend/`. **Fonte canonica de contrato**: [../docs/api-backend.md](../docs/api-backend.md) — tabela por router com metodo, rota, permissao esperada e descricao. Consultar antes de criar/alterar rota e **atualizar no mesmo PR**.

Stack: Node 18 + Express 5 · PostgreSQL (via `pg`) · S3/Tigris · JWT proprio · Zod · Jest+supertest. **Nao e mais Firebase** — a migracao foi concluida.

## 1. HATEOAS em toda resposta

Nunca retornar `res.json(data)` solto. Toda rota devolve envelope com `_links`:

- Item individual: `createHateoasResponse(req, data, entityType, id)` — `utils/hateoas.js:38`.
- Colecao paginada: `createPaginatedHateoasResponse(req, items, { entityType, page, limit, total })` — `utils/hateoas.js:106`.
- Recurso aninhado / nao-CRUD: `createResourceHateoasResponse(req, data, resourcePath, { allowUpdate, allowDelete, extraLinks })` — `utils/hateoas.js:131`.
- Singleton (sem `id`): `createSingletonHateoasResponse(req, data, resourcePath)` — `utils/hateoas.js:46`.

## 2. Nunca hardcodar URLs

Links saem sempre de `generateHateoasLinks(req, entityType, id)` (respeita `API_BASE_URL` e evita Host Header Injection). Proibido string literal tipo `/api/projects/123` em qualquer lugar.

## 3. CRUD simples → `createCrudRouter`

Para CRUD padrao use `createCrudRouter(collectionName, { repository, createSchema, updateSchema, ... })` — `utils/crudFactory.js:7`. Exemplo: [routes/projects.js](routes/projects.js).

So escreva handlers manuais quando houver logica customizada alem de CRUD. Exemplo de extensao mantendo HATEOAS: [routes/erosions.js](routes/erosions.js).

## 4. Validacao sempre com Zod

Middleware `validateBody(schema)` de [middleware/validate.js](middleware/validate.js). Schemas em `schemas/*.js`. Envelope padrao do body: `{ data: { ... }, meta?: { updatedBy } }`. Exemplos: [schemas/projectSchemas.js](schemas/projectSchemas.js), [schemas/authSchemas.js](schemas/authSchemas.js).

## 5. Guards de autenticacao/RBAC

Em [utils/authMiddleware.js](utils/authMiddleware.js):

- `verifyToken` — valida JWT e popula `req.user = { uid, email }`.
- `requireActiveUser` — user autenticado com `status = 'Ativo'` (cache 5 min).
- `requireEditor` — perfil em `{Admin, Administrador, Editor, Gerente}`.
- `requireAdmin` — perfil em `{Admin, Administrador}`.
- `requireActiveUserOrWorker` / `requireEditorOrWorker` — aceitam JWT **ou** header `x-worker-token` (usar em rotas que o worker Python chama).

Passe via options do `createCrudRouter` (`listGuards`, `createGuards`, `updateGuards`, `deleteGuards`) ou aplique direto na rota.

## 6. Acesso por workspace

Rotas de `report-workspaces` **sempre** usam `requireWorkspaceRead` ou `requireWorkspaceWrite` de [utils/workspaceAccess.js](utils/workspaceAccess.js) depois de `verifyToken`. Checam membership (papeis `owner`/`editor`/`viewer`) ou superuser global. Ver pipeline completo em [../docs/modulo-reports.md](../docs/modulo-reports.md).

## 7. Autenticacao JWT propria

Geracao/verificacao em [utils/jwt.js](utils/jwt.js); credenciais em `auth_credentials` (bcrypt, rounds 12). Rate limit especifico para `/api/auth/login|register|reset-password|refresh`: 10 tentativas / 15 min.

**Nao reintroduzir** `firebase-admin` ou `firebase-auth` — a migracao para Postgres+JWT ja foi feita e reverte-la esta fora de escopo.

## 8. Persistencia: Postgres + repositories

- Todas as queries vao por repositories em `repositories/*.js` — **nunca** SQL cru dentro de uma rota.
- Mudanca de schema → **migration nova** em `migrations/NNNN_descricao.sql`. Padrao atual vai de `0001_document_store.sql` ate `0024_project_geometries.sql`.
- **PostGIS** (a partir da `0023`): a imagem do Postgres e `postgis/postgis:16-3.4` (homelab, PBT, backup). `erosions.geom` e `report_photos.geom` sao colunas `geography(Point,4326)` GERADAS (STORED) — erosions deriva do `payload` (Opcao A: COALESCE locationCoordinates/flat, com guarda regex no cast), report_photos das colunas `gps_lat/gps_lon`. Indices GIST. geography => distancias em METROS. NAO inserir em coluna gerada. `project_geometries` (`0024`) materializa eixo da LT (LineString) e torres (MultiPoint) do `projects.payload`; reconstruida no save via wrap em `projectRepository.save` -> `projectGeometryRepository.upsertFromProject` (falha nao quebra o save). FK CASCADE (projecao derivada). `utils/geoDistance.js` calcula distancia ponto->eixo/torre e flags via uma query PostGIS contra `project_geometries` (metros). Auto-distancia: `reportPhotoRepository.save` popula `distance_to_*`/`inside_*` salvo `manual_override`; o save de erosao ([routes/erosions.js](routes/erosions.js)) alimenta a criticidade V3 com a distancia a torre mais proxima de forma **hibrida** (`resolveEffectiveStructureDistance`: override manual -> calculada -> digitada), so daqui pra frente. A engine `utils/criticality.js` NAO muda — so a fonte do valor de entrada.
- FKs reais existem a partir da `0019/0020/0021` (antes eram "virtuais", validadas so em codigo); a auditoria pre-FK de orfaos esta em `0018_fk_orphan_audit.sql`. Politica: filhos de dados de `projects` (workspaces, fotos, erosoes, dossiers) -> `RESTRICT`; config/efemeros owned (project_report_defaults, project_photo_exports) e subordinados (fotos de workspace, condicoes de licenca, archives de compound, kmz_requests, imports) -> `CASCADE`; referencias fracas (report_jobs.*, report_photos.media_asset_id, *.template_id) -> `SET NULL`. Deletar pai com filhos RESTRICT falha — limpe os filhos antes (as rotas de delete ja cuidam do S3). Orfaos NAO sao apagados por migracao: o `VALIDATE CONSTRAINT` falha alto se houver, force a limpeza via `0018` antes.
- Aplicar com `npm run migrate` antes de rodar testes que dependam do novo schema.
- `ALTER TABLE` ad-hoc e anti-padrao.
- O pool aplica `statement_timeout` (default 15000ms, configuravel via `POSTGRES_STATEMENT_TIMEOUT_MS`; `0` desliga) para nao segurar conexao em query presa. O runner de migracoes desliga isso por transacao (`SET LOCAL statement_timeout = 0`) para nao estourar backfills/CREATE INDEX longos.

## 9. Storage de midia (S3/Tigris/MinIO)

Nunca invocar SDK S3 diretamente da rota. Use [utils/mediaStorage.js](utils/mediaStorage.js) (signed URLs, upload/download, `MEDIA_BACKEND=local|tigris`). Valide uploads com [utils/uploadValidation.js](utils/uploadValidation.js) (tipos MIME + tamanho).

`createSignedAccessUrl({ storageKey, downloadFileName })`: passe `downloadFileName` quando a URL for para **download** direto (browser navega ate ela em vez de baixar via blob). Isso embute `ResponseContentDisposition: attachment; filename="..."` na URL assinada, preservando o nome amigavel mesmo indo direto ao MinIO. A rota `/api/media/:id/access-url` ja passa `asset.fileName`. Necessario para arquivos grandes (ex.: KMZ full-res de centenas de MB) que nao cabem em memoria como blob — ver fluxo de download em [../docs/modulo-reports.md](../docs/modulo-reports.md).

Retencao de fotos da lixeira/archive: [utils/retentionConfig.js](utils/retentionConfig.js).

### 9a. Endpoint interno vs publico (MinIO/Tailscale)

No homelab o backend (Node) e o worker (Python) falam com o MinIO pelo hostname interno do docker network (`http://minio:9000`), mas o browser do usuario so alcanca o bucket pelo endpoint publico via Tailscale (`https://geo.lima.rio.br/<BUCKET_NAME>/...`, roteado pelo Caddy). Para resolver esse split:

- `AWS_ENDPOINT_URL_S3` aponta para o endpoint **interno** (o SDK usa esse pra assinar e pra PUT/GET diretos do server).
- `MEDIA_PUBLIC_ENDPOINT` aponta para o endpoint **publico** (Tailscale). Quando setado, [utils/mediaStorage.js:132](utils/mediaStorage.js) (`rewriteSignedUrlHost`) reescreve a URL assinada trocando protocol+host+port+pathPrefix antes de devolver pro client.
- Sem `MEDIA_PUBLIC_ENDPOINT`, a URL volta crua (cenario Tigris/Fly antigo, onde endpoint ja era publico).

**Flag `internal: true`** em `createSignedUploadUrl({ internal })` / `createSignedAccessUrl({ internal })`: pula o rewrite. Use **somente** quando o consumidor da URL roda dentro do docker network — tipicamente o worker Python que faz PUT do DOCX direto no bucket via webhook. Se passar `internal:true` em URL que vai pro browser, o usuario recebe `http://minio:9000/...` que so resolve dentro da rede docker. Se omitir em URL do worker, ele tenta resolver o hostname Tailscale/MagicDNS de dentro do container e quebra com `gaierror`.

Regra pratica: rotas que devolvem URL pro frontend → omitir flag (default `false`). Rotas chamadas pelo worker (`requireEditorOrWorker` + `x-worker-token`) → passar `internal: true` quando o destinatario for o worker.

## 10. Async handlers + formato de resposta

Envolva toda rota com `asyncHandler(fn)` de [utils/asyncHandler.js](utils/asyncHandler.js) para propagar erros ao handler central em `server.js`. Nao use `try/catch` com `res.status(500).send(err.message)`.

Formato (ver [../docs/api-backend.md](../docs/api-backend.md)):
- Sucesso: `{ status: 'success', data, pagination?, _links? }`.
- Erro: `{ status: 'error', message, code? }`.

## 11. Metadados do registro

Todo save inclui `updatedAt` (ISO) e `updatedBy` (de `req.user?.email` ou `meta.updatedBy`). O `createCrudRouter` ja faz isso — **replique em rotas manuais**.

## 12. Jobs do worker Python

Triggers vao por [utils/workerTrigger.js](utils/workerTrigger.js) (webhook → worker). Contexto compartilhado em [utils/reportJobContext.js](utils/reportJobContext.js). Nunca invocar subprocess Python direto da rota Express.

## 12b. Observabilidade: contador de queries por request

Todo request passa pelo middleware [middleware/queryCounter.js](middleware/queryCounter.js), que usa `AsyncLocalStorage` ([utils/queryCounter.js](utils/queryCounter.js)) pra contar quantas queries Postgres a rota produziu. A instrumentacao mora em [data/postgresStore.js](data/postgresStore.js), patchando `pool.query` e `pool.connect` — cobre todos os repositories e o `adminSqlExecutor` (transacao).

Quando a contagem passa de `QUERY_COUNT_ALERT_THRESHOLD` (default 15), o middleware:
1. Emite `console.warn(JSON.stringify({level:'warn', type:'query_count_alert', ...}))` — linha unica, parse-friendly pra centralizacao de logs (`docker compose logs api` hoje).
2. Persiste o alerta em `system_alerts` via [repositories/systemAlertsRepository.js](repositories/systemAlertsRepository.js). Falha no insert nao quebra a response (fica so em `console.error`).

O painel "Alertas do sistema" (aba Estatisticas do admin) consome `/api/admin/alerts` pra listar e marcar como revisado.

Nao tente incrementar o contador manualmente — o patch do pool cuida de tudo. Nao ha header de resposta exposto (evita leak em prod). Pra desligar temporariamente em prod, suba `QUERY_COUNT_ALERT_THRESHOLD` pra um numero alto; pra debug local, `DEBUG_QUERY_COUNT=1` loga contagem em toda request.

## 13. Testes sao obrigatorios

Jest + supertest. Toda rota nova, alteracao de rota ou novo util precisa de teste.

- Unit tests de utils: `__tests__/*.test.js` (ex.: `criticality.test.js`, `kmlParser.test.js`).
- Integration tests de rotas: `__tests__/integration/*.test.js`. Exemplos de template:
  - HATEOAS: [__tests__/integration/hateoasPagination.test.js](__tests__/integration/hateoasPagination.test.js)
  - CRUD factory: [__tests__/integration/crudFactoryStatus.test.js](__tests__/integration/crudFactoryStatus.test.js)
  - Guards: [__tests__/integration/routesProtected.test.js](__tests__/integration/routesProtected.test.js)
  - Error handler: [__tests__/integration/errorHandler.test.js](__tests__/integration/errorHandler.test.js)
  - Archives / S3: [__tests__/integration/reportPhotosArchive.test.js](__tests__/integration/reportPhotosArchive.test.js)
- Helper de auth em integracao: [__tests__/helpers/testAuth.js](__tests__/helpers/testAuth.js).
- Ao criar rota, **asserte o envelope**: `expect(res.body).toHaveProperty('_links.self.href')`, `status: 'success'`, etc.
- Ao mudar guard, acrescentar caso em `routesProtected.test.js`.

Comando: `cd backend && npm test`. Deve passar antes de considerar a tarefa concluida.

## 13b. Testes property-based de race conditions (opt-in)

Suite separada para caçar race conditions em fluxos check-then-act. Usa [`fast-check`](https://fast-check.dev/) com `fc.asyncProperty` + `Promise.allSettled` contra Postgres real para reproduzir intercalacoes nao-deterministicas.

> A race do "ultimo owner" (antes `countOwners()` + `removeMember()` fora de transacao) ja foi **corrigida**: a remocao passa por `workspaceMemberRepository.removeMemberGuardingLastOwner` (transacao com `SELECT ... FOR UPDATE`). O PBT abaixo agora passa de forma estavel e ha cobertura deterministica em [__tests__/workspaceMemberRepository.test.js](__tests__/workspaceMemberRepository.test.js).

- **Opt-in por env**: sem `PBT_POSTGRES_URL` (ou `DATABASE_URL`) setada, os `describe` viram `describe.skip` — `npm test` padrao segue intacto.
- **Sufixo de arquivo**: `*.pbt.test.js`. Config dedicada: [jest.pbt.config.js](jest.pbt.config.js) + setup [jest.pbt.setup.js](jest.pbt.setup.js) + [jest.pbt.globalSetup.js](jest.pbt.globalSetup.js) (aplica migracoes).
- **Helpers**: [__tests__/helpers/pbtDb.js](__tests__/helpers/pbtDb.js), [pbtArbitraries.js](__tests__/helpers/pbtArbitraries.js), [concurrencyRunner.js](__tests__/helpers/concurrencyRunner.js), [workspaceFactory.js](__tests__/helpers/workspaceFactory.js), [fcDefaults.js](__tests__/helpers/fcDefaults.js).
- **Template**: [__tests__/integration/workspaceOwners.race.pbt.test.js](__tests__/integration/workspaceOwners.race.pbt.test.js) — invariante "workspace nunca fica sem owner"; passa apos o fix (`SELECT ... FOR UPDATE` + transacao). Use como modelo (os alvos ja corrigidos abaixo seguem o mesmo padrao).

Rodar:
```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=geomonitor_test postgis/postgis:16-3.4
export PBT_POSTGRES_URL=postgres://postgres:test@localhost:5432/geomonitor_test
export POSTGRES_SSL=disable
cd backend && npm run test:pbt
```

> Use a imagem `postgis/postgis:16-3.4` (nao `postgres:16-alpine`): a migracao `0023` faz `CREATE EXTENSION postgis` e cria colunas `geography`, que falham em Postgres sem PostGIS.

Alvos ja **corrigidos** (cada um com seu `*.race.pbt.test.js` + cobertura deterministica no gate):
1. **Numeracao de versao de archives** — `reportArchiveRepository.createNextVersion` (transacao + `pg_advisory_xact_lock(hashtext(compound_id))` antes de `MAX(version)+1`, serializa entregas concorrentes). PBT: [__tests__/integration/reportArchiveVersion.race.pbt.test.js](__tests__/integration/reportArchiveVersion.race.pbt.test.js); unit: [__tests__/reportArchiveRepository.test.js](__tests__/reportArchiveRepository.test.js).
2. **Trash <-> archive de fotos** — `softDelete` guardado por `archived_at IS NULL` e `restore` por `deleted_at IS NOT NULL` (cada UPDATE single-statement e atomico por linha; nunca `deleted_at` e `archived_at` ambos set). PBT: [__tests__/integration/reportPhotoState.race.pbt.test.js](__tests__/integration/reportPhotoState.race.pbt.test.js); unit: [__tests__/reportPhotoRepository.test.js](__tests__/reportPhotoRepository.test.js).
Helpers de seed para esses alvos em [__tests__/helpers/workspaceFactory.js](__tests__/helpers/workspaceFactory.js) (`seedCompound`, `seedPhoto`) e arbitraries em [__tests__/helpers/pbtArbitraries.js](__tests__/helpers/pbtArbitraries.js) (`concurrentCountArb`, `photoStateArb`, `photoTransitionsArb`). Para um novo alvo, replique o padrao: fix com lock/guard atomico + `*.race.pbt.test.js` (invariante que falha antes do fix) + unit deterministico no gate.

Proximo alvo mapeado (com race concreta):
3. **Rotacao de refresh token JWT** — `routes/auth.js:162-190` (sem invalidacao do token anterior).

CI nao roda `test:pbt` por enquanto — sera adicionado em follow-up quando a suite virar gate.

## 14. Checklist ao criar rota nova

- [ ] Registra a rota em `server.js`
- [ ] Documentada em `../docs/api-backend.md` (tabela da secao correspondente)
- [ ] Usa `createCrudRouter` OU `asyncHandler` + `generateHateoasLinks`
- [ ] Schema Zod + `validateBody`
- [ ] Guards apropriados (workspace guards se for sobre workspace; `OrWorker` se worker chama)
- [ ] Se toca midia → usa `mediaStorage.js` + `uploadValidation.js`
- [ ] Se muda schema → migration nova em `migrations/`
- [ ] Retorna envelope `{ status: 'success', data, _links }` ou paginado
- [ ] **Teste novo** em `__tests__/` (integration se for rota, unit se for util)
- [ ] `cd backend && npm test` passando

## 15. Anti-padroes

- Retornar `res.json(data)` sem `_links`.
- Strings literais tipo `/api/projects/123`.
- Handlers manuais para CRUD trivial quando `createCrudRouter` serve.
- `res.status(500).send(err.message)` — deixe o error handler central cuidar.
- SQL cru na rota (deveria estar num repository).
- Reintroduzir `firebase-admin` ou `firebase-auth` — migracao ja foi feita.
- `new S3Client(...)` na rota — use `mediaStorage.js`.
- `ALTER TABLE` ad-hoc — sempre migration versionada.
- Rota de workspace sem `requireWorkspaceRead`/`requireWorkspaceWrite`.
- Criar rota e esquecer de atualizar `../docs/api-backend.md`.

## 16. Manutencao deste documento

Ao introduzir novo util em `utils/`, novo middleware, nova convencao ou mudar contrato de envelope, **atualizar este arquivo no mesmo PR** e bumpar a data do rodape. Revisar integralmente a cada trimestre (audit comparando com estado do codigo). Ver secao "Manutencao dos documentos" do plano arquitetural em `.claude/plans/jazzy-tinkering-cocke.md`.

> Ultima revisao: 2026-06-23.
