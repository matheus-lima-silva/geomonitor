import AppIcon from '../AppIcon';

/**
 * EmptyState — estado vazio padronizado para listas e tabelas.
 * Props: icon (AppIcon name), title, description, action (ReactNode), className
 */
export default function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 text-center ${className}`}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <AppIcon name={icon} size={22} />
        </div>
      )}
      {title && <p className="text-sm font-semibold text-slate-600 m-0">{title}</p>}
      {description && <p className="text-xs text-slate-400 m-0 max-w-xs">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
