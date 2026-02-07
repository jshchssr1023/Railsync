/**
 * CLM / Telegraph Integration Service
 * Syncs car location data from the CLM (Car Location Message) system.
 *
 * Supports two modes:
 *  - LIVE: calls CLM/Telegraph REST API with OAuth2 credentials
 *  - MOCK: generates simulated location data for development/testing
 *
 * Mode is controlled by CLM_MODE env var (default: mock).
 */

import { query, queryOne } from '../config/database';

// ============================================================================
// CONFIG
// ============================================================================

const CLM_CONFIG = {
  mode: (process.env.CLM_MODE || 'mock') as 'live' | 'mock',
  base_url: process.env.CLM_API_URL || 'https://clm.railinc.com/api/v1',
  client_id: process.env.CLM_CLIENT_ID || '',
  client_secret: process.env.CLM_CLIENT_SECRET || '',
  token_url: process.env.CLM_TOKEN_URL || 'https://clm.railinc.com/oauth/token',
  batch_size: parseInt(process.env.CLM_BATCH_SIZE || '200', 10),
};

let cachedToken: { access_token: string; expires_at: number } | null = null;

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
  mode: 'live' | 'mock';
}

interface CLMPositionResponse {
  equipment_id: string;
  reporting_railroad: string;
  city_name: string;
  state_province: string;
  latitude?: number;
  longitude?: number;
  position_type: string;
  event_date: string;
}

// ============================================================================
// OAUTH2 CLIENT
// ============================================================================

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  const resp = await fetch(CLM_CONFIG.token_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLM_CONFIG.client_id,
      client_secret: CLM_CONFIG.client_secret,
    }),
  });

  if (!resp.ok) {
    throw new Error(`CLM OAuth failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as { access_token: string; expires_in: number };
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

async function clmFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${CLM_CONFIG.base_url}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (!resp.ok) {
    throw new Error(`CLM API ${path}: ${resp.status} ${resp.statusText}`);
  }

  return resp.json() as Promise<T>;
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
// UPSERT HELPER
// ============================================================================

async function upsertLocation(
  carNumber: string,
  railroad: string,
  city: string,
  state: string,
  lat: number | null,
  lng: number | null,
  locationType: string,
  reportedAt: string
): Promise<'new' | 'updated'> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM car_locations WHERE car_number = $1`,
    [carNumber]
  );

  await query(
    `INSERT INTO car_locations (car_number, railroad, city, state, latitude, longitude, location_type, source, reported_at, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'clm', $8, NOW())
     ON CONFLICT (car_number)
     DO UPDATE SET railroad = $2, city = $3, state = $4, latitude = $5, longitude = $6,
                   location_type = $7, reported_at = $8, synced_at = NOW(), updated_at = NOW()`,
    [carNumber, railroad, city, state, lat, lng, locationType, reportedAt]
  );

  await query(
    `INSERT INTO car_location_history (car_number, railroad, city, state, latitude, longitude, location_type, source, reported_at, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'clm', $8, NOW())`,
    [carNumber, railroad, city, state, lat, lng, locationType, reportedAt]
  );

  return existing ? 'updated' : 'new';
}

// ============================================================================
// SYNC CAR LOCATIONS — LIVE MODE
// ============================================================================

