const VARIANT_CLASSES = {
    ghost: 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700',
    outline: 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:text-slate-800',
    primary: 'bg-brand-600 text-white border-transparent hover:bg-brand-700',
    danger: 'bg-danger text-white border-transparent hover:bg-danger-dark',
};

const SIZE_CLASSES = {
    sm: 'w-8 h-8 rounded-md',
    md: 'w-9 h-9 rounded-lg',
    lg: 'w-10 h-10 rounded-lg',
};

/**
 * Botao icon-only para acoes compactas.
 * Exige aria-label no uso.
 */
export default function IconButton({
    variant = 'ghost',
    size = 'md',
    type = 'button',
    disabled = false,
    className = '',
    children,
    ...props
}) {
    const base = [
        'inline-flex items-center justify-center border transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.ghost,
        SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
        className,
    ].filter(Boolean).join(' ');

    return (
        <button type={type} disabled={disabled} className={base} {...props}>
            {children}
        </button>
    );
}
