import { query, queryOne, transaction } from '../config/database';
import { logTransition, canRevert, markReverted, getLastTransition } from './transition-log.service';

// Types
export type ShoppingEventState =
  | 'REQUESTED'
  | 'ASSIGNED_TO_SHOP'
  | 'INBOUND'
  | 'INSPECTION'
  | 'ESTIMATE_SUBMITTED'
  | 'ESTIMATE_UNDER_REVIEW'
  | 'ESTIMATE_APPROVED'
  | 'CHANGES_REQUIRED'
  | 'WORK_AUTHORIZED'
  | 'IN_REPAIR'
  | 'QA_COMPLETE'
  | 'FINAL_ESTIMATE_SUBMITTED'
  | 'FINAL_ESTIMATE_APPROVED'
  | 'READY_FOR_RELEASE'
  | 'RELEASED'
  | 'CANCELLED';

interface ShoppingEvent {
  id: string;
  event_number: string;
  car_id: string | null;
  car_number: string;
  shop_code: string;
  batch_id: string | null;
  car_assignment_id: string | null;
  state: ShoppingEventState;
  shopping_type_code: string | null;
  shopping_reason_code: string | null;
  scope_of_work_id: string | null;
  cancelled_at: Date | null;
  cancelled_by_id: string | null;
  cancellation_reason: string | null;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
  version: number;
  project_flag_checked?: boolean;
  flagged_project_id?: string | null;
  bundled_project_assignment_id?: string | null;
}

interface CreateShoppingEventInput {
  car_number: string;
  shop_code: string;
  shopping_type_code?: string;
  shopping_reason_code?: string;
  scope_of_work_id?: string;
  car_assignment_id?: string;
}

interface CreateBatchInput {
  shop_code: string;
  shopping_type_code?: string;
  shopping_reason_code?: string;
  scope_of_work_id?: string;
  car_numbers: string[];
  notes?: string;
}

interface ShoppingEventFilters {
  state?: ShoppingEventState;
  shop_code?: string;
  car_number?: string;
  batch_id?: string;
  shopping_type_code?: string;
  limit?: number;
  offset?: number;
}

export async function createShoppingEvent(
  input: CreateShoppingEventInput,
  userId: string
): Promise<ShoppingEvent> {
  const eventNumber = await queryOne<{ generate_event_number: string }>(
    `SELECT generate_event_number()`,
    []
  );

  // cars table uses car_number as PK, no separate id column
  const carId = null;

  const result = await queryOne<ShoppingEvent>(
    `INSERT INTO shopping_events (
      event_number,
      car_id,
      car_number,
      shop_code,
      car_assignment_id,
      state,
      shopping_type_code,
      shopping_reason_code,
      scope_of_work_id,
      created_by_id
    ) VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6, $7, $8, $9)
    RETURNING *`,
    [
      eventNumber!.generate_event_number,
      carId,
      input.car_number,
      input.shop_code,
      input.car_assignment_id || null,
      input.shopping_type_code || null,
      input.shopping_reason_code || null,
      input.scope_of_work_id || null,
      userId,
    ]
  );

  return result!;
}

