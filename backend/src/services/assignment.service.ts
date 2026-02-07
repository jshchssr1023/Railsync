/**
 * Assignment Service - SSOT for Car Assignments
 *
 * This service manages the Single Source of Truth for all car-to-shop assignments.
 * All planning paths (demand, service plan, scenario, quick shop, bad order) flow through this service.
 */

import { query } from '../config/database';
import logger from '../config/logger';
import { createAlert } from './alerts.service';
import { detectProjectForCar } from './project-planning.service';
import * as assetEventService from './assetEvent.service';
import { logTransition } from './transition-log.service';

// ============================================================================
// TYPES
// ============================================================================

export type AssignmentStatus = 'Planned' | 'Scheduled' | 'Enroute' | 'Arrived' | 'InShop' | 'Complete' | 'Cancelled';
export type AssignmentSource = 'demand_plan' | 'service_plan' | 'scenario_export' | 'bad_order' | 'quick_shop' | 'import' | 'master_plan' | 'migration' | 'brc_import' | 'project_plan';
export type Priority = 1 | 2 | 3 | 4;

export interface CarAssignment {
  id: string;
  car_id?: string;
  car_mark_number?: string;
  car_number: string;
  shop_code: string;
  shop_name?: string;
  target_month: string;
  target_date?: string;
  status: AssignmentStatus;
  priority: Priority;
  is_expedited: boolean;
  expedite_reason?: string;
  estimated_cost?: number;
  actual_cost?: number;
  cost_variance?: number;
  source: AssignmentSource;
  source_reference_id?: string;
  source_reference_type?: string;
  original_shop_code?: string;
  original_target_month?: string;
  modification_reason?: string;
  created_at: string;
  created_by_id?: string;
  updated_at: string;
  version: number;
}

export interface CreateAssignmentInput {
  car_number: string;
  shop_code: string;
  target_month: string;
  target_date?: string;
  priority?: Priority;
  estimated_cost?: number;
  source: AssignmentSource;
  source_reference_id?: string;
  source_reference_type?: string;
  created_by_id?: string;
}

export interface UpdateAssignmentInput {
  shop_code?: string;
  target_month?: string;
  target_date?: string;
  status?: AssignmentStatus;
  priority?: Priority;
  is_expedited?: boolean;
  expedite_reason?: string;
  estimated_cost?: number;
  actual_cost?: number;
  modification_reason?: string;
  updated_by_id?: string;
}

export interface AssignmentConflict {
  type: 'existing_active' | 'duplicate_source';
  existing_assignment: CarAssignment;
  message: string;
}

