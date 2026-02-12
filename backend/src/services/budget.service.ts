import { query, queryOne } from '../config/database';
import {
  RunningRepairsBudget,
  ServiceEventBudget,
  EventType,
} from '../types';

// ============================================================================
// ACTIVE LEASED CAR COUNT (source of truth for budget)
// ============================================================================

/**
 * Count distinct cars actively on lease by joining the lease hierarchy:
 * rider_cars (active status) → lease_riders (Active) → master_leases (Active)
 */
export async function getActiveLeasedCarCount(): Promise<number> {
  const sql = `
    SELECT COUNT(DISTINCT rc.car_number)::int AS count
    FROM rider_cars rc
    JOIN lease_riders lr ON lr.id = rc.rider_id
    JOIN master_leases ml ON ml.id = lr.lease_id
    WHERE rc.status NOT IN ('off_rent', 'cancelled')
      AND lr.status = 'Active'
      AND ml.status = 'Active'
  `;
  const result = await queryOne<{ count: number }>(sql);
  return result?.count ?? 0;
}

/**
 * Get historical service event counts and avg costs grouped by event type
 * for the trailing 12 months. Maps shopping_type_code → budget EventType.
 */
export async function getHistoricalServiceEventStats(): Promise<
  Array<{ event_type: string; event_count: number; avg_cost: number }>
> {
  const sql = `
    SELECT
      CASE
        WHEN se.event_type = 'Qualification' OR se.shopping_type_code ILIKE '%QUAL%' THEN 'Qualification'
        WHEN se.event_type = 'Assignment' OR se.shopping_type_code ILIKE '%ASSIGN%' THEN 'Assignment'
        WHEN se.event_type = 'Return' OR se.shopping_type_code ILIKE '%RETURN%' OR se.shopping_type_code ILIKE '%RELEASE%' THEN 'Return'
        ELSE COALESCE(se.event_type, 'Other')
      END AS event_type,
      COUNT(*)::int AS event_count,
      COALESCE(AVG(
        CASE WHEN a.actual_cost IS NOT NULL THEN a.actual_cost::numeric ELSE a.estimated_cost::numeric END
      ), 0)::numeric AS avg_cost
    FROM shopping_events se
    LEFT JOIN allocations a ON a.car_mark_number = se.car_number
      AND a.target_month = TO_CHAR(se.created_at, 'YYYY-MM')
    WHERE se.created_at >= NOW() - INTERVAL '12 months'
    GROUP BY
      CASE
        WHEN se.event_type = 'Qualification' OR se.shopping_type_code ILIKE '%QUAL%' THEN 'Qualification'
        WHEN se.event_type = 'Assignment' OR se.shopping_type_code ILIKE '%ASSIGN%' THEN 'Assignment'
        WHEN se.event_type = 'Return' OR se.shopping_type_code ILIKE '%RETURN%' OR se.shopping_type_code ILIKE '%RELEASE%' THEN 'Return'
        ELSE COALESCE(se.event_type, 'Other')
      END
    ORDER BY event_count DESC
  `;
  const rows = await query<{ event_type: string; event_count: number; avg_cost: string }>(sql);
  return rows.map(r => ({
    event_type: r.event_type,
    event_count: Number(r.event_count),
    avg_cost: parseFloat(String(r.avg_cost)) || 0,
  }));
}

// ============================================================================
// RUNNING REPAIRS BUDGET
// ============================================================================

/**
 * Get running repairs budget for a fiscal year
 */
export async function getRunningRepairsBudget(
  fiscalYear: number
): Promise<RunningRepairsBudget[]> {
  const sql = `
    SELECT
      id,
      fiscal_year,
      month,
      cars_on_lease,
      allocation_per_car,
      monthly_budget,
      actual_spend,
      actual_car_count,
      COALESCE(remaining_budget, monthly_budget - actual_spend) as remaining_budget,
      notes,
      created_by,
      created_at,
      updated_at
    FROM running_repairs_budget
    WHERE fiscal_year = $1
    ORDER BY month
  `;

  const rows = await query<RunningRepairsBudget>(sql, [fiscalYear]);

  // Convert string numeric fields to numbers (PostgreSQL returns DECIMAL as strings)
  return rows.map(row => ({
    ...row,
    cars_on_lease: Number(row.cars_on_lease) || 0,
    allocation_per_car: Number(row.allocation_per_car) || 0,
    monthly_budget: Number(row.monthly_budget) || 0,
    actual_spend: Number(row.actual_spend) || 0,
    actual_car_count: Number(row.actual_car_count) || 0,
    remaining_budget: Number(row.remaining_budget) || 0,
  }));
}

/**
 * Update running repairs budget for a month
 */
