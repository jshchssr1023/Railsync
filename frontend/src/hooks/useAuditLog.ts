'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuditLogs, AuditLogEntry } from '@/lib/api';

interface UseAuditLogParams {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

interface UseAuditLogReturn {
  entries: AuditLogEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAuditLog(params?: UseAuditLogParams): UseAuditLogReturn {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditLogs(params);
      setEntries(result.logs);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params?.entity_type,
    params?.entity_id,
    params?.action,
    params?.limit,
    params?.offset,
  ]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    entries,
    total,
    loading,
    error,
    refetch: fetch,
  };
}
