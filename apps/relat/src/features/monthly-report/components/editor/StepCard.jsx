/**
 * Card de etapa do editor (chip numerico + titulo + subtitulo + acoes).
 * Padrao visual do design handoff v2: raio 14px, borda slate-300, sombra card.
 */
export default function StepCard({ id, number, title, subtitle, actions, children }) {
  return (
    <section
      id={id}
      className="bg-app-surface border border-slate-300 rounded-[14px] shadow-card p-6 scroll-mt-4"
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-brand-600 text-white text-sm font-bold shrink-0"
          aria-hidden="true"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[1.05rem] font-bold text-slate-800">{title}</h2>
          {subtitle ? <p className="m-0 mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0 ml-auto flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
