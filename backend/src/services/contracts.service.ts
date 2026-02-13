/**
 * Contracts Service - Lease Hierarchy and Amendment Management
 *
 * Handles Customer → Lease → Rider → Cars navigation and amendment tracking
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

export interface Customer {
  id: string;
  customer_code: string;
  customer_name: string;
  is_active: boolean;
  active_leases: number;
  total_riders: number;
  total_cars: number;
  status?: string;
  cars_on_lease?: number;
}

export interface MasterLease {
  id: string;
  lease_id: string;
  customer_id: string;
  customer_name: string;
  lease_name: string;
  start_date: string;
  end_date: string;
  status: string;
  rider_count: number;
  car_count: number;
  monthly_revenue: number;
}

export interface LeaseRider {
  id: string;
  rider_id: string;
  master_lease_id: string;
  lease_id: string;
  customer_name: string;
  rider_name: string;
  effective_date: string;
  expiration_date: string;
  status: string;
  car_count: number;
  amendment_count: number;
  has_pending_amendments: boolean;
  cars_with_conflicts: number;
}

export interface RiderCar {
  car_number: string;
  car_type: string;
  material_type: string;
  lessee_name: string;
  current_status: string;
  rider_id: string;
  rider_name: string;
  required_shop_date: string | null;
  next_service_due: string | null;
  has_pending_amendment: boolean;
  amendment_conflict: boolean;
  conflict_reason: string | null;
  has_active_transition: boolean;
  transition_details: TransitionDetails | null;
  active_assignments: number;
}

export interface TransitionDetails {
  type: string;
  status: string;
  from_customer: string | null;
  to_customer: string | null;
  target_date: string | null;
}

export interface Amendment {
  amendment_id: string;
  amendment_code: string;
  rider_id: string;
  rider_name: string;
  lease_id: string;
  customer_name: string;
  amendment_type: string;
  effective_date: string;
  change_summary: string;
  status: string;
  is_latest_version: boolean;
  required_shop_date: string | null;
  previous_shop_date: string | null;
  service_interval_days: number | null;
  previous_service_interval: number | null;
  cars_impacted: number;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  days_until_effective: number;
  total_cars_affected: number | null;
  cars_with_conflicts: number | null;
  cars_needing_resync: number | null;
}

export interface AmendmentComparison {
  field: string;
  before: string | number | null;
  after: string | number | null;
}

// ============================================================================
// CUSTOMER OPERATIONS
// ============================================================================

export async function listCustomers(activeOnly: boolean = true): Promise<Customer[]> {
  const whereClause = activeOnly ? 'WHERE c.is_active = TRUE' : '';
  const sql = `
    SELECT
      c.id,
      c.customer_code,
      c.customer_name,
      c.is_active,
      COUNT(DISTINCT ml.id) AS active_leases,
      COUNT(DISTINCT lr.id) AS total_riders,
      COUNT(DISTINCT rc.car_number) AS total_cars
    FROM customers c
    LEFT JOIN master_leases ml ON ml.customer_id = c.id AND ml.status = 'Active'
    LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id AND lr.status = 'Active'
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.status NOT IN ('off_rent', 'cancelled')
    ${whereClause}
    GROUP BY c.id, c.customer_code, c.customer_name, c.is_active
    ORDER BY COUNT(DISTINCT rc.car_number) DESC
  `;
  return query<Customer>(sql, []);
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const sql = `
    SELECT
      c.id,
      c.customer_code,
      c.customer_name,
      c.is_active,
      COUNT(DISTINCT ml.id) AS active_leases,
      COUNT(DISTINCT lr.id) AS total_riders,
      COUNT(DISTINCT rc.car_number) AS total_cars
    FROM customers c
    LEFT JOIN master_leases ml ON ml.customer_id = c.id AND ml.status = 'Active'
    LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id AND lr.status = 'Active'
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.status NOT IN ('off_rent', 'cancelled')
    WHERE c.id = $1
    GROUP BY c.id, c.customer_code, c.customer_name, c.is_active
  `;
  return queryOne<Customer>(sql, [customerId]);
}

// ============================================================================
// MASTER LEASE OPERATIONS
// ============================================================================

export async function getCustomerLeases(customerId: string): Promise<MasterLease[]> {
  const sql = `
    SELECT
      ml.id,
      ml.lease_id,
      ml.customer_id,
      c.customer_name,
      ml.lease_name,
      ml.start_date,
      ml.end_date,
      ml.status,
      COUNT(DISTINCT lr.id) AS rider_count,
      COUNT(DISTINCT rc.car_number) AS car_count,
      COALESCE((
        SELECT SUM(lr2.rate_per_car * lr2.car_count)
        FROM lease_riders lr2
        WHERE lr2.master_lease_id = ml.id AND lr2.status = 'Active'
      ), 0) AS monthly_revenue
    FROM master_leases ml
    JOIN customers c ON c.id = ml.customer_id
    LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.status NOT IN ('off_rent', 'cancelled')
    WHERE ml.customer_id = $1
    GROUP BY ml.id, ml.lease_id, ml.customer_id, c.customer_name, ml.lease_name, ml.start_date, ml.end_date, ml.status
    ORDER BY ml.start_date DESC
  `;
  return query<MasterLease>(sql, [customerId]);
}

export async function getLease(leaseId: string): Promise<MasterLease | null> {
  const sql = `
    SELECT
      ml.id,
      ml.lease_id,
      ml.customer_id,
      c.customer_name,
      ml.lease_name,
      ml.start_date,
      ml.end_date,
      ml.status,
      COUNT(DISTINCT lr.id) AS rider_count,
      COUNT(DISTINCT rc.car_number) AS car_count,
      COALESCE((
        SELECT SUM(lr2.rate_per_car * lr2.car_count)
        FROM lease_riders lr2
        WHERE lr2.master_lease_id = ml.id AND lr2.status = 'Active'
      ), 0) AS monthly_revenue
    FROM master_leases ml
    JOIN customers c ON c.id = ml.customer_id
    LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.status NOT IN ('off_rent', 'cancelled')
    WHERE ml.id = $1
    GROUP BY ml.id, ml.lease_id, ml.customer_id, c.customer_name, ml.lease_name, ml.start_date, ml.end_date, ml.status
  `;
  return queryOne<MasterLease>(sql, [leaseId]);
}

// ============================================================================
// RIDER OPERATIONS
// ============================================================================

export async function getLeaseRiders(leaseId: string): Promise<LeaseRider[]> {
  const sql = `
    SELECT
      lr.id,
      lr.rider_id,
      lr.master_lease_id,
      ml.lease_id,
      c.customer_name,
      lr.rider_name,
      lr.effective_date,
      lr.expiration_date,
      lr.status,
      COUNT(DISTINCT rc.car_number) AS car_count,
      COUNT(DISTINCT la.id) AS amendment_count,
      EXISTS (
        SELECT 1 FROM lease_amendments la2
        WHERE la2.rider_id = lr.id AND la2.status = 'Pending'
      ) AS has_pending_amendments,
      COALESCE((
        SELECT COUNT(*) FROM rider_cars rc2
        WHERE rc2.rider_id = lr.id AND rc2.amendment_conflict = TRUE AND rc2.status NOT IN ('off_rent', 'cancelled')
      ), 0)::INTEGER AS cars_with_conflicts
    FROM lease_riders lr
    JOIN master_leases ml ON ml.id = lr.master_lease_id
    JOIN customers c ON c.id = ml.customer_id
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.status NOT IN ('off_rent', 'cancelled')
    LEFT JOIN lease_amendments la ON la.rider_id = lr.id
    WHERE lr.master_lease_id = $1
    GROUP BY lr.id, lr.rider_id, lr.master_lease_id, ml.lease_id, c.customer_name,
             lr.rider_name, lr.effective_date, lr.expiration_date, lr.status
    ORDER BY lr.effective_date DESC
  `;
  return query<LeaseRider>(sql, [leaseId]);
}

export async function getRider(riderId: string): Promise<LeaseRider | null> {
  const sql = `
    SELECT
      lr.id,
      lr.rider_id,
      lr.master_lease_id,
      ml.lease_id,
      c.customer_name,
      lr.rider_name,
      lr.effective_date,
      lr.expiration_date,
      lr.status,
      COUNT(DISTINCT rc.car_number) AS car_count,
      COUNT(DISTINCT la.id) AS amendment_count,
      EXISTS (
        SELECT 1 FROM lease_amendments la2
        WHERE la2.rider_id = lr.id AND la2.status = 'Pending'
      ) AS has_pending_amendments,
      COALESCE((
        SELECT COUNT(*) FROM rider_cars rc2
        WHERE rc2.rider_id = lr.id AND rc2.amendment_conflict = TRUE AND rc2.status NOT IN ('off_rent', 'cancelled')
      ), 0)::INTEGER AS cars_with_conflicts
    FROM lease_riders lr
    JOIN master_leases ml ON ml.id = lr.master_lease_id
    JOIN customers c ON c.id = ml.customer_id
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.status NOT IN ('off_rent', 'cancelled')
    LEFT JOIN lease_amendments la ON la.rider_id = lr.id
    WHERE lr.id = $1
    GROUP BY lr.id, lr.rider_id, lr.master_lease_id, ml.lease_id, c.customer_name,
             lr.rider_name, lr.effective_date, lr.expiration_date, lr.status
  `;
  return queryOne<LeaseRider>(sql, [riderId]);
}

export async function getRiderCars(riderId: string): Promise<RiderCar[]> {
  const sql = `
    SELECT
      c.car_number,
      c.car_type,
      c.material_type,
      c.lessee_name,
      c.current_status,
      rc.id AS rider_car_id,
      rc.status AS rider_car_status,
      rc.rider_id,
      lr.rider_name,
      rc.required_shop_date,
      rc.next_service_due,
      rc.has_pending_amendment,
      rc.amendment_conflict,
      rc.conflict_reason,
      EXISTS (
        SELECT 1 FROM car_lease_transitions clt
        WHERE clt.car_number = c.car_number
        AND clt.status IN ('Pending', 'InProgress')
      ) AS has_active_transition,
      (
        SELECT jsonb_build_object(
          'type', clt.transition_type,
          'status', clt.status,
          'from_customer', from_cust.customer_name,
          'to_customer', to_cust.customer_name,
          'target_date', clt.target_completion_date
        )
        FROM car_lease_transitions clt
        LEFT JOIN lease_riders from_lr ON from_lr.id = clt.from_rider_id
        LEFT JOIN master_leases from_ml ON from_ml.id = from_lr.master_lease_id
        LEFT JOIN customers from_cust ON from_cust.id = from_ml.customer_id
        LEFT JOIN lease_riders to_lr ON to_lr.id = clt.to_rider_id
        LEFT JOIN master_leases to_ml ON to_ml.id = to_lr.master_lease_id
        LEFT JOIN customers to_cust ON to_cust.id = to_ml.customer_id
        WHERE clt.car_number = c.car_number
        AND clt.status IN ('Pending', 'InProgress')
        LIMIT 1
      ) AS transition_details,
      COALESCE((
        SELECT COUNT(*) FROM shopping_events_v2 se2
        WHERE se2.car_number = c.car_number
        AND se2.state NOT IN ('CLOSED', 'CANCELLED')
      ), 0)::INTEGER AS active_assignments
    FROM rider_cars rc
    JOIN cars c ON c.car_number = rc.car_number
    JOIN lease_riders lr ON lr.id = rc.rider_id
    WHERE rc.rider_id = $1 AND rc.status NOT IN ('off_rent', 'cancelled')
    ORDER BY c.car_number
  `;
  return query<RiderCar>(sql, [riderId]);
}

// ============================================================================
// AMENDMENT OPERATIONS
// ============================================================================

export async function getRiderAmendments(riderId: string): Promise<Amendment[]> {
  const sql = `
    SELECT * FROM v_amendment_timeline
    WHERE rider_id = $1
    ORDER BY effective_date DESC
  `;
  return query<Amendment>(sql, [riderId]);
}

export async function getAmendment(amendmentId: string): Promise<Amendment | null> {
  const sql = 'SELECT * FROM v_amendment_timeline WHERE amendment_id = $1';
  return queryOne<Amendment>(sql, [amendmentId]);
}

export async function getAmendmentComparison(amendmentId: string): Promise<AmendmentComparison[]> {
  const amendment = await getAmendment(amendmentId);
  if (!amendment) return [];

  const comparisons: AmendmentComparison[] = [];

  if (amendment.required_shop_date || amendment.previous_shop_date) {
    comparisons.push({
      field: 'Required Shop Date',
      before: amendment.previous_shop_date,
      after: amendment.required_shop_date,
    });
  }

  if (amendment.service_interval_days || amendment.previous_service_interval) {
    comparisons.push({
      field: 'Service Interval (days)',
      before: amendment.previous_service_interval,
      after: amendment.service_interval_days,
    });
  }

  return comparisons;
}

export async function detectConflicts(amendmentId: string): Promise<number> {
  const result = await queryOne<{ detect_amendment_conflicts: number }>(
    'SELECT detect_amendment_conflicts($1)',
    [amendmentId]
  );
  return result?.detect_amendment_conflicts || 0;
}

export async function resyncSchedules(riderId: string, userId?: string): Promise<number> {
  const result = await queryOne<{ resync_rider_schedules: number }>(
    'SELECT resync_rider_schedules($1, $2)',
    [riderId, userId || null]
  );
  return result?.resync_rider_schedules || 0;
}

// ============================================================================
// CONTRACTS OVERVIEW WITH AMENDMENTS
// ============================================================================

export async function getCarsWithAmendments(
  filters: {
    hasAmendment?: boolean;
    hasConflict?: boolean;
    hasTransition?: boolean;
    customerId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ cars: RiderCar[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number | boolean)[] = [];
  let paramIndex = 1;

  if (filters.hasAmendment !== undefined) {
    conditions.push(`has_pending_amendment = $${paramIndex++}`);
    params.push(filters.hasAmendment);
  }

  if (filters.hasConflict !== undefined) {
    conditions.push(`amendment_conflict = $${paramIndex++}`);
    params.push(filters.hasConflict);
  }

  if (filters.hasTransition !== undefined) {
    conditions.push(`has_active_transition = $${paramIndex++}`);
    params.push(filters.hasTransition);
  }

  if (filters.customerId) {
    // Join to get customer filter
    conditions.push(`customer_id = $${paramIndex++}`);
    params.push(filters.customerId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countSql = `SELECT COUNT(*) as total FROM v_cars_with_amendments ${whereClause}`;
  const countResult = await queryOne<{ total: string }>(countSql, params);
  const total = parseInt(countResult?.total || '0', 10);

  // Get paginated results
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const sql = `
    SELECT * FROM v_cars_with_amendments
    ${whereClause}
    ORDER BY
      amendment_conflict DESC,
      has_pending_amendment DESC,
      has_active_transition DESC,
      car_number
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  params.push(limit, offset);
  const cars = await query<RiderCar>(sql, params);

  return { cars, total };
}

// ============================================================================
// CAR SHOPPING VALIDATION
// ============================================================================

export async function validateCarForShopping(carNumber: string): Promise<{
  canShop: boolean;
  hasOutdatedTerms: boolean;
  amendment?: Amendment;
  comparison?: AmendmentComparison[];
  warnings: string[];
}> {
  const warnings: string[] = [];

  // Get car with amendment status
  const carSql = `
    SELECT
      v.*,
      la.id as amendment_id
    FROM v_cars_with_amendments v
    LEFT JOIN lease_amendments la ON la.rider_id = v.rider_id AND la.status = 'Pending' AND la.is_latest_version = TRUE
    WHERE v.car_number = $1
  `;
  const car = await queryOne<RiderCar & { amendment_id: string | null }>(carSql, [carNumber]);

  if (!car) {
    return { canShop: true, hasOutdatedTerms: false, warnings: ['Car not found in lease system'] };
  }

  if (car.has_active_transition) {
    warnings.push('Car is in transition between lessees');
  }

  if (car.amendment_conflict) {
    warnings.push(car.conflict_reason || 'Scheduling conflict with pending amendment');
  }

  if (car.has_pending_amendment && car.amendment_id) {
    const amendment = await getAmendment(car.amendment_id);
    const comparison = await getAmendmentComparison(car.amendment_id);

    return {
      canShop: true, // Can still shop, but needs confirmation
      hasOutdatedTerms: true,
      amendment: amendment || undefined,
      comparison,
      warnings,
    };
  }

  return {
    canShop: true,
    hasOutdatedTerms: false,
    warnings,
  };
}

// ============================================================================
// CUSTOMER CRUD
// ============================================================================

export async function createCustomer(data: {
  customer_code: string;
  customer_name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  billing_address?: string;
  notes?: string;
}): Promise<Customer> {
  const sql = `
    INSERT INTO customers (customer_code, customer_name, contact_name, contact_email, contact_phone, billing_address, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, customer_code, customer_name, is_active
  `;
  const row = await queryOne<Customer>(sql, [
    data.customer_code, data.customer_name, data.contact_name || null,
    data.contact_email || null, data.contact_phone || null,
    data.billing_address || null, data.notes || null,
  ]);
  if (!row) throw new Error('Failed to create customer');
  return row;
}

export async function updateCustomer(id: string, data: {
  customer_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  billing_address?: string;
  is_active?: boolean;
  notes?: string;
}): Promise<Customer> {
  const sets: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  let idx = 1;

  if (data.customer_name !== undefined) { sets.push(`customer_name = $${idx++}`); params.push(data.customer_name); }
  if (data.contact_name !== undefined) { sets.push(`contact_name = $${idx++}`); params.push(data.contact_name); }
  if (data.contact_email !== undefined) { sets.push(`contact_email = $${idx++}`); params.push(data.contact_email); }
  if (data.contact_phone !== undefined) { sets.push(`contact_phone = $${idx++}`); params.push(data.contact_phone); }
  if (data.billing_address !== undefined) { sets.push(`billing_address = $${idx++}`); params.push(data.billing_address); }
  if (data.is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(data.is_active); }
  if (data.notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(data.notes); }

  params.push(id);
  const sql = `UPDATE customers SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, customer_code, customer_name, is_active`;
  const row = await queryOne<Customer>(sql, params);
  if (!row) throw new Error('Customer not found');
  return row;
}

// ============================================================================
// MASTER LEASE CRUD
// ============================================================================

export async function createMasterLease(data: {
  lease_id: string;
  customer_id: string;
  lease_name?: string;
  start_date: string;
  end_date?: string;
  base_rate_per_car?: number;
  terms_summary?: string;
  payment_terms?: string;
  notes?: string;
}): Promise<MasterLease> {
  // Validate: customer must exist and be active
  const customer = await queryOne<{ id: string; is_active: boolean }>(
    'SELECT id, is_active FROM customers WHERE id = $1', [data.customer_id]
  );
  if (!customer) throw new Error('Customer not found');
  if (!customer.is_active) throw new Error('Cannot create lease for inactive customer');

  const sql = `
    INSERT INTO master_leases (lease_id, customer_id, lease_name, start_date, end_date, base_rate_per_car, terms_summary, payment_terms, notes, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active')
    RETURNING id, lease_id, customer_id, lease_name, start_date, end_date, status
  `;
  const row = await queryOne<MasterLease>(sql, [
    data.lease_id, data.customer_id, data.lease_name || null,
    data.start_date, data.end_date || null, data.base_rate_per_car || null,
    data.terms_summary || null, data.payment_terms || null, data.notes || null,
  ]);
  if (!row) throw new Error('Failed to create lease');
  return row;
}

export async function updateMasterLease(id: string, data: {
  lease_name?: string;
  start_date?: string;
  end_date?: string;
  base_rate_per_car?: number;
  terms_summary?: string;
  payment_terms?: string;
  status?: string;
  notes?: string;
}): Promise<MasterLease> {
  // Block edits on terminated leases
  const existing = await queryOne<{ status: string }>('SELECT status FROM master_leases WHERE id = $1', [id]);
  if (!existing) throw new Error('Lease not found');
  if (existing.status === 'Terminated') throw new Error('Cannot modify a terminated lease');

  const sets: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  let idx = 1;

  if (data.lease_name !== undefined) { sets.push(`lease_name = $${idx++}`); params.push(data.lease_name); }
  if (data.start_date !== undefined) { sets.push(`start_date = $${idx++}`); params.push(data.start_date); }
  if (data.end_date !== undefined) { sets.push(`end_date = $${idx++}`); params.push(data.end_date); }
  if (data.base_rate_per_car !== undefined) { sets.push(`base_rate_per_car = $${idx++}`); params.push(data.base_rate_per_car); }
  if (data.terms_summary !== undefined) { sets.push(`terms_summary = $${idx++}`); params.push(data.terms_summary); }
  if (data.payment_terms !== undefined) { sets.push(`payment_terms = $${idx++}`); params.push(data.payment_terms); }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); }
  if (data.notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(data.notes); }

  params.push(id);
  const sql = `
    UPDATE master_leases SET ${sets.join(', ')} WHERE id = $${idx}
    RETURNING id, lease_id, customer_id, lease_name, start_date, end_date, status
  `;
  const row = await queryOne<MasterLease>(sql, params);
  if (!row) throw new Error('Lease not found');
  return row;
}

export async function deactivateLease(id: string): Promise<{ riders_deactivated: number; cars_removed: number }> {
  return transaction(async (client) => {
    // Mark lease as Expired
    const lease = await client.query(
      `UPDATE master_leases SET status = 'Expired', updated_at = NOW() WHERE id = $1 AND status != 'Terminated' RETURNING id`,
      [id]
    );
    if (lease.rows.length === 0) throw new Error('Lease not found or already terminated');

    // Deactivate all riders on this lease
    const riders = await client.query(
      `UPDATE lease_riders SET status = 'Expired', updated_at = NOW() WHERE master_lease_id = $1 AND status = 'Active' RETURNING id`,
      [id]
    );
    const riderIds = riders.rows.map((r: any) => r.id);

    let carsRemoved = 0;
    if (riderIds.length > 0) {
      // Remove all active cars from those riders
      const cars = await client.query(
        `UPDATE rider_cars SET status = 'off_rent', off_rent_at = NOW(),
         removed_date = CURRENT_DATE
         WHERE rider_id = ANY($1) AND status NOT IN ('off_rent', 'cancelled') RETURNING car_number, rider_id`,
        [riderIds]
      );
      carsRemoved = cars.rows.length;

      // Log on-rent history for each removed car
      for (const car of cars.rows) {
        await client.query(
          `INSERT INTO on_rent_history (car_number, rider_id, is_on_rent, effective_date, change_reason)
           VALUES ($1, $2, FALSE, CURRENT_DATE, 'Lease deactivated')`,
          [car.car_number, car.rider_id]
        );
      }
    }

    return { riders_deactivated: riderIds.length, cars_removed: carsRemoved };
  });
}

// ============================================================================
// LEASE RIDER CRUD
// ============================================================================

export async function createLeaseRider(data: {
  rider_id: string;
  master_lease_id: string;
  rider_name?: string;
  effective_date: string;
  expiration_date?: string;
  rate_per_car?: number;
  specific_terms?: string;
  notes?: string;
}, createdBy?: string): Promise<LeaseRider> {
  // Validate: lease must exist and be active
  const lease = await queryOne<{ id: string; status: string; start_date: string; end_date: string | null }>(
    'SELECT id, status, start_date, end_date FROM master_leases WHERE id = $1', [data.master_lease_id]
  );
  if (!lease) throw new Error('Master lease not found');
  if (lease.status !== 'Active') throw new Error('Cannot add rider to non-active lease');

  // Validate: effective_date within parent lease date range
  if (data.effective_date < lease.start_date) {
    throw new Error('Rider effective date cannot be before lease start date');
  }
  if (lease.end_date && data.expiration_date && data.expiration_date > lease.end_date) {
    throw new Error('Rider expiration date cannot be after lease end date');
  }

  return transaction(async (client) => {
    const sql = `
      INSERT INTO lease_riders (rider_id, master_lease_id, rider_name, effective_date, expiration_date, rate_per_car, specific_terms, notes, car_count, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'Active')
      RETURNING id, rider_id, master_lease_id, rider_name, effective_date, expiration_date, status
    `;
    const result = await client.query(sql, [
      data.rider_id, data.master_lease_id, data.rider_name || null,
      data.effective_date, data.expiration_date || null,
      data.rate_per_car || null, data.specific_terms || null, data.notes || null,
    ]);
    const rider = result.rows[0];

    // Create initial rate_history record if rate provided
    if (data.rate_per_car) {
      await client.query(
        `INSERT INTO rate_history (rider_id, previous_rate, new_rate, effective_date, change_type, change_reason, changed_by)
         VALUES ($1, NULL, $2, $3, 'initial', 'Rider created', $4)`,
        [rider.id, data.rate_per_car, data.effective_date, createdBy || null]
      );
    }

    return rider;
  });
}

export async function updateLeaseRider(id: string, data: {
  rider_name?: string;
  effective_date?: string;
  expiration_date?: string;
  rate_per_car?: number;
  specific_terms?: string;
  notes?: string;
}, changedBy?: string): Promise<LeaseRider> {
  const existing = await queryOne<{ id: string; status: string; rate_per_car: number }>(
    'SELECT id, status, rate_per_car FROM lease_riders WHERE id = $1', [id]
  );
  if (!existing) throw new Error('Rider not found');
  if (existing.status === 'Expired') throw new Error('Cannot modify an expired rider');

  return transaction(async (client) => {
    const sets: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (data.rider_name !== undefined) { sets.push(`rider_name = $${idx++}`); params.push(data.rider_name); }
    if (data.effective_date !== undefined) { sets.push(`effective_date = $${idx++}`); params.push(data.effective_date); }
    if (data.expiration_date !== undefined) { sets.push(`expiration_date = $${idx++}`); params.push(data.expiration_date); }
    if (data.rate_per_car !== undefined) { sets.push(`rate_per_car = $${idx++}`); params.push(data.rate_per_car); }
    if (data.specific_terms !== undefined) { sets.push(`specific_terms = $${idx++}`); params.push(data.specific_terms); }
    if (data.notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(data.notes); }

    params.push(id);
    const sql = `UPDATE lease_riders SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, rider_id, master_lease_id, rider_name, effective_date, expiration_date, status`;
    const result = await client.query(sql, params);
    const rider = result.rows[0];

    // If rate changed, create rate_history record
    if (data.rate_per_car !== undefined && data.rate_per_car !== existing.rate_per_car) {
      await client.query(
        `INSERT INTO rate_history (rider_id, previous_rate, new_rate, effective_date, change_type, change_reason, changed_by)
         VALUES ($1, $2, $3, CURRENT_DATE, 'correction', 'Manual rate update', $4)`,
        [id, existing.rate_per_car, data.rate_per_car, changedBy || null]
      );
    }

    return rider;
  });
}

export async function deactivateRider(id: string): Promise<{ cars_removed: number }> {
  return transaction(async (client) => {
    const rider = await client.query(
      `UPDATE lease_riders SET status = 'Expired', updated_at = NOW() WHERE id = $1 AND status = 'Active' RETURNING id`,
      [id]
    );
    if (rider.rows.length === 0) throw new Error('Rider not found or not active');

    // Deactivate all active cars on this rider
    const cars = await client.query(
      `UPDATE rider_cars SET status = 'off_rent', off_rent_at = NOW(),
       removed_date = CURRENT_DATE
       WHERE rider_id = $1 AND status NOT IN ('off_rent', 'cancelled') RETURNING car_number`,
      [id]
    );

    // Log on-rent history for each removed car
    for (const car of cars.rows) {
      await client.query(
        `INSERT INTO on_rent_history (car_number, rider_id, is_on_rent, effective_date, change_reason)
         VALUES ($1, $2, FALSE, CURRENT_DATE, 'Rider deactivated')`,
        [car.car_number, id]
      );
    }

    // Update rider car count
    await client.query(
      `UPDATE lease_riders SET car_count = 0 WHERE id = $1`, [id]
    );

    return { cars_removed: cars.rows.length };
  });
}

// ============================================================================
// CAR ↔ RIDER OPERATIONS
// ============================================================================

export async function addCarToRider(riderId: string, carNumber: string, addedDate?: string): Promise<{ id: string }> {
  return transaction(async (client) => {
    // Validate rider exists and is active
    const rider = await client.query(
      'SELECT id, status FROM lease_riders WHERE id = $1', [riderId]
    );
    if (rider.rows.length === 0) throw new Error('Rider not found');
    if (rider.rows[0].status !== 'Active') throw new Error('Cannot add car to non-active rider');

    // Validate car exists
    const car = await client.query(
      'SELECT car_number FROM cars WHERE car_number = $1', [carNumber]
    );
    if (car.rows.length === 0) throw new Error('Car not found');

    // Validate car not active on another rider (non-terminal status)
    const existing = await client.query(
      `SELECT rider_id FROM rider_cars WHERE car_number = $1 AND status NOT IN ('off_rent', 'cancelled')`, [carNumber]
    );
    if (existing.rows.length > 0) {
      throw new Error(`Car ${carNumber} is already active on another rider`);
    }

    const effectiveDate = addedDate || new Date().toISOString().split('T')[0];

    // Insert rider_cars record with status = 'decided' (not on_rent — R23)
    // Car is committed but NOT yet billing-eligible. Must transition to on_rent explicitly.
    const result = await client.query(
      `INSERT INTO rider_cars (rider_id, car_number, added_date, status, decided_at)
       VALUES ($1, $2, $3, 'decided', NOW())
       RETURNING id`,
      [riderId, carNumber, effectiveDate]
    );

    // Update rider car_count
    await client.query(
      `UPDATE lease_riders SET car_count = (
        SELECT COUNT(*) FROM rider_cars WHERE rider_id = $1 AND status NOT IN ('off_rent', 'cancelled')
      ) WHERE id = $1`,
      [riderId]
    );

    return { id: result.rows[0].id };
  });
}

export async function removeCarFromRider(riderId: string, carNumber: string): Promise<void> {
  return transaction(async (client) => {
    // Find the active rider_car
    const rc = await client.query(
      `SELECT id, status FROM rider_cars
       WHERE rider_id = $1 AND car_number = $2 AND status NOT IN ('off_rent', 'cancelled')`,
      [riderId, carNumber]
    );
    if (rc.rows.length === 0) throw new Error('Active car-rider assignment not found');

    const currentStatus = rc.rows[0].status;

    // Transition to off_rent (or cancelled if never went on_rent)
    const targetStatus = (currentStatus === 'decided' || currentStatus === 'prep_required')
      ? 'cancelled'
      : 'off_rent';

    await client.query(
      `UPDATE rider_cars SET
        status = $1,
        off_rent_at = NOW(),
        removed_date = CURRENT_DATE
       WHERE id = $2`,
      [targetStatus, rc.rows[0].id]
    );

    // Log on-rent history if was on_rent
    if (currentStatus === 'on_rent' || currentStatus === 'releasing') {
      await client.query(
        `INSERT INTO on_rent_history (car_number, rider_id, is_on_rent, effective_date, change_reason)
         VALUES ($1, $2, FALSE, CURRENT_DATE, 'Removed from rider')`,
        [carNumber, riderId]
      );
    }

    // Update rider car_count
    await client.query(
      `UPDATE lease_riders SET car_count = (
        SELECT COUNT(*) FROM rider_cars WHERE rider_id = $1 AND status NOT IN ('off_rent', 'cancelled')
      ) WHERE id = $1`,
      [riderId]
    );
  });
}

// ============================================================================
// RIDER CAR LIFECYCLE TRANSITIONS
// ============================================================================

export type RiderCarStatus = 'decided' | 'prep_required' | 'on_rent' | 'releasing' | 'off_rent' | 'cancelled';

/**
 * Transition a rider_car through its 6-state lifecycle:
 *   decided → prep_required → on_rent → releasing → off_rent
 *   (+ cancelled from decided/prep_required, releasing → on_rent for cancel-release)
 *
 * DB trigger `enforce_rider_car_transition` validates allowed transitions.
 * DB trigger `guard_rider_car_parent` prevents on_rent unless rider+lease are Active (R17).
 *
 * Side effects by target status:
 *   on_rent:    Set on_rent_at, log on_rent_history, close idle period
 *   releasing:  Set releasing_at (billing stop per R23)
 *   off_rent:   Set off_rent_at, removed_date, open idle period, create triage entry (S8)
 *   cancelled:  Set off_rent_at, no side effects needed
 */
