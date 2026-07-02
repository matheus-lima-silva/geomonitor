# API Backend (GeoMonitor)

Documentacao dos endpoints expostos pelo servidor Express em `backend/server.js`. O backend usa **PostgreSQL** como datastore (via `pg` + migracoes versionadas em [backend/migrations/](../backend/migrations)) e **S3/Tigris** para midia.

## Base URL

- Local: `http://localhost:8080`
- Prefixo da API: `/api`

## Autenticacao e Controle de Acesso

Autenticacao propria baseada em JWT. O ciclo padrao:

1. Cliente chama `POST /api/auth/login` com email/senha e recebe um par `access` + `refresh`.
2. Requisicoes subsequentes enviam o access token no header:

```http
Authorization: Bearer <access-token>
```

3. Quando o access expira, o cliente usa `POST /api/auth/refresh` para obter um novo par sem pedir credenciais.

Senhas sao armazenadas em `auth_credentials` (bcrypt, salt rounds 12). Tokens de reset de senha expiram em 1 hora.

**Rotacao single-use do refresh token (reuse detection).** O refresh token carrega um `jti` (e `fam` de familia) e tem estado server-side em `refresh_tokens` (migration `0025`, `backend/repositories/refreshTokenRepository.js`). Cada `POST /api/auth/refresh` **consome** o token apresentado e emite um sucessor na mesma familia (`rotate`, atomico via `SELECT ... FOR UPDATE` por `jti`). Reusar um token ja consumido revoga a **familia inteira** e retorna `401 INVALID_REFRESH_TOKEN` (limpa os cookies) — defesa contra roubo de refresh token. Ha uma **janela de graca** (~10s) para reuse concorrente legitimo (multi-aba, cookie `gm_refresh` compartilhado): nesse intervalo o mesmo sucessor e devolvido em vez de revogar a familia. Tokens **legados** (emitidos antes da migration, sem `jti`) sao aceitos uma vez e migrados para uma familia nova — sem re-login em massa no deploy. `POST /api/auth/logout` revoga a familia do token apresentado.

### SSO entre subdominios (cookies)

Para compartilhar a sessao entre `geo.*` e `relat.*`, `login` e `refresh` tambem setam dois cookies (`backend/utils/authCookies.js`):

- `gm_refresh` — httpOnly, `Path=/api/auth`, `Domain` de `AUTH_COOKIE_DOMAIN` (ex.: `.lima.rio.br`), `SameSite=Lax`, `Secure` em prod. Carrega o refresh token.
- `gm_session` — nao-httpOnly, `Path=/`, mesmo `Domain`. Apenas um flag para o frontend saber que ha sessao e tentar `refresh` no load (o httpOnly nao e legivel por JS).

`POST /api/auth/refresh` le o refresh token **do cookie `gm_refresh` com prioridade**, caindo para `body.refreshToken` (fluxo localStorage / fallback dev). `POST /api/auth/logout` limpa ambos os cookies. O fluxo localStorage do frontend e mantido como fallback (dev cross-port), entao o cookie e **aditivo**.

### Middlewares de autorizacao (`backend/utils/authMiddleware.js`)

| Middleware | Descricao |
|---|---|
| `verifyToken` | Valida o JWT e popula `req.user = { uid, email }` |
| `requireActiveUser` | Usuario autenticado com `status = 'Ativo'` (cache em memoria, 5 min) |
| `requireEditor` | Perfil global em `{Admin, Administrador, Editor, Gerente}` |
| `requireAdmin` | Perfil global em `{Admin, Administrador}` |
| `requireActiveUserOrWorker` | Aceita JWT de usuario OU header `x-worker-token` (jobs internos) |
| `requireEditorOrWorker` | Combinacao de `requireEditor` + worker token |

### Middlewares de acesso por workspace (`backend/utils/workspaceAccess.js`)

| Middleware | Descricao |
|---|---|
| `requireWorkspaceRead` | Membro do workspace com papel `owner`/`editor`/`viewer`, OU superuser global (Admin/Gerente) |
| `requireWorkspaceWrite` | Membro com papel `owner`/`editor`, OU superuser global |

### Rate limit

Limite global: **600 requisicoes / 15 min** por IP. Endpoints sensiveis (`/api/auth/login`, `/register`, `/reset-password`, `/refresh`) tem limite especifico de **10 tentativas / 15 min**. Uploads em lote (`/api/media*` e `/api/report-workspaces/*/photos`) ignoram o limite global para suportar importacoes grandes de KMZ.

`GET /health` nao exige autenticacao.

## Formato de resposta

Sucesso (padrao HATEOAS):

```json
{
  "status": "success",
  "data": {
    "id": "...",
    "_links": {
      "self": { "href": "...", "method": "GET" },
      "update": { "href": "...", "method": "PUT" },
      "delete": { "href": "...", "method": "DELETE" },
      "collection": { "href": "...", "method": "GET" }
    }
  }
}
```

Erro:

```json
{
  "status": "error",
  "message": "Descricao do erro"
}
```

---

## Health

### GET /health

Verifica disponibilidade do servico. Sem autenticacao.

Resposta `200`:

```json
{ "status": "ok", "service": "geomonitor-api" }
```

---

## Auth (`/api/auth`)

Endpoints de autenticacao e gestao de credenciais. Body validado por Zod (`backend/schemas/authSchemas.js`).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| POST | `/api/auth/register` | publico | Cria conta nova (gera UUID, hash bcrypt) |
| POST | `/api/auth/login` | publico | Autentica, retorna `{ accessToken, refreshToken, user }` e seta cookies `gm_refresh` + `gm_session` |
| POST | `/api/auth/refresh` | publico | Renova o par a partir do cookie `gm_refresh` ou `body.refreshToken`; **rotaciona single-use** (consome o token, emite sucessor); reuse => `401` + revoga a familia |
| POST | `/api/auth/logout` | publico | Limpa os cookies de sessao (`gm_refresh`, `gm_session`) e **revoga a familia** do refresh token apresentado |
| POST | `/api/auth/reset-password` | publico | Solicita token de reset (sempre retorna 200 para evitar enumeracao) |
| POST | `/api/auth/reset-password/confirm` | publico | Confirma reset com token valido |

---

## Relatorios Mensais (`/api/monthly-reports`)

