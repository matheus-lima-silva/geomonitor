import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HintText from './HintText';

/**
 * Select with integrated search — forces selection of a valid option.
 *
 * Props:
 *   options     — [{ value: string, label: string }]
 *   value       — currently selected value
 *   onChange    — (value: string) => void
 *   label       — optional label text
 *   placeholder — placeholder when nothing selected
 *   disabled    — disables interaction
 *   id          — input id
 *   hint        — optional hint tooltip
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  label,
  placeholder = 'Selecionar...',
  disabled = false,
  id,
  hint,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedLabel = useMemo(() => {
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : '';
  }, [options, value]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, search]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || highlightIdx < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[highlightIdx]) {
      items[highlightIdx].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx, open]);

  const handleFocus = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setSearch('');
    setHighlightIdx(-1);
  }, [disabled]);

  const handleSelect = useCallback(
    (opt) => {
      onChange?.(opt.value);
      setOpen(false);
      setSearch('');
      inputRef.current?.blur();
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          setOpen(true);
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < filtered.length) {
          handleSelect(filtered[highlightIdx]);
        } else if (filtered.length === 1) {
          handleSelect(filtered[0]);
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
        inputRef.current?.blur();
      }
    },
    [open, filtered, highlightIdx, handleSelect],
  );

  const inputClass = [
    'border rounded-md px-3 py-1.5 text-sm bg-white w-full',
    'placeholder:text-slate-400',
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
    'disabled:bg-slate-100 disabled:cursor-not-allowed',
    'transition-shadow duration-150',
    'border-slate-300',
    open ? 'text-slate-800' : (value ? 'text-slate-800' : 'text-slate-400'),
  ].join(' ');

  return (
    <div className="w-full relative" ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 mb-1 text-2xs font-bold uppercase tracking-wide text-slate-500"
        >
          <span>{label}</span>
          {hint ? <HintText label={label}>{hint}</HintText> : null}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        className={inputClass}
        value={open ? search : selectedLabel}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          setHighlightIdx(-1);
        }}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {/* Chevron icon */}
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        {label && <div className="h-5" />}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-400">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400 italic">Nenhum resultado</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value}
                className={[
                  'px-3 py-1.5 text-sm cursor-pointer',
                  opt.value === value ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700',
                  i === highlightIdx ? 'bg-brand-100' : '',
                  'hover:bg-brand-50',
                ].join(' ')}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
                onMouseEnter={() => setHighlightIdx(i)}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