export async function transitionRiderCar(
  riderCarId: string,
  targetStatus: RiderCarStatus,
  userId: string,
  metadata?: { shopping_event_id?: string; notes?: string }
): Promise<{ id: string; status: RiderCarStatus; car_number: string; rider_id: string }> {
  // Read current state
  const current = await queryOne<{
    id: string; status: string; car_number: string; rider_id: string; car_id: string;
  }>(
    `SELECT rc.id, rc.status, rc.car_number, rc.rider_id,
            (SELECT c.id FROM cars c WHERE c.car_number = rc.car_number) AS car_id
     FROM rider_cars rc WHERE rc.id = $1`,
    [riderCarId]
  );
  if (!current) throw new Error(`Rider car ${riderCarId} not found`);
  if (current.status === targetStatus) return { id: current.id, status: targetStatus, car_number: current.car_number, rider_id: current.rider_id };

  // Build update SET clause based on target status
  let extraSets = '';
  const params: unknown[] = [targetStatus, userId, riderCarId];
  let paramIdx = 4;

  switch (targetStatus) {
    case 'on_rent':
      extraSets = `, on_rent_at = NOW()`;
      if (metadata?.shopping_event_id) {
        extraSets += `, shopping_event_id = $${paramIdx++}`;
        params.push(metadata.shopping_event_id);
      }
      break;
    case 'prep_required':
      if (metadata?.shopping_event_id) {
        extraSets = `, shopping_event_id = $${paramIdx++}`;
        params.push(metadata.shopping_event_id);
      }
      break;
    case 'releasing':
      extraSets = `, releasing_at = NOW()`;
      break;
    case 'off_rent':
      extraSets = `, off_rent_at = NOW(), removed_date = CURRENT_DATE`;
      break;
    case 'cancelled':
      extraSets = `, off_rent_at = NOW(), removed_date = CURRENT_DATE`;
      break;
  }

  // Execute update — DB trigger validates the transition
  const result = await queryOne<{ id: string; status: string; car_number: string; rider_id: string }>(
    `UPDATE rider_cars SET status = $1, updated_by = $2 ${extraSets}
     WHERE id = $3 RETURNING id, status, car_number, rider_id`,
    params
  );
  if (!result) throw new Error(`Failed to transition rider car to ${targetStatus}`);

  // --- Side effects ---

  // on_rent: log on_rent_history, close idle period
  if (targetStatus === 'on_rent') {
    await query(
      `INSERT INTO on_rent_history (car_number, rider_id, is_on_rent, effective_date, change_reason)
       VALUES ($1, $2, TRUE, CURRENT_DATE, $3)`,
      [current.car_number, current.rider_id, metadata?.notes || 'Transitioned to on_rent']
    );
    if (current.car_id) {
      idlePeriodService.closeIdlePeriod(current.car_id)
        .catch(err => logger.error({ err }, `[RiderCar] Failed to close idle period for ${current.car_number}`));
    }
  }

  // off_rent: log on_rent_history, open idle period, create triage entry (S8)
  if (targetStatus === 'off_rent') {
    await query(
      `INSERT INTO on_rent_history (car_number, rider_id, is_on_rent, effective_date, change_reason)
       VALUES ($1, $2, FALSE, CURRENT_DATE, $3)`,
      [current.car_number, current.rider_id, metadata?.notes || 'Transitioned to off_rent']
    );

    // Update rider car_count
    await query(
      `UPDATE lease_riders SET car_count = (
        SELECT COUNT(*) FROM rider_cars WHERE rider_id = $1 AND status NOT IN ('off_rent', 'cancelled')
      ) WHERE id = $1`,
      [current.rider_id]
    );

    if (current.car_id) {
      idlePeriodService.openIdlePeriod(current.car_id, current.car_number, 'between_leases')
        .catch(err => logger.error({ err }, `[RiderCar] Failed to open idle period for ${current.car_number}`));

      triageQueueService.createTriageEntry(
        current.car_id, current.car_number, 'customer_return', 2,
        metadata?.notes || `Car removed from rider ${current.rider_id}`, userId
      ).catch(err => logger.error({ err }, `[RiderCar] Failed to create triage entry for ${current.car_number}`));
    }
  }

  // Audit
  logTransition({
    processType: 'rider_car',
    entityId: riderCarId,
    entityNumber: current.car_number,
    fromState: current.status,
    toState: targetStatus,
    isReversible: targetStatus === 'releasing', // only releasing→on_rent is reversible
    actorId: userId,
    notes: metadata?.notes,
  }).catch(err => logger.error({ err }, '[TransitionLog] Failed to log rider car transition'));

  if (current.car_id) {
    assetEventService.recordEvent(current.car_id, `car.rider_car_${targetStatus}`, {
      rider_car_id: riderCarId,
      rider_id: current.rider_id,
      from_status: current.status,
      to_status: targetStatus,
    }, {
      sourceTable: 'rider_cars',
      sourceId: riderCarId,
      performedBy: userId,
    }).catch(() => {});
  }

  return { id: result.id, status: targetStatus, car_number: result.car_number, rider_id: result.rider_id };
}

