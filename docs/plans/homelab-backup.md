# Estrategia de backup do homelab GeoMonitor

Plano de backup e restore para o stack self-hosted (Proxmox + 1 VM Debian + Docker Compose) descrito em [deploy/homelab/docker-compose.yml](../../deploy/homelab/docker-compose.yml) e [docs/testing/ci-cd-homelab-ops.md](../testing/ci-cd-homelab-ops.md). Substitui a secao "Backup recomendado" do README do deploy, que hoje e so uma intencao.

## Inventario do que precisa de backup

| Item | Onde mora | Criticidade | Re-derivavel? |
|---|---|---|---|
| Banco `geomonitor` (Postgres 16) | bind mount `/srv/geomonitor/deploy/homelab/data/postgres/` | Critica | Nao |
| Credenciais de auth (tabelas `users`, `refresh_tokens`, `password_reset_tokens` no mesmo DB) | idem | Critica | Nao (bcrypt hashes nao recuperaveis) |
| Bucket MinIO `${BUCKET_NAME}` (fotos de vistoria, DOCX gerados) | bind mount `/srv/geomonitor/deploy/homelab/data/minio/` | Alta | Nao (uploads originais de usuario) |
| `.env` do compose (JWT secrets, senhas, MinIO root, tokens worker) | `/srv/geomonitor/deploy/homelab/.env` | Critica | Parcial (perde-se sessoes ativas se rotacionar JWT) |
| `Caddyfile` + certs Caddy | mesmo bind mount; certs sao renovaveis | Baixa | Sim (Caddy reemite) |
| Estado do Tailscale na VM | `/var/lib/tailscale/` | Baixa | Sim (reautenticar) |

**Acao de medicao (Fase 0):** rodar `du -sh /srv/geomonitor/deploy/homelab/data/{postgres,minio}` na VM e registrar baseline. Estimativa inicial sem medir: Postgres < 1 GB no primeiro ano; MinIO cresce ~linear com fotos (vistoria media ~20 fotos x 2 MB = 40 MB; estimar volume mensal e revisar retencao de offsite em 90 dias).

## Estrategia 3-2-1 ajustada

- **1 copia viva**: dados em producao na VM.
- **1 copia local rapida (ZFS snapshot)**: recuperacao em segundos para rollback de deploy ou erro humano. Crash-consistent, fica no mesmo pool.
- **1 copia offsite logica (pg_dump cifrado + mirror MinIO)**: protege contra perda da VM/pool inteiro e contra corrupcao logica que um snapshot ZFS apenas perpetuaria.

Por que essa combinacao: snapshot ZFS sozinho falha em corrupcao logica (DELETE acidental se propaga em todas as snapshots feitas depois). pg_dump sozinho tem RPO grande (24h) e RTO alto (re-importar GB demora). Os dois juntos cobrem ambos os modos de falha.

## Componente A — Snapshots ZFS locais

**Pre-requisito:** os bind mounts `/srv/geomonitor/deploy/homelab/data/` precisam morar em um dataset ZFS dedicado. Se a VM hoje usa ext4 em virtio-disk, mover para um dataset ZFS-on-Linux dentro da VM **ou** mover o dataset para o host Proxmox e expor via virtio. Recomendado: ZFS no **host Proxmox**, snapshot via `zfs snapshot` do dataset que contem o disco da VM — mais robusto que ZFS-on-Linux dentro da VM e nao consome RAM da VM com ARC.

