/**
 * Retry Queue Service
 *
 * Provides:
 * 1. Exponential backoff retry logic for failed integration sync entries
 * 2. Circuit breaker pattern per external system
 * 3. Dead letter queue for permanently failed entries
 * 4. Scheduled processing of retry queue
 */

import { query, queryOne } from '../config/database';

// =============================================================================
// CIRCUIT BREAKER
// =============================================================================

interface CircuitState {
  state: 'closed' | 'open' | 'half-open';
  failure_count: number;
  last_failure_at: number;
  opened_at: number;
}

const CIRCUIT_FAILURE_THRESHOLD = 5;    // Open circuit after 5 consecutive failures
const CIRCUIT_RESET_TIMEOUT_MS = 60000; // Try again after 60 seconds

// In-memory circuit state per system
const circuits: Record<string, CircuitState> = {};

function getCircuit(systemName: string): CircuitState {
  if (!circuits[systemName]) {
    circuits[systemName] = { state: 'closed', failure_count: 0, last_failure_at: 0, opened_at: 0 };
  }
  return circuits[systemName];
}

export function isCircuitOpen(systemName: string): boolean {
  const circuit = getCircuit(systemName);
  if (circuit.state === 'closed') return false;
  if (circuit.state === 'open') {
    // Check if enough time has passed to try half-open
    if (Date.now() - circuit.opened_at >= CIRCUIT_RESET_TIMEOUT_MS) {
      circuit.state = 'half-open';
      return false; // Allow one attempt
    }
    return true; // Still open
  }
  return false; // half-open allows one attempt
}

export function recordCircuitSuccess(systemName: string): void {
  const circuit = getCircuit(systemName);
  circuit.state = 'closed';
  circuit.failure_count = 0;
}

export function recordCircuitFailure(systemName: string): void {
  const circuit = getCircuit(systemName);
  circuit.failure_count++;
  circuit.last_failure_at = Date.now();
  if (circuit.failure_count >= CIRCUIT_FAILURE_THRESHOLD) {
    circuit.state = 'open';
    circuit.opened_at = Date.now();
  }
}

export function getCircuitStatus(systemName: string): CircuitState {
  return { ...getCircuit(systemName) };
}

export function getAllCircuitStatuses(): Record<string, CircuitState> {
  const statuses: Record<string, CircuitState> = {};
  for (const [name, state] of Object.entries(circuits)) {
    statuses[name] = { ...state };
  }
  return statuses;
}

// =============================================================================
// RETRY LOGIC
// =============================================================================

const BASE_DELAY_MS = 5000;  // 5 seconds initial delay
const MAX_DELAY_MS = 300000; // 5 minutes max

function calculateNextRetryAt(retryCount: number): Date {
  const delayMs = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);
  // Add jitter (0-25% of delay)
  const jitter = Math.random() * delayMs * 0.25;
  return new Date(Date.now() + delayMs + jitter);
}

/**
 * Mark a sync log entry for retry with exponential backoff.
 */
