'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/Toast';

interface TransitionConfig {
  title: string;
  description: string;
  fromState: string;
  toState: string;
  variant: 'default' | 'warning' | 'danger';
  irreversible?: boolean;
  typedConfirmation?: string;
  summaryItems?: { label: string; value: string }[];
  onConfirm: () => Promise<void>;
  onUndo?: () => Promise<void>;
  successMessage?: string;
}

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  variant: 'default' | 'warning' | 'danger';
  loading: boolean;
  summaryItems?: { label: string; value: string }[];
  irreversibleWarning?: boolean;
  requireTypedConfirmation?: string;
}

/**
 * Hook that encapsulates the standard state transition pattern:
 * 1. Show ConfirmDialog with transition details
 * 2. On confirm, execute the API call
 * 3. On success, show toast (with undo action if reversible)
 * 4. On failure, show error toast
 *
 * Usage:
 * ```tsx
 * const { confirmDialogProps, requestTransition } = useTransitionConfirm();
 *
 * // In your handler:
 * requestTransition({
 *   title: 'Advance to Review',
 *   description: 'This will submit the event for review.',
 *   fromState: 'ESTIMATE_SUBMITTED',
 *   toState: 'ESTIMATE_UNDER_REVIEW',
 *   variant: 'default',
 *   summaryItems: [{ label: 'Event', value: eventNumber }],
 *   onConfirm: async () => { await transitionState(id, 'ESTIMATE_UNDER_REVIEW'); },
 *   onUndo: async () => { await revertShoppingEvent(id); },
 * });
 *
 * // In your JSX:
 * <ConfirmDialog {...confirmDialogProps} />
 * ```
 */
export function useTransitionConfirm() {
  const toast = useToast();
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    config: TransitionConfig | null;
    loading: boolean;
  }>({ open: false, config: null, loading: false });

  const requestTransition = useCallback((config: TransitionConfig) => {
    setDialogState({ open: true, config, loading: false });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!dialogState.config) return;
    const config = dialogState.config;

    setDialogState((prev) => ({ ...prev, loading: true }));
    try {
      await config.onConfirm();
      setDialogState({ open: false, config: null, loading: false });

      const msg = config.successMessage || `Transitioned to ${config.toState.replace(/_/g, ' ').toLowerCase()}`;

      if (config.onUndo && !config.irreversible) {
        toast.successWithUndo(msg, config.onUndo);
      } else {
        toast.success(msg);
      }
    } catch (err) {
      setDialogState((prev) => ({ ...prev, loading: false }));
      toast.error(
        'Transition failed',
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    }
  }, [dialogState.config, toast]);

  const handleCancel = useCallback(() => {
    setDialogState({ open: false, config: null, loading: false });
  }, []);

  const config = dialogState.config;

  const confirmDialogProps: ConfirmDialogProps = {
    open: dialogState.open,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    title: config?.title || '',
    description: config?.description || '',
    confirmLabel: config?.variant === 'danger'
      ? (config?.typedConfirmation ? 'Confirm' : 'Proceed')
      : 'Confirm',
    variant: config?.variant || 'default',
    loading: dialogState.loading,
    summaryItems: config?.summaryItems,
    irreversibleWarning: config?.irreversible,
    requireTypedConfirmation: config?.typedConfirmation,
  };

  return { confirmDialogProps, requestTransition };
}
