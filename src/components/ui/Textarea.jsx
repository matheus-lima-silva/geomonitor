/**
 * Textarea padronizado com mesma API semantica do Input.
 *
 * Props extras:
 *   label     - rotulo acima do campo
 *   id        - necessario quando label e fornecido
 *   error     - mensagem de erro (string)
 *   fullWidth - ocupa 100% da largura (padrao: true)
 *   variant   - 'default' (caixa branca, borda slate) | 'filled' (fundo
 *               surface-muted, borda transparente; ao focar volta a branco).
 */
import HintText from './HintText';

export default function Textarea({
    label,
    id,
    error,
    hint,
    fullWidth = true,
    variant = 'default',
    className = '',
    rows = 3,
    ...props
}) {
    const bgClass = variant === 'filled' ? 'bg-app-surfaceMuted focus:bg-white' : 'bg-white';
    const borderClass = error
        ? 'border-danger ring-1 ring-danger'
        : (variant === 'filled' ? 'border-transparent' : 'border-slate-300');
    const textareaClass = [
        'border rounded-md px-3 py-1.5 text-sm text-slate-800',
        bgClass,
        'placeholder:text-slate-400',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        'disabled:bg-slate-100 disabled:cursor-not-allowed',
        'transition-shadow duration-150 resize-y',
        borderClass,
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
            <textarea id={id} rows={rows} className={textareaClass} {...props} />
            {error && (
                <p className="mt-0.5 text-2xs text-danger font-medium">{error}</p>
            )}
        </div>
    );
}
