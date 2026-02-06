import { query, queryOne } from '../config/database';

// =============================================================================
// CAPACITY FORECASTING
// =============================================================================

interface CapacityForecast {
  month: string;
  shop_code: string;
  shop_name: string;
  projected_demand: number;
  current_capacity: number;
  utilization_pct: number;
  gap: number;
  status: 'under' | 'optimal' | 'at-risk' | 'over';
}

interface CapacityTrend {
  month: string;
  total_capacity: number;
  total_demand: number;
  utilization_pct: number;
}

export async function getCapacityForecast(months: number = 6): Promise<CapacityForecast[]> {
  // Get upcoming months
  const forecastMonths: string[] = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    forecastMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Get shop capacities and projected allocations
  const results = await query<any>(`
    WITH shop_capacity AS (
      SELECT
        s.shop_code,
        s.shop_name,
        COALESCE(s.capacity, 50) as monthly_capacity
      FROM shops s
      WHERE s.is_active = true
      LIMIT 50
    ),
    monthly_allocations AS (
      SELECT
        ca.shop_code,
        to_char(date_trunc('month',
          CASE WHEN ca.target_month IS NOT NULL
            THEN to_date(ca.target_month, 'YYYY-MM')
            ELSE ca.created_at
          END
        ), 'YYYY-MM') as month,
        COUNT(*) as allocation_count
      FROM car_assignments ca
      WHERE ca.status NOT IN ('Cancelled', 'Complete')
      GROUP BY ca.shop_code, month
    ),
    historical_avg AS (
      SELECT
        shop_code,
        AVG(allocation_count) as avg_monthly
      FROM monthly_allocations
      GROUP BY shop_code
    )
    SELECT
      sc.shop_code,
      sc.shop_name,
      sc.monthly_capacity,
      COALESCE(ha.avg_monthly, 0) as historical_avg,
      COALESCE(ma.allocation_count, 0) as current_allocations
    FROM shop_capacity sc
    LEFT JOIN historical_avg ha ON sc.shop_code = ha.shop_code
    LEFT JOIN monthly_allocations ma ON sc.shop_code = ma.shop_code
    ORDER BY sc.shop_name
  `);

  const forecasts: CapacityForecast[] = [];

  for (const month of forecastMonths) {
    for (const shop of results) {
      // Simple projection: use historical average with some variance
      const monthIndex = forecastMonths.indexOf(month);
      const seasonalFactor = 1 + (Math.sin(monthIndex * Math.PI / 6) * 0.1); // Slight seasonal variation
      const projected = Math.round((shop.historical_avg || shop.monthly_capacity * 0.7) * seasonalFactor);
      const capacity = shop.monthly_capacity;
      const utilization = capacity > 0 ? (projected / capacity) * 100 : 0;
      const gap = capacity - projected;

      let status: 'under' | 'optimal' | 'at-risk' | 'over' = 'optimal';
      if (utilization < 50) status = 'under';
      else if (utilization >= 90) status = 'over';
      else if (utilization >= 80) status = 'at-risk';

      forecasts.push({
        month,
        shop_code: shop.shop_code,
        shop_name: shop.shop_name,
        projected_demand: projected,
        current_capacity: capacity,
        utilization_pct: Math.round(utilization),
        gap,
        status,
      });
    }
  }

  return forecasts;
}

export async function getCapacityTrends(months: number = 12): Promise<CapacityTrend[]> {
  const results = await query<any>(`
    WITH months AS (
      SELECT to_char(generate_series(
        date_trunc('month', CURRENT_DATE - interval '${months} months'),
        date_trunc('month', CURRENT_DATE),
        '1 month'
      ), 'YYYY-MM') as month
    ),
    monthly_demand AS (
      SELECT
        to_char(date_trunc('month', ca.created_at), 'YYYY-MM') as month,
        COUNT(*) as demand
      FROM car_assignments ca
      GROUP BY month
    ),
    total_capacity AS (
      SELECT COALESCE(SUM(capacity), 5000) as total_capacity FROM shops WHERE is_active = true
    )
    SELECT
      m.month,
      tc.total_capacity,
      COALESCE(md.demand, 0) as total_demand,
      CASE WHEN tc.total_capacity > 0
        THEN ROUND((COALESCE(md.demand, 0)::numeric / tc.total_capacity * 100), 1)
        ELSE 0
      END as utilization_pct
    FROM months m
    CROSS JOIN total_capacity tc
    LEFT JOIN monthly_demand md ON m.month = md.month
    ORDER BY m.month
  `);

  return results.map(r => ({
    month: r.month,
    total_capacity: parseInt(r.total_capacity),
    total_demand: parseInt(r.total_demand),
    utilization_pct: parseFloat(r.utilization_pct),
  }));
}