export async function updateRunningRepairsBudget(
  fiscalYear: number,
  month: string,
  data: {
    allocation_per_car?: number;
    actual_spend?: number;
    actual_car_count?: number;
    notes?: string;
  },
  userId?: string
): Promise<RunningRepairsBudget> {
  // Derive cars_on_lease from lease hierarchy (not user-editable)
  const carsOnLease = await getActiveLeasedCarCount();

  // If only actual_spend is being updated, preserve existing allocation
  // by fetching current row first
  let allocationPerCar = data.allocation_per_car;
  if (allocationPerCar === undefined) {
    const existing = await queryOne<RunningRepairsBudget>(
      'SELECT allocation_per_car FROM running_repairs_budget WHERE fiscal_year = $1 AND month = $2',
      [fiscalYear, month]
    );
    allocationPerCar = existing ? Number(existing.allocation_per_car) : 0;
  }

  const monthlyBudget = carsOnLease * (allocationPerCar || 0);
  const actualSpend = data.actual_spend || 0;
  const remainingBudget = monthlyBudget - actualSpend;

  const sql = `
    INSERT INTO running_repairs_budget (
      fiscal_year, month, cars_on_lease, allocation_per_car,
      monthly_budget, actual_spend, actual_car_count, remaining_budget,
      notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (fiscal_year, month) DO UPDATE SET
      cars_on_lease = $3,
      allocation_per_car = COALESCE($4, running_repairs_budget.allocation_per_car),
      monthly_budget = $5,
      actual_spend = COALESCE($6, running_repairs_budget.actual_spend),
      actual_car_count = COALESCE($7, running_repairs_budget.actual_car_count),
      remaining_budget = $8,
      notes = COALESCE($9, running_repairs_budget.notes),
      updated_at = NOW()
    RETURNING *
  `;

  const rows = await query<RunningRepairsBudget>(sql, [
    fiscalYear,
    month,
    carsOnLease,
    allocationPerCar,
    monthlyBudget,
    data.actual_spend,
    data.actual_car_count,
    remainingBudget,
    data.notes,
    userId,
  ]);

  return rows[0];
}

/**
 * Auto-calculate running repairs budget from active car count
 */
export async function calculateRunningRepairsBudget(
  fiscalYear: number,
  allocationPerCar: number = 150,
  userId?: string
): Promise<RunningRepairsBudget[]> {
  // cars_on_lease is now auto-derived inside updateRunningRepairsBudget
  const results: RunningRepairsBudget[] = [];

  // Generate 12 months of budget
  for (let m = 1; m <= 12; m++) {
    const month = `${fiscalYear}-${m.toString().padStart(2, '0')}`;
    const budget = await updateRunningRepairsBudget(
      fiscalYear,
      month,
      {
        allocation_per_car: allocationPerCar,
      },
      userId
    );
    results.push(budget);
  }

  return results;
}

// ============================================================================
// SERVICE EVENT BUDGET
// ============================================================================

/**
 * Get service event budgets for a fiscal year
 */
export async function getServiceEventBudgets(
  fiscalYear: number,
  eventType?: EventType
): Promise<ServiceEventBudget[]> {
  const conditions = ['fiscal_year = $1'];
  const params: any[] = [fiscalYear];

  if (eventType) {
    conditions.push('event_type = $2');
    params.push(eventType);
  }

  const sql = `
    SELECT
      id,
      fiscal_year,
      event_type,
      budgeted_car_count,
      avg_cost_per_car,
      total_budget,
      customer_code,
      fleet_segment,
      car_type,
      notes,
      created_by,
      created_at,
      updated_at
    FROM service_event_budget
    WHERE ${conditions.join(' AND ')}
    ORDER BY event_type, customer_code
  `;

  const rows = await query<ServiceEventBudget>(sql, params);

  // Convert string numeric fields to numbers
  return rows.map(row => ({
    ...row,
    budgeted_car_count: Number(row.budgeted_car_count) || 0,
    avg_cost_per_car: Number(row.avg_cost_per_car) || 0,
    total_budget: Number(row.total_budget) || 0,
  }));
}

/**
 * Create a service event budget
 */
export async function createServiceEventBudget(
  data: {
    fiscal_year: number;
    event_type: EventType;
    budgeted_car_count: number;
    avg_cost_per_car: number;
    customer_code?: string;
    fleet_segment?: string;
    car_type?: string;
    notes?: string;
  },
  userId?: string
): Promise<ServiceEventBudget> {
  const totalBudget = data.budgeted_car_count * data.avg_cost_per_car;

  const sql = `
    INSERT INTO service_event_budget (
      fiscal_year, event_type, budgeted_car_count, avg_cost_per_car,
      total_budget, customer_code, fleet_segment, car_type, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;

  const rows = await query<ServiceEventBudget>(sql, [
    data.fiscal_year,
    data.event_type,
    data.budgeted_car_count,
    data.avg_cost_per_car,
    totalBudget,
    data.customer_code,
    data.fleet_segment,
    data.car_type,
    data.notes,
    userId,
  ]);

  return rows[0];
}

/**
 * Update a service event budget
 */
export async function updateServiceEventBudget(
  id: string,
  data: {
    budgeted_car_count?: number;
    avg_cost_per_car?: number;
    notes?: string;
  }
): Promise<ServiceEventBudget | null> {
  // First get existing to calculate new total
  const existing = await queryOne<ServiceEventBudget>(
    'SELECT * FROM service_event_budget WHERE id = $1',
    [id]
  );

  if (!existing) return null;

  const budgetedCount = data.budgeted_car_count ?? existing.budgeted_car_count;
  const avgCost = data.avg_cost_per_car ?? existing.avg_cost_per_car;
  const totalBudget = budgetedCount * avgCost;

  const sql = `
    UPDATE service_event_budget SET
      budgeted_car_count = $2,
      avg_cost_per_car = $3,
      total_budget = $4,
      notes = COALESCE($5, notes),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const rows = await query<ServiceEventBudget>(sql, [
    id,
    budgetedCount,
    avgCost,
    totalBudget,
    data.notes,
  ]);

  return rows[0] || null;
}

