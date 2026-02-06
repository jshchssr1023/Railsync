/**
 * Transfer Service — Car-to-Rider Transfer Management
 *
 * Manages the workflow for transferring cars between lease riders.
 * Wraps the existing car_lease_transitions table with proper validation,
 * atomic execution, and audit trail.
 *
 * Flow: Initiate → Validate → Confirm (InProgress) → Complete (atomic move)
 *       At any non-terminal point → Cancel
 *
 * Tables: car_lease_transitions, rider_cars, car_assignments, car_releases,
 *         state_transition_log, asset_events
 */

import { query, queryOne, transaction } from '../config/database';
import { logTransition } from './transition-log.service';
import * as assetEventService from './assetEvent.service';
import { createAlert } from './alerts.service';

// ============================================================================
// TYPES
// ============================================================================

export type TransitionType = 'return' | 'reassignment' | 'new_lease';
export type TransitionStatus = 'Pending' | 'InProgress' | 'Complete' | 'Cancelled';

export interface CarTransfer {
  id: string;
  car_number: string;
  from_rider_id: string | null;
  to_rider_id: string | null;
  transition_type: TransitionType;
  status: TransitionStatus;
  initiated_date: string;
  target_completion_date: string | null;
  completed_date: string | null;
  requires_shop_visit: boolean;
  shop_visit_id: string | null;
  notes: string | null;
  created_by: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InitiateTransferInput {
  car_number: string;
  from_rider_id: string;
  to_rider_id: string;
  transition_type: TransitionType;
  target_completion_date?: string;
  requires_shop_visit?: boolean;
  notes?: string;
}

export interface TransferPrerequisites {
  canTransfer: boolean;
  blockers: string[];
  warnings: string[];
  car_number: string;
  from_rider: { id: string; name: string; customer: string } | null;
  to_rider: { id: string; name: string; customer: string } | null;
  active_assignments: number;
  pending_amendments: number;
}

export interface TransferFilters {
  car_number?: string;
  from_rider_id?: string;
  to_rider_id?: string;
  status?: TransitionStatus | TransitionStatus[];
  transition_type?: TransitionType;
  limit?: number;
  offset?: number;
}

// ============================================================================
// VALIDATE PREREQUISITES
// ============================================================================

/**
 * Check all prerequisites before allowing a transfer. Does NOT create the transfer.
 * Returns blockers (hard stops) and warnings (informational).
 */
export async function validateTransferPrerequisites(
  carNumber: string,
  fromRiderId: string,
  toRiderId: string
): Promise<TransferPrerequisites> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Check car exists
  const car = await queryOne<{ car_number: string }>('SELECT car_number FROM cars WHERE car_number = $1', [carNumber]);
  if (!car) {
    return { canTransfer: false, blockers: ['Car not found'], warnings: [], car_number: carNumber, from_rider: null, to_rider: null, active_assignments: 0, pending_amendments: 0 };
  }

  // Check car is active on source rider
  const sourceRiderCar = await queryOne<{ is_active: boolean }>(
    'SELECT is_active FROM rider_cars WHERE rider_id = $1 AND car_number = $2 AND is_active = TRUE',
    [fromRiderId, carNumber]
  );
  if (!sourceRiderCar) {
    blockers.push(`Car ${carNumber} is not active on the source rider`);
  }

  // Check from_rider exists
  const fromRider = await queryOne<{ id: string; rider_name: string; customer_name: string }>(
    `SELECT lr.id, lr.rider_name, c.customer_name
     FROM lease_riders lr
     JOIN master_leases ml ON ml.id = lr.master_lease_id
     JOIN customers c ON c.id = ml.customer_id
     WHERE lr.id = $1`,
    [fromRiderId]
  );
  if (!fromRider) {
    blockers.push('Source rider not found');
  }