export async function getBottleneckShops(limit: number = 10): Promise<any[]> {
  const results = await query<any>(`
    SELECT
      s.shop_code,
      s.shop_name,
      s.region,
      COALESCE(s.capacity, 50) as capacity,
      COUNT(ca.id) as current_load,
      CASE WHEN COALESCE(s.capacity, 50) > 0
        THEN ROUND((COUNT(ca.id)::numeric / COALESCE(s.capacity, 50) * 100), 1)
        ELSE 0
      END as utilization_pct,
      COALESCE(sb.hours_backlog, 0) as hours_backlog,
      COALESCE(sb.cars_backlog, 0) as cars_backlog
    FROM shops s
    LEFT JOIN car_assignments ca ON s.shop_code = ca.shop_code AND ca.status IN ('Arrived', 'InShop')
    LEFT JOIN shop_backlogs sb ON s.shop_code = sb.shop_code
    WHERE s.is_active = true
    GROUP BY s.shop_code, s.shop_name, s.region, s.capacity, sb.hours_backlog, sb.cars_backlog
    HAVING COUNT(ca.id) > 0
    ORDER BY utilization_pct DESC
    LIMIT $1
  `, [limit]);

  return results;
}

// =============================================================================
// COST ANALYTICS
// =============================================================================

interface CostTrend {
  month: string;
  total_cost: number;
  labor_cost: number;
  material_cost: number;
  freight_cost: number;
  avg_cost_per_car: number;
  car_count: number;
}

interface BudgetComparison {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variance_pct: number;
}

interface ShopCostComparison {
  shop_code: string;
  shop_name: string;
  total_cost: number;
  car_count: number;
  avg_cost_per_car: number;
  labor_rate: number;
}

export async function getCostTrends(months: number = 12): Promise<CostTrend[]> {
  const results = await query<any>(`
    WITH months AS (
      SELECT to_char(generate_series(
        date_trunc('month', CURRENT_DATE - interval '${months} months'),
        date_trunc('month', CURRENT_DATE),
        '1 month'
      ), 'YYYY-MM') as month
    ),
    monthly_costs AS (
      SELECT
        to_char(date_trunc('month', ca.created_at), 'YYYY-MM') as month,
        SUM(COALESCE(ca.estimated_cost, 0)) as total_cost,
        COUNT(*) as car_count
      FROM car_assignments ca
      WHERE ca.estimated_cost IS NOT NULL
      GROUP BY month
    )
    SELECT
      m.month,
      COALESCE(mc.total_cost, 0) as total_cost,
      COALESCE(mc.car_count, 0) as car_count,
      CASE WHEN COALESCE(mc.car_count, 1) > 0
        THEN ROUND(COALESCE(mc.total_cost, 0) / COALESCE(mc.car_count, 1))
        ELSE 0
      END as avg_cost_per_car
    FROM months m
    LEFT JOIN monthly_costs mc ON m.month = mc.month
    ORDER BY m.month
  `);

  return results.map(r => ({
    month: r.month,
    total_cost: parseFloat(r.total_cost) || 0,
    labor_cost: 0,
    material_cost: 0,
    freight_cost: 0,
    avg_cost_per_car: parseFloat(r.avg_cost_per_car) || 0,
    car_count: parseInt(r.car_count) || 0,
  }));
}

export async function getBudgetComparison(fiscalYear: number = 2026): Promise<BudgetComparison[]> {
  // Get budget data from running_repairs_budget and service_event_budget
  const budgetResult = await query<any>(`
    SELECT
      'Running Repairs' as category,
      COALESCE(SUM(monthly_budget), 0) as budgeted,
      COALESCE(SUM(actual_spend), 0) as actual
    FROM running_repairs_budget
    WHERE fiscal_year = $1
    UNION ALL
    SELECT
      'Service Events' as category,
      COALESCE(SUM(total_budget), 0) as budgeted,
      0 as actual
    FROM service_event_budget
    WHERE fiscal_year = $1
  `, [fiscalYear]);

  return budgetResult.map((r: any) => {
    const budgeted = parseFloat(r.budgeted);
    const actual = parseFloat(r.actual);
    const variance = actual - budgeted;
    const variance_pct = budgeted > 0 ? (variance / budgeted) * 100 : 0;
    return {
      category: r.category,
      budgeted,
      actual,
      variance,
      variance_pct: Math.round(variance_pct * 100) / 100,
    };
  });
}

