import AppIcon from '../../../components/AppIcon';
import { Badge, Button } from '../../../components/ui';
import {
  buildLicenseChips,
  buildLicenseSubtitle,
  buildLicenseTitle,
} from '../utils/licenseCardFormat';

// Card individual de LO no grid. Extrai titulacao e chips para helpers puros
// (src/features/licenses/utils/licenseCardFormat.js), reaproveitados tambem
// pela pagina de detalhe.

export default function LicenseCard({ license, projectsById, onOpen, onEdit, onDelete }) {
  const title = buildLicenseTitle(license);
  const subtitle = buildLicenseSubtitle(license);
  const chips = buildLicenseChips(license);
  const cobertura = Array.isArray(license?.cobertura) ? license.cobertura : [];

  return (
    <article className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={() => onOpen?.(license)}
        className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <header className="flex flex-col gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-800 m-0 truncate" title={title}>{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 m-0 mt-0.5">{subtitle}</p>}
            </div>
            <span className="text-2xs font-semibold text-slate-400 shrink-0 tabular-nums">{license.id}</span>
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip, idx) => (
                <Badge key={`${chip.label}-${idx}`} tone={chip.tone} size="sm">{chip.label}</Badge>
              ))}
            </div>
          )}
        </header>
      </button>

      <div className="px-4 py-3 text-sm text-slate-600 flex flex-col gap-1 flex-1">
        <div>
          <strong className="text-slate-700">Vigência:</strong>{' '}
          {license.inicioVigencia || '-'}{' '}até{' '}
          {license.fimVigencia || 'indeterminada'}
        </div>
        <div>
          <strong className="text-slate-700">Cobertura:</strong> {cobertura.length} escopo(s)
          {cobertura.length > 0 && (
            <ul className="mt-1 ml-4 list-disc text-xs text-slate-500">
              {cobertura.slice(0, 3).map((cob, ci) => {
                const proj = projectsById?.get?.(cob.projetoId);
                const nome = proj ? `${proj.id} - ${proj.nome}` : cob.projetoId;
                const torreCount = (cob.torres || []).length;
                return <li key={ci} className="truncate" title={nome}>{nome} ({torreCount} torres)</li>;
              })}
              {cobertura.length > 3 && (
                <li className="list-none text-slate-400">+ {cobertura.length - 3} mais</li>
              )}
            </ul>
          )}
        </div>
      </div>

      <footer className="flex items-center gap-2 px-4 py-2 border-t border-slate-100 bg-white">
        <Button variant="ghost" size="sm" onClick={() => onOpen?.(license)} aria-label="Abrir detalhe">
          <AppIcon name="details" />
          Detalhes
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit?.(license)}>
            <AppIcon name="edit" />
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete?.(license)}>
            <AppIcon name="trash" />
            Excluir
          </Button>
        </div>
      </footer>
    </article>
  );
}
