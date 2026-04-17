# TODO - Migracao GeoMonitor + GeoRelat + Tigris

Status atual: `81/82` itens concluidos (`98,8%`), `1` pendente.

O unico item restante e limpeza: nao ha mais dependencias operacionais de Firestore no runtime (backend roda sobre Postgres via `pg`, sem `firebase-admin`; frontend consome a API REST, sem `firebase`). O que falta sao apenas residuos textuais (comentarios historicos em `backend/utils/authMiddleware.js`, `backend/routes/auth.js`, `backend/utils/mailer.js`, teste `criticality.test.js` e label "UID (Firebase Auth)" em `src/features/admin/components/AdminView.jsx`). Esses nao afetam execucao e podem ser limpos quando conveniente.

## infra/schema

- [x] adicionar abstractions para backend nao-Firestore
- [x] preparar migracoes SQL versionadas
- [x] modelar entidades alvo no backend
- [x] abrir `postgresStore` e migracoes iniciais por flag
- [x] migrar `rules.js` de `getDocRef` direto para `rulesConfigRepository`
- [x] migrar `reports.js` de `getDataStore` para `reportJobRepository` + fallback legado
- [x] remover fallback de store do `crudFactory`
- [x] isolar leitura legada de `reports` em `legacyReportRepository`
- [x] remover o `document_store` generico remanescente das areas novas e dos dominios base (auditoria: padrao dual-backend intencional, todos repositorios ja usam isPostgresBackend corretamente)

## repositorios-api

- [x] criar rotas HATEOAS para `project-report-defaults`
- [x] criar rotas HATEOAS para `project photos`
- [x] criar rotas HATEOAS para `project dossiers`
- [x] criar rotas HATEOAS para `report compounds`
- [x] expandir `report-workspaces` para fotos, organizacao e KMZ
- [x] criar repositorios por dominio para as rotas novas
- [x] plugar as rotas novas nos repositorios
- [x] migrar `workspaceImports` e `workspaceKmzRequests` para repositorios/tabelas proprias
- [x] migrar preflight do dossie para repositorios dos dominios base
- [x] mapear `projects`, `licenses`, `inspections`, `users`, `erosions`, `report_delivery_tracking` para repositorios/tabelas alvo
- [x] criar `reportTemplateRepository` com CRUD + activate
- [x] criar rotas HATEOAS para `report-templates`
- [x] estender `reportJobRepository` com `list`, `listQueued`, `claimNext`, `markComplete`, `markFailed`
- [x] criar rotas HATEOAS para `report-jobs` (list, get, claim, complete, fail)
- [x] expandir `mediaAssetRepository` com `listByLinkedResource`, `listByPurpose`, `markReady`, `markFailed`
- [x] expandir cobertura e ajustes finais dos repositorios base em modo Postgres real (rota report-templates registrada, todos countByProject validados)

## fly-bootstrap-deploy

- [x] versionar configuracoes do Fly para `geomonitor-web`, `geomonitor-api` e `geomonitor-worker`
- [x] definir estrategia de apps por ambiente (`homologacao` e `producao`)
- [x] provisionar `Managed Postgres` do ambiente alvo
- [x] provisionar bucket `Tigris` e vincular ao app
- [x] mapear e documentar secrets por app
- [x] configurar healthchecks, regiao primaria e escala inicial
- [x] validar deploy inicial em homologacao via `flyctl`
- [x] documentar promote para producao

## media-tigris

- [x] manter `media` local como fallback
- [x] preparar contratos para signed URLs
- [x] preparar shape de `media_assets`
- [x] plugar o frontend de relatorios no fluxo real de upload assinado
- [x] adicionar queries especializadas ao `mediaAssetRepository` para pipeline de geracao
- [x] usar `mediaAssetRepository` na trilha completa de curadoria/exportacao/geracao (delete de foto limpa media asset, kmzProcessor com cleanup de orfaos)

Avanco desta rodada:
- exportacao efemera de fotos por empreendimento agora persiste e reutiliza artefato ZIP via `mediaAssetRepository` (`purpose=project_photo_export_zip`, `linkedResourceType=project_photo_export`), evitando regeneracao do arquivo a cada download.
- homologacao Fly com `MEDIA_BACKEND=tigris` validada no endpoint real de media (`upload-url` -> upload assinado -> `complete` -> `content`) usando token interno do worker.
- hotfix em homologacao: rota `report-jobs` foi montada na API (`/api/report-jobs`) e redeployada com `backend/Dockerfile`.
- smoke real de jobs `project_dossier` e `report_compound` concluido em `DATA_BACKEND=postgres` + `MEDIA_BACKEND=tigris`, com artefatos DOCX gravados em `media_assets` (`statusExecucao=ready`).

## workspace-curadoria

- [x] stepper do workspace
- [x] selecao obrigatoria de empreendimento
- [x] entrada de importacao em tres modos no frontend (`fotos soltas`, `subpastas por torre` e registro de `KMZ organizado`)
- [x] importacao inicial de `fotos soltas` com upload real de media
- [x] curadoria minima com legenda, torre e inclusao
- [x] tooltips operacionais
- [x] autosave persistido de rascunho do workspace
- [x] processamento efetivo de `KMZ organizado` com extracao de fotos, inferencia de torre e criacao de `report_photo`

## photo-library

- [x] scaffold da biblioteca agregada por empreendimento
- [x] biblioteca agregada por empreendimento
- [x] filtros por workspace, torre, data e legenda
- [x] metadata de export efemero em fila/scaffold
- [x] export total e parcial em ZIP efemero com processamento real

## project-dossier

- [x] scaffold de CRUD + preflight + fila do dossie
- [x] builder de escopo do dossie
- [x] preflight inicial do dossie por secao e com UI web exposta
- [x] validar preflight do dossie em Postgres real (todos 6 repositorios com countByProject implementado e Postgres-ready)
- [x] geracao de DOCX
- [x] smoke funcional em homologacao Postgres/Tigris via worker

## templates-admin

- [x] secao de relatorios na administracao
- [x] lista de versoes
- [x] ativacao de template

## worker-python

- [x] criar scaffold bootstrap do app `geomonitor-worker`
- [x] integrar consumo manual de `report-jobs` via API com token interno do worker
- [x] provisionar app `geomonitor-worker` no Fly
- [x] portar template base
- [x] staging temporario
- [x] KMZ com fotos

## etl-migracao

- [x] extract Firestore
- [x] sanitize
- [x] load Postgres
- [x] backfill de fotos para Tigris

## relatorio-composto

- [x] CRUD do relatorio composto
- [x] adicionar workspaces com UI web exposta
- [x] ordenar blocos com UI web exposta
- [x] preflight com UI web exposta
- [x] enfileirar geracao inicial com UI web exposta
- [x] gerar documento final no worker
- [x] smoke funcional em homologacao Postgres/Tigris via worker

## cutover-cleanup

- [x] virar `DATA_BACKEND=postgres`
- [x] virar `MEDIA_BACKEND=tigris`
- [x] ligar worker python
- [ ] remover dependencias operacionais de Firestore
