import { pool } from '../config/database';

export interface TransitionLogEntry {
  id: string;
  process_type: string;
  entity_id: string;
  entity_number: string | null;
  from_state: string | null;
  to_state: string;
  is_reversible: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_transition_id: string | null;
  side_effects: { type: string; entity_type: string; entity_id: string }[];
  actor_id: string | null;
  actor_email: string | null;
  notes: string | null;
  created_at: string;
}

export interface RevertEligibility {
  allowed: boolean;
  previousState?: string;
  transitionId?: string;
  blockers: string[];
}

/**
 * Log a state transition to the unified state_transition_log table.
 */
export async function logTransition(params: {
  processType: string;
  entityId: string;
  entityNumber?: string;
  fromState?: string;
  toState: string;
  isReversible: boolean;
  actorId?: string;
  actorEmail?: string;
  sideEffects?: { type: string; entity_type: string; entity_id: string }[];
  notes?: string;
}): Promise<TransitionLogEntry> {
  const result = await pool.query(
    `INSERT INTO state_transition_log
       (process_type, entity_id, entity_number, from_state, to_state, is_reversible,
        actor_id, actor_email, side_effects, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.processType,
      params.entityId,
      params.entityNumber || null,
      params.fromState || null,
      params.toState,
      params.isReversible,
      params.actorId || null,
      params.actorEmail || null,
      JSON.stringify(params.sideEffects || []),
      params.notes || null,
    ]
  );
  return result.rows[0];
}

/**
 * Get the most recent non-reversed transition for an entity.
 */
export async function getLastTransition(
  processType: string,
  entityId: string
): Promise<TransitionLogEntry | null> {
  const result = await pool.query(
    `SELECT * FROM state_transition_log
     WHERE process_type = $1 AND entity_id = $2 AND reversed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [processType, entityId]
  );
  return result.rows[0] || null;
}

/**
 * Check whether the last transition for an entity can be reverted.
 * Validates: is_reversible flag, entity hasn't moved further, side effects cleanable.
 */
export async function canRevert(
  processType: string,
  entityId: string
): Promise<RevertEligibility> {
  const blockers: string[] = [];

  const last = await getLastTransition(processType, entityId);
  if (!last) {
    return { allowed: false, blockers: ['No transition history found'] };
  }

  if (!last.is_reversible) {
    return {
      allowed: false,
      transitionId: last.id,
      previousState: last.from_state || undefined,
      blockers: ['This transition is marked as irreversible'],
    };
  }

  // Check entity current state matches to_state (hasn't moved further)
  const currentState = await getCurrentEntityState(processType, entityId);
  if (currentState && currentState !== last.to_state) {
    blockers.push(
      `Entity has moved to "${currentState}" since the transition to "${last.to_state}"`
    );
  }

  // Check side effects haven't advanced
  if (last.side_effects && Array.isArray(last.side_effects)) {
    for (const effect of last.side_effects) {
      const advancedCheck = await hasSideEffectAdvanced(effect);
      if (advancedCheck) {
        blockers.push(advancedCheck);
      }
    }
  }

  return {
    allowed: blockers.length === 0,
    transitionId: last.id,
    previousState: last.from_state || undefined,
    blockers,
  };
}

/**
 * Mark a transition as reversed, linking to the reversal transition entry.
 */
export async function markReverted(
  transitionId: string,
  reversedBy: string,
  reversalTransitionId: string
): Promise<void> {
  await pool.query(
    `UPDATE state_transition_log
     SET reversed_at = NOW(), reversed_by = $2, reversal_transition_id = $3
     WHERE id = $1`,
    [transitionId, reversedBy, reversalTransitionId]
  );
}

/**
 * Get full transition history for an entity, ordered chronologically.
 */
export async function getTransitionHistory(
  processType: string,
  entityId: string
): Promise<TransitionLogEntry[]> {
  const result = await pool.query(
    `SELECT * FROM state_transition_log
     WHERE process_type = $1 AND entity_id = $2
     ORDER BY created_at ASC`,
    [processType, entityId]
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Look up the current state of an entity from its source table.
 */
async function getCurrentEntityState(
  processType: string,
  entityId: string
): Promise<string | null> {
  const stateQueries: Record<string, { table: string; column: string; idColumn: string }> = {
    shopping_event: { table: 'shopping_events', column: 'state', idColumn: 'id' },
    invoice_case: { table: 'invoice_cases', column: 'workflow_state', idColumn: 'id' },
    shopping_request: { table: 'shopping_requests', column: 'status', idColumn: 'id' },
    bad_order: { table: 'bad_order_reports', column: 'status', idColumn: 'id' },
    allocation: { table: 'allocations', column: 'status', idColumn: 'id' },
    demand: { table: 'demands', column: 'status', idColumn: 'id' },
    project_assignment: { table: 'project_assignments', column: 'plan_state', idColumn: 'id' },
    car_assignment: { table: 'car_assignments', column: 'status', idColumn: 'id' },
    car_release: { table: 'car_releases', column: 'status', idColumn: 'id' },
    car_lease_transition: { table: 'car_lease_transitions', column: 'status', idColumn: 'id' },
    scope_of_work: { table: 'scope_of_work', column: 'status', idColumn: 'id' },
  };

  const config = stateQueries[processType];
  if (!config) return null;

  const result = await pool.query(
    `SELECT ${config.column} FROM ${config.table} WHERE ${config.idColumn} = $1`,
    [entityId]
  );
  return result.rows[0]?.[config.column] || null;
}

/**
 * Check whether a side-effect entity has advanced past its initial state.
 * Returns a blocker message string if advanced, or null if still safe to clean up.
 */
async function hasSideEffectAdvanced(
  effect: { type: string; entity_type: string; entity_id: string }
): Promise<string | null> {
  if (effect.entity_type === 'shopping_event') {
    const result = await pool.query(
      `SELECT state FROM shopping_events WHERE id = $1`,
      [effect.entity_id]
    );
    const state = result.rows[0]?.state;
    if (state && state !== 'REQUESTED') {
      return `Side-effect shopping event ${effect.entity_id} has advanced to "${state}" and cannot be automatically cleaned up`;
    }
  }

  if (effect.entity_type === 'car_assignment') {
    const result = await pool.query(
      `SELECT status FROM car_assignments WHERE id = $1`,
      [effect.entity_id]
    );
    const status = result.rows[0]?.status;
    if (status && status !== 'Planned') {
      return `Side-effect car assignment ${effect.entity_id} has advanced to "${status}" and cannot be automatically cleaned up`;
    }
  }

  return null;
}
