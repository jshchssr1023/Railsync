/**
 * Parallel Run Comparison Service
 *
 * Compares CIPROTS outputs to RailSync outputs for validation.
 * Used during migration phase to ensure billing parity.
 */

import { query, queryOne } from '../config/database';

// =============================================================================
// TYPES
// =============================================================================

interface ParallelRunResult {
  id: string;
  run_date: string;
  comparison_type: string;
  ciprots_count: number;
  railsync_count: number;
  match_count: number;
  mismatch_count: number;
  ciprots_only_count: number;
  railsync_only_count: number;
  match_pct: number;
  summary: any;
}

interface Discrepancy {
  id: string;
  entity_ref: string;
  field_name: string;
  ciprots_value: string | null;
  railsync_value: string | null;
  severity: string;
  resolved: boolean;
}

interface InvoiceComparisonRow {
  invoice_number: string;
  customer_code: string;
  total_amount: string;
  line_count: string;
}

// =============================================================================
// COMPARE INVOICES
// =============================================================================

/**
 * Compare invoice outputs from CIPROTS CSV against RailSync billing data.
 * CIPROTS CSV expected columns: invoice_number, customer_code, total_amount, line_count
 */
export async function compareInvoices(
  ciprotsCsv: string,
  billingPeriod: string // 'YYYY-MM'
): Promise<ParallelRunResult> {
  // Parse CIPROTS CSV
  const lines = ciprotsCsv.split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_')) || [];
  const ciprotsRows: InvoiceComparisonRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    ciprotsRows.push({
      invoice_number: row.invoice_number || row.invoice_no || '',
      customer_code: row.customer_code || row.customer || '',
      total_amount: row.total_amount || row.total || '0',
      line_count: row.line_count || row.lines || '0',
    });
  }

  // Get RailSync invoices for the period
  const railsyncInvoices = await query<{ invoice_number: string; customer_code: string; total_amount: number; line_count: number }>(
    `SELECT
       oi.invoice_number,
       c.customer_code,
       oi.total_amount,
       (SELECT COUNT(*) FROM outbound_invoice_line_items WHERE outbound_invoice_id = oi.id) as line_count
     FROM outbound_invoices oi
     JOIN customers c ON c.id = oi.customer_id
     WHERE oi.billing_period = $1`,
    [billingPeriod]
  );

  // Build lookup maps
  const ciprotsMap = new Map(ciprotsRows.map(r => [r.invoice_number, r]));
  const railsyncMap = new Map(railsyncInvoices.map(r => [r.invoice_number, r]));

  let matchCount = 0;
  let mismatchCount = 0;
  const ciprotsOnlyInvoices: string[] = [];
  const railsyncOnlyInvoices: string[] = [];

  // Create the parallel run record
  const runResult = await queryOne<{ id: string }>(
    `INSERT INTO parallel_run_results (run_date, comparison_type, ciprots_count, railsync_count)
     VALUES (CURRENT_DATE, 'invoices', $1, $2) RETURNING id`,
    [ciprotsRows.length, railsyncInvoices.length]
  );
  const runId = runResult!.id;

  // Compare
  for (const [invNum, ciprotsRow] of ciprotsMap) {
    const rsRow = railsyncMap.get(invNum);
    if (!rsRow) {
      ciprotsOnlyInvoices.push(invNum);
      await query(
        `INSERT INTO parallel_run_discrepancies (parallel_run_id, entity_ref, field_name, ciprots_value, railsync_value, severity)
         VALUES ($1, $2, 'existence', 'present', 'missing', 'critical')`,
        [runId, invNum]
      );
      continue;
    }

    const ciprotsTotal = parseFloat(ciprotsRow.total_amount) || 0;
    const rsTotal = rsRow.total_amount || 0;
    const diff = Math.abs(ciprotsTotal - rsTotal);

    if (diff < 0.01) {
      matchCount++;
    } else {
      mismatchCount++;
      const severity = diff > 100 ? 'critical' : diff > 10 ? 'warning' : 'info';
      await query(
        `INSERT INTO parallel_run_discrepancies (parallel_run_id, entity_ref, field_name, ciprots_value, railsync_value, severity)
         VALUES ($1, $2, 'total_amount', $3, $4, $5)`,
        [runId, invNum, ciprotsTotal.toString(), rsTotal.toString(), severity]
      );
    }
  }

  for (const [invNum] of railsyncMap) {
    if (!ciprotsMap.has(invNum)) {
      railsyncOnlyInvoices.push(invNum);
      await query(
        `INSERT INTO parallel_run_discrepancies (parallel_run_id, entity_ref, field_name, ciprots_value, railsync_value, severity)
         VALUES ($1, $2, 'existence', 'missing', 'present', 'warning')`,
        [runId, invNum]
      );
    }
  }

  const total = Math.max(ciprotsRows.length, railsyncInvoices.length, 1);
  const matchPct = Math.round((matchCount / total) * 10000) / 100;

  await query(
    `UPDATE parallel_run_results SET
       match_count = $2, mismatch_count = $3, ciprots_only_count = $4,
       railsync_only_count = $5, match_pct = $6,
       summary = $7
     WHERE id = $1`,
    [
      runId, matchCount, mismatchCount,
      ciprotsOnlyInvoices.length, railsyncOnlyInvoices.length,
      matchPct,
      JSON.stringify({ billing_period: billingPeriod, ciprots_only: ciprotsOnlyInvoices.slice(0, 20), railsync_only: railsyncOnlyInvoices.slice(0, 20) }),
    ]
  );

  return {
    id: runId,
    run_date: new Date().toISOString().slice(0, 10),
    comparison_type: 'invoices',
    ciprots_count: ciprotsRows.length,
    railsync_count: railsyncInvoices.length,
    match_count: matchCount,
    mismatch_count: mismatchCount,
    ciprots_only_count: ciprotsOnlyInvoices.length,
    railsync_only_count: railsyncOnlyInvoices.length,
    match_pct: matchPct,
    summary: { billing_period: billingPeriod },
  };
}