// ============================================================================
// ON-RENT OPERATIONS
// ============================================================================

export async function getOnRentHistory(
  carNumber: string,
  periodStart?: string,
  periodEnd?: string
): Promise<{
  id: string;
  car_number: string;
  rider_id: string;
  is_on_rent: boolean;
  effective_date: string;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
}[]> {
  const conditions = ['car_number = $1'];
  const params: any[] = [carNumber];
  let idx = 2;

  if (periodStart) {
    conditions.push(`effective_date >= $${idx++}`);
    params.push(periodStart);
  }
  if (periodEnd) {
    conditions.push(`effective_date <= $${idx++}`);
    params.push(periodEnd);
  }

  const sql = `
    SELECT orh.*, u.full_name as changed_by_name
    FROM on_rent_history orh
    LEFT JOIN users u ON u.id = orh.changed_by
    WHERE ${conditions.join(' AND ')}
    ORDER BY effective_date DESC, created_at DESC
  `;
  return query(sql, params);
}

export async function getOnRentDays(
  carNumber: string,
  riderId: string,
  periodStart: string,
  periodEnd: string
): Promise<number> {
  // Get all on-rent status changes for this car+rider within or before the period
  const history = await query<{ is_on_rent: boolean; effective_date: string }>(
    `SELECT is_on_rent, effective_date FROM on_rent_history
     WHERE car_number = $1 AND rider_id = $2 AND effective_date <= $3
     ORDER BY effective_date ASC, created_at ASC`,
    [carNumber, riderId, periodEnd]
  );

  if (history.length === 0) {
    // No history: check current rider_cars status
    const rc = await queryOne<{ status: string; added_date: string }>(
      'SELECT status, added_date FROM rider_cars WHERE car_number = $1 AND rider_id = $2',
      [carNumber, riderId]
    );
    if (!rc) return 0;
    if (rc.status !== 'on_rent') return 0;

    // Car was on-rent for the entire overlap between added_date and the period
    const start = new Date(Math.max(new Date(periodStart).getTime(), new Date(rc.added_date).getTime()));
    const end = new Date(periodEnd);
    return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }

  // Walk through history day by day
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);
  let onRentDays = 0;

  // Determine initial state at period start (last status change before or on period start)
  let currentStatus = false;
  for (const h of history) {
    if (new Date(h.effective_date) <= pStart) {
      currentStatus = h.is_on_rent;
    }
  }

  // Build day-by-day map of status changes within the period
  const statusChanges = new Map<string, boolean>();
  for (const h of history) {
    const d = new Date(h.effective_date);
    if (d >= pStart && d <= pEnd) {
      statusChanges.set(h.effective_date, h.is_on_rent);
    }
  }

  // Count on-rent days
  const cursor = new Date(pStart);
  while (cursor <= pEnd) {
    const dateStr = cursor.toISOString().split('T')[0];
    if (statusChanges.has(dateStr)) {
      currentStatus = statusChanges.get(dateStr)!;
    }
    if (currentStatus) onRentDays++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return onRentDays;
}

