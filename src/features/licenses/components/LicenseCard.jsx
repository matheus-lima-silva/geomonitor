import AppIcon from '../../../components/AppIcon';
import { Badge, IconButton } from '../../../components/ui';
import {
  buildLicenseChips,
  buildLicenseSubtitle,
  buildLicenseTitle,
} from '../utils/licenseCardFormat';

// Card individual de LO. Otimizado para propor\u00e7\u00f5es consistentes no grid:
// altura uniforme (h-full), corpo compacto de 2 linhas + footer de a\u00e7\u00f5es
// icon-only. Click no corpo abre o detalhe (\u00e1rea grande de alvo).

function formatVigencia(license) {
  const ini = license.inicioVigencia || '';
  const fim = license.fimVigencia || '';
  if (ini && fim) return `${ini} \u2192 ${fim}`;
  if (ini) return `Desde ${ini}`;
  if (fim) return `At\u00e9 ${fim}`;
  return 'Vig\u00eancia n\u00e3o informada';
}

export default function LicenseCard({ license, projectsById, onOpen, onEdit, onDelete }) {
  const title = buildLicenseTitle(license);
  const subtitle = buildLicenseSubtitle(license);
  const chips = buildLicenseChips(license);
  const cobertura = Array.isArray(license?.cobertura) ? license.cobertura : [];
  const firstScope = cobertura[0];
  const firstScopeLabel = firstScope
    ? (projectsById?.get?.(firstScope.projetoId)?.nome || firstScope.descricaoEscopo || firstScope.projetoId)
    : '';

  return (
    <article className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <button
        type="button"
        onClick={() => onOpen?.(license)}
        className="flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
      >
        <header className="px-4 pt-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800 m-0 leading-tight line-clamp-2" title={title}>
              {title}
            </h3>
            <span className="text-2xs font-semibold text-slate-400 shrink-0 tabular-nums mt-0.5">{license.id}</span>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 m-0 mt-1 truncate" title={subtitle}>{subtitle}</p>
          )}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {chips.map((chip, idx) => (
                <Badge key={`${chip.label}-${idx}`} tone={chip.tone} size="sm">{chip.label}</Badge>
              ))}
            </div>
          )}
        </header>

        <div className="px-4 py-2 text-xs text-slate-600 flex flex-col gap-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 tabular-nums">
            <AppIcon name="clipboard" className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate" title={formatVigencia(license)}>{formatVigencia(license)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AppIcon name="building" className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate" title={firstScopeLabel}>
              {cobertura.length === 0 ? 'Sem cobertura' : firstScopeLabel}
              {cobertura.length > 1 && (
                <span className="text-slate-400 font-semibold"> +{cobertura.length - 1}</span>
              )}
            </span>
          </div>
        </div>
      </button>

      <footer className="flex items-center justify-end gap-1 px-3 py-2 border-t border-slate-100 bg-slate-50">
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => onOpen?.(license)}
          aria-label={`Abrir detalhes de ${title}`}
        >
          <AppIcon name="details" />
        </IconButton>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => onEdit?.(license)}
          aria-label={`Editar ${title}`}
        >
          <AppIcon name="edit" />
        </IconButton>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => onDelete?.(license)}
          aria-label={`Excluir ${title}`}
          className="text-slate-400 hover:text-danger hover:bg-danger-light"
        >
          <AppIcon name="trash" />
        </IconButton>
      </footer>
    </article>
  );
}
