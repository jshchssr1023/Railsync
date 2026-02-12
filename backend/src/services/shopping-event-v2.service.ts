/**
 * Shopping Event V2 Service — Unified Shopping Event Lifecycle
 *
 * Replaces both assignment.service.ts and shopping-event.service.ts for new
 * workflows. Old services remain for reading legacy data during transition.
 *
 * 14-state machine (+ CANCELLED):
 *   EVENT -> PACKET -> SOW -> SHOP_ASSIGNED -> DISPO_TO_SHOP -> ENROUTE ->
 *   ARRIVED -> ESTIMATE_RECEIVED -> ESTIMATE_APPROVED -> WORK_IN_PROGRESS ->
 *   FINAL_ESTIMATE_RECEIVED -> FINAL_APPROVED -> DISPO_TO_DESTINATION -> CLOSED
 *
 * Estimate review loops (backward):
 *   ESTIMATE_APPROVED -> ESTIMATE_RECEIVED
 *   FINAL_APPROVED -> FINAL_ESTIMATE_RECEIVED
 *
 * MRU shortcut: FINAL_APPROVED -> CLOSED (MRU events only)
 *
 * Tables: shopping_events_v2, estimate_submissions, idle_periods, triage_queue
 */

import { query, queryOne, transaction } from '../config/database';
import logger from '../config/logger';
import { logTransition } from './transition-log.service';
import * as assetEventService from './assetEvent.service';
import * as idlePeriodService from './idle-period.service';
import * as triageQueueService from './triage-queue.service';

// ============================================================================
// TYPES
// ============================================================================

export type ShoppingEventV2State =
  | 'EVENT'
  | 'PACKET'
  | 'SOW'
  | 'SHOP_ASSIGNED'
  | 'DISPO_TO_SHOP'
  | 'ENROUTE'
  | 'ARRIVED'
  | 'ESTIMATE_RECEIVED'
  | 'ESTIMATE_APPROVED'
  | 'WORK_IN_PROGRESS'
  | 'FINAL_ESTIMATE_RECEIVED'
  | 'FINAL_APPROVED'
  | 'DISPO_TO_DESTINATION'
  | 'CLOSED'
  | 'CANCELLED';

export type ShoppingEventSource =
  | 'lease_prep'
  | 'bad_order'
  | 'qualification'
  | 'triage'
  | 'demand_plan'
  | 'service_plan'
  | 'master_plan'
  | 'project_plan'
  | 'quick_shop'
  | 'manual'
  | 'import'
  | 'migration';

export type Disposition =
  | 'to_customer'
  | 'to_storage'
  | 'to_another_shop'
  | 'to_scrap';

export interface ShoppingEventV2 {
  id: string;
  event_number: string;
  car_id: string;
  car_number: string;
  state: ShoppingEventV2State;
  source: ShoppingEventSource;
  source_reference_id: string | null;
  source_reference_type: string | null;
  rider_car_id: string | null;
  shop_code: string | null;
  shop_name: string | null;
  target_month: string | null;
  target_date: string | null;
  priority: number;
  is_expedited: boolean;
  shopping_type_code: string | null;
  shopping_reason_code: string | null;
  scope_of_work_id: string | null;
  batch_id: string | null;
  estimated_cost: number | null;
  approved_cost: number | null;
  invoiced_cost: number | null;
  cost_variance: number | null;
  disposition: Disposition | null;
  disposition_reference_id: string | null;
  disposition_notes: string | null;
  project_id: string | null;
  cancelled_at: string | null;
  cancelled_by_id: string | null;
  cancellation_reason: string | null;
  event_at: string;
  closed_at: string | null;
  version: number;
  created_at: string;
  created_by_id: string | null;
  updated_at: string;
  updated_by_id: string | null;
}

