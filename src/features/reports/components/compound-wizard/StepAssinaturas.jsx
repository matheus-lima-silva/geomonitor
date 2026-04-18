import AppIcon from '../../../../components/AppIcon';
import { formatSignatarioRegistro } from '../../utils/reportUtils';

// Step 4 — assinaturas (elaboradores / revisores + ordem).
// Reusa a logica legada de CompoundsTab.jsx mas dentro do wizard.
export default function StepAssinaturas({ draft, onChange, signatariosCandidatos, profissoes }) {
  function toggle(role, sigId, checked) {
    onChange((prev) => {
      const current = Array.isArray(prev[role]) ? prev[role] : [];
      const next = checked
        ? [...current.filter((x) => x !== sigId), sigId]
        : current.filter((x) => x !== sigId);
      return { ...prev, [role]: next };
    });
  }

  function move(role, sigId, direction) {
    onChange((prev) => {
      const arr = [...(prev[role] || [])];
      const idx = arr.indexOf(sigId);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...prev, [role]: arr };
    });
  }

  if (!signatariosCandidatos || signatariosCandidatos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
        Nenhum signatário cadastrado no seu perfil. Cadastre elaboradores/revisores na aba de
        perfil para selecioná-los aqui.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
        {signatariosCandidatos.map((sig) => {
          const registro = formatSignatarioRegistro(sig);
          const profNome = profissoes?.find((p) => p.id === sig.profissao_id)?.nome
            || sig.profissao_nome || '';
          const isElab = (draft.elaboradores || []).includes(sig.id);
          const isRev = (draft.revisores || []).includes(sig.id);
          const highlight = isElab || isRev;
          return (
            <div
              key={sig.id}
              className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${highlight ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-brand-600"
                    checked={isElab}
                    onChange={(e) => toggle('elaboradores', sig.id, e.target.checked)}
                  />
                  Elaborador
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-brand-600"
                    checked={isRev}
                    onChange={(e) => toggle('revisores', sig.id, e.target.checked)}
                  />
                  Revisor
                </label>
              </div>
              <span className="flex-1 font-medium text-slate-800">{sig.nome}</span>
              <span className="text-xs text-slate-500">
                {[profNome, registro].filter(Boolean).join(' – ')}
              </span>
            </div>
          );
        })}
      </div>

      {(draft.elaboradores || []).length >= 2 ? (
        <OrderedList
          label="Ordem dos elaboradores"
          items={draft.elaboradores}
          candidates={signatariosCandidatos}
          onMove={(sigId, dir) => move('elaboradores', sigId, dir)}
        />
      ) : null}

      {(draft.revisores || []).length >= 2 ? (
        <OrderedList
          label="Ordem dos revisores"
          items={draft.revisores}
          candidates={signatariosCandidatos}
          onMove={(sigId, dir) => move('revisores', sigId, dir)}
        />
      ) : null}
    </div>
  );
}

function OrderedList({ label, items, candidates, onMove }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="flex flex-col gap-1.5">
        {items.map((sigId, index) => {
          const sig = candidates.find((s) => s.id === sigId);
          return (
            <div
              key={sigId}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-2xs font-bold text-slate-600">
                  {index + 1}
                </span>
                <span>{sig?.nome || sigId}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  disabled={index === 0}
                  onClick={() => onMove(sigId, 'up')}
                  aria-label="Mover para cima"
                >
                  <AppIcon name="chevron-up" size={12} />
                </button>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  disabled={index === items.length - 1}
                  onClick={() => onMove(sigId, 'down')}
                  aria-label="Mover para baixo"
                >
                  <AppIcon name="chevron-down" size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
