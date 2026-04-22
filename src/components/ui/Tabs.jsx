import { useEffect, useRef } from 'react';

/**
 * Primitive Tabs para segmentar formularios, paineis de detalhe e afins.
 * Controlled: o caller guarda o `activeKey` via useState/url-param.
 *
 * Props:
 *   items: [{ key, label, icon? (name para AppIcon), badge? }]
 *   activeKey
 *   onChange(nextKey)
 *   className?: classes extras no container da tablist
 *   ariaLabel?: rotulo acessivel do tablist
 *
 * Acessibilidade:
 *   - role="tablist" + role="tab" + aria-selected
 *   - setas Left/Right rotacionam foco entre tabs
 */
export default function Tabs({
  items = [],
  activeKey = '',
  onChange,
  className = '',
  ariaLabel = 'Abas',
}) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!items.length) return;
    const known = items.some((item) => item.key === activeKey);
    if (!known) onChange?.(items[0].key);
  }, [items, activeKey, onChange]);

  function handleKeyDown(event, index) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const total = items.length;
    let next = index;
    if (event.key === 'ArrowLeft') next = (index - 1 + total) % total;
    if (event.key === 'ArrowRight') next = (index + 1) % total;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = total - 1;
    const node = listRef.current?.querySelectorAll('[role="tab"]')?.[next];
    node?.focus();
    onChange?.(items[next].key);
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-1 border-b border-slate-200 ${className}`.trim()}
    >
      {items.map((item, idx) => {
        const selected = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange?.(item.key)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={[
              'relative px-3 py-2 text-sm font-semibold transition-colors duration-150 border-b-2 -mb-px',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-t',
              selected
                ? 'text-brand-700 border-brand-600'
                : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {item.badge != null && item.badge !== '' ? (
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-2xs font-bold rounded-full ${selected ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {item.badge}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
