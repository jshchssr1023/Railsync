import { query, queryOne } from '../config/database';
import {
  RunningRepairsBudget,
  ServiceEventBudget,
  EventType,
} from '../types';
import { getActiveCarCount } from './carImport.service';

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
      remaining_budget,
      notes,
      created_by,
      created_at,
      updated_at
    FROM running_repairs_budget
    WHERE fiscal_year = $1
    ORDER BY month
  `;

  return query<RunningRepairsBudget>(sql, [fiscalYear]);
}

/**
 * Update running repairs budget for a month
 */
export async function updateRunningRepairsBudget(
  fiscalYear: number,
  month: string,
  data: {
    cars_on_lease?: number;
    allocation_per_car?: number;
    actual_spend?: number;
    actual_car_count?: number;
    notes?: string;
  },
  userId?: string
): Promise<RunningRepairsBudget> {
  // Calculate monthly budget and remaining
  const carsOnLease = data.cars_on_lease || 0;
  const allocationPerCar = data.allocation_per_car || 0;
  const monthlyBudget = carsOnLease * allocationPerCar;
  const actualSpend = data.actual_spend || 0;
  const remainingBudget = monthlyBudget - actualSpend;

  const sql = `
    INSERT INTO running_repairs_budget (
      fiscal_year, month, cars_on_lease, allocation_per_car,
      monthly_budget, actual_spend, actual_car_count, remaining_budget,
      notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (fiscal_year, month) DO UPDATE SET
      cars_on_lease = COALESCE($3, running_repairs_budget.cars_on_lease),
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
    data.cars_on_lease,
    data.allocation_per_car,
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
  const activeCount = await getActiveCarCount();
  const results: RunningRepairsBudget[] = [];

  // Generate 12 months of budget
  for (let m = 1; m <= 12; m++) {
    const month = `${fiscalYear}-${m.toString().padStart(2, '0')}`;
    const budget = await updateRunningRepairsBudget(
      fiscalYear,
      month,
      {
        cars_on_lease: activeCount,
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

  return query<ServiceEventBudget>(sql, params);
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
  const result = await query(
    'DELETE FROM service_event_budget WHERE id = $1',
    [id]
  );
  return true;
}

/**
 * Get budget summary for a fiscal year
 */
export async function getBudgetSummary(fiscalYear: number): Promise<{
  running_repairs: {
    total_budget: number;
    total_actual: number;
    remaining: number;
  };
  service_events: {
    by_type: { event_type: string; total_budget: number }[];
    total_budget: number;
  };
  grand_total: number;
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
  const rrTotalActual = parseFloat(rrResult?.total_actual || '0');

  // Service events by type
  const seByType = await query<{ event_type: string; total_budget: string }>(
    `SELECT
      event_type,
      COALESCE(SUM(total_budget), 0) as total_budget
    FROM service_event_budget
    WHERE fiscal_year = $1
    GROUP BY event_type`,
    [fiscalYear]
  );

  const seTotalBudget = seByType.reduce(
    (sum, row) => sum + parseFloat(row.total_budget),
    0
  );

  return {
    running_repairs: {
      total_budget: rrTotalBudget,
      total_actual: rrTotalActual,
      remaining: rrTotalBudget - rrTotalActual,
    },
    service_events: {
      by_type: seByType.map((row) => ({
        event_type: row.event_type,
        total_budget: parseFloat(row.total_budget),
      })),
      total_budget: seTotalBudget,
    },
    grand_total: rrTotalBudget + seTotalBudget,
  };
}

export default {
  getRunningRepairsBudget,
  updateRunningRepairsBudget,
  calculateRunningRepairsBudget,
  getServiceEventBudgets,
  createServiceEventBudget,
  updateServiceEventBudget,
  deleteServiceEventBudget,
  getBudgetSummary,
};
