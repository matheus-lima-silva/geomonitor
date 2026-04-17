# GeoMonitor

Aplicacao web para gestao de empreendimentos, vistorias, licencas, erosoes e relatorios em linhas de transmissao. Frontend React + Vite; backend Node/Express sobre PostgreSQL com storage S3 (Tigris).

## Visao geral

O projeto possui uma arquitetura modular em `src/`, organizada por dominio (`features`) com componentes, modelos, servicos e utilitarios separados. O backend expoe uma API REST com HATEOAS, autenticacao JWT propria e RBAC por perfil.

Capacidades atuais:

- Gestao de empreendimentos, incluindo importacao de KML multi-linha e criacao em lote.
- Busca textual em empreendimentos com componente SearchableSelect.
- Planejamento de rota por torres para apoio a operacao em campo.
- Gestao de vistorias multi-dia com diario por torre, protecao contra duplicacao de ID e tooltips de ajuda no formulario.
- Planejamento de visitas com recomendacao de hospedagem baseada em historico.
- Gestao de erosoes com criticidade V3, historico de acompanhamento, alertas de pendencia e exportacoes.
- Suporte a coordenadas em Decimal, UTM (com separador de milhar) e DMS.
- Gestao de licencas de operacao (LO) com cobertura por empreendimento e slider de selecao de torres.
- Autenticacao propria (JWT + bcrypt) com controle de acesso baseado em perfis (RBAC) e cache de perfil.
- Gestao de workspaces de relatorio com upload direto de KMZ/fotos via signed URLs, curadoria por torre e composicao de relatorios compostos em DOCX.
- Lixeira de fotos com retencao configuravel (soft delete por `deleted_at`), filtro/agrupamento por torre e paginacao no modal expandido.
- Arquivamento imutavel de fotos e de entregas: fotos antigas transitam para estado arquivado apos N dias; entregas geradas sao versionadas em `report_archives` com SHA256.
- Gestao de membros por workspace (papeis `owner`/`editor`/`viewer`) para RBAC fino por espaco de trabalho.
- Dashboard de monitoramento com feedback visual de torres totalmente curadas e alertas de planejamento.
- Vinculo opcional de workspace com vistoria (`inspection_id`) para distinguir re-entradas no mesmo empreendimento.

## Stack

**Frontend**
- React 18 + Vite 5
- Tailwind CSS
- Leaflet / react-leaflet (mapas interativos)
- Recharts (graficos)
- html2canvas
- Vitest (testes unitarios)

**Backend**
- Node.js 18+ / Express 5
- PostgreSQL 13+ (via `pg`), migracoes versionadas em `backend/migrations/`
- JWT proprio (`jsonwebtoken`) + `bcrypt` para credenciais
- `@aws-sdk/client-s3` + `s3-request-presigner` para storage (Tigris/S3)
- Zod para validacao de payloads
- Helmet, morgan, cors, express-rate-limit
- Jest + supertest (testes do backend)

**Infra**
- Docker (imagens para `api` e `worker`)
- Fly.io (apps `geomonitor-web`, `geomonitor-api`, `geomonitor-worker` por ambiente)
- Fly Managed Postgres e bucket Tigris por ambiente

## Requisitos

- Node.js 18+ (recomendado)
- npm 9+ (recomendado)
- PostgreSQL acessivel (local ou gerenciado) para subir o backend
- Credenciais S3/Tigris (apenas se `MEDIA_BACKEND=tigris`; use `local` em dev)

## Configuracao local

### 1. Frontend

Crie um arquivo `.env` na raiz do projeto com as variaveis necessarias:

```bash
echo "VITE_API_BASE_URL=http://localhost:8080/api" > .env
```

Variaveis do frontend (`.env` na raiz):

- `VITE_API_BASE_URL` — URL base da API (default em dev: `http://localhost:8080/api`)

Instale e rode:

```bash
npm install
npm run dev
```

### 2. Backend

As variaveis do backend ficam em `backend/.env`. Referencia canonica em [deploy/fly/README.md](deploy/fly/README.md):

- `DATABASE_URL` — string de conexao Postgres (obrigatoria)
- `DATA_BACKEND` — `postgres` (padrao em homologacao/producao)
- `MEDIA_BACKEND` — `local` (disco) ou `tigris` (S3-compatible)
- `REPORT_EXECUTION_BACKEND` — `inline` (dev) ou `queue` (usa worker)
- `JWT_SECRET` — segredo para assinar access tokens
- `JWT_REFRESH_SECRET` — segredo para refresh tokens
- `WORKER_API_TOKEN` — token compartilhado com o worker para claim de jobs
- Apenas se `MEDIA_BACKEND=tigris`:
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
  - `AWS_ENDPOINT_URL_S3`, `BUCKET_NAME`

Instale, aplique migracoes e rode:

