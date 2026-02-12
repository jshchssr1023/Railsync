/**
 * Triage Queue Service — Car Decision Queue
 *
 * Manages the triage_queue table for cars that need an explicit planner decision.
 * Each car can have at most one active (unresolved) triage entry at a time
 * (enforced by DB unique partial index idx_triage_one_active).
 *
 * Reasons a car enters triage:
 *   lease_expiring   — Auto-flagged when lease is within 30 days
 *   lease_expired    — Auto-flagged when lease is past expiration
 *   scrap_cancelled  — Re-entered from a cancelled scrap
 *   customer_return  — Car returned from customer (rider_car → off_rent)
 *   bad_order        — Bad order report received
 *   qualification_due — Qualification approaching due date
 *   manual           — Planner manually flagged
 *   market_conditions — Auto-flagged when idle > 60 days
 *
 * Tables: triage_queue, state_transition_log, asset_events
 */

import { query, queryOne } from '../config/database';
import logger from '../config/logger';
import { logTransition } from './transition-log.service';
import * as assetEventService from './assetEvent.service';

// ============================================================================
// TYPES
// ============================================================================

export type TriageReason =
  | 'lease_expiring'
  | 'lease_expired'
  | 'scrap_cancelled'
  | 'customer_return'
  | 'bad_order'
  | 'qualification_due'
  | 'manual'
  | 'market_conditions';

export type TriageResolution =
  | 'assigned_to_shop'
  | 'assigned_to_customer'
  | 'released_to_idle'
  | 'scrap_proposed'
  | 'dismissed';

export interface TriageEntry {
  id: string;
  car_id: string;
  car_number: string;
  reason: TriageReason;
  source_reference_id: string | null;
  priority: number;
  notes: string | null;
  resolved_at: string | null;
  resolution: TriageResolution | null;
  resolution_reference_id: string | null;
  resolved_by: string | null;
  created_at: string;
  created_by: string | null;
}

export interface TriageFilters {
  reason?: TriageReason;
  priority?: number;
  resolved?: boolean;
  car_number?: string;
}

// ============================================================================
// CREATE TRIAGE ENTRY
// ============================================================================

/**
 * Create a triage entry for a car. The DB unique partial index enforces
 * one active entry per car — this will throw if a duplicate is attempted.
 */
export async function createTriageEntry(
  carId: string,
  carNumber: string,
  reason: TriageReason,
  priority: number = 3,
  notes?: string,
  userId?: string,
  sourceReferenceId?: string
): Promise<TriageEntry> {
  const result = await queryOne<TriageEntry>(
    `INSERT INTO triage_queue (car_id, car_number, reason, priority, notes, created_by, source_reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [carId, carNumber, reason, priority, notes || null, userId || null, sourceReferenceId || null]
  );

  if (!result) throw new Error('Failed to create triage entry');

  logTransition({
    processType: 'triage_queue',
    entityId: result.id,
    entityNumber: carNumber,
    fromState: undefined,
    toState: 'open',
    isReversible: true,
    actorId: userId,
    notes: `Reason: ${reason}. ${notes || ''}`.trim(),
  }).catch(err => logger.error({ err }, '[TransitionLog] Failed to log triage entry creation'));

  assetEventService.recordEvent(carId, 'car.triage_entry_created', {
    triage_id: result.id,
    reason,
    priority,
  }, {
    sourceTable: 'triage_queue',
    sourceId: result.id,
    performedBy: userId,
  }).catch(() => {}); // non-blocking

  return result;
}

// ============================================================================
// RESOLVE TRIAGE ENTRY
// ============================================================================

/**
 * Resolve an open triage entry with a resolution and optional reference.
 */
export async function resolveTriageEntry(
  entryId: string,
  resolution: TriageResolution,
  resolvedBy: string,
  notes?: string,
  resolutionReferenceId?: string
): Promise<TriageEntry> {
  const current = await getTriageEntry(entryId);
  if (!current) throw new Error(`Triage entry ${entryId} not found`);
  if (current.resolved_at) throw new Error(`Triage entry ${entryId} is already resolved`);

  const result = await queryOne<TriageEntry>(
    `UPDATE triage_queue SET
      resolved_at = NOW(),
      resolution = $1,
      resolved_by = $2,
      notes = COALESCE($3, notes),
      resolution_reference_id = $4
    WHERE id = $5
    RETURNING *`,
    [resolution, resolvedBy, notes || null, resolutionReferenceId || null, entryId]
  );

  if (!result) throw new Error('Failed to resolve triage entry');

  logTransition({
    processType: 'triage_queue',
    entityId: entryId,
    entityNumber: current.car_number,
    fromState: 'open',
    toState: `resolved:${resolution}`,
    isReversible: false,
    actorId: resolvedBy,
    notes: notes || undefined,
  }).catch(err => logger.error({ err }, '[TransitionLog] Failed to log triage resolution'));

  assetEventService.recordEvent(current.car_id, 'car.triage_entry_resolved', {
    triage_id: entryId,
    reason: current.reason,
    resolution,
    resolution_reference_id: resolutionReferenceId,
  }, {
    sourceTable: 'triage_queue',
    sourceId: entryId,
    performedBy: resolvedBy,
  }).catch(() => {}); // non-blocking

  return result;
}

// ============================================================================
// QUERY
// ============================================================================

/**
 * Get a single triage entry by ID.
 */
export async function getTriageEntry(entryId: string): Promise<TriageEntry | null> {
  return queryOne<TriageEntry>('SELECT * FROM triage_queue WHERE id = $1', [entryId]);
}

/**
 * Get the active (unresolved) triage entry for a car, if any.
 */
export async function getActiveTriageEntry(carId: string): Promise<TriageEntry | null> {
  return queryOne<TriageEntry>(
    'SELECT * FROM triage_queue WHERE car_id = $1 AND resolved_at IS NULL',
    [carId]
  );
}

/**
 * List triage entries with optional filters.
 */
export async function listTriageQueue(
  filters: TriageFilters = {}
): Promise<{ entries: TriageEntry[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.reason) {
    conditions.push(`reason = $${paramIndex++}`);
    params.push(filters.reason);
  }

  if (filters.priority !== undefined) {
    conditions.push(`priority = $${paramIndex++}`);
    params.push(filters.priority);
  }

  if (filters.resolved === true) {
    conditions.push('resolved_at IS NOT NULL');
  } else if (filters.resolved === false) {
    conditions.push('resolved_at IS NULL');
  }

  if (filters.car_number) {
    conditions.push(`car_number = $${paramIndex++}`);
    params.push(filters.car_number);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM triage_queue ${where}`,
    params
  );

  const entries = await query<TriageEntry>(
    `SELECT * FROM triage_queue ${where}
     ORDER BY
       CASE WHEN resolved_at IS NULL THEN 0 ELSE 1 END,
       priority ASC,
       created_at ASC`,
    params
  );

  return { entries, total: countResult?.count || 0 };
}
