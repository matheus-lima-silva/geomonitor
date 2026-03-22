# Fly Bootstrap Layout

Configuracoes canonicas do Fly.io para esta frente:

- `deploy/fly/homologacao/web.toml`
- `deploy/fly/homologacao/api.toml`
- `deploy/fly/homologacao/worker.toml`
- `deploy/fly/producao/web.toml`
- `deploy/fly/producao/api.toml`
- `deploy/fly/producao/worker.toml`

## Estrategia por ambiente

- `homologacao`
  - `geomonitor-web-hml`
  - `geomonitor-api-hml`
  - `geomonitor-worker-hml`
- `producao`
  - `geomonitor-web`
  - `geomonitor-api`
  - `geomonitor-worker`

## Segredos por app

- `geomonitor-api*`
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - `DATABASE_URL`
  - `DATA_BACKEND`
  - `MEDIA_BACKEND`
  - `REPORT_EXECUTION_BACKEND`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
  - `AWS_ENDPOINT_URL_S3`
  - `BUCKET_NAME`
- `geomonitor-worker*`
  - `DATABASE_URL`
  - `REPORT_EXECUTION_BACKEND`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
  - `AWS_ENDPOINT_URL_S3`
  - `BUCKET_NAME`
- `geomonitor-web*`
  - sem runtime secrets obrigatorios nesta fase; o build usa `VITE_*` versionados no TOML

## Scripts auxiliares

- `scripts/fly/bootstrap.ps1`
  - gera o playbook operacional de criacao de apps, banco, bucket e secrets
- `scripts/fly/deploy.ps1`
  - executa deploy de `web`, `api` e `worker` com os TOMLs canonicos

## Compatibilidade

Os arquivos `fly.toml` na raiz e em `backend/` permanecem por compatibilidade com o fluxo antigo, mas a referencia oficial desta frente passa a ser `deploy/fly/...`.
