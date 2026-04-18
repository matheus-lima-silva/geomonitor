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
| POST | `/api/auth/login` | publico | Autentica e retorna `{ accessToken, refreshToken, user }` |
| POST | `/api/auth/refresh` | publico | Renova access token a partir de refresh token |
| POST | `/api/auth/reset-password` | publico | Solicita token de reset (sempre retorna 200 para evitar enumeracao) |
| POST | `/api/auth/reset-password/confirm` | publico | Confirma reset com token valido |

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

Armazena configuracao de regras de criticidade: `pontos`, `faixas` e `solucoes`.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/rules` | `requireActiveUser` | Busca configuracao |
| PUT | `/api/rules` | `requireEditor` | Atualiza configuracao |

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
| POST | `/api/report-workspaces/:id/kmz/process` | `requireWorkspaceWrite` | Processa KMZ enviado como media asset: parseia KML, extrai fotos, infere torres |
| POST | `/api/report-workspaces/:id/kmz` | `requireWorkspaceWrite` | Solicita export KMZ assincrono (resposta 202 + token) |
| GET | `/api/report-workspaces/:id/kmz/:token` | `requireWorkspaceRead` | Consulta status do export |

Resposta de `POST .../kmz/process`:

```json
{
  "status": "success",
  "data": {
    "workspaceId": "RW-xxx",
    "summary": {
      "photosCreated": 5,
      "photosSkipped": 1,
      "towersInferred": 4,
      "pendingLinkage": 1,
      "placemarkCount": 10,
      "warnings": []
    }
  }
}
```

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

## Workers e integracao interna

Alguns endpoints aceitam um header alternativo `x-worker-token` (valor em `WORKER_API_TOKEN`) no lugar do JWT de usuario, para permitir que o worker consuma a API sem uma sessao humana. Usado em:

- `GET /api/media/:id/content`
- `POST /api/media/upload-url`, `PUT /api/media/:id/upload`, `POST /api/media/complete`
- `GET /api/report-jobs/:id/context`
- `POST /api/report-jobs/claim`, `/reclaim-stuck`
- `PUT /api/report-jobs/:id/complete`, `/fail`
