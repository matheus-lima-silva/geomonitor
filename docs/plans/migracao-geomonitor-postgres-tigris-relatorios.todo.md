# TODO - Migracao GeoMonitor + GeoRelat + Tigris

## infra/schema

- [x] adicionar abstractions para backend nao-Firestore
- [x] preparar migracoes SQL versionadas
- [x] modelar entidades alvo no backend
- [x] abrir `postgresStore` e migracoes iniciais por flag
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
- [ ] usar `mediaAssetRepository` na trilha completa de curadoria/exportacao/geracao

## workspace-curadoria

- [x] stepper do workspace
- [x] selecao obrigatoria de empreendimento
- [x] entrada de importacao em tres modos no frontend (`fotos soltas`, `subpastas por torre` e registro de `KMZ organizado`)
- [x] importacao inicial de `fotos soltas` com upload real de media
- [x] curadoria minima com legenda, torre e inclusao
- [x] tooltips operacionais
- [x] autosave persistido de rascunho do workspace

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

- [ ] secao de relatorios na administracao
- [ ] lista de versoes
- [ ] ativacao de template

## worker-python

- [x] criar scaffold bootstrap do app `geomonitor-worker`
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