Modulo do portal relat.lima.rio.br (Relatorio Mensal de Acompanhamento dos Servicos). Modelo relacional: `monthly_reports` (header + `version` + `status` + textos `intro`/`conclusao` + `quadro_style`) + `monthly_report_engineers` + `monthly_report_projects` + `monthly_report_activities` — projetos e atividades pertencem a um engenheiro (migration `0016`). Pessoal por dono (`owner_user_id = req.user.uid`); unico por `(owner, ano, mes)`. Save **full-sync transacional** com concorrencia otimista. Body validado por `backend/schemas/monthlyReportSchemas.js` (envelope `{ data, meta }`).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/monthly-reports` | `requireActiveUser` | Lista resumida (sem filhos) dos relatorios do dono |
| GET | `/api/monthly-reports/by-period?year=&month=` | `requireActiveUser` | Garante (cria vazio se faltar) o relatorio do mes |
| GET | `/api/monthly-reports/:id` | `requireActiveUser` | Relatorio completo (header + engenheiros com atividades e projetos) |
| POST | `/api/monthly-reports` | `requireActiveUser` | Cria a partir de dados completos; 409 `PERIOD_EXISTS` se o mes ja existe |
| PUT | `/api/monthly-reports/:id` | `requireActiveUser` | Full-sync transacional; 409 `VERSION_CONFLICT` (com `currentVersion`) se `data.version` divergir |
| POST | `/api/monthly-reports/:id/generate` | `requireActiveUser` | Enfileira `report_job` (`kind=monthly_report`, `monthlyReportId`+`ownerUserId` no payload) e dispara o worker; 202 com link `self` para `GET /report-jobs/:id` |
| DELETE | `/api/monthly-reports/:id` | `requireActiveUser` | Remove o relatorio (cascata nos filhos) |

`data`: `{ refYear, refMonth, authorName, status('draft'|'final'), version?, intro, conclusao, quadroStyle('preenchido'|'marcador'|'barra'), holidays[{date,name}], engineers[{ id?, name, sortOrder?, activities[{id?, category, description, startDate, endDate}], projects[{id?, name, description, sortOrder?}] }] }`. `category` e enum (`vistoria|doc|relatorio|geo|reuniao|outro`). Feriados sao **lista explicita** controlada pelo usuario (o auto-preenchimento BR/RJ e acao do cliente). Ids `MRE-/MRP-/MRA-` enviados pelo cliente sao preservados no full-sync. O DOCX e renderizado pelo worker Python (`worker/monthly_report_renderer.py`, `kind=monthly_report`); o contexto cru vem de `GET /report-jobs/:id/context` (`buildMonthlyReportContext`).

## Config do Relatorio Mensal (`/api/monthly-report-settings`)

Singleton por usuario (tabela `monthly_report_settings`, payload JSONB): cadastro de equipe e dados do contrato — valem para todos os meses; o frontend usa para semear novos periodos e o texto-modelo da introducao. Body validado por `backend/schemas/monthlyReportSettingsSchemas.js`.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/monthly-report-settings` | `requireActiveUser` | Settings do usuario (default vazio se nunca salvas) |
| PUT | `/api/monthly-report-settings` | `requireActiveUser` | Upsert; `data: { team[{id?,name}], contrato{numero,objeto,contratante,contratada} }` |

## PAEC (`/api/paec`)

Modulo do portal relat.lima.rio.br (Plano de Atendimento as Emergencias da Central). Ficha "titulo chave -> texto valor" por usina, **unica e compartilhada entre editores** (nao user-owned). Modelo relacional (migration `0026`, `0027`): `paec_templates` (revisoes do modelo canonico tokenizado — docx `{{placeholders}}` no storage de midia + `manifest` JSONB gerado por `worker/tools/paec_tokenizer.py`; no maximo 1 `active` por `name`) + `paec_plants` (header por usina com `version` para concorrencia otimista, mais `plant_type`/`installed_capacity_mw` — identidade basica da usina, fora do manifest tokenizado, nao entra no DOCX) + `paec_plant_fields` (uma linha por campo preenchido, auditavel). Body validado por `backend/schemas/paecSchemas.js` (envelope `{ data, meta }`). Pendencias computadas server-side por `backend/utils/paecPendencies.js` (fonte unica: rota de detalhe, contexto do worker e `resultMeta` do job).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/paec/templates` | `requireActiveUser` | Lista resumida das revisoes (sem manifest) |
| GET | `/api/paec/templates/:id` | `requireActiveUser` | Revisao com manifest (o frontend monta a ficha a partir dele) |
| POST | `/api/paec/templates` | `requireAdminOrWorker` | Registra revisao (draft); 409 `REVISION_EXISTS`. Usado por `backend/scripts/registerPaecTemplate.js` com `x-worker-token` |
| POST | `/api/paec/templates/:id/activate` | `requireAdminOrWorker` | Ativa a revisao (a ativa anterior do mesmo `name` vira `retired`, transacional) |
| GET | `/api/paec/plants` | `requireActiveUser` | Lista de usinas com `completeness` (campos preenchidos x total do manifest) |
| POST | `/api/paec/plants` | `requireEditor` | Cria ficha vinculada ao template ativo; `copyFromId?` copia campos de outra usina; 409 `NAME_EXISTS`; 422 `NO_ACTIVE_TEMPLATE` |
| GET | `/api/paec/plants/:id` | `requireActiveUser` | Ficha completa (`fields{chave:valor}`) + `pendencies[]` + `stats` |
| PUT | `/api/paec/plants/:id` | `requireEditor` | Full-sync transacional; 409 `VERSION_CONFLICT` (com `currentVersion`) se `data.version` divergir |
| DELETE | `/api/paec/plants/:id` | `requireAdmin` | Remove a ficha (CASCADE nos campos) |
| POST | `/api/paec/plants/:id/generate` | `requireEditor` | Enfileira `report_job` (`kind=paec_report`; `paecPlantId`+`paecTemplateId` no payload — `template_id` da tabela tem FK para `report_templates` e nao e usado); 422 `TEMPLATE_UNAVAILABLE` sem docx tokenizado; 202 com link para `GET /report-jobs/:id` |

`data` do plant: `{ name, projectId?, plantType?, installedCapacityMw?, version?, copyFromId?, fields{ <chave do manifest>: <valor> } }`. `plantType` in `UHE|PCH|CGH|Subestacao`. O DOCX e renderizado pelo worker (`worker/paec_renderer.py`, `kind=paec_report`): baixa o template tokenizado, substitui `{{chave}}`/`{{chave|upper|title}}`, campo sem valor vira `[[PENDENTE: <label>]]` com realce amarelo, e devolve `resultMeta{pendencies,stats}` no `PUT /report-jobs/:id/complete` (persistido no payload do job; exposto no `GET /report-jobs/:id`). Contexto: `buildPaecContext` em `backend/utils/reportJobContext.js`.

---

## Projects (`/api/projects`)

Tabela Postgres: `projects` (payload JSONB).

Gerado via `crudFactory` com CRUD padrao.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/projects` | `requireActiveUser` | Lista projetos |
| GET | `/api/projects/:id` | `requireActiveUser` | Busca projeto por ID |
| POST | `/api/projects` | `requireEditor` | Cria/atualiza projeto |
| PUT | `/api/projects/:id` | `requireEditor` | Atualiza projeto (ID via URL) |
| DELETE | `/api/projects/:id` | `requireAdmin` | Remove projeto |

