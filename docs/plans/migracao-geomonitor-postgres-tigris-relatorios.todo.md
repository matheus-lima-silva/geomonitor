# TODO - Migracao GeoMonitor + GeoRelat + Tigris

## infra/schema

- [x] adicionar abstractions para backend nao-Firestore
- [x] preparar migracoes SQL versionadas
- [x] modelar entidades alvo no backend
- [x] abrir `postgresStore` e migracoes iniciais por flag
- [x] migrar `rules.js` de `getDocRef` direto para `rulesConfigRepository`
- [x] migrar `reports.js` de `getDataStore` para `reportJobRepository` + fallback legado
- [x] remover fallback de store do `crudFactory`
- [x] isolar leitura legada de `reports` em `legacyReportRepository`
- [ ] remover o `document_store` generico remanescente das areas novas e dos dominios base

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
- [ ] expandir cobertura e ajustes finais dos repositorios base em modo Postgres real

## fly-bootstrap-deploy

- [x] versionar configuracoes do Fly para `geomonitor-web`, `geomonitor-api` e `geomonitor-worker`
- [x] definir estrategia de apps por ambiente (`homologacao` e `producao`)
- [ ] provisionar `Managed Postgres` do ambiente alvo
- [ ] provisionar bucket `Tigris` e vincular ao app
- [x] mapear e documentar secrets por app
- [x] configurar healthchecks, regiao primaria e escala inicial
- [ ] validar deploy inicial em homologacao via `flyctl`
- [x] documentar promote para producao

## media-tigris

- [x] manter `media` local como fallback
- [x] preparar contratos para signed URLs
- [x] preparar shape de `media_assets`
- [x] plugar o frontend de relatorios no fluxo real de upload assinado
- [x] adicionar queries especializadas ao `mediaAssetRepository` para pipeline de geracao
- [ ] usar `mediaAssetRepository` na trilha completa de curadoria/exportacao/geracao

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
- [ ] validar preflight do dossie em Postgres real
- [ ] geracao de DOCX

## templates-admin

- [x] secao de relatorios na administracao
- [x] lista de versoes
- [x] ativacao de template

## worker-python

- [x] criar scaffold bootstrap do app `geomonitor-worker`
- [x] integrar consumo manual de `report-jobs` via API com token interno do worker
- [ ] provisionar app `geomonitor-worker` no Fly
- [ ] portar template base
- [ ] staging temporario
- [ ] KMZ com fotos

## etl-migracao

- [ ] extract Firestore
- [ ] sanitize
- [ ] load Postgres
- [ ] backfill de fotos para Tigris

## relatorio-composto

- [x] CRUD do relatorio composto
- [x] adicionar workspaces com UI web exposta
- [x] ordenar blocos com UI web exposta
- [x] preflight com UI web exposta
- [x] enfileirar geracao inicial com UI web exposta
- [ ] gerar documento final no worker

## cutover-cleanup

- [ ] virar `DATA_BACKEND=postgres`
- [ ] virar `MEDIA_BACKEND=tigris`
- [ ] ligar worker python
- [ ] remover dependencias operacionais de Firestore
