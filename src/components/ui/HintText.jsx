import { useId, useState } from 'react';

function HintText({ children, label = 'campo' }) {
  const [isOpen, setIsOpen] = useState(false);
  const hintId = useId();

  if (!children) return null;

  function openHint() {
    setIsOpen(true);
  }

  function closeHint() {
    setIsOpen(false);
  }

  function toggleHint(event) {
    event.preventDefault();
    event.stopPropagation();
    setIsOpen((current) => !current);
  }

  function handleKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setIsOpen(false);
    event.currentTarget.blur();
  }

  return (
    <span
      className="relative inline-flex shrink-0"
      onMouseEnter={openHint}
      onMouseLeave={closeHint}
    >
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold leading-none text-slate-500 shadow-sm transition hover:border-brand-300 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        aria-label={`Ajuda: ${label}`}
        aria-controls={hintId}
        aria-describedby={isOpen ? hintId : undefined}
        aria-expanded={isOpen}
        onClick={toggleHint}
        onFocus={openHint}
        onBlur={closeHint}
        onKeyDown={handleKeyDown}
      >
        ?
      </button>

      {isOpen ? (
        <span
          id={hintId}
          role="tooltip"
          className="absolute left-1/2 top-[calc(100%+0.5rem)] z-30 w-64 max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-left text-xs font-medium leading-snug text-white shadow-xl"
        >
          <span
            className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-slate-200 bg-slate-900"
            aria-hidden="true"
          />
          <span className="relative block">{children}</span>
        </span>
      ) : null}
    </span>
  );
}

export default HintText;
