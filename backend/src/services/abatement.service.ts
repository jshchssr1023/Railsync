/**
 * Abatement Service
 * Global + per-rider abatement configuration, period computation from
 * shopping events, manual override, and billing-period day calculation.
 */

import { query, queryOne, transaction } from '../config/database';
import logger from '../config/logger';

// ============================================================================
// Types
// ============================================================================

export interface ShoppingTypeAbatementConfig {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  qualifies_for_abatement: boolean;
}

export interface RiderAbatementOverride {
  id: string;
  rider_id: string;
  shopping_type_id: string;
  shopping_type_code: string;
  shopping_type_name: string;
  qualifies_for_abatement: boolean;
  is_override: boolean; // true = rider-level, false = global default
  created_by: string | null;
  created_at: string;
}

export interface AbatementPeriod {
  id: string;
  car_number: string;
  rider_id: string;
  shopping_event_id: string | null;
  shopping_type_code: string | null;
  start_date: string;
  end_date: string | null;
  is_manual_override: boolean;
  override_reason: string | null;
  overridden_by: string | null;
  abatement_days: number | null;
  status: 'active' | 'void' | 'billed';
  applied_to_invoice_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  event_number?: string;
  event_state?: string;
  rider_code?: string;
  customer_name?: string;
}

// ============================================================================
// 1. GLOBAL ABATEMENT CONFIG
// ============================================================================

/**
 * Get all shopping types with their abatement qualification status.
 */
export async function getGlobalAbatementConfig(): Promise<ShoppingTypeAbatementConfig[]> {
  return query<ShoppingTypeAbatementConfig>(
    `SELECT id, code, name, description, is_active, qualifies_for_abatement
     FROM shopping_types
     WHERE is_active = TRUE
     ORDER BY sort_order, code`
  );
}

/**
 * Update whether a shopping type qualifies for abatement globally.
 */
export async function updateGlobalAbatementConfig(
  typeId: string,
  qualifies: boolean,
  changedBy: string
): Promise<ShoppingTypeAbatementConfig> {
  const rows = await query<ShoppingTypeAbatementConfig>(
    `UPDATE shopping_types
     SET qualifies_for_abatement = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, code, name, description, is_active, qualifies_for_abatement`,
    [typeId, qualifies]
  );
  if (rows.length === 0) throw new Error(`Shopping type not found: ${typeId}`);
  logger.info({ typeId, qualifies, changedBy }, 'Global abatement config updated');
  return rows[0];
}

// ============================================================================
// 2. PER-RIDER OVERRIDES
// ============================================================================

/**
 * Get merged abatement config for a rider: global defaults + rider-level overrides.
 * Returns one row per active shopping type, flagging which are overridden.
 */
export async function getRiderAbatementOverrides(riderId: string): Promise<RiderAbatementOverride[]> {
  return query<RiderAbatementOverride>(
    `SELECT
       st.id AS shopping_type_id,
       st.code AS shopping_type_code,
       st.name AS shopping_type_name,
       COALESCE(rao.qualifies_for_abatement, st.qualifies_for_abatement) AS qualifies_for_abatement,
       rao.id IS NOT NULL AS is_override,
       rao.id,
       $1::uuid AS rider_id,
       rao.created_by,
       rao.created_at
     FROM shopping_types st
     LEFT JOIN rider_abatement_overrides rao
       ON rao.shopping_type_id = st.id AND rao.rider_id = $1
     WHERE st.is_active = TRUE
     ORDER BY st.sort_order, st.code`,
    [riderId]
  );
}

/**
 * Set (upsert) a rider-level abatement override for a specific shopping type.
 */
export async function setRiderAbatementOverride(
  riderId: string,
  typeId: string,
  qualifies: boolean,
  changedBy: string
): Promise<void> {
  await query(
    `INSERT INTO rider_abatement_overrides (rider_id, shopping_type_id, qualifies_for_abatement, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (rider_id, shopping_type_id) DO UPDATE
       SET qualifies_for_abatement = $3, created_by = $4, created_at = NOW()`,
    [riderId, typeId, qualifies, changedBy]
  );
  logger.info({ riderId, typeId, qualifies, changedBy }, 'Rider abatement override set');
}

/**
 * Delete a rider-level abatement override (revert to global default).
 */
export async function deleteRiderAbatementOverride(
  riderId: string,
  typeId: string
): Promise<void> {
  await query(
    `DELETE FROM rider_abatement_overrides
     WHERE rider_id = $1 AND shopping_type_id = $2`,
    [riderId, typeId]
  );
}

