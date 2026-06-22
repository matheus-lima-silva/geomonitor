export const STEPS = [
  { id: 'sec-intro', n: 1, label: 'Introdução' },
  { id: 'sec-ativ', n: 2, label: 'Atividades' },
  { id: 'sec-conc', n: 3, label: 'Conclusão' },
];

/**
 * Navegacao de etapas da topbar (1 Introducao · 2 Atividades · 3 Conclusao).
 * O destaque ativo vem do scroll-spy do container do editor.
 */
export default function StepNav({ activeStep, onStepClick }) {
  return (
    <nav aria-label="Etapas do relatório" className="hidden lg:flex items-center gap-1 mx-2 shrink-0">
      {STEPS.map((step) => {
        const active = activeStep === step.id;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(step.id)}
            className={[
              'flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-sm font-semibold transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              active ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
            ].join(' ')}
          >
            <span
              className={[
                'flex items-center justify-center w-[18px] h-[18px] rounded-full font-mono text-2xs font-bold',
                active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600',
              ].join(' ')}
            >
              {step.n}
            </span>
            {step.label}
          </button>
        );
      })}
    </nav>
  );
}
