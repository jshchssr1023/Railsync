import { pool } from '../config/database';
import { query, queryOne } from '../config/database';

// ============================================================================
// DASHBOARD WIDGETS
// ============================================================================

export interface DashboardWidget {
  id: string;
  name: string;
  description?: string;
  category: string;
  default_width: number;
  default_height: number;
  config_schema?: Record<string, unknown>;
  data_endpoint?: string;
  is_active: boolean;
}

export interface DashboardConfig {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  layout: {
    columns: number;
    widgets: {
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      settings?: Record<string, unknown>;
    }[];
  };
  created_at: string;
  updated_at: string;
}

// Default widgets available in the system
const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: 'forecast-summary',
    name: 'Maintenance Forecast',
    description: 'Budget vs Planned vs Actual',
    category: 'Budget',
    default_width: 2,
    default_height: 1,
    data_endpoint: '/api/forecast',
    is_active: true,
  },
  {
    id: 'budget-gauge',
    name: 'Budget Utilization',
    description: 'Gauge showing % consumed',
    category: 'Budget',
    default_width: 1,
    default_height: 1,
    data_endpoint: '/api/budget/summary',
    is_active: true,
  },
  {
    id: 'capacity-heatmap',
    name: 'Capacity Heatmap',
    description: '18-month shop capacity view',
    category: 'Capacity',
    default_width: 3,
    default_height: 2,
    data_endpoint: '/api/capacity',
    is_active: true,
  },
  {
    id: 'demand-chart',
    name: 'Monthly Demand',
    description: 'Demand by month chart',
    category: 'Operations',
    default_width: 2,
    default_height: 2,
    data_endpoint: '/api/demands',
    is_active: true,
  },
  {
    id: 'allocation-status',
    name: 'Allocation Status',
    description: 'Cars by status breakdown',
    category: 'Operations',
    default_width: 2,
    default_height: 1,
    data_endpoint: '/api/allocations',
    is_active: true,
  },
  {
    id: 'recent-completions',
    name: 'Recent Completions',
    description: 'Cars with BRCs received',
    category: 'Operations',
    default_width: 2,
    default_height: 2,
    data_endpoint: '/api/brc/history',
    is_active: true,
  },
  {
    id: 'top-shops',
    name: 'Top Shops',
    description: 'Shops by volume and efficiency',
    category: 'Performance',
    default_width: 1,
    default_height: 2,
    data_endpoint: '/api/shops',
    is_active: true,
  },
  {
    id: 'scenario-comparison',
    name: 'Scenario Comparison',
    description: 'Compare allocation scenarios',
    category: 'Planning',
    default_width: 2,
    default_height: 2,
    data_endpoint: '/api/scenarios',
    is_active: true,
  },
];

export async function listWidgets(): Promise<DashboardWidget[]> {
  // For now, return static widgets. Can be moved to DB later.
  return DEFAULT_WIDGETS.filter(w => w.is_active);
}

export async function getWidgetById(widgetId: string): Promise<DashboardWidget | null> {
  return DEFAULT_WIDGETS.find(w => w.id === widgetId) || null;
}

// ============================================================================
// DASHBOARD CONFIGS (User-specific layouts)
// ============================================================================

export async function listDashboardConfigs(userId: string): Promise<DashboardConfig[]> {
  const result = await pool.query(
    `SELECT * FROM dashboard_configs WHERE user_id = $1 ORDER BY is_default DESC, name`,
    [userId]
  );
  return result.rows;
}

