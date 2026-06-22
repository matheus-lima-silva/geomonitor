import AppIcon from '@app/components/AppIcon';
import { Button } from '@app/components/ui';
import StepNav from './StepNav';
import { MONTHS } from '../../utils/constants';

/**
 * Topbar do construtor: marca, navegacao de etapas, mes de referencia,
 * configuracoes, geracao do .docx e status do salvamento automatico.
 * Layout do design handoff v2 (uma linha, sem wrap).
 */
export default function Topbar({
  refYear,
  refMonth,
  onPeriodChange,
  activeStep,
  onStepClick,
  saveStatus,
  onOpenSettings,
  onGenerate,
  generating = false,
  generateDisabled = false,
}) {
  return (
    <header className="bg-app-surface border-b border-slate-300 shadow-card shrink-0 z-10">
      <div className="flex items-center gap-3 px-5 py-2.5 flex-nowrap">
        <span
          className="flex items-center justify-center w-[34px] h-[34px] rounded-[10px] bg-brand-600 text-white shrink-0"
          aria-hidden="true"
        >
          <AppIcon name="monitor" className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0 hidden md:block">
          <p className="m-0 text-md font-semibold text-slate-800 truncate">Relatório mensal de serviços</p>
          <p className="m-0 text-xs text-slate-500 truncate hidden xl:block">
            Lance as atividades, escreva os textos e gere o .docx pronto
          </p>
        </div>

        <StepNav activeStep={activeStep} onStepClick={onStepClick} />

        <div className="flex-1" />

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 rounded-[10px] border border-slate-300 bg-app-surfaceMuted px-2 py-0.5">
            <span className="text-2xs font-bold uppercase tracking-wide text-slate-500 hidden min-[1480px]:inline">
              Mês de referência
            </span>
            <select
              aria-label="Mês de referência"
              className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none py-1.5"
              value={refMonth}
              onChange={(e) => onPeriodChange(refYear, Number(e.target.value))}
            >
              {MONTHS.map((name, i) => (
                <option key={name} value={i}>{name}</option>
              ))}
            </select>
            <input
              type="number"
              aria-label="Ano de referência"
              className="w-16 bg-transparent text-sm font-semibold text-slate-800 focus:outline-none py-1.5"
              min={2020}
              max={2040}
              value={refYear}
              onChange={(e) => {
                const year = Number(e.target.value);
                if (year >= 2020 && year <= 2040) onPeriodChange(year, refMonth);
              }}
            />
          </div>

          <Button variant="ghost" size="sm" onClick={onOpenSettings} aria-label="Configurações" title="Configurações">
            <AppIcon name="settings" className="w-4 h-4" />
          </Button>
          <Button variant="primary" size="sm" onClick={onGenerate} disabled={generateDisabled || generating}>
            <AppIcon name="download" className="w-4 h-4 mr-1.5" />
            {generating ? 'Gerando…' : 'Gerar .docx'}
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
      className={`text-xs ${tone} shrink-0 hidden min-[1480px]:inline`}
    >
      {label}
    </span>
  );
}
