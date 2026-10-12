import HintText from './HintText';

/**
 * Checkbox padronizado com rotulo inline.
 *
 * Props:
 *   id        — obrigatorio quando ha label (liga o htmlFor)
 *   label     — texto a direita da caixa (ReactNode)
 *   hint      — tooltip de ajuda opcional (HintText)
 *   checked   — estado controlado
 *   onChange  — (event) => void
 *   disabled  — desabilita e esmaece
 *   size      — 'sm' (16px, texto xs) | 'md' (18px, texto sm)
 *   className — classes extras no container
 */
const SIZE_CLASSES = {
    sm: { box: 'w-4 h-4', text: 'text-xs' },
    md: { box: 'w-[18px] h-[18px]', text: 'text-sm' },
};

export default function Checkbox({
    id,
    label,
    hint,
    checked = false,
    onChange,
    disabled = false,
    size = 'sm',
    className = '',
    ...props
}) {
    const sizes = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;
    const boxClass = [
        'shrink-0 rounded border-slate-300 accent-brand-600 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:cursor-not-allowed',
        sizes.box,
    ].join(' ');

    const input = (
        <input
            id={id}
            type="checkbox"
            className={boxClass}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            {...props}
        />
    );

    if (!label) {
        return <span className={`inline-flex items-center ${className}`.trim()}>{input}</span>;
    }

    return (
        <span className={`inline-flex items-center gap-2 ${disabled ? 'opacity-50' : ''} ${className}`.trim()}>
            {input}
            <label htmlFor={id} className={`${sizes.text} text-slate-700 select-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                {label}
            </label>
            {hint ? <HintText label={typeof label === 'string' ? label : 'campo'}>{hint}</HintText> : null}
        </span>
    );
}
