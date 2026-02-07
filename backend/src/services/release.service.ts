/**
 * Release Service — Car Release Management
 *
 * Manages the release of cars from lease riders. Bridges the gap between
 * shopping_event RELEASED state → assignment Complete → rider_cars deactivation.
 *
 * State machine: INITIATED → APPROVED → EXECUTING → COMPLETED (terminal)
 *                                                  → CANCELLED (terminal from any non-terminal state)
 *
 * Tables: car_releases, rider_cars, car_assignments, car_lease_transitions, state_transition_log
 */

import { query, queryOne, transaction } from '../config/database';
import { logTransition } from './transition-log.service';
import * as assetEventService from './assetEvent.service';
import { createAlert } from './alerts.service';

// ============================================================================
// TYPES
// ============================================================================

export type ReleaseType = 'lease_expiry' | 'voluntary_return' | 'shop_complete' | 'contract_transfer' | 'disposition';
export type ReleaseStatus = 'INITIATED' | 'APPROVED' | 'EXECUTING' | 'COMPLETED' | 'CANCELLED';

export interface CarRelease {
  id: string;
  car_number: string;
  rider_id: string;
  assignment_id: string | null;
  shopping_event_id: string | null;
  release_type: ReleaseType;
  status: ReleaseStatus;
  initiated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  transition_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InitiateReleaseInput {
  car_number: string;
  rider_id: string;
  release_type: ReleaseType;
  assignment_id?: string;
  shopping_event_id?: string;
  transition_id?: string;
  notes?: string;
}

export interface ReleaseFilters {
  car_number?: string;
  rider_id?: string;
  status?: ReleaseStatus | ReleaseStatus[];
  release_type?: ReleaseType;
  limit?: number;
  offset?: number;
}

// ============================================================================
// INITIATE RELEASE
// ============================================================================

/**
 * Initiate a car release from a lease rider.
 * Validates: car is active on rider, no duplicate pending release.
 */
export async function initiateRelease(
  input: InitiateReleaseInput,
  userId: string
): Promise<CarRelease> {
  // Validate car is active on this rider
  const riderCar = await queryOne<{ car_number: string; is_active: boolean }>(
    `SELECT car_number, is_active FROM rider_cars
     WHERE rider_id = $1 AND car_number = $2 AND is_active = TRUE`,
    [input.rider_id, input.car_number]
  );

  if (!riderCar) {
    throw new Error(`Car ${input.car_number} is not active on rider ${input.rider_id}`);
  }

  // Check for existing non-terminal release
  const existing = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM car_releases
     WHERE car_number = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')`,
    [input.car_number]
  );

  if (existing) {
    throw new Error(`Car ${input.car_number} already has an active release (${existing.status})`);
  }

  const result = await queryOne<CarRelease>(
    `INSERT INTO car_releases (
      car_number, rider_id, assignment_id, shopping_event_id,
      release_type, status, initiated_by, transition_id, notes
    ) VALUES ($1, $2, $3, $4, $5, 'INITIATED', $6, $7, $8)
    RETURNING *`,
    [
      input.car_number,
      input.rider_id,
      input.assignment_id || null,
      input.shopping_event_id || null,
      input.release_type,
      userId,
      input.transition_id || null,
      input.notes || null,
    ]
  );

  if (!result) throw new Error('Failed to create release');

  // Log transition
  logTransition({
    processType: 'car_release',
    entityId: result.id,
    entityNumber: input.car_number,
    fromState: undefined,
    toState: 'INITIATED',
    isReversible: true,
    actorId: userId,
    notes: `Release type: ${input.release_type}`,
  }).catch(err => console.error('[TransitionLog] Failed to log release initiation:', err));

  return result;
}

// ============================================================================
// APPROVE RELEASE
// ============================================================================

/**
 * Approve a release. Moves INITIATED → APPROVED.
 */
export async function approveRelease(
  releaseId: string,
  userId: string,
  notes?: string
): Promise<CarRelease> {
  const current = await getRelease(releaseId);
  if (!current) throw new Error(`Release ${releaseId} not found`);
  if (current.status !== 'INITIATED') {
    throw new Error(`Cannot approve release in status ${current.status}`);
  }

  const result = await queryOne<CarRelease>(
    `UPDATE car_releases SET
      status = 'APPROVED',
      approved_by = $1,
      approved_at = NOW(),
      notes = COALESCE($2, notes)
    WHERE id = $3
    RETURNING *`,
    [userId, notes || null, releaseId]
  );

  if (!result) throw new Error('Failed to approve release');

  logTransition({
    processType: 'car_release',
    entityId: releaseId,
    entityNumber: current.car_number,
    fromState: 'INITIATED',
    toState: 'APPROVED',
    isReversible: true,
    actorId: userId,
  }).catch(err => console.error('[TransitionLog] Failed to log release approval:', err));

  return result;
}

