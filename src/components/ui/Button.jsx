/**
 * Componente Button padronizado — substitui botões ad-hoc em toda a aplicação.
 *
 * Variantes:
 *   primary   → azul sólido (ação principal)
 *   secondary → cinza escuro
 *   outline   → borda + fundo transparente
 *   ghost     → sem borda, fundo sutilmente colorido no hover
 *   danger    → vermelho (ações destrutivas)
 *
 * Tamanhos:
 *   sm  → compacto (28px altura)
 *   md  → padrão  (34px altura) ← default
 *   lg  → amplo   (40px altura)
 */
const VARIANT_CLASSES = {
    primary: 'bg-brand-600 text-white border-transparent hover:bg-brand-700 active:bg-brand-900',
    secondary: 'bg-slate-600 text-white border-transparent hover:bg-slate-700',
    outline: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    ghost: 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800',
    danger: 'bg-danger text-white border-transparent hover:bg-danger-dark',
};

const SIZE_CLASSES = {
    sm: 'min-h-btn-sm px-2.5 gap-1.5 text-xs rounded',
    md: 'min-h-btn   px-3   gap-2   text-sm rounded-md',
    lg: 'min-h-btn-lg px-4  gap-2   text-base rounded-md',
};

export default function Button({
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    className = '',
    children,
    ...props
}) {
    const base = [
        'inline-flex items-center justify-center font-semibold border transition-colors duration-150 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary,
        SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
        className,
    ].filter(Boolean).join(' ');

    return (
        <button type={type} disabled={disabled} className={base} {...props}>
            {children}
        </button>
    );
}