export interface AssignmentFilters {
  car_number?: string;
  shop_code?: string;
  target_month?: string;
  status?: AssignmentStatus | AssignmentStatus[];
  source?: AssignmentSource;
  priority?: Priority;
  is_expedited?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Check if a car has an existing active assignment
 * @param carNumber The car number to check
 * @returns The existing active assignment if found, null otherwise
 */
export async function getActiveAssignment(carNumber: string): Promise<CarAssignment | null> {
  const sql = `
    SELECT * FROM car_assignments
    WHERE car_number = $1
      AND status NOT IN ('Complete', 'Cancelled')
    LIMIT 1
  `;

  const rows = await query<CarAssignment>(sql, [carNumber]);
  return rows.length > 0 ? normalizeAssignment(rows[0]) : null;
}

/**
 * Check for conflicts before creating an assignment
 * @param carNumber The car number to assign
 * @returns Conflict details if exists, null if clear
 */
export async function checkConflicts(carNumber: string): Promise<AssignmentConflict | null> {
  const existing = await getActiveAssignment(carNumber);

  if (existing) {
    return {
      type: 'existing_active',
      existing_assignment: existing,
      message: `Car ${carNumber} already has active assignment to ${existing.shop_code} for ${existing.target_month}`,
    };
  }

  return null;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new car assignment
 * @throws Error if car already has an active assignment
 */
export async function createAssignment(input: CreateAssignmentInput): Promise<CarAssignment> {
  // Check for conflicts first
  const conflict = await checkConflicts(input.car_number);
  if (conflict) {
    throw new Error(conflict.message);
  }

  // Get shop name for denormalization
  const shopResult = await query<{ shop_name: string }>('SELECT shop_name FROM shops WHERE shop_code = $1', [input.shop_code]);
  const shopName = shopResult[0]?.shop_name || input.shop_code;

  const sql = `
    INSERT INTO car_assignments (
      car_id,
      car_number,
      shop_code,
      shop_name,
      target_month,
      target_date,
      priority,
      estimated_cost,
      source,
      source_reference_id,
      source_reference_type,
      created_by_id
    ) VALUES (
      (SELECT id FROM cars WHERE car_number = $1),
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    )
    RETURNING *
  `;

  const rows = await query<CarAssignment>(sql, [
    input.car_number,
    input.shop_code,
    shopName,
    input.target_month,
    input.target_date || null,
    input.priority || 3,
    input.estimated_cost || null,
    input.source,
    input.source_reference_id || null,
    input.source_reference_type || null,
    input.created_by_id || null,
  ]);

  const assignment = normalizeAssignment(rows[0]);

  // Record asset event
  if (assignment.car_id) {
    assetEventService.recordEvent(assignment.car_id, 'assignment.created', {
      assignment_id: assignment.id,
      shop_code: assignment.shop_code,
      source: assignment.source,
    }, {
      sourceTable: 'car_assignments',
      sourceId: assignment.id,
      performedBy: input.created_by_id,
    }).catch(() => {}); // non-blocking
  }

  return assignment;
}

/**
 * Get an assignment by ID
 */
export async function getAssignment(id: string): Promise<CarAssignment | null> {
  const sql = 'SELECT * FROM car_assignments WHERE id = $1';
  const rows = await query<CarAssignment>(sql, [id]);
  return rows.length > 0 ? normalizeAssignment(rows[0]) : null;
}

/**
 * List assignments with filters
 */
export async function listAssignments(filters: AssignmentFilters = {}): Promise<{ assignments: CarAssignment[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number | boolean)[] = [];
  let paramIndex = 1;

  if (filters.car_number) {
    conditions.push(`car_number ILIKE $${paramIndex++}`);
    params.push(`%${filters.car_number}%`);
  }

  if (filters.shop_code) {
    conditions.push(`shop_code = $${paramIndex++}`);
    params.push(filters.shop_code);
  }

  if (filters.target_month) {
    conditions.push(`target_month = $${paramIndex++}`);
    params.push(filters.target_month);
  }

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(`status = ANY($${paramIndex++})`);
      params.push(filters.status as unknown as string);
    } else {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
  }

  if (filters.source) {
    conditions.push(`source = $${paramIndex++}`);
    params.push(filters.source);
  }

  if (filters.priority) {
    conditions.push(`priority = $${paramIndex++}`);
    params.push(filters.priority);
  }

  if (filters.is_expedited !== undefined) {
    conditions.push(`is_expedited = $${paramIndex++}`);
    params.push(filters.is_expedited);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countSql = `SELECT COUNT(*) as total FROM car_assignments ${whereClause}`;
  const countResult = await query<{ total: string }>(countSql, params);
  const total = parseInt(countResult[0]?.total || '0', 10);

  // Get paginated results
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const sql = `
    SELECT * FROM car_assignments
    ${whereClause}
    ORDER BY
      CASE status
        WHEN 'Planned' THEN 1
        WHEN 'Scheduled' THEN 2
        WHEN 'Enroute' THEN 3
        WHEN 'Arrived' THEN 4
        WHEN 'InShop' THEN 5
        WHEN 'Complete' THEN 6
        WHEN 'Cancelled' THEN 7
      END,
      priority,
      target_month,
      created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  params.push(limit, offset);
  const rows = await query<CarAssignment>(sql, params);

  return {
    assignments: rows.map(normalizeAssignment),
    total,
  };
}

/**
 * Update an assignment
 */
export async function updateAssignment(id: string, input: UpdateAssignmentInput): Promise<CarAssignment> {
  const current = await getAssignment(id);
  if (!current) {
    throw new Error(`Assignment ${id} not found`);
  }

  // Track shop/month changes for audit
  const originalShopCode = input.shop_code && input.shop_code !== current.shop_code ? current.shop_code : null;
  const originalTargetMonth = input.target_month && input.target_month !== current.target_month ? current.target_month : null;

  // Get new shop name if shop changed
  let newShopName = current.shop_name;
  if (input.shop_code && input.shop_code !== current.shop_code) {
    const shopResult = await query<{ shop_name: string }>('SELECT shop_name FROM shops WHERE shop_code = $1', [input.shop_code]);
    newShopName = shopResult[0]?.shop_name || input.shop_code;
  }

  const sql = `
    UPDATE car_assignments SET
      shop_code = COALESCE($1, shop_code),
      shop_name = COALESCE($2, shop_name),
      target_month = COALESCE($3, target_month),
      target_date = COALESCE($4, target_date),
      status = COALESCE($5, status),
      priority = COALESCE($6, priority),
      is_expedited = COALESCE($7, is_expedited),
      expedite_reason = COALESCE($8, expedite_reason),
      estimated_cost = COALESCE($9, estimated_cost),
      actual_cost = COALESCE($10, actual_cost),
      original_shop_code = COALESCE($11, original_shop_code),
      original_target_month = COALESCE($12, original_target_month),
      modification_reason = COALESCE($13, modification_reason),
      updated_by_id = $14
    WHERE id = $15
    RETURNING *
  `;

  const rows = await query<CarAssignment>(sql, [
    input.shop_code || null,
    input.shop_code ? newShopName : null,
    input.target_month || null,
    input.target_date || null,
    input.status || null,
    input.priority || null,
    input.is_expedited ?? null,
    input.expedite_reason || null,
    input.estimated_cost ?? null,
    input.actual_cost ?? null,
    originalShopCode,
    originalTargetMonth,
    input.modification_reason || null,
    input.updated_by_id || null,
    id,
  ]);

  return normalizeAssignment(rows[0]);
}

/**
 * Cancel an assignment
 */
export async function cancelAssignment(
  id: string,
  reason: string,
  cancelledById?: string
): Promise<CarAssignment> {
  // Get current assignment to capture previous status for transition logging
  const current = await getAssignment(id);
  const previousStatus = current?.status;

  const sql = `
    UPDATE car_assignments SET
      status = 'Cancelled',
      cancelled_at = NOW(),
      cancelled_by_id = $1,
      cancellation_reason = $2
    WHERE id = $3
    RETURNING *
  `;

  const rows = await query<CarAssignment>(sql, [cancelledById || null, reason, id]);
  if (rows.length === 0) {
    throw new Error(`Assignment ${id} not found`);
  }

  const cancelled = normalizeAssignment(rows[0]);

  // Log state transition (non-blocking)
  logTransition({
    processType: 'car_assignment',
    entityId: id,
    entityNumber: cancelled.car_number || undefined,
    fromState: previousStatus,
    toState: 'Cancelled',
    isReversible: false,
    actorId: cancelledById,
    notes: reason,
  }).catch(err => logger.error({ err: err }, '[TransitionLog] Failed to log assignment cancellation'));

  return cancelled;
}

/**
 * Expedite an assignment (move to immediate priority)
 */
export async function expediteAssignment(
  id: string,
  reason: string,
  expeditedById?: string
): Promise<CarAssignment> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const sql = `
    UPDATE car_assignments SET
      priority = 1,
      is_expedited = TRUE,
      expedite_reason = $1,
      expedited_at = NOW(),
      expedited_by_id = $2,
      target_month = $3,
      original_target_month = COALESCE(original_target_month, target_month)
    WHERE id = $4
    RETURNING *
  `;

  const rows = await query<CarAssignment>(sql, [reason, expeditedById || null, currentMonth, id]);
  if (rows.length === 0) {
    throw new Error(`Assignment ${id} not found`);
  }

  const assignment = normalizeAssignment(rows[0]);

  // Create alert for planning team
  await createAlert({
    alert_type: 'assignment_expedited',
    severity: 'warning',
    title: `Assignment Expedited: ${assignment.car_number}`,
    message: `Moved to immediate priority. Reason: ${reason}`,
    entity_type: 'car_assignments',
    entity_id: assignment.id,
    target_role: 'planner',
    metadata: {
      car_number: assignment.car_number,
      shop_code: assignment.shop_code,
      original_target_month: rows[0].original_target_month,
      new_target_month: currentMonth,
    },
  });

  return assignment;
}

/**
 * Update assignment status with appropriate timestamp
 */
export async function updateStatus(
  id: string,
  status: AssignmentStatus,
  updatedById?: string
): Promise<CarAssignment> {
  // Get current assignment to capture previous status for transition logging
  const current = await getAssignment(id);
  const previousStatus = current?.status;

  // Map status to timestamp column
  const timestampColumn: Record<AssignmentStatus, string | null> = {
    Planned: 'planned_at',
    Scheduled: 'scheduled_at',
    Enroute: 'enroute_at',
    Arrived: 'arrived_at',
    InShop: 'in_shop_at',
    Complete: 'completed_at',
    Cancelled: 'cancelled_at',
  };

  const tsCol = timestampColumn[status];
  const tsUpdate = tsCol ? `, ${tsCol} = NOW()` : '';

  const sql = `
    UPDATE car_assignments SET
      status = $1,
      updated_by_id = $2
      ${tsUpdate}
    WHERE id = $3
    RETURNING *
  `;

  const rows = await query<CarAssignment>(sql, [status, updatedById || null, id]);
  if (rows.length === 0) {
    throw new Error(`Assignment ${id} not found`);
  }

  const updated = normalizeAssignment(rows[0]);

  // Project detection: when car arrives or enters shop, check for active project work
  if (status === 'Arrived' || status === 'InShop') {
    try {
      const projectInfo = await detectProjectForCar(updated.car_number);
      if (projectInfo && projectInfo.assignment_id) {
        // Car belongs to active project - create alert for MC/EC
        await createAlert({
          alert_type: 'project_car_at_shop',
          severity: 'info',
          title: `Project car ${updated.car_number} is ${status} at ${updated.shop_code}`,
          message: `This car belongs to project ${projectInfo.project_number} (${projectInfo.project_name}). Planned shop: ${projectInfo.shop_code || 'N/A'}.`,
          entity_type: 'car_assignments',
          entity_id: updated.id,
          target_role: 'planner',
          metadata: {
            car_number: updated.car_number,
            current_shop: updated.shop_code,
            project_id: projectInfo.project_id,
            project_number: projectInfo.project_number,
            planned_shop: projectInfo.shop_code,
          },
        });
      }
    } catch {
      // Non-critical: don't fail the status update if project detection errors
    }
  }

  // Record asset event for status change
  if (updated.car_id) {
    assetEventService.recordEvent(updated.car_id, 'assignment.status_changed', {
      assignment_id: updated.id,
      from_status: previousStatus,
      to_status: status,
    }, {
      sourceTable: 'car_assignments',
      sourceId: updated.id,
      performedBy: updatedById,
    }).catch(() => {}); // non-blocking
  }

  // Log state transition (non-blocking)
  logTransition({
    processType: 'car_assignment',
    entityId: id,
    entityNumber: updated.car_number || undefined,
    fromState: previousStatus,
    toState: status,
    isReversible: status === 'Scheduled', // only Planned->Scheduled is reversible
    actorId: updatedById,
  }).catch(err => logger.error({ err: err }, '[TransitionLog] Failed to log assignment transition'));

  return updated;
}

// ============================================================================
// STATISTICS & REPORTING
// ============================================================================

/**
 * Get assignment counts by status for a shop
 */
export async function getShopAssignmentCounts(shopCode: string): Promise<Record<AssignmentStatus, number>> {
  const sql = `
    SELECT status, COUNT(*) as count
    FROM car_assignments
    WHERE shop_code = $1 AND status NOT IN ('Cancelled')
    GROUP BY status
  `;

  const rows = await query<{ status: AssignmentStatus; count: string }>(sql, [shopCode]);

  const counts: Record<AssignmentStatus, number> = {
    Planned: 0,
    Scheduled: 0,
    Enroute: 0,
    Arrived: 0,
    InShop: 0,
    Complete: 0,
    Cancelled: 0,
  };

  for (const row of rows) {
    counts[row.status] = parseInt(row.count, 10);
  }

  return counts;
}

/**
 * Get assignments by target month for capacity planning
 */
export async function getAssignmentsByMonth(
  startMonth: string,
  endMonth: string,
  shopCode?: string
): Promise<{ month: string; shop_code: string; count: number; estimated_cost: number }[]> {
  const conditions = ['target_month >= $1', 'target_month <= $2', "status NOT IN ('Cancelled')"];
  const params: (string | number)[] = [startMonth, endMonth];

  if (shopCode) {
    conditions.push('shop_code = $3');
    params.push(shopCode);
  }

  const sql = `
    SELECT
      target_month as month,
      shop_code,
      COUNT(*) as count,
      COALESCE(SUM(estimated_cost), 0) as estimated_cost
    FROM car_assignments
    WHERE ${conditions.join(' AND ')}
    GROUP BY target_month, shop_code
    ORDER BY target_month, shop_code
  `;

  const rows = await query<{ month: string; shop_code: string; count: string; estimated_cost: string }>(sql, params);

  return rows.map((row) => ({
    month: row.month,
    shop_code: row.shop_code,
    count: parseInt(row.count, 10),
    estimated_cost: parseFloat(row.estimated_cost),
  }));
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizeAssignment(row: CarAssignment): CarAssignment {
  return {
    ...row,
    priority: Number(row.priority) as Priority,
    estimated_cost: row.estimated_cost ? Number(row.estimated_cost) : undefined,
    actual_cost: row.actual_cost ? Number(row.actual_cost) : undefined,
    cost_variance: row.cost_variance ? Number(row.cost_variance) : undefined,
    is_expedited: Boolean(row.is_expedited),
    version: Number(row.version),
  };
}

export default {
  getActiveAssignment,
  checkConflicts,
  createAssignment,
  getAssignment,
  listAssignments,
  updateAssignment,
  cancelAssignment,
  expediteAssignment,
  updateStatus,
  getShopAssignmentCounts,
  getAssignmentsByMonth,
};
