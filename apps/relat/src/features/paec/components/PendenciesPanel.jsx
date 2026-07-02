import AppIcon from '@app/components/AppIcon';
import { Badge } from '@app/components/ui';

const FALLBACK_SECTION = 'Outros campos';

function groupFieldPendencies(pendencies) {
  const order = [];
  const bySection = new Map();
  for (const p of pendencies) {
    if (p.kind !== 'field') continue;
    const section = p.section || FALLBACK_SECTION;
    if (!bySection.has(section)) {
      bySection.set(section, []);
      order.push(section);
    }
    bySection.get(section).push(p);
  }
  return order.map((section) => ({ section, items: bySection.get(section) }));
}

/**
 * Painel de pendencias (coluna direita fixa do editor). Campos de texto sao
 * clicaveis (rolam ate o campo); blocos de tabela/anexo ainda nao tem alvo de
 * edicao nesta fase, entao aparecem so como lista informativa.
 */
export default function PendenciesPanel({ pendencies, onFieldClick }) {
  const total = pendencies.length;
  const fieldGroups = groupFieldPendencies(pendencies);
  const listBlocks = pendencies.filter((p) => p.kind === 'list');
  const manualBlocks = pendencies.filter((p) => p.kind === 'manual_block');
  const fieldsPending = pendencies.filter((p) => p.kind === 'field').length;

  return (
    <aside className="bg-app-surface border border-slate-300 rounded-[14px] shadow-panel p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-sm font-bold text-slate-800">Pendências</h2>
        {total === 0 ? (
          <Badge tone="ok">
            <AppIcon name="check" className="w-3 h-3 mr-1" />
            Completo
          </Badge>
        ) : (
          <Badge tone="warning">{total} {total === 1 ? 'pendência' : 'pendências'}</Badge>
        )}
      </div>

      {total === 0 ? (
        <p className="m-0 text-sm text-slate-500">Ficha completa!</p>
      ) : (
        <>
          {fieldGroups.map(({ section, items }) => (
            <div key={section}>
              <p className="m-0 mb-1.5 text-2xs font-bold uppercase tracking-wide text-slate-400">{section}</p>
              <ul className="m-0 p-0 list-none flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onFieldClick(item.key)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm text-slate-600 hover:bg-app-surfaceMuted hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <AppIcon name="edit" className="w-3.5 h-3.5 text-warning-border shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {fieldsPending === 0 ? (
            <p className="m-0 text-xs text-success bg-success-light border border-success-border rounded-md px-3 py-2">
              Todos os campos de texto estão preenchidos.
            </p>
          ) : null}

          {listBlocks.length > 0 ? (
            <div>
              <p className="m-0 mb-1.5 text-2xs font-bold uppercase tracking-wide text-slate-400">Tabelas em branco</p>
              <ul className="m-0 p-0 list-none flex flex-col gap-1">
                {listBlocks.map((item) => (
                  <li key={item.key} className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-500">
                    <AppIcon name="table" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {manualBlocks.length > 0 ? (
            <div>
              <p className="m-0 mb-1.5 text-2xs font-bold uppercase tracking-wide text-slate-400">Anexos e blocos manuais</p>
              <ul className="m-0 p-0 list-none flex flex-col gap-1">
                {manualBlocks.map((item) => (
                  <li key={item.key} className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-500">
                    <AppIcon name="file-text" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      <p className="m-0 text-2xs text-slate-400 border-t border-slate-100 pt-3">
        Pendências não bloqueiam a geração — os itens vão destacados em amarelo no documento.
      </p>
    </aside>
  );
}