// ============================================================================
// 3. ABATEMENT QUALIFICATION CHECK
// ============================================================================

/**
 * Check whether a given shopping type qualifies for abatement on a given rider.
 * Rider override takes precedence over global default.
 */
export async function doesQualifyForAbatement(
  riderId: string,
  shoppingTypeCode: string
): Promise<boolean> {
  // Check rider-level override first
  const override = await queryOne<{ qualifies_for_abatement: boolean }>(
    `SELECT rao.qualifies_for_abatement
     FROM rider_abatement_overrides rao
     JOIN shopping_types st ON st.id = rao.shopping_type_id
     WHERE rao.rider_id = $1 AND st.code = $2`,
    [riderId, shoppingTypeCode]
  );
  if (override) return override.qualifies_for_abatement;

  // Fall back to global default
  const global = await queryOne<{ qualifies_for_abatement: boolean }>(
    `SELECT qualifies_for_abatement FROM shopping_types WHERE code = $1`,
    [shoppingTypeCode]
  );
  return global?.qualifies_for_abatement ?? false;
}

// ============================================================================
// 4. PERIOD COMPUTATION
// ============================================================================

/**
 * Compute abatement periods for a car+rider within a billing period.
 *
 * Logic:
 *  1. Query shopping_events for this car where state reached an in-shop state
 *  2. For each qualifying event, derive start_date from state history (first INBOUND/INSPECTION)
 *  3. Derive end_date from RELEASED state, or use period end if still in shop
 *  4. Clip dates to billing period
 *  5. Check for existing manual overrides (use override dates if present)
 *  6. Upsert abatement_periods records
 *  7. Return total abatement_days
 */
