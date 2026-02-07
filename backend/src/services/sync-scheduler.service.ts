// =============================================================================
// Sync Scheduler Service
// Manages scheduled sync jobs for SAP and Salesforce integration
// =============================================================================

import { query, queryOne } from '../config/database';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ScheduledJob {
  id: string;
  job_name: string;
  system_name: string;
  operation: string;
  cron_expression: string;
  is_enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  next_run_at: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CreateJobData {
  job_name: string;
  system_name: string;
  operation: string;
  cron_expression?: string;
  is_enabled?: boolean;
  config?: Record<string, unknown>;
}

interface UpdateJobData {
  job_name?: string;
  system_name?: string;
  operation?: string;
  cron_expression?: string;
  config?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Cron Parser — compute next run time from a cron expression
// Supports: */N (every N units), specific numbers, * (any)
// Format: minute hour day-of-month month day-of-week
// -----------------------------------------------------------------------------

export function parseCronNextRun(cronExpression: string, fromDate?: Date): Date {
  const now = fromDate ? new Date(fromDate) : new Date();
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: "${cronExpression}" — expected 5 fields`);
  }

  const [minutePart, hourPart, dayPart, monthPart, dowPart] = parts;

  // Parse a single cron field into the set of valid values
  function parseField(field: string, min: number, max: number): number[] | null {
    if (field === '*') return null; // means "any"
    // */N — every N
    const stepMatch = field.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      const values: number[] = [];
      for (let i = min; i <= max; i += step) {
        values.push(i);
      }
      return values;
    }
    // Comma-separated values
    if (field.includes(',')) {
      return field.split(',').map(v => parseInt(v.trim(), 10));
    }
    // Single value
    const val = parseInt(field, 10);
    if (!isNaN(val)) return [val];
    return null;
  }

  const minutes = parseField(minutePart, 0, 59);
  const hours = parseField(hourPart, 0, 23);
  const days = parseField(dayPart, 1, 31);
  const months = parseField(monthPart, 1, 12);
  const dows = parseField(dowPart, 0, 6); // 0 = Sunday

  function matches(date: Date): boolean {
    if (minutes && !minutes.includes(date.getUTCMinutes())) return false;
    if (hours && !hours.includes(date.getUTCHours())) return false;
    if (days && !days.includes(date.getUTCDate())) return false;
    if (months && !months.includes(date.getUTCMonth() + 1)) return false;
    if (dows && !dows.includes(date.getUTCDay())) return false;
    return true;
  }

  // Start from the next minute boundary
  const candidate = new Date(now);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  // Scan forward minute by minute, up to 366 days
  const maxIterations = 366 * 24 * 60;
  for (let i = 0; i < maxIterations; i++) {
    if (matches(candidate)) {
      return candidate;
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }

  throw new Error(`Could not compute next run for cron expression: "${cronExpression}"`);
}

// -----------------------------------------------------------------------------
// CRUD Operations
// -----------------------------------------------------------------------------

/** List all scheduled jobs ordered by system_name, job_name */
export async function getScheduledJobs(): Promise<ScheduledJob[]> {
  const result = await query(
    `SELECT * FROM sync_job_schedules ORDER BY system_name, job_name`
  );
  return result;
}

/** Get a single scheduled job by ID */
export async function getScheduledJob(id: string): Promise<ScheduledJob | null> {
  const result = await queryOne(
    `SELECT * FROM sync_job_schedules WHERE id = $1`,
    [id]
  );
  return result || null;
}

/** Create a new scheduled job */
export async function createScheduledJob(data: CreateJobData): Promise<ScheduledJob> {
  const cronExpr = data.cron_expression || '0 */6 * * *';
  const nextRun = parseCronNextRun(cronExpr);

  const result = await queryOne(
    `INSERT INTO sync_job_schedules (job_name, system_name, operation, cron_expression, is_enabled, next_run_at, config)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.job_name,
      data.system_name,
      data.operation,
      cronExpr,
      data.is_enabled !== undefined ? data.is_enabled : true,
      nextRun.toISOString(),
      JSON.stringify(data.config || {}),
    ]
  );
  return result;
}

