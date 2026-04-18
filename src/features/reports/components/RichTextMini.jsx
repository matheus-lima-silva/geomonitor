import { useRef } from 'react';
import AppIcon from '../../../components/AppIcon';
import HintText from '../../../components/ui/HintText';

// Markdown leve. O worker Python ainda trata o texto como string plain; no pior
// caso **x** passa cru para o DOCX (legivel). Processamento real de bold/italic/
// listas fica como follow-up no worker/.
const WRAPPERS = {
  bold: { prefix: '**', suffix: '**' },
  italic: { prefix: '*', suffix: '*' },
};

function insertAroundSelection(textareaEl, prefix, suffix) {
  const start = textareaEl.selectionStart;
  const end = textareaEl.selectionEnd;
  const value = textareaEl.value;
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);
  const nextValue = `${before}${prefix}${selected}${suffix}${after}`;
  const nextSelectionStart = start + prefix.length;
  const nextSelectionEnd = nextSelectionStart + selected.length;
  return { nextValue, nextSelectionStart, nextSelectionEnd };
}

function insertLineListMarker(textareaEl) {
  const start = textareaEl.selectionStart;
  const value = textareaEl.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const before = value.slice(0, lineStart);
  const after = value.slice(lineStart);
  const marker = '- ';
  const nextValue = `${before}${marker}${after}`;
  const nextSelectionStart = start + marker.length;
  return { nextValue, nextSelectionStart, nextSelectionEnd: nextSelectionStart };
}

export default function RichTextMini({
  label,
  id,
  hint,
  rows = 6,
  value = '',
  onChange,
  placeholder = '',
  disabled = false,
  className = '',
}) {
  const textareaRef = useRef(null);

  function apply(type) {
    const el = textareaRef.current;
    if (!el || disabled) return;
    let result;
    if (type === 'list') {
      result = insertLineListMarker(el);
    } else {
      const { prefix, suffix } = WRAPPERS[type];
      result = insertAroundSelection(el, prefix, suffix);
    }
    if (typeof onChange === 'function') {
      const syntheticEvent = { target: { value: result.nextValue } };
      onChange(syntheticEvent);
    }
    // Restaurar foco + seleção no próximo tick para o React já ter aplicado o value.
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd);
    });
  }

  const toolbarButtonClass = [
    'inline-flex h-7 w-7 items-center justify-center rounded-md',
    'border border-slate-200 bg-white text-slate-600',
    'hover:bg-slate-50 hover:text-slate-800',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
  ].join(' ');

  const textareaClass = [
    'border border-slate-300 rounded-md px-3 py-1.5 text-sm text-slate-800 bg-white w-full',
    'placeholder:text-slate-400',
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
    'disabled:bg-slate-100 disabled:cursor-not-allowed',
    'transition-shadow duration-150 resize-y',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 mb-1 text-2xs font-bold uppercase tracking-wide text-slate-500"
        >
          <span>{label}</span>
          {hint ? <HintText label={label}>{hint}</HintText> : null}
        </label>
      ) : null}

      <div className="flex items-center gap-1 mb-1.5">
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => apply('bold')}
          disabled={disabled}
          aria-label="Negrito"
          title="Negrito (**texto**)"
          data-testid="richtextmini-bold"
        >
          <AppIcon name="bold" size={14} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => apply('italic')}
          disabled={disabled}
          aria-label="Itálico"
          title="Itálico (*texto*)"
          data-testid="richtextmini-italic"
        >
          <AppIcon name="italic" size={14} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => apply('list')}
          disabled={disabled}
          aria-label="Lista"
          title="Lista (- item)"
          data-testid="richtextmini-list"
        >
          <AppIcon name="list" size={14} />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={textareaClass}
        data-testid={id ? `${id}-textarea` : undefined}
      />
    </div>
  );
}
