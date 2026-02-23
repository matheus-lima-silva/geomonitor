# GeoMonitor

Aplicação web para gestão de empreendimentos, vistorias e erosões, construída com React + Firebase.

## Visão geral

O projeto está em migração do fluxo monolítico em `app.html` para uma arquitetura modular em `src/`, organizada por domínio (`features`) com serviços, modelos e utilitários isolados.

Principais capacidades da fase atual:

- Gestão de empreendimentos com criação/edição e suporte a KML.
- Planejamento de rota para empreendimentos.
- Gestão de erosões com histórico em timeline.
- Exportação de relatórios e geração de PDF de detalhes da erosão.
- Camada de autenticação e persistência via Firebase.

## Stack

- React 18
- Vite 5
- Firebase (Auth + Firestore)
- Vitest (testes unitários)

## Requisitos

- Node.js 18+ (recomendado)
- npm 9+ (recomendado)
- Projeto Firebase configurado

## Configuração local

1. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

No Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

2. Preencha as variáveis do Firebase no `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

3. Instale as dependências:

```bash
npm install
```

4. Rode a aplicação:

```bash
npm run dev
```

## Scripts

- `npm run dev`: inicia ambiente local com Vite.
- `npm run build`: gera build de produção.
- `npm run preview`: sobe preview local do build.
- `npm run test`: executa testes unitários (uma vez).
- `npm run test:watch`: executa testes em modo observação.
- `npm run test:coverage`: executa testes com cobertura.

## Estrutura do projeto

```txt
src/
|-- components/
|-- context/
|-- features/
|   |-- auth/
|   |-- erosions/
|   |-- inspections/
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

## Migração em andamento

Situação atual da migração:

- Base Firestore padronizada em `shared/geomonitor/*`.
- Módulo de empreendimentos modularizado em `src/features/projects`.
- Módulo de erosões atualizado com:
  - relatório por empreendimento com ano opcional;
  - seleção multi-ano colapsável;
  - histórico em timeline com eventos manuais (Obra e Autuação);
  - geração de PDF de detalhes da erosão (layout A4).
- Demais fluxos seguem em transição para a estrutura modular.

## Smoke tests

- Checklist manual: `docs/smoke-test-checklist.md`
- Relatório mais recente: `docs/smoke-test-report-2026-02-22.md`

## Observações

- O arquivo `app.html` ainda existe como legado durante a migração.
- Para validação completa dos fluxos, é necessário ambiente Firebase válido e autenticação ativa.
