/**
 * Service Option Service - Manages work items attached to assignments
 *
 * Service options represent work to be performed: qualifications, repairs, maintenance.
 * Qualification is NOT special - it's just another service option.
 */

import { query } from '../config/database';

// ============================================================================
// TYPES
// ============================================================================

export type ServiceCategory = 'qualification' | 'repair' | 'maintenance' | 'inspection';
export type ServiceOptionStatus = 'Pending' | 'InProgress' | 'Complete' | 'Skipped';
export type ServiceOptionSource = 'qualification_due' | 'bad_order' | 'user_added' | 'service_plan' | 'bundled';

export interface ServiceOption {
  id: string;
  assignment_id: string;
  service_type: string;
  service_category: ServiceCategory;
  description?: string;
  due_date?: string;
  reported_date?: string;
  is_required: boolean;
  is_selected: boolean;
  status: ServiceOptionStatus;
  completed_at?: string;
  estimated_cost?: number;
  actual_cost?: number;
  estimated_hours?: number;
  actual_hours?: number;
  source?: ServiceOptionSource;
  source_reference_id?: string;
  added_at: string;
  added_by_id?: string;
}

export interface CreateServiceOptionInput {
  assignment_id: string;
  service_type: string;
  service_category: ServiceCategory;
  description?: string;
  due_date?: string;
  reported_date?: string;
  is_required?: boolean;
  is_selected?: boolean;
  estimated_cost?: number;
  estimated_hours?: number;
  source?: ServiceOptionSource;
  source_reference_id?: string;
  added_by_id?: string;
}

export interface CarQualifications {
  tank_qualification?: string;
  rule_88b?: string;
  safety_relief?: string;
  service_equipment?: string;
  stub_sill?: string;
  tank_thickness?: string;
  interior_lining?: string;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export async function createServiceOption(input: CreateServiceOptionInput): Promise<ServiceOption> {
  const sql = `
    INSERT INTO assignment_service_options (
      assignment_id, service_type, service_category, description,
      due_date, reported_date, is_required, is_selected,
      estimated_cost, estimated_hours, source, source_reference_id, added_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `;

  const rows = await query<ServiceOption>(sql, [
    input.assignment_id,
    input.service_type,
    input.service_category,
    input.description || null,
    input.due_date || null,
    input.reported_date || null,
    input.is_required ?? false,
    input.is_selected ?? true,
    input.estimated_cost || null,
    input.estimated_hours || null,
    input.source || null,
    input.source_reference_id || null,
    input.added_by_id || null,
  ]);

  return normalizeOption(rows[0]);
}

export async function getServiceOption(id: string): Promise<ServiceOption | null> {
  const rows = await query<ServiceOption>('SELECT * FROM assignment_service_options WHERE id = $1', [id]);
  return rows.length > 0 ? normalizeOption(rows[0]) : null;
}

export async function getServiceOptionsForAssignment(assignmentId: string): Promise<ServiceOption[]> {
  const sql = `
    SELECT * FROM assignment_service_options
    WHERE assignment_id = $1
    ORDER BY is_required DESC, service_category, service_type
  `;
  const rows = await query<ServiceOption>(sql, [assignmentId]);
  return rows.map(normalizeOption);
}

export async function updateServiceOption(
  id: string,
  updates: Partial<Pick<ServiceOption, 'is_selected' | 'status' | 'actual_cost' | 'actual_hours'>>
): Promise<ServiceOption> {
  const sql = `
    UPDATE assignment_service_options SET
      is_selected = COALESCE($1, is_selected),
      status = COALESCE($2, status),
      actual_cost = COALESCE($3, actual_cost),
      actual_hours = COALESCE($4, actual_hours),
      completed_at = CASE WHEN $2 = 'Complete' THEN NOW() ELSE completed_at END
    WHERE id = $5
    RETURNING *
  `;

  const rows = await query<ServiceOption>(sql, [
    updates.is_selected ?? null,
    updates.status || null,
    updates.actual_cost ?? null,
    updates.actual_hours ?? null,
    id,
  ]);

  if (rows.length === 0) throw new Error(`Service option ${id} not found`);
  return normalizeOption(rows[0]);
}

export async function deleteServiceOption(id: string): Promise<void> {
  await query('DELETE FROM assignment_service_options WHERE id = $1', [id]);
}

// ============================================================================
// AUTO-SUGGESTION (Based on car data and target date)
// ============================================================================

export async function suggestServiceOptions(
  _carNumber: string,
  _targetDate: Date
): Promise<CreateServiceOptionInput[]> {
  const options: CreateServiceOptionInput[] = [];

  // Get car qualification dates (if stored)
  // For now, add a default qualification option
  options.push({
    assignment_id: '', // Will be set when attached
    service_type: 'tank_qualification',
    service_category: 'qualification',
    description: 'Tank Qualification',
    is_required: false,
    is_selected: true,
    source: 'qualification_due',
  });

  return options;
}

/**
 * Calculate total estimated cost for selected options
 */
export async function calculateTotalCost(assignmentId: string): Promise<number> {
  const sql = `
    SELECT COALESCE(SUM(estimated_cost), 0) as total
    FROM assignment_service_options
    WHERE assignment_id = $1 AND is_selected = TRUE
  `;
  const rows = await query<{ total: string }>(sql, [assignmentId]);
  return parseFloat(rows[0]?.total || '0');
}

/**
 * Bulk create service options for an assignment
 */
export async function bulkCreateServiceOptions(
  assignmentId: string,
  options: Omit<CreateServiceOptionInput, 'assignment_id'>[]
): Promise<ServiceOption[]> {
  const results: ServiceOption[] = [];
  for (const opt of options) {
    const created = await createServiceOption({ ...opt, assignment_id: assignmentId });
    results.push(created);
  }
  return results;
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizeOption(row: ServiceOption): ServiceOption {
  return {
    ...row,
    is_required: Boolean(row.is_required),
    is_selected: Boolean(row.is_selected),
    estimated_cost: row.estimated_cost ? Number(row.estimated_cost) : undefined,
    actual_cost: row.actual_cost ? Number(row.actual_cost) : undefined,
    estimated_hours: row.estimated_hours ? Number(row.estimated_hours) : undefined,
    actual_hours: row.actual_hours ? Number(row.actual_hours) : undefined,
  };
}

export default {
  createServiceOption,
  getServiceOption,
  getServiceOptionsForAssignment,
  updateServiceOption,
  deleteServiceOption,
  suggestServiceOptions,
  calculateTotalCost,
  bulkCreateServiceOptions,
};
