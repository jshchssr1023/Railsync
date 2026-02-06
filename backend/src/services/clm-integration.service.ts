/**
 * CLM / Telegraph Integration Service
 * Syncs car location data from the CLM (Car Location Message) system.
 *
 * Currently runs in MOCK mode — all syncs return simulated data.
 */

import { query, queryOne } from '../config/database';

// ============================================================================
// TYPES
// ============================================================================

export interface CarLocation {
  id: string;
  car_number: string;
  railroad: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  location_type: string;
  source: string;
  reported_at: string | null;
  synced_at: string;
}

export interface LocationHistoryEntry {
  id: string;
  car_number: string;
  railroad: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  location_type: string | null;
  source: string;
  reported_at: string | null;
  synced_at: string;
}

export interface SyncResult {
  cars_synced: number;
  cars_updated: number;
  cars_new: number;
  errors: string[];
}

// ============================================================================
// SYNC LOG HELPER
// ============================================================================

async function createSyncLog(operation: string, payload: unknown, userId?: string): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO integration_sync_log
       (system_name, operation, direction, entity_type, status, payload, initiated_by, started_at)
     VALUES ('clm', $1, 'pull', 'car_location', 'in_progress', $2, $3, NOW())
     RETURNING id`,
    [operation, JSON.stringify(payload), userId || null]
  );
  return row!.id;
}

async function completeSyncLog(logId: string, success: boolean, response: unknown, error?: string): Promise<void> {
  await query(
    `UPDATE integration_sync_log
     SET status = $1, response = $2, error_message = $3, completed_at = NOW(), updated_at = NOW()
     WHERE id = $4`,
    [success ? 'success' : 'failed', JSON.stringify(response), error || null, logId]
  );
}

// ============================================================================
// SYNC CAR LOCATIONS
// ============================================================================

export async function syncCarLocations(userId?: string): Promise<SyncResult> {
  const logId = await createSyncLog('sync_car_locations', { mode: 'mock' }, userId);

  const result: SyncResult = {
    cars_synced: 0,
    cars_updated: 0,
    cars_new: 0,
    errors: [],
  };

  // MOCK: In real implementation, would call CLM API for car position data
  console.log('[CLM MOCK] sync_car_locations: Would fetch car positions from CLM/Telegraph');

  // Simulate by reading some cars and creating mock locations
  const cars = await query<{ car_number: string }>(
    `SELECT car_number FROM cars LIMIT 20`
  );

  const railroads = ['UP', 'BNSF', 'CSX', 'NS', 'CN', 'CP', 'KCS'];
  const states = ['TX', 'LA', 'CA', 'IL', 'OH', 'PA', 'NJ'];
  const cities = ['Houston', 'Baton Rouge', 'Los Angeles', 'Chicago', 'Cleveland', 'Philadelphia', 'Newark'];

  for (const car of cars) {
    try {
      const idx = Math.floor(Math.random() * railroads.length);
      const now = new Date().toISOString();

      // Upsert current location
      await query(
        `INSERT INTO car_locations (car_number, railroad, city, state, location_type, source, reported_at, synced_at)
         VALUES ($1, $2, $3, $4, 'in_transit', 'clm', $5, NOW())
         ON CONFLICT (car_number)
         DO UPDATE SET railroad = $2, city = $3, state = $4, reported_at = $5, synced_at = NOW(), updated_at = NOW()`,
        [car.car_number, railroads[idx], cities[idx], states[idx], now]
      );

      // Add to history
      await query(
        `INSERT INTO car_location_history (car_number, railroad, city, state, location_type, source, reported_at, synced_at)
         VALUES ($1, $2, $3, $4, 'in_transit', 'clm', $5, NOW())`,
        [car.car_number, railroads[idx], cities[idx], states[idx], now]
      );

      result.cars_synced++;
      result.cars_updated++;
    } catch (err) {
      result.errors.push(`Failed to sync ${car.car_number}: ${(err as Error).message}`);
    }
  }

  // Update CLM connection status
  await query(
    `UPDATE integration_connection_status
     SET last_check_at = NOW(), last_success_at = NOW(), is_connected = TRUE, updated_at = NOW()
     WHERE system_name = 'clm'`
  );

  await completeSyncLog(logId, true, result);
  return result;
}

// ============================================================================
// GET CURRENT LOCATION
// ============================================================================

export async function getCarLocation(carNumber: string): Promise<CarLocation | null> {
  return queryOne<CarLocation>(
    `SELECT * FROM car_locations WHERE car_number = $1`,
    [carNumber]
  );
}

export async function getAllCarLocations(filters?: {
  railroad?: string;
  state?: string;
  location_type?: string;
  limit?: number;
  offset?: number;
}): Promise<{ locations: CarLocation[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters?.railroad) { conditions.push(`railroad = $${idx++}`); params.push(filters.railroad); }
  if (filters?.state) { conditions.push(`state = $${idx++}`); params.push(filters.state); }
  if (filters?.location_type) { conditions.push(`location_type = $${idx++}`); params.push(filters.location_type); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const [locations, countResult] = await Promise.all([
    query<CarLocation>(
      `SELECT * FROM car_locations ${where} ORDER BY synced_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM car_locations ${where}`,
      params
    ),
  ]);

  return { locations, total: parseInt(countResult?.count || '0', 10) };
}

// ============================================================================
// GET LOCATION HISTORY
// ============================================================================

export async function getLocationHistory(
  carNumber: string,
  limit: number = 50
): Promise<LocationHistoryEntry[]> {
  return query<LocationHistoryEntry>(
    `SELECT * FROM car_location_history WHERE car_number = $1 ORDER BY reported_at DESC LIMIT $2`,
    [carNumber, limit]
  );
}

// ============================================================================
// CONNECTION CHECK
// ============================================================================

export async function checkCLMConnection(): Promise<{
  connected: boolean;
  mode: string;
  last_check: Date;
}> {
  await query(
    `UPDATE integration_connection_status
     SET last_check_at = NOW(), is_connected = TRUE, updated_at = NOW()
     WHERE system_name = 'clm'`
  );
  return { connected: true, mode: 'mock', last_check: new Date() };
}
