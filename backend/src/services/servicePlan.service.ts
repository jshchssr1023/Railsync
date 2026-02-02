/**
 * Service Plan Service
 *
 * Manages service plan proposals with multiple options for customer review.
 * When a plan is approved, it creates assignments in the SSOT car_assignments table.
 */

import { query } from '../config/database';
import { createAssignment, checkConflicts } from './assignment.service';

// ============================================================================
// TYPES
// ============================================================================

export type ServicePlanStatus = 'draft' | 'proposed' | 'awaiting_response' | 'approved' | 'rejected' | 'expired';
export type OptionStatus = 'draft' | 'finalized' | 'selected' | 'rejected';

export interface ServicePlan {
  id: string;
  customer_id?: string;
  customer_code?: string;
  name: string;
  description?: string;
  car_flow_rate: number;
  start_date: string;
  end_date: string;
  fiscal_year: number;
  status: ServicePlanStatus;
  approved_option_id?: string;
  approved_at?: string;
  approved_by?: string;
  approval_notes?: string;
  response_deadline?: string;
  created_at: string;
  created_by_id?: string;
  updated_at: string;
}

export interface ServicePlanOption {
  id: string;
  service_plan_id: string;
  option_name: string;
  description?: string;
  total_estimated_cost?: number;
  avg_cost_per_car?: number;
  avg_turn_time?: number;
  shop_count?: number;
  primary_shop_code?: string;
  status: OptionStatus;
  is_recommended: boolean;
  created_at: string;
}

export interface ServicePlanOptionCar {
  id: string;
  option_id: string;
  car_id?: string;
  car_number: string;
  shop_code: string;
  target_month?: string;
  estimated_cost?: number;
  service_options?: ServiceOptionInput[];
}

export interface ServiceOptionInput {
  service_type: string;
  service_category: string;
  description?: string;
  estimated_cost?: number;
}

export interface CreateServicePlanInput {
  customer_code?: string;
  name: string;
  description?: string;
  car_flow_rate: number;
  start_date: string;
  end_date: string;
  fiscal_year: number;
  response_deadline?: string;
  created_by_id?: string;
}

export interface CreateOptionInput {
  option_name: string;
  description?: string;
  is_recommended?: boolean;
}

export interface AddCarToOptionInput {
  car_number: string;
  car_id?: string;
  shop_code: string;
  target_month?: string;
  estimated_cost?: number;
  service_options?: ServiceOptionInput[];
}

export interface ApproveResult {
  plan: ServicePlan;
  created_assignments: number;
  skipped_conflicts: string[];
}

// ============================================================================
// SERVICE PLAN CRUD
// ============================================================================

