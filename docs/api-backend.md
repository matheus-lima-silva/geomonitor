# API Backend (GeoMonitor)

Documentacao dos endpoints expostos pelo servidor Express em `backend/server.js`.

## Base URL

- Local: `http://localhost:8080`
- Prefixo da API: `/api`

## Autenticacao e Controle de Acesso (RBAC)

Todos os endpoints em `/api/*` exigem token Bearer:

```http
Authorization: Bearer <firebase-id-token>
```

Middlewares de controle de acesso por papel:

| Middleware | Descricao |
|---|---|
| `requireActiveUser` | Usuario ativo (qualquer perfil) |
| `requireEditor` | Perfil Editor, Gerente ou Admin |
| `requireAdmin` | Perfil Admin/Administrador |

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

## Projects

Colecao Firestore: `projects`

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
- Persistencia com merge (`merge: true`)

---

## Licenses

Colecao Firestore: `operatingLicenses`

Gerado via `crudFactory` com CRUD padrao.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/licenses` | `requireActiveUser` | Lista licencas |
| GET | `/api/licenses/:id` | `requireActiveUser` | Busca licenca por ID |
| POST | `/api/licenses` | `requireEditor` | Cria/atualiza licenca |
| PUT | `/api/licenses/:id` | `requireEditor` | Atualiza licenca (ID via URL) |
| DELETE | `/api/licenses/:id` | `requireAdmin` | Remove licenca |

Body (POST/PUT):

```json
{
  "data": {
    "id": "LO-2026-01",
    "projetoId": "PRJ-001",
    "orgao": "IBAMA"
  },
  "meta": {
    "updatedBy": "ambiental@empresa.com"
  }
}
```

---

## Inspections

Colecao Firestore: `inspections`

Gerado via `crudFactory` com CRUD padrao.

| Metodo | Rota | Permissao | Descricao |
|---|---|---|---|
| GET | `/api/inspections` | `requireActiveUser` | Lista vistorias |
| GET | `/api/inspections/:id` | `requireActiveUser` | Busca vistoria por ID |
| POST | `/api/inspections` | `requireEditor` | Cria/atualiza vistoria |
| PUT | `/api/inspections/:id` | `requireEditor` | Atualiza vistoria (ID via URL) |
| DELETE | `/api/inspections/:id` | `requireAdmin` | Remove vistoria |

Body (POST/PUT):

```json
{
  "data": {
    "id": "VS-100",
    "projetoId": "PRJ-001",
    "dataInicio": "2026-03-01",
    "dataFim": "2026-03-02",
    "detalhesDias": []
  },
  "meta": {
    "updatedBy": "campo@empresa.com"
  }
}
```

Regras:
- Se `id` ausente, gera `VS-<timestamp>`
- Se `dataFim` ausente, usa `dataInicio`
- `detalhesDias` forca array (fallback `[]`)

---

## Erosions

Colecao Firestore: `shared/geomonitor/erosions`

### GET /api/erosions

Lista todas as erosoes. (Requer: `requireActiveUser`)

- `200`: lista retornada
- `500`: erro interno

### GET /api/erosions/:id

Busca erosao por ID. (Requer: `requireActiveUser`)

- `200`: encontrada
- `404`: nao encontrada

### POST /api/erosions

Calcula criticidade V3 e salva erosao. (Requer: `requireEditor`)

Body:

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
    "presencaAguaFundo": false,
    "saturacaoPorAgua": false,
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
    "fotosLinks": ["https://storage.example.com/foto1.jpg"]
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
| `impactoVia` | object | Dados de impacto na via (condicional: quando localTipo = via_acesso_exclusiva) |
| `impactoVia.posicaoRelativaVia` | string | leito, talude_montante, talude_jusante, margem_lateral |
| `impactoVia.grauObstrucao` | string | sem_obstrucao, parcial, total |
| `impactoVia.estadoVia` | string | pavimentada, cascalho, terra |
| `impactoVia.rotaAlternativaDisponivel` | boolean | Se existe rota alternativa |

O endpoint executa automaticamente:
1. Validacao de campos tecnicos
2. Normalizacao de coordenadas
3. Calculo de criticidade V3 (6 dimensoes T+P+D+S+E+A + modificador via)
4. Derivacao de tipo de erosao a partir de `tiposFeicao`
5. Persistencia com merge
6. Registro de historico de criticidade
7. Evento de acompanhamento automatico

Resposta inclui `criticalidadeV2` com o resultado completo do calculo.

Status:
- `201`: erosao calculada e salva (POST)
- `200`: erosao atualizada (PUT)
- `400`: payload invalido, coordenadas invalidas ou campos tecnicos invalidos
- `500`: erro interno

### PUT /api/erosions/:id

Atualiza erosao usando `:id` da URL. Executa o mesmo fluxo do POST. (Requer: `requireEditor`)

### DELETE /api/erosions/:id

Remove erosao. (Requer: `requireEditor`)

- `200`: removida
- `500`: erro interno

### POST /api/erosions/simulate

Executa simulacao de calculo de criticidade V3 **sem persistir**. (Requer: `requireActiveUser`)

Body: mesmo formato de `data` do POST, mas sem necessidade de `id`.

```json
{
  "data": {
    "tiposFeicao": ["ravina"],
    "profundidadeMetros": 5,
    "declividadeGraus": 30,
    "distanciaEstruturaMetros": 10,
    "tipoSolo": "argiloso",
    "sinaisAvanco": true,
    "vegetacaoInterior": false,
    "localContexto": {
      "localTipo": "faixa_servidao"
    }
  },
  "meta": {
    "rulesConfig": null
  }
}
```

Resposta `200`:

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

Status:
- `200`: simulacao executada
- `400`: campos tecnicos invalidos
- `500`: erro interno

---

## Users

Colecao Firestore: `users`

### GET /api/users

Lista usuarios. (Requer: token + perfil gerencial: Admin, Editor ou Gerente)

- `200`: lista retornada
- `403`: acesso negado (perfil insuficiente)

### GET /api/users/:id

Busca usuario por ID. Permite acesso ao proprio perfil (`isSelf`) ou perfil gerencial.

- `200`: encontrado
- `403`: acesso negado
- `404`: nao encontrado

### POST /api/users

Cria/atualiza usuario. (Requer: token)

Body:

```json
{
  "data": {
    "id": "firebase-uid",
    "nome": "Joao Silva",
    "email": "joao@empresa.com",
    "perfil": "Editor",
    "status": "Ativo"
  },
  "meta": {
    "updatedBy": "admin@empresa.com"
  }
}
```

Regras de controle de acesso:
- Usuarios podem editar o proprio perfil, mas **nao** podem alterar `perfil` ou `status` (campos protegidos)
- Gerentes (Admin/Editor/Gerente) podem alterar qualquer usuario, incluindo `perfil` e `status`
- Cache de perfil invalidado apos alteracao

Status:
- `201`: criado
- `400`: dados invalidos
- `403`: acesso negado

### PUT /api/users/:id

Atualiza usuario (ID via URL). Mesmas regras do POST.

- `200`: atualizado

### DELETE /api/users/:id

Remove usuario. (Requer: `requireAdmin`)

- `200`: removido

---

## Rules

Colecao Firestore: `config/rules` (documento singleton)

Armazena a configuracao de regras de criticidade. Inclui `criticalityV2` com pontos, faixas e solucoes.

### GET /api/rules

Busca configuracao de regras. (Requer: `requireActiveUser`)

- `200`: configuracao retornada (ou `data: null` se nao existir)

### PUT /api/rules

Atualiza configuracao de regras. (Requer: `requireEditor`)

Body:

```json
{
  "data": {
    "criticalityV2": {
      "pontos": { "..." },
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

Nota: Firestore nao suporta `Infinity`. O campo `max` da faixa C4 e armazenado como `null` e tratado como infinito pela engine de calculo.

- `200`: salvo
- `400`: dados invalidos

---

## Report Delivery Tracking

Colecao Firestore: `reportDeliveryTracking`

Gerado via `crudFactory`. Rastreia entregas de relatorios por projeto e mes.

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