export interface CreateShoppingEventInput {
  car_number: string;
  source: ShoppingEventSource;
  source_reference_id?: string;
  source_reference_type?: string;
  rider_car_id?: string;
  shop_code?: string;
  shop_name?: string;
  target_month?: string;
  target_date?: string;
  priority?: number;
  shopping_type_code?: string;
  shopping_reason_code?: string;
  scope_of_work_id?: string;
  project_id?: string;
  estimated_cost?: number;
}

export interface ShoppingEventV2Filters {
  state?: ShoppingEventV2State;
  shop_code?: string;
  car_number?: string;
  source?: ShoppingEventSource;
  shopping_type_code?: string;
  project_id?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// EVENT NUMBER GENERATOR
// ============================================================================

async function generateEventNumberV2(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `SE-${dateStr}-`;
  const result = await queryOne<{ next_seq: string }>(
    `SELECT LPAD(
       (COALESCE(MAX(SUBSTRING(event_number FROM '\\d{5}$')::INT), 0) + 1)::TEXT,
       5, '0'
     ) AS next_seq
     FROM shopping_events_v2
     WHERE event_number LIKE $1 || '%'`,
    [prefix]
  );
  return `${prefix}${result?.next_seq || '00001'}`;
}

// ============================================================================
// CREATE SHOPPING EVENT
// ============================================================================

/**
 * Create a new shopping event. Validates:
 *   R7: No disposed cars
 *   R1: One active per car (DB unique index)
 *
 * Side effects:
 *   - Closes any open idle period for this car
 *   - Resolves any active triage entry (resolution depends on source)
 */
export async function createShoppingEvent(
  input: CreateShoppingEventInput,
  userId: string
): Promise<ShoppingEventV2> {
  // Validate car exists and is not disposed (R7)
  const car = await queryOne<{ id: string; car_number: string; fleet_status: string }>(
    `SELECT id, car_number, fleet_status FROM cars WHERE car_number = $1`,
    [input.car_number]
  );
  if (!car) throw new Error(`Car ${input.car_number} not found`);
  if (car.fleet_status === 'disposed') {
    throw new Error(`Cannot create shopping event for disposed car ${input.car_number} (R7)`);
  }

  const eventNumber = await generateEventNumberV2();

  const result = await queryOne<ShoppingEventV2>(
    `INSERT INTO shopping_events_v2 (
      event_number, car_id, car_number, state, source,
      source_reference_id, source_reference_type, rider_car_id,
      shop_code, shop_name, target_month, target_date, priority,
      shopping_type_code, shopping_reason_code, scope_of_work_id,
      project_id, estimated_cost, created_by_id
    ) VALUES (
      $1, $2, $3, 'EVENT', $4,
      $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14, $15,
      $16, $17, $18
    ) RETURNING *`,
    [
      eventNumber,
      car.id,
      input.car_number,
      input.source,
      input.source_reference_id || null,
      input.source_reference_type || null,
      input.rider_car_id || null,
      input.shop_code || null,
      input.shop_name || null,
      input.target_month || null,
      input.target_date || null,
      input.priority || 3,
      input.shopping_type_code || null,
      input.shopping_reason_code || null,
      input.scope_of_work_id || null,
      input.project_id || null,
      input.estimated_cost || null,
      userId,
    ]
  );

  if (!result) throw new Error('Failed to create shopping event');

  // Side effect: Close any open idle period (car is now in a process)
  idlePeriodService.closeIdlePeriod(car.id)
    .catch(err => logger.error({ err }, `[ShoppingEventV2] Failed to close idle period for ${input.car_number}`));

  // Side effect: Resolve active triage entry if one exists
  const triageEntry = await triageQueueService.getActiveTriageEntry(car.id);
  if (triageEntry) {
    triageQueueService.resolveTriageEntry(
      triageEntry.id,
      'assigned_to_shop',
      userId,
      `Shopping event ${eventNumber} created`,
      result.id
    ).catch(err => logger.error({ err }, `[ShoppingEventV2] Failed to resolve triage for ${input.car_number}`));
  }

  // Audit
  logTransition({
    processType: 'shopping_event_v2',
    entityId: result.id,
    entityNumber: eventNumber,
    fromState: undefined,
    toState: 'EVENT',
    isReversible: true,
    actorId: userId,
    notes: `Source: ${input.source}`,
  }).catch(err => logger.error({ err }, '[TransitionLog] Failed to log shopping event creation'));

  assetEventService.recordEvent(car.id, 'car.shopping_event_created', {
    event_id: result.id,
    event_number: eventNumber,
    source: input.source,
    shop_code: input.shop_code,
    shopping_type_code: input.shopping_type_code,
  }, {
    sourceTable: 'shopping_events_v2',
    sourceId: result.id,
    performedBy: userId,
  }).catch(() => {});

  return result;
}

// ============================================================================
// TRANSITION STATE
// ============================================================================

// Transitions that are reversible (soft recall allowed)
const REVERSIBLE_TRANSITIONS = new Set<string>([
  'EVENT->PACKET',
  'PACKET->SOW',
  'SOW->SHOP_ASSIGNED',
  'SHOP_ASSIGNED->DISPO_TO_SHOP',
  'DISPO_TO_SHOP->ENROUTE',
  'ENROUTE->ARRIVED',
  'ARRIVED->ESTIMATE_RECEIVED',
  'ESTIMATE_RECEIVED->ESTIMATE_APPROVED',
  'ESTIMATE_APPROVED->ESTIMATE_RECEIVED', // review loop
  'FINAL_APPROVED->FINAL_ESTIMATE_RECEIVED', // review loop
]);

/**
 * Transition a shopping event to a new state. The DB trigger
 * (enforce_shopping_event_v2_transition) enforces:
 *   - Forward-only (except estimate review loops)
 *   - DISPO_TO_DESTINATION gated on FINAL_APPROVED
 *   - MRU shortcut: FINAL_APPROVED -> CLOSED
 *   - Terminal states (CLOSED, CANCELLED) cannot transition
 *   - Auto-sets state timestamps
 */
export async function transitionShoppingEvent(
  eventId: string,
  targetState: ShoppingEventV2State,
  userId: string,
  metadata?: {
    notes?: string;
    disposition?: Disposition;
    disposition_reference_id?: string;
    disposition_notes?: string;
  }
): Promise<ShoppingEventV2> {
  const current = await getShoppingEvent(eventId);
  if (!current) throw new Error(`Shopping event ${eventId} not found`);

  let result: ShoppingEventV2 | null;

  if (targetState === 'CANCELLED') {
    result = await queryOne<ShoppingEventV2>(
      `UPDATE shopping_events_v2 SET
        state = 'CANCELLED',
        cancelled_at = NOW(),
        cancelled_by_id = $1,
        cancellation_reason = $2,
        updated_by_id = $1
      WHERE id = $3
      RETURNING *`,
      [userId, metadata?.notes || null, eventId]
    );
  } else if (targetState === 'DISPO_TO_DESTINATION') {
    // Disposition fields required
    if (!metadata?.disposition) {
      throw new Error('disposition is required when transitioning to DISPO_TO_DESTINATION');
    }
    result = await queryOne<ShoppingEventV2>(
      `UPDATE shopping_events_v2 SET
        state = 'DISPO_TO_DESTINATION',
        disposition = $1,
        disposition_reference_id = $2,
        disposition_notes = $3,
        updated_by_id = $4
      WHERE id = $5
      RETURNING *`,
      [
        metadata.disposition,
        metadata.disposition_reference_id || null,
        metadata.disposition_notes || null,
        userId,
        eventId,
      ]
    );
  } else {
    result = await queryOne<ShoppingEventV2>(
      `UPDATE shopping_events_v2 SET
        state = $1,
        updated_by_id = $2
      WHERE id = $3
      RETURNING *`,
      [targetState, userId, eventId]
    );
  }

  if (!result) throw new Error(`Failed to transition shopping event to ${targetState}`);

  // Log transition
  const transitionKey = `${current.state}->${targetState}`;
  logTransition({
    processType: 'shopping_event_v2',
    entityId: eventId,
    entityNumber: current.event_number,
    fromState: current.state,
    toState: targetState,
    isReversible: REVERSIBLE_TRANSITIONS.has(transitionKey),
    actorId: userId,
    notes: metadata?.notes,
  }).catch(err => logger.error({ err }, '[TransitionLog] Failed to log shopping event transition'));

  // Side effects on CLOSED
  if (targetState === 'CLOSED') {
    onEventClosed(result, userId).catch(err =>
      logger.error({ err }, `[ShoppingEventV2] Post-close side effects failed for ${eventId}`)
    );
  }

  return result;
}

/**
 * Side effects when a shopping event reaches CLOSED:
 *   - If disposition = 'to_storage': open idle period + create triage entry
 *   - If disposition = 'to_customer': no idle/triage (car goes on rent)
 *   - If disposition = 'to_another_shop': next event should already exist
 *   - If disposition = 'to_scrap': scrap workflow handles it
 */
async function onEventClosed(event: ShoppingEventV2, userId: string): Promise<void> {
  if (event.disposition === 'to_storage') {
    // Open idle period
    idlePeriodService.openIdlePeriod(
      event.car_id,
      event.car_number,
      'between_leases'
    ).catch(err => logger.error({ err }, `[ShoppingEventV2] Failed to open idle period after close`));

    // Create triage entry (S8)
    triageQueueService.createTriageEntry(
      event.car_id,
      event.car_number,
      'customer_return',
      3,
      `Shopping event ${event.event_number} closed with disposition to_storage`,
      userId,
      event.id
    ).catch(err => logger.error({ err }, `[ShoppingEventV2] Failed to create triage entry after close`));
  }

  assetEventService.recordEvent(event.car_id, 'car.shopping_event_closed', {
    event_id: event.id,
    event_number: event.event_number,
    disposition: event.disposition,
    approved_cost: event.approved_cost,
    invoiced_cost: event.invoiced_cost,
  }, {
    sourceTable: 'shopping_events_v2',
    sourceId: event.id,
    performedBy: userId,
  }).catch(() => {});
}

// ============================================================================
// SET DISPOSITION (at DISPO_TO_DESTINATION)
// ============================================================================

/**
 * Set disposition on an event in FINAL_APPROVED state and transition to
 * DISPO_TO_DESTINATION. If disposition is 'to_another_shop', creates the
 * next event immediately (chain shopping — Pressure Test 5).
 */
export async function setDisposition(
  eventId: string,
  disposition: Disposition,
  userId: string,
  options?: {
    disposition_reference_id?: string;
    disposition_notes?: string;
    next_shop_code?: string;
    next_shopping_type_code?: string;
  }
): Promise<{ event: ShoppingEventV2; nextEvent?: ShoppingEventV2 }> {
  const event = await transitionShoppingEvent(eventId, 'DISPO_TO_DESTINATION', userId, {
    disposition,
    disposition_reference_id: options?.disposition_reference_id,
    disposition_notes: options?.disposition_notes,
  });

  let nextEvent: ShoppingEventV2 | undefined;

  // Chain shopping: create next event immediately
  if (disposition === 'to_another_shop' && options?.next_shop_code) {
    nextEvent = await createShoppingEvent({
      car_number: event.car_number,
      source: event.source as ShoppingEventSource,
      shop_code: options.next_shop_code,
      shopping_type_code: options.next_shopping_type_code || event.shopping_type_code || undefined,
      project_id: event.project_id || undefined,
    }, userId);

    // Link the chain: set disposition_reference_id to next event
    await queryOne(
      `UPDATE shopping_events_v2 SET disposition_reference_id = $1 WHERE id = $2`,
      [nextEvent.id, eventId]
    );
  }

  return { event, nextEvent };
}

// ============================================================================
// CANCEL SHOPPING EVENT
// ============================================================================

export async function cancelShoppingEvent(
  eventId: string,
  reason: string,
  userId: string
): Promise<ShoppingEventV2> {
  return transitionShoppingEvent(eventId, 'CANCELLED', userId, { notes: reason });
}

// ============================================================================
// SUBMIT ESTIMATE (with repair limit snapshot — R14)
// ============================================================================

/**
 * Submit an estimate for a shopping event. Snapshots the car's current
 * book value and computed repair limit (R14). The exceeds_repair_limit
 * column is auto-computed by the DB (R13 — flagged, not blocked).
 */
export async function submitEstimate(
  eventId: string,
  estimateData: {
    total_cost: number;
    line_items?: unknown[];
    notes?: string;
    submitted_by?: string;
  }
): Promise<{ id: string; exceeds_repair_limit: boolean }> {
  const event = await getShoppingEvent(eventId);
  if (!event) throw new Error(`Shopping event ${eventId} not found`);

  // Snapshot repair limit (R14)
  const repairLimit = await queryOne<{ book_value: number | null; repair_limit: number | null }>(
    `SELECT
       c.book_value,
       get_economic_repair_limit(c.car_number) AS repair_limit
     FROM cars c WHERE c.id = $1`,
    [event.car_id]
  );

  const result = await queryOne<{
    id: string;
    exceeds_repair_limit: boolean;
  }>(
    `INSERT INTO estimate_submissions (
      shopping_event_id, total_cost, notes, submitted_by,
      car_book_value_at_estimate, economic_repair_limit
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, exceeds_repair_limit`,
    [
      eventId,
      estimateData.total_cost,
      estimateData.notes || null,
      estimateData.submitted_by || null,
      repairLimit?.book_value || null,
      repairLimit?.repair_limit || null,
    ]
  );

  if (!result) throw new Error('Failed to submit estimate');

  return result;
}

// ============================================================================
// QUERY
// ============================================================================

export async function getShoppingEvent(eventId: string): Promise<ShoppingEventV2 | null> {
  return queryOne<ShoppingEventV2>(
    'SELECT * FROM shopping_events_v2 WHERE id = $1',
    [eventId]
  );
}

export async function listShoppingEvents(
  filters: ShoppingEventV2Filters = {}
): Promise<{ events: ShoppingEventV2[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
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
  if (filters.source) {
    conditions.push(`source = $${paramIndex++}`);
    params.push(filters.source);
  }
  if (filters.shopping_type_code) {
    conditions.push(`shopping_type_code = $${paramIndex++}`);
    params.push(filters.shopping_type_code);
  }
  if (filters.project_id) {
    conditions.push(`project_id = $${paramIndex++}`);
    params.push(filters.project_id);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const countResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM shopping_events_v2 ${where}`,
    params
  );

  const events = await query<ShoppingEventV2>(
    `SELECT * FROM shopping_events_v2 ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return { events, total: countResult?.count || 0 };
}

/**
 * Get shopping history for a car from the v2 table.
 */
export async function getCarShoppingHistory(carNumber: string): Promise<ShoppingEventV2[]> {
  return query<ShoppingEventV2>(
    `SELECT * FROM shopping_events_v2
     WHERE car_number = $1
     ORDER BY created_at DESC`,
    [carNumber]
  );
}

/**
 * Get the active (non-terminal) shopping event for a car, if any.
 */
export async function getActiveEventForCar(carNumber: string): Promise<ShoppingEventV2 | null> {
  return queryOne<ShoppingEventV2>(
    `SELECT * FROM shopping_events_v2
     WHERE car_number = $1 AND state NOT IN ('CLOSED', 'CANCELLED')
     ORDER BY created_at DESC LIMIT 1`,
    [carNumber]
  );
}