// ============================================================================
// AMENDMENT LIFECYCLE
// ============================================================================

export interface AmendmentCreateData {
  amendment_id: string;
  rider_id: string;
  amendment_type: string; // 'Add Cars', 'Remove Cars', 'Rate Change', 'Extension', 'Terms Change'
  effective_date: string;
  change_summary: string;
  new_rate?: number;
  required_shop_date?: string;
  service_interval_days?: number;
  cars_added?: number;
  cars_removed?: number;
  notes?: string;
}

export async function createAmendment(data: AmendmentCreateData, createdBy?: string): Promise<Amendment> {
  return transaction(async (client) => {
    // Validate rider exists
    const rider = await client.query(
      'SELECT id, master_lease_id, rate_per_car FROM lease_riders WHERE id = $1', [data.rider_id]
    );
    if (rider.rows.length === 0) throw new Error('Rider not found');

    const masterLeaseId = rider.rows[0].master_lease_id;
    const previousRate = rider.rows[0].rate_per_car;

    const sql = `
      INSERT INTO lease_amendments (
        amendment_id, master_lease_id, rider_id, amendment_type, effective_date,
        change_summary, new_rate, required_shop_date, service_interval_days,
        cars_added, cars_removed, notes,
        status, version, is_latest_version,
        previous_shop_date, previous_service_interval
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        'Draft', 1, TRUE,
        NULL, NULL
      )
      RETURNING id, amendment_id, status, version, created_at
    `;
    const result = await client.query(sql, [
      data.amendment_id, masterLeaseId, data.rider_id, data.amendment_type, data.effective_date,
      data.change_summary, data.new_rate || null, data.required_shop_date || null, data.service_interval_days || null,
      data.cars_added || 0, data.cars_removed || 0, data.notes || null,
    ]);
    const amendment = result.rows[0];

    // Log state history
    await client.query(
      `INSERT INTO amendment_state_history (amendment_id, from_state, to_state, changed_by_id, notes)
       VALUES ($1, NULL, 'Draft', $2, 'Amendment created')`,
      [amendment.id, createdBy || null]
    );

    return amendment;
  });
}

