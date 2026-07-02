import AppIcon from '@app/components/AppIcon';
import { Button, IconButton } from '@app/components/ui';

/**
 * Topbar do editor da ficha PAEC: voltar, nome + revisao, SaveStatus,
 * pendencias e gerar. Mesmo padrao do Topbar do monthly-report, adaptado
 * (sem seletor de periodo — a ficha nao e por mes).
 */
export default function PaecTopbar({
  plantName,
  revisionLabel,
  saveStatus,
  onBack,
  pendencyCount,
  onTogglePendencies,
  onGenerate,
  generating = false,
  generateDisabled = false,
}) {
  return (
    <header className="bg-app-surface border-b border-slate-300 shadow-card shrink-0 z-10">
      <div className="flex items-center gap-3 px-5 py-2.5 flex-nowrap">
        <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Voltar à lista de usinas">
          <AppIcon name="chevron-left" className="w-4 h-4" />
        </IconButton>

        <div className="min-w-0 flex items-center gap-2">
          <p className="m-0 text-md font-bold text-slate-800 truncate">{plantName}</p>
          {revisionLabel ? (
            <span
              className="shrink-0 rounded-md bg-app-surfaceMuted border border-slate-300 px-2 py-0.5 text-2xs font-mono text-slate-500"
              title={revisionLabel}
            >
              {revisionLabel}
            </span>
          ) : null}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onTogglePendencies}>
            <AppIcon name={pendencyCount === 0 ? 'check' : 'alert'} className="w-4 h-4 mr-1.5" />
            Pendências{pendencyCount > 0 ? ` (${pendencyCount})` : ''}
          </Button>
          <Button variant="primary" size="sm" onClick={onGenerate} disabled={generateDisabled || generating}>
            <AppIcon name="download" className="w-4 h-4 mr-1.5" />
            {generating ? 'Gerando…' : 'Gerar PAEC'}
          </Button>
        </div>

        <SaveStatus status={saveStatus} />
      </div>
    </header>
  );
}

export function SaveStatus({ status }) {
  const label = status === 'saving' ? 'Salvando…'
    : status === 'saved' ? 'Salvo'
    : status === 'error' ? 'Erro ao salvar'
    : 'Salvamento automático';
  const tone = status === 'saved' ? 'text-success font-semibold'
    : status === 'error' ? 'text-danger font-semibold'
    : 'text-slate-400';
  return (
    <span
      data-testid="save-status"
      aria-live="polite"
      className={`text-xs ${tone} shrink-0 hidden min-[1480px]:inline ml-2`}
    >
      {label}
    </span>
  );
}