Body (POST/PUT):

```json
{
  "data": {
    "id": "PRJ-001",
    "nome": "Empreendimento A"
  },
  "meta": {
    "updatedBy": "user@empresa.com"
  }
}
```

- `data.id` obrigatorio (normalizado uppercase/trim)
- Persistencia com merge

---

## Licenses (`/api/licenses`)

Tabela Postgres: `operating_licenses` (payload JSONB).

Gerado via `crudFactory` com CRUD padrao.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/licenses` | `requireActiveUser` | Lista licencas |
| GET | `/api/licenses/:id` | `requireActiveUser` | Busca licenca por ID |
| POST | `/api/licenses` | `requireEditor` | Cria/atualiza licenca |
| PUT | `/api/licenses/:id` | `requireEditor` | Atualiza licenca (ID via URL) |
| DELETE | `/api/licenses/:id` | `requireAdmin` | Remove licenca |

### Condicionantes (`/api/licenses/:id/conditions` + `/api/license-conditions`)

Tabela Postgres: `license_conditions` (relacional; migration 0015). FK virtual via `license_id`.

Rotas manuais em `backend/routes/licenseConditions.js` (nested + flat).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/licenses/:licenseId/conditions` | `requireActiveUser` | Lista condicionantes da LO (ordenadas por `ordem`, `numero`) |
| POST | `/api/licenses/:licenseId/conditions` | `requireEditor` | Cria nova condicionante; `id` = `COND-<licenseId>-<numero>` (derivado se ausente) |
| PUT | `/api/licenses/:licenseId/conditions` | `requireEditor` | Bulk replace atomico da lista (DELETE nao-presentes + UPSERT) |
| GET | `/api/license-conditions/:id` | `requireActiveUser` | Item individual com `_links.license` e `_links.licenseConditions` |
| PUT | `/api/license-conditions/:id` | `requireEditor` | Atualiza campos; `licenseId` e `id` preservados |
| DELETE | `/api/license-conditions/:id` | `requireEditor` | Remove item |

Campos do payload (`data`): `numero` (obrigatorio), `texto` (obrigatorio), `titulo`, `tipo` (enum: `processos_erosivos`, `prad`, `supressao`, `fauna`, `emergencia`, `comunicacao`, `compensacao`, `geral`, `outro`), `prazo`, `periodicidadeRelatorio` (`Mensal|Trimestral|Semestral|Anual|Bienal`), `mesesEntrega` (int[]), `ordem`, `parecerTecnicoRef`.

### Anexos (`/api/licenses/:id/attachments`)

Dois slots fixos por LO: `documentoLO` (PDF original da licenca) e `planoGerenciamento` (PDF do PGA). Cada slot referencia um `mediaAssetId` criado pelo fluxo padrao em `/api/media/upload-url`. Os metadados ficam em `operating_licenses.payload.arquivos`.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/licenses/:id/attachments` | `requireActiveUser` | Lista slots preenchidos |
| POST | `/api/licenses/:id/attachments` | `requireEditor` | Vincula `mediaAssetId` a um `slot`. Se ja havia outro asset no slot, remove o anterior (cleanup). Rejeita nao-PDF com 415 |
| GET | `/api/licenses/:id/attachments/:slot/download` | `requireActiveUser` | 302 para signed URL (Tigris) ou `/api/media/:id/content` (local) |
| DELETE | `/api/licenses/:id/attachments/:slot` | `requireEditor` | Desvincula slot e remove o asset subjacente |

Slots aceitos: `documentoLO`, `planoGerenciamento`. Body do POST: `{ data: { slot, mediaAssetId }, meta? }`.

**Fluxo de upload ponta-a-ponta:**
1. `POST /api/media/upload-url` — cliente pede URL assinada com `contentType: 'application/pdf'`.
2. `PUT <signed-url>` — sobe o arquivo direto pro Tigris.
3. `POST /api/media/complete` — marca `ready`.
4. `POST /api/licenses/:id/attachments` — vincula ao slot.

---

## Inspections (`/api/inspections`)

Tabela Postgres: `inspections` (payload JSONB).

Gerado via `crudFactory` com CRUD padrao.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/inspections` | `requireActiveUser` | Lista vistorias |
| GET | `/api/inspections/:id` | `requireActiveUser` | Busca vistoria por ID |
| POST | `/api/inspections` | `requireEditor` | Cria/atualiza vistoria |
| PUT | `/api/inspections/:id` | `requireEditor` | Atualiza vistoria (ID via URL) |
| DELETE | `/api/inspections/:id` | `requireAdmin` | Remove vistoria |

Regras:
- Se `id` ausente, gera `VS-<timestamp>`
- Se `dataFim` ausente, usa `dataInicio`
- `detalhesDias` forca array (fallback `[]`)

---

## Erosions (`/api/erosions`)

