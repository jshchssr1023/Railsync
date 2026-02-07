/**
 * Report Builder Service
 * Configurable report generation with templates, dynamic filters, and export.
 *
 * Users pick a template, set filters, preview results, and export to CSV.
 * Admins can schedule recurring reports via email distribution.
 */

import { query, queryOne } from '../config/database';

// ============================================================================
// TYPES
// ============================================================================

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  base_table: string;
  default_columns: string[];
  available_columns: ColumnDef[];
  available_filters: FilterDef[];
  default_sort: string;
  created_by: string | null;
  is_system: boolean;
  created_at: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  sql_expr: string;
  type: 'text' | 'number' | 'date' | 'currency';
}

export interface FilterDef {
  key: string;
  label: string;
  sql_column: string;
  type: 'text' | 'select' | 'date_range' | 'number_range';
  options?: string[];
}

export interface SavedReport {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  columns: string[];
  filters: Record<string, unknown>;
  sort_by: string | null;
  sort_dir: string;
  created_by: string;
  is_scheduled: boolean;
  schedule_cron: string | null;
  schedule_recipients: string[] | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportResult {
  columns: { key: string; label: string; type: string }[];
  rows: Record<string, unknown>[];
  total: number;
  generated_at: string;
}

// ============================================================================
// BUILT-IN TEMPLATES
// ============================================================================

const TEMPLATES: Omit<ReportTemplate, 'id' | 'created_by' | 'created_at'>[] = [
  {
    name: 'Fleet Inventory',
    description: 'Car roster with ownership, lease, and status details',
    category: 'fleet',
    base_table: 'cars',
    is_system: true,
    default_columns: ['car_number', 'car_type', 'owner_code', 'lessee_code', 'status', 'built_date'],
    default_sort: 'car_number ASC',
    available_columns: [
      { key: 'car_number', label: 'Car Number', sql_expr: 'c.car_number', type: 'text' },
      { key: 'car_type', label: 'Car Type', sql_expr: 'c.car_type', type: 'text' },
      { key: 'owner_code', label: 'Owner', sql_expr: 'c.owner_code', type: 'text' },
      { key: 'lessee_code', label: 'Lessee', sql_expr: 'c.lessee_code', type: 'text' },
      { key: 'lessee_name', label: 'Lessee Name', sql_expr: 'c.lessee_name', type: 'text' },
      { key: 'status', label: 'Status', sql_expr: 'c.status', type: 'text' },
      { key: 'built_date', label: 'Built Date', sql_expr: 'c.built_date', type: 'date' },
      { key: 'aar_type', label: 'AAR Type', sql_expr: 'c.aar_type', type: 'text' },
      { key: 'commodity_cin', label: 'Commodity', sql_expr: 'c.commodity_cin', type: 'text' },
      { key: 'contract_number', label: 'Contract', sql_expr: 'c.contract_number', type: 'text' },
    ],
    available_filters: [
      { key: 'car_type', label: 'Car Type', sql_column: 'c.car_type', type: 'text' },
      { key: 'owner_code', label: 'Owner Code', sql_column: 'c.owner_code', type: 'text' },
      { key: 'lessee_code', label: 'Lessee Code', sql_column: 'c.lessee_code', type: 'text' },
      { key: 'status', label: 'Status', sql_column: 'c.status', type: 'select', options: ['active', 'inactive', 'retired', 'stored'] },
    ],
  },
  {
    name: 'Allocation Pipeline',
    description: 'Car assignments with shop, status, cost, and timeline',
    category: 'operations',
    base_table: 'allocations',
    is_system: true,
    default_columns: ['car_number', 'shop_code', 'status', 'target_month', 'estimated_cost'],
    default_sort: 'target_month DESC',
    available_columns: [
      { key: 'car_number', label: 'Car Number', sql_expr: 'a.car_number', type: 'text' },
      { key: 'shop_code', label: 'Shop Code', sql_expr: 'a.shop_code', type: 'text' },
      { key: 'status', label: 'Status', sql_expr: 'a.status', type: 'text' },
      { key: 'target_month', label: 'Target Month', sql_expr: 'a.target_month', type: 'text' },
      { key: 'estimated_cost', label: 'Estimated Cost', sql_expr: 'a.estimated_cost', type: 'currency' },
      { key: 'actual_cost', label: 'Actual Cost', sql_expr: 'a.actual_cost', type: 'currency' },
      { key: 'scope_of_work', label: 'Scope of Work', sql_expr: 'a.scope_of_work', type: 'text' },
      { key: 'created_at', label: 'Created', sql_expr: 'a.created_at', type: 'date' },
    ],
    available_filters: [
      { key: 'status', label: 'Status', sql_column: 'a.status', type: 'select', options: ['Planned', 'Scheduled', 'Enroute', 'Arrived', 'InShop', 'Complete', 'Released'] },
      { key: 'shop_code', label: 'Shop', sql_column: 'a.shop_code', type: 'text' },
      { key: 'target_month', label: 'Target Month', sql_column: 'a.target_month', type: 'text' },
    ],
  },
  {
    name: 'Invoice Summary',
    description: 'Invoices with amounts, status, and vendor details',
    category: 'billing',
    base_table: 'invoices',
    is_system: true,
    default_columns: ['invoice_number', 'vendor_name', 'total_amount', 'status', 'invoice_date'],
    default_sort: 'invoice_date DESC',
    available_columns: [
      { key: 'invoice_number', label: 'Invoice #', sql_expr: 'i.invoice_number', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', sql_expr: 'i.vendor_name', type: 'text' },
      { key: 'total_amount', label: 'Amount', sql_expr: 'i.total_amount', type: 'currency' },
      { key: 'status', label: 'Status', sql_expr: 'i.status', type: 'text' },
      { key: 'invoice_date', label: 'Date', sql_expr: 'i.invoice_date', type: 'date' },
      { key: 'car_number', label: 'Car', sql_expr: 'i.car_number', type: 'text' },
      { key: 'shop_code', label: 'Shop', sql_expr: 'i.shop_code', type: 'text' },
      { key: 'invoice_type', label: 'Type', sql_expr: 'i.invoice_type', type: 'text' },
    ],
    available_filters: [
      { key: 'status', label: 'Status', sql_column: 'i.status', type: 'select', options: ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'posted'] },
      { key: 'vendor_name', label: 'Vendor', sql_column: 'i.vendor_name', type: 'text' },
      { key: 'invoice_type', label: 'Type', sql_column: 'i.invoice_type', type: 'text' },
    ],
  },
  {
    name: 'Shopping Events',
    description: 'Shopping events with status, scope, and financials',
    category: 'operations',
    base_table: 'shopping_events',
    is_system: true,
    default_columns: ['event_number', 'car_number', 'shop_code', 'event_type', 'status', 'created_at'],
    default_sort: 'created_at DESC',
    available_columns: [
      { key: 'event_number', label: 'Event #', sql_expr: 'se.event_number', type: 'text' },
      { key: 'car_number', label: 'Car', sql_expr: 'se.car_number', type: 'text' },
      { key: 'shop_code', label: 'Shop', sql_expr: 'se.shop_code', type: 'text' },
      { key: 'event_type', label: 'Type', sql_expr: 'se.event_type', type: 'text' },
      { key: 'status', label: 'Status', sql_expr: 'se.status', type: 'text' },
      { key: 'estimated_cost', label: 'Est. Cost', sql_expr: 'se.estimated_cost', type: 'currency' },
      { key: 'created_at', label: 'Created', sql_expr: 'se.created_at', type: 'date' },
    ],
    available_filters: [
      { key: 'status', label: 'Status', sql_column: 'se.status', type: 'text' },
      { key: 'event_type', label: 'Event Type', sql_column: 'se.event_type', type: 'text' },
      { key: 'shop_code', label: 'Shop', sql_column: 'se.shop_code', type: 'text' },
    ],
  },
  {
    name: 'Qualification Compliance',
    description: 'Car qualifications with due dates, status, and compliance alerts',
    category: 'compliance',
    base_table: 'qualifications',
    is_system: true,
    default_columns: ['car_number', 'qualification_type', 'status', 'due_date', 'last_completed_date'],
    default_sort: 'due_date ASC',
    available_columns: [
      { key: 'car_number', label: 'Car', sql_expr: 'q.car_number', type: 'text' },
      { key: 'qualification_type', label: 'Type', sql_expr: 'q.qualification_type', type: 'text' },
      { key: 'status', label: 'Status', sql_expr: 'q.status', type: 'text' },
      { key: 'due_date', label: 'Due Date', sql_expr: 'q.due_date', type: 'date' },
      { key: 'last_completed_date', label: 'Last Completed', sql_expr: 'q.last_completed_date', type: 'date' },
      { key: 'interval_months', label: 'Interval (mo)', sql_expr: 'q.interval_months', type: 'number' },
    ],
    available_filters: [
      { key: 'status', label: 'Status', sql_column: 'q.status', type: 'select', options: ['current', 'due_soon', 'due', 'overdue', 'expired', 'exempt'] },
      { key: 'qualification_type', label: 'Type', sql_column: 'q.qualification_type', type: 'text' },
    ],
  },
  {
    name: 'Budget vs Actual',
    description: 'Budget utilization by month with estimated vs actual costs',
    category: 'finance',
    base_table: 'allocations',
    is_system: true,
    default_columns: ['target_month', 'allocation_count', 'total_estimated', 'total_actual', 'variance'],
    default_sort: 'target_month DESC',
    available_columns: [
      { key: 'target_month', label: 'Month', sql_expr: 'a.target_month', type: 'text' },
      { key: 'allocation_count', label: 'Count', sql_expr: 'COUNT(*)', type: 'number' },
      { key: 'total_estimated', label: 'Estimated', sql_expr: 'SUM(a.estimated_cost)', type: 'currency' },
      { key: 'total_actual', label: 'Actual', sql_expr: 'SUM(a.actual_cost)', type: 'currency' },
      { key: 'variance', label: 'Variance', sql_expr: 'SUM(COALESCE(a.actual_cost, a.estimated_cost) - a.estimated_cost)', type: 'currency' },
    ],
    available_filters: [
      { key: 'status', label: 'Status', sql_column: 'a.status', type: 'select', options: ['Planned', 'Scheduled', 'InShop', 'Complete'] },
    ],
  },
];

// Table alias mapping
const TABLE_ALIASES: Record<string, string> = {
  cars: 'c',
  allocations: 'a',
  invoices: 'i',
  shopping_events: 'se',
  qualifications: 'q',
};

// ============================================================================
// TEMPLATE OPERATIONS
// ============================================================================

export function listTemplates(): ReportTemplate[] {
  return TEMPLATES.map((t, idx) => ({
    ...t,
    id: `system-${idx}`,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
  }));
}

export function getTemplate(templateId: string): ReportTemplate | null {
  const idx = parseInt(templateId.replace('system-', ''), 10);
  if (isNaN(idx) || idx < 0 || idx >= TEMPLATES.length) return null;
  const t = TEMPLATES[idx];
  return { ...t, id: templateId, created_by: null, created_at: '2026-01-01T00:00:00Z' };
}

// ============================================================================
// REPORT EXECUTION
// ============================================================================

export async function runReport(
  templateId: string,
  options: {
    columns?: string[];
    filters?: Record<string, unknown>;
    sort_by?: string;
    sort_dir?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  }
): Promise<ReportResult> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Template not found: ${templateId}`);

  const alias = TABLE_ALIASES[template.base_table] || template.base_table.charAt(0);
  const selectedKeys = options.columns && options.columns.length > 0
    ? options.columns
    : template.default_columns;

  // Resolve column definitions
  const selectedCols = selectedKeys
    .map(k => template.available_columns.find(c => c.key === k))
    .filter(Boolean) as ColumnDef[];

  if (selectedCols.length === 0) throw new Error('No valid columns selected');

  // Determine if this is an aggregate report
  const hasAggregate = selectedCols.some(c => /^(SUM|COUNT|AVG|MIN|MAX)\(/i.test(c.sql_expr));

  // Build SELECT
  const selectParts = selectedCols.map(c => `${c.sql_expr} AS "${c.key}"`);

  // Build WHERE from filters (parameterized)
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value === undefined || value === null || value === '') continue;
      const filterDef = template.available_filters.find(f => f.key === key);
      if (!filterDef) continue;

      if (filterDef.type === 'text') {
        conditions.push(`${filterDef.sql_column} ILIKE $${paramIdx++}`);
        params.push(`%${value}%`);
      } else if (filterDef.type === 'select') {
        conditions.push(`${filterDef.sql_column} = $${paramIdx++}`);
        params.push(value);
      } else if (filterDef.type === 'date_range' && typeof value === 'object') {
        const range = value as { from?: string; to?: string };
        if (range.from) {
          conditions.push(`${filterDef.sql_column} >= $${paramIdx++}`);
          params.push(range.from);
        }
        if (range.to) {
          conditions.push(`${filterDef.sql_column} <= $${paramIdx++}`);
          params.push(range.to);
        }
      }
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // GROUP BY for aggregate reports
  let groupByClause = '';
  if (hasAggregate) {
    const nonAggCols = selectedCols
      .filter(c => !/^(SUM|COUNT|AVG|MIN|MAX)\(/i.test(c.sql_expr))
      .map(c => c.sql_expr);
    if (nonAggCols.length > 0) {
      groupByClause = `GROUP BY ${nonAggCols.join(', ')}`;
    }
  }

  // Sort
  const sortCol = options.sort_by
    ? selectedCols.find(c => c.key === options.sort_by)?.sql_expr
    : null;
  const sortDir = options.sort_dir === 'DESC' ? 'DESC' : 'ASC';
  const orderClause = sortCol
    ? `ORDER BY ${sortCol} ${sortDir}`
    : `ORDER BY ${template.default_sort}`;

  const limit = Math.min(options.limit || 500, 5000);
  const offset = options.offset || 0;

  // Count query
  const countSql = `SELECT COUNT(*) AS cnt FROM ${template.base_table} ${alias} ${whereClause}`;
  const countResult = await queryOne<{ cnt: string }>(countSql, params);
  const total = parseInt(countResult?.cnt || '0', 10);

  // Data query
  const dataSql = `SELECT ${selectParts.join(', ')} FROM ${template.base_table} ${alias} ${whereClause} ${groupByClause} ${orderClause} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  const rows = await query<Record<string, unknown>>(dataSql, [...params, limit, offset]);

