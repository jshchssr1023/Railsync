import { pool } from '../config/database';

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
