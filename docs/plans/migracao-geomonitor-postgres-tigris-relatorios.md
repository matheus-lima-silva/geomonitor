# Migracao GeoMonitor + GeoRelat + Tigris + Saida do Firestore

## Objetivo

Convergir o modulo de relatorios do ecossistema GeoUnificado para dentro do GeoMonitor web, remover a dependencia operacional de Firestore, preparar a troca para Postgres + Tigris e abrir a trilha de worker Python para geracao de artefatos.

## Decisoes Fechadas

- `Firebase Auth` permanece nesta fase.
- Dados operacionais migram para `Postgres`.
- Imagens, templates override e DOCX finais ficam em `Tigris`.
- Acesso a dados sera por `SQL + repositorios`, sem ORM.
- Geracao de DOCX e KMZ sera feita por worker Python separado no Fly.
- O provisionamento da infra de deploy no Fly via `flyctl` faz parte desta frente e nao fica implícito.
- `workspace` pertence a um unico empreendimento.
- Documentos com um ou mais empreendimentos usam `relatorio composto`.
- O sistema tera:
  - `Workspaces`
  - `Biblioteca do Empreendimento`
  - `Dossie do Empreendimento`
  - `Relatorios Compostos`
- Tooltips sao obrigatorios nos pontos de ambiguidade operacional.
- Todas as novas rotas devem seguir HATEOAS.

## Fluxo Funcional

### Workspace

1. Usuario escolhe um empreendimento.
2. Cria um workspace vinculado a esse empreendimento.
3. Importa fotos por upload solto, subpastas por torre ou KMZ organizado.
4. Sistema organiza e sugere vinculos.
5. Usuario faz curadoria, legenda e inclusao.
6. Usuario edita textos, roda preflight e gera o DOCX.
7. KMZ de conferencia com fotos pode ser gerado sob demanda como artefato efemero.

### Biblioteca do Empreendimento

1. Usuario escolhe um empreendimento.
2. Visualiza todas as fotos cruzadas do empreendimento.
3. Filtra por workspace, torre, data, legenda e origem.
4. Faz download total ou parcial em ZIP efemero.

### Dossie do Empreendimento

1. Usuario escolhe um empreendimento.
2. Cria um dossie com escopo editorial.
3. Consolida dados de projeto, licencas, inspecoes, erosoes, entregas e fotos.
4. Roda preflight e gera DOCX.

### Relatorio Composto

1. Usuario cria um relatorio composto.
2. Seleciona workspaces de um ou mais empreendimentos.
3. Define a ordem dos blocos e os textos globais.
4. Roda preflight e gera o documento final.

## Regras Espaciais

- Faixa e definida por buffer do eixo da LT, nao por proximidade simples de torre.
- Buffer padrao inicial: `200 m` por lado, configuravel por empreendimento.
- Sugestao automatica de torre: `300 m`.
- Foto pode ser vinculada manualmente a qualquer torre do empreendimento, mesmo fora do raio.
- KMZ e apoio visual de conferencia, nao definidor da faixa.

## KMZ

- KMZ gerado deve incluir as fotos.
- KMZ gerado e efemero e nao deve ser persistido em storage duravel.
- O sistema tambem aceita KMZ de entrada com fotos ja organizadas.
- Regra de interpretacao da torre no KMZ:
  - usar a subpasta mais interna que contem a foto e casa com o padrao esperado;
  - se nao casar, subir para a pasta pai valida mais proxima;
  - se nenhuma casar, marcar como pendente de vinculacao;
  - nome do placemark entra apenas como sugestao secundaria.

## Persistencia

- Ha persistencia de rascunho para workspace, dossie e relatorio composto.
- Fonte de verdade do rascunho: backend.
- Cache local no navegador existe apenas como camada de protecao.

## Arquitetura Alvo

- Apps Fly:
  - `geomonitor-web`
  - `geomonitor-api`
  - `geomonitor-worker`
- Backend Node:
  - rotas HATEOAS
  - camada de repositorios
  - autenticacao via Firebase Admin
  - orquestracao de jobs
- Worker Python:
  - staging temporario em `/tmp`
  - reaproveitamento de logica GeoRelat/GeoPic
  - geracao de DOCX/KMZ/ZIP efemero
- Postgres:
  - dados operacionais, rascunhos, metadata, filas
- Tigris:
  - fotos, templates override e artefatos finais persistidos

## Provisionamento Flyctl

- Esta frente inclui o provisionamento operacional necessario para deploy via `flyctl`.
- A referencia canonica de configuracao do Fly fica versionada em:
  - `deploy/fly/homologacao/*.toml`
  - `deploy/fly/producao/*.toml`
- O repositorio tambem passa a manter scripts de apoio para bootstrap e deploy em:
  - `scripts/fly/bootstrap.ps1`
  - `scripts/fly/deploy.ps1`
- O provisionamento deve cobrir, no minimo:
  - criacao ou alinhamento dos apps `geomonitor-web`, `geomonitor-api` e `geomonitor-worker`;
  - criacao do banco `Managed Postgres` do ambiente;
  - criacao e vinculacao do bucket `Tigris`;
  - configuracao de secrets e variaveis de ambiente;
  - definicao de regiao primaria, checks de health e politica basica de escala;
  - publicacao inicial de homologacao;
  - playbook de promote para producao.
- Entregaveis esperados dessa etapa:
  - arquivos de configuracao do Fly versionados no repositorio;
  - checklist operacional de bootstrap e update;
  - mapeamento claro de secrets por app;
  - validacao de deploy com healthcheck verde.
- Secrets minimos previstos:
  - credenciais Firebase Admin;
  - `DATABASE_URL` e derivados do Postgres;
  - credenciais/acesso do Tigris;
  - flags de backend (`DATA_BACKEND`, `MEDIA_BACKEND`, `REPORT_EXECUTION_BACKEND`);
  - qualquer chave de assinatura temporaria usada pelos artefatos.
- Ambientes previstos:
  - `homologacao`, para ensaio de migracao e validacao funcional;
  - `producao`, para o cutover final.

## Macroetapas

1. `infra/schema`
2. `repositorios-api`
3. `fly-bootstrap-deploy`
4. `media-tigris`
5. `workspace-curadoria`
6. `photo-library`
7. `project-dossier`
8. `templates-admin`
9. `worker-python`
10. `etl-migracao`
11. `relatorio-composto`
12. `cutover-cleanup`

## UX

- Fluxo em stepper para workspace.
- Curadoria em layout de duas colunas no desktop.
- Barra persistente de resumo de fotos.
- Badges de origem do vinculo de torre.
- Biblioteca do empreendimento em modo asset library.
- Builder simples para dossie.
- Drag and drop para relatorio composto.
- Tooltips nos pontos criticos.

## Branch

- Branch oficial da frente: `codex/migracao-geomonitor-postgres-tigris-relatorios`