```bash
cd backend
npm install
npm run migrate
node server.js
```

## Scripts

**Frontend (raiz)**
- `npm run dev`: inicia ambiente local com Vite (porta 5173).
- `npm run build`: gera build de producao.
- `npm run preview`: sobe preview local do build.
- `npm run test`: executa testes unitarios (uma vez).
- `npm run test:watch`: executa testes em modo observacao.
- `npm run test:coverage`: executa testes com cobertura.
- `npm run test:ci:strict`: gate de CI/CD (falha se qualquer teste falhar).

**Backend**
- `cd backend && npm install`: instala dependencias do backend.
- `cd backend && npm run migrate`: aplica migracoes SQL em ordem (idempotente via `schema_migrations`).
- `cd backend && npm run build:utils`: recompila bundles CJS de utilitarios compartilhados (roda automaticamente antes de `start`/`dev`/`test`).
- `cd backend && npm start`: sobe o servidor Express (porta 8080).
- `cd backend && npm run dev`: modo nodemon com reload.
- `cd backend && npm test`: executa testes Jest do backend.

## Estrutura do projeto

```txt
src/                          # Frontend React
|-- components/
|-- context/
|-- features/
|   |-- admin/                # Gerenciamento, assinaturas, acessos, estatisticas
|   |-- auth/                 # Autenticacao, reset de senha, perfil obrigatorio
|   |-- erosions/
|   |-- followups/            # Acompanhamento de erosoes
|   |-- inspections/
|   |-- licenses/
|   |-- monitoring/           # Dashboard, alertas, status de torres
|   |-- projects/
|   |-- reports/              # Workspaces, compounds, lixeira, entregas, dossiers
|   `-- shared/
|-- hooks/
|-- layout/
|-- models/
|-- services/                 # Clientes HTTP para a API backend
|-- utils/
|-- views/
`-- App.jsx

backend/                      # API Express
|-- server.js
|-- routes/                   # 20 routers HATEOAS (ver docs/api-backend.md)
|-- repositories/             # Acesso a Postgres por dominio
|-- schemas/                  # Schemas Zod de validacao
|-- middleware/
|-- migrations/               # SQL versionado (0001..0011+), idempotente
|-- utils/
|   |-- criticality.js        # Engine de criticidade V3 (fonte canonica)
|   |-- authMiddleware.js
|   |-- workspaceAccess.js    # Middleware requireWorkspaceRead/Write
|   |-- jwt.js
|   `-- crudFactory.js
|-- scripts/
|   `-- runMigrations.js
`-- __tests__/

worker/                       # Processador de jobs (relatorios, KMZ)
deploy/fly/                   # Configs canonicas do Fly.io
docs/                         # Documentacao tecnica e de negocio
shared/                       # Helpers compartilhados entre front e back
```

## Estado da migracao

- Backend de dados: **PostgreSQL** (via `pg` + migracoes versionadas). Sem dependencias operacionais de Firestore.
- Backend de midia: **AWS S3/Tigris** com signed URLs para upload direto (fallback local para dev).
- Autenticacao: JWT proprio em `backend/utils/jwt.js`; credenciais em `auth_credentials` (bcrypt salt 12).
- Checklist da migracao: [docs/plans/migracao-geomonitor-postgres-tigris-relatorios.todo.md](docs/plans/migracao-geomonitor-postgres-tigris-relatorios.todo.md) (100% concluido).

## CI/CD e Deploy

- Workflow GitHub Actions automatizado de testes estritos (`test:ci:strict`).
- Deploy automatizado no Fly.io controlado via variaveis do repositorio (Gate: `ENABLE_FLY_DEPLOY`).
- Checklist de deploy: [docs/testing/ci-cd-fly-ops.md](docs/testing/ci-cd-fly-ops.md)
- Layout de apps e secrets: [deploy/fly/README.md](deploy/fly/README.md)

## Documentacao

- Endpoints da API: [docs/api-backend.md](docs/api-backend.md)
- Visao geral do sistema (nao-tecnica): [docs/visao-geral-sistema.md](docs/visao-geral-sistema.md)
- Modulo de relatorios (workspaces, lixeira, arquivo, membros, curadoria): [docs/modulo-reports.md](docs/modulo-reports.md)
- Metodologia de criticidade V3: [docs/metodologia-criticidade-v3.md](docs/metodologia-criticidade-v3.md)
- Tabela de criticidade e solucoes: [docs/tabela-criticidade-solucoes.md](docs/tabela-criticidade-solucoes.md)

## Observacoes

- O arquivo `SIMRLE.kml` pode ser usado como referencia de entrada para validacoes/importacao KML.
- Para validar todos os fluxos ponta a ponta e necessario um backend em execucao (Postgres + API) e credenciais de usuario ativas.
- O backend e a fonte canonica para calculo de criticidade; o frontend exibe apenas os resultados retornados pela API.