**Ferramenta:** [sanoid](https://github.com/jimsalterjrs/sanoid). Cron manual e fragil; `zfs-auto-snapshot` esta desatualizado; sanoid e o padrao defacto, declara cadencia + retencao em `/etc/sanoid/sanoid.conf` e ja vem com `syncoid` para envio replicado se um dia houver segundo host.

**Cadencia e retencao** (em `sanoid.conf`):

```
[geomonitor-data]
  use_template = production
  recursive = yes

[template_production]
  hourly = 24
  daily  = 30
  weekly = 12
  monthly = 6
  autosnap = yes
  autoprune = yes
```

24h horarios + 30 diarios + 12 semanais + 6 mensais. Roda como cron de 1 em 1 minuto (`sanoid --cron`).

**Caveat critico:** snapshot ZFS enquanto o Postgres roda e **crash-consistent**, nao logico. Em restore, Postgres parte como se tivesse sofrido kill -9 e replaya WAL. Funciona 99% das vezes, mas nao protege contra corrupcao logica. Por isso o Componente B existe.

**Acao opcional (deixar para depois):** hook `pre-snapshot` rodando `pg_backup_start()` para snapshot consistente. Complexidade extra que so vale se aparecerem falhas reais de replay.

## Componente B — pg_dump diario com upload offsite

**Script:** `scripts/backup/pg_dump_offsite.sh` na VM, owner `deploy:docker`, modo 700.

Fluxo:
1. `docker compose exec -T postgres pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB" > /tmp/dump.pgcustom`
2. `gpg --batch --yes --encrypt --recipient backup@geomonitor /tmp/dump.pgcustom -o /tmp/dump.pgcustom.gpg`
3. `rclone copyto /tmp/dump.pgcustom.gpg offsite:geomonitor-db-backups/$(date -u +%Y/%m/%d)/geomonitor-$(date -u +%Y%m%dT%H%M%SZ).pgcustom.gpg`
4. Cleanup `/tmp/dump.*`.
5. Log estruturado em `/var/log/geomonitor-backup/pg_dump.log` (uma linha JSON por execucao: timestamp, exit code, tamanho, duracao).

**Cron:** `0 3 * * * deploy /srv/geomonitor/scripts/backup/pg_dump_offsite.sh` (03:00 UTC, fora do pico).

**Frequencia:** diaria. O banco e pequeno e diaria + ZFS horario cobre RPO de ~1h para perda de VM e ~24h para corrupcao logica detectada tarde.

**Offsite escolhido: Backblaze B2.**
- Egress: B2 cobra ~$0.01/GB. R2 (Cloudflare) tem egress gratis mas storage 50% mais caro.
- Para esse volume (dumps < 500 MB cifrados, GB-mes na ordem de centavos), B2 sai mais barato porque storage domina.
- R2 ganharia se houvesse restore frequente; restore de DR e raro.
- Decisao: B2. Bucket `geomonitor-db-backups`, lifecycle policy "delete after 90 days" no lado do bucket como rede de seguranca.

**Retencao logica (lado cliente):** 30 dailies + 12 monthlies. Implementar via script de cleanup mensal que lista o bucket e deleta o que esta fora da politica (mais simples que confiar so no lifecycle do bucket porque queremos preservar mensais alem de 90 dias).

**Credenciais:** chaves rclone em `/home/deploy/.config/rclone/rclone.conf` (mode 600). Chave GPG publica somente para encriptar fica na VM; chave privada para decriptar fica **fora da VM** (cofre offline + copia no 1Password do operador). Sem a privada, ninguem decifra os dumps mesmo com root na VM.

## Componente C — Mirror do bucket MinIO

As midias **nao sao re-derivaveis**: sao fotos originais de vistoria. Backup obrigatorio.

**Ferramenta:** `mc mirror --watch` ou `rclone sync` agendado. Recomendado: `rclone sync minio:${BUCKET_NAME} offsite:geomonitor-media-mirror --transfers=4 --checksum` em cron diario as 03:30 UTC (apos pg_dump, para nao competirem por banda). `--checksum` evita reenvio de objetos identicos.

**Retencao:** politica de versionamento no bucket B2 destino com retencao de 30 dias para versoes deletadas. Protege contra delete acidental propagado pelo sync.

**Bucket destino:** `geomonitor-media-mirror` no mesmo B2. Lifecycle: keep current + 30 dias de versoes nao-correntes.

**Custo previsto** (estimar quando tiver baseline em Fase 0): se MinIO crescer 5 GB/mes, em 12 meses sao 60 GB x $0.005 = $0.30/mes. Desprezivel.

## Componente D — Restore drill mensal

Backup sem teste de restore nao e backup. Script `scripts/backup/restore_drill.sh` que:

1. Baixa o dump mais recente do B2 com `rclone copy`.
2. Decifra com `gpg --decrypt` (chave privada precisa estar disponivel em ambiente isolado — drill roda em laptop do operador, **nao** na VM de producao).
3. Sobe um Postgres 16 ephemeral via `docker run --rm postgis/postgis:16-3.4` em porta alta. **Precisa ser PostGIS** (nao `postgres:16-alpine`): o dump contem a extensao postgis e colunas `geography`; restaurar em Postgres sem PostGIS falha com `type "geography" does not exist`.
4. `pg_restore --clean --if-exists -d "$EPHEMERAL_URL" dump.pgcustom`.
5. Sobe o backend tambem ephemeral apontando `DATABASE_URL` para esse Postgres com MinIO mockado (variavel `MEDIA_BACKEND=memory` se existir, ou um MinIO ephemeral vazio).
6. Bate `curl -fsS http://localhost:<porta>/api/health` e verifica 200.
7. Roda smoke query: `SELECT count(*) FROM users; SELECT count(*) FROM inspections;` — valor > 0 esperado.
8. Tear down. Saida JSON `{ "drill_ok": true, "dump_age_hours": N, "rows_users": N, "rows_inspections": N }`.

**Cadencia:** mensal, dia 1, manual (o operador roda no laptop). Resultado registrado em `docs/operacao/restore-drills.md` (append-only, 1 linha por drill). Drill falhado vira issue P0.

Por que mensal e nao automatizado: a chave GPG privada nao pode viver na VM. Automatizar exigiria runner separado com vault. Mensal manual e proporcional ao risco do homelab.

## Plano por fases

Cada fase deployavel sozinha, na ordem (rapido -> mais critico):

**Fase 0 — Baseline e dataset ZFS** (1 dia)
- Medir `du -sh` dos bind mounts. Registrar em `docs/operacao/backup-baseline.md`.
- Se ainda nao for ZFS, planejar migracao do disco da VM para dataset ZFS no host Proxmox. **Bloqueante** para Fase 1. Janela ~1h com stack parado.

**Fase 1 — Snapshots ZFS via sanoid** (meio dia)
- Instalar sanoid no host Proxmox.
- Configurar `/etc/sanoid/sanoid.conf` com template `production`.
- Cron `* * * * * root /usr/sbin/sanoid --cron`.
- Verificar: `zfs list -t snapshot | grep geomonitor` mostra primeiro snapshot horario apos 1h.

**Fase 2 — pg_dump local + cron** (meio dia)
- Criar `scripts/backup/pg_dump_offsite.sh` em modo "dry-run offsite" (apenas dump local em `/srv/geomonitor/backups/`).
- Cron diario 03:00 UTC.
- Validar 2 noites: dump aparece, gzip < 500 MB, log JSON ok.

**Fase 3 — Upload offsite cifrado** (1 dia)
- Gerar par GPG `backup@geomonitor`. Chave privada para offline + 1Password do operador. Publica fica na VM.
- Criar conta B2, bucket `geomonitor-db-backups`, app key com escopo so nesse bucket.
- Configurar rclone na VM (`/home/deploy/.config/rclone/rclone.conf` mode 600).
- Habilitar upload no script. Validar 2 noites consecutivas.
- Adicionar cleanup script de retencao (30 dailies + 12 monthlies).

**Fase 4 — Mirror MinIO offsite** (meio dia)
- Bucket B2 `geomonitor-media-mirror` com versionamento.
- Cron rclone sync diario 03:30 UTC.
- Validar tamanho transferido na primeira corrida == baseline medido na Fase 0.

**Fase 5 — Restore drill mensal** (1 dia)
- Escrever `scripts/backup/restore_drill.sh` (roda no laptop, nao na VM).
- Documentar procedimento em `docs/operacao/restore-drills.md`.
- Executar primeira drill end-to-end. Registrar duracao real (define RTO observado).

**Fase 6 — Alerta de falha** (meio dia)
- Cada script faz `curl -fsS https://hc-ping.com/<uuid>` no sucesso. [healthchecks.io](https://healthchecks.io) free tier alerta quando o ping nao chega.
- 3 checks: `pg-dump-daily`, `minio-mirror-daily`, `restore-drill-monthly`.
- Notificacao por email + Telegram para o operador.

## Riscos e mitigacoes

| Risco | Mitigacao |
|---|---|
| Chave GPG privada vaza | Privada nunca toca a VM. Vive em cofre offline + 1Password. Publica e o que fica em producao. |
| Credencial rclone vaza no git | `.gitignore` da `scripts/backup/*.conf` e `*.env`. App key B2 com escopo apenas no bucket de backup; nao acessa producao. |
| Snapshots enchem o pool ZFS | sanoid `autoprune = yes` + monitoring de `zpool list -H -o capacity` com alerta em 80%. |
| Restore drill quebra silenciosamente | healthchecks.io alerta se o drill mensal nao pingar; falha do drill envia exit code != 0 -> nao pinga -> alerta. |
| Custo egress no restore real de DR | Aceitar. Restore completo de 60 GB em B2 ~ $0.60. Trivial. |
| Backup roda durante deploy e pega DB inconsistente | pg_dump e MVCC-consistente por design. ZFS snapshot e crash-consistent; coincidir com deploy nao piora isso. Sem acao. |
| MinIO mirror replica um delete malicioso | Versionamento + retencao de 30 dias no bucket destino permite recuperar versao anterior do objeto. |
| Operador perde a chave GPG privada | Backup da chave em 2 locais offline distintos (cofre fisico + cofre digital). Sem ela, dumps cifrados sao lixo. |

## Fora de escopo declarado

- **PITR completo via WAL archiving** (archive_command + pgbarman/wal-g). Overkill para um homelab single-user; complexidade de operar nao justifica granularidade < 24h.
- **Backup do host Proxmox em si** (config do hypervisor, outras VMs). Responsabilidade do operador do homelab, fora desta aplicacao.
- **Backup de logs do backend/worker.** Logs vivem em journald/docker logs e nao sao reconstrucao de estado.
- **Replicacao sincrona para segunda VM.** Sem segundo host. Se um dia houver, `syncoid` replica os datasets ZFS sem mudar este plano.
- **Disaster recovery cross-region automatizado.** Restore de DR e procedimento manual documentado, nao automatico.

> Plano elaborado em 2026-05-26.
