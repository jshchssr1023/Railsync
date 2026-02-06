'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  /** Show a success toast with an "Undo" action button (6-second window). */
  successWithUndo: (title: string, undoFn: () => Promise<void>, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = toast.duration || (toast.type === 'error' ? 8000 : 5000);
      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'success', title, message });
    },
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'error', title, message, duration: 8000 });
    },
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'warning', title, message });
    },
    [addToast]
  );

  const info = useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'info', title, message });
    },
    [addToast]
  );

  const successWithUndo = useCallback(
    (title: string, undoFn: () => Promise<void>, message?: string) => {
      const toastId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const handleUndo = async () => {
        removeToast(toastId);
        try {
          await undoFn();
          addToast({ type: 'success', title: 'Reverted successfully' });
        } catch (err) {
          addToast({
            type: 'error',
            title: 'Revert failed',
            message: err instanceof Error ? err.message : 'Could not undo the action',
            duration: 8000,
          });
        }
      };
      const newToast: Toast = {
        id: toastId,
        type: 'success',
        title,
        message,
        duration: 6000,
        action: { label: 'Undo', onClick: handleUndo },
      };
      setToasts((prev) => [...prev, newToast]);
      setTimeout(() => {
        removeToast(toastId);
      }, 6000);
    },
    [addToast, removeToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, success, error, warning, info, successWithUndo }}
    >
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const toastStyles: Record<ToastType, { container: string; icon: ReactNode }> = {
  success: {
    container: 'bg-green-50 dark:bg-green-900/90 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200',
    icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
  },
  error: {
    container: 'bg-red-50 dark:bg-red-900/90 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200',
    icon: <XCircle className="w-5 h-5 text-red-500" />,
  },
  warning: {
    container: 'bg-orange-50 dark:bg-orange-900/90 border-orange-200 dark:border-orange-700 text-orange-800 dark:text-orange-200',
    icon: <AlertTriangle className="w-5 h-5 text-orange-500" />,
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200',
    icon: <Info className="w-5 h-5 text-blue-500" />,
  },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const style = toastStyles[toast.type];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm animate-slide-in ${style.container}`}
      role="alert"
    >
      <div className="flex-shrink-0" aria-hidden="true">{style.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.message && <p className="text-sm opacity-80 mt-0.5">{toast.message}</p>}
      </div>
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="flex-shrink-0 ml-2 px-2 py-1 text-xs font-semibold rounded bg-white/20 hover:bg-white/30 transition-colors underline"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 ml-2 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