// ============================================================================
// EXECUTE RELEASE
// ============================================================================

/**
 * Begin executing a release. Moves APPROVED → EXECUTING.
 * This is the step where physical actions begin (car movement, paperwork).
 */
export async function executeRelease(
  releaseId: string,
  userId: string
): Promise<CarRelease> {
  const current = await getRelease(releaseId);
  if (!current) throw new Error(`Release ${releaseId} not found`);
  if (current.status !== 'APPROVED') {
    throw new Error(`Cannot execute release in status ${current.status}`);
  }

  const result = await queryOne<CarRelease>(
    `UPDATE car_releases SET status = 'EXECUTING'
     WHERE id = $1
     RETURNING *`,
    [releaseId]
  );

  if (!result) throw new Error('Failed to execute release');

  logTransition({
    processType: 'car_release',
    entityId: releaseId,
    entityNumber: current.car_number,
    fromState: 'APPROVED',
    toState: 'EXECUTING',
    isReversible: false,
    actorId: userId,
    notes: 'Physical release in progress',
  }).catch(err => console.error('[TransitionLog] Failed to log release execution:', err));

  return result;
}

// ============================================================================
// COMPLETE RELEASE
// ============================================================================

/**
 * Complete a release. Atomic transaction:
 * 1. Mark car_releases.status = COMPLETED
 * 2. Deactivate rider_cars record (is_active=FALSE, removed_date=TODAY)
 * 3. Complete linked car_assignment if present
 * 4. Complete linked car_lease_transition if present
 * 5. Log audit events
 */
export async function completeRelease(
  releaseId: string,
  userId: string,
  notes?: string
): Promise<CarRelease> {
  const current = await getRelease(releaseId);
  if (!current) throw new Error(`Release ${releaseId} not found`);
  if (current.status !== 'EXECUTING') {
    throw new Error(`Cannot complete release in status ${current.status}`);
  }

  const result = await transaction(async (client) => {
    // 1. Mark release COMPLETED
    const releaseResult = await client.query(
      `UPDATE car_releases SET
        status = 'COMPLETED',
        completed_by = $1,
        completed_at = NOW(),
        notes = COALESCE($2, notes)
      WHERE id = $3
      RETURNING *`,
      [userId, notes || null, releaseId]
    );
    const release = releaseResult.rows[0] as CarRelease;

    // 2. Deactivate rider_cars record
    await client.query(
      `UPDATE rider_cars SET
        is_active = FALSE,
        removed_date = CURRENT_DATE
      WHERE rider_id = $1 AND car_number = $2 AND is_active = TRUE`,
      [current.rider_id, current.car_number]
    );

    // 3. Complete linked assignment if it's still active
    if (current.assignment_id) {
      await client.query(
        `UPDATE car_assignments SET
          status = 'Complete',
          completed_at = NOW(),
          updated_by_id = $1
        WHERE id = $2 AND status NOT IN ('Complete', 'Cancelled')`,
        [userId, current.assignment_id]
      );
    }

    // 4. Complete linked transition if present
    if (current.transition_id) {
      await client.query(
        `UPDATE car_lease_transitions SET
          status = 'Complete',
          completed_date = CURRENT_DATE,
          completed_by = $1,
          completion_notes = $2
        WHERE id = $3 AND status NOT IN ('Complete', 'Cancelled')`,
        [userId, notes || 'Completed via release workflow', current.transition_id]
      );
    }

    return release;
  });

  // Non-blocking: log transition + asset event
  const sideEffects: { type: string; entity_type: string; entity_id: string }[] = [];
  if (current.assignment_id) {
    sideEffects.push({ type: 'completed', entity_type: 'car_assignment', entity_id: current.assignment_id });
  }
  if (current.transition_id) {
    sideEffects.push({ type: 'completed', entity_type: 'car_lease_transition', entity_id: current.transition_id });
  }

  logTransition({
    processType: 'car_release',
    entityId: releaseId,
    entityNumber: current.car_number,
    fromState: 'EXECUTING',
    toState: 'COMPLETED',
    isReversible: false,
    actorId: userId,
    sideEffects,
    notes: notes || undefined,
  }).catch(err => console.error('[TransitionLog] Failed to log release completion:', err));

  // Record asset event
  const carResult = await queryOne<{ id: string }>('SELECT id FROM cars WHERE car_number = $1', [current.car_number]);
  if (carResult) {
    assetEventService.recordEvent(carResult.id, 'car.released_from_rider', {
      release_id: releaseId,
      rider_id: current.rider_id,
      release_type: current.release_type,
      assignment_id: current.assignment_id,
    }, {
      sourceTable: 'car_releases',
      sourceId: releaseId,
      performedBy: userId,
    }).catch(() => {}); // non-blocking
  }

  // Alert planning team
  createAlert({
    alert_type: 'car_released',
    severity: 'info',
    title: `Car ${current.car_number} released from rider`,
    message: `Release type: ${current.release_type}. Car is now available for reassignment.`,
    entity_type: 'car_releases',
    entity_id: releaseId,
    target_role: 'planner',
    metadata: {
      car_number: current.car_number,
      release_type: current.release_type,
      rider_id: current.rider_id,
    },
  }).catch(() => {}); // non-blocking

  return result;
}

