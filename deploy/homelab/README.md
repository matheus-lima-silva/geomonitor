# GeoMonitor — deploy homelab (Proxmox + Tailscale)

Stack self-hosted: 1 VM Debian/Ubuntu no Proxmox com `docker compose` rodando todos os
servicos (api, worker, web, postgres, minio, caddy) e Tailscale para acesso TLS interno.

## Pre-requisitos

- VM no Proxmox: 2 vCPU, 4 GB RAM, 40 GB disco (Debian 12 ou Ubuntu 24.04 LTS).
- Docker Engine + Docker Compose v2 instalados.
- Tailscale instalado, autenticado, com **MagicDNS** e **HTTPS** habilitados na admin console.
- Nome da maquina na tailnet (algo como `geomonitor.tail-xxxx.ts.net`) — necessario antes do build.

## Setup inicial

```bash
# 1. Clone na VM e entre na pasta do compose
git clone <repo> /srv/geomonitor && cd /srv/geomonitor/deploy/homelab

# 2. Edite o .env com valores reais (hostnames Tailscale, senhas, JWT secrets)
$EDITOR .env

# 3. Marque o .env como skip-worktree para nao trackear suas edicoes
git update-index --skip-worktree .env

# 4. Crie a estrutura de dados (volumes bind)
mkdir -p data/postgres data/minio data/caddy/{data,config}

# 5. Suba o stack — primeira build leva alguns minutos
docker compose up -d --build

# 6. Acompanhe os logs ate ver "migrate" terminar e api/worker subirem
docker compose logs -f migrate api worker
```

## Expor via Tailscale

O Caddy escuta plain HTTP em `127.0.0.1:8080` (so o host alcanca). Tailscale termina TLS
para o mundo da tailnet:

```bash
# Roda uma vez; persiste entre reboots
sudo tailscale serve --bg --https=443 http://127.0.0.1:8080
sudo tailscale serve status   # confirma o mapping
```

A partir dai, qualquer dispositivo na sua tailnet abre `https://geomonitor.tail-xxxx.ts.net`.
TLS automatico, cert renovado pelo Tailscale.

## Sync de midia do Tigris (Fly) para o MinIO

Antes do cutover de DB, espelhe as fotos legadas:

```bash
# Instale rclone na VM (apt install rclone)
rclone config   # criar dois remotes: 'tigris' (creds atuais da Fly) e 'minio' (local)
# Configuracao do remote minio:
#   type: s3
#   provider: Minio
#   access_key_id: <MINIO_ROOT_USER ou service account>
#   secret_access_key: <MINIO_ROOT_PASSWORD>
#   endpoint: http://127.0.0.1:9000   # so funciona se publicar a porta do minio temporariamente
# OU rode rclone dentro do container minio-init.

rclone sync tigris:<bucket-fly> minio:geomonitor-media --progress
```

Rode incremental varias vezes ate o cutover; a ultima passada deve ser dentro da janela de
manutencao para nao perder uploads novos.

## Cutover de Postgres (janela ~30 min)

Estrategia: dump completo (schema + dados) da Fly, restore num Postgres **vazio** no
homelab. O servico `migrate` so roda **depois** do restore — como `schema_migrations` ja
vem com os checksums no dump, ele apenas verifica e sai sem aplicar nada.

```bash
# 1. Na primeira subida: levante so postgres + minio, SEM api/worker/migrate
docker compose up -d postgres minio minio-init

# 2. Desliga writes na Fly (laptop)
fly scale count 0 -a geomonitor-api
fly scale count 0 -a geomonitor-worker

# 3. Dump completo da Fly (laptop)
fly proxy 15432:5432 -a geomonitor-pg &
pg_dump --format=custom --no-owner --no-acl \
  "postgres://postgres:<senha>@localhost:15432/geomonitor" \
  -f geomonitor.dump

# 4. Copia dump para a VM e restaura no Postgres vazio
scp geomonitor.dump geomonitor:/tmp/
ssh geomonitor 'docker compose -f /srv/geomonitor/deploy/homelab/docker-compose.yml \
  exec -T postgres pg_restore --no-owner --no-acl --clean --if-exists \
  -U $POSTGRES_USER -d $POSTGRES_DB' < /tmp/geomonitor.dump

# 5. Sync final do rclone
rclone sync tigris:<bucket-fly> minio:geomonitor-media

# 6. Sobe api + worker (migrate vai validar checksums e sair sem aplicar nada)
docker compose up -d

# 7. Smoke test
curl https://geomonitor.tail-xxxx.ts.net/api/health
# Abra a SPA e teste login, criacao de vistoria, upload de foto, geracao de DOCX.

# 8. Avise os usuarios da nova URL.
```

Mantenha a Fly desligada (sem deletar) por 1-2 semanas como rollback.

## Operacao do dia-a-dia

```bash
# Restart de um servico apos mudanca de config
docker compose up -d --build api

# Ver logs
docker compose logs -f api
docker compose logs --tail=200 worker

# Aplicar migrations novas (apos pull com migrations adicionadas)
docker compose run --rm migrate

# Snapshot rapido do DB para backup offsite
docker compose exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB \
  | gzip > backups/$(date +%F)-geomonitor.sql.gz
```

## Backup recomendado

- **Snapshot ZFS diario** do dataset que monta `/srv/geomonitor/data/` (Postgres + MinIO).
- **pg_dump semanal** copiado para outro disco / nuvem (resiliencia contra corrupcao logica).
- Testar restore a cada trimestre.

## Atualizar o stack

```bash
cd /srv/geomonitor
git pull
cd deploy/homelab
docker compose up -d --build      # rebuilds afetados sao detectados; nao-afetados continuam
docker compose run --rm migrate   # se houver migration nova
```

## Troubleshooting

| Sintoma | Investigacao |
|---|---|
| `api` em loop crash | `docker compose logs api` — geralmente falta env (JWT_SECRET, DATABASE_URL) ou DB nao alcancavel |
| Signed URL retorna 404 no browser | Confirmar Caddyfile esta roteando `/<BUCKET_NAME>/*` para minio; confirmar `MEDIA_PUBLIC_ENDPOINT` aponta para o Caddy publico |
| Worker nao pega job | `docker compose logs worker` — verificar `WORKER_API_TOKEN` igual entre api e worker, `GEOMONITOR_API_URL=http://api:8080` |
| Tailscale Serve volta a 502 | `tailscale serve status` — confirmar mapping para `http://127.0.0.1:8080`; ver se Caddy esta up (`docker compose ps caddy`) |
| `migrate` falha em "wal_level" | Postgres recem criado precisa de `docker compose down postgres` e remover `data/postgres/` para resetar (so na primeira subida) |
