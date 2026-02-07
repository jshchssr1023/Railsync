/**
 * Performance Monitoring Service
 *
 * Provides database performance insights for post go-live tuning.
 */

import { query, queryOne } from '../config/database';

interface TableSize {
  table_name: string;
  row_count: number;
  total_size: string;
  index_size: string;
  toast_size: string;
}

interface IndexUsage {
  table_name: string;
  index_name: string;
  index_scans: number;
  rows_read: number;
  index_size: string;
  is_unused: boolean;
}

interface DatabaseStats {
  total_connections: number;
  active_connections: number;
  idle_connections: number;
  database_size: string;
  cache_hit_ratio: number;
  index_hit_ratio: number;
  transactions_committed: number;
  transactions_rolled_back: number;
  deadlocks: number;
  uptime: string;
}

interface SlowQuery {
  query_text: string;
  calls: number;
  total_time_ms: number;
  mean_time_ms: number;
  max_time_ms: number;
  rows_returned: number;
}

/**
 * Get the largest tables by total size.
 */
export async function getTableSizes(limit: number = 30): Promise<TableSize[]> {
  return query<TableSize>(
    `SELECT
       relname AS table_name,
       n_live_tup::int AS row_count,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
       pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
       pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid) - pg_indexes_size(c.oid)) AS toast_size
     FROM pg_class c
     JOIN pg_stat_user_tables s ON c.relname = s.relname
     WHERE c.relkind = 'r'
     ORDER BY pg_total_relation_size(c.oid) DESC
     LIMIT $1`,
    [limit]
  );
}

/**
 * Get index usage statistics — identifies unused indexes.
 */
export async function getIndexUsage(limit: number = 50): Promise<IndexUsage[]> {
  return query<IndexUsage>(
    `SELECT
       schemaname || '.' || relname AS table_name,
       indexrelname AS index_name,
       idx_scan::int AS index_scans,
       idx_tup_read::int AS rows_read,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
       (idx_scan = 0) AS is_unused
     FROM pg_stat_user_indexes
     ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
     LIMIT $1`,
    [limit]
  );
}

/**
 * Get overall database statistics.
 */
export async function getDatabaseStats(): Promise<DatabaseStats> {
  const connStats = await queryOne<{ total: number; active: number; idle: number }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE state = 'active')::int AS active,
       COUNT(*) FILTER (WHERE state = 'idle')::int AS idle
     FROM pg_stat_activity
     WHERE datname = current_database()`
  );

  const dbSize = await queryOne<{ size: string }>(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`
  );

  const hitRatio = await queryOne<{ cache_hit: number; index_hit: number }>(
    `SELECT
       ROUND(COALESCE(
         100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0),
         100
       ), 2) AS cache_hit,
       ROUND(COALESCE(
         100.0 * sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0),
         100
       ), 2) AS index_hit
     FROM pg_statio_user_tables`
  );

  const txnStats = await queryOne<{ committed: number; rolled_back: number; deadlocks: number }>(
    `SELECT
       xact_commit::int AS committed,
       xact_rollback::int AS rolled_back,
       deadlocks::int AS deadlocks
     FROM pg_stat_database
     WHERE datname = current_database()`
  );

  const uptime = await queryOne<{ uptime: string }>(
    `SELECT age(now(), pg_postmaster_start_time())::text AS uptime`
  );

  return {
    total_connections: connStats?.total || 0,
    active_connections: connStats?.active || 0,
    idle_connections: connStats?.idle || 0,
    database_size: dbSize?.size || '0',
    cache_hit_ratio: hitRatio?.cache_hit || 0,
    index_hit_ratio: hitRatio?.index_hit || 0,
    transactions_committed: txnStats?.committed || 0,
    transactions_rolled_back: txnStats?.rolled_back || 0,
    deadlocks: txnStats?.deadlocks || 0,
    uptime: uptime?.uptime || 'unknown',
  };
}

/**
 * Get slow queries from pg_stat_statements (if extension is available).
 * Falls back gracefully if the extension is not installed.
 */
export async function getSlowQueries(limit: number = 20): Promise<SlowQuery[]> {
  try {
    return await query<SlowQuery>(
      `SELECT
         LEFT(query, 200) AS query_text,
         calls::int,
         ROUND(total_exec_time::numeric, 2) AS total_time_ms,
         ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
         ROUND(max_exec_time::numeric, 2) AS max_time_ms,
         rows::int AS rows_returned
       FROM pg_stat_statements
       WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
         AND calls > 0
       ORDER BY mean_exec_time DESC
       LIMIT $1`,
      [limit]
    );
  } catch {
    // pg_stat_statements extension not available
    return [];
  }
}
