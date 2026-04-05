/**
 * PageHeader — cabeçalho padronizado de views.
 * Props: title, subtitle, action (ReactNode), className
 */
export default function PageHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}>
      <div>
        <h2 className="text-xl font-bold text-slate-800 m-0">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1 mb-0">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
