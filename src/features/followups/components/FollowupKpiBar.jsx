import AppIcon from '../../../components/AppIcon';

const KPI_TONES = {
  slate: 'bg-slate-100 text-slate-600',
  rose: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
};

/* KPI clicável = filtro rápido. Usa <button aria-pressed> com aparência de tile
   (padrão visual-toggle já aceito no codebase — ver ErosionPhotosPickerModal). */
function FollowupKpi({ icon, tone, label, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex items-center gap-3 bg-white border rounded-xl shadow-card px-4 py-3 text-left transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        active ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-300 hover:border-slate-400',
      ].join(' ')}
    >
      <span className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${KPI_TONES[tone] || KPI_TONES.slate}`}>
        <AppIcon name={icon} size={18} />
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-lg font-bold text-slate-800 leading-tight tabular-nums">{value}</span>
        <span className="text-2xs font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</span>
      </span>
    </button>
  );
}

/* Barra de KPIs do topo. `kpis` = [{ key, icon, tone, label, value }]. */
function FollowupKpiBar({ kpis, activeKey, onToggle }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <FollowupKpi
          key={kpi.key}
          icon={kpi.icon}
          tone={kpi.tone}
          label={kpi.label}
          value={kpi.value}
          active={activeKey === kpi.key}
          onClick={() => onToggle(kpi.key)}
        />
      ))}
    </div>
  );
}

export default FollowupKpiBar;