Tabela Postgres: `erosions` (payload JSONB + colunas indexadas para `project_id`, `status`, `criticality_code`, `latitude`, `longitude`).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/erosions` | `requireActiveUser` | Lista erosoes |
| GET | `/api/erosions/:id` | `requireActiveUser` | Busca por ID |
| POST | `/api/erosions` | `requireEditor` | Calcula criticidade V3 e salva |
| PUT | `/api/erosions/:id` | `requireEditor` | Atualiza e recalcula |
| DELETE | `/api/erosions/:id` | `requireEditor` | Remove erosao |
| POST | `/api/erosions/simulate` | `requireActiveUser` | Simula calculo **sem persistir** |
| POST | `/api/erosions/:id/ficha-cadastro` | `requireEditor` | Gera ficha tecnica |

Body POST/PUT:

```json
{
  "data": {
    "id": "E07916129",
    "projetoId": "PRJ-001",
    "vistoriaId": "VS-100",
    "torreId": "T-045",
    "status": "Ativo",
    "latitude": "-15.123456",
    "longitude": "-47.654321",
    "tiposFeicao": ["vocoroca"],
    "profundidadeMetros": 5,
    "declividadeGraus": 30,
    "distanciaEstruturaMetros": 3,
    "tipoSolo": "arenoso",
    "sinaisAvanco": true,
    "vegetacaoInterior": false,
    "usosSolo": ["pastagem"],
    "localContexto": {
      "localTipo": "via_acesso_exclusiva",
      "localizacaoExposicao": "faixa_servidao"
    },
    "impactoVia": {
      "posicaoRelativaVia": "leito",
      "tipoImpactoVia": "ruptura_plataforma",
      "grauObstrucao": "total",
      "estadoVia": "terra",
      "extensaoAfetadaMetros": 15,
      "larguraComprometidaMetros": 3,
      "possibilidadeDesvio": false,
      "rotaAlternativaDisponivel": false
    },
    "fotosLinks": ["https://storage.example.com/foto1.jpg"],
    "fotosPrincipais": [
      {
        "photoId": "RPH-abc",
        "workspaceId": "RW-xyz",
        "mediaAssetId": "MED-123",
        "caption": "Vista montante",
        "sortOrder": 0
      }
    ]
  },
  "meta": {
    "updatedBy": "engenharia@empresa.com",
    "rulesConfig": null
  }
}
```

Campos tecnicos V3 usados no calculo de criticidade:

| Campo | Tipo | Descricao |
|---|---|---|
| `tiposFeicao` | string[] | Tipo de erosao (single-select na UI, array por retrocompat.) |
| `profundidadeMetros` | number | Profundidade em metros |
| `declividadeGraus` | number | Declividade em graus |
| `distanciaEstruturaMetros` | number | Distancia ate a estrutura em metros |
| `tipoSolo` | string | lateritico, argiloso, solos_rasos, arenoso |
| `sinaisAvanco` | boolean | Presenca de sinais de avanco |
| `vegetacaoInterior` | boolean | Presenca de vegetacao no interior |
| `localContexto.localTipo` | string | faixa_servidao, via_acesso_exclusiva, base_torre, fora_faixa_servidao |
| `localContexto.localizacaoExposicao` | string | faixa_servidao, area_terceiros |
| `impactoVia` | object | Dados de impacto na via (condicional: quando `localTipo = via_acesso_exclusiva`) |
| `fotosPrincipais` | object[] | Ate 6 referencias `{ photoId, workspaceId, mediaAssetId, caption?, sortOrder }` apontando para fotos de workspaces do mesmo projeto. Renderizadas no PDF completo e na galeria do modal de detalhes. Nao reutilizado pela ficha simplificada. |

O endpoint executa:
1. Validacao de campos tecnicos
2. Normalizacao de coordenadas (Decimal/UTM/DMS)
3. Calculo de criticidade V3 (T+P+D+S+E+A + modificador via)
4. Derivacao de tipo de erosao
5. Persistencia na tabela `erosions`
6. Registro de historico de criticidade
7. Evento de acompanhamento automatico

Status:
- `201`: criada e calculada (POST) | `200`: atualizada (PUT)
- `400`: payload/coordenadas invalidas
- `500`: erro interno

### POST /api/erosions/simulate

Mesmo body do POST (sem `id` obrigatorio). Retorna calculo sem persistir:

```json
{
  "message": "Erosion calculation simulated successfully.",
  "data": {
    "criticidade_score": 22,
    "codigo": "C3",
    "criticidade_classe": "Alto",
    "tipo_medida_recomendada": "corretiva_estrutural",
    "lista_solucoes_sugeridas": ["..."],
    "pontos": { "T": 4, "P": 2, "D": 4, "S": 2, "E": 4, "A": 6, "V": 0 },
    "tipo_classe": "T3",
    "profundidade_classe": "P2",
    "declividade_classe": "D3",
    "solo_classe": "S2",
    "exposicao_classe": "E3",
    "atividade_classe": "A4",
    "alertas_validacao": []
  }
}
```

---

## Users (`/api/users`)

Tabelas Postgres: `users` (payload JSONB), `auth_credentials`, `user_signatories`.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/users` | `requireActiveUser` + perfil gerencial | Lista usuarios (Admin/Editor/Gerente) |
| GET | `/api/users/me` | `verifyToken` | Perfil do usuario logado |
| GET | `/api/users/:id` | `verifyToken` (proprio ou gerencial) | Busca usuario por ID |
| POST | `/api/users` | `requireAdmin` | Cria usuario |
| PUT | `/api/users/:id` | `verifyToken` (self ou gerencial) | Atualiza usuario |
| DELETE | `/api/users/:id` | `requireAdmin` | Remove usuario |
| POST | `/api/users/:id/bootstrap-profile` | `requireAdmin` | Setup inicial de perfil |
| GET | `/api/users/me/signatarios` | `verifyToken` | Lista signatarios do usuario |
| POST | `/api/users/me/signatarios` | `verifyToken` | Cria signatario |
| PUT | `/api/users/me/signatarios/:sigId` | `verifyToken` | Atualiza signatario |
| DELETE | `/api/users/me/signatarios/:sigId` | `verifyToken` | Remove signatario |

Regras de edicao:
- Usuarios podem editar o proprio perfil, mas **nao** podem alterar `perfil` ou `status`
- Gerentes (Admin/Editor/Gerente) podem alterar qualquer usuario, incluindo `perfil` e `status`
- Cache de perfil invalidado apos alteracao