// =============================================================================
// COMPARE CAR STATUSES
// =============================================================================

export async function compareCarStatuses(ciprotsCsv: string): Promise<ParallelRunResult> {
  const lines = ciprotsCsv.split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_')) || [];
  const ciprotsRows: { car_number: string; status: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    ciprotsRows.push({
      car_number: row.car_number || row.car_no || '',
      status: row.status || row.current_status || '',
    });
  }

  const runResult = await queryOne<{ id: string }>(
    `INSERT INTO parallel_run_results (run_date, comparison_type, ciprots_count)
     VALUES (CURRENT_DATE, 'car_status', $1) RETURNING id`,
    [ciprotsRows.length]
  );
  const runId = runResult!.id;

  let matchCount = 0;
  let mismatchCount = 0;
  let ciprotsOnlyCount = 0;

  for (const cRow of ciprotsRows) {
    if (!cRow.car_number) continue;
    const rsCar = await queryOne<{ current_status: string }>(
      `SELECT current_status FROM cars WHERE car_number = $1`,
      [cRow.car_number]
    );

    if (!rsCar) {
      ciprotsOnlyCount++;
      await query(
        `INSERT INTO parallel_run_discrepancies (parallel_run_id, entity_ref, field_name, ciprots_value, railsync_value, severity)
         VALUES ($1, $2, 'existence', 'present', 'missing', 'critical')`,
        [runId, cRow.car_number]
      );
      continue;
    }

    if (cRow.status.toLowerCase() === (rsCar.current_status || '').toLowerCase()) {
      matchCount++;
    } else {
      mismatchCount++;
      await query(
        `INSERT INTO parallel_run_discrepancies (parallel_run_id, entity_ref, field_name, ciprots_value, railsync_value, severity)
         VALUES ($1, $2, 'status', $3, $4, 'warning')`,
        [runId, cRow.car_number, cRow.status, rsCar.current_status || 'null']
      );
    }
  }

  const total = Math.max(ciprotsRows.length, 1);
  const matchPct = Math.round((matchCount / total) * 10000) / 100;
  const railsyncCount = await queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM cars`);

  await query(
    `UPDATE parallel_run_results SET
       railsync_count = $2, match_count = $3, mismatch_count = $4,
       ciprots_only_count = $5, match_pct = $6
     WHERE id = $1`,
    [runId, parseInt(railsyncCount?.count || '0'), matchCount, mismatchCount, ciprotsOnlyCount, matchPct]
  );

  return {
    id: runId,
    run_date: new Date().toISOString().slice(0, 10),
    comparison_type: 'car_status',
    ciprots_count: ciprotsRows.length,
    railsync_count: parseInt(railsyncCount?.count || '0'),
    match_count: matchCount,
    mismatch_count: mismatchCount,
    ciprots_only_count: ciprotsOnlyCount,
    railsync_only_count: 0,
    match_pct: matchPct,
    summary: {},
  };
}

// =============================================================================
// QUERY PARALLEL RUN RESULTS
// =============================================================================

export async function getParallelRunResults(limit: number = 30): Promise<ParallelRunResult[]> {
  return query<ParallelRunResult>(
    `SELECT * FROM parallel_run_results ORDER BY run_date DESC, created_at DESC LIMIT $1`,
    [limit]
  );
}

export async function getDiscrepancies(
  runId: string,
  resolved?: boolean,
  limit: number = 200
): Promise<Discrepancy[]> {
  const resolvedClause = resolved !== undefined ? `AND resolved = ${resolved}` : '';
  return query<Discrepancy>(
    `SELECT id, entity_ref, field_name, ciprots_value, railsync_value, severity, resolved
     FROM parallel_run_discrepancies
     WHERE parallel_run_id = $1 ${resolvedClause}
     ORDER BY severity DESC, entity_ref
     LIMIT $2`,
    [runId, limit]
  );
}

export async function resolveDiscrepancy(
  discrepancyId: string,
  userId: string,
  notes: string
): Promise<boolean> {
  const result = await query(
    `UPDATE parallel_run_discrepancies
     SET resolved = TRUE, resolved_by = $2, resolved_at = NOW(), resolution_notes = $3
     WHERE id = $1 RETURNING id`,
    [discrepancyId, userId, notes]
  );
  return result.length > 0;
}

// =============================================================================
// DAILY REPORT
// =============================================================================

interface DailyReportDay {
  run_date: string;
  invoice_match_pct: number | null;
  status_match_pct: number | null;
  total_discrepancies: number;
  resolved_discrepancies: number;
  critical_count: number;
}

/**
 * Generate a daily report summarizing the last N days of parallel run comparisons.
 * Returns per-day statistics for invoice match, status match, discrepancies.
 */
export async function getDailyReport(days: number = 30): Promise<DailyReportDay[]> {
  return query<DailyReportDay>(
    `WITH date_range AS (
       SELECT generate_series(
         CURRENT_DATE - ($1 || ' days')::interval,
         CURRENT_DATE,
         '1 day'::interval
       )::date AS run_date
     ),
     results_by_day AS (
       SELECT
         pr.run_date,
         MAX(CASE WHEN pr.comparison_type = 'invoices' THEN pr.match_pct END) AS invoice_match_pct,
         MAX(CASE WHEN pr.comparison_type = 'car_status' THEN pr.match_pct END) AS status_match_pct
       FROM parallel_run_results pr
       WHERE pr.run_date >= CURRENT_DATE - ($1 || ' days')::interval
       GROUP BY pr.run_date
     ),
     disc_by_day AS (
       SELECT
         pr.run_date,
         COUNT(d.id) AS total_discrepancies,
         COUNT(d.id) FILTER (WHERE d.resolved = TRUE) AS resolved_discrepancies,
         COUNT(d.id) FILTER (WHERE d.severity = 'critical' AND d.resolved = FALSE) AS critical_count
       FROM parallel_run_results pr
       LEFT JOIN parallel_run_discrepancies d ON d.parallel_run_id = pr.id
       WHERE pr.run_date >= CURRENT_DATE - ($1 || ' days')::interval
       GROUP BY pr.run_date
     )
     SELECT
       dr.run_date::text,
       COALESCE(r.invoice_match_pct, NULL) AS invoice_match_pct,
       COALESCE(r.status_match_pct, NULL) AS status_match_pct,
       COALESCE(dd.total_discrepancies, 0)::int AS total_discrepancies,
       COALESCE(dd.resolved_discrepancies, 0)::int AS resolved_discrepancies,
       COALESCE(dd.critical_count, 0)::int AS critical_count
     FROM date_range dr
     LEFT JOIN results_by_day r ON r.run_date = dr.run_date
     LEFT JOIN disc_by_day dd ON dd.run_date = dr.run_date
     WHERE r.invoice_match_pct IS NOT NULL OR r.status_match_pct IS NOT NULL
        OR dd.total_discrepancies > 0
     ORDER BY dr.run_date DESC`,
    [days]
  );
}

// =============================================================================
// HEALTH SCORE
// =============================================================================

interface HealthScore {
  overall_score: number;        // 0-100
  invoice_score: number;        // latest invoice match %
  status_score: number;         // latest status match %
  resolution_rate: number;      // % of discrepancies resolved
  trend_direction: 'improving' | 'stable' | 'declining';
  open_critical: number;
  open_warning: number;
  total_runs: number;
  days_in_parallel: number;
  go_live_ready: boolean;       // true if all criteria met
}

/**
 * Calculate an overall parallel-run health score.
 * Criteria: invoice match >= 99%, status match >= 98%, critical discrepancies = 0, resolution rate >= 95%
 */
export async function getHealthScore(): Promise<HealthScore> {
  // Latest invoice and status match %
  const latestInvoice = await queryOne<{ match_pct: number }>(
    `SELECT match_pct FROM parallel_run_results
     WHERE comparison_type = 'invoices'
     ORDER BY run_date DESC, created_at DESC LIMIT 1`
  );
  const latestStatus = await queryOne<{ match_pct: number }>(
    `SELECT match_pct FROM parallel_run_results
     WHERE comparison_type = 'car_status'
     ORDER BY run_date DESC, created_at DESC LIMIT 1`
  );

  // Open discrepancies by severity
  const openDisc = await query<{ severity: string; cnt: number }>(
    `SELECT severity, COUNT(*)::int AS cnt
     FROM parallel_run_discrepancies
     WHERE resolved = FALSE
     GROUP BY severity`
  );
  const openCritical = openDisc.find(d => d.severity === 'critical')?.cnt || 0;
  const openWarning = openDisc.find(d => d.severity === 'warning')?.cnt || 0;

  // Resolution rate
  const resolutionStats = await queryOne<{ total: number; resolved: number }>(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE resolved = TRUE)::int AS resolved
     FROM parallel_run_discrepancies`
  );
  const resolutionRate = resolutionStats && resolutionStats.total > 0
    ? Math.round((resolutionStats.resolved / resolutionStats.total) * 100)
    : 100;

  // Trend: compare last 7 days avg invoice match vs prior 7 days
  const trendData = await query<{ period: string; avg_match: number }>(
    `SELECT
       CASE WHEN run_date >= CURRENT_DATE - 7 THEN 'recent' ELSE 'prior' END AS period,
       AVG(match_pct) AS avg_match
     FROM parallel_run_results
     WHERE comparison_type = 'invoices'
       AND run_date >= CURRENT_DATE - 14
     GROUP BY CASE WHEN run_date >= CURRENT_DATE - 7 THEN 'recent' ELSE 'prior' END`
  );
  const recentAvg = trendData.find(t => t.period === 'recent')?.avg_match || 0;
  const priorAvg = trendData.find(t => t.period === 'prior')?.avg_match || 0;
  let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
  if (recentAvg > priorAvg + 1) trendDirection = 'improving';
  else if (recentAvg < priorAvg - 1) trendDirection = 'declining';

  // Total runs and first run date
  const runStats = await queryOne<{ total_runs: number; first_run: string }>(
    `SELECT COUNT(*)::int AS total_runs, MIN(run_date)::text AS first_run
     FROM parallel_run_results`
  );
  const totalRuns = runStats?.total_runs || 0;
  const firstRun = runStats?.first_run;
  const daysInParallel = firstRun
    ? Math.max(1, Math.ceil((Date.now() - new Date(firstRun).getTime()) / 86400000))
    : 0;

  // Composite score: weighted average
  const invoiceScore = latestInvoice?.match_pct || 0;
  const statusScore = latestStatus?.match_pct || 0;
  const overallScore = Math.round(
    invoiceScore * 0.40 +
    statusScore * 0.25 +
    resolutionRate * 0.20 +
    (openCritical === 0 ? 100 : Math.max(0, 100 - openCritical * 20)) * 0.15
  );

  // Go-live ready: invoice >= 99%, status >= 98%, no open criticals, resolution >= 95%
  const goLiveReady = invoiceScore >= 99 && statusScore >= 98 && openCritical === 0 && resolutionRate >= 95;

  return {
    overall_score: overallScore,
    invoice_score: invoiceScore,
    status_score: statusScore,
    resolution_rate: resolutionRate,
    trend_direction: trendDirection,
    open_critical: openCritical,
    open_warning: openWarning,
    total_runs: totalRuns,
    days_in_parallel: daysInParallel,
    go_live_ready: goLiveReady,
  };
}