export async function getShopCostComparison(limit: number = 20): Promise<ShopCostComparison[]> {
  const results = await query<any>(`
    SELECT
      s.shop_code,
      s.shop_name,
      s.labor_rate,
      COALESCE(SUM(ca.estimated_cost), 0) as total_cost,
      COUNT(ca.id) as car_count,
      CASE WHEN COUNT(ca.id) > 0
        THEN ROUND(COALESCE(SUM(ca.estimated_cost), 0) / COUNT(ca.id))
        ELSE 0
      END as avg_cost_per_car
    FROM shops s
    LEFT JOIN car_assignments ca ON s.shop_code = ca.shop_code
    WHERE s.is_active = true
    GROUP BY s.shop_code, s.shop_name, s.labor_rate
    HAVING COUNT(ca.id) > 0
    ORDER BY total_cost DESC
    LIMIT $1
  `, [limit]);

  return results.map(r => ({
    shop_code: r.shop_code,
    shop_name: r.shop_name,
    total_cost: parseFloat(r.total_cost),
    car_count: parseInt(r.car_count),
    avg_cost_per_car: parseFloat(r.avg_cost_per_car),
    labor_rate: parseFloat(r.labor_rate) || 0,
  }));
}

// =============================================================================
// OPERATIONS KPIs
// =============================================================================

interface OperationsKPI {
  metric: string;
  value: number;
  unit: string;
  target: number;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'flat';
}

interface DwellTimeByShop {
  shop_code: string;
  shop_name: string;
  avg_dwell_days: number;
  min_dwell_days: number;
  max_dwell_days: number;
  car_count: number;
}

interface ThroughputTrend {
  month: string;
  cars_in: number;
  cars_out: number;
  net_change: number;
}

