/**
 * Card de secao do editor (chip numerico + titulo + campos). Mesmo padrao
 * visual do StepCard do monthly-report (raio 14px, borda slate-300, sombra
 * card) — copia local, feature autocontida.
 */
export default function SectionCard({ id, number, title, children }) {
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
        <h2 className="m-0 text-[1.05rem] font-bold text-slate-800 min-w-0 flex-1 truncate">{title}</h2>
      </div>
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </section>
  );
}