export async function updateAmendment(id: string, data: {
  amendment_type?: string;
  effective_date?: string;
  change_summary?: string;
  new_rate?: number;
  required_shop_date?: string;
  service_interval_days?: number;
  cars_added?: number;
  cars_removed?: number;
  notes?: string;
}): Promise<Amendment> {
  // Only Draft amendments can be edited
  const existing = await queryOne<{ status: string }>('SELECT status FROM lease_amendments WHERE id = $1', [id]);
  if (!existing) throw new Error('Amendment not found');
  if (existing.status !== 'Draft') throw new Error('Only Draft amendments can be edited');

  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.amendment_type !== undefined) { sets.push(`amendment_type = $${idx++}`); params.push(data.amendment_type); }
  if (data.effective_date !== undefined) { sets.push(`effective_date = $${idx++}`); params.push(data.effective_date); }
  if (data.change_summary !== undefined) { sets.push(`change_summary = $${idx++}`); params.push(data.change_summary); }
  if (data.new_rate !== undefined) { sets.push(`new_rate = $${idx++}`); params.push(data.new_rate); }
  if (data.required_shop_date !== undefined) { sets.push(`required_shop_date = $${idx++}`); params.push(data.required_shop_date); }
  if (data.service_interval_days !== undefined) { sets.push(`service_interval_days = $${idx++}`); params.push(data.service_interval_days); }
  if (data.cars_added !== undefined) { sets.push(`cars_added = $${idx++}`); params.push(data.cars_added); }
  if (data.cars_removed !== undefined) { sets.push(`cars_removed = $${idx++}`); params.push(data.cars_removed); }
  if (data.notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(data.notes); }

  if (sets.length === 0) throw new Error('No fields to update');

  params.push(id);
  const sql = `UPDATE lease_amendments SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`;
  const row = await queryOne<Amendment>(sql, params);
  if (!row) throw new Error('Amendment not found');
  return row;
}

