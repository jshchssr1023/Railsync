/**
 * Fleet Service - Lease Hierarchy and Amendment Management
 *
 * Handles Customer → Lease → Rider → Cars navigation and amendment tracking
 */

import { query, queryOne } from '../config/database';

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
    LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.is_active = TRUE
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
    LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.is_active = TRUE
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
      COALESCE(SUM(lr.rate_per_car * lr.car_count), 0) AS monthly_revenue
    FROM master_leases ml
    JOIN customers c ON c.id = ml.customer_id
    LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.is_active = TRUE
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
      COALESCE(SUM(lr.rate_per_car * lr.car_count), 0) AS monthly_revenue
    FROM master_leases ml
    JOIN customers c ON c.id = ml.customer_id
    LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.is_active = TRUE
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
        WHERE rc2.rider_id = lr.id AND rc2.amendment_conflict = TRUE AND rc2.is_active = TRUE
      ), 0)::INTEGER AS cars_with_conflicts
    FROM lease_riders lr
    JOIN master_leases ml ON ml.id = lr.master_lease_id
    JOIN customers c ON c.id = ml.customer_id
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.is_active = TRUE
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
        WHERE rc2.rider_id = lr.id AND rc2.amendment_conflict = TRUE AND rc2.is_active = TRUE
      ), 0)::INTEGER AS cars_with_conflicts
    FROM lease_riders lr
    JOIN master_leases ml ON ml.id = lr.master_lease_id
    JOIN customers c ON c.id = ml.customer_id
    LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.is_active = TRUE
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
        SELECT COUNT(*) FROM car_assignments ca
        WHERE ca.car_number = c.car_number
        AND ca.status NOT IN ('Complete', 'Cancelled')
      ), 0)::INTEGER AS active_assignments
    FROM rider_cars rc
    JOIN cars c ON c.car_number = rc.car_number
    JOIN lease_riders lr ON lr.id = rc.rider_id
    WHERE rc.rider_id = $1 AND rc.is_active = TRUE
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
// FLEET OVERVIEW WITH AMENDMENTS
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
};
