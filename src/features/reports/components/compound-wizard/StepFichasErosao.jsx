import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../../components/AppIcon';
import { Button, Badge, EmptyState } from '../../../../components/ui';
import { subscribeErosions } from '../../../../services/erosionService';

// Step 5 — fichas de erosao simplificada anexadas apos as assinaturas.
// Harmoniza o visual com StepAssinaturas: mesmas cores de highlight, mesmos
// gaps, tipografia e tons (border-blue-300/bg-blue-50 para item selecionado).
// Tres modos:
//   none     — nenhum anexo (default).
//   all      — todas as erosoes dos projetos dos workspaces do compound.
//   selected — multi-select de erosoes pelo usuario.
export default function StepFichasErosao({
  draft,
  onChange,
  compound,
  workspaces,
  pendingWorkspaceIds,
}) {
  const [erosions, setErosions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeErosions(
      (data) => {
        setErosions(Array.isArray(data) ? data : []);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub?.();
  }, []);

  // Projetos cujas erosoes sao candidatas: derivados dos workspaces linkados
  // (edit mode) ou dos staged ids (create mode).
  const relevantProjectIds = useMemo(() => {
    const workspaceIds = new Set([
      ...((compound?.workspaceIds) || []),
      ...((pendingWorkspaceIds) || []),
    ]);
    const ids = new Set();
    (workspaces || []).forEach((ws) => {
      if (!ws?.id || !workspaceIds.has(ws.id)) return;
      const pid = String(ws.projectId || '').trim().toUpperCase();
      if (pid) ids.add(pid);
    });
    return ids;
  }, [compound, workspaces, pendingWorkspaceIds]);

  const candidates = useMemo(() => {
    if (relevantProjectIds.size === 0) return [];
    return (erosions || []).filter((e) => {
      const pid = String(e?.projectId || e?.projetoId || '').trim().toUpperCase();
      return pid && relevantProjectIds.has(pid);
    });
  }, [erosions, relevantProjectIds]);

  const mode = draft.anexoFichasMode || 'none';
  const selectedIds = Array.isArray(draft.anexoFichasErosionIds) ? draft.anexoFichasErosionIds : [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const totalToAnex = mode === 'all'
    ? candidates.length
    : mode === 'selected'
      ? selectedIds.filter((id) => candidates.some((c) => c.id === id)).length
      : 0;

  function setMode(nextMode) {
    onChange((prev) => ({ ...prev, anexoFichasMode: nextMode }));
  }

  function toggleErosion(erosionId, checked) {
    onChange((prev) => {
      const current = Array.isArray(prev.anexoFichasErosionIds) ? prev.anexoFichasErosionIds : [];
      const next = checked
        ? [...current.filter((x) => x !== erosionId), erosionId]
        : current.filter((x) => x !== erosionId);
      return { ...prev, anexoFichasErosionIds: next };
    });
  }

  function selectAllCandidates() {
    onChange((prev) => ({
      ...prev,
      anexoFichasErosionIds: candidates.map((c) => c.id),
    }));
  }

  function clearSelection() {
    onChange((prev) => ({ ...prev, anexoFichasErosionIds: [] }));
  }

  const groupedByProject = useMemo(() => {
    const map = new Map();
    candidates.forEach((erosion) => {
      const pid = String(erosion?.projectId || erosion?.projetoId || '').trim().toUpperCase();
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(erosion);
    });
    return Array.from(map.entries());
  }, [candidates]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="m-0">
          Anexa fichas de erosão simplificada <strong>após as assinaturas</strong>, como um bloco
          final intitulado &quot;ANEXO - FICHAS DE EROSÃO SIMPLIFICADA&quot; no DOCX do relatório.
          As fichas aparecem em ordem crescente de número da torre.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Modo de anexo de fichas">
        <ModeRadio
          checked={mode === 'none'}
          onSelect={() => setMode('none')}
          label="Nenhuma"
          hint="Sem anexo. O relatório termina nas assinaturas."
        />
        <ModeRadio
          checked={mode === 'all'}
          onSelect={() => setMode('all')}
          label="Todas"
          hint={`Anexa todas as erosões dos projetos vinculados (${candidates.length}).`}
          disabled={candidates.length === 0}
        />
        <ModeRadio
          checked={mode === 'selected'}
          onSelect={() => setMode('selected')}
          label="Selecionar"
          hint="Escolher manualmente quais fichas anexar."
          disabled={candidates.length === 0}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 flex items-center justify-between">
        <span>
          <strong>{totalToAnex}</strong> ficha(s) serão anexadas ao relatório.
        </span>
        {mode === 'selected' && candidates.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={selectAllCandidates}>
              Marcar todas ({candidates.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Limpar
            </Button>
          </div>
        ) : null}
      </div>

      {mode === 'selected' ? (
        loading ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            Carregando erosões...
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={<AppIcon name="alert" className="w-6 h-6" aria-hidden="true" />}
            title="Nenhuma erosão disponível"
            description="Vincule workspaces cujos projetos possuam erosões cadastradas para poder anexar fichas."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {groupedByProject.map(([projectId, list]) => (
              <div key={projectId || 'sem-projeto'} className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
                <div className="text-2xs font-bold uppercase tracking-wide text-slate-500">
                  {projectId || 'Sem projeto'}
                </div>
                {list.map((erosion) => {
                  const isSelected = selectedSet.has(erosion.id);
                  const towerLabel = String(erosion.torreRef || '').trim();
                  const crit = String(erosion.criticalityCode || '').toUpperCase();
                  return (
                    <label
                      key={erosion.id}
                      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm cursor-pointer ${
                        isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'
                      }`}
                      htmlFor={`ficha-${erosion.id}`}
                    >
                      <input
                        id={`ficha-${erosion.id}`}
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-brand-600"
                        checked={isSelected}
                        onChange={(e) => toggleErosion(erosion.id, e.target.checked)}
                      />
                      <span className="font-medium text-slate-800">{erosion.id}</span>
                      {towerLabel ? (
                        <Badge tone="neutral" size="sm">{`Torre ${towerLabel}`}</Badge>
                      ) : null}
                      {crit ? (
                        <Badge tone={critTone(crit)} size="sm">{crit}</Badge>
                      ) : null}
                      {erosion.status ? (
                        <span className="text-xs text-slate-500">{erosion.status}</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

function ModeRadio({ checked, onSelect, label, hint, disabled }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className={`flex min-w-[180px] flex-col gap-1 rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300'}`}
    >
      <span className="font-medium text-slate-800">{label}</span>
      <span className="text-xs text-slate-500">{hint}</span>
    </button>
  );
}

function critTone(code) {
  if (code === 'C4') return 'critical';
  if (code === 'C3') return 'danger';
  if (code === 'C2') return 'warning';
  return 'ok';
}
