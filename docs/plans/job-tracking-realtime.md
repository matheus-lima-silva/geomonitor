# Tracking de jobs do worker em tempo real

## Estado atual

Quando o usuario clica "Gerar Relatorio" / "Enfileirar Geracao" em `CompoundsTab` ou `DossierTab`, o frontend chama `generateReportCompound` / `generateProjectDossier` (que cria a linha em `report_jobs` com `status_execucao='queued'` e dispara fire-and-forget `triggerWorkerRun` em `backend/utils/workerTrigger.js`). O handler em `ReportsView.handleCompoundGenerate` chama `refreshCompounds()` uma unica vez e mostra um toast "Geracao enfileirada". Dali em diante o `compound.status` no estado React congela em `queued`/`processing` ate o usuario sair e voltar para a aba — **nao ha polling, nao ha SSE, nao ha invalidacao automatica**. A unica reconciliacao entre o estado real do job e a tela e o reload manual. `reportJobRepository.markComplete`/`markFailed` sincronizam o parent (dossier ou compound) via `syncParentJobStatus`, mas essa atualizacao morre no Postgres ate o proximo GET.

## Comparativo das opcoes

| Criterio | Polling (frontend) | SSE | WebSocket |
|---|---|---|---|
| Latencia ate UI atualizar | 3-15s (intervalo) | <1s | <1s |
| Complexidade backend | Trivial (rota ja existe) | Media (1 rota nova, gerenciar clientes em memoria + heartbeat) | Alta (lib `ws`, upgrade handshake, auth no upgrade) |
| Complexidade frontend | Hook simples com `setInterval` | `EventSource` nativo, reconecta sozinho | Lib client, reconexao manual |
| Compat com Caddy (reverse proxy atual) | Trivial | OK — Caddy 2 nao bufera por default, mas `flush_interval -1` recomendado no `reverse_proxy` para forcar streaming | Precisa `Connection: Upgrade` passar; Caddy faz por padrao mas auth via header `X-Worker-Token`/JWT no upgrade complica |
| Compat Tailscale (`tailscale serve`) | Trivial | OK (HTTP/1.1 long-lived, ja usado por outras apps no tailnet) | OK porem mais sensivel a idle timeout do `tailscale serve` |
| Express 5 long-lived | Funciona; rotas curtas | Precisa setar `req.socket.setTimeout(0)` + `res.flushHeaders()` | Precisa servidor HTTP separado ou montar no mesmo (`server.on('upgrade')`) |
| Custo de conexao por usuario | 1 req cada N s | 1 conexao TCP aberta | 1 conexao TCP aberta + frames |
| Bidirecional | Nao precisa | Server->client OK (suficiente) | Sim (overkill aqui) |
| Recuperacao de estado apos reconexao | Trivial (proximo poll) | OK com `Last-Event-ID` | Manual |
| Volume previsto (homelab, 5-10 usuarios concorrentes, jobs raros) | Cabe folgado | Cabe folgado | Overkill |

## Recomendacao

**Polling adaptativo, com SSE como evolucao opcional**. Justificativa pelo codigo:

1. O volume e baixissimo — jobs sao acionados manualmente por 5-10 editores, raramente >1 por minuto.
2. Ja existe `GET /api/report-jobs/:id` e `GET /api/report-jobs` retornando envelope HATEOAS. **Nenhuma rota nova no backend** na fase inicial.
3. Polling cabe no padrao `fetchWithHateoas` documentado em `src/CLAUDE.md` sem violar nada.
4. SSE traz complexidade real (heartbeat, deteccao de cliente morto, `flush_interval` no Caddy, `req.socket.setTimeout(0)` no Express 5 para nao cair em 2min) sem ganho perceptivel nessa escala. Vale promover **somente se** aparecer dashboard de fila ou usuarios reclamarem de latencia de polling.

Polling com backoff (3s ativo -> 10s apos 30s sem mudanca -> para apos 5min ou job em estado terminal) cobre 100% dos casos atuais.

## Plano por fases

### Fase 1 — Backend: rota dedicada de status enxuto

Hoje `GET /api/report-jobs/:id` carrega o envelope completo (HATEOAS, `_links`, payload jsonb). Polling vai bater 5-20x por job — preferivel uma rota leve.

- **Opcao A (preferida)**: estender a rota existente. Aceitar `?fields=status` em `routes/reportJobs.js` que devolve so `{ id, statusExecucao, errorLog, outputDocxMediaId, outputKmzMediaId, updatedAt }`. Mantem HATEOAS no envelope mas com `data` reduzida. Doc: atualizar `docs/api-backend.md`.
- **Opcao B**: nova rota `GET /api/report-jobs/:id/status`. Mais limpa, custa entrada nova em `api-backend.md` e novo guard.

Decisao: **A** — menos superficie. Index ja existe (`id` PK). Sem migracao.

Teste novo em `backend/__tests__/integration/reportJobs.test.js` (criar se nao existir) cobrindo:
- 200 com payload reduzido quando `?fields=status`.
- 200 com payload cheio quando flag ausente (regressao).
- 404 para id inexistente.
- Guards: `verifyToken` + `requireActiveUser` ja existem.

### Fase 2 — Worker: nada a fazer (por enquanto)

O worker hoje ja escreve `updated_at` ao reivindicar (`claimNext` faz `UPDATE ... SET status_execucao='processing', updated_at=NOW()`) e ao concluir/falhar. Para polling isso basta. **Nao adicionar progresso parcial agora** (ex.: % de fichas renderizadas) — exige coluna nova em `report_jobs` (migration), mudanca no `worker/job_processor.py` para chamar uma rota `PATCH /api/report-jobs/:id/progress`, e so faz sentido se a UI for mostrar barra. Adiar para quando alguem pedir.