export async function computeAbatementPeriods(
  carNumber: string,
  riderId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ periods: AbatementPeriod[]; totalAbatementDays: number }> {
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);

  // Find shopping events for this car that overlap the billing period
  // A car is "in shop" from the first INBOUND/INSPECTION transition until RELEASED
  const events = await query<{
    event_id: string;
    event_number: string;
    shopping_type_code: string;
    state: string;
    shop_entry_date: string | null;
    shop_exit_date: string | null;
  }>(
    `SELECT
       se.id AS event_id,
       se.event_number,
       se.shopping_type_code,
       se.state,
       (SELECT MIN(sh.changed_at)::date::text
        FROM shopping_event_state_history sh
        WHERE sh.shopping_event_id = se.id
          AND sh.to_state IN ('INBOUND', 'INSPECTION')
       ) AS shop_entry_date,
       (SELECT MAX(sh.changed_at)::date::text
        FROM shopping_event_state_history sh
        WHERE sh.shopping_event_id = se.id
          AND sh.to_state = 'RELEASED'
       ) AS shop_exit_date
     FROM shopping_events se
     WHERE se.car_number = $1
       AND se.state NOT IN ('REQUESTED', 'ASSIGNED_TO_SHOP', 'CANCELLED')
       AND se.shopping_type_code IS NOT NULL
       AND (
         -- Event started before or during period
         EXISTS (
           SELECT 1 FROM shopping_event_state_history sh
           WHERE sh.shopping_event_id = se.id
             AND sh.to_state IN ('INBOUND', 'INSPECTION')
             AND sh.changed_at::date <= $3::date
         )
       )
       AND (
         -- Event ended during or after period start, or still in shop
         se.state != 'RELEASED'
         OR EXISTS (
           SELECT 1 FROM shopping_event_state_history sh
           WHERE sh.shopping_event_id = se.id
             AND sh.to_state = 'RELEASED'
             AND sh.changed_at::date >= $2::date
         )
       )
     ORDER BY se.created_at`,
    [carNumber, periodStart, periodEnd]
  );

  const periods: AbatementPeriod[] = [];
  let totalAbatementDays = 0;

  for (const ev of events) {
    if (!ev.shop_entry_date) continue;

    // Check if this shopping type qualifies for abatement on this rider
    const qualifies = await doesQualifyForAbatement(riderId, ev.shopping_type_code);
    if (!qualifies) continue;

    // Check for existing manual override for this event
    const existingOverride = await queryOne<AbatementPeriod>(
      `SELECT * FROM abatement_periods
       WHERE shopping_event_id = $1 AND rider_id = $2 AND is_manual_override = TRUE AND status = 'active'`,
      [ev.event_id, riderId]
    );

    let startDate: Date;
    let endDate: Date;

    if (existingOverride) {
      // Use override dates
      startDate = new Date(existingOverride.start_date);
      endDate = existingOverride.end_date ? new Date(existingOverride.end_date) : pEnd;
    } else {
      // Use computed dates from shopping event state history
      startDate = new Date(ev.shop_entry_date);
      endDate = ev.shop_exit_date ? new Date(ev.shop_exit_date) : pEnd;
    }

    // Clip to billing period
    const clippedStart = startDate < pStart ? pStart : startDate;
    const clippedEnd = endDate > pEnd ? pEnd : endDate;

    // Calculate days (inclusive)
    const days = Math.max(
      0,
      Math.floor((clippedEnd.getTime() - clippedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    if (days <= 0) continue;

    // Upsert the abatement period (skip if manual override already exists)
    if (!existingOverride) {
      const upserted = await query<AbatementPeriod>(
        `INSERT INTO abatement_periods (
           car_number, rider_id, shopping_event_id, shopping_type_code,
           start_date, end_date, abatement_days, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         ON CONFLICT ON CONSTRAINT abatement_periods_pkey DO NOTHING
         RETURNING *`,
        [carNumber, riderId, ev.event_id, ev.shopping_type_code,
         clippedStart.toISOString().split('T')[0],
         clippedEnd.toISOString().split('T')[0],
         days]
      );

      // If conflict (no upsert), try update existing
      if (upserted.length === 0) {
        // Update existing non-override period for this event
        await query(
          `UPDATE abatement_periods
           SET start_date = $3, end_date = $4, abatement_days = $5, updated_at = NOW()
           WHERE shopping_event_id = $1 AND rider_id = $2
             AND is_manual_override = FALSE AND status = 'active'`,
          [ev.event_id, riderId,
           clippedStart.toISOString().split('T')[0],
           clippedEnd.toISOString().split('T')[0],
           days]
        );
      }
    }

    totalAbatementDays += days;

    // Fetch the final period record
    const period = existingOverride || await queryOne<AbatementPeriod>(
      `SELECT * FROM abatement_periods
       WHERE shopping_event_id = $1 AND rider_id = $2 AND status = 'active'
       ORDER BY is_manual_override DESC
       LIMIT 1`,
      [ev.event_id, riderId]
    );
    if (period) periods.push(period);
  }

  return { periods, totalAbatementDays };
}

// ============================================================================
// 5. MANUAL OVERRIDE
// ============================================================================

/**
 * Override an abatement period's dates (or create a manual abatement period).
 */
export async function overrideAbatementPeriod(
  id: string,
  startDate: string,
  endDate: string | null,
  reason: string,
  overriddenBy: string
): Promise<AbatementPeriod> {
  // Calculate days if both dates provided
  let days: number | null = null;
  if (endDate) {
    days = Math.max(
      0,
      Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  const rows = await query<AbatementPeriod>(
    `UPDATE abatement_periods
     SET start_date = $2,
         end_date = $3,
         abatement_days = $4,
         is_manual_override = TRUE,
         override_reason = $5,
         overridden_by = $6,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, startDate, endDate, days, reason, overriddenBy]
  );
  if (rows.length === 0) throw new Error(`Abatement period not found: ${id}`);
  logger.info({ id, startDate, endDate, reason, overriddenBy }, 'Abatement period overridden');
  return rows[0];
}

/**
 * Create a manual abatement period (not tied to a shopping event).
 */
export async function createManualAbatementPeriod(data: {
  car_number: string;
  rider_id: string;
  start_date: string;
  end_date: string | null;
  reason: string;
  created_by: string;
}): Promise<AbatementPeriod> {
  let days: number | null = null;
  if (data.end_date) {
    days = Math.max(
      0,
      Math.floor((new Date(data.end_date).getTime() - new Date(data.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  const rows = await query<AbatementPeriod>(
    `INSERT INTO abatement_periods (
       car_number, rider_id, start_date, end_date,
       abatement_days, is_manual_override, override_reason, overridden_by, status
     ) VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, 'active')
     RETURNING *`,
    [data.car_number, data.rider_id, data.start_date, data.end_date, days, data.reason, data.created_by]
  );
  return rows[0];
}

/**
 * Void an abatement period.
 */
export async function voidAbatementPeriod(
  id: string,
  reason: string,
  voidedBy: string
): Promise<AbatementPeriod> {
  const rows = await query<AbatementPeriod>(
    `UPDATE abatement_periods
     SET status = 'void',
         override_reason = COALESCE(override_reason || ' | ', '') || 'VOIDED: ' || $2,
         overridden_by = $3,
         updated_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [id, reason, voidedBy]
  );
  if (rows.length === 0) throw new Error(`Abatement period not found or already void: ${id}`);
  return rows[0];
}

// ============================================================================
// 6. QUERYING
// ============================================================================

/**
 * List abatement periods with optional filters.
 */
export async function listAbatementPeriods(filters: {
  rider_id?: string;
  car_number?: string;
  status?: string;
  period_start?: string;
  period_end?: string;
  limit?: number;
  offset?: number;
}): Promise<{ periods: AbatementPeriod[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.rider_id) {
    conditions.push(`ap.rider_id = $${idx++}`);
    params.push(filters.rider_id);
  }
  if (filters.car_number) {
    conditions.push(`ap.car_number = $${idx++}`);
    params.push(filters.car_number);
  }
  if (filters.status) {
    conditions.push(`ap.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.period_start) {
    conditions.push(`ap.end_date >= $${idx++}::date OR ap.end_date IS NULL`);
    params.push(filters.period_start);
  }
  if (filters.period_end) {
    conditions.push(`ap.start_date <= $${idx++}::date`);
    params.push(filters.period_end);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM abatement_periods ap ${where}`,
    params
  );
  const total = parseInt(countResult?.count || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const periods = await query<AbatementPeriod>(
    `SELECT ap.*,
            se.event_number,
            se.state AS event_state,
            lr.rider_id AS rider_code,
            c.customer_name
     FROM abatement_periods ap
     LEFT JOIN shopping_events se ON se.id = ap.shopping_event_id
     LEFT JOIN lease_riders lr ON lr.id = ap.rider_id
     LEFT JOIN master_leases ml ON ml.id = lr.master_lease_id
     LEFT JOIN customers c ON c.id = ml.customer_id
     ${where}
     ORDER BY ap.start_date DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...params, limit, offset]
  );

  return { periods, total };
}

/**
 * Get total abatement days for a car+rider in a billing period.
 * Uses materialized abatement_periods table.
 */
export async function getAbatementDays(
  carNumber: string,
  riderId: string,
  periodStart: string,
  periodEnd: string
): Promise<number> {
  // First compute/refresh periods for this car+rider
  const { totalAbatementDays } = await computeAbatementPeriods(
    carNumber, riderId, periodStart, periodEnd
  );
  return totalAbatementDays;
}

// ============================================================================
// 7. BILLING PREVIEW
// ============================================================================

export interface BillingPreviewCustomer {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  riders: BillingPreviewRider[];
  total_cars: number;
  total_on_rent_days: number;
  total_abatement_days: number;
  total_billable_days: number;
  estimated_total: number;
}

export interface BillingPreviewRider {
  rider_id: string;
  rider_code: string;
  rider_name: string | null;
  rate_per_car: number;
  cars: BillingPreviewCar[];
  subtotal: number;
}

export interface BillingPreviewCar {
  car_number: string;
  on_rent_days: number;
  abatement_days: number;
  billable_days: number;
  daily_rate: number;
  line_total: number;
}

/**
 * Generate a billing preview for a given period without creating invoices.
 * Shows per-customer breakdown with on-rent, abatement, and billable days.
 */
export async function generateBillingPreview(
  fiscalYear: number,
  fiscalMonth: number
): Promise<BillingPreviewCustomer[]> {
  const periodStart = new Date(fiscalYear, fiscalMonth - 1, 1);
  const periodEnd = new Date(fiscalYear, fiscalMonth, 0);
  const daysInMonth = periodEnd.getDate();
  const periodStartStr = periodStart.toISOString().split('T')[0];
  const periodEndStr = periodEnd.toISOString().split('T')[0];

  // Import the on-rent function from contracts service
  const { getOnRentDays } = await import('./contracts.service');

  // Get all active customers with active riders
  const customers = await query<{
    customer_id: string;
    customer_code: string;
    customer_name: string;
  }>(
    `SELECT DISTINCT c.id AS customer_id, c.customer_code, c.customer_name
     FROM customers c
     JOIN master_leases ml ON ml.customer_id = c.id AND ml.status = 'Active'
     JOIN lease_riders lr ON lr.master_lease_id = ml.id AND lr.status = 'Active'
     WHERE c.is_active = TRUE
       AND lr.rate_per_car IS NOT NULL AND lr.rate_per_car > 0
     ORDER BY c.customer_code`
  );

  const result: BillingPreviewCustomer[] = [];

  for (const cust of customers) {
    const riderCars = await query<{
      rider_id: string;
      rider_code: string;
      rider_name: string | null;
      rate_per_car: number;
      car_number: string;
      added_date: string;
      removed_date: string | null;
      is_on_rent: boolean;
    }>(
      `SELECT
         lr.id AS rider_id, lr.rider_id AS rider_code, lr.rider_name,
         lr.rate_per_car, rc.car_number, rc.added_date, rc.removed_date, rc.is_on_rent
       FROM lease_riders lr
       JOIN master_leases ml ON ml.id = lr.master_lease_id
       JOIN rider_cars rc ON rc.rider_id = lr.id
       WHERE ml.customer_id = $1
         AND lr.status = 'Active' AND ml.status = 'Active'
         AND lr.rate_per_car IS NOT NULL AND lr.rate_per_car > 0
         AND rc.added_date <= $2
         AND (rc.removed_date IS NULL OR rc.removed_date >= $3)
       ORDER BY lr.rider_id, rc.car_number`,
      [cust.customer_id, periodEndStr, periodStartStr]
    );

    // Group by rider
    const riderMap = new Map<string, BillingPreviewRider>();
    let custTotalOnRent = 0;
    let custTotalAbatement = 0;
    let custTotalBillable = 0;
    let custEstTotal = 0;

    for (const rc of riderCars) {
      if (!riderMap.has(rc.rider_id)) {
        riderMap.set(rc.rider_id, {
          rider_id: rc.rider_id,
          rider_code: rc.rider_code,
          rider_name: rc.rider_name,
          rate_per_car: Number(rc.rate_per_car),
          cars: [],
          subtotal: 0,
        });
      }

      const rider = riderMap.get(rc.rider_id)!;
      const dailyRate = Number(rc.rate_per_car) / daysInMonth;

      // Calculate on-rent days
      let onRentDays: number;
      try {
        onRentDays = await getOnRentDays(rc.car_number, rc.rider_id, periodStartStr, periodEndStr);
      } catch {
        // Fallback to pro-rated from added/removed dates
        const carAdded = new Date(rc.added_date);
        const carRemoved = rc.removed_date ? new Date(rc.removed_date) : null;
        const billStart = carAdded > periodStart ? carAdded : periodStart;
        const billEnd = carRemoved && carRemoved < periodEnd ? carRemoved : periodEnd;
        onRentDays = Math.max(0, Math.floor((billEnd.getTime() - billStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      }

      // Calculate abatement days
      let abatementDays = 0;
      try {
        const { totalAbatementDays } = await computeAbatementPeriods(
          rc.car_number, rc.rider_id, periodStartStr, periodEndStr
        );
        abatementDays = totalAbatementDays;
      } catch (err) {
        logger.warn({ carNumber: rc.car_number, err }, 'Failed to compute abatement periods');
      }

      const billableDays = Math.max(0, onRentDays - abatementDays);
      const lineTotal = Math.round(dailyRate * billableDays * 100) / 100;

      rider.cars.push({
        car_number: rc.car_number,
        on_rent_days: onRentDays,
        abatement_days: abatementDays,
        billable_days: billableDays,
        daily_rate: Math.round(dailyRate * 100) / 100,
        line_total: lineTotal,
      });

      rider.subtotal += lineTotal;
      custTotalOnRent += onRentDays;
      custTotalAbatement += abatementDays;
      custTotalBillable += billableDays;
      custEstTotal += lineTotal;
    }

    result.push({
      customer_id: cust.customer_id,
      customer_code: cust.customer_code,
      customer_name: cust.customer_name,
      riders: Array.from(riderMap.values()),
      total_cars: riderCars.length,
      total_on_rent_days: custTotalOnRent,
      total_abatement_days: custTotalAbatement,
      total_billable_days: custTotalBillable,
      estimated_total: Math.round(custEstTotal * 100) / 100,
    });
  }

  return result;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Global config
  getGlobalAbatementConfig,
  updateGlobalAbatementConfig,
  // Per-rider overrides
  getRiderAbatementOverrides,
  setRiderAbatementOverride,
  deleteRiderAbatementOverride,
  // Qualification check
  doesQualifyForAbatement,
  // Period computation
  computeAbatementPeriods,
  getAbatementDays,
  // Manual override
  overrideAbatementPeriod,
  createManualAbatementPeriod,
  voidAbatementPeriod,
  // Querying
  listAbatementPeriods,
  // Billing preview
  generateBillingPreview,
};
