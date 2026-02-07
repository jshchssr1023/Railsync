'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

/**
 * Syncs filter state bidirectionally with URL search params.
 *
 * - Reading: initialises from current URL params, falling back to `defaults`.
 * - Writing: `setFilter` / `setFilters` update the URL (replace, not push).
 * - `clearFilters` resets to `defaults` and updates the URL.
 *
 * The hook is intentionally stateless on the React side: the URL *is* the
 * source of truth, and `useSearchParams()` provides reactivity when the URL
 * changes (e.g. shared link, back/forward navigation).
 */
export function useURLFilters(defaults: Record<string, string>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive current filter values from URL, falling back to defaults
  const filters: Record<string, string> = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of Object.keys(defaults)) {
      result[key] = searchParams.get(key) ?? defaults[key];
    }
    return result;
  }, [searchParams, defaults]);

  // Build a new URL search string and replace the current entry
  const replaceURL = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        // Only set non-empty, non-default values to keep the URL clean
        if (value && value !== defaults[key]) {
          params.set(key, value);
        }
      }
      // Preserve any params that are NOT part of our managed filter keys
      searchParams.forEach((value, key) => {
        if (!(key in defaults)) {
          params.set(key, value);
        }
      });
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, pathname, searchParams, defaults],
  );

  // Set a single filter key
  const setFilter = useCallback(
    (key: string, value: string) => {
      replaceURL({ ...filters, [key]: value });
    },
    [filters, replaceURL],
  );

  // Set multiple filter keys at once
  const setFilters = useCallback(
    (patch: Record<string, string>) => {
      replaceURL({ ...filters, ...patch });
    },
    [filters, replaceURL],
  );

  // Reset all filters to their defaults
  const clearFilters = useCallback(() => {
    replaceURL({ ...defaults });
  }, [defaults, replaceURL]);

  return { filters, setFilter, setFilters, clearFilters } as const;
}
