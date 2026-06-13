import { CATEGORIES } from '../../utils/constants';

/** Legenda das categorias do calendario + marcador de feriado. */
export default function CategoryLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5">
      {Object.entries(CATEGORIES).map(([key, cat]) => (
        <span key={key} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} aria-hidden="true" />
          {cat.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
        <span className="text-critical font-bold" aria-hidden="true">★</span>
        Feriado
      </span>
    </div>
  );
}
