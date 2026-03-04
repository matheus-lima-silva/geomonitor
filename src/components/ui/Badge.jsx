/**
 * Badge / Chip de status padronizado.
 *
 * tone: 'ok' | 'warning' | 'danger' | 'critical' | 'neutral' | string
 * size: 'sm' | 'md'
 */
const TONE_CLASSES = {
    ok: 'bg-success-light text-green-800 border-success-border',
    warning: 'bg-warning-light text-yellow-900 border-warning-border',
    danger: 'bg-danger-light  text-red-700   border-danger-border',
    critical: 'bg-critical-light text-red-900  border-red-300',
    neutral: 'bg-slate-50 text-slate-600 border-slate-300',
};

const SIZE_CLASSES = {
    sm: 'px-2 py-0.5 text-2xs rounded',
    md: 'px-2.5 py-1 text-xs rounded-md',
};

export default function Badge({
    tone = 'neutral',
    size = 'sm',
    className = '',
    children,
    ...props
}) {
    const base = [
        'inline-flex items-center border font-semibold whitespace-nowrap',
        TONE_CLASSES[tone] ?? TONE_CLASSES.neutral,
        SIZE_CLASSES[size] ?? SIZE_CLASSES.sm,
        className,
    ].filter(Boolean).join(' ');

    return (
        <span className={base} {...props}>
            {children}
        </span>
    );
}
