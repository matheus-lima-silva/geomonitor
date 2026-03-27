/**
 * Select padronizado — mesma aparência que o Input.
 *
 * Props:
 *   label      — rótulo acima do select
 *   id         — necessário quando label é fornecido
 *   error      — mensagem de erro (string)
 *   fullWidth  — ocupa 100% da largura (padrão: true)
 *   children   — opções <option>
 */
import HintText from './HintText';

export default function Select({
    label,
    id,
    error,
    hint,
    fullWidth = true,
    className = '',
    children,
    ...props
}) {
    const selectClass = [
        'border rounded-md px-3 py-1.5 text-sm text-slate-800 bg-white',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        'disabled:bg-slate-100 disabled:cursor-not-allowed',
        'appearance-none bg-no-repeat bg-right pr-8',
        'transition-shadow duration-150',
        error ? 'border-danger ring-1 ring-danger' : 'border-slate-300',
        fullWidth ? 'w-full' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={fullWidth ? 'w-full' : ''}>
            {label && (
                <label
                    htmlFor={id}
                    className="flex items-center gap-1.5 mb-1 text-2xs font-bold uppercase tracking-wide text-slate-500"
                >
                    <span>{label}</span>
                    {hint ? <HintText label={label}>{hint}</HintText> : null}
                </label>
            )}
            <div className="relative">
                <select id={id} className={selectClass} {...props}>
                    {children}
                </select>
                {/* Chevron decorativo */}
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            </div>
            {error && (
                <p className="mt-0.5 text-2xs text-danger font-medium">{error}</p>
            )}
        </div>
    );
}
