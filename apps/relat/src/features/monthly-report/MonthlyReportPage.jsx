import { useRef, useState } from 'react';
import { Button } from '@app/components/ui';
import Topbar from './components/topbar/Topbar';
import IntroCard from './components/editor/IntroCard';
import ActivitiesCard from './components/editor/ActivitiesCard';
import ActivitiesSection from './components/editor/ActivitiesSection';
import ConclusionCard from './components/editor/ConclusionCard';
import { useMonthlyReport } from './hooks/useMonthlyReport';
import { useReportSettings } from './hooks/useReportSettings';

/**
 * Construtor do Relatorio Mensal de Acompanhamento dos Servicos.
 * Shell de scroll interno (workspace dividido): editor a esquerda, preview do
 * documento a direita. As settings globais carregam antes do editor montar —
 * o seed de mes novo depende de equipe/contrato.
 */
export default function MonthlyReportPage({ onExit }) {
  const now = new Date();
  const [period, setPeriod] = useState({ refYear: now.getFullYear(), refMonth: now.getMonth() });
  const { settings, loading: settingsLoading, save: saveSettingsData } = useReportSettings();

  if (settingsLoading) {
    return (
      <main className="flex items-center justify-center h-screen bg-app-bg">
        <p className="text-sm text-slate-500" aria-live="polite">Carregando configurações…</p>
      </main>
    );
  }

  return (
    <MonthlyReportWorkspace
      period={period}
      onPeriodChange={(refYear, refMonth) => setPeriod({ refYear, refMonth })}
      settings={settings}
      saveSettingsData={saveSettingsData}
      onExit={onExit}
    />
  );
}

function MonthlyReportWorkspace({ period, onPeriodChange, settings, onExit }) {
  const { report, loading, error, saveStatus, conflict, updateReport, reload } = useMonthlyReport({
    refYear: period.refYear,
    refMonth: period.refMonth,
    settings,
  });

  const editorRef = useRef(null);
  const [activeStep, setActiveStep] = useState('sec-intro');

  function scrollToStep(id) {
    setActiveStep(id);
    const container = editorRef.current;
    const el = container ? container.querySelector(`#${id}`) : null;
    if (container && el) {
      container.scrollTo({ top: el.offsetTop - container.offsetTop - 8, behavior: 'smooth' });
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-app-bg">
      <Topbar
        refYear={period.refYear}
        refMonth={period.refMonth}
        onPeriodChange={onPeriodChange}
        activeStep={activeStep}
        onStepClick={scrollToStep}
        saveStatus={saveStatus}
        onOpenSettings={() => {}}
        onGenerate={() => {}}
        generateDisabled
      />

      {conflict ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-danger-light border-b border-danger px-5 py-2"
        >
          <p className="m-0 text-sm text-critical">
            Este relatório foi alterado em outra sessão. Recarregue para continuar editando — as mudanças não salvas serão perdidas.
          </p>
          <Button variant="danger" size="sm" onClick={() => reload()}>Recarregar relatório</Button>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 grid grid-cols-1 min-[1180px]:grid-cols-[minmax(640px,1fr)_clamp(440px,38vw,620px)]">
        <main
          ref={editorRef}
          className="overflow-y-auto px-6 pt-6 pb-10 scroll-smooth"
          data-testid="editor-column"
        >
          <div className="mx-auto max-w-[980px] flex flex-col gap-5">
            {onExit ? (
              <button
                type="button"
                onClick={onExit}
                className="self-start text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                ← Voltar ao portal
              </button>
            ) : null}

            {loading ? (
              <p className="text-sm text-slate-500" aria-live="polite">Carregando relatório…</p>
            ) : error ? (
              <div role="alert" className="bg-danger-light border border-danger rounded-[10px] p-4">
                <p className="m-0 text-sm text-critical">{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => reload()}>Tentar de novo</Button>
              </div>
            ) : report ? (
              <>
                <IntroCard
                  report={report}
                  settings={settings}
                  onChangeIntro={(intro) => updateReport((r) => ({ ...r, intro }))}
                />
                <ActivitiesCard report={report}>
                  <ActivitiesSection report={report} updateReport={updateReport} />
                </ActivitiesCard>
                <ConclusionCard
                  report={report}
                  onChangeConclusao={(conclusao) => updateReport((r) => ({ ...r, conclusao }))}
                />
              </>
            ) : null}
          </div>
        </main>

        <aside
          className="hidden min-[1180px]:flex flex-col bg-slate-200 border-l border-slate-300"
          data-testid="preview-column"
        >
          <div className="flex items-center gap-2 bg-app-surface border-b border-slate-300 px-4 py-2">
            <span className="text-2xs font-bold uppercase tracking-wide text-slate-500">
              Pré-visualização do documento
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-500">A pré-visualização ao vivo entra em breve.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
