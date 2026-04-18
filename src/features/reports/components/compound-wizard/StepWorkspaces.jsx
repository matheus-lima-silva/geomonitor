import AppIcon from '../../../../components/AppIcon';
import { Button } from '../../../../components/ui';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { buildCompoundWorkspaceOrder } from '../../utils/reportUtils';

// Step 3 — vincular workspaces ao relatorio.
// Em modo 'create': nao existe compound no backend ainda, entao fazemos
// staging local em pendingWorkspaceIds. Apos o POST de create, o wizard
// anexa cada um via onAddWorkspace.
// Em modo 'edit': opera diretamente no compound (add/remove/reorder chamam a API).
export default function StepWorkspaces({
  mode,
  compound,
  workspaces,
  workspaceLabelsById,
  compoundWorkspaceSelections,
  setCompoundWorkspaceSelections,
  onAddWorkspace,
  onRemoveWorkspace,
  onReorder,
  pendingWorkspaceIds = [],
  setPendingWorkspaceIds,
  busy,
}) {
  const isCreate = mode === 'create' || !compound?.id;

  // ── Modo create: staging local ───────────────────────────────────────────
  if (isCreate) {
    const pending = Array.isArray(pendingWorkspaceIds) ? pendingWorkspaceIds : [];
    const unlinked = workspaces.filter((ws) => !pending.includes(ws.id));

    function addPending(wsId) {
      const trimmed = String(wsId || '').trim();
      if (!trimmed) return;
      setPendingWorkspaceIds?.((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.includes(trimmed)) return list;
        return [...list, trimmed];
      });
    }

    function removePending(wsId) {
      setPendingWorkspaceIds?.((prev) => (
        (Array.isArray(prev) ? prev : []).filter((x) => x !== wsId)
      ));
    }

    function movePending(wsId, direction) {
      setPendingWorkspaceIds?.((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.indexOf(wsId);
        if (idx < 0) return prev;
        const target = direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= list.length) return prev;
        [list[idx], list[target]] = [list[target], list[idx]];
        return list;
      });
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-info-border bg-info-light p-3 text-xs text-info-dark">
          Os workspaces selecionados aqui serão vinculados automaticamente ao criar o
          relatório. Você ainda pode reordenar, adicionar e remover depois.
        </div>

        {pending.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Workspaces selecionados ({pending.length})
            </p>
            <div className="flex flex-col gap-1.5">
              {pending.map((wsId, index) => (
                <div
                  key={wsId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">
                      {index + 1}
                    </span>
                    <span>{workspaceLabelsById.get(wsId) || wsId}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      aria-label="Mover para cima"
                      onClick={() => movePending(wsId, 'up')}
                      disabled={index === 0}
                    >
                      <AppIcon name="chevron-up" size={14} />
                    </button>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      aria-label="Mover para baixo"
                      onClick={() => movePending(wsId, 'down')}
                      disabled={index === pending.length - 1}
                    >
                      <AppIcon name="chevron-down" size={14} />
                    </button>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-400 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      aria-label="Remover"
                      onClick={() => removePending(wsId)}
                    >
                      <AppIcon name="x" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Nenhum workspace selecionado ainda. Escolha abaixo as campanhas que farão parte
            deste relatório (opcional — você pode vincular depois).
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <SearchableSelect
            id="wizard-workspace-pending"
            label="Adicionar workspace"
            value=""
            onChange={(val) => addPending(val)}
            options={unlinked.map((ws) => ({
              value: ws.id,
              label: workspaceLabelsById.get(ws.id) || ws.nome || ws.id,
            }))}
            placeholder={unlinked.length === 0 ? 'Todos os workspaces já foram selecionados.' : 'Selecione um workspace para adicionar...'}
          />
          <div className="flex items-end">
            <span className="text-xs text-slate-500 italic min-h-btn flex items-center">
              Seleção salva automaticamente.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Modo edit: operacoes direto na API via callbacks ─────────────────────
  const orderedIds = buildCompoundWorkspaceOrder(compound);
  const unlinkedWorkspaces = workspaces.filter(
    (ws) => !(compound.workspaceIds || []).includes(ws.id),
  );

  return (
    <div className="flex flex-col gap-4">
      {orderedIds.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Ordem dos blocos
          </p>
          <div className="flex flex-col gap-1.5">
            {orderedIds.map((workspaceId, index) => (
              <div
                key={`${compound.id}-${workspaceId}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">
                    {index + 1}
                  </span>
                  <span>{workspaceLabelsById.get(workspaceId) || workspaceId}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    aria-label="Mover para cima"
                    onClick={() => onReorder?.(compound, workspaceId, 'up')}
                    disabled={index === 0 || busy === `compound-reorder:${compound.id}:${workspaceId}`}
                  >
                    <AppIcon name="chevron-up" size={14} />
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    aria-label="Mover para baixo"
                    onClick={() => onReorder?.(compound, workspaceId, 'down')}
                    disabled={index === orderedIds.length - 1 || busy === `compound-reorder:${compound.id}:${workspaceId}`}
                  >
                    <AppIcon name="chevron-down" size={14} />
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-400 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    aria-label="Remover"
                    onClick={() => onRemoveWorkspace?.(compound, workspaceId)}
                    disabled={busy === `compound-remove:${compound.id}:${workspaceId}`}
                  >
                    <AppIcon name="x" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
          Nenhum workspace vinculado ainda. Adicione pelo menos um abaixo.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <SearchableSelect
          id={`wizard-workspace-${compound.id}`}
          label="Adicionar workspace"
          value={compoundWorkspaceSelections?.[compound.id] || ''}
          onChange={(val) => setCompoundWorkspaceSelections?.((prev) => ({ ...prev, [compound.id]: val }))}
          options={unlinkedWorkspaces.map((ws) => ({
            value: ws.id,
            label: workspaceLabelsById.get(ws.id) || ws.nome || ws.id,
          }))}
          placeholder="Selecione um workspace..."
        />
        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={() => onAddWorkspace?.(compound)}
            disabled={busy === `compound-add:${compound.id}`}
          >
            <AppIcon name="plus" />
            {busy === `compound-add:${compound.id}` ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
