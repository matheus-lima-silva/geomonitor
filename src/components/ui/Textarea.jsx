/**
 * Textarea padronizado com mesma API semantica do Input.
 *
 * Props extras:
 *   label     - rotulo acima do campo
 *   id        - necessario quando label e fornecido
 *   error     - mensagem de erro (string)
 *   fullWidth - ocupa 100% da largura (padrao: true)
 */
export default function Textarea({
    label,
    id,
    error,
    fullWidth = true,
    className = '',
    rows = 3,
    ...props
}) {
    const textareaClass = [
        'border rounded-md px-3 py-1.5 text-sm text-slate-800 bg-white',
        'placeholder:text-slate-400',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        'disabled:bg-slate-100 disabled:cursor-not-allowed',
        'transition-shadow duration-150 resize-y',
        error ? 'border-danger ring-1 ring-danger' : 'border-slate-300',
        fullWidth ? 'w-full' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={fullWidth ? 'w-full' : ''}>
            {label && (
                <label
                    htmlFor={id}
                    className="block mb-1 text-2xs font-bold uppercase tracking-wide text-slate-500"
                >
                    {label}
                </label>
            )}
            <textarea id={id} rows={rows} className={textareaClass} {...props} />
            {error && (
                <p className="mt-0.5 text-2xs text-danger font-medium">{error}</p>
            )}
        </div>
    );
}
