/**
 * System Health Dashboard Service
 *
 * Provides real-time system health metrics for post go-live monitoring.
 */

import { query, queryOne } from '../config/database';

interface HealthDashboard {
  database: {
    connected: boolean;
    response_time_ms: number;
    active_connections: number;
    cache_hit_ratio: number;
    database_size: string;
  };
  system_mode: string;
  active_users_24h: number;
  recent_errors: {
    last_hour: number;
    last_24h: number;
  };
  data_counts: {
    cars: number;
    contracts: number;
    shopping_events: number;
    invoices: number;
    allocations: number;
  };
  recent_incidents: {
    open: number;
    p1_open: number;
  };
  feedback: {
    new_count: number;
    total: number;
  };
  integrations: {
    system: string;
    status: string;
    last_sync: string | null;
  }[];
}

export async function getHealthDashboard(): Promise<HealthDashboard> {
  const start = Date.now();

  // Test database connectivity and measure response time
  let dbConnected = true;
  let responseTime = 0;
  try {
    await queryOne<{ one: number }>('SELECT 1 AS one');
    responseTime = Date.now() - start;
  } catch {
    dbConnected = false;
    responseTime = Date.now() - start;
  }

  // Database stats
  const connStats = await queryOne<{ active: number }>(
    `SELECT COUNT(*) FILTER (WHERE state = 'active')::int AS active
     FROM pg_stat_activity WHERE datname = current_database()`
  );

  const hitRatio = await queryOne<{ cache_hit: number }>(
    `SELECT ROUND(COALESCE(
       100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 100
     ), 2) AS cache_hit FROM pg_statio_user_tables`
  );

  const dbSize = await queryOne<{ size: string }>(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`
  );

  // System mode
  const modeRow = await queryOne<{ value: string }>(
    `SELECT value::text FROM system_settings WHERE key = 'system_mode'`
  );
  const systemMode = modeRow?.value ? JSON.parse(modeRow.value) : 'unknown';

  // Active users (last 24h) — based on audit log or login timestamps
  const activeUsers = await queryOne<{ cnt: number }>(
    `SELECT COUNT(DISTINCT user_id)::int AS cnt
     FROM audit_log
     WHERE created_at >= NOW() - INTERVAL '24 hours'`
  ).catch(() => ({ cnt: 0 }));

  // Error counts from integration sync log
  const recentErrors = await queryOne<{ last_hour: number; last_24h: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'failed' AND synced_at >= NOW() - INTERVAL '1 hour')::int AS last_hour,
       COUNT(*) FILTER (WHERE status = 'failed' AND synced_at >= NOW() - INTERVAL '24 hours')::int AS last_24h
     FROM integration_sync_log`
  ).catch(() => ({ last_hour: 0, last_24h: 0 }));

  // Data counts
  const cars = await queryOne<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM cars').catch(() => ({ cnt: 0 }));
  const contracts = await queryOne<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM master_leases WHERE status = 'active'`).catch(() => ({ cnt: 0 }));
  const shopping = await queryOne<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM shopping_events').catch(() => ({ cnt: 0 }));
  const invoices = await queryOne<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM invoices').catch(() => ({ cnt: 0 }));
  const allocations = await queryOne<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM allocations').catch(() => ({ cnt: 0 }));

  // Incidents
  const incidentStats = await queryOne<{ open: number; p1_open: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('open', 'investigating'))::int AS open,
       COUNT(*) FILTER (WHERE severity = 'P1' AND status IN ('open', 'investigating'))::int AS p1_open
     FROM go_live_incidents`
  ).catch(() => ({ open: 0, p1_open: 0 }));

  // Feedback
  const feedbackStats = await queryOne<{ new_count: number; total: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
       COUNT(*)::int AS total
     FROM user_feedback`
  ).catch(() => ({ new_count: 0, total: 0 }));

  // Integration status
  const integrations = await query<{ system: string; status: string; last_sync: string }>(
    `SELECT DISTINCT ON (system_name)
       system_name AS system,
       status,
       synced_at::text AS last_sync
     FROM integration_sync_log
     ORDER BY system_name, synced_at DESC`
  ).catch(() => []);

  return {
    database: {
      connected: dbConnected,
      response_time_ms: responseTime,
      active_connections: connStats?.active || 0,
      cache_hit_ratio: hitRatio?.cache_hit || 0,
      database_size: dbSize?.size || '0',
    },
    system_mode: systemMode,
    active_users_24h: activeUsers?.cnt || 0,
    recent_errors: {
      last_hour: recentErrors?.last_hour || 0,
      last_24h: recentErrors?.last_24h || 0,
    },
    data_counts: {
      cars: cars?.cnt || 0,
      contracts: contracts?.cnt || 0,
      shopping_events: shopping?.cnt || 0,
      invoices: invoices?.cnt || 0,
      allocations: allocations?.cnt || 0,
    },
    recent_incidents: {
      open: incidentStats?.open || 0,
      p1_open: incidentStats?.p1_open || 0,
    },
    feedback: {
      new_count: feedbackStats?.new_count || 0,
      total: feedbackStats?.total || 0,
    },
    integrations,
  };
}
