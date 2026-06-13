import { useEffect, useRef, useState } from 'react';
import AppIcon from '@app/components/AppIcon';
import { Button } from '@app/components/ui';

/**
 * Seletor do engenheiro ativo ("ATIVIDADES DE Nome") com popover para trocar,
 * renomear, remover e adicionar engenheiros — cada engenheiro tem seu proprio
 * calendario e resumo por projeto (secoes 2.n do documento).
 */
export default function EngineerSelector({ engineers, activeIndex, onSelect, onAdd, onRename, onRemove }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const active = engineers[activeIndex];

  function commitRename(engineerId) {
    onRename(engineerId, draftName.trim());
    setEditingId(null);
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        data-testid="eng-selector"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-[10px] border border-slate-300 bg-app-surfaceMuted px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className="text-2xs font-bold uppercase tracking-wide text-slate-500">Atividades de</span>
        {active?.name || 'Engenheiro sem nome'}
        <AppIcon name="chevron-down" className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {open ? (
        <div
          data-testid="eng-popover"
          className="absolute z-20 mt-1 w-72 rounded-[10px] border border-slate-200 bg-app-surface shadow-panel p-1.5"
        >
          <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
            {engineers.map((engineer, idx) => (
              <li key={engineer.id} className="flex items-center gap-1 group">
                {editingId === engineer.id ? (
                  <input
                    autoFocus
                    aria-label="Nome do engenheiro"
                    className="flex-1 min-w-0 rounded-md border border-brand-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(engineer.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => commitRename(engineer.id)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { onSelect(idx); setOpen(false); }}
                    className={[
                      'flex-1 min-w-0 truncate text-left rounded-md px-2 py-1.5 text-sm transition-colors',
                      idx === activeIndex ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {engineer.name || 'Engenheiro sem nome'}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Renomear ${engineer.name || 'engenheiro'}`}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  onClick={() => { setEditingId(engineer.id); setDraftName(engineer.name || ''); }}
                >
                  <AppIcon name="pencil" className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${engineer.name || 'engenheiro'}`}
                  className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger-light opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  onClick={() => {
                    if (window.confirm(`Remover ${engineer.name || 'este engenheiro'} e todas as suas atividades deste mês?`)) {
                      onRemove(engineer.id);
                    }
                  }}
                >
                  <AppIcon name="trash-2" className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-200 mt-1.5 pt-1.5">
            <Button variant="ghost" size="sm" onClick={() => { onAdd(); }}>
              <AppIcon name="plus" className="w-3.5 h-3.5 mr-1.5" />
              Adicionar engenheiro
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
