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
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado em ToastProvider');
  return context;
}
