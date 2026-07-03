/**
 * Nav lateral do editor (coluna esquerda, 200px): mini-progresso geral +
 * lista de secoes do manifest com contador de pendencias por secao. Item
 * ativo determinado pelo scroll-spy do container do editor.
 */
export default function SectionNav({ sections, activeId, onSectionClick, pendencyCounts, stats }) {
  const { fieldsFilled = 0, fieldsTotal = 0 } = stats || {};
  const percent = fieldsTotal > 0 ? Math.round((fieldsFilled / fieldsTotal) * 100) : 0;

  return (
    <nav aria-label="Seções da ficha" className="hidden lg:flex flex-col gap-3 min-h-0 overflow-y-auto">
      <div>
        <p className="m-0 mb-1 text-2xs font-bold uppercase tracking-wide text-slate-400">Seções</p>
        <p className="m-0 mb-1.5 text-xs text-slate-500">{fieldsFilled} / {fieldsTotal} completos</p>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
        {sections.map(({ id, title }) => {
          const isActive = id === activeId;
          const pendingCount = pendencyCounts.get(title) || 0;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSectionClick(id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs truncate transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  isActive ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-500 hover:bg-slate-50'
                }`}
                title={title}
              >
                {title}
                {pendingCount > 0 ? <span className="ml-1.5 text-warning-border font-bold">({pendingCount})</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