export async function submitAmendment(id: string, submittedBy: string): Promise<Amendment> {
  return transaction(async (client) => {
    // Draft → Pending
    const result = await client.query(
      `UPDATE lease_amendments
       SET status = 'Pending', submitted_by = $2, submitted_at = NOW()
       WHERE id = $1 AND status = 'Draft'
       RETURNING *`,
      [id, submittedBy]
    );
    if (result.rows.length === 0) throw new Error('Amendment not found or not in Draft status');

    // Mark affected rider_cars as having pending amendment
    const amendment = result.rows[0];
    await client.query(
      `UPDATE rider_cars SET has_pending_amendment = TRUE
       WHERE rider_id = $1 AND status NOT IN ('off_rent', 'cancelled')`,
      [amendment.rider_id]
    );

    // Log state history
    await client.query(
      `INSERT INTO amendment_state_history (amendment_id, from_state, to_state, changed_by_id, notes)
       VALUES ($1, 'Draft', 'Pending', $2, 'Submitted for review')`,
      [id, submittedBy]
    );

    return amendment;
  });
}

export async function approveAmendment(id: string, approvedBy: string): Promise<Amendment> {
  return transaction(async (client) => {
    // Pending → Approved
    const result = await client.query(
      `UPDATE lease_amendments
       SET status = 'Approved', approved_by_id = $2, approved_by = (SELECT full_name FROM users WHERE id = $2), approved_at = NOW()
       WHERE id = $1 AND status = 'Pending'
       RETURNING *`,
      [id, approvedBy]
    );
    if (result.rows.length === 0) throw new Error('Amendment not found or not in Pending status');

    // Log state history
    await client.query(
      `INSERT INTO amendment_state_history (amendment_id, from_state, to_state, changed_by_id, notes)
       VALUES ($1, 'Pending', 'Approved', $2, 'Approved')`,
      [id, approvedBy]
    );

    return result.rows[0];
  });
}