---

## Profissoes (`/api/profissoes`)

Tabela Postgres: `profissoes`. Vinculada a `user_signatories.profissao_id`.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/profissoes` | `requireActiveUser` | Lista profissoes cadastradas |
| POST | `/api/profissoes` | `requireAdmin` | Cria profissao |
| DELETE | `/api/profissoes/:id` | `requireAdmin` | Remove profissao |

Seed inclui: Engenheiro Civil, Eletricista, Ambiental, Mecanico; Geologo; Biologo; Tecnico em Agrimensura; Gestor de Projetos.

---

## Rules (`/api/rules`)

Tabela Postgres: `rules_config` (singleton, `id = 'default'`).

Armazena configuracao de regras de criticidade (`pontos`, `faixas`, `solucoes`), retencao (`lixeira_para_arquivo_dias`) e lista de feriados (`feriados: [{ data, nome, tipo }]`).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/rules` | `requireActiveUser` | Busca configuracao |
| PUT | `/api/rules` | `requireEditor` | Atualiza configuracao |
| GET | `/api/rules/feriados/importar?ano=YYYY` | `requireAdmin` | Proxy da [BrasilAPI](https://brasilapi.com.br/api/feriados/v1) — retorna feriados nacionais do ano sem persistir. O frontend faz merge com a lista atual e chama PUT para salvar. |

Body (PUT):

```json
{
  "data": {
    "criticalidade": {
      "pontos": { "...": "..." },
      "faixas": [
        { "codigo": "C1", "classe": "Baixo", "min": 0, "max": 9 },
        { "codigo": "C2", "classe": "Medio", "min": 10, "max": 18 },
        { "codigo": "C3", "classe": "Alto", "min": 19, "max": 27 },
        { "codigo": "C4", "classe": "Muito Alto", "min": 28, "max": null }
      ]
    }
  },
  "meta": {
    "updatedBy": "admin@empresa.com"
  }
}
```

O campo `max` da faixa C4 e armazenado como `null` e tratado como infinito pela engine de calculo.

---

## Media (`/api/media`)

Tabela Postgres: `media_assets`. Servico de upload/download para S3/Tigris (ou disco local quando `MEDIA_BACKEND=local`).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| POST | `/api/media/upload-url` | `requireEditorOrWorker` | Cria registro e retorna URL assinada para upload direto |
| PUT | `/api/media/:id/upload` | `requireEditorOrWorker` | Upload binario direto (apenas `MEDIA_BACKEND=local`; 50 MB max) |
| POST | `/api/media/complete` | `requireEditorOrWorker` | Marca upload completo, valida SHA256 |
| GET | `/api/media/:id/access-url` | `requireActiveUser` | Retorna URL de acesso (assinada ou local) |
| GET | `/api/media/:id/content` | `requireActiveUserOrWorker` | Serve binario (redirect S3 ou sendFile local) |
| DELETE | `/api/media/:id` | `requireEditor` | Remove media e arquivo fisico |

Colunas relevantes de `media_assets`: `purpose` (workspace_photo, project_photo_export_zip, report_compound_output, etc), `linked_resource_type`, `linked_resource_id`, `storage_key`, `sha256`, `status_execucao` (`pending_upload` → `ready` → `failed`).

---

## Report Workspaces (`/api/report-workspaces`)

Tabela Postgres principal: `report_workspaces` (com `project_id`, `inspection_id` opcional, `status`, `draft_state`). Rotas HATEOAS para gestao de workspaces de relatorio e suas fotos. Ver tambem [docs/modulo-reports.md](modulo-reports.md) para contexto de negocio.

### Workspaces

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/report-workspaces` | `requireActiveUser` | Lista workspaces visiveis ao usuario |
| GET | `/api/report-workspaces/:id` | `requireWorkspaceRead` | Busca workspace |
| POST | `/api/report-workspaces` | `requireEditor` | Cria workspace (criador vira `owner`) |
| PUT | `/api/report-workspaces/:id` | `requireWorkspaceWrite` | Atualiza workspace |
| POST | `/api/report-workspaces/:id/trash` | `requireWorkspaceWrite` | Soft delete (`deletedAt`) |
| POST | `/api/report-workspaces/:id/restore` | `requireWorkspaceWrite` | Restaura da lixeira |
| DELETE | `/api/report-workspaces/:id` | `requireWorkspaceWrite` | Hard delete |
| POST | `/api/report-workspaces/:id/import` | `requireWorkspaceWrite` | Registra importacao (`workspace_imports`) |

**Integridade referencial de `inspectionId`**: no POST (sempre) e no PUT/`import` (quando `data.inspectionId` vem no payload), um `inspectionId` nao-null e validado contra `inspectionRepository.getById`. Referencia inexistente => **400** `{ status: 'error', message: 'Vistoria nao encontrada' }`. `inspectionId` `null`/ausente segue permitido (workspace sem vinculo / desclassificado). Como `inspections` usa document-store JSONB (sem FK fisica), essa checagem mora no route handler — ver [migration 0009](../backend/migrations/0009_workspace_inspection_link.sql) e [docs/modulo-reports.md](modulo-reports.md#vinculo-com-vistoria-inspection_id).

### Fotos (ativas, trash, archive)

Tabela: `report_photos` com campos `deleted_at` (lixeira) e `archived_at` (arquivo imutavel). Ver [docs/modulo-reports.md](modulo-reports.md) para o ciclo de vida completo.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/report-workspaces/:id/photos` | `requireWorkspaceRead` | Lista fotos ativas |
| GET | `/api/report-workspaces/:id/photos/trash` | `requireWorkspaceRead` | Lista fotos na lixeira |
| PUT | `/api/report-workspaces/:id/photos/:photoId` | `requireWorkspaceWrite` | Atualiza metadata (curadoria) |
| POST | `/api/report-workspaces/:id/photos/:photoId/trash` | `requireWorkspaceWrite` | Move foto para lixeira |
| POST | `/api/report-workspaces/:id/photos/:photoId/restore` | `requireWorkspaceWrite` | Restaura da lixeira |
| POST | `/api/report-workspaces/:id/photos/:photoId/archive` | `requireWorkspaceWrite` | Arquiva (imutavel) a partir da lixeira |
| POST | `/api/report-workspaces/:id/photos/:photoId/unarchive-to-trash` | `requireWorkspaceWrite` | Devolve foto arquivada para a lixeira |
| POST | `/api/report-workspaces/:id/photos/archive-trash-older-than` | `requireWorkspaceWrite` | Arquiva em lote fotos > N dias na lixeira |
| POST | `/api/report-workspaces/:id/photos/archive-all-trash` | `requireWorkspaceWrite` | Arquiva em lote TODAS as fotos da lixeira agora, sem filtro de idade |
| DELETE | `/api/report-workspaces/:id/photos/trash` | `requireWorkspaceWrite` | Esvazia lixeira (200 + count) |
| DELETE | `/api/report-workspaces/:id/photos/:photoId` | `requireWorkspaceWrite` | Remove foto definitivamente |
| POST | `/api/report-workspaces/:id/photos/organize` | `requireWorkspaceWrite` | Registra sumario pos-import (GPS, torres inferidas) |
| POST | `/api/report-workspaces/:id/photos/reorder` | `requireWorkspaceWrite` | Reordena por modo (`tower_asc`, `capture_date_desc`, etc) |
| POST | `/api/report-workspaces/:id/photos/manual-order` | `requireWorkspaceWrite` | Reordena por array explicito de `photoIds` |

Body de `archive-trash-older-than`:

```json
{ "data": { "olderThanDays": 30 }, "meta": { "updatedBy": "user@empresa.com" } }
```

Body de `manual-order`:

```json
{ "data": { "photoIds": ["P-1", "P-2", "P-3"] }, "meta": { "updatedBy": "user@empresa.com" } }
```

### KMZ

Tabela auxiliar: `workspace_kmz_requests` (requests efemeros de export). `media_assets` guarda o KMZ resultante.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| POST | `/api/report-workspaces/:id/kmz/process` | `requireWorkspaceWrite` | Processa KMZ organizado: parseia KML, casa por identidade (`photoId`/`mediaAssetId`/`sha256`) e **atualiza a torre de fotos existentes** (round-trip), ou cria fotos novas a partir de um KMZ externo |
| POST | `/api/report-workspaces/:id/kmz` | `requireWorkspaceWrite` | Solicita export KMZ assincrono (resposta 202 + token) |
| GET | `/api/report-workspaces/:id/kmz/:token` | `requireWorkspaceRead` | Consulta status do export |

Resposta de `POST .../kmz/process` — `summary` distingue fotos **criadas** (KMZ externo) de fotos **atualizadas** (round-trip de organizacao, sem reupload):

```json
{
  "status": "success",
  "data": {
    "workspaceId": "RW-xxx",
    "summary": {
      "photosCreated": 5,
      "photosUpdated": 12,
      "photosSkipped": 1,
      "towersInferred": 4,
      "towersAssigned": 12,
      "pendingLinkage": 1,
      "placemarkCount": 10,
      "warnings": []
    }
  }
}
```

- `photosUpdated`: fotos **ja existentes** que tiveram a torre (re)atribuida a partir da pasta `Torre N` em que o usuario organizou o placemark no Google Earth — sem novo upload.
- `towersAssigned`: subconjunto de `photosUpdated` que estava **sem torre** e passou a ter (`towerSource = 'kmz_organized'`).

### Membros

Tabela Postgres: `workspace_members` (primary key composta `(workspace_id, user_id)`, role em `{owner, editor, viewer}`).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/report-workspaces/:id/members` | `requireWorkspaceRead` | Lista membros (com `allowDelete` por role) |
| POST | `/api/report-workspaces/:id/members` | `requireWorkspaceWrite` | Adiciona membro (body: `{ userId, role }`) |
| DELETE | `/api/report-workspaces/:id/members/:userId` | `requireWorkspaceWrite` | Remove membro (impede remover ultimo `owner`) |

---

## Report Compounds (`/api/report-compounds`)

Tabela Postgres: `report_compounds`. Composto = agrupamento de varios workspaces em um unico relatorio final.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/report-compounds` | `requireActiveUser` | Lista compostos |
| GET | `/api/report-compounds/:id` | `requireActiveUser` | Busca composto |
| POST | `/api/report-compounds` | `requireEditor` | Cria composto |
| PUT | `/api/report-compounds/:id` | `requireEditor` | Atualiza composto |
| POST | `/api/report-compounds/:id/add-workspace` | `requireEditor` | Adiciona workspace ao composto |
| POST | `/api/report-compounds/:id/remove-workspace` | `requireEditor` | Remove workspace |
| POST | `/api/report-compounds/:id/reorder` | `requireEditor` | Reordena workspaces |
| POST | `/api/report-compounds/:id/preflight` | `requireEditor` | Valida composto pre-geracao |
| POST | `/api/report-compounds/:id/generate` | `requireEditor` | Enfileira geracao DOCX (resposta 202) |

Campos relevantes de `sharedTextsJson`:
- `elaboradores`, `revisores`: arrays de snapshots de signatarios `{ nome, profissao, registro }`.
- `includeTowerCoordinates` / `towerCoordinateFormat`: habilita e formata coordenadas de torre nas fotos.
- `anexoFichasMode`: `none` (default) | `all` | `selected` — controla o anexo de fichas de erosao simplificada apos as assinaturas.
- `anexoFichasErosionIds`: array de `erosion.id` usado quando `anexoFichasMode = 'selected'`. As fichas sempre saem ordenadas pelo numero da torre (crescente).

---

## Report Archives (`/api/report-archives`)

Tabela Postgres: `report_archives`. Guarda entregas imutaveis e versionadas por composto (v1, v2, ...). Cada entrega referencia:
- `generated_media_id` — DOCX gerado pelo sistema
- `delivered_media_id` — PDF/DOCX final efetivamente entregue (opcional; uploadable via `attach-delivered`)
- `snapshot_payload` — copia defensiva do payload do composto no momento da entrega
- `generated_sha256` / `delivered_sha256` — hashes para verificacao

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/report-archives` | `requireActiveUser` | Lista arquivos (filtro `?compoundId=`) |
| GET | `/api/report-archives/:id` | `requireActiveUser` | Busca arquivo |
| POST | `/api/report-archives/:id/attach-delivered` | `requireEditor` | Anexa media do arquivo entregue (valida SHA256) |
| GET | `/api/report-archives/:id/download` | `requireActiveUser` | Redireciona para media (variant `generated` ou `delivered`) |

---

## Report Jobs (`/api/report-jobs`)

Tabela Postgres: `report_jobs`. Fila de jobs assincronos consumidos pelo worker (kinds: `report_compound`, `project_dossier`, `workspace_kmz_export`, `project_photo_export`).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/report-jobs` | `requireActiveUser` | Lista jobs |
| GET | `/api/report-jobs/:id` | `requireActiveUser` | Busca job |
| GET | `/api/report-jobs/:id/context` | `requireEditorOrWorker` | Monta contexto de geracao (payload completo) |
| POST | `/api/report-jobs/claim` | `requireEditorOrWorker` | Worker reclama proximo job em `queued` |
| POST | `/api/report-jobs/reclaim-stuck` | `requireEditorOrWorker` | Recupera jobs presos (threshold default: 30 min) |
| PUT | `/api/report-jobs/:id/complete` | `requireEditorOrWorker` | Marca job `ready` com artefatos (`outputDocxMediaId`, `outputKmzMediaId`) |
| PUT | `/api/report-jobs/:id/fail` | `requireEditorOrWorker` | Marca job `failed` com `errorLog` |
| PUT | `/api/report-jobs/:id/progress` | `requireEditorOrWorker` | Ping de progresso (worker): `{ data: { processed, total, phase } }`. So `workspace_kmz` — grava `progress` no `workspace_kmz_request` (nao muda `statusExecucao`). Rota de transporte (resposta minima); o polling do frontend desenha a barra de geracao |

---

## Report Templates (`/api/report-templates`)

Tabela Postgres: `report_templates`. Modelos DOCX base usados para renderizar compostos e dossies.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/report-templates` | `requireActiveUser` | Lista templates |
| GET | `/api/report-templates/:id` | `requireActiveUser` | Busca template |
| POST | `/api/report-templates` | `requireEditor` | Cria template (associa a media asset) |
| PUT | `/api/report-templates/:id` | `requireEditor` | Atualiza template |
| DELETE | `/api/report-templates/:id` | `requireEditor` | Remove template |
| POST | `/api/report-templates/:id/activate` | `requireEditor` | Marca como ativo (desativa os demais) |

---

## Project Photos (`/api/projects/:id/photos`)

Tabelas Postgres: `report_photos` (fotos dos workspaces do projeto, agregadas) e `project_photo_exports` (tokens de export ZIP).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/projects/:id/photos` | `requireActiveUser` | Lista fotos agregadas do projeto |
| POST | `/api/projects/:id/photos` | `requireEditor` | Cria/registra foto do projeto |
| POST | `/api/projects/:id/photos/export` | `requireEditor` | Inicia export ZIP (resposta 202 com token) |
| GET | `/api/projects/:id/photos/exports/:token` | `requireActiveUser` | Status do export |
| GET | `/api/projects/:id/photos/exports/:token/download` | `requireActiveUser` | Serve ZIP (redirect para media) |

---

## Project Dossiers (`/api/projects/:id/dossiers`)

Tabela Postgres: `project_dossiers`. Compilacao de licencas, erosoes e workspaces em um dossie para auditoria.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/projects/:id/dossiers` | `requireActiveUser` | Lista dossies do projeto |
| POST | `/api/projects/:id/dossiers` | `requireEditor` | Cria dossie |
| GET | `/api/projects/:id/dossiers/:dossierId` | `requireActiveUser` | Busca dossie |
| PUT | `/api/projects/:id/dossiers/:dossierId` | `requireEditor` | Atualiza dossie |
| POST | `/api/projects/:id/dossiers/:dossierId/preflight` | `requireEditor` | Valida escopo (licencas, vistorias, workspaces) |
| POST | `/api/projects/:id/dossiers/:dossierId/generate` | `requireEditor` | Enfileira geracao DOCX |

---

## Project Report Defaults (`/api/projects/:id/report-defaults`)

Tabela Postgres: `project_report_defaults`. Configuracoes por projeto para geracao de relatorios (buffer de faixa de servidao, raio de sugestao de torre, textos base).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/projects/:id/report-defaults` | `requireActiveUser` | Busca defaults |
| PUT | `/api/projects/:id/report-defaults` | `requireEditor` | Atualiza defaults |

Campos: `faixa_buffer_meters_side` (default 200), `tower_suggestion_radius_meters` (300), `base_tower_radius_meters` (30), `textos_base`, `preferencias`.

---

## Reports (`/api/reports`)

Rotas legacy para geracao de relatorio unico (pre-compounds). Preservadas para compatibilidade.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/reports/:id` | `requireActiveUser` | Busca relatorio legacy |
| POST | `/api/reports/preflight` | `requireEditor` | Valida slots pre-geracao |
| POST | `/api/reports/generate` | `requireEditor` | Enfileira geracao legacy (202) |

---

## Report Delivery Tracking (`/api/report-delivery-tracking`)

Tabela Postgres: `report_delivery_tracking`. Rastreio mensal de entregas por projeto.

Gerado via `crudFactory`.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/report-delivery-tracking` | `requireActiveUser` | Lista registros |
| GET | `/api/report-delivery-tracking/:id` | `requireActiveUser` | Busca por ID |
| POST | `/api/report-delivery-tracking` | `requireEditor` | Cria/atualiza registro |
| PUT | `/api/report-delivery-tracking/:id` | `requireEditor` | Atualiza (ID via URL) |
| DELETE | `/api/report-delivery-tracking/:id` | `requireAdmin` | Remove registro |

Body (POST/PUT):

```json
{
  "data": {
    "projectId": "PRJ-001",
    "monthKey": "2026-03",
    "status": "Entregue",
    "dataEntrega": "2026-03-15"
  },
  "meta": {
    "updatedBy": "ambiental@empresa.com"
  }
}
```

O ID e gerado automaticamente: `{projectId}__{monthKey}` (ex: `PRJ-001__2026-03`).

Regras:
- `projectId` obrigatorio
- `monthKey` obrigatorio, formato `YYYY-MM`

---

## Admin Metrics (`/api/admin/metrics`)

Endpoints de observabilidade agregada (somente Admin).

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/admin/metrics/totals` | `requireAdmin` | Totais (usuarios ativos, workspaces, compostos, erosoes) |
| GET | `/api/admin/metrics/activity` | `requireAdmin` | Ultimos 10 jobs + workspaces das ultimas 24h |
| GET | `/api/admin/metrics/top-users` | `requireAdmin` | Top N usuarios por compostos gerados (limit default 10) |
| GET | `/api/admin/metrics/recent-logins` | `requireAdmin` | Ultimos N logins |
| GET | `/api/admin/metrics/health` | `requireAdmin` | Saude da fila (queued, processing, failed 24h) |

---

## Admin SQL Executor (`/api/admin/sql`)

Console SQL ad-hoc somente leitura para administradores. Defesa em camadas:

1. `isReadOnlySql()` em [../backend/utils/sqlReadOnlyGuard.js](../backend/utils/sqlReadOnlyGuard.js) — rejeita multi-statement, aceita so primeiro token em `{SELECT, WITH, EXPLAIN, SHOW, VALUES, TABLE}`, lista negra de keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER`, `CREATE`, `GRANT`, `REVOKE`, `VACUUM`, `COPY`, `CALL`, `DO`, `MERGE`, ...).
2. Transacao `BEGIN READ ONLY` + `SET LOCAL statement_timeout = 5000` + `ROLLBACK` garantido no Postgres.
3. Rate limit dedicado: 20 req / 5 min (em [../backend/server.js](../backend/server.js)).
4. Truncamento do resultado em `MAX_ROWS = 1000` (flag `truncated` no envelope).
5. Audit log persistente na tabela `admin_sql_audit` (migration `0012_admin_sql_audit.sql`) — cada execucao (`success`, `error`, `blocked`) vira uma linha com quem, quando, SQL, linhas, duracao, mensagem.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| POST | `/api/admin/sql/execute` | `requireAdmin` | Executa SQL read-only; body `{ data: { sql: string(1..5000) } }`. Retorna `{ columns, rows, rowCount, truncated, durationMs }` |
| GET | `/api/admin/sql/audit?page=&limit=` | `requireAdmin` | Lista paginada do audit log (mais recente primeiro) |
| GET | `/api/admin/sql/snippets` | `requireAdmin` | Lista snippets salvos (ordenados por nome). Globais entre admins — `created_by` apenas para audit |
| POST | `/api/admin/sql/snippets` | `requireAdmin` | Cria snippet; body `{ data: { name, sqlText, description? } }`. 409 `SNIPPET_NAME_CONFLICT` se nome duplicado (case-insensitive) |
| PUT | `/api/admin/sql/snippets/:id` | `requireAdmin` | Atualiza snippet existente (partial update de `name`/`sqlText`/`description`) |
| DELETE | `/api/admin/sql/snippets/:id` | `requireAdmin` | Remove snippet (204) |