  // Check to_rider exists and is active
  const toRider = await queryOne<{ id: string; rider_name: string; customer_name: string; status: string }>(
    `SELECT lr.id, lr.rider_name, c.customer_name, lr.status
     FROM lease_riders lr
     JOIN master_leases ml ON ml.id = lr.master_lease_id
     JOIN customers c ON c.id = ml.customer_id
     WHERE lr.id = $1`,
    [toRiderId]
  );
  if (!toRider) {
    blockers.push('Destination rider not found');
  } else if (toRider.status !== 'Active') {
    blockers.push(`Destination rider is ${toRider.status}, must be Active`);
  }

  // Same rider check
  if (fromRiderId === toRiderId) {
    blockers.push('Source and destination riders are the same');
  }

  // Check for existing in-progress transfer
  const existingTransfer = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM car_lease_transitions
     WHERE car_number = $1 AND status IN ('Pending', 'InProgress')`,
    [carNumber]
  );
  if (existingTransfer) {
    blockers.push(`Car already has an active transfer (${existingTransfer.status})`);
  }

  // Check active assignments (warning, not blocker)
  const activeAssignments = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM car_assignments
     WHERE car_number = $1 AND status NOT IN ('Complete', 'Cancelled')`,
    [carNumber]
  );
  const assignmentCount = parseInt(activeAssignments?.count || '0', 10);
  if (assignmentCount > 0) {
    warnings.push(`Car has ${assignmentCount} active assignment(s) that may need completion first`);
  }

  // Check pending amendments on source rider
  const pendingAmendments = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM lease_amendments
     WHERE rider_id = $1 AND status = 'Pending'`,
    [fromRiderId]
  );
  const amendmentCount = parseInt(pendingAmendments?.count || '0', 10);
  if (amendmentCount > 0) {
    warnings.push(`Source rider has ${amendmentCount} pending amendment(s)`);
  }

  // Check active releases
  const activeRelease = await queryOne<{ id: string }>(
    `SELECT id FROM car_releases
     WHERE car_number = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')`,
    [carNumber]
  );
  if (activeRelease) {
    blockers.push('Car has an active release in progress');
  }

  return {
    canTransfer: blockers.length === 0,
    blockers,
    warnings,
    car_number: carNumber,
    from_rider: fromRider ? { id: fromRider.id, name: fromRider.rider_name, customer: fromRider.customer_name } : null,
    to_rider: toRider ? { id: toRider.id, name: toRider.rider_name, customer: toRider.customer_name } : null,
    active_assignments: assignmentCount,
    pending_amendments: amendmentCount,
  };
}

// ============================================================================
// INITIATE TRANSFER
// ============================================================================

/**
 * Create a new car_lease_transition record in Pending status.
 * Validates prerequisites first.
 */
export async function initiateTransfer(
  input: InitiateTransferInput,
  userId: string
): Promise<CarTransfer> {
  // Validate prerequisites
  const prereqs = await validateTransferPrerequisites(
    input.car_number, input.from_rider_id, input.to_rider_id
  );
  if (!prereqs.canTransfer) {
    throw new Error(`Cannot initiate transfer: ${prereqs.blockers.join('; ')}`);
  }

  const result = await queryOne<CarTransfer>(
    `INSERT INTO car_lease_transitions (
      car_number, from_rider_id, to_rider_id, transition_type,
      status, initiated_date, target_completion_date,
      requires_shop_visit, notes, created_by
    ) VALUES ($1, $2, $3, $4, 'Pending', CURRENT_DATE, $5, $6, $7, $8)
    RETURNING *`,
    [
      input.car_number,
      input.from_rider_id,
      input.to_rider_id,
      input.transition_type,
      input.target_completion_date || null,
      input.requires_shop_visit || false,
      input.notes || null,
      userId,
    ]
  );

  if (!result) throw new Error('Failed to create transfer');

  logTransition({
    processType: 'car_lease_transition',
    entityId: result.id,
    entityNumber: input.car_number,
    fromState: undefined,
    toState: 'Pending',
    isReversible: true,
    actorId: userId,
    notes: `${input.transition_type}: ${prereqs.from_rider?.customer || '?'} → ${prereqs.to_rider?.customer || '?'}`,
  }).catch(err => console.error('[TransitionLog] Failed to log transfer initiation:', err));

  return result;
}