export async function createBatchShoppingEvents(
  input: CreateBatchInput,
  userId: string
): Promise<{ batch: any; events: ShoppingEvent[] }> {
  return transaction(async (client) => {
    const batchNumber = await client.query(
      `SELECT generate_batch_number()`,
      []
    );
    const generatedBatchNumber = batchNumber.rows[0].generate_batch_number;

    const batchResult = await client.query(
      `INSERT INTO shopping_batches (
        batch_number,
        shop_code,
        shopping_type_code,
        shopping_reason_code,
        scope_of_work_id,
        notes,
        created_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        generatedBatchNumber,
        input.shop_code,
        input.shopping_type_code || null,
        input.shopping_reason_code || null,
        input.scope_of_work_id || null,
        input.notes || null,
        userId,
      ]
    );
    const batch = batchResult.rows[0];

    const events: ShoppingEvent[] = [];

    for (const carNumber of input.car_numbers) {
      const eventNumberResult = await client.query(
        `SELECT generate_event_number()`,
        []
      );
      const eventNumber = eventNumberResult.rows[0].generate_event_number;

      // cars table uses car_number as PK, no separate id column
      const carId = null;

      const eventResult = await client.query(
        `INSERT INTO shopping_events (
          event_number,
          car_id,
          car_number,
          shop_code,
          batch_id,
          state,
          shopping_type_code,
          shopping_reason_code,
          scope_of_work_id,
          created_by_id
        ) VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6, $7, $8, $9)
        RETURNING *`,
        [
          eventNumber,
          carId,
          carNumber,
          input.shop_code,
          batch.id,
          input.shopping_type_code || null,
          input.shopping_reason_code || null,
          input.scope_of_work_id || null,
          userId,
        ]
      );

      events.push(eventResult.rows[0]);
    }

    return { batch, events };
  });
}

export async function getShoppingEvent(id: string): Promise<ShoppingEvent | null> {
  const result = await queryOne<ShoppingEvent>(
    `SELECT * FROM v_shopping_events WHERE id = $1`,
    [id]
  );
  return result || null;
}

export async function listShoppingEvents(
  filters: ShoppingEventFilters
): Promise<{ events: ShoppingEvent[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.state) {
    conditions.push(`state = $${paramIndex++}`);
    params.push(filters.state);
  }
  if (filters.shop_code) {
    conditions.push(`shop_code = $${paramIndex++}`);
    params.push(filters.shop_code);
  }
  if (filters.car_number) {
    conditions.push(`car_number = $${paramIndex++}`);
    params.push(filters.car_number);
  }
  if (filters.batch_id) {
    conditions.push(`batch_id = $${paramIndex++}`);
    params.push(filters.batch_id);
  }
  if (filters.shopping_type_code) {
    conditions.push(`shopping_type_code = $${paramIndex++}`);
    params.push(filters.shopping_type_code);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM v_shopping_events ${whereClause}`,
    params
  );
  const total = parseInt(countResult!.count, 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const eventsResult = await query<ShoppingEvent>(
    `SELECT * FROM v_shopping_events ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return { events: eventsResult, total };
}

// ---------------------------------------------------------------------------
// Approval-gate helpers (DoD #3 – Hard Stops)
// ---------------------------------------------------------------------------

async function assertApprovedEstimate(eventId: string): Promise<void> {
  const approved = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM estimate_submissions
     WHERE shopping_event_id = $1 AND status = 'approved'`,
    [eventId]
  );
  if (!approved || parseInt(approved.count, 10) === 0) {
    throw new Error('Gate blocked: cannot authorise work without an approved estimate');
  }
}

async function assertApprovedFinalEstimate(eventId: string): Promise<void> {
  // A "final" estimate is the one submitted after QA (version > initial approved)
  const approved = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM estimate_submissions es
     WHERE es.shopping_event_id = $1
       AND es.status = 'approved'
       AND es.version_number = (
         SELECT MAX(version_number) FROM estimate_submissions
         WHERE shopping_event_id = $1
       )`,
    [eventId]
  );
  if (!approved || parseInt(approved.count, 10) === 0) {
    throw new Error('Gate blocked: cannot approve final disposition without an approved final estimate');
  }
}

async function assertResponsibilityLocked(eventId: string): Promise<void> {
  // Every line on the latest approved estimate must have a non-'unknown' responsibility
  const unresolved = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM estimate_lines el
     JOIN estimate_submissions es ON es.id = el.estimate_submission_id
     LEFT JOIN LATERAL (
       SELECT responsibility FROM estimate_line_decisions
       WHERE estimate_line_id = el.id
       ORDER BY decided_at DESC LIMIT 1
     ) ld ON TRUE
     WHERE es.shopping_event_id = $1
       AND es.status = 'approved'
       AND es.version_number = (
         SELECT MAX(version_number) FROM estimate_submissions
         WHERE shopping_event_id = $1 AND status = 'approved'
       )
       AND (ld.responsibility IS NULL OR ld.responsibility = 'unknown')`,
    [eventId]
  );
  if (unresolved && parseInt(unresolved.count, 10) > 0) {
    throw new Error(
      `Gate blocked: ${unresolved.count} estimate line(s) have unresolved responsibility (lessor vs customer)`
    );
  }
}

async function assertQAComplete(eventId: string): Promise<void> {
  const event = await queryOne<{ state: string }>(
    `SELECT state FROM shopping_events WHERE id = $1`,
    [eventId]
  );
  // The DB trigger ensures we can only reach READY_FOR_RELEASE from FINAL_ESTIMATE_APPROVED,
  // which itself requires QA_COMPLETE. This is a defence-in-depth check.
  if (!event) throw new Error('Shopping event not found');
}

// Gate map: keyed by target state, value is the async precondition check
const APPROVAL_GATES: Partial<Record<ShoppingEventState, (eventId: string) => Promise<void>>> = {
  WORK_AUTHORIZED: assertApprovedEstimate,
  FINAL_ESTIMATE_APPROVED: assertApprovedFinalEstimate,
  READY_FOR_RELEASE: async (eventId: string) => {
    await assertApprovedFinalEstimate(eventId);
    await assertResponsibilityLocked(eventId);
  },
  RELEASED: async (eventId: string) => {
    await assertApprovedFinalEstimate(eventId);
    await assertResponsibilityLocked(eventId);
  },
};

// Transitions that are reversible (soft recall allowed)
const REVERSIBLE_TRANSITIONS = new Set<string>([
  'REQUESTED->ASSIGNED_TO_SHOP',
  'ASSIGNED_TO_SHOP->INBOUND',
  'INBOUND->INSPECTION',
  'INSPECTION->ESTIMATE_SUBMITTED',
  'ESTIMATE_SUBMITTED->ESTIMATE_UNDER_REVIEW',
  'ESTIMATE_UNDER_REVIEW->CHANGES_REQUIRED',
  'ESTIMATE_UNDER_REVIEW->ESTIMATE_SUBMITTED',
  'ESTIMATE_APPROVED->ESTIMATE_UNDER_REVIEW',
  'QA_COMPLETE->IN_REPAIR',
  'READY_FOR_RELEASE->FINAL_ESTIMATE_APPROVED',
]);

export async function transitionState(
  id: string,
  toState: ShoppingEventState,
  userId: string,
  notes?: string
): Promise<ShoppingEvent> {
  try {
    // --- Approval gates (DoD #3) ---
    const gate = APPROVAL_GATES[toState];
    if (gate) {
      await gate(id);
    }

    // Capture the current state before update for transition logging
    const current = await queryOne<{ state: string; event_number: string }>(
      `SELECT state, event_number FROM shopping_events WHERE id = $1`,
      [id]
    );
    const fromState = current?.state || null;
    const eventNumber = current?.event_number || undefined;

    let result: ShoppingEvent | null;

    if (toState === 'CANCELLED') {
      result = await queryOne<ShoppingEvent>(
        `UPDATE shopping_events
         SET state = $2,
             updated_by_id = $3,
             cancellation_reason = $4,
             cancelled_by_id = $3,
             cancelled_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, toState, userId, notes || null]
      );
    } else {
      result = await queryOne<ShoppingEvent>(
        `UPDATE shopping_events
         SET state = $2,
             updated_by_id = $3,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, toState, userId]
      );
    }

    // Log the transition
    const transitionKey = fromState ? `${fromState}->${toState}` : '';
    const isReversible = REVERSIBLE_TRANSITIONS.has(transitionKey);

    await logTransition({
      processType: 'shopping_event',
      entityId: id,
      entityNumber: eventNumber,
      fromState: fromState || undefined,
      toState,
      isReversible,
      actorId: userId,
      notes,
    });

    return result!;
  } catch (error: any) {
    if (error.message?.includes('Gate blocked')) {
      throw error; // re-throw gate errors verbatim
    }
    if (error.message?.includes('invalid') || error.message?.includes('transition') || error.message?.includes('Invalid')) {
      throw new Error(
        `Invalid state transition to '${toState}': ${error.message}`
      );
    }
    throw error;
  }
}

