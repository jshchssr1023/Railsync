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
 * Get event history by car_number (resolves to cars.id first)
 */
export async function getCarHistoryByNumber(
  carNumber: string,
  limit: number = 100
): Promise<AssetEvent[]> {
  const car = await queryOne<{ id: string }>('SELECT id FROM cars WHERE car_number = $1', [carNumber]);
  if (!car) return [];
  return getCarHistory(car.id, limit);
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
