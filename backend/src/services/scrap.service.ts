/**
 * Scrap Service — Car Scrap/Decommission Workflow
 *
 * Manages the proposal, review, approval, scheduling, and completion
 * of car scrapping. On completion, the car exits the active fleet
 * permanently (is_active = false).
 *
 * State machine: proposed → under_review → approved → scheduled → in_progress → completed
 *                Cancellable from: proposed, under_review, approved, scheduled
 *                NOT cancellable from: in_progress (R9)
 *
 * Tables: scraps, scrap_state_history, cars, asset_events
 */

import { query, queryOne, transaction } from '../config/database';
import logger from '../config/logger';
import { logTransition } from './transition-log.service';
import * as assetEventService from './assetEvent.service';
import { createAlert } from './alerts.service';

// ============================================================================
// TYPES
// ============================================================================

export type ScrapStatus =
  | 'proposed'
  | 'under_review'
  | 'approved'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Scrap {
  id: string;
  car_id: string;
  car_number: string;
  status: ScrapStatus;
  reason: string;
  estimated_salvage_value: number | null;
  actual_salvage_value: number | null;
  facility_code: string | null;
  target_date: string | null;
  completion_date: string | null;
  completion_notes: string | null;
  proposed_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_by: string | null;
  scheduled_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  completed_by: string | null;
  completed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreateScrapInput {
  car_number: string;
  reason: string;
  estimated_salvage_value?: number;
  notes?: string;
}

export interface ScrapFilters {
  car_number?: string;
  status?: ScrapStatus | ScrapStatus[];
  limit?: number;
  offset?: number;
}

// ============================================================================
// CREATE SCRAP PROPOSAL
// ============================================================================

/**
 * Create a scrap proposal from the triage queue.
 * Validates:
 *   - Car exists and is active
 *   - Car is in Pending status group (R12)
 *   - No active lease OR lease expires within 30 days (R4)
 *   - No existing non-terminal scrap for this car
 *   - No active assignment or shopping event (N5)
 */
export async function createScrapProposal(
  input: CreateScrapInput,
  userId: string
): Promise<Scrap> {
  // Validate car exists and is in fleet
  const car = await queryOne<{ id: string; car_number: string; fleet_status: string }>(
    `SELECT id, car_number, fleet_status
     FROM cars WHERE car_number = $1`,
    [input.car_number]
  );

  if (!car || car.fleet_status === 'disposed') {
    throw new Error(`Car ${input.car_number} not found or already disposed`);
  }

  // Validate: car must have an active triage entry or be idle (replaces operational_status_group check)
  const triageEntry = await queryOne<{ id: string }>(
    `SELECT id FROM triage_queue WHERE car_id = $1 AND resolved_at IS NULL`,
    [car.id]
  );
  const idlePeriod = await queryOne<{ id: string }>(
    `SELECT id FROM idle_periods WHERE car_id = $1 AND end_date IS NULL`,
    [car.id]
  );
  if (!triageEntry && !idlePeriod) {
    throw new Error(`Car ${input.car_number} must be in triage or idle to propose scrap`);
  }

  // R8: No active shopping event in shopping_events_v2
  const activeShoppingEvent = await queryOne<{ id: string }>(
    `SELECT id FROM shopping_events_v2 WHERE car_number = $1 AND state NOT IN ('CLOSED', 'CANCELLED')`,
    [input.car_number]
  );
  if (activeShoppingEvent) {
    throw new Error(`Car ${input.car_number} has an active shopping event — cannot propose scrap (R8)`);
  }

  // R4: Check lease — no active lease OR lease expires within 30 days
  const activeLease = await queryOne<{ rider_id: string; expiration_date: string }>(
    `SELECT rc.rider_id, lr.expiration_date
     FROM rider_cars rc
     JOIN lease_riders lr ON lr.id = rc.rider_id
     WHERE rc.car_number = $1 AND rc.status NOT IN ('off_rent', 'cancelled')
     LIMIT 1`,
    [input.car_number]
  );

  if (activeLease && activeLease.expiration_date) {
    const expiryDate = new Date(activeLease.expiration_date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    if (expiryDate > thirtyDaysFromNow) {
      throw new Error(
        `Car ${input.car_number} has an active lease expiring ${activeLease.expiration_date} (> 30 days). Release the car first or wait until within 30 days of expiry.`
      );
    }
  }

  // Check no existing non-terminal scrap
  const existingScrap = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM scraps
     WHERE car_number = $1 AND status NOT IN ('completed', 'cancelled')`,
    [input.car_number]
  );

  if (existingScrap) {
    throw new Error(`Car ${input.car_number} already has an active scrap proposal (status: ${existingScrap.status})`);
  }

  // N5: No active assignment or shopping event
  const activeAssignment = await queryOne<{ id: string }>(
    `SELECT id FROM car_assignments
     WHERE car_number = $1 AND status NOT IN ('Complete', 'Cancelled')
     LIMIT 1`,
    [input.car_number]
  );

  if (activeAssignment) {
    throw new Error(`Car ${input.car_number} has an active assignment. Cannot propose scrap while assignment is active.`);
  }

  const result = await queryOne<Scrap>(
    `INSERT INTO scraps (
      car_id, car_number, status, reason,
      estimated_salvage_value, proposed_by
    ) VALUES ($1, $2, 'proposed', $3, $4, $5)
    RETURNING *`,
    [
      car.id,
      input.car_number,
      input.reason,
      input.estimated_salvage_value || null,
      userId,
    ]
  );

  if (!result) throw new Error('Failed to create scrap proposal');

  // Non-blocking: log transition + asset event
  logTransition({
    processType: 'scrap',
    entityId: result.id,
    entityNumber: input.car_number,
    fromState: undefined,
    toState: 'proposed',
    isReversible: true,
    actorId: userId,
    notes: `Scrap reason: ${input.reason}`,
  }).catch(err => logger.error({ err }, '[TransitionLog] Failed to log scrap proposal'));

  assetEventService.recordEvent(car.id, 'car.scrap_proposed', {
    scrap_id: result.id,
    reason: input.reason,
    estimated_salvage_value: input.estimated_salvage_value,
  }, {
    sourceTable: 'scraps',
    sourceId: result.id,
    performedBy: userId,
  }).catch(() => {});

  return result;
}

// ============================================================================
// TRANSITION SCRAP
// ============================================================================

/**
 * Advance a scrap through its lifecycle.
 * The DB trigger enforces valid transitions; this function handles
 * the actor fields and side effects for each status.
 */
export async function transitionScrap(
  scrapId: string,
  newStatus: ScrapStatus,
  userId: string,
  data?: {
    comments?: string;
    facility_code?: string;
    target_date?: string;
    actual_salvage_value?: number;
    completion_date?: string;
    completion_notes?: string;
    cancellation_reason?: string;
  }
): Promise<Scrap> {
  const current = await getScrap(scrapId);
  if (!current) throw new Error(`Scrap ${scrapId} not found`);

  // Route to specific handlers for statuses with side effects
  if (newStatus === 'completed') {
    return completeScrap(current, userId, data);
  }
  if (newStatus === 'cancelled') {
    return cancelScrap(current, userId, data?.cancellation_reason || data?.comments || '');
  }

  // For other transitions: under_review, approved, scheduled, in_progress
  const setClauses: string[] = ['status = $1'];
  const params: any[] = [newStatus];
  let idx = 2;

  if (newStatus === 'under_review') {
    setClauses.push(`reviewed_by = $${idx++}`);
    params.push(userId);
  } else if (newStatus === 'approved') {
    setClauses.push(`approved_by = $${idx++}`);
    params.push(userId);
  } else if (newStatus === 'scheduled') {
    if (!data?.facility_code || !data?.target_date) {
      throw new Error('Scheduling requires facility_code and target_date');
    }
    setClauses.push(`scheduled_by = $${idx++}`);
    params.push(userId);
    setClauses.push(`facility_code = $${idx++}`);
    params.push(data.facility_code);
    setClauses.push(`target_date = $${idx++}`);
    params.push(data.target_date);
  }

  params.push(scrapId);
  const result = await queryOne<Scrap>(
    `UPDATE scraps SET ${setClauses.join(', ')}
     WHERE id = $${idx}
     RETURNING *`,
    params
  );

  if (!result) throw new Error(`Failed to transition scrap to ${newStatus}`);

  logTransition({
    processType: 'scrap',
    entityId: scrapId,
    entityNumber: current.car_number,
    fromState: current.status,
    toState: newStatus,
    isReversible: newStatus !== 'in_progress',
    actorId: userId,
    notes: data?.comments,
  }).catch(err => logger.error({ err }, '[TransitionLog] Failed to log scrap transition'));

  return result;
}

// ============================================================================
// COMPLETE SCRAP — IRREVERSIBLE
// ============================================================================

/**
 * Complete a scrap. Atomic transaction:
 * 1. Mark scraps.status = 'completed'
 * 2. Set cars.is_active = false (R11)
 * 3. Clear operational_status_group
 * 4. Log asset event
 */
async function completeScrap(
  current: Scrap,
  userId: string,
  data?: {
    actual_salvage_value?: number;
    completion_date?: string;
    completion_notes?: string;
  }
): Promise<Scrap> {
  if (current.status !== 'in_progress') {
    throw new Error(`Cannot complete scrap in status ${current.status}`);
  }

  const result = await transaction(async (client) => {
    // 1. Mark completed
    const scrapResult = await client.query(
      `UPDATE scraps SET
        status = 'completed',
        completed_by = $1,
        actual_salvage_value = $2,
        completion_date = COALESCE($3, CURRENT_DATE),
        completion_notes = $4
      WHERE id = $5
      RETURNING *`,
      [
        userId,
        data?.actual_salvage_value || null,
        data?.completion_date || null,
        data?.completion_notes || null,
        current.id,
      ]
    );

    // 2. Deactivate car permanently — set fleet_status = 'disposed' (R5)
    // Keep is_active = FALSE and operational_status_group = NULL for backward compat
    await client.query(
      `UPDATE cars SET
        fleet_status = 'disposed',
        is_active = FALSE,
        operational_status_group = NULL,
        updated_at = NOW()
      WHERE car_number = $1`,
      [current.car_number]
    );

    // Close any open idle period
    await client.query(
      `UPDATE idle_periods SET end_date = CURRENT_DATE WHERE car_id = $1 AND end_date IS NULL`,
      [current.car_id]
    );

    // Resolve any open triage entry
    await client.query(
      `UPDATE triage_queue SET
        resolved_at = NOW(), resolution = 'scrap_proposed', resolved_by = $1
       WHERE car_id = $2 AND resolved_at IS NULL`,
      [userId, current.car_id]
    );

    return scrapResult.rows[0] as Scrap;
  });

  // Non-blocking side effects
  logTransition({
    processType: 'scrap',
    entityId: current.id,
    entityNumber: current.car_number,
    fromState: 'in_progress',
    toState: 'completed',
    isReversible: false,
    actorId: userId,
    notes: data?.completion_notes,
    sideEffects: [
      { type: 'deactivated', entity_type: 'car', entity_id: current.car_id },
    ],
  }).catch(err => logger.error({ err }, '[TransitionLog] Failed to log scrap completion'));

  assetEventService.recordEvent(current.car_id, 'car.scrapped', {
    scrap_id: current.id,
    reason: current.reason,
    actual_salvage_value: data?.actual_salvage_value,
    facility_code: current.facility_code,
  }, {
    sourceTable: 'scraps',
    sourceId: current.id,
    performedBy: userId,
  }).catch(() => {});

  createAlert({
    alert_type: 'car_scrapped',
    severity: 'warning',
    title: `Car ${current.car_number} scrapped`,
    message: `Car has been permanently decommissioned. Salvage value: $${data?.actual_salvage_value || 'N/A'}`,
    entity_type: 'scraps',
    entity_id: current.id,
    target_role: 'planner',
    metadata: {
      car_number: current.car_number,
      scrap_reason: current.reason,
    },
  }).catch(() => {});

  return result;
}

// ============================================================================
// CANCEL SCRAP
// ============================================================================

/**
 * Cancel a scrap. R9: Cannot cancel once in_progress.
 * API14: Re-evaluate car's destination group after cancellation.
 */
async function cancelScrap(
  current: Scrap,
  userId: string,
  reason: string
): Promise<Scrap> {
  if (!reason) {
    throw new Error('Cancellation reason is required');
  }

  if (current.status === 'completed' || current.status === 'cancelled') {
    throw new Error(`Cannot cancel scrap in terminal status ${current.status}`);
  }

  // R9: Block cancel from in_progress
  if (current.status === 'in_progress') {
    throw new Error('Cannot cancel scrap once in progress (R9). Scrap must be completed.');
  }

  const result = await transaction(async (client) => {
    const scrapResult = await client.query(
      `UPDATE scraps SET
        status = 'cancelled',
        cancelled_by = $1,
        cancellation_reason = $2
      WHERE id = $3
      RETURNING *`,
      [userId, reason, current.id]
    );

    return scrapResult.rows[0] as Scrap;
  });

  // Create triage entry instead of setting operational_status_group (S6)
  const carRow = await queryOne<{ id: string }>('SELECT id FROM cars WHERE car_number = $1', [current.car_number]);
  if (carRow) {
    try {
      const { createTriageEntry } = await import('./triage-queue.service');
      await createTriageEntry(
        carRow.id, current.car_number, 'scrap_cancelled', 2,
        `Scrap ${current.id} cancelled: ${reason}`, userId, current.id
      );
    } catch (err) {
      logger.error({ err }, `[Scrap] Failed to create triage entry after cancellation for ${current.car_number}`);
    }
  }

  logTransition({
    processType: 'scrap',
    entityId: current.id,
    entityNumber: current.car_number,
    fromState: current.status,
    toState: 'cancelled',
    isReversible: false,
    actorId: userId,
    notes: `Cancelled: ${reason}. Triage entry created (S6)`,
  }).catch(err => logger.error({ err }, '[TransitionLog] Failed to log scrap cancellation'));

  return result;
}

// ============================================================================
// QUERIES
// ============================================================================

export async function getScrap(scrapId: string): Promise<Scrap | null> {
  return queryOne<Scrap>('SELECT * FROM scraps WHERE id = $1', [scrapId]);
}

export async function listScraps(filters: ScrapFilters = {}): Promise<{ scraps: Scrap[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.car_number) {
    conditions.push(`car_number ILIKE $${idx++}`);
    params.push(`%${filters.car_number}%`);
  }
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(`status = ANY($${idx++})`);
      params.push(filters.status);
    } else {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ total: string }>(`SELECT COUNT(*) as total FROM scraps ${where}`, params);
  const total = parseInt(countResult?.total || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const scraps = await query<Scrap>(
    `SELECT * FROM scraps ${where}
     ORDER BY CASE status
       WHEN 'proposed' THEN 1 WHEN 'under_review' THEN 2
       WHEN 'approved' THEN 3 WHEN 'scheduled' THEN 4
       WHEN 'in_progress' THEN 5 WHEN 'completed' THEN 6 WHEN 'cancelled' THEN 7
     END, created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return { scraps, total };
}

export async function getActiveScrapsView(): Promise<any[]> {
  return query('SELECT * FROM v_active_scraps ORDER BY created_at DESC', []);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  createScrapProposal,
  transitionScrap,
  getScrap,
  listScraps,
  getActiveScrapsView,
};
