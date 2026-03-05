# GeoMonitor

Aplicacao web para gestao de empreendimentos, vistorias, licencas e erosoes com React + Firebase.

## Visao geral

O projeto esta em migracao do fluxo legado em `app.html` para arquitetura modular em `src/`, organizada por dominio (`features`) com componentes, modelos, servicos e utilitarios separados.

Capacidades atuais:

- Gestao de empreendimentos, incluindo importacao e revisao de KML.
- Planejamento de rota por torres para apoio a operacao em campo.
- Gestao de vistorias multi-dia com diario por torre.
- Planejamento de visitas com recomendacao de hospedagem baseada em historico.
- Gestao de erosoes com criticidade, historico de acompanhamento e exportacoes.
- Gestao de licencas de operacao (LO) com cobertura por empreendimento/torres.
- Autenticacao e persistencia via Firebase (Auth + Firestore).

## Stack

- React 18
- Vite 5
- Firebase (Auth + Firestore)
- Vitest (testes unitarios)

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

- `npm run dev`: inicia ambiente local com Vite.
- `npm run build`: gera build de producao.
- `npm run preview`: sobe preview local do build.
- `npm run test`: executa testes unitarios (uma vez).
- `npm run test:watch`: executa testes em modo observacao.
- `npm run test:coverage`: executa testes com cobertura.

## Estrutura do projeto

```txt
src/
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
```

## Estado da migracao

- Base Firestore padronizada em `shared/geomonitor/*`.
- Modulos principais operando na estrutura `src/features`.
- `app.html` ainda existe como legado durante a transicao.

## Smoke tests

- Checklist manual: `docs/smoke-test-checklist.md`
- Relatorio mais recente: `docs/smoke-test-report-2026-02-22.md`

## API backend

- Documentacao dos endpoints: `docs/api-backend.md`

## Observacoes

- O arquivo `SIMRLE.kml` pode ser usado como referencia de entrada para validacoes/importacao KML.
- Para validar todos os fluxos, e necessario ambiente Firebase valido e autenticacao ativa.
