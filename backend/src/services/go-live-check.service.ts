/**
 * Go-Live Readiness Check Service
 *
 * Validates all system areas are ready for CIPROTS cutover.
 * Returns a checklist with pass/fail status for each category.
 */

import { query, queryOne } from '../config/database';

// =============================================================================
// TYPES
// =============================================================================

interface CheckResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  value?: string | number;
  threshold?: string | number;
}

interface ReadinessReport {
  overall_ready: boolean;
  overall_score: number;      // 0-100
  timestamp: string;
  checks: CheckResult[];
  summary: {
    total: number;
    passed: number;
    warned: number;
    failed: number;
  };
}

// =============================================================================
// INDIVIDUAL CHECKS
// =============================================================================

async function checkDataMigration(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check that migration runs completed
  const migrationRuns = await query<{ entity_type: string; status: string; imported_rows: number }>(
    `SELECT entity_type, status, imported_rows
     FROM migration_runs
     WHERE status = 'complete'
     ORDER BY completed_at DESC`
  );

  const entityTypes = ['car', 'contract', 'shopping', 'qualification'];
  for (const et of entityTypes) {
    const run = migrationRuns.find(r => r.entity_type === et);
    if (run) {
      results.push({
        name: `${et} migration`,
        category: 'Data Migration',
        status: 'pass',
        message: `${run.imported_rows} ${et}s imported successfully`,
        value: run.imported_rows,
      });
    } else {
      results.push({
        name: `${et} migration`,
        category: 'Data Migration',
        status: 'warn',
        message: `No completed migration run found for ${et}s`,
      });
    }
  }

  // Check for failed migration runs
  const failedRuns = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM migration_runs WHERE status = 'failed'`
  );
  if (failedRuns && failedRuns.cnt > 0) {
    results.push({
      name: 'Failed migrations',
      category: 'Data Migration',
      status: 'fail',
      message: `${failedRuns.cnt} migration run(s) in failed state`,
      value: failedRuns.cnt,
    });
  }

  return results;
}

async function checkParallelRun(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Invoice match rate
  const latestInvoice = await queryOne<{ match_pct: number; run_date: string }>(
    `SELECT match_pct, run_date::text FROM parallel_run_results
     WHERE comparison_type = 'invoices'
     ORDER BY run_date DESC, created_at DESC LIMIT 1`
  );

  if (latestInvoice) {
    results.push({
      name: 'Invoice match rate',
      category: 'Parallel Run',
      status: latestInvoice.match_pct >= 99 ? 'pass' : latestInvoice.match_pct >= 95 ? 'warn' : 'fail',
      message: `Latest invoice comparison: ${latestInvoice.match_pct}% match (${latestInvoice.run_date})`,
      value: latestInvoice.match_pct,
      threshold: 99,
    });
  } else {
    results.push({
      name: 'Invoice match rate',
      category: 'Parallel Run',
      status: 'fail',
      message: 'No invoice comparison runs found',
    });
  }

  // Status match rate
  const latestStatus = await queryOne<{ match_pct: number; run_date: string }>(
    `SELECT match_pct, run_date::text FROM parallel_run_results
     WHERE comparison_type = 'car_status'
     ORDER BY run_date DESC, created_at DESC LIMIT 1`
  );

  if (latestStatus) {
    results.push({
      name: 'Car status match rate',
      category: 'Parallel Run',
      status: latestStatus.match_pct >= 98 ? 'pass' : latestStatus.match_pct >= 90 ? 'warn' : 'fail',
      message: `Latest status comparison: ${latestStatus.match_pct}% match (${latestStatus.run_date})`,
      value: latestStatus.match_pct,
      threshold: 98,
    });
  } else {
    results.push({
      name: 'Car status match rate',
      category: 'Parallel Run',
      status: 'warn',
      message: 'No car status comparison runs found',
    });
  }

  // Open critical discrepancies
  const openCritical = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM parallel_run_discrepancies
     WHERE resolved = FALSE AND severity = 'critical'`
  );
  results.push({
    name: 'Open critical discrepancies',
    category: 'Parallel Run',
    status: (openCritical?.cnt || 0) === 0 ? 'pass' : 'fail',
    message: openCritical?.cnt ? `${openCritical.cnt} unresolved critical discrepancies` : 'No open critical discrepancies',
    value: openCritical?.cnt || 0,
    threshold: 0,
  });

  // Parallel run duration (need at least 14 days)
  const firstRun = await queryOne<{ first_date: string }>(
    `SELECT MIN(run_date)::text AS first_date FROM parallel_run_results`
  );
  if (firstRun?.first_date) {
    const days = Math.ceil((Date.now() - new Date(firstRun.first_date).getTime()) / 86400000);
    results.push({
      name: 'Parallel run duration',
      category: 'Parallel Run',
      status: days >= 14 ? 'pass' : days >= 7 ? 'warn' : 'fail',
      message: `${days} days of parallel run data`,
      value: days,
      threshold: 14,
    });
  } else {
    results.push({
      name: 'Parallel run duration',
      category: 'Parallel Run',
      status: 'fail',
      message: 'No parallel run data found',
    });
  }

  return results;
}

