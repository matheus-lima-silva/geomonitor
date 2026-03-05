# API Backend (GeoMonitor)

Documentacao dos endpoints expostos pelo servidor Express em `backend/server.js`.

## Base URL

- Local: `http://localhost:8080`
- Prefixo da API: `/api`

## Autenticacao

Todos os endpoints em `/api/*` exigem token Bearer:

```http
Authorization: Bearer <firebase-id-token>
```

`GET /health` nao exige autenticacao.

## Formato de resposta

Sucesso (padrao):

```json
{
  "status": "success",
  "data": {}
}
```

Erro (padrao):

```json
{
  "status": "error",
  "message": "Descricao do erro"
}
```

## Health

### GET /health

Verifica disponibilidade basica do servico.

Resposta `200`:

```json
{
  "status": "ok",
  "service": "geomonitor-api"
}
```

## Projects

Colecao: `projects`

### GET /api/projects

Lista projetos.

- `200`: lista retornada

### GET /api/projects/:id

Busca projeto por ID.

- `200`: encontrado
- `404`: nao encontrado

### POST /api/projects

Cria/atualiza projeto.

Body:

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

Regras:

- `data.id` obrigatorio
- `id` normalizado para uppercase/trim
- persistencia com merge (`merge: true`)

Status:

- `201`: salvo
- `400`: payload invalido

### PUT /api/projects/:id

Atalho para salvar usando `:id` da URL como ID do projeto.

- `201`: salvo

### DELETE /api/projects/:id

Remove projeto.

- `200`: removido

## Licenses

Colecao: `operatingLicenses`

### GET /api/licenses

Lista licencas.

- `200`: lista retornada

### GET /api/licenses/:id

Busca licenca por ID.

- `200`: encontrada
- `404`: nao encontrada

### POST /api/licenses

Cria/atualiza licenca.

Body:

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

Regras:

- `data.id` obrigatorio
- `id` normalizado com trim
- persistencia com merge (`merge: true`)

Status:

- `201`: salvo
- `400`: payload invalido

### PUT /api/licenses/:id

Atalho para salvar usando `:id` da URL.

- `201`: salvo

### DELETE /api/licenses/:id

Remove licenca.

- `200`: removida

## Inspections

Colecao: `inspections`

### GET /api/inspections

Lista vistorias.

- `200`: lista retornada

### GET /api/inspections/:id

Busca vistoria por ID.

- `200`: encontrada
- `404`: nao encontrada

### POST /api/inspections

Cria/atualiza vistoria.

Body:

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

- `data` obrigatorio
- se `id` ausente, gera `VS-<timestamp>`
- se `dataFim` ausente, usa `dataInicio`
- `detalhesDias` forca array (fallback `[]`)
- persistencia com merge (`merge: true`)

Status:

- `201`: salvo
- `400`: payload invalido

### PUT /api/inspections/:id

Atalho para salvar usando `:id` da URL.

- `201`: salvo

### DELETE /api/inspections/:id

Remove vistoria.

- `200`: removida

## Erosions

Colecao: `erosions` (em `shared/geomonitor/erosions`)

### POST /api/erosions

Calcula criticidade e salva erosao.

Body:

```json
{
  "data": {
    "id": "ERS-1",
    "status": "Ativo"
  },
  "meta": {
    "merge": true,
    "updatedBy": "engenharia@empresa.com"
  }
}
```

Status:

- `200`: erosao calculada e salva
- `400`: payload invalido, coordenadas invalidas ou campos tecnicos invalidos
- `500`: erro interno

### POST /api/erosions/simulate

Executa simulacao de calculo sem persistir.

Status:

- `200`: simulacao executada
- `500`: erro interno