// ============================================================================
// CONFIRM TRANSFER (Pending → InProgress)
// ============================================================================

/**
 * Move transfer from Pending to InProgress. This signals that
 * the transfer is approved and physical/administrative actions can begin.
 */
export async function confirmTransfer(
  transferId: string,
  userId: string,
  notes?: string
): Promise<CarTransfer> {
  const current = await getTransfer(transferId);
  if (!current) throw new Error(`Transfer ${transferId} not found`);
  if (current.status !== 'Pending') {
    throw new Error(`Cannot confirm transfer in status ${current.status}`);
  }

  const result = await queryOne<CarTransfer>(
    `UPDATE car_lease_transitions SET
      status = 'InProgress',
      notes = COALESCE($1, notes),
      updated_at = NOW()
    WHERE id = $2
    RETURNING *`,
    [notes || null, transferId]
  );

  if (!result) throw new Error('Failed to confirm transfer');

  logTransition({
    processType: 'car_lease_transition',
    entityId: transferId,
    entityNumber: current.car_number,
    fromState: 'Pending',
    toState: 'InProgress',
    isReversible: true,
    actorId: userId,
  }).catch(err => console.error('[TransitionLog] Failed to log transfer confirmation:', err));

  return result;
}

// ============================================================================
// COMPLETE TRANSFER (Atomic)
// ============================================================================

/**
 * Complete the transfer atomically:
 * 1. Deactivate rider_cars on source rider
 * 2. Create new rider_cars record on destination rider
 * 3. Mark transition Complete
 * 4. Log audit trail
 */
export async function completeTransfer(
  transferId: string,
  userId: string,
  notes?: string
): Promise<CarTransfer> {
  const current = await getTransfer(transferId);
  if (!current) throw new Error(`Transfer ${transferId} not found`);
  if (current.status !== 'InProgress') {
    throw new Error(`Cannot complete transfer in status ${current.status}`);
  }
  if (!current.from_rider_id || !current.to_rider_id) {
    throw new Error('Transfer must have both source and destination riders');
  }

  const result = await transaction(async (client) => {
    // 1. Deactivate on source rider
    await client.query(
      `UPDATE rider_cars SET
        is_active = FALSE,
        removed_date = CURRENT_DATE
      WHERE rider_id = $1 AND car_number = $2 AND is_active = TRUE`,
      [current.from_rider_id, current.car_number]
    );

    // 2. Create on destination rider
    await client.query(
      `INSERT INTO rider_cars (rider_id, car_number, added_date, is_active)
       VALUES ($1, $2, CURRENT_DATE, TRUE)
       ON CONFLICT DO NOTHING`,
      [current.to_rider_id, current.car_number]
    );

    // 3. Mark transition complete
    const transferResult = await client.query(
      `UPDATE car_lease_transitions SET
        status = 'Complete',
        completed_date = CURRENT_DATE,
        completed_by = $1,
        completion_notes = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *`,
      [userId, notes || null, transferId]
    );

    return transferResult.rows[0] as CarTransfer;
  });

  // Non-blocking: log + asset event + alert
  logTransition({
    processType: 'car_lease_transition',
    entityId: transferId,
    entityNumber: current.car_number,
    fromState: 'InProgress',
    toState: 'Complete',
    isReversible: false,
    actorId: userId,
    sideEffects: [
      { type: 'deactivated', entity_type: 'rider_car', entity_id: `${current.from_rider_id}:${current.car_number}` },
      { type: 'created', entity_type: 'rider_car', entity_id: `${current.to_rider_id}:${current.car_number}` },
    ],
    notes: notes || undefined,
  }).catch(err => console.error('[TransitionLog] Failed to log transfer completion:', err));

  const carResult = await queryOne<{ id: string }>('SELECT id FROM cars WHERE car_number = $1', [current.car_number]);
  if (carResult) {
    assetEventService.recordEvent(carResult.id, 'car.transferred_to_new_rider', {
      transfer_id: transferId,
      from_rider_id: current.from_rider_id,
      to_rider_id: current.to_rider_id,
      transition_type: current.transition_type,
    }, {
      sourceTable: 'car_lease_transitions',
      sourceId: transferId,
      performedBy: userId,
    }).catch(() => {});
  }

  createAlert({
    alert_type: 'car_transferred',
    severity: 'info',
    title: `Car ${current.car_number} transferred`,
    message: `Transfer type: ${current.transition_type}. Car moved to new rider.`,
    entity_type: 'car_lease_transitions',
    entity_id: transferId,
    target_role: 'planner',
    metadata: {
      car_number: current.car_number,
      from_rider_id: current.from_rider_id,
      to_rider_id: current.to_rider_id,
    },
  }).catch(() => {});

  return result;
}