export async function rejectAmendment(id: string, rejectedBy: string, reason: string): Promise<Amendment> {
  if (!reason) throw new Error('Rejection reason is required');

  return transaction(async (client) => {
    // Pending → Draft (send back)
    const result = await client.query(
      `UPDATE lease_amendments
       SET status = 'Draft', rejection_reason = $3
       WHERE id = $1 AND status IN ('Pending', 'Approved')
       RETURNING *`,
      [id, rejectedBy, reason]
    );
    if (result.rows.length === 0) throw new Error('Amendment not found or not in Pending/Approved status');

    const amendment = result.rows[0];

    // Clear pending amendment flags on rider_cars
    await client.query(
      `UPDATE rider_cars SET has_pending_amendment = FALSE
       WHERE rider_id = $1 AND status NOT IN ('off_rent', 'cancelled')
       AND NOT EXISTS (
         SELECT 1 FROM lease_amendments la
         WHERE la.rider_id = $1 AND la.status = 'Pending' AND la.id != $2
       )`,
      [amendment.rider_id, id]
    );

    // Log state history
    await client.query(
      `INSERT INTO amendment_state_history (amendment_id, from_state, to_state, changed_by_id, notes)
       VALUES ($1, 'Pending', 'Draft', $2, $3)`,
      [id, rejectedBy, `Rejected: ${reason}`]
    );

    return amendment;
  });
}