// ============================================================================
// CANCEL RELEASE
// ============================================================================

/**
 * Cancel a release from any non-terminal state.
 */
export async function cancelRelease(
  releaseId: string,
  userId: string,
  reason: string
): Promise<CarRelease> {
  const current = await getRelease(releaseId);
  if (!current) throw new Error(`Release ${releaseId} not found`);
  if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
    throw new Error(`Cannot cancel release in terminal status ${current.status}`);
  }

  const result = await queryOne<CarRelease>(
    `UPDATE car_releases SET
      status = 'CANCELLED',
      cancelled_by = $1,
      cancelled_at = NOW(),
      cancellation_reason = $2
    WHERE id = $3
    RETURNING *`,
    [userId, reason, releaseId]
  );

  if (!result) throw new Error('Failed to cancel release');

  logTransition({
    processType: 'car_release',
    entityId: releaseId,
    entityNumber: current.car_number,
    fromState: current.status,
    toState: 'CANCELLED',
    isReversible: false,
    actorId: userId,
    notes: reason,
  }).catch(err => console.error('[TransitionLog] Failed to log release cancellation:', err));

  return result;
}

// ============================================================================
// RELEASE FROM SHOPPING EVENT (Convenience)
// ============================================================================

/**
 * When a shopping event reaches RELEASED, this creates a release record
 * and optionally auto-advances it through APPROVED → EXECUTING → COMPLETED
 * if the release is straightforward (shop_complete type).
 */
export async function releaseFromShoppingEvent(
  shoppingEventId: string,
  carNumber: string,
  shopCode: string,
  userId: string
): Promise<CarRelease> {
  // Find the rider for this car
  const riderCar = await queryOne<{ rider_id: string }>(
    `SELECT rc.rider_id FROM rider_cars rc
     WHERE rc.car_number = $1 AND rc.is_active = TRUE
     LIMIT 1`,
    [carNumber]
  );

  if (!riderCar) {
    throw new Error(`Car ${carNumber} is not active on any rider — cannot create release`);
  }

  // Find linked assignment
  const assignment = await queryOne<{ id: string }>(
    `SELECT id FROM car_assignments
     WHERE car_number = $1 AND shop_code = $2
     AND status NOT IN ('Complete', 'Cancelled')
     ORDER BY created_at DESC LIMIT 1`,
    [carNumber, shopCode]
  );

  const release = await initiateRelease({
    car_number: carNumber,
    rider_id: riderCar.rider_id,
    release_type: 'shop_complete',
    assignment_id: assignment?.id,
    shopping_event_id: shoppingEventId,
    notes: `Auto-created from shopping event release`,
  }, userId);

  return release;
}

// ============================================================================
// QUERIES
// ============================================================================

export async function getRelease(releaseId: string): Promise<CarRelease | null> {
  return queryOne<CarRelease>('SELECT * FROM car_releases WHERE id = $1', [releaseId]);
}

export async function listReleases(filters: ReleaseFilters = {}): Promise<{ releases: CarRelease[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number | boolean)[] = [];
  let idx = 1;

  if (filters.car_number) {
    conditions.push(`car_number ILIKE $${idx++}`);
    params.push(`%${filters.car_number}%`);
  }
  if (filters.rider_id) {
    conditions.push(`rider_id = $${idx++}`);
    params.push(filters.rider_id);
  }
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(`status = ANY($${idx++})`);
      params.push(filters.status as unknown as string);
    } else {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }
  }
  if (filters.release_type) {
    conditions.push(`release_type = $${idx++}`);
    params.push(filters.release_type);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ total: string }>(`SELECT COUNT(*) as total FROM car_releases ${where}`, params);
  const total = parseInt(countResult?.total || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const releases = await query<CarRelease>(
    `SELECT * FROM car_releases ${where}
     ORDER BY CASE status
       WHEN 'INITIATED' THEN 1 WHEN 'APPROVED' THEN 2
       WHEN 'EXECUTING' THEN 3 WHEN 'COMPLETED' THEN 4 WHEN 'CANCELLED' THEN 5
     END, created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return { releases, total };
}

export async function getActiveReleasesView(): Promise<any[]> {
  return query('SELECT * FROM v_active_releases ORDER BY created_at DESC', []);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  initiateRelease,
  approveRelease,
  executeRelease,
  completeRelease,
  cancelRelease,
  releaseFromShoppingEvent,
  getRelease,
  listReleases,
  getActiveReleasesView,
};
