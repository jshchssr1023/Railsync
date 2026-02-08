'use client';

import { useState, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FilterPreset {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function storageKey(pageKey: string): string {
  return `railsync_presets_${pageKey}`;
}

function loadPresets(pageKey: string): FilterPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(pageKey));
    return raw ? (JSON.parse(raw) as FilterPreset[]) : [];
  } catch {
    return [];
  }
}

function persistPresets(pageKey: string, presets: FilterPreset[]): void {
  try {
    localStorage.setItem(storageKey(pageKey), JSON.stringify(presets));
  } catch {
    // localStorage may be full or blocked — fail silently
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages saved filter presets per page, backed by localStorage.
 *
 * @param pageKey  Unique key for the page (e.g. "shopping", "cars", "invoices").
 *                 Presets are stored under `railsync_presets_${pageKey}`.
 * @param onApply  Callback invoked when a preset is applied. Receives the
 *                 preset's `filters` record so the consumer can push them into
 *                 URL state (via `useURLFilters.setFilters`).
 */
export function useFilterPresets(
  pageKey: string,
  onApply?: (filters: Record<string, string>) => void,
) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    setPresets(loadPresets(pageKey));
  }, [pageKey]);

  const savePreset = useCallback(
    (name: string, filters: Record<string, string>) => {
      setPresets((prev) => {
        const next: FilterPreset[] = [
          ...prev,
          { id: generateId(), name, filters, createdAt: Date.now() },
        ];
        persistPresets(pageKey, next);
        return next;
      });
    },
    [pageKey],
  );

  const deletePreset = useCallback(
    (id: string) => {
      setPresets((prev) => {
        const next = prev.filter((p) => p.id !== id);
        persistPresets(pageKey, next);
        return next;
      });
    },
    [pageKey],
  );

  const applyPreset = useCallback(
    (preset: FilterPreset) => {
      onApply?.(preset.filters);
    },
    [onApply],
  );

  return { presets, savePreset, deletePreset, applyPreset } as const;
}