export async function scheduleRetry(syncLogId: string): Promise<boolean> {
  const entry = await queryOne<{ retry_count: number; max_retries: number; system_name: string }>(
    `SELECT retry_count, max_retries, system_name FROM integration_sync_log WHERE id = $1`,
    [syncLogId]
  );

  if (!entry) return false;

  // Check if max retries exceeded → move to dead letter
  if (entry.retry_count >= entry.max_retries) {
    await query(
      `UPDATE integration_sync_log
       SET status = 'failed', error_message = COALESCE(error_message, '') || ' [Max retries exceeded — dead letter]',
           updated_at = NOW()
       WHERE id = $1`,
      [syncLogId]
    );
    return false;
  }

  const nextRetry = calculateNextRetryAt(entry.retry_count);

  await query(
    `UPDATE integration_sync_log
     SET status = 'retrying',
         retry_count = retry_count + 1,
         next_retry_at = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [syncLogId, nextRetry]
  );

  return true;
}

/**
 * Process pending retries. Called by a scheduled job.
 * Returns the number of entries processed.
 */
export async function processRetryQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  skipped_circuit_open: number;
}> {
  const pending = await query<{ id: string; system_name: string; operation: string; payload: any }>(
    `SELECT id, system_name, operation, payload
     FROM integration_sync_log
     WHERE status = 'retrying'
       AND next_retry_at <= NOW()
     ORDER BY next_retry_at ASC
     LIMIT 50`
  );

  let succeeded = 0;
  let failed = 0;
  let skippedCircuitOpen = 0;

  for (const entry of pending) {
    // Check circuit breaker
    if (isCircuitOpen(entry.system_name)) {
      skippedCircuitOpen++;
      continue;
    }

    // Mark as in_progress
    await query(
      `UPDATE integration_sync_log SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [entry.id]
    );

    try {
      // Re-execute the operation (mock — in production, dispatch to actual service)
      // For now: simulate success (mock adapter pattern)
      console.log(`[RetryQueue] Retrying ${entry.system_name}/${entry.operation} (id: ${entry.id})`);

      // Simulated success
      await query(
        `UPDATE integration_sync_log
         SET status = 'success', completed_at = NOW(), updated_at = NOW(),
             response = jsonb_build_object('retried', true, 'retry_success_at', NOW()::text)
         WHERE id = $1`,
        [entry.id]
      );
      recordCircuitSuccess(entry.system_name);
      succeeded++;
    } catch (err) {
      const errorMsg = (err as Error).message;
      recordCircuitFailure(entry.system_name);

      // Schedule next retry or dead letter
      const scheduled = await scheduleRetry(entry.id);
      if (!scheduled) {
        failed++;
      }

      await query(
        `UPDATE integration_sync_log
         SET error_message = $2, updated_at = NOW()
         WHERE id = $1`,
        [entry.id, errorMsg]
      );
      failed++;
    }
  }

  return {
    processed: pending.length,
    succeeded,
    failed,
    skipped_circuit_open: skippedCircuitOpen,
  };
}

/**
 * List all pending retry queue entries (status = 'retrying').
 */
export async function getRetryQueueEntries(limit: number = 100): Promise<any[]> {
  return query(
    `SELECT id, system_name, operation, status, retry_count, max_retries,
            next_retry_at, error_message, created_at, updated_at
     FROM integration_sync_log
     WHERE status IN ('retrying', 'in_progress')
     ORDER BY next_retry_at ASC
     LIMIT $1`,
    [limit]
  );
}

/**
 * Dismiss (remove) a retry queue entry by marking it as dismissed.
 */
export async function dismissRetryEntry(syncLogId: string): Promise<boolean> {
  const result = await query(
    `UPDATE integration_sync_log
     SET status = 'dismissed',
         error_message = COALESCE(error_message, '') || ' [Dismissed by admin]',
         updated_at = NOW()
     WHERE id = $1 AND status IN ('retrying', 'failed')
     RETURNING id`,
    [syncLogId]
  );
  return result.length > 0;
}

/**
 * Get dead letter entries (max retries exceeded, still failed).
 */
export async function getDeadLetterEntries(limit: number = 50): Promise<any[]> {
  return query(
    `SELECT * FROM integration_sync_log
     WHERE status = 'failed'
       AND retry_count >= max_retries
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit]
  );
}

/**
 * Reset a dead letter entry for manual retry.
 */
export async function resetDeadLetter(syncLogId: string): Promise<boolean> {
  const result = await query(
    `UPDATE integration_sync_log
     SET status = 'retrying',
         retry_count = 0,
         next_retry_at = NOW(),
         error_message = error_message || ' [Manual reset]',
         updated_at = NOW()
     WHERE id = $1 AND status = 'failed'
     RETURNING id`,
    [syncLogId]
  );
  return result.length > 0;
}

/**
 * Get retry queue stats.
 */
export async function getRetryQueueStats(): Promise<{
  pending_retries: number;
  dead_letters: number;
  circuits: Record<string, CircuitState>;
}> {
  const retryCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM integration_sync_log WHERE status = 'retrying'`
  );
  const deadCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM integration_sync_log WHERE status = 'failed' AND retry_count >= max_retries`
  );

  return {
    pending_retries: parseInt(retryCount?.count || '0'),
    dead_letters: parseInt(deadCount?.count || '0'),
    circuits: getAllCircuitStatuses(),
  };
}