Codigos de erro especificos do `/execute`:
- `400 SQL_NOT_READ_ONLY` — guard bloqueou (audita `status='blocked'`)
- `400 SQL_EXECUTION_ERROR` — Postgres retornou erro (audita `status='error'`)
- `400 VALIDATION_ERROR` — body nao passou no Zod

Snippets (tabela `admin_sql_snippets`, migration `0013_admin_sql_snippets.sql`): armazenam queries reutilizaveis (ex.: "torres com lat/lng por linha"). Globais — qualquer admin pode criar/editar/deletar qualquer snippet; coluna `created_by` serve apenas para audit. Nenhuma validacao de read-only no CRUD de snippets — o guard `isReadOnlySql` age so no momento da execucao via `/execute`.

Integracao no frontend: aba "Console SQL" dentro de `AdminView` ([../src/features/admin/components/SqlExecutorPanel.jsx](../src/features/admin/components/SqlExecutorPanel.jsx)), visivel so para `user.role === 'admin'`.

---

## Admin Alerts (`/api/admin/alerts`)

Fila de alertas de sistema persistidos em `system_alerts` (migration `0014_system_alerts.sql`). Por enquanto ha um unico `type` emitido automaticamente: `query_count_exceeded`, gerado pelo middleware em [../backend/middleware/queryCounter.js](../backend/middleware/queryCounter.js) quando uma request produz mais queries Postgres que `QUERY_COUNT_ALERT_THRESHOLD` (default 15). O log correspondente tambem vai pro stdout como linha JSON `{"level":"warn","type":"query_count_alert",...}`.

