import { query, queryOne } from '../config/database';
import { ForecastResult, ForecastLine, MonthlyForecast } from '../types';

/**
 * Get maintenance forecast for a fiscal year
 */
export async function getMaintenanceForecast(fiscalYear: number): Promise<ForecastResult> {
  // Get forecast data from the view
  const forecastRows = await query<{
    fiscal_year: number;
    budget_type: string;
    event_type: string | null;
    total_budget: string;
    planned_cost: string;
    planned_car_count: string;
    actual_cost: string;
    actual_car_count: string;
    remaining_budget: string;
  }>(
    `SELECT * FROM v_maintenance_forecast WHERE fiscal_year = $1`,
    [fiscalYear]
  );

  // Calculate summary totals
  let totalBudget = 0;
  let totalPlanned = 0;
  let totalActual = 0;

  const byType: ForecastLine[] = forecastRows.map((row) => {
    const budget = parseFloat(row.total_budget) || 0;
    const planned = parseFloat(row.planned_cost) || 0;
    const actual = parseFloat(row.actual_cost) || 0;

    totalBudget += budget;
    totalPlanned += planned;
    totalActual += actual;

    return {
      budget_type: row.budget_type,
      event_type: row.event_type || undefined,
      total_budget: budget,
      planned_cost: planned,
      planned_car_count: parseInt(row.planned_car_count) || 0,
      actual_cost: actual,
      actual_car_count: parseInt(row.actual_car_count) || 0,
      remaining_budget: parseFloat(row.remaining_budget) || 0,
    };
  });

  // Get monthly forecast
  const byMonth = await getMonthlyForecast(fiscalYear);

  const remainingBudget = totalBudget - totalPlanned - totalActual;
  const budgetConsumedPct =
    totalBudget > 0 ? ((totalPlanned + totalActual) / totalBudget) * 100 : 0;

  return {
    fiscal_year: fiscalYear,
    summary: {
      total_budget: totalBudget,
      total_planned: totalPlanned,
      total_actual: totalActual,
      remaining_budget: remainingBudget,
      budget_consumed_pct: budgetConsumedPct,
    },
    by_type: byType,
    by_month: byMonth,
  };
}

/**
 * Get monthly forecast data
 */
async function getMonthlyForecast(fiscalYear: number): Promise<MonthlyForecast[]> {
  const result = await query<{
    target_month: string;
    planned_cost: string;
    actual_cost: string;
  }>(
    `SELECT
      target_month,
      COALESCE(SUM(CASE WHEN status IN ('Planned Shopping', 'Enroute', 'Arrived')
                   THEN estimated_cost ELSE 0 END), 0) AS planned_cost,
      COALESCE(SUM(CASE WHEN status IN ('Complete', 'Released')
                   THEN actual_cost ELSE 0 END), 0) AS actual_cost
    FROM allocations a
    JOIN demands d ON a.demand_id = d.id
    WHERE d.fiscal_year = $1
    GROUP BY target_month
    ORDER BY target_month`,
    [fiscalYear]
  );

  // Add cumulative values
  let cumPlanned = 0;
  let cumActual = 0;

  return result.map((row) => {
    const planned = parseFloat(row.planned_cost) || 0;
    const actual = parseFloat(row.actual_cost) || 0;
    cumPlanned += planned;
    cumActual += actual;

    return {
      target_month: row.target_month,
      planned_cost: planned,
      actual_cost: actual,
      cumulative_planned: cumPlanned,
      cumulative_actual: cumActual,
    };
  });
}

/**
 * Get forecast trends (variance analysis)
 */
