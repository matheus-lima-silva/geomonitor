# CI/CD Homelab Operational Checklist

Stack self-hosted em Proxmox + Tailscale. Workflow `homelab-deploy.yml` roda em todo push pra `main` e pode ser disparado manualmente via `gh workflow run homelab-deploy`.

## Pipeline

1. **Gate de testes** (jobs `test-web` e `test-backend`): Vitest + Jest. Falha aqui aborta o deploy.
2. **Connect to Tailscale**: action `tailscale/github-action@v3` registra o runner como nó efêmero da tailnet via OAuth (`TS_OAUTH_CLIENT_ID` + `TS_OAUTH_SECRET`).
3. **Resolve VM Tailscale IP**: `sudo tailscale ip -4 geomonitor` (com retry até 20s; bypassa MagicDNS que não popula `/etc/resolv.conf` do runner).
4. **Configure SSH**: monta `~/.ssh/deploy_key` + `~/.ssh/known_hosts` (entry com o IP resolvido).
5. **Pull latest code on the VM**: `ssh deploy@<IP> "cd /srv/geomonitor && git fetch origin && git checkout ${{ github.ref_name }} && git reset --hard origin/${{ github.ref_name }}"`.
6. **Build and restart stack**: `cd deploy/homelab && docker compose up -d --build`.
7. **Run migrations**: `docker compose run --rm migrate` (idempotente; pula migrations com checksum já registrado).
8. **Health check**: `curl -fsS http://127.0.0.1:8080/health`.
9. **Show containers state**: `docker compose ps` (sempre roda, mesmo em falha).

## Secrets e variables do repositorio

Cadastrar em https://github.com/matheus-lima-silva/geomonitor/settings/secrets/actions e https://github.com/matheus-lima-silva/geomonitor/settings/variables/actions.

| Tipo | Nome | Descricao |
|---|---|---|
| Secret | `TS_OAUTH_CLIENT_ID` | Client ID do OAuth client Tailscale (scope `Auth Keys: Write`, tag `tag:ci`) |
| Secret | `TS_OAUTH_SECRET` | Client Secret do mesmo OAuth client |
| Secret | `DEPLOY_SSH_KEY` | Chave privada ed25519 do user `deploy` na VM (gerada em `/home/deploy/.ssh/id_ed25519`) |
| Secret | `DEPLOY_KNOWN_HOSTS` | Fingerprint ed25519 da VM (saída de `ssh-keyscan -t ed25519 geomonitor.tail4ac97b.ts.net`) |
| Variable | `ENABLE_HOMELAB_DEPLOY` | `true` pra habilitar o job deploy. Sem isso, só os test gates rodam. |

## Tailnet ACL

Em https://login.tailscale.com/admin/acls/file garantir:

```jsonc
"tagOwners": {
  "tag:ci": ["autogroup:admin"],
},
```

A tag `tag:ci` é aplicada aos nós efêmeros criados pela action a cada run.

## Pre-requisitos na VM (`geomonitor.tail4ac97b.ts.net`)

- User `deploy` com grupo `docker` (sem sudo necessário).
- `/srv/geomonitor` clonado e ownership `deploy:docker`.
- Dados em `/srv/geomonitor/deploy/homelab/data/{postgres,minio,caddy}/` com owner UID 70 para `postgres/` (postgres alpine roda como UID 70).
- `tailscale up --ssh=false` (Tailscale SSH desligado pra OpenSSH responder na porta 22).
- `tailscale serve` **desligado** (`tailscale serve reset`) — o Caddy agora e dono de 80/443 na interface Tailscale. TLS para `geo.lima.rio.br` e emitido pelo proprio Caddy via Let's Encrypt DNS-01 (Cloudflare); ver `deploy/homelab/README.md`.

## Smoke pós-deploy

```bash
curl -fsS https://geo.lima.rio.br/health
# Esperado: {"status":"ok","service":"geomonitor-api"}
# (o pipeline de CI valida o health interno via curl http://127.0.0.1:8080/health na VM)
```

E no browser: login + listagem de projetos + download de DOCX gerado.

## Troubleshooting

| Sintoma | Investigacao |
|---|---|
| `Status: 403, Message: "calling actor does not have enough permissions"` no Tailscale up | OAuth client criado sem scope `Auth Keys: Write`. Recriar o client com o scope correto. |
| `Could not resolve hostname geomonitor.tail4ac97b.ts.net` no SSH | MagicDNS não populando resolv.conf do runner. O workflow já contorna usando `tailscale ip -4 geomonitor`. Se ainda falhar, conferir se a tag `tag:ci` está na ACL como `tagOwners`. |
| `SignatureDoesNotMatch` (400/403) no download de DOCX/foto via browser | Caddy não está estripando `Authorization` ou reescrevendo `Host: minio:9000` no `handle /<BUCKET_NAME>/*`. Conferir [deploy/homelab/Caddyfile](../../deploy/homelab/Caddyfile). |
| `could not open file "global/pg_filenode.map": Permission denied` no postgres | Ownership de `data/postgres/` mudou (alguém rodou `chown` recursivo). Restaurar com `sudo chown -R 70:70 /srv/geomonitor/deploy/homelab/data/postgres`. |
| Job `migrate` falha em CI mas a app roda OK | Migration script é idempotente — geralmente race condition de healthcheck. Re-run do workflow resolve. |

## Rollback

A Fly.io foi destruída em maio/2026 (ver [plano de migração](../../.claude/plans/quero-migrar-meu-sistema-luminous-balloon.md)). Não há rollback automático.

Pra reverter uma deploy ruim:
1. `gh run list --workflow homelab-deploy --limit 5` pra achar o último commit verde.
2. `git revert <commit-ruim>` e push.
3. Workflow dispara de novo e restaura o estado anterior.

Ou na própria VM, manualmente:
```bash
ssh deploy@geomonitor.tail4ac97b.ts.net
cd /srv/geomonitor && git checkout <commit-anterior>
cd deploy/homelab && docker compose up -d --build
```
