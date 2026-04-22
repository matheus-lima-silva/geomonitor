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
- Mudanca de schema → **migration nova** em `migrations/NNNN_descricao.sql`. Padrao atual vai de `0001_document_store.sql` ate `0011_photo_archive.sql`.
- Aplicar com `npm run migrate` antes de rodar testes que dependam do novo schema.
- `ALTER TABLE` ad-hoc e anti-padrao.

## 9. Storage de midia (S3/Tigris)

Nunca invocar SDK S3 diretamente da rota. Use [utils/mediaStorage.js](utils/mediaStorage.js) (signed URLs, upload/download, `MEDIA_BACKEND=local|tigris`). Valide uploads com [utils/uploadValidation.js](utils/uploadValidation.js) (tipos MIME + tamanho).

Retencao de fotos da lixeira/archive: [utils/retentionConfig.js](utils/retentionConfig.js).

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
1. Emite `console.warn(JSON.stringify({level:'warn', type:'query_count_alert', ...}))` — linha unica, parse-friendly pro Fly log drain.
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

> Ultima revisao: 2026-04-17.