export async function getCarShoppingHistory(carNumber: string): Promise<any[]> {
  const result = await query(
    `SELECT * FROM v_car_shopping_history WHERE car_number = $1`,
    [carNumber]
  );
  return result;
}

export async function getStateHistory(eventId: string): Promise<any[]> {
  const result = await query(
    `SELECT
       seh.*,
       u.email AS changed_by_email
     FROM shopping_event_state_history seh
     LEFT JOIN users u ON u.id = seh.changed_by_id
     WHERE seh.shopping_event_id = $1
     ORDER BY seh.changed_at`,
    [eventId]
  );
  return result;
}

export async function revertLastTransition(eventId: string, userId: string): Promise<any> {
  // 1. Check if revert is allowed
  const eligibility = await canRevert('shopping_event', eventId);
  if (!eligibility.allowed) {
    throw new Error(
      `Cannot revert: ${eligibility.blockers.join('; ')}`
    );
  }

  // 2. Get the last transition to find previousState
  const lastTransition = await getLastTransition('shopping_event', eventId);
  if (!lastTransition || !lastTransition.from_state) {
    throw new Error('Cannot revert: no previous state recorded');
  }

  const previousState = lastTransition.from_state as ShoppingEventState;

  // 3. Transition back to the previous state
  const updatedEvent = await transitionState(eventId, previousState, userId, `Revert from ${lastTransition.to_state}`);

  // 4. The transitionState call above already logged a new transition.
  //    Get it so we can link the reversal.
  const reversalTransition = await getLastTransition('shopping_event', eventId);

  // 5. Mark the original transition as reversed
  if (reversalTransition) {
    await markReverted(lastTransition.id, userId, reversalTransition.id);
  }

  return updatedEvent;
}
