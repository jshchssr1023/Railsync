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

interface QualificationField {
  dbColumn: string;
  serviceType: string;
  label: string;
  estimatedCost: number;
  estimatedHours: number;
}

const QUALIFICATION_FIELDS: QualificationField[] = [
  { dbColumn: 'tank_qual_year', serviceType: 'tank_qualification', label: 'Tank Qualification', estimatedCost: 8000, estimatedHours: 24 },
  { dbColumn: 'rule_88b_year', serviceType: 'rule_88b', label: 'Rule 88B Inspection', estimatedCost: 2500, estimatedHours: 8 },
  { dbColumn: 'safety_relief_year', serviceType: 'safety_relief', label: 'Safety Relief Valve', estimatedCost: 1800, estimatedHours: 4 },
  { dbColumn: 'service_equipment_year', serviceType: 'service_equipment', label: 'Service Equipment', estimatedCost: 3500, estimatedHours: 12 },
  { dbColumn: 'stub_sill_year', serviceType: 'stub_sill', label: 'Stub Sill Inspection', estimatedCost: 2000, estimatedHours: 6 },
  { dbColumn: 'tank_thickness_year', serviceType: 'tank_thickness', label: 'Tank Thickness Test', estimatedCost: 1500, estimatedHours: 4 },
  { dbColumn: 'interior_lining_year', serviceType: 'interior_lining', label: 'Interior Lining', estimatedCost: 12000, estimatedHours: 40 },
];

const MAINTENANCE_OPTIONS = [
  { serviceType: 'exterior_paint', label: 'Exterior Paint', estimatedCost: 2000, estimatedHours: 8 },
  { serviceType: 'interior_cleaning', label: 'Interior Cleaning', estimatedCost: 1500, estimatedHours: 6 },
  { serviceType: 'gasket_replacement', label: 'Gasket Replacement', estimatedCost: 800, estimatedHours: 4 },
  { serviceType: 'valve_service', label: 'Valve Service', estimatedCost: 1200, estimatedHours: 4 },
];

export interface SuggestedServiceOption extends Omit<CreateServiceOptionInput, 'assignment_id'> {
  days_until_due?: number;
  urgency?: 'overdue' | 'urgent' | 'upcoming' | 'optional';
}

export async function suggestServiceOptions(
  carNumber: string,
  targetDate: Date
): Promise<SuggestedServiceOption[]> {
  const options: SuggestedServiceOption[] = [];

  // Get car with qualification dates
  const carSql = `
    SELECT car_number, tank_qual_year, rule_88b_year, safety_relief_year,
           service_equipment_year, stub_sill_year, tank_thickness_year, interior_lining_year
    FROM cars WHERE car_number = $1
  `;
  const cars = await query<Record<string, unknown>>(carSql, [carNumber]);
  const car = cars[0];

  if (car) {
    // Check each qualification field
    for (const qual of QUALIFICATION_FIELDS) {
      const yearValue = car[qual.dbColumn];
      if (yearValue) {
        // Convert year to date (assume end of year for qualification expiry)
        const dueDate = new Date(Number(yearValue), 11, 31); // Dec 31 of that year
        const daysUntilDue = Math.floor((dueDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

        let urgency: SuggestedServiceOption['urgency'] = 'optional';
        let isRequired = false;
        let isSelected = false;

        if (daysUntilDue <= 0) {
          urgency = 'overdue';
          isRequired = true;
          isSelected = true;
        } else if (daysUntilDue <= 30) {
          urgency = 'urgent';
          isRequired = true;
          isSelected = true;
        } else if (daysUntilDue <= 90) {
          urgency = 'upcoming';
          isSelected = true;
        }

        // Only include if due within 365 days or overdue
        if (daysUntilDue <= 365) {
          options.push({
            service_type: qual.serviceType,
            service_category: 'qualification',
            description: qual.label,
            due_date: dueDate.toISOString().split('T')[0],
            is_required: isRequired,
            is_selected: isSelected,
            estimated_cost: qual.estimatedCost,
            estimated_hours: qual.estimatedHours,
            source: 'qualification_due',
            days_until_due: daysUntilDue,
            urgency,
          });
        }
      }
    }
  }

  // Check for open bad orders
  const badOrderSql = `
    SELECT id, issue_type, issue_description, severity, reported_date
    FROM bad_order_reports
    WHERE car_number = $1 AND status IN ('open', 'pending_decision')
  `;
  const badOrders = await query<{
    id: string;
    issue_type: string;
    issue_description: string;
    severity: string;
    reported_date: string;
  }>(badOrderSql, [carNumber]);

  for (const bo of badOrders) {
    const isCritical = bo.severity === 'critical' || bo.severity === 'high';
    options.push({
      service_type: 'bad_order_repair',
      service_category: 'repair',
      description: `Bad Order: ${bo.issue_type} - ${bo.issue_description}`,
      reported_date: bo.reported_date,
      is_required: isCritical,
      is_selected: true,
      estimated_cost: isCritical ? 5000 : 3000,
      estimated_hours: isCritical ? 16 : 8,
      source: 'bad_order',
      source_reference_id: bo.id,
      urgency: isCritical ? 'urgent' : 'upcoming',
    });
  }

  // Add maintenance options (all optional, not selected by default)
  for (const maint of MAINTENANCE_OPTIONS) {
    options.push({
      service_type: maint.serviceType,
      service_category: 'maintenance',
      description: maint.label,
      is_required: false,
      is_selected: false,
      estimated_cost: maint.estimatedCost,
      estimated_hours: maint.estimatedHours,
      source: 'user_added',
      urgency: 'optional',
    });
  }

  // Sort: required first, then by urgency, then by category
  const urgencyOrder = { overdue: 0, urgent: 1, upcoming: 2, optional: 3 };
  options.sort((a, b) => {
    if (a.is_required !== b.is_required) return a.is_required ? -1 : 1;
    const aUrgency = urgencyOrder[a.urgency || 'optional'];
    const bUrgency = urgencyOrder[b.urgency || 'optional'];
    return aUrgency - bUrgency;
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