  return {
    columns: selectedCols.map(c => ({ key: c.key, label: c.label, type: c.type })),
    rows,
    total: hasAggregate ? rows.length : total,
    generated_at: new Date().toISOString(),
  };
}

// ============================================================================
// CSV EXPORT
// ============================================================================

export function toCSV(result: ReportResult): string {
  const header = result.columns.map(c => `"${c.label}"`).join(',');
  const rows = result.rows.map(row =>
    result.columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
      return String(val);
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

// ============================================================================
// SAVED REPORTS (DB-backed)
// ============================================================================

export async function saveReport(
  templateId: string,
  name: string,
  config: {
    description?: string;
    columns: string[];
    filters: Record<string, unknown>;
    sort_by?: string;
    sort_dir?: string;
  },
  userId: string
): Promise<SavedReport> {
  const result = await queryOne<SavedReport>(
    `INSERT INTO saved_reports (template_id, name, description, columns, filters, sort_by, sort_dir, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      templateId,
      name,
      config.description || null,
      JSON.stringify(config.columns),
      JSON.stringify(config.filters),
      config.sort_by || null,
      config.sort_dir || 'ASC',
      userId,
    ]
  );
  return result!;
}

export async function listSavedReports(userId: string): Promise<SavedReport[]> {
  return query<SavedReport>(
    `SELECT * FROM saved_reports WHERE created_by = $1 ORDER BY updated_at DESC`,
    [userId]
  );
}

export async function getSavedReport(id: string): Promise<SavedReport | null> {
  return queryOne<SavedReport>(`SELECT * FROM saved_reports WHERE id = $1`, [id]);
}

export async function deleteSavedReport(id: string, userId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM saved_reports WHERE id = $1 AND created_by = $2`,
    [id, userId]
  );
  return (result as any).length !== undefined || true;
}

// ============================================================================
// SCHEDULE MANAGEMENT
// ============================================================================

export async function setSchedule(
  reportId: string,
  cronExpr: string,
  recipients: string[]
): Promise<SavedReport | null> {
  return queryOne<SavedReport>(
    `UPDATE saved_reports
     SET is_scheduled = TRUE, schedule_cron = $2, schedule_recipients = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [reportId, cronExpr, JSON.stringify(recipients)]
  );
}

export async function removeSchedule(reportId: string): Promise<SavedReport | null> {
  return queryOne<SavedReport>(
    `UPDATE saved_reports
     SET is_scheduled = FALSE, schedule_cron = NULL, schedule_recipients = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [reportId]
  );
}

export async function getDueReports(): Promise<SavedReport[]> {
  return query<SavedReport>(
    `SELECT * FROM saved_reports WHERE is_scheduled = TRUE ORDER BY name`
  );
}
