/**
 * Idle Period Service — Car Idle Tracking & Cost Attribution
 *
 * Manages the idle_periods table. Each car can have at most one open
 * idle period at a time (enforced by DB unique partial index
 * idx_one_active_idle_per_car on end_date IS NULL).
 *
 * An idle period opens when a car becomes unassigned (off_rent, returned,
 * or shopping event closed without next assignment). It closes when the
 * car enters a new shopping event, goes on_rent, or is scrapped.
 *
 * Tables: idle_periods, storage_rates, asset_events
 */

import { query, queryOne } from '../config/database';
import logger from '../config/logger';
import * as assetEventService from './assetEvent.service';

// ============================================================================
// TYPES
// ============================================================================

export type IdleReason =
  | 'between_leases'
  | 'awaiting_prep'
  | 'awaiting_triage'
  | 'market_conditions'
  | 'hold'
  | 'new_to_fleet'
  | 'unknown';

export interface IdlePeriod {
  id: string;
  car_id: string;
  car_number: string;
  start_date: string;
  end_date: string | null;
  location_code: string | null;
  reason: IdleReason | null;
  daily_rate: number | null;
  created_at: string;
}

export interface IdleCostSummary {
  car_id: string;
  car_number: string;
  total_idle_days: number;
  total_cost: number;
  periods: Array<{
    id: string;
    start_date: string;
    end_date: string | null;
    days: number;
    daily_rate: number | null;
    cost: number;
    reason: string | null;
    location_code: string | null;
  }>;
}

// ============================================================================
// OPEN IDLE PERIOD
// ============================================================================

/**
 * Open an idle period for a car. Looks up the current storage rate for the
 * location if provided. The DB unique partial index enforces one active
 * period per car.
 */
export async function openIdlePeriod(
  carId: string,
  carNumber: string,
  reason: IdleReason,
  locationCode?: string,
  dailyRate?: number
): Promise<IdlePeriod> {
  // Look up storage rate if location provided and no explicit rate given
  let rate = dailyRate ?? null;
  if (locationCode && rate === null) {
    const rateRow = await queryOne<{ rate_per_day: number }>(
      `SELECT rate_per_day FROM storage_rates
       WHERE location_code = $1 AND rate_type = 'combined'
         AND superseded_date IS NULL
       ORDER BY effective_date DESC LIMIT 1`,
      [locationCode]
    );
    if (rateRow) rate = rateRow.rate_per_day;
  }

  const result = await queryOne<IdlePeriod>(
    `INSERT INTO idle_periods (car_id, car_number, start_date, reason, location_code, daily_rate)
     VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)
     RETURNING *`,
    [carId, carNumber, reason, locationCode || null, rate]
  );

  if (!result) throw new Error('Failed to open idle period');

  assetEventService.recordEvent(carId, 'car.idle_period_opened', {
    idle_period_id: result.id,
    reason,
    location_code: locationCode,
    daily_rate: rate,
  }, {
    sourceTable: 'idle_periods',
    sourceId: result.id,
  }).catch(() => {}); // non-blocking

  return result;
}

// ============================================================================
// CLOSE IDLE PERIOD
// ============================================================================

/**
 * Close the currently open idle period for a car. No-op if no open period exists.
 */
export async function closeIdlePeriod(
  carId: string,
  endDate?: string
): Promise<IdlePeriod | null> {
  const result = await queryOne<IdlePeriod>(
    `UPDATE idle_periods SET end_date = COALESCE($1::date, CURRENT_DATE)
     WHERE car_id = $2 AND end_date IS NULL
     RETURNING *`,
    [endDate || null, carId]
  );

  if (result) {
    assetEventService.recordEvent(carId, 'car.idle_period_closed', {
      idle_period_id: result.id,
      start_date: result.start_date,
      end_date: result.end_date,
      reason: result.reason,
    }, {
      sourceTable: 'idle_periods',
      sourceId: result.id,
    }).catch(() => {}); // non-blocking
  }

  return result;
}

// ============================================================================
// QUERY
// ============================================================================

/**
 * Get the currently open idle period for a car (end_date IS NULL).
 */
export async function getActiveIdlePeriod(carId: string): Promise<IdlePeriod | null> {
  return queryOne<IdlePeriod>(
    'SELECT * FROM idle_periods WHERE car_id = $1 AND end_date IS NULL',
    [carId]
  );
}

/**
 * List all idle periods for a car (open and closed).
 */
export async function listIdlePeriods(carId: string): Promise<IdlePeriod[]> {
  return query<IdlePeriod>(
    'SELECT * FROM idle_periods WHERE car_id = $1 ORDER BY start_date DESC',
    [carId]
  );
}

// ============================================================================
// COST SUMMARY
// ============================================================================

/**
 * Compute total idle days and cost for a car across all periods.
 * Open periods use CURRENT_DATE as end boundary.
 */
export async function getIdleCostSummary(carId: string): Promise<IdleCostSummary | null> {
  const periods = await query<IdlePeriod>(
    'SELECT * FROM idle_periods WHERE car_id = $1 ORDER BY start_date ASC',
    [carId]
  );

  if (periods.length === 0) return null;

  let totalIdleDays = 0;
  let totalCost = 0;
  const periodDetails = periods.map((p) => {
    const start = new Date(p.start_date);
    const end = p.end_date ? new Date(p.end_date) : new Date();
    const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const cost = p.daily_rate ? days * p.daily_rate : 0;
    totalIdleDays += days;
    totalCost += cost;
    return {
      id: p.id,
      start_date: p.start_date,
      end_date: p.end_date,
      days,
      daily_rate: p.daily_rate,
      cost,
      reason: p.reason,
      location_code: p.location_code,
    };
  });

  return {
    car_id: periods[0].car_id,
    car_number: periods[0].car_number,
    total_idle_days: totalIdleDays,
    total_cost: totalCost,
    periods: periodDetails,
  };
}