/**
 * Delete a service event budget
 */
export async function deleteServiceEventBudget(id: string): Promise<boolean> {
  await query(
    'DELETE FROM service_event_budget WHERE id = $1',
    [id]
  );
  return true;
}

/**
 * Get budget summary for a fiscal year
 */
export async function getBudgetSummary(fiscalYear: number): Promise<{
  fiscal_year: number;
  running_repairs: {
    total_budget: number;
    actual_spend: number;
    remaining: number;
  };
  service_events: {
    total_budget: number;
    planned_cost: number;
    actual_cost: number;
    remaining: number;
  };
  total: {
    budget: number;
    planned: number;
    shop_committed: number;
    committed: number;
    remaining: number;
    consumed_pct: number;
  };
}> {
  // Running repairs summary
  const rrResult = await queryOne<{
    total_budget: string;
    total_actual: string;
  }>(
    `SELECT
      COALESCE(SUM(monthly_budget), 0) as total_budget,
      COALESCE(SUM(actual_spend), 0) as total_actual
    FROM running_repairs_budget
    WHERE fiscal_year = $1`,
    [fiscalYear]
  );

  const rrTotalBudget = parseFloat(rrResult?.total_budget || '0');
  const rrActualSpend = parseFloat(rrResult?.total_actual || '0');

  // Service events budget total
  const seResult = await queryOne<{ total_budget: string }>(
    `SELECT COALESCE(SUM(total_budget), 0) as total_budget
    FROM service_event_budget
    WHERE fiscal_year = $1`,
    [fiscalYear]
  );
  const seTotalBudget = parseFloat(seResult?.total_budget || '0');

  // Get planned vs committed costs from allocations for service events
  // Planned = no shop assigned, Committed = shop assigned
  const allocResult = await queryOne<{
    planned_cost: string;
    committed_cost: string;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN shop_code IS NULL THEN CAST(COALESCE(estimated_cost, 0) AS DECIMAL) ELSE 0 END), 0) as planned_cost,
      COALESCE(SUM(CASE WHEN shop_code IS NOT NULL THEN CAST(COALESCE(actual_cost, estimated_cost) AS DECIMAL) ELSE 0 END), 0) as committed_cost
    FROM allocations
    WHERE LEFT(target_month, 4)::int = $1
      AND status NOT IN ('Released')`,
    [fiscalYear]
  );
  const sePlannedCost = parseFloat(allocResult?.planned_cost || '0');
  const seCommittedCost = parseFloat(allocResult?.committed_cost || '0');

  // Calculate totals
  const totalBudget = rrTotalBudget + seTotalBudget;
  const totalPlanned = sePlannedCost;
  const totalShopCommitted = rrActualSpend + seCommittedCost;
  const totalCommitted = totalPlanned + totalShopCommitted;
  const totalRemaining = totalBudget - totalCommitted;
  const consumedPct = totalBudget > 0 ? (totalCommitted / totalBudget) * 100 : 0;

  return {
    fiscal_year: fiscalYear,
    running_repairs: {
      total_budget: rrTotalBudget,
      actual_spend: rrActualSpend,
      remaining: rrTotalBudget - rrActualSpend,
    },
    service_events: {
      total_budget: seTotalBudget,
      planned_cost: sePlannedCost,
      actual_cost: seCommittedCost,
      remaining: seTotalBudget - sePlannedCost - seCommittedCost,
    },
    total: {
      budget: totalBudget,
      planned: totalPlanned,
      shop_committed: totalShopCommitted,
      committed: totalCommitted,
      remaining: totalRemaining,
      consumed_pct: consumedPct,
    },
  };
}

export default {
  getActiveLeasedCarCount,
  getHistoricalServiceEventStats,
  getRunningRepairsBudget,
  updateRunningRepairsBudget,
  calculateRunningRepairsBudget,
  getServiceEventBudgets,
  createServiceEventBudget,
  updateServiceEventBudget,
  deleteServiceEventBudget,
  getBudgetSummary,
};
