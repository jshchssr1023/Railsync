/**
 * Integration Monitor Service
 *
 * Provides:
 * 1. Error classification for integration sync failures
 * 2. Health dashboard aggregating per-system metrics
 * 3. Batch retry by error category
 * 4. Error trend analysis over time
 */

import { query } from '../config/database';
import { getCircuitStatus } from './retry-queue.service';

// =============================================================================
// ERROR CLASSIFICATION
// =============================================================================

export interface ErrorClassification {
  category: 'auth' | 'network' | 'validation' | 'rate_limit' | 'data' | 'unknown';
  severity: 'critical' | 'warning' | 'info';
  retriable: boolean;
  suggestedAction: string;
}

const CLASSIFICATION_RULES: Array<{
  category: ErrorClassification['category'];
  patterns: string[];
  severity: ErrorClassification['severity'];
  retriable: boolean;
  suggestedAction: string;
}> = [
  {
    category: 'auth',
    patterns: ['unauthorized', '401', 'token expired', 'authentication'],
    severity: 'critical',
    retriable: false,
    suggestedAction: 'Check API credentials and refresh authentication tokens for the target system.',
  },
  {
    category: 'network',
    patterns: ['ECONNREFUSED', 'timeout', 'ETIMEDOUT', 'network', 'ENOTFOUND'],
    severity: 'warning',
    retriable: true,
    suggestedAction: 'Verify network connectivity and that the external system is reachable.',
  },
  {
    category: 'validation',
    patterns: ['required field', 'invalid', 'constraint', 'schema'],
    severity: 'warning',
    retriable: false,
    suggestedAction: 'Review the payload data against the target system schema and fix validation errors.',
  },
  {
    category: 'rate_limit',
    patterns: ['rate limit', '429', 'too many requests'],
    severity: 'warning',
    retriable: true,
    suggestedAction: 'Wait for the rate limit window to reset before retrying. Consider reducing sync frequency.',
  },
  {
    category: 'data',
    patterns: ['not found', 'duplicate', 'foreign key', 'null value'],
    severity: 'info',
    retriable: false,
    suggestedAction: 'Check that referenced entities exist and data integrity constraints are satisfied.',
  },
];

export function classifyError(errorMessage: string): ErrorClassification {
  const lower = errorMessage.toLowerCase();

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.patterns.some((pattern) => lower.includes(pattern.toLowerCase()))) {
      return {
        category: rule.category,
        severity: rule.severity,
        retriable: rule.retriable,
        suggestedAction: rule.suggestedAction,
      };
    }
  }

  return {
    category: 'unknown',
    severity: 'warning',
    retriable: true,
    suggestedAction: 'Investigate the error message manually. No automatic classification matched.',
  };
}

// =============================================================================
// CATEGORY PATTERN MAPPING (for SQL ILIKE queries)
// =============================================================================

function getCategoryPatterns(category: string): string[] {
  const rule = CLASSIFICATION_RULES.find((r) => r.category === category);
  if (!rule) return [];
  return rule.patterns;
}

// =============================================================================
// HEALTH DASHBOARD
// =============================================================================

interface SystemHealth {
  system_name: string;
  success_count_24h: number;
  failure_count_24h: number;
  error_rate_pct: number;
  most_common_error_category: string | null;
  circuit_breaker_state: string;
}

interface ErrorBreakdown {
  category: string;
  count: number;
  latest_message: string | null;
}

interface ThroughputEntry {
  hour: string;
  count: number;
  success_count: number;
  failure_count: number;
}