export async function getOperationsKPIs(): Promise<OperationsKPI[]> {
  // Get various KPIs from the database
  const pipelineResult = await queryOne<any>(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('Arrived', 'InShop')) as active_count,
      COUNT(*) FILTER (WHERE status = 'Complete') as completed_count,
      COUNT(*) FILTER (WHERE status = 'Enroute') as in_transit_count,
      COUNT(*) as total_count
    FROM car_assignments
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  `);

  const dwellResult = await queryOne<any>(`
    SELECT
      AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, CURRENT_TIMESTAMP) - COALESCE(arrived_at, in_shop_at, created_at))) / 86400) as avg_dwell_days
    FROM car_assignments
    WHERE status IN ('Arrived', 'InShop', 'Complete')
    AND created_at >= CURRENT_DATE - INTERVAL '90 days'
  `);

  const badOrderResult = await queryOne<any>(`
    SELECT COUNT(*) as bad_order_count
    FROM bad_order_reports
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  `);

  const active = parseInt(pipelineResult?.active_count || '0');
  const completed = parseInt(pipelineResult?.completed_count || '0');
  const inTransit = parseInt(pipelineResult?.in_transit_count || '0');
  const avgDwell = parseFloat(dwellResult?.avg_dwell_days || '18');
  const badOrders = parseInt(badOrderResult?.bad_order_count || '0');

  const kpis: OperationsKPI[] = [
    {
      metric: 'Average Dwell Time',
      value: Math.round(avgDwell),
      unit: 'days',
      target: 14,
      status: avgDwell <= 14 ? 'good' : avgDwell <= 21 ? 'warning' : 'critical',
      trend: 'down',
    },
    {
      metric: 'Active Work Orders',
      value: active,
      unit: 'cars',
      target: 100,
      status: 'good',
      trend: 'up',
    },
    {
      metric: 'Completed (30d)',
      value: completed,
      unit: 'cars',
      target: 50,
      status: completed >= 50 ? 'good' : completed >= 30 ? 'warning' : 'critical',
      trend: 'up',
    },
    {
      metric: 'In Transit',
      value: inTransit,
      unit: 'cars',
      target: 30,
      status: inTransit <= 30 ? 'good' : inTransit <= 50 ? 'warning' : 'critical',
      trend: 'flat',
    },
    {
      metric: 'Bad Orders (30d)',
      value: badOrders,
      unit: 'reports',
      target: 5,
      status: badOrders <= 5 ? 'good' : badOrders <= 10 ? 'warning' : 'critical',
      trend: badOrders <= 5 ? 'down' : 'up',
    },
    {
      metric: 'On-Time Completion',
      value: completed > 0 ? Math.round((completed / (completed + active)) * 100) : 0,
      unit: '%',
      target: 90,
      status: 'good',
      trend: 'up',
    },
  ];

  return kpis;
}

export async function getDwellTimeByShop(limit: number = 15): Promise<DwellTimeByShop[]> {
  const results = await query<any>(`
    SELECT
      s.shop_code,
      s.shop_name,
      AVG(EXTRACT(EPOCH FROM (COALESCE(ca.completed_at, CURRENT_TIMESTAMP) - COALESCE(ca.arrived_at, ca.in_shop_at, ca.created_at))) / 86400) as avg_dwell_days,
      MIN(EXTRACT(EPOCH FROM (COALESCE(ca.completed_at, CURRENT_TIMESTAMP) - COALESCE(ca.arrived_at, ca.in_shop_at, ca.created_at))) / 86400) as min_dwell_days,
      MAX(EXTRACT(EPOCH FROM (COALESCE(ca.completed_at, CURRENT_TIMESTAMP) - COALESCE(ca.arrived_at, ca.in_shop_at, ca.created_at))) / 86400) as max_dwell_days,
      COUNT(*) as car_count
    FROM shops s
    INNER JOIN car_assignments ca ON s.shop_code = ca.shop_code
    WHERE ca.created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY s.shop_code, s.shop_name
    HAVING COUNT(*) >= 3
    ORDER BY avg_dwell_days DESC
    LIMIT $1
  `, [limit]);

  return results.map(r => ({
    shop_code: r.shop_code,
    shop_name: r.shop_name,
    avg_dwell_days: Math.round(parseFloat(r.avg_dwell_days)),
    min_dwell_days: Math.round(parseFloat(r.min_dwell_days)),
    max_dwell_days: Math.round(parseFloat(r.max_dwell_days)),
    car_count: parseInt(r.car_count),
  }));
}

export async function getThroughputTrends(months: number = 6): Promise<ThroughputTrend[]> {
  const results = await query<any>(`
    WITH months AS (
      SELECT to_char(generate_series(
        date_trunc('month', CURRENT_DATE - interval '${months} months'),
        date_trunc('month', CURRENT_DATE),
        '1 month'
      ), 'YYYY-MM') as month
    ),
    monthly_in AS (
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
        COUNT(*) as cars_in
      FROM car_assignments
      GROUP BY month
    ),
    monthly_out AS (
      SELECT
        to_char(date_trunc('month', completed_at), 'YYYY-MM') as month,
        COUNT(*) as cars_out
      FROM car_assignments
      WHERE completed_at IS NOT NULL
      GROUP BY month
    )
    SELECT
      m.month,
      COALESCE(mi.cars_in, 0) as cars_in,
      COALESCE(mo.cars_out, 0) as cars_out,
      COALESCE(mi.cars_in, 0) - COALESCE(mo.cars_out, 0) as net_change
    FROM months m
    LEFT JOIN monthly_in mi ON m.month = mi.month
    LEFT JOIN monthly_out mo ON m.month = mo.month
    ORDER BY m.month
  `);

  return results.map(r => ({
    month: r.month,
    cars_in: parseInt(r.cars_in),
    cars_out: parseInt(r.cars_out),
    net_change: parseInt(r.net_change),
  }));
}

// =============================================================================
// DEMAND FORECASTING
// =============================================================================

interface DemandForecast {
  month: string;
  predicted_demand: number;
  confidence_low: number;
  confidence_high: number;
  historical_avg: number;
}

interface DemandByRegion {
  region: string;
  current_demand: number;
  projected_demand: number;
  growth_pct: number;
}

interface DemandByCustomer {
  customer_name: string;
  current_demand: number;
  historical_avg: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export async function getDemandForecast(months: number = 6): Promise<DemandForecast[]> {
  // Get historical data for simple moving average forecast
  const historicalResult = await query<any>(`
    SELECT
      to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
      COUNT(*) as demand
    FROM car_assignments
    WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY month
    ORDER BY month
  `);

  const historical = historicalResult.map((r: any) => ({
    month: r.month,
    demand: parseInt(r.demand),
  }));

  // Calculate moving average
  const avgDemand = historical.length > 0
    ? historical.reduce((sum: number, h: any) => sum + h.demand, 0) / historical.length
    : 50;

  // Calculate standard deviation for confidence intervals
  const variance = historical.length > 1
    ? historical.reduce((sum: number, h: any) => sum + Math.pow(h.demand - avgDemand, 2), 0) / historical.length
    : avgDemand * 0.2;
  const stdDev = Math.sqrt(variance);

  // Generate forecasts
  const forecasts: DemandForecast[] = [];
  const now = new Date();

  for (let i = 1; i <= months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Simple trend projection with seasonal adjustment
    const seasonalFactor = 1 + (Math.sin((d.getMonth() + 1) * Math.PI / 6) * 0.1);
    const trendFactor = 1 + (i * 0.02); // 2% growth per month
    const predicted = Math.round(avgDemand * seasonalFactor * trendFactor);

    forecasts.push({
      month,
      predicted_demand: predicted,
      confidence_low: Math.round(predicted - 1.96 * stdDev),
      confidence_high: Math.round(predicted + 1.96 * stdDev),
      historical_avg: Math.round(avgDemand),
    });
  }

  return forecasts;
}

export async function getDemandByRegion(): Promise<DemandByRegion[]> {
  const results = await query<any>(`
    WITH current_demand AS (
      SELECT
        s.region,
        COUNT(*) as current_demand
      FROM car_assignments ca
      JOIN shops s ON ca.shop_code = s.shop_code
      WHERE ca.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY s.region
    ),
    historical_demand AS (
      SELECT
        s.region,
        COUNT(*) / 6.0 as avg_monthly
      FROM car_assignments ca
      JOIN shops s ON ca.shop_code = s.shop_code
      WHERE ca.created_at >= CURRENT_DATE - INTERVAL '180 days'
      AND ca.created_at < CURRENT_DATE - INTERVAL '30 days'
      GROUP BY s.region
    )
    SELECT
      COALESCE(cd.region, hd.region) as region,
      COALESCE(cd.current_demand, 0) as current_demand,
      COALESCE(hd.avg_monthly, 0) as historical_avg,
      ROUND(COALESCE(cd.current_demand, 0) * 1.1) as projected_demand
    FROM current_demand cd
    FULL OUTER JOIN historical_demand hd ON cd.region = hd.region
    WHERE COALESCE(cd.region, hd.region) IS NOT NULL
    ORDER BY current_demand DESC
  `);

  return results.map(r => ({
    region: r.region || 'Unknown',
    current_demand: parseInt(r.current_demand),
    projected_demand: parseInt(r.projected_demand),
    growth_pct: r.historical_avg > 0
      ? Math.round(((r.current_demand - r.historical_avg) / r.historical_avg) * 100)
      : 0,
  }));
}

export async function getDemandByCustomer(limit: number = 10): Promise<DemandByCustomer[]> {
  const results = await query<any>(`
    WITH current_demand AS (
      SELECT
        c.customer_name,
        COUNT(*) as current_demand
      FROM car_assignments ca
      JOIN cars cr ON ca.car_number = cr.car_number
      JOIN rider_cars rc ON rc.car_number = cr.car_number AND rc.is_active = TRUE
      JOIN lease_riders lr ON lr.id = rc.rider_id
      JOIN master_leases ml ON ml.id = lr.master_lease_id
      JOIN customers c ON c.id = ml.customer_id
      WHERE ca.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY c.customer_name
    ),
    historical_demand AS (
      SELECT
        c.customer_name,
        COUNT(*) / 3.0 as avg_monthly
      FROM car_assignments ca
      JOIN cars cr ON ca.car_number = cr.car_number
      JOIN rider_cars rc ON rc.car_number = cr.car_number AND rc.is_active = TRUE
      JOIN lease_riders lr ON lr.id = rc.rider_id
      JOIN master_leases ml ON ml.id = lr.master_lease_id
      JOIN customers c ON c.id = ml.customer_id
      WHERE ca.created_at >= CURRENT_DATE - INTERVAL '90 days'
      AND ca.created_at < CURRENT_DATE - INTERVAL '30 days'
      GROUP BY c.customer_name
    )
    SELECT
      COALESCE(cd.customer_name, hd.customer_name, 'Unknown') as customer_name,
      COALESCE(cd.current_demand, 0) as current_demand,
      COALESCE(hd.avg_monthly, 0) as historical_avg
    FROM current_demand cd
    FULL OUTER JOIN historical_demand hd ON cd.customer_name = hd.customer_name
    ORDER BY current_demand DESC
    LIMIT $1
  `, [limit]);

  return results.map(r => {
    const current = parseInt(r.current_demand);
    const historical = parseFloat(r.historical_avg);
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (historical > 0) {
      const change = (current - historical) / historical;
      if (change > 0.1) trend = 'increasing';
      else if (change < -0.1) trend = 'decreasing';
    }
    return {
      customer_name: r.customer_name,
      current_demand: current,
      historical_avg: Math.round(historical),
      trend,
    };
  });
}

export default {
  getCapacityForecast,
  getCapacityTrends,
  getBottleneckShops,
  getCostTrends,
  getBudgetComparison,
  getShopCostComparison,
  getOperationsKPIs,
  getDwellTimeByShop,
  getThroughputTrends,
  getDemandForecast,
  getDemandByRegion,
  getDemandByCustomer,
};