export async function getDashboardConfig(id: string, userId: string): Promise<DashboardConfig | null> {
  const result = await pool.query(
    `SELECT * FROM dashboard_configs WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
}

export async function getDefaultDashboardConfig(userId: string): Promise<DashboardConfig | null> {
  const result = await pool.query(
    `SELECT * FROM dashboard_configs WHERE user_id = $1 AND is_default = true LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function createDashboardConfig(
  userId: string,
  name: string,
  layout: DashboardConfig['layout'],
  isDefault: boolean = false
): Promise<DashboardConfig> {
  // If setting as default, unset other defaults
  if (isDefault) {
    await pool.query(
      `UPDATE dashboard_configs SET is_default = false WHERE user_id = $1`,
      [userId]
    );
  }

  const result = await pool.query(
    `INSERT INTO dashboard_configs (user_id, name, layout, is_default)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, name, JSON.stringify(layout), isDefault]
  );
  return result.rows[0];
}

export async function updateDashboardConfig(
  id: string,
  userId: string,
  updates: { name?: string; layout?: DashboardConfig['layout']; is_default?: boolean }
): Promise<DashboardConfig | null> {
  // If setting as default, unset other defaults
  if (updates.is_default) {
    await pool.query(
      `UPDATE dashboard_configs SET is_default = false WHERE user_id = $1 AND id != $2`,
      [userId, id]
    );
  }

  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.layout !== undefined) {
    setClauses.push(`layout = $${paramIndex++}`);
    values.push(JSON.stringify(updates.layout));
  }
  if (updates.is_default !== undefined) {
    setClauses.push(`is_default = $${paramIndex++}`);
    values.push(updates.is_default);
  }

  if (setClauses.length === 0) {
    return getDashboardConfig(id, userId);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(id, userId);

  const result = await pool.query(
    `UPDATE dashboard_configs SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
     RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteDashboardConfig(id: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM dashboard_configs WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// DEFAULT LAYOUT
// ============================================================================

export function getDefaultLayout(): DashboardConfig['layout'] {
  return {
    columns: 3,
    widgets: [
      { id: 'forecast-summary', x: 0, y: 0, w: 2, h: 1 },
      { id: 'budget-gauge', x: 2, y: 0, w: 1, h: 1 },
      { id: 'demand-chart', x: 0, y: 1, w: 2, h: 2 },
      { id: 'allocation-status', x: 2, y: 1, w: 1, h: 1 },
      { id: 'top-shops', x: 2, y: 2, w: 1, h: 2 },
    ],
  };
}

// ============================================================================
// OPERATIONAL DASHBOARD DATA QUERIES
// ============================================================================

// Contracts Readiness Summary
// total_cars comes from the cars table (SSOT), pipeline breakdowns from allocations
export async function getContractsReadiness() {
  const result = await queryOne(`
    SELECT
      (SELECT COUNT(*) FROM cars WHERE is_active = TRUE) AS total_cars,
      COUNT(*) FILTER (WHERE status IN ('Need Shopping', 'To Be Routed', 'Planned Shopping', 'Enroute', 'Arrived')) AS in_pipeline,
      COUNT(*) FILTER (WHERE status IN ('Complete', 'Released')) AS available,
      CASE WHEN (SELECT COUNT(*) FROM cars WHERE is_active = TRUE) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status IN ('Complete', 'Released'))::numeric / (SELECT COUNT(*) FROM cars WHERE is_active = TRUE)::numeric * 100, 1)
        ELSE 0
      END AS availability_pct,
      COUNT(*) FILTER (WHERE status = 'Need Shopping') AS need_shopping,
      COUNT(*) FILTER (WHERE status = 'To Be Routed') AS to_be_routed,
      COUNT(*) FILTER (WHERE status = 'Planned Shopping') AS planned_shopping,
      COUNT(*) FILTER (WHERE status = 'Enroute') AS enroute,
      COUNT(*) FILTER (WHERE status = 'Arrived') AS arrived,
      COUNT(*) FILTER (WHERE status = 'Complete') AS complete,
      COUNT(*) FILTER (WHERE status = 'Released') AS released
    FROM allocations
  `);
  return result;
}

export async function getNeedShoppingAlert() {
  return query(
    `SELECT a.id, a.car_id, a.car_number, a.shop_code, a.target_month,
            a.estimated_cost, a.created_at
     FROM allocations a
     WHERE a.status = 'Need Shopping'
     ORDER BY a.created_at ASC`
  );
}

// User-Centric: My Contracts Health
export async function getMyContractsHealth(userId: string) {
  return query(
    `SELECT
       a.status,
       COUNT(*) AS count,
       COALESCE(SUM(a.estimated_cost), 0) AS total_estimated,
       COALESCE(SUM(a.actual_cost), 0) AS total_actual
     FROM allocations a
     WHERE a.created_by = $1
       AND a.status NOT IN ('Released')
     GROUP BY a.status
     ORDER BY
       CASE a.status
         WHEN 'Need Shopping' THEN 1
         WHEN 'To Be Routed' THEN 2
         WHEN 'Planned Shopping' THEN 3
         WHEN 'Enroute' THEN 4
         WHEN 'Arrived' THEN 5
         WHEN 'Complete' THEN 6
       END`,
    [userId]
  );
}

// Manager Performance Leaderboard
export async function getManagerPerformance() {
  return query(
    `SELECT
       u.id AS manager_id,
       u.first_name || ' ' || u.last_name AS manager_name,
       u.organization,
       COUNT(a.id) AS total_allocations,
       COUNT(a.id) FILTER (WHERE a.status = 'Complete') AS completed,
       COUNT(a.id) FILTER (WHERE a.status IN ('Need Shopping', 'To Be Routed', 'Planned Shopping', 'Enroute', 'Arrived')) AS active,
       COALESCE(SUM(a.estimated_cost), 0) AS total_estimated,
       COALESCE(SUM(a.actual_cost), 0) AS total_actual,
       CASE WHEN SUM(a.estimated_cost) > 0
         THEN ROUND(((SUM(COALESCE(a.actual_cost, 0)) - SUM(a.estimated_cost)) / SUM(a.estimated_cost) * 100)::numeric, 1)
         ELSE 0
       END AS budget_variance_pct,
       ROUND(AVG(
         CASE WHEN a.actual_completion_date IS NOT NULL AND a.actual_arrival_date IS NOT NULL
           THEN a.actual_completion_date - a.actual_arrival_date
         END
       )::numeric, 1) AS avg_days_in_shop
     FROM users u
     INNER JOIN allocations a ON a.created_by = u.id
     WHERE u.role IN ('admin', 'operator')
     GROUP BY u.id, u.first_name, u.last_name, u.organization
     HAVING COUNT(a.id) > 0
     ORDER BY COUNT(a.id) DESC`
  );
}

// Dwell Time Heatmap by Status
export async function getDwellTimeHeatmap() {
  return query(
    `SELECT
       a.status,
       COUNT(*) AS car_count,
       ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - COALESCE(a.actual_arrival_date, a.created_at))) / 86400)::numeric, 1) AS avg_days,
       ROUND(MIN(EXTRACT(EPOCH FROM (NOW() - COALESCE(a.actual_arrival_date, a.created_at))) / 86400)::numeric, 1) AS min_days,
       ROUND(MAX(EXTRACT(EPOCH FROM (NOW() - COALESCE(a.actual_arrival_date, a.created_at))) / 86400)::numeric, 1) AS max_days
     FROM allocations a
     WHERE a.status NOT IN ('Complete', 'Released')
     GROUP BY a.status
     ORDER BY avg_days DESC`
  );
}

// Shop Throughput (last N days)
export async function getShopThroughput(days: number = 30) {
  const summary = await queryOne(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day') AS entered_pipeline,
       COUNT(*) FILTER (WHERE actual_completion_date >= CURRENT_DATE - $1 * INTERVAL '1 day') AS completed
     FROM allocations`,
    [days]
  );
  return summary;
}

// Upcoming Releases (7-day outlook)
export async function getUpcomingReleases(days: number = 7) {
  return query(
    `SELECT a.id, a.car_id, a.car_number, a.shop_code,
            a.target_month, a.status, a.actual_cost,
            a.actual_completion_date
     FROM allocations a
     WHERE a.status IN ('Complete', 'Released')
       AND a.actual_completion_date >= CURRENT_DATE - $1 * INTERVAL '1 day'
     ORDER BY a.actual_completion_date DESC
     LIMIT 20`,
    [days]
  );
}

// High-Cost Exceptions (actual > planned by threshold %)
export async function getHighCostExceptions(thresholdPct: number = 10) {
  return query(
    `SELECT a.id, a.car_id, a.car_number, a.shop_code,
            a.status, a.target_month,
            a.estimated_cost, a.actual_cost,
            ROUND(((a.actual_cost - a.estimated_cost) / NULLIF(a.estimated_cost, 0) * 100)::numeric, 1) AS variance_pct,
            a.actual_cost - a.estimated_cost AS variance_amount
     FROM allocations a
     WHERE a.actual_cost > a.estimated_cost * (1 + $1::numeric / 100)
       AND a.estimated_cost > 0
       AND a.status NOT IN ('Released')
     ORDER BY (a.actual_cost - a.estimated_cost) DESC
     LIMIT 20`,
    [thresholdPct]
  );
}

// Lining & Inspection Expiry Forecast (includes overdue + upcoming)
export async function getExpiryForecast() {
  const currentYear = new Date().getFullYear();
  return query(
    `SELECT car_number, car_mark, car_type, lessee_name,
            tank_qual_year, current_status, portfolio_status,
            years_overdue, qual_status
     FROM (
       SELECT car_number, car_mark, car_type, lessee_name,
              tank_qual_year, current_status, portfolio_status,
              years_overdue, 'overdue' as qual_status
       FROM v_overdue_cars
       UNION ALL
       SELECT car_number, car_mark, car_type, lessee_name,
              tank_qual_year, current_status, portfolio_status,
              0 as years_overdue, 'upcoming' as qual_status
       FROM v_upcoming_quals
       WHERE tank_qual_year <= $1 + 1
     ) combined
     ORDER BY tank_qual_year ASC, car_number ASC
     LIMIT 50`,
    [currentYear]
  );
}

// Budget Burn Velocity
export async function getBudgetBurnVelocity(fiscalYear: number) {
  const months = await query<{
    month: string;
    monthly_budget: number;
    actual_spend: number;
  }>(
    `SELECT month, monthly_budget, actual_spend
     FROM running_repairs_budget
     WHERE fiscal_year = $1
     ORDER BY month ASC`,
    [fiscalYear]
  );

  let cumulativeBudget = 0;
  let cumulativeActual = 0;
  const totalAnnualBudget = months.reduce((s, m) => s + (m.monthly_budget || 0), 0);

  const burnData = months.map((m, i) => {
    cumulativeBudget += m.monthly_budget || 0;
    cumulativeActual += m.actual_spend || 0;
    const projectedPace = (totalAnnualBudget / 12) * (i + 1);
    return {
      month: m.month,
      monthly_budget: m.monthly_budget,
      actual_spend: m.actual_spend,
      cumulative_budget: cumulativeBudget,
      cumulative_actual: cumulativeActual,
      projected_pace: Math.round(projectedPace),
      on_track: cumulativeActual <= projectedPace,
    };
  });

  const monthsWithSpend = months.filter(m => m.actual_spend > 0).length;

  return {
    fiscal_year: fiscalYear,
    total_annual_budget: totalAnnualBudget,
    total_spent: cumulativeActual,
    avg_monthly_burn: monthsWithSpend > 0 ? Math.round(cumulativeActual / monthsWithSpend) : 0,
    months: burnData,
  };
}
