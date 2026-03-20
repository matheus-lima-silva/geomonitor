# CI/CD Fly.io Operational Checklist

## Status

- Implementado no repositorio:
  - workflow de CI estrito (`web-strict`, `api-strict`)
  - workflow de deploy Fly com gate por `ENABLE_FLY_DEPLOY`
  - workflow de deploy Fly forca politica de maquina unica (`count=1`) em `gru`
  - scripts `test:ci:strict` e `ci:web`
  - backlog de revisao de testes fechado (`DONE=47`)

- Pendente fora do repositorio (GitHub/Fly):
  - configurar branch protection da `main` com required checks:
    - `web-strict`
    - `api-strict`
  - cadastrar secrets do repositorio:
    - `FLY_API_TOKEN`
    - `VITE_FIREBASE_API_KEY`
    - `VITE_FIREBASE_AUTH_DOMAIN`
    - `VITE_FIREBASE_PROJECT_ID`
    - `VITE_FIREBASE_STORAGE_BUCKET`
    - `VITE_FIREBASE_MESSAGING_SENDER_ID`
    - `VITE_FIREBASE_APP_ID`
    - `VITE_FIREBASE_MEASUREMENT_ID`
    - `VITE_API_BASE_URL`
  - cadastrar repo variable:
    - `ENABLE_FLY_DEPLOY=false` (inicial)

## Cutover

1. Aguardar 3 execucoes verdes consecutivas em `main`.
2. Alterar `ENABLE_FLY_DEPLOY=true`.
3. Confirmar:
   - `https://geomonitor-api.fly.dev/health` responde 200.
   - `https://geomonitor-web.fly.dev/` responde HTTP OK.
   - `flyctl scale show -a geomonitor-api` mostra `COUNT 1`.
   - `flyctl scale show -a geomonitor-web` mostra `COUNT 1`.

## Politica de maquina unica

- API e Web devem operar com `COUNT 1` em `gru`.
- O workflow usa `flyctl deploy --ha=false` para evitar maquina extra em first deploy/scale-zero.
- O workflow reaplica `flyctl scale count 1` apos cada deploy para corrigir drift operacional.
- Remediacao manual, se necessario:
  - `flyctl scale count 1 --app geomonitor-api --region gru --yes`
  - `flyctl scale count 1 --app geomonitor-web --region gru --yes`