O `payload` de `query_count_exceeded` contem `{ method, url, status, count, threshold, durationMs, userId }`.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/admin/alerts?status=pending\|all&page=&limit=` | `requireAdmin` | Lista paginada (default `status=pending`, mais recente primeiro) |
| POST | `/api/admin/alerts/:id/ack` | `requireAdmin` | Marca como revisado (`acknowledged_at = NOW()`, `acknowledged_by = req.user.email`). 404 se inexistente; 409 `ALERT_ALREADY_ACKNOWLEDGED` se ja marcado |

Integracao no frontend: painel "Alertas do sistema" embutido ao fim da aba "Estatisticas" do `AdminView` ([../src/features/admin/components/SystemAlertsPanel.jsx](../src/features/admin/components/SystemAlertsPanel.jsx) montado dentro de [../src/features/admin/components/UsageStatsSection.jsx](../src/features/admin/components/UsageStatsSection.jsx)).

Configuracao (env vars opcionais):
- `QUERY_COUNT_ALERT_THRESHOLD` — limite de queries por request antes de disparar o alerta (default `15`).
- `DEBUG_QUERY_COUNT=1` — loga contagem de TODA request (default so loga quando excede). Util em dev.

---

## Workers e integracao interna

Alguns endpoints aceitam um header alternativo `x-worker-token` (valor em `WORKER_API_TOKEN`) no lugar do JWT de usuario, para permitir que o worker consuma a API sem uma sessao humana. Usado em:

- `GET /api/media/:id/content`
- `POST /api/media/upload-url`, `PUT /api/media/:id/upload`, `POST /api/media/complete`
- `GET /api/report-jobs/:id/context`
- `POST /api/report-jobs/claim`, `/reclaim-stuck`
- `PUT /api/report-jobs/:id/complete`, `/fail`