async function syncLive(carNumbers: string[], result: SyncResult): Promise<void> {
  // Process in batches to avoid API limits
  for (let i = 0; i < carNumbers.length; i += CLM_CONFIG.batch_size) {
    const batch = carNumbers.slice(i, i + CLM_CONFIG.batch_size);
    try {
      const positions = await clmFetch<CLMPositionResponse[]>('/positions', {
        equipment_ids: batch.join(','),
      });

      for (const pos of positions) {
        try {
          const status = await upsertLocation(
            pos.equipment_id,
            pos.reporting_railroad,
            pos.city_name,
            pos.state_province,
            pos.latitude || null,
            pos.longitude || null,
            pos.position_type || 'in_transit',
            pos.event_date
          );
          result.cars_synced++;
          if (status === 'new') result.cars_new++;
          else result.cars_updated++;
        } catch (err) {
          result.errors.push(`Failed to upsert ${pos.equipment_id}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      result.errors.push(`Batch ${i}-${i + batch.length} failed: ${(err as Error).message}`);
    }
  }
}

// ============================================================================
// SYNC CAR LOCATIONS — MOCK MODE
// ============================================================================

async function syncMock(carNumbers: string[], result: SyncResult): Promise<void> {
  const railroads = ['UP', 'BNSF', 'CSX', 'NS', 'CN', 'CP', 'KCS'];
  const states = ['TX', 'LA', 'CA', 'IL', 'OH', 'PA', 'NJ'];
  const cities = ['Houston', 'Baton Rouge', 'Los Angeles', 'Chicago', 'Cleveland', 'Philadelphia', 'Newark'];

  for (const carNumber of carNumbers) {
    try {
      const idx = Math.floor(Math.random() * railroads.length);
      const now = new Date().toISOString();
      const status = await upsertLocation(
        carNumber, railroads[idx], cities[idx], states[idx], null, null, 'in_transit', now
      );
      result.cars_synced++;
      if (status === 'new') result.cars_new++;
      else result.cars_updated++;
    } catch (err) {
      result.errors.push(`Failed to sync ${carNumber}: ${(err as Error).message}`);
    }
  }
}

// ============================================================================
// PUBLIC SYNC ENTRY POINT
// ============================================================================

export async function syncCarLocations(userId?: string): Promise<SyncResult> {
  const mode = CLM_CONFIG.mode;
  const logId = await createSyncLog('sync_car_locations', { mode }, userId);

  const result: SyncResult = {
    cars_synced: 0,
    cars_updated: 0,
    cars_new: 0,
    errors: [],
    mode,
  };

  try {
    // Get car numbers to sync
    const cars = await query<{ car_number: string }>(
      mode === 'live'
        ? `SELECT car_number FROM cars WHERE status = 'active' ORDER BY car_number`
        : `SELECT car_number FROM cars LIMIT 20`
    );
    const carNumbers = cars.map(c => c.car_number);

    if (mode === 'live') {
      console.log(`[CLM LIVE] Syncing ${carNumbers.length} cars from CLM API`);
      await syncLive(carNumbers, result);
    } else {
      console.log(`[CLM MOCK] Simulating location sync for ${carNumbers.length} cars`);
      await syncMock(carNumbers, result);
    }

    // Update connection status
    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), last_success_at = NOW(), is_connected = TRUE, updated_at = NOW()
       WHERE system_name = 'clm'`
    );

    await completeSyncLog(logId, true, result);
  } catch (err) {
    const errMsg = (err as Error).message;
    result.errors.push(errMsg);
    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), is_connected = FALSE, error_message = $1, updated_at = NOW()
       WHERE system_name = 'clm'`,
      [errMsg]
    );
    await completeSyncLog(logId, false, result, errMsg);
  }

  return result;
}

// ============================================================================
// SYNC SINGLE CAR (on-demand lookup)
// ============================================================================

export async function syncSingleCar(carNumber: string, userId?: string): Promise<CarLocation | null> {
  if (CLM_CONFIG.mode === 'live') {
    try {
      const positions = await clmFetch<CLMPositionResponse[]>('/positions', {
        equipment_ids: carNumber,
      });
      if (positions.length > 0) {
        const pos = positions[0];
        await upsertLocation(
          pos.equipment_id, pos.reporting_railroad, pos.city_name,
          pos.state_province, pos.latitude || null, pos.longitude || null,
          pos.position_type || 'in_transit', pos.event_date
        );
      }
    } catch (err) {
      console.error(`[CLM] Failed to sync single car ${carNumber}:`, (err as Error).message);
    }
  }
  return getCarLocation(carNumber);
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
  api_reachable?: boolean;
}> {
  const mode = CLM_CONFIG.mode;
  let apiReachable: boolean | undefined;

  if (mode === 'live') {
    try {
      await getAccessToken();
      apiReachable = true;
    } catch {
      apiReachable = false;
    }
  }

  const isConnected = mode === 'mock' || apiReachable === true;
  await query(
    `UPDATE integration_connection_status
     SET last_check_at = NOW(), is_connected = $1, updated_at = NOW()
     WHERE system_name = 'clm'`,
    [isConnected]
  );

  return { connected: isConnected, mode, last_check: new Date(), api_reachable: apiReachable };
}
