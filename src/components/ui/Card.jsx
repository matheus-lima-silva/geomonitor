/**
 * Card — superfície branca com borda, sombra e bordas arredondadas.
 *
 * variant: 'default' | 'nested' | 'flat'
 *   default → fundo branco, sombra sutil, borda slate-300
 *   nested  → fundo branco, sombra leve, borda slate-200
 *   flat    → fundo branco, só borda
 */
const VARIANTS = {
    default: 'bg-white border border-slate-300 rounded-xl shadow-sm',
    nested: 'bg-white border border-slate-200 rounded-xl shadow-sm',
    flat: 'bg-white border border-slate-200 rounded-xl',
};

export default function Card({
    variant = 'default',
    className = '',
    children,
    style,
    ...props
}) {
    const classes = [VARIANTS[variant] ?? VARIANTS.default, 'p-4', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes} style={style} {...props}>
            {children}
        </div>
    );
}
