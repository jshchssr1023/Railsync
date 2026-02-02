/**
 * useOptimisticCapacity Hook
 * Manages optimistic UI updates for capacity changes with rollback support
 */

import { useState, useCallback, useMemo } from 'react';
import { ShopMonthlyCapacity } from '@/types';

interface OptimisticUpdate {
  id: string;
  shopCode: string;
  month: string;
  delta: number; // Change in allocated_count (+1 for add, -1 for remove)
  timestamp: number;
}

interface UseOptimisticCapacityReturn {
  pendingUpdates: Map<string, OptimisticUpdate>;
  applyOptimisticUpdates: (capacityData: ShopMonthlyCapacity[]) => ShopMonthlyCapacity[];
  addOptimisticUpdate: (shopCode: string, month: string, delta: number) => string;
  confirmUpdate: (shopCode: string, month: string) => void;
  rollbackUpdate: (shopCode: string, month: string) => void;
  clearAllUpdates: () => void;
  hasPendingUpdates: boolean;
}

// Timeout for auto-rollback of stale optimistic updates (30 seconds)
const OPTIMISTIC_UPDATE_TIMEOUT = 30000;

export function useOptimisticCapacity(): UseOptimisticCapacityReturn {
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, OptimisticUpdate>>(new Map());

  /**
   * Apply optimistic updates to capacity data for display
   */
  const applyOptimisticUpdates = useCallback((
    capacityData: ShopMonthlyCapacity[]
  ): ShopMonthlyCapacity[] => {
    if (pendingUpdates.size === 0) return capacityData;

    const now = Date.now();

    return capacityData.map(cap => {
      const key = `${cap.shop_code}:${cap.month}`;
      const update = pendingUpdates.get(key);

      if (!update) return cap;

      // Skip stale updates (older than timeout)
      if (now - update.timestamp > OPTIMISTIC_UPDATE_TIMEOUT) {
        return cap;
      }

      const newAllocated = Math.max(0, cap.allocated_count + update.delta);
      const newAvailable = Math.max(0, cap.total_capacity - newAllocated);
      const newUtilization = cap.total_capacity > 0
        ? Math.round((newAllocated / cap.total_capacity) * 100)
        : 0;

      return {
        ...cap,
        allocated_count: newAllocated,
        available_capacity: newAvailable,
        utilization_pct: newUtilization,
      };
    });
  }, [pendingUpdates]);

  /**
   * Add an optimistic update (e.g., when user assigns a car to a shop)
   * Returns the update ID for tracking
   */
  const addOptimisticUpdate = useCallback((
    shopCode: string,
    month: string,
    delta: number
  ): string => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const key = `${shopCode}:${month}`;

    setPendingUpdates(prev => {
      const next = new Map(prev);
      const existing = next.get(key);

      next.set(key, {
        id,
        shopCode,
        month,
        delta: (existing?.delta || 0) + delta,
        timestamp: Date.now(),
      });

      return next;
    });

    return id;
  }, []);

  /**
   * Confirm an optimistic update (called when server confirms the change)
   */
  const confirmUpdate = useCallback((shopCode: string, month: string) => {
    const key = `${shopCode}:${month}`;
    setPendingUpdates(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  /**
   * Rollback an optimistic update (called on error or conflict)
   */
  const rollbackUpdate = useCallback((shopCode: string, month: string) => {
    const key = `${shopCode}:${month}`;
    setPendingUpdates(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  /**
   * Clear all pending updates
   */
  const clearAllUpdates = useCallback(() => {
    setPendingUpdates(new Map());
  }, []);

  const hasPendingUpdates = useMemo(() => pendingUpdates.size > 0, [pendingUpdates]);

  return {
    pendingUpdates,
    applyOptimisticUpdates,
    addOptimisticUpdate,
    confirmUpdate,
    rollbackUpdate,
    clearAllUpdates,
    hasPendingUpdates,
  };
}

export default useOptimisticCapacity;
