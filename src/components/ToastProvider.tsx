'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ToastContextValue {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast">
          {toasts.map((t) => (
            <div key={t.id} className={`toast__item toast__item--${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