export async function getIntegrationHealthDashboard(): Promise<{
  systems: SystemHealth[];
  error_breakdown: ErrorBreakdown[];
  throughput: ThroughputEntry[];
}> {
  const systemNames = ['sap', 'salesforce', 'clm', 'railinc'];

  // Per-system health summary (last 24h)
  const systemHealthRows = await query<{
    system_name: string;
    success_count: string;
    failure_count: string;
  }>(
    `SELECT
       system_name,
       COUNT(*) FILTER (WHERE status = 'success') AS success_count,
       COUNT(*) FILTER (WHERE status = 'failed') AS failure_count
     FROM integration_sync_log
     WHERE created_at >= NOW() - INTERVAL '24 hours'
     GROUP BY system_name`
  );

  // Most common error message per system (last 24h)
  const commonErrorRows = await query<{
    system_name: string;
    error_message: string;
    err_count: string;
  }>(
    `SELECT DISTINCT ON (system_name)
       system_name, error_message, COUNT(*) AS err_count
     FROM integration_sync_log
     WHERE status = 'failed'
       AND created_at >= NOW() - INTERVAL '24 hours'
       AND error_message IS NOT NULL
     GROUP BY system_name, error_message
     ORDER BY system_name, err_count DESC`
  );

  const healthMap = new Map(systemHealthRows.map((r) => [r.system_name, r]));
  const errorMap = new Map(commonErrorRows.map((r) => [r.system_name, r]));

  const systems: SystemHealth[] = systemNames.map((name) => {
    const h = healthMap.get(name);
    const successCount = parseInt(h?.success_count || '0');
    const failureCount = parseInt(h?.failure_count || '0');
    const total = successCount + failureCount;
    const errorRate = total > 0 ? Math.round((failureCount / total) * 10000) / 100 : 0;

    const commonErr = errorMap.get(name);
    const mostCommonCategory = commonErr
      ? classifyError(commonErr.error_message).category
      : null;

    const circuitState = getCircuitStatus(name);

    return {
      system_name: name,
      success_count_24h: successCount,
      failure_count_24h: failureCount,
      error_rate_pct: errorRate,
      most_common_error_category: mostCommonCategory,
      circuit_breaker_state: circuitState.state,
    };
  });

  // Error breakdown (last 7 days)
  const failedEntries = await query<{ error_message: string }>(
    `SELECT error_message
     FROM integration_sync_log
     WHERE status = 'failed'
       AND error_message IS NOT NULL
       AND created_at >= NOW() - INTERVAL '7 days'`
  );

  const categoryAgg: Record<string, { count: number; latest_message: string | null }> = {};
  for (const entry of failedEntries) {
    const classification = classifyError(entry.error_message);
    if (!categoryAgg[classification.category]) {
      categoryAgg[classification.category] = { count: 0, latest_message: null };
    }
    categoryAgg[classification.category].count++;
    categoryAgg[classification.category].latest_message = entry.error_message;
  }

  const error_breakdown: ErrorBreakdown[] = Object.entries(categoryAgg)
    .map(([category, agg]) => ({
      category,
      count: agg.count,
      latest_message: agg.latest_message,
    }))
    .sort((a, b) => b.count - a.count);

  // Throughput (entries per hour over last 24h)
  const throughput = await query<ThroughputEntry>(
    `SELECT
       date_trunc('hour', created_at) AS hour,
       COUNT(*)::int AS count,
       COUNT(*) FILTER (WHERE status = 'success')::int AS success_count,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failure_count
     FROM integration_sync_log
     WHERE created_at >= NOW() - INTERVAL '24 hours'
     GROUP BY date_trunc('hour', created_at)
     ORDER BY hour`
  );

  return { systems, error_breakdown, throughput };
}

// =============================================================================
// BATCH RETRY BY CATEGORY
// =============================================================================

export async function batchRetryByCategory(
  category: string,
  systemName?: string
): Promise<{ updated_count: number }> {
  const patterns = getCategoryPatterns(category);

  if (patterns.length === 0) {
    return { updated_count: 0 };
  }

  // Build ILIKE conditions for the category patterns
  const conditions = patterns.map((_, i) => `error_message ILIKE $${i + 1}`);
  const params: any[] = patterns.map((p) => `%${p}%`);

  let sql = `
    UPDATE integration_sync_log
    SET status = 'retrying',
        retry_count = 0,
        next_retry_at = NOW(),
        updated_at = NOW()
    WHERE status = 'failed'
      AND (${conditions.join(' OR ')})`;

  if (systemName) {
    params.push(systemName);
    sql += ` AND system_name = $${params.length}`;
  }

  sql += ' RETURNING id';

  const result = await query(sql, params);
  return { updated_count: result.length };
}

// =============================================================================
// ERROR TRENDS
// =============================================================================

export async function getErrorTrends(
  days: number = 7
): Promise<Array<{ date: string; category: string; count: number }>> {
  const failedEntries = await query<{ created_date: string; error_message: string }>(
    `SELECT
       date_trunc('day', created_at)::date::text AS created_date,
       error_message
     FROM integration_sync_log
     WHERE status = 'failed'
       AND error_message IS NOT NULL
       AND created_at >= NOW() - ($1 || ' days')::interval`,
    [days]
  );

  // Aggregate by date + classified category
  const agg: Record<string, Record<string, number>> = {};

  for (const entry of failedEntries) {
    const classification = classifyError(entry.error_message);
    const dateKey = entry.created_date;
    if (!agg[dateKey]) agg[dateKey] = {};
    agg[dateKey][classification.category] = (agg[dateKey][classification.category] || 0) + 1;
  }

  const trends: Array<{ date: string; category: string; count: number }> = [];
  for (const [date, categories] of Object.entries(agg)) {
    for (const [category, count] of Object.entries(categories)) {
      trends.push({ date, category, count });
    }
  }

  trends.sort((a, b) => a.date.localeCompare(b.date) || b.count - a.count);

  return trends;
}
