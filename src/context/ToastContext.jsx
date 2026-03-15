import { createContext, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const api = useMemo(
    () => ({
      show(message, type = 'info') {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <div className={[
          'fixed bottom-5 right-5 z-[200] text-white rounded-xl px-4 py-3 shadow-lg text-sm font-medium max-w-sm',
          toast.type === 'error' ? 'bg-red-700' :
          toast.type === 'success' ? 'bg-green-700' : 'bg-slate-700',
        ].join(' ')}>
          {toast.message}
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