async function checkIntegrations(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const systems = ['sap', 'salesforce', 'clm', 'railinc'];
  for (const system of systems) {
    const latest = await queryOne<{ status: string; synced_at: string }>(
      `SELECT status, synced_at::text FROM integration_sync_log
       WHERE system_name = $1
       ORDER BY synced_at DESC LIMIT 1`,
      [system]
    );

    if (latest) {
      const status = latest.status === 'success' ? 'pass' : latest.status === 'retrying' ? 'warn' : 'fail';
      results.push({
        name: `${system.toUpperCase()} integration`,
        category: 'Integrations',
        status,
        message: `Last sync: ${latest.status} at ${latest.synced_at}`,
        value: latest.status,
      });
    } else {
      results.push({
        name: `${system.toUpperCase()} integration`,
        category: 'Integrations',
        status: 'warn',
        message: `No sync history for ${system.toUpperCase()}`,
      });
    }
  }

  // Dead letters
  const deadLetters = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM integration_sync_log WHERE status = 'dead_letter'`
  );
  if (deadLetters && deadLetters.cnt > 0) {
    results.push({
      name: 'Dead letter queue',
      category: 'Integrations',
      status: 'warn',
      message: `${deadLetters.cnt} entries in dead letter queue`,
      value: deadLetters.cnt,
    });
  }

  return results;
}

async function checkCoreData(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Car count
  const carCount = await queryOne<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM cars`);
  results.push({
    name: 'Car records loaded',
    category: 'Core Data',
    status: (carCount?.cnt || 0) > 0 ? 'pass' : 'fail',
    message: `${carCount?.cnt || 0} cars in system`,
    value: carCount?.cnt || 0,
  });

  // Active contracts
  const contractCount = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM contracts WHERE status = 'active'`
  );
  results.push({
    name: 'Active contracts',
    category: 'Core Data',
    status: (contractCount?.cnt || 0) > 0 ? 'pass' : 'warn',
    message: `${contractCount?.cnt || 0} active contracts`,
    value: contractCount?.cnt || 0,
  });

  // Users with roles
  const userCount = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM users WHERE is_active = TRUE`
  );
  results.push({
    name: 'Active users',
    category: 'Core Data',
    status: (userCount?.cnt || 0) >= 3 ? 'pass' : 'warn',
    message: `${userCount?.cnt || 0} active users`,
    value: userCount?.cnt || 0,
    threshold: 3,
  });

  // Qualification rules
  const qualRules = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM qualification_rules`
  );
  results.push({
    name: 'Qualification rules configured',
    category: 'Core Data',
    status: (qualRules?.cnt || 0) > 0 ? 'pass' : 'warn',
    message: `${qualRules?.cnt || 0} qualification rules`,
    value: qualRules?.cnt || 0,
  });

  return results;
}

async function checkBilling(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Rate tables
  const rates = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM rate_tables WHERE is_active = TRUE`
  );
  results.push({
    name: 'Active rate tables',
    category: 'Billing',
    status: (rates?.cnt || 0) > 0 ? 'pass' : 'warn',
    message: `${rates?.cnt || 0} active rate tables`,
    value: rates?.cnt || 0,
  });

  // Invoice generation capability
  const recentInvoices = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM outbound_invoices
     WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'`
  );
  results.push({
    name: 'Recent invoice generation',
    category: 'Billing',
    status: (recentInvoices?.cnt || 0) > 0 ? 'pass' : 'warn',
    message: `${recentInvoices?.cnt || 0} invoices generated in last 30 days`,
    value: recentInvoices?.cnt || 0,
  });

  return results;
}

// =============================================================================
// MAIN READINESS CHECK
// =============================================================================

export async function getGoLiveReadiness(): Promise<ReadinessReport> {
  const allChecks: CheckResult[] = [];

  // Run all check categories in parallel
  const [migration, parallelRun, integrations, coreData, billing] = await Promise.all([
    checkDataMigration(),
    checkParallelRun(),
    checkIntegrations(),
    checkCoreData(),
    checkBilling(),
  ]);

  allChecks.push(...migration, ...parallelRun, ...integrations, ...coreData, ...billing);

  const passed = allChecks.filter(c => c.status === 'pass').length;
  const warned = allChecks.filter(c => c.status === 'warn').length;
  const failed = allChecks.filter(c => c.status === 'fail').length;
  const total = allChecks.length;

  // Overall score: pass=100, warn=50, fail=0
  const overallScore = total > 0
    ? Math.round(((passed * 100 + warned * 50) / (total * 100)) * 100)
    : 0;

  // Ready only if no failures
  const overallReady = failed === 0;

  return {
    overall_ready: overallReady,
    overall_score: overallScore,
    timestamp: new Date().toISOString(),
    checks: allChecks,
    summary: { total, passed, warned, failed },
  };
}