/** Update an existing scheduled job's configuration */
export async function updateScheduledJob(id: string, data: UpdateJobData): Promise<ScheduledJob | null> {
  // Build dynamic SET clause
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.job_name !== undefined) {
    setClauses.push(`job_name = $${paramIdx++}`);
    values.push(data.job_name);
  }
  if (data.system_name !== undefined) {
    setClauses.push(`system_name = $${paramIdx++}`);
    values.push(data.system_name);
  }
  if (data.operation !== undefined) {
    setClauses.push(`operation = $${paramIdx++}`);
    values.push(data.operation);
  }
  if (data.cron_expression !== undefined) {
    setClauses.push(`cron_expression = $${paramIdx++}`);
    values.push(data.cron_expression);
    // Recompute next_run_at when cron changes
    const nextRun = parseCronNextRun(data.cron_expression);
    setClauses.push(`next_run_at = $${paramIdx++}`);
    values.push(nextRun.toISOString());
  }
  if (data.config !== undefined) {
    setClauses.push(`config = $${paramIdx++}`);
    values.push(JSON.stringify(data.config));
  }

  if (setClauses.length === 0) {
    return getScheduledJob(id);
  }

  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await queryOne(
    `UPDATE sync_job_schedules SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values
  );
  return result || null;
}

/** Enable or disable a scheduled job */
export async function toggleJobEnabled(id: string, enabled: boolean): Promise<ScheduledJob | null> {
  // If enabling, recompute next_run_at from current time
  let extraSet = '';
  const values: unknown[] = [enabled];

  if (enabled) {
    // We need to fetch the job first to get the cron expression
    const job = await getScheduledJob(id);
    if (job) {
      const nextRun = parseCronNextRun(job.cron_expression);
      extraSet = `, next_run_at = $3`;
      values.push(id, nextRun.toISOString());
    } else {
      values.push(id);
    }
  } else {
    values.push(id);
  }

  const result = await queryOne(
    `UPDATE sync_job_schedules
     SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP${extraSet}
     WHERE id = $2
     RETURNING *`,
    values
  );
  return result || null;
}

/** Record the result of a job execution and compute next run time */
export async function recordJobRun(
  id: string,
  status: 'success' | 'failed' | 'running',
  details?: Record<string, unknown>
): Promise<ScheduledJob | null> {
  const job = await getScheduledJob(id);
  if (!job) return null;

  let nextRunAt: string | null = null;
  if (status !== 'running') {
    // Compute next run only when the job has finished
    const nextRun = parseCronNextRun(job.cron_expression);
    nextRunAt = nextRun.toISOString();
  }

  const configUpdate = details
    ? { ...((job.config as Record<string, unknown>) || {}), last_run_details: details }
    : job.config;

  const result = await queryOne(
    `UPDATE sync_job_schedules
     SET last_run_at = CURRENT_TIMESTAMP,
         last_status = $1,
         next_run_at = COALESCE($2, next_run_at),
         config = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [status, nextRunAt, JSON.stringify(configUpdate), id]
  );
  return result || null;
}

/** Find all enabled jobs that are due for execution (next_run_at <= NOW) */
export async function getJobsDueForExecution(): Promise<ScheduledJob[]> {
  const result = await query(
    `SELECT * FROM sync_job_schedules
     WHERE is_enabled = TRUE
       AND next_run_at <= NOW()
       AND (last_status IS NULL OR last_status != 'running')
     ORDER BY next_run_at ASC`
  );
  return result;
}

// -----------------------------------------------------------------------------
// Seed default schedules (called once if table is empty)
// -----------------------------------------------------------------------------

interface DefaultSchedule {
  job_name: string;
  system_name: string;
  operation: string;
  cron_expression: string;
  config: Record<string, unknown>;
}

const DEFAULT_SCHEDULES: DefaultSchedule[] = [
  {
    job_name: 'SAP Batch Push',
    system_name: 'sap',
    operation: 'batch_push',
    cron_expression: '0 */6 * * *', // every 6 hours
    config: { batch_limit: 100, document_types: ['AP_INVOICE', 'AR_INVOICE', 'SPV_COST'] },
  },
  {
    job_name: 'Salesforce Full Sync',
    system_name: 'salesforce',
    operation: 'full_sync',
    cron_expression: '0 */12 * * *', // every 12 hours
    config: { objects: ['Account', 'Contact', 'Opportunity'] },
  },
  {
    job_name: 'Salesforce Pull Customers',
    system_name: 'salesforce',
    operation: 'pull_customers',
    cron_expression: '0 2 * * *', // daily at 2am UTC
    config: { upsert_strategy: 'update_existing', conflict_winner: 'salesforce' },
  },
  {
    job_name: 'Salesforce Pull Deals',
    system_name: 'salesforce',
    operation: 'pull_deals',
    cron_expression: '0 3 * * *', // daily at 3am UTC
    config: { stages: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won'] },
  },
  {
    job_name: 'Retry Queue Process',
    system_name: 'system',
    operation: 'process_retry_queue',
    cron_expression: '*/30 * * * *', // every 30 minutes
    config: { max_retries: 5, batch_limit: 50 },
  },
];

/** Seed default schedules if the table is empty */
export async function seedDefaultSchedules(): Promise<void> {
  const countResult = await queryOne(
    `SELECT COUNT(*)::int AS cnt FROM sync_job_schedules`
  );
  if (countResult && countResult.cnt > 0) {
    return; // Already seeded
  }

  for (const sched of DEFAULT_SCHEDULES) {
    const nextRun = parseCronNextRun(sched.cron_expression);
    await query(
      `INSERT INTO sync_job_schedules (job_name, system_name, operation, cron_expression, next_run_at, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (job_name) DO NOTHING`,
      [
        sched.job_name,
        sched.system_name,
        sched.operation,
        sched.cron_expression,
        nextRun.toISOString(),
        JSON.stringify(sched.config),
      ]
    );
  }
}
