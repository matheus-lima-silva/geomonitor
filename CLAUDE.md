# GeoMonitor — guia arquitetural para o Claude Code

Aplicacao web para gestao de empreendimentos, vistorias, licencas, erosoes e relatorios de inspecao em linhas de transmissao. Este arquivo e lido automaticamente em toda sessao do Claude Code dentro do repo e existe para preservar convencoes arquiteturais entre sessoes.

## Stack

- **Frontend**: React 18 + Vite 5 + Tailwind CSS + Vitest. Entry: `src/App.jsx`, `index.html`.
- **Backend**: Node 18 + Express 5 sobre **PostgreSQL** (via `pg`, migracoes versionadas em `backend/migrations/`). Storage de midia em **S3/Tigris** (abstraido em `backend/utils/mediaStorage.js`). Testes com Jest + supertest.
- **Autenticacao**: **JWT proprio** (access + refresh) com `bcrypt` para credenciais. **Nao e mais Firebase/Firestore** — a migracao foi concluida em abril/2026.
- **Worker**: servico Python isolado (`worker/`) que processa jobs de geracao de DOCX (relatorios compostos). Triggado via webhook por `backend/utils/workerTrigger.js`.
- **Infra**: Docker + Fly.io (apps `geomonitor-web`, `geomonitor-api`, `geomonitor-worker`). Fly Managed Postgres + Tigris por ambiente.

## Estrutura

```
backend/          API Express + Postgres + S3
src/              Frontend React (feature-first em src/features/)
worker/           Worker Python (DOCX)
shared/           Helpers compartilhados
docs/             Documentacao canonica do sistema
deploy/           Configs de deploy (Fly/Docker)
```

## Regras de orientacao (leia antes de editar)

1. **Antes de tocar em `backend/`**, leia [backend/CLAUDE.md](backend/CLAUDE.md).
2. **Antes de tocar em `src/`**, leia [src/CLAUDE.md](src/CLAUDE.md).
3. **Fonte canonica de contrato** da API: [docs/api-backend.md](docs/api-backend.md). Todos os 20 routers e ~40 endpoints vivem la com metodo, rota e permissao. **Consultar antes** de criar/alterar qualquer rota e **atualizar junto** com a mudanca.
4. **Fonte canonica de padroes UI**: [docs/ui/ui-audit-report.md](docs/ui/ui-audit-report.md). Documenta primitivos, tokens e o audit que reduziu 51→10 controles ad-hoc do wizard de inspecao.
5. **Modulo de reports** (workspaces, lixeira, archives, membros): ver [docs/modulo-reports.md](docs/modulo-reports.md).

## Testes sao obrigatorios

Toda nova funcionalidade, rota, componente ou util **deve vir acompanhada de teste automatizado**. O gate de CI `npm run test:ci:strict` falha se qualquer teste quebrar. Sem teste novo, codigo nao sobe.

- Backend (Jest + supertest): `cd backend && npm test`. Integration em `backend/__tests__/integration/`.
- Frontend (Vitest + `react-dom/client` + `act`): `npm run test`. Co-locado em `__tests__/` irmao do arquivo.

Detalhes por camada nos CLAUDE.md especificos.

## Comandos principais

**Frontend (raiz)**
- `npm install` — dependencias
- `npm run dev` — Vite em `http://localhost:5173`
- `npm run build` — build de producao
- `npm run test` — Vitest (uma vez)
- `npm run test:watch` — Vitest em modo observacao
- `npm run test:coverage` — com cobertura
- `npm run test:ci:strict` — gate de CI (falha dura)

**Backend**
- `cd backend && npm install` — dependencias
- `cd backend && npm run migrate` — aplica migracoes Postgres pendentes
- `cd backend && node server.js` — sobe API em `http://localhost:8080` (prefixo `/api`)
- `cd backend && npm test` — Jest

## Convencoes globais

- **Idioma**: codigo em ingles; strings de UI e mensagens de commit em portugues. Commits no presente, minusculo, escopo entre parenteses quando aplicavel — ver `git log` como referencia (ex.: `feat(reports): arquivamento de fotos apos retencao configuravel`).
- **Sem arquivos .md novos** fora de `docs/` sem pedido explicito. Documentacao vive em `docs/` e nos `CLAUDE.md` hierarquicos.
- **Sem emojis** em codigo ou docs.

## Docs canonicas (pontos de consulta obrigatoria)

| Doc | Quando consultar |
|---|---|
| [docs/api-backend.md](docs/api-backend.md) | Antes de criar/alterar rota; atualizar junto |
| [docs/ui/ui-audit-report.md](docs/ui/ui-audit-report.md) | Antes de criar modal/painel; registrar refatoracoes grandes |
| [docs/modulo-reports.md](docs/modulo-reports.md) | Ao tocar workspaces/lixeira/archives/membros |
| [docs/visao-geral-sistema.md](docs/visao-geral-sistema.md) | Contexto nao-tecnico |
| [docs/metodologia-criticidade-v3.md](docs/metodologia-criticidade-v3.md) | Engine de criticidade V3 (fonte canonica) |
| [docs/testing/ci-cd-fly-ops.md](docs/testing/ci-cd-fly-ops.md) | Checklist de deploy |

## Manutencao deste documento

Revisar a cada trimestre ou sempre que houver migracao de stack, modulo novo ou nova convencao global. Ao atualizar, bumpar a data do rodape. PR que muda comportamento documentado deve atualizar o doc correspondente no mesmo PR.

> Ultima revisao: 2026-04-17.
