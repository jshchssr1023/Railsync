'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

type ConfirmVariant = 'danger' | 'warning' | 'default';

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  /** Optional read-only summary items displayed before the action buttons */
  summaryItems?: { label: string; value: string }[];
}

const variantStyles: Record<ConfirmVariant, {
  icon: React.ReactNode;
  iconBg: string;
  confirmBtn: string;
}> = {
  danger: {
    icon: <Trash2 className="w-5 h-5" />,
    iconBg: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white',
  },
  default: {
    icon: <AlertTriangle className="w-5 h-5" />,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    confirmBtn: 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 text-white',
  },
};

export default function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  summaryItems,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const styles = variantStyles[variant];

  // Focus the cancel button when the dialog opens
  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onCancel} aria-hidden="true" />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6">
            {/* Icon + Title */}
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${styles.iconBg}`}>
                {styles.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h3>
                {description && (
                  <p id="confirm-dialog-description" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {/* Summary items (read-only validation checkpoint) */}
            {summaryItems && summaryItems.length > 0 && (
              <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2">
                {summaryItems.map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex gap-3 justify-end">
              <button
                ref={cancelRef}
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${styles.confirmBtn} ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Processing...' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
