import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="m20 6-11 11-5-5" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  ),
};

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setToast(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const api = useMemo(
    () => ({
      show(message, type = 'info', duration = 3000) {
        if (timerRef.current) clearTimeout(timerRef.current);
        setToast({ message, type });
        timerRef.current = setTimeout(() => setToast(null), duration);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <div className={[
          'fixed bottom-5 right-5 z-[200] flex items-center gap-2 text-white rounded-xl px-4 py-3 shadow-lg text-sm font-medium max-w-sm',
          toast.type === 'error' ? 'bg-red-700' :
          toast.type === 'success' ? 'bg-green-700' : 'bg-slate-700',
        ].join(' ')}>
          {ICONS[toast.type] || ICONS.info}
          <span className="flex-1">{toast.message}</span>
          <button type="button" onClick={dismiss} className="ml-2 opacity-70 hover:opacity-100" aria-label="Fechar">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado em ToastProvider');
  return context;
}