export async function activateAmendment(id: string, activatedBy: string): Promise<Amendment> {
  return transaction(async (client) => {
    // Approved → Active
    const result = await client.query(
      `UPDATE lease_amendments
       SET status = 'Active'
       WHERE id = $1 AND status = 'Approved'
       RETURNING *`,
      [id, activatedBy]
    );
    if (result.rows.length === 0) throw new Error('Amendment not found or not in Approved status');

    const amendment = result.rows[0];

    // Supersede any previously Active amendment on this rider
    await client.query(
      `UPDATE lease_amendments
       SET status = 'Superseded'
       WHERE rider_id = $1 AND status = 'Active' AND id != $2`,
      [amendment.rider_id, id]
    );

    // Log supersede history for any superseded amendments
    await client.query(
      `INSERT INTO amendment_state_history (amendment_id, from_state, to_state, changed_by_id, notes)
       SELECT id, 'Active', 'Superseded', $3, 'Superseded by ' || $4
       FROM lease_amendments
       WHERE rider_id = $1 AND status = 'Superseded' AND id != $2`,
      [amendment.rider_id, id, activatedBy, amendment.amendment_id]
    );

    // Rate cascade: if amendment has new_rate, update rider and create rate_history
    if (amendment.new_rate) {
      const rider = await client.query(
        'SELECT rate_per_car FROM lease_riders WHERE id = $1', [amendment.rider_id]
      );
      const previousRate = rider.rows[0]?.rate_per_car;

      await client.query(
        'UPDATE lease_riders SET rate_per_car = $1, updated_at = NOW() WHERE id = $2',
        [amendment.new_rate, amendment.rider_id]
      );

      await client.query(
        `INSERT INTO rate_history (rider_id, previous_rate, new_rate, effective_date, change_type, change_reason, changed_by)
         VALUES ($1, $2, $3, $4, 'amendment', $5, $6)`,
        [amendment.rider_id, previousRate, amendment.new_rate, amendment.effective_date,
         `Amendment ${amendment.amendment_id}: ${amendment.change_summary}`, activatedBy]
      );
    }

    // Clear pending amendment flags
    await client.query(
      `UPDATE rider_cars SET has_pending_amendment = FALSE, amendment_conflict = FALSE, conflict_reason = NULL
       WHERE rider_id = $1 AND status NOT IN ('off_rent', 'cancelled')`,
      [amendment.rider_id]
    );

    // Log activation state history
    await client.query(
      `INSERT INTO amendment_state_history (amendment_id, from_state, to_state, changed_by_id, notes)
       VALUES ($1, 'Approved', 'Active', $2, 'Activated — rate cascade applied')`,
      [id, activatedBy]
    );

    return amendment;
  });
}

export async function getAmendmentStateHistory(amendmentId: string): Promise<{
  id: string;
  from_state: string | null;
  to_state: string;
  changed_by_name: string | null;
  notes: string | null;
  created_at: string;
}[]> {
  return query(
    `SELECT ash.id, ash.from_state, ash.to_state, u.full_name as changed_by_name, ash.notes, ash.created_at
     FROM amendment_state_history ash
     LEFT JOIN users u ON u.id = ash.changed_by_id
     WHERE ash.amendment_id = $1
     ORDER BY ash.created_at ASC`,
    [amendmentId]
  );
}

export default {
  listCustomers,
  getCustomer,
  getCustomerLeases,
  getLease,
  getLeaseRiders,
  getRider,
  getRiderCars,
  getRiderAmendments,
  getAmendment,
  getAmendmentComparison,
  detectConflicts,
  resyncSchedules,
  getCarsWithAmendments,
  validateCarForShopping,
  // CRUD
  createCustomer,
  updateCustomer,
  createMasterLease,
  updateMasterLease,
  deactivateLease,
  createLeaseRider,
  updateLeaseRider,
  deactivateRider,
  addCarToRider,
  removeCarFromRider,
  // On-rent
  getOnRentHistory,
  getOnRentDays,
  // Amendment lifecycle
  createAmendment,
  updateAmendment,
  submitAmendment,
  approveAmendment,
  rejectAmendment,
  activateAmendment,
  getAmendmentStateHistory,
};
