# GeoMonitor

Aplicacao web para gestao de empreendimentos, vistorias, licencas e erosoes com React + Firebase.

## Visao geral

O projeto possui uma arquitetura modular em `src/`, organizada por dominio (`features`) com componentes, modelos, servicos e utilitarios separados.

Capacidades atuais:

- Gestao de empreendimentos, incluindo importacao de KML multi-linha e criacao em lote.
- Busca textual em empreendimentos com componente SearchableSelect.
- Planejamento de rota por torres para apoio a operacao em campo.
- Gestao de vistorias multi-dia com diario por torre, protecao contra duplicacao de ID e tooltips de ajuda no formulario.
- Planejamento de visitas com recomendacao de hospedagem baseada em historico.
- Gestao de erosoes com criticidade V3, historico de acompanhamento, alertas de pendencia e exportacoes.
- Suporte a coordenadas em Decimal, UTM (com separador de milhar) e DMS.
- Gestao de licencas de operacao (LO) com cobertura por empreendimento e slider de selecao de torres.
- Autenticacao e persistencia via Firebase (Auth + Firestore) com resiliencia de subscriptions.
- Controle de acesso baseado em perfis (RBAC) com Auth Middleware.

## Stack

**Frontend**
- React 18
- Vite 5
- Tailwind CSS
- Firebase (Auth + Firestore)
- Leaflet / react-leaflet (mapas interativos)
- Recharts (graficos)
- Vitest (testes unitarios)

**Backend**
- Node.js 18+ / Express.js
- Firebase Admin SDK (Firestore)
- Docker (containerizacao)
- Jest (testes do backend)

## Requisitos

- Node.js 18+ (recomendado)
- npm 9+ (recomendado)
- Projeto Firebase configurado

## Configuracao local

1. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

No Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

2. Preencha as variaveis no `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

3. Instale as dependencias:

```bash
npm install
```

4. Rode a aplicacao:

```bash
npm run dev
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
- `cd backend && node server.js`: inicia o servidor Express (porta 8080).
- `cd backend && npm test`: executa testes Jest do backend.

## Estrutura do projeto

```txt
src/                          # Frontend React
|-- components/
|-- context/
|-- features/
|   |-- admin/
|   |-- auth/
|   |-- erosions/
|   |-- inspections/
|   |-- licenses/
|   |-- projects/
|   `-- shared/
|-- firebase/
|-- hooks/
|-- layout/
|-- models/
|-- services/
|-- utils/
|-- views/
`-- App.jsx

backend/                      # API Express
|-- server.js
|-- routes/
|   |-- erosions.js
|   |-- projects.js
|   |-- licenses.js
|   |-- inspections.js
|   |-- users.js
|   |-- rules.js
|   `-- reportDeliveryTracking.js
|-- utils/
|   |-- criticality.js        # Engine de criticidade V3 (fonte canonica)
|   |-- authMiddleware.js
|   |-- crudFactory.js
|   `-- firebaseSetup.js
`-- __tests__/
```

## Estado da migracao

- Base Firestore padronizada em `shared/geomonitor/*`.
- Modulos principais operando na estrutura `src/features`.

## Smoke tests

- Checklist manual: `docs/smoke-test-checklist.md`

## CI/CD e Deploy

- Workflow GitHub Actions automatizado de testes estritos (`test:ci:strict`).
- Deploy automatizado no `Fly.io` controlado via variaveis do repositorio (Gate: `ENABLE_FLY_DEPLOY`).
- Checklist de deploy: `docs/testing/ci-cd-fly-ops.md`

## API backend

- Documentacao dos endpoints: `docs/api-backend.md`
- Visao geral do sistema (nao-tecnica): `docs/visao-geral-sistema.md`
- Metodologia de criticidade V3: `docs/metodologia-criticidade-v3.md`
- Tabela de criticidade e solucoes: `docs/tabela-criticidade-solucoes.md`

## Observacoes

- O arquivo `SIMRLE.kml` pode ser usado como referencia de entrada para validacoes/importacao KML.
- Para validar todos os fluxos, e necessario ambiente Firebase valido e autenticacao ativa.
- O backend e a fonte canonica para calculo de criticidade; o frontend exibe apenas os resultados retornados pela API.