export async function getForecastTrends(fiscalYear: number): Promise<{
  avg_variance: number;
  avg_variance_pct: number;
  over_budget_count: number;
  under_budget_count: number;
  by_shop: {
    shop_code: string;
    shop_name: string;
    total_estimated: number;
    total_actual: number;
    variance: number;
    variance_pct: number;
  }[];
}> {
  // Get allocations with both estimated and actual costs
  const allocationData = await query<{
    shop_code: string;
    estimated_cost: string;
    actual_cost: string;
  }>(
    `SELECT a.shop_code, a.estimated_cost, a.actual_cost
     FROM allocations a
     JOIN demands d ON a.demand_id = d.id
     WHERE d.fiscal_year = $1
       AND a.actual_cost IS NOT NULL
       AND a.estimated_cost IS NOT NULL`,
    [fiscalYear]
  );

  let totalVariance = 0;
  let overBudget = 0;
  let underBudget = 0;

  // Group by shop
  const byShopMap = new Map<
    string,
    { estimated: number; actual: number; count: number }
  >();

  for (const row of allocationData) {
    const estimated = parseFloat(row.estimated_cost) || 0;
    const actual = parseFloat(row.actual_cost) || 0;
    const variance = actual - estimated;

    totalVariance += variance;
    if (variance > 0) overBudget++;
    else if (variance < 0) underBudget++;

    const existing = byShopMap.get(row.shop_code) || { estimated: 0, actual: 0, count: 0 };
    existing.estimated += estimated;
    existing.actual += actual;
    existing.count++;
    byShopMap.set(row.shop_code, existing);
  }

  // Get shop names
  const shopCodes = Array.from(byShopMap.keys());
  const shopNames = new Map<string, string>();
  if (shopCodes.length > 0) {
    const shops = await query<{ shop_code: string; shop_name: string }>(
      `SELECT shop_code, shop_name FROM shops WHERE shop_code = ANY($1)`,
      [shopCodes]
    );
    for (const shop of shops) {
      shopNames.set(shop.shop_code, shop.shop_name);
    }
  }

  const totalCount = allocationData.length;
  const avgVariance = totalCount > 0 ? totalVariance / totalCount : 0;

  const totalEstimated = Array.from(byShopMap.values()).reduce(
    (sum, v) => sum + v.estimated,
    0
  );
  const avgVariancePct = totalEstimated > 0 ? (totalVariance / totalEstimated) * 100 : 0;

  const byShop = Array.from(byShopMap.entries()).map(([shop_code, data]) => {
    const variance = data.actual - data.estimated;
    const variancePct = data.estimated > 0 ? (variance / data.estimated) * 100 : 0;

    return {
      shop_code,
      shop_name: shopNames.get(shop_code) || shop_code,
      total_estimated: data.estimated,
      total_actual: data.actual,
      variance,
      variance_pct: variancePct,
    };
  });

  // Sort by variance (worst first)
  byShop.sort((a, b) => b.variance - a.variance);

  return {
    avg_variance: avgVariance,
    avg_variance_pct: avgVariancePct,
    over_budget_count: overBudget,
    under_budget_count: underBudget,
    by_shop: byShop,
  };
}

/**
 * Get quick summary stats for dashboard
 */
export async function getDashboardSummary(fiscalYear: number): Promise<{
  total_budget: number;
  consumed_pct: number;
  active_demands: number;
  pending_allocations: number;
  completed_this_month: number;
}> {
  // Get forecast summary
  const forecast = await getMaintenanceForecast(fiscalYear);

  // Count active demands
  const demandResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM demands
     WHERE fiscal_year = $1 AND status NOT IN ('Complete', 'Allocated')`,
    [fiscalYear]
  );

  // Count pending allocations
  const allocResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM allocations a
     JOIN demands d ON a.demand_id = d.id
     WHERE d.fiscal_year = $1 AND a.status IN ('Planned Shopping', 'Enroute', 'Arrived')`,
    [fiscalYear]
  );

  // Count completed this month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const completedResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM allocations
     WHERE target_month = $1 AND status = 'Complete'`,
    [currentMonth]
  );

  return {
    total_budget: forecast.summary.total_budget,
    consumed_pct: forecast.summary.budget_consumed_pct,
    active_demands: parseInt(demandResult?.count || '0'),
    pending_allocations: parseInt(allocResult?.count || '0'),
    completed_this_month: parseInt(completedResult?.count || '0'),
  };
}

export default {
  getMaintenanceForecast,
  getForecastTrends,
  getDashboardSummary,
};
