/**
 * Asset Event Service — Lifecycle ledger for car asset events
 *
 * Records immutable events into the asset_events table.
 * Provides history and current-state queries for any car.
 */

import { query, queryOne } from '../config/database';

export interface AssetEvent {
  id: string;
  car_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  previous_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  source_table?: string;
  source_id?: string;
  performed_by?: string;
  performed_at: string;
  notes?: string;
}

/**
 * Record a new asset event (append-only, cannot be updated or deleted)
 */
export async function recordEvent(
  carId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  options?: {
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    sourceTable?: string;
    sourceId?: string;
    performedBy?: string;
    notes?: string;
  }
): Promise<AssetEvent> {
  const rows = await query<AssetEvent>(
    `INSERT INTO asset_events (
      car_id, event_type, event_data,
      previous_state, new_state,
      source_table, source_id,
      performed_by, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      carId,
      eventType,
      JSON.stringify(eventData),
      options?.previousState ? JSON.stringify(options.previousState) : null,
      options?.newState ? JSON.stringify(options.newState) : null,
      options?.sourceTable || null,
      options?.sourceId || null,
      options?.performedBy || null,
      options?.notes || null,
    ]
  );

  return rows[0];
}

/**
 * Get full event history for a car, ordered newest first
 */
export async function getCarHistory(
  carId: string,
  limit: number = 100
): Promise<AssetEvent[]> {
  return query<AssetEvent>(
    `SELECT * FROM asset_events
     WHERE car_id = $1
     ORDER BY performed_at DESC
     LIMIT $2`,
    [carId, limit]
  );
}

/**
 * Get event history by car_number (resolves to cars.id first).
 *
 * Merges two sources into a single timeline:
 *   1. asset_events – direct lifecycle events keyed by car_id
 *   2. state_transition_log – unified audit trail where the car number
 *      appears either as entity_number (allocations, car_assignments,
 *      car_lease_transitions) or via a linked shopping_event row.
 *
 * The merged result is sorted by date descending and capped at `limit`.
 */
export async function getCarHistoryByNumber(
  carNumber: string,
  limit: number = 100
): Promise<AssetEvent[]> {
  const car = await queryOne<{ id: string }>('SELECT id FROM cars WHERE car_number = $1', [carNumber]);
  if (!car) return [];

  // 1. Existing asset_events
  const assetEvents = await getCarHistory(car.id, limit);

  // 2. state_transition_log entries for this car.
  //    entity_number = carNumber covers allocations, car_assignments, car_lease_transitions.
  //    The subquery covers shopping_event entries where entity_id references a
  //    shopping_events row whose car_number matches.
  const transitionRows = await query<{
    id: string;
    process_type: string;
    entity_id: string;
    entity_number: string | null;
    from_state: string | null;
    to_state: string;
    actor_id: string | null;
    actor_email: string | null;
    notes: string | null;
    created_at: string;
  }>(
    `SELECT id, process_type, entity_id, entity_number,
            from_state, to_state, actor_id, actor_email,
            notes, created_at
     FROM state_transition_log
     WHERE entity_number = $1
        OR (process_type = 'shopping_event'
            AND entity_id IN (
              SELECT id FROM shopping_events WHERE car_number = $1
            ))
     ORDER BY created_at DESC
     LIMIT $2`,
    [carNumber, limit]
  );

  // 3. Map transition log rows into the AssetEvent shape
  const mappedTransitions: AssetEvent[] = transitionRows.map((row) => ({
    id: row.id,
    car_id: car.id,
    event_type: row.process_type,
    event_data: {
      from_state: row.from_state,
      to_state: row.to_state,
      notes: row.notes,
      entity_number: row.entity_number,
    },
    performed_by: row.actor_email || row.actor_id || undefined,
    performed_at: row.created_at,
    source_table: 'state_transition_log',
    source_id: row.entity_id,
  }));

  // 4. Merge, deduplicate by id, sort descending by date, and cap at limit
  const seen = new Set<string>();
  const merged: AssetEvent[] = [];
  for (const evt of [...assetEvents, ...mappedTransitions]) {
    if (!seen.has(evt.id)) {
      seen.add(evt.id);
      merged.push(evt);
    }
  }

  merged.sort((a, b) => {
    const ta = new Date(a.performed_at).getTime();
    const tb = new Date(b.performed_at).getTime();
    return tb - ta;
  });

  return merged.slice(0, limit);
}

/**
 * Get the latest event of each type for a car (current state snapshot)
 */
export async function getCarCurrentState(
  carId: string
): Promise<AssetEvent[]> {
  return query<AssetEvent>(
    `SELECT DISTINCT ON (event_type) *
     FROM asset_events
     WHERE car_id = $1
     ORDER BY event_type, performed_at DESC`,
    [carId]
  );
}

export default {
  recordEvent,
  getCarHistory,
  getCarHistoryByNumber,
  getCarCurrentState,
};