export async function createServicePlan(input: CreateServicePlanInput): Promise<ServicePlan> {
  const sql = `
    INSERT INTO service_plans (
      customer_code, name, description,
      car_flow_rate, start_date, end_date, fiscal_year,
      response_deadline, created_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const result = await query<ServicePlan>(sql, [
    input.customer_code || null,
    input.name,
    input.description || null,
    input.car_flow_rate,
    input.start_date,
    input.end_date,
    input.fiscal_year,
    input.response_deadline || null,
    input.created_by_id || null,
  ]);

  return normalizePlan(result[0]);
}

export async function getServicePlan(id: string): Promise<ServicePlan | null> {
  const sql = 'SELECT * FROM service_plans WHERE id = $1';
  const result = await query<ServicePlan>(sql, [id]);
  return result[0] ? normalizePlan(result[0]) : null;
}

export async function listServicePlans(filters: {
  customer_code?: string;
  status?: ServicePlanStatus;
  fiscal_year?: number;
  limit?: number;
  offset?: number;
}): Promise<{ plans: ServicePlan[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (filters.customer_code) {
    conditions.push(`customer_code = $${paramIndex++}`);
    params.push(filters.customer_code);
  }

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.fiscal_year) {
    conditions.push(`fiscal_year = $${paramIndex++}`);
    params.push(filters.fiscal_year);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM service_plans ${whereClause}`;
  const countResult = await query<{ total: string }>(countSql, params);
  const total = parseInt(countResult[0]?.total || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const dataSql = `
    SELECT * FROM service_plans
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  const plans = await query<ServicePlan>(dataSql, [...params, limit, offset]);

  return {
    plans: plans.map(normalizePlan),
    total,
  };
}

export async function updateServicePlan(
  id: string,
  input: Partial<CreateServicePlanInput>
): Promise<ServicePlan | null> {
  const sql = `
    UPDATE service_plans SET
      customer_code = COALESCE($1, customer_code),
      name = COALESCE($2, name),
      description = COALESCE($3, description),
      car_flow_rate = COALESCE($4, car_flow_rate),
      start_date = COALESCE($5, start_date),
      end_date = COALESCE($6, end_date),
      fiscal_year = COALESCE($7, fiscal_year),
      response_deadline = COALESCE($8, response_deadline)
    WHERE id = $9
    RETURNING *
  `;

  const result = await query<ServicePlan>(sql, [
    input.customer_code || null,
    input.name || null,
    input.description || null,
    input.car_flow_rate || null,
    input.start_date || null,
    input.end_date || null,
    input.fiscal_year || null,
    input.response_deadline || null,
    id,
  ]);

  return result[0] ? normalizePlan(result[0]) : null;
}

export async function updateServicePlanStatus(
  id: string,
  status: ServicePlanStatus
): Promise<ServicePlan | null> {
  const sql = `
    UPDATE service_plans SET status = $1
    WHERE id = $2
    RETURNING *
  `;
  const result = await query<ServicePlan>(sql, [status, id]);
  return result[0] ? normalizePlan(result[0]) : null;
}

export async function deleteServicePlan(id: string): Promise<boolean> {
  const sql = 'DELETE FROM service_plans WHERE id = $1';
  await query(sql, [id]);
  return true;
}

// ============================================================================
// OPTIONS CRUD
// ============================================================================

export async function createOption(
  planId: string,
  input: CreateOptionInput
): Promise<ServicePlanOption> {
  const sql = `
    INSERT INTO service_plan_options (service_plan_id, option_name, description, is_recommended)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

  const result = await query<ServicePlanOption>(sql, [
    planId,
    input.option_name,
    input.description || null,
    input.is_recommended || false,
  ]);

  return normalizeOption(result[0]);
}

export async function getOption(id: string): Promise<ServicePlanOption | null> {
  const sql = 'SELECT * FROM service_plan_options WHERE id = $1';
  const result = await query<ServicePlanOption>(sql, [id]);
  return result[0] ? normalizeOption(result[0]) : null;
}

export async function listOptions(planId: string): Promise<ServicePlanOption[]> {
  const sql = `
    SELECT * FROM service_plan_options
    WHERE service_plan_id = $1
    ORDER BY option_name
  `;
  const result = await query<ServicePlanOption>(sql, [planId]);
  return result.map(normalizeOption);
}

export async function updateOption(
  id: string,
  input: Partial<CreateOptionInput>
): Promise<ServicePlanOption | null> {
  const sql = `
    UPDATE service_plan_options SET
      option_name = COALESCE($1, option_name),
      description = COALESCE($2, description),
      is_recommended = COALESCE($3, is_recommended)
    WHERE id = $4
    RETURNING *
  `;

  const result = await query<ServicePlanOption>(sql, [
    input.option_name || null,
    input.description || null,
    input.is_recommended ?? null,
    id,
  ]);

  return result[0] ? normalizeOption(result[0]) : null;
}

export async function deleteOption(id: string): Promise<boolean> {
  const sql = 'DELETE FROM service_plan_options WHERE id = $1';
  await query(sql, [id]);
  return true;
}

export async function finalizeOption(id: string): Promise<ServicePlanOption | null> {
  // Recalculate totals
  const statsSql = `
    SELECT
      COUNT(*) as car_count,
      COALESCE(SUM(estimated_cost), 0) as total_cost,
      COALESCE(AVG(estimated_cost), 0) as avg_cost,
      COUNT(DISTINCT shop_code) as shop_count
    FROM service_plan_option_cars
    WHERE option_id = $1
  `;
  const stats = await query<{
    car_count: string;
    total_cost: string;
    avg_cost: string;
    shop_count: string;
  }>(statsSql, [id]);

  const sql = `
    UPDATE service_plan_options SET
      status = 'finalized',
      total_estimated_cost = $1,
      avg_cost_per_car = $2,
      shop_count = $3
    WHERE id = $4
    RETURNING *
  `;

  const result = await query<ServicePlanOption>(sql, [
    parseFloat(stats[0]?.total_cost || '0'),
    parseFloat(stats[0]?.avg_cost || '0'),
    parseInt(stats[0]?.shop_count || '0', 10),
    id,
  ]);

  return result[0] ? normalizeOption(result[0]) : null;
}

// ============================================================================
// OPTION CARS CRUD
// ============================================================================

export async function addCarToOption(
  optionId: string,
  input: AddCarToOptionInput
): Promise<ServicePlanOptionCar> {
  const sql = `
    INSERT INTO service_plan_option_cars (
      option_id, car_id, car_number, shop_code, target_month, estimated_cost, service_options
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const result = await query<ServicePlanOptionCar>(sql, [
    optionId,
    input.car_id || null,
    input.car_number,
    input.shop_code,
    input.target_month || null,
    input.estimated_cost || null,
    JSON.stringify(input.service_options || []),
  ]);

  return normalizeOptionCar(result[0]);
}

export async function listOptionCars(optionId: string): Promise<ServicePlanOptionCar[]> {
  const sql = `
    SELECT * FROM service_plan_option_cars
    WHERE option_id = $1
    ORDER BY car_number
  `;
  const result = await query<ServicePlanOptionCar>(sql, [optionId]);
  return result.map(normalizeOptionCar);
}

export async function removeCarFromOption(id: string): Promise<boolean> {
  const sql = 'DELETE FROM service_plan_option_cars WHERE id = $1';
  await query(sql, [id]);
  return true;
}

export async function clearOptionCars(optionId: string): Promise<boolean> {
  const sql = 'DELETE FROM service_plan_option_cars WHERE option_id = $1';
  await query(sql, [optionId]);
  return true;
}

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

/**
 * Approve a service plan option and create assignments in the SSOT
 */
export async function approveServicePlan(
  planId: string,
  optionId: string,
  approvedBy: string,
  notes?: string
): Promise<ApproveResult> {
  // Get the plan and verify status
  const plan = await getServicePlan(planId);
  if (!plan) {
    throw new Error(`Service plan ${planId} not found`);
  }

  if (plan.status === 'approved') {
    throw new Error('Service plan already approved');
  }

  // Get the option
  const option = await getOption(optionId);
  if (!option) {
    throw new Error(`Option ${optionId} not found`);
  }

  if (option.service_plan_id !== planId) {
    throw new Error('Option does not belong to this plan');
  }

  // Get all cars in the option
  const cars = await listOptionCars(optionId);

  const createdAssignments: string[] = [];
  const skippedConflicts: string[] = [];

  // Create assignments for each car
  for (const car of cars) {
    // Check for conflicts
    const conflict = await checkConflicts(car.car_number);

    if (conflict) {
      skippedConflicts.push(car.car_number);
      continue;
    }

    try {
      await createAssignment({
        car_number: car.car_number,
        shop_code: car.shop_code,
        target_month: car.target_month || plan.start_date.slice(0, 7),
        estimated_cost: car.estimated_cost,
        source: 'service_plan',
        source_reference_id: optionId,
        source_reference_type: 'service_plan_options',
      });
      createdAssignments.push(car.car_number);
    } catch {
      skippedConflicts.push(car.car_number);
    }
  }

  // Update the plan status
  const updateSql = `
    UPDATE service_plans SET
      status = 'approved',
      approved_option_id = $1,
      approved_at = NOW(),
      approved_by = $2,
      approval_notes = $3
    WHERE id = $4
    RETURNING *
  `;

  const updatedPlan = await query<ServicePlan>(updateSql, [
    optionId,
    approvedBy,
    notes || null,
    planId,
  ]);

  // Mark the selected option
  await query(`UPDATE service_plan_options SET status = 'selected' WHERE id = $1`, [optionId]);

  // Mark other options as rejected
  await query(
    `UPDATE service_plan_options SET status = 'rejected' WHERE service_plan_id = $1 AND id != $2`,
    [planId, optionId]
  );

  return {
    plan: normalizePlan(updatedPlan[0]),
    created_assignments: createdAssignments.length,
    skipped_conflicts: skippedConflicts,
  };
}

/**
 * Reject a service plan
 */
export async function rejectServicePlan(planId: string, reason?: string): Promise<ServicePlan> {
  const sql = `
    UPDATE service_plans SET
      status = 'rejected',
      approval_notes = $1
    WHERE id = $2
    RETURNING *
  `;

  const result = await query<ServicePlan>(sql, [reason || null, planId]);
  if (!result[0]) {
    throw new Error(`Service plan ${planId} not found`);
  }

  return normalizePlan(result[0]);
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizePlan(row: ServicePlan): ServicePlan {
  return {
    ...row,
    car_flow_rate: Number(row.car_flow_rate),
  };
}

function normalizeOption(row: ServicePlanOption): ServicePlanOption {
  return {
    ...row,
    total_estimated_cost: row.total_estimated_cost ? Number(row.total_estimated_cost) : undefined,
    avg_cost_per_car: row.avg_cost_per_car ? Number(row.avg_cost_per_car) : undefined,
    avg_turn_time: row.avg_turn_time ? Number(row.avg_turn_time) : undefined,
    shop_count: row.shop_count ? Number(row.shop_count) : undefined,
    is_recommended: Boolean(row.is_recommended),
  };
}

function normalizeOptionCar(row: ServicePlanOptionCar): ServicePlanOptionCar {
  return {
    ...row,
    estimated_cost: row.estimated_cost ? Number(row.estimated_cost) : undefined,
    service_options:
      typeof row.service_options === 'string'
        ? JSON.parse(row.service_options)
        : row.service_options || [],
  };
}

export default {
  createServicePlan,
  getServicePlan,
  listServicePlans,
  updateServicePlan,
  updateServicePlanStatus,
  deleteServicePlan,
  createOption,
  getOption,
  listOptions,
  updateOption,
  deleteOption,
  finalizeOption,
  addCarToOption,
  listOptionCars,
  removeCarFromOption,
  clearOptionCars,
  approveServicePlan,
  rejectServicePlan,
};