### Fase 3 — Frontend: hook de tracking

Criar `src/features/reports/hooks/useJobStatusPolling.js`:

- Assinatura: `useJobStatusPolling({ jobId, enabled, onComplete, onFailed })`.
- Estado interno: `{ status, errorLog, updatedAt }`.
- Polling: `setTimeout` recursivo (nao `setInterval` — evita pile-up). Intervalo inicial 3s, sobe para 10s apos 30s sem mudanca de `updatedAt`, para definitivamente quando `status in ('completed','failed')` ou apos 10min (timeout total — dispara `onFailed` com mensagem `Job sem resposta apos 10 minutos. Verifique o worker.`).
- Cleanup obrigatorio no `useEffect` retorno (cancelar timeout pendente).
- Visibility-aware: pausar quando `document.visibilityState === 'hidden'`, retomar no `visibilitychange`. Reduz trafego com aba minimizada.
- Usa `fetchWithHateoas` (montar URL via `_links.self` do compound/dossier que ja inclui o `lastJobId`) ou — mais direto — `fetch` direto na rota com `?fields=status`. Como nao ha link HATEOAS especifico para "status de job", criar helper em `src/services/reportJobService.js` (`getJobStatus(jobId)`).
- Teste co-locado em `__tests__/useJobStatusPolling.test.jsx` com `vi.useFakeTimers()` cobrindo: polling para em terminal, backoff aplicado, cleanup, callback de complete dispara refresh.

### Fase 4 — Frontend: integracao em Compound e Dossier

- `ReportsView.handleCompoundGenerate`: depois de `refreshCompounds()`, ler `savedCompound.lastJobId` e armazenar em estado `trackedJobs: Map<compoundId, jobId>`.
- Em `CompoundCard.jsx` e em `DossierTab.jsx`, consumir `useJobStatusPolling` quando `compound.statusExecucao in ('queued','processing')` (`isPendingExecutionStatus`).
- No `onComplete`: chamar `refreshCompounds()`/`refreshDossiers()` para puxar `outputDocxMediaId` atualizado e habilitar botao "Baixar DOCX"; mostrar toast `'Relatorio gerado. DOCX disponivel para download.'`.
- No `onFailed`: refresh + toast de erro com `errorLog`.
- Visual: substituir o badge estatico em `DossierTab.jsx:144` por um badge animado quando `processing` (icone `loader` ja existe em `AppIcon`). Sem novo primitive — usar `Badge` com `tone="warning"` + `<AppIcon name="loader" className="animate-spin w-3 h-3" />`.

Teste de integracao em `ReportsView.test.jsx`: mockar `getJobStatus` para retornar `processing -> completed`, avancar timers, assert que `refreshCompounds` e chamado e botao de download aparece.

### Fase 5 — Limpeza e docs

- Atualizar `docs/api-backend.md` com `?fields=status` em `report-jobs`.
- Atualizar `docs/modulo-reports.md` secao "Fluxo de job" descrevendo polling client-side.
- Atualizar `src/CLAUDE.md` proibindo `setInterval` direto em features — usar `useJobStatusPolling` para qualquer rastreio futuro de job assincrono (ex.: `workspace_kmz`).

## Riscos e mitigacoes

- **Polling explode em N janelas abertas**: cada aba abre seu proprio polling. Mitigacao: tab visibility check (Fase 3) + intervalo de 3s e baixo cardinality (1-2 jobs em tracking simultaneo). Se virar problema, mover para BroadcastChannel coordenando uma unica aba "lider".
- **Job stuck em processing**: ja existe `reclaimStuckJobs` (15 min default). Polling so observa — o reclaim cuida da fila. O `setTimeout` total de 10min do hook protege a UI; depois disso o usuario recebe instrucao de ver fila admin.
- **Caddy bufferizando**: nao se aplica a polling (so a SSE). Quando/se promover para SSE, adicionar `flush_interval -1` no bloco `handle /api/*` do `Caddyfile` e setar `res.flushHeaders()` + `req.socket.setTimeout(0)` no handler Express.
- **Tailscale `serve` timeout**: idem — so e risco em conexao long-lived. Polling fecha cada request em <100ms.
- **Contador de queries (middleware/queryCounter.js, threshold 15)**: GET de status faz 1 query. 20 polls/min = 0 risco de disparar `query_count_alert`.
- **Race entre `refreshCompounds()` apos enqueue e leitura inicial do hook**: garantir que `setBusy('')` so apos `refreshCompounds` retornar e o `lastJobId` estar no estado. Caso contrario o hook arranca com `enabled=false` e perde a primeira janela.
- **Auth**: `getJobStatus` usa o mesmo `Authorization: Bearer <JWT>` ja injetado por `apiClient.js`. Refresh token cuida da rolagem natural; em janela aberta por horas o `useAuth` ja trata 401.

## Metricas de sucesso

- Apos clique em "Gerar Relatorio", o badge muda de `queued` -> `processing` -> `completed` sem refresh manual em <15s da escrita real do worker.
- Botao "Baixar DOCX" habilita automaticamente quando job completa.
- Zero `setInterval` orfaos detectados em DevTools -> Performance -> Timers apos fechar aba.
- Painel admin `system_alerts` nao registra `query_count_alert` originado de rotas `/api/report-jobs/:id`.
- Teste `npm run test:ci:strict` passa com a nova suite do hook.
- Verificacao manual no homelab: abrir aba em `https://geomonitor.tail4ac97b.ts.net`, enfileirar dossier real, confirmar badge atualizando sem F5.

> Plano elaborado em 2026-05-26.