// ============================================================================
// CANCEL TRANSFER
// ============================================================================

/**
 * Cancel a transfer from any non-terminal state.
 */
export async function cancelTransfer(
  transferId: string,
  userId: string,
  reason: string
): Promise<CarTransfer> {
  const current = await getTransfer(transferId);
  if (!current) throw new Error(`Transfer ${transferId} not found`);
  if (current.status === 'Complete' || current.status === 'Cancelled') {
    throw new Error(`Cannot cancel transfer in terminal status ${current.status}`);
  }

  const result = await queryOne<CarTransfer>(
    `UPDATE car_lease_transitions SET
      status = 'Cancelled',
      cancelled_by = $1,
      cancelled_at = NOW(),
      cancellation_reason = $2,
      updated_at = NOW()
    WHERE id = $3
    RETURNING *`,
    [userId, reason, transferId]
  );

  if (!result) throw new Error('Failed to cancel transfer');

  logTransition({
    processType: 'car_lease_transition',
    entityId: transferId,
    entityNumber: current.car_number,
    fromState: current.status,
    toState: 'Cancelled',
    isReversible: false,
    actorId: userId,
    notes: reason,
  }).catch(err => console.error('[TransitionLog] Failed to log transfer cancellation:', err));

  return result;
}

// ============================================================================
// QUERIES
// ============================================================================

export async function getTransfer(transferId: string): Promise<CarTransfer | null> {
  return queryOne<CarTransfer>('SELECT * FROM car_lease_transitions WHERE id = $1', [transferId]);
}

export async function listTransfers(filters: TransferFilters = {}): Promise<{ transfers: CarTransfer[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number | boolean)[] = [];
  let idx = 1;

  if (filters.car_number) {
    conditions.push(`car_number ILIKE $${idx++}`);
    params.push(`%${filters.car_number}%`);
  }
  if (filters.from_rider_id) {
    conditions.push(`from_rider_id = $${idx++}`);
    params.push(filters.from_rider_id);
  }
  if (filters.to_rider_id) {
    conditions.push(`to_rider_id = $${idx++}`);
    params.push(filters.to_rider_id);
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
  if (filters.transition_type) {
    conditions.push(`transition_type = $${idx++}`);
    params.push(filters.transition_type);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ total: string }>(`SELECT COUNT(*) as total FROM car_lease_transitions ${where}`, params);
  const total = parseInt(countResult?.total || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const transfers = await query<CarTransfer>(
    `SELECT * FROM car_lease_transitions ${where}
     ORDER BY CASE status
       WHEN 'Pending' THEN 1 WHEN 'InProgress' THEN 2
       WHEN 'Complete' THEN 3 WHEN 'Cancelled' THEN 4
     END, created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return { transfers, total };
}

export async function getTransferOverview(): Promise<any[]> {
  return query('SELECT * FROM v_transfer_overview ORDER BY created_at DESC', []);
}

export async function getRiderTransfers(riderId: string): Promise<CarTransfer[]> {
  return query<CarTransfer>(
    `SELECT * FROM car_lease_transitions
     WHERE (from_rider_id = $1 OR to_rider_id = $1)
     ORDER BY created_at DESC`,
    [riderId]
  );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  validateTransferPrerequisites,
  initiateTransfer,
  confirmTransfer,
  completeTransfer,
  cancelTransfer,
  getTransfer,
  listTransfers,
  getTransferOverview,
  getRiderTransfers,
};
