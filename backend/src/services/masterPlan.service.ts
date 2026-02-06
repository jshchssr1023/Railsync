import { query, queryOne } from '../config/database';
import { Allocation } from '../types';
import * as planningService from './planning.service';
import * as assetEventService from './assetEvent.service';
import * as demandService from './demand.service';

export interface MasterPlan {
  id: string;
  name: string;
  description?: string;
  fiscal_year: number;
  planning_month: string;
  status: 'draft' | 'active' | 'archived';
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  version_count?: number;
  latest_version?: number;
  current_allocation_count?: number;
  current_estimated_cost?: number;
}

export interface PlanVersion {
  id: string;
  plan_id: string;
  version_number: number;
  label?: string;
  notes?: string;
  snapshot_data: object;
  allocation_count: number;
  total_estimated_cost: number;
  created_by?: string;
  created_at: Date;
  allocation_delta?: number;
  cost_delta?: number;
}

export interface CreatePlanInput {
  name: string;
  description?: string;
  fiscal_year: number;
  planning_month: string;
  created_by?: string;
}

// List all master plans with summary
export async function listMasterPlans(filters?: {
  fiscal_year?: number;
  status?: string;
}): Promise<MasterPlan[]> {
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;

  if (filters?.fiscal_year) {
    conditions.push(`fiscal_year = $${idx++}`);
    values.push(filters.fiscal_year);
  }
  if (filters?.status) {
    conditions.push(`status = $${idx++}`);
    values.push(filters.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return query<MasterPlan>(
    `SELECT * FROM v_master_plan_summary ${where} ORDER BY fiscal_year DESC, planning_month DESC`,
    values
  );
}

// Get single master plan with details
export async function getMasterPlan(id: string): Promise<MasterPlan | null> {
  return queryOne<MasterPlan>(
    `SELECT * FROM v_master_plan_summary WHERE id = $1`,
    [id]
  );
}

// Create new master plan
export async function createMasterPlan(input: CreatePlanInput): Promise<MasterPlan> {
  const { name, description, fiscal_year, planning_month, created_by } = input;

  const rows = await query<MasterPlan>(
    `INSERT INTO master_plans (name, description, fiscal_year, planning_month, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, description || null, fiscal_year, planning_month, created_by || null]
  );

  return rows[0];
}

// Update master plan
export async function updateMasterPlan(
  id: string,
  updates: Partial<Pick<MasterPlan, 'name' | 'description' | 'status'>>
): Promise<MasterPlan | null> {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(updates.description);
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(updates.status);
  }

  if (fields.length === 0) return getMasterPlan(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const rows = await query<MasterPlan>(
    `UPDATE master_plans SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  return rows[0] || null;
}

// Delete master plan
export async function deleteMasterPlan(id: string): Promise<boolean> {
  await query('DELETE FROM master_plans WHERE id = $1', [id]);
  return true;
}

// List versions for a plan
export async function listPlanVersions(planId: string): Promise<PlanVersion[]> {
  return query<PlanVersion>(
    `SELECT * FROM v_plan_version_comparison WHERE plan_id = $1 ORDER BY version_number DESC`,
    [planId]
  );
}

// Get single version
export async function getPlanVersion(versionId: string): Promise<PlanVersion | null> {
  return queryOne<PlanVersion>(
    `SELECT * FROM master_plan_versions WHERE id = $1`,
    [versionId]
  );
}

// Create new version snapshot
export async function createVersionSnapshot(
  planId: string,
  label?: string,
  notes?: string,
  createdBy?: string
): Promise<PlanVersion | null> {
  const result = await queryOne<{ create_plan_version_snapshot: string }>(
    `SELECT create_plan_version_snapshot($1, $2, $3, $4)`,
    [planId, label || null, notes || null, createdBy || null]
  );

  if (!result) return null;

  return getPlanVersion(result.create_plan_version_snapshot);
}

// Compare two versions
interface AllocationSnapshot {
  id: string;
  version?: number;
  [key: string]: unknown;
}

export async function compareVersions(
  versionId1: string,
  versionId2: string
): Promise<{
  version1: PlanVersion;
  version2: PlanVersion;
  added: AllocationSnapshot[];
  removed: AllocationSnapshot[];
  changed: AllocationSnapshot[];
}> {
  const [v1, v2] = await Promise.all([
    getPlanVersion(versionId1),
    getPlanVersion(versionId2),
  ]);

  if (!v1 || !v2) {
    throw new Error('One or both versions not found');
  }

  const snap1 = (v1.snapshot_data as AllocationSnapshot[]) || [];
  const snap2 = (v2.snapshot_data as AllocationSnapshot[]) || [];

  const map1 = new Map(snap1.map(a => [a.id, a]));
  const map2 = new Map(snap2.map(a => [a.id, a]));

  const added = snap2.filter(a => !map1.has(a.id));
  const removed = snap1.filter(a => !map2.has(a.id));
  const changed = snap2.filter(a => {
    const prev = map1.get(a.id);
    return prev && prev.version !== a.version;
  });

  return { version1: v1, version2: v2, added, removed, changed };
}

// Get allocations for a specific version
export async function getVersionAllocations(versionId: string): Promise<object[]> {
  const rows = await query<{ allocation_snapshot: object }>(
    `SELECT allocation_snapshot FROM master_plan_allocations WHERE version_id = $1`,
    [versionId]
  );
  return rows.map(r => r.allocation_snapshot);
}

// ============================================================================
// PLAN ALLOCATION MANAGEMENT
// ============================================================================

export interface PlanAllocationFilters {
  status?: string;
  shop_code?: string;
  unassigned?: boolean;
}

export interface PlanStats {
  total_allocations: number;
  assigned: number;
  unassigned: number;
  total_estimated_cost: number;
  planned_cost: number;
  committed_cost: number;
  by_status: { status: string; count: number; cost: number }[];
  by_shop: { shop_code: string; shop_name: string; count: number; cost: number }[];
}

// List allocations belonging to a plan
export async function listPlanAllocations(
  planId: string,
  filters?: PlanAllocationFilters
): Promise<Allocation[]> {
  const conditions: string[] = ['a.plan_id = $1'];
  const values: (string | boolean)[] = [planId];
  let idx = 2;

  if (filters?.status) {
    conditions.push(`a.status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters?.shop_code) {
    conditions.push(`a.shop_code = $${idx++}`);
    values.push(filters.shop_code);
  }
  if (filters?.unassigned) {
    conditions.push(`a.shop_code IS NULL`);
  }

  return query<Allocation>(
    `SELECT a.*, c.car_mark, c.car_type, c.lessee_name, c.lessee_code, c.contract_number,
            s.shop_name
     FROM allocations a
     LEFT JOIN cars c ON a.car_number = c.car_number
     LEFT JOIN shops s ON a.shop_code = s.shop_code
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.created_at DESC`,
    values
  );
}

// Add cars to a plan (creates allocations with no shop assigned)
export async function addCarsToPlan(
  planId: string,
  carNumbers: string[],
  targetMonth: string,
  createdBy: string
): Promise<{ added: number; skipped: number; errors: string[] }> {
  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const carNumber of carNumbers) {
    // Check for duplicates
    const existing = await queryOne(
      `SELECT id FROM allocations
       WHERE plan_id = $1 AND car_number = $2 AND status NOT IN ('cancelled', 'Released')`,
      [planId, carNumber]
    );

    if (existing) {
      skipped++;
      continue;
    }

    // Look up the car
    const car = await queryOne<{ car_number: string; id: string }>(
      `SELECT car_number, id FROM cars WHERE car_number = $1 AND is_active = TRUE`,
      [carNumber]
    );

    if (!car) {
      errors.push(`Car ${carNumber} not found or inactive`);
      continue;
    }

    await query(
      `INSERT INTO allocations (car_mark_number, car_number, car_id, plan_id, target_month, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'Need Shopping', $6)`,
      [car.car_number, car.car_number, car.id, planId, targetMonth, createdBy]
    );

    // Record asset event
    assetEventService.recordEvent(car.id, 'plan.added', {
      plan_id: planId,
    }, {
      sourceTable: 'allocations',
      performedBy: createdBy,
    }).catch(() => {}); // non-blocking

    added++;
  }

  return { added, skipped, errors };
}

// Import from demands — generate allocations and stamp plan_id
export async function importFromDemands(
  planId: string,
  demandIds: string[],
  scenarioId?: string,
  createdBy?: string
): Promise<{ imported: number; warnings: string[] }> {
  // Use existing generateAllocations engine
  const result = await planningService.generateAllocations(
    { demand_ids: demandIds, scenario_id: scenarioId, preview_only: false },
    createdBy
  );

  // Stamp plan_id on all generated allocations
  if (result.allocations && result.allocations.length > 0) {
    const ids = result.allocations.map(a => a.id);
    await query(
      `UPDATE allocations SET plan_id = $1 WHERE id = ANY($2)`,
      [planId, ids]
    );
  }

  return {
    imported: result.summary.total_cars,
    warnings: result.warnings,
  };
}

// Remove allocation from plan (detach, don't delete)
export async function removeAllocationFromPlan(
  planId: string,
  allocationId: string
): Promise<boolean> {
  // Get car_id before removing
  const alloc = await queryOne<{ car_id: string }>('SELECT car_id FROM allocations WHERE id = $1', [allocationId]);

  const result = await query(
    `UPDATE allocations SET plan_id = NULL, updated_at = NOW()
     WHERE id = $1 AND plan_id = $2
     RETURNING id`,
    [allocationId, planId]
  );

  if (result.length > 0 && alloc?.car_id) {
    assetEventService.recordEvent(alloc.car_id, 'plan.removed', {
      plan_id: planId,
      allocation_id: allocationId,
    }, {
      sourceTable: 'allocations',
      sourceId: allocationId,
    }).catch(() => {}); // non-blocking
  }

  return result.length > 0;
}

// Assign a shop to a plan allocation (delegates to planning service)
export async function assignShopToAllocation(
  allocationId: string,
  shopCode: string,
  targetMonth: string,
  expectedVersion?: number
): Promise<{ allocation: Allocation | null; error?: string }> {
  return planningService.assignAllocation(allocationId, shopCode, targetMonth, expectedVersion);
}

// Get aggregate stats for a plan
export async function getPlanStats(planId: string): Promise<PlanStats> {
  const totals = await queryOne<{
    total_allocations: string;
    assigned: string;
    unassigned: string;
    total_estimated_cost: string;
    planned_cost: string;
    committed_cost: string;
  }>(
    `SELECT
       COUNT(*) AS total_allocations,
       COUNT(*) FILTER (WHERE shop_code IS NOT NULL) AS assigned,
       COUNT(*) FILTER (WHERE shop_code IS NULL) AS unassigned,
       COALESCE(SUM(estimated_cost), 0) AS total_estimated_cost,
       COALESCE(SUM(estimated_cost) FILTER (WHERE shop_code IS NULL), 0) AS planned_cost,
       COALESCE(SUM(COALESCE(actual_cost, estimated_cost)) FILTER (WHERE shop_code IS NOT NULL), 0) AS committed_cost
     FROM allocations
     WHERE plan_id = $1 AND status NOT IN ('cancelled', 'Released')`,
    [planId]
  );

  const byStatus = await query<{ status: string; count: string; cost: string }>(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(estimated_cost), 0) AS cost
     FROM allocations
     WHERE plan_id = $1 AND status NOT IN ('cancelled', 'Released')
     GROUP BY status
     ORDER BY
       CASE status
         WHEN 'Need Shopping' THEN 1
         WHEN 'To Be Routed' THEN 2
         WHEN 'Planned Shopping' THEN 3
         WHEN 'Enroute' THEN 4
         WHEN 'Arrived' THEN 5
         WHEN 'Complete' THEN 6
       END`,
    [planId]
  );

  const byShop = await query<{ shop_code: string; shop_name: string; count: string; cost: string }>(
    `SELECT a.shop_code, COALESCE(s.shop_name, 'Unassigned') AS shop_name,
            COUNT(*) AS count, COALESCE(SUM(a.estimated_cost), 0) AS cost
     FROM allocations a
     LEFT JOIN shops s ON a.shop_code = s.shop_code
     WHERE a.plan_id = $1 AND a.status NOT IN ('cancelled', 'Released')
     GROUP BY a.shop_code, s.shop_name
     ORDER BY COUNT(*) DESC`,
    [planId]
  );

  return {
    total_allocations: parseInt(totals?.total_allocations || '0'),
    assigned: parseInt(totals?.assigned || '0'),
    unassigned: parseInt(totals?.unassigned || '0'),
    total_estimated_cost: parseFloat(totals?.total_estimated_cost || '0'),
    planned_cost: parseFloat(totals?.planned_cost || '0'),
    committed_cost: parseFloat(totals?.committed_cost || '0'),
    by_status: byStatus.map(r => ({
      status: r.status,
      count: parseInt(r.count),
      cost: parseFloat(r.cost),
    })),
    by_shop: byShop.map(r => ({
      shop_code: r.shop_code || 'unassigned',
      shop_name: r.shop_name,
      count: parseInt(r.count),
      cost: parseFloat(r.cost),
    })),
  };
}

// ============================================================================
// PLAN DEMAND MANAGEMENT
// ============================================================================

// List demands belonging to a plan
export async function listPlanDemands(planId: string) {
  return demandService.listDemands({ plan_id: planId, limit: 100 });
}

// Create a demand within a plan context
export async function createDemandForPlan(
  planId: string,
  data: {
    name: string;
    description?: string;
    target_month?: string;
    car_count: number;
    event_type: string;
    car_type?: string;
    default_lessee_code?: string;
    priority?: string;
    required_network?: string;
    required_region?: string;
    max_cost_per_car?: number;
  },
  userId?: string
) {
  // Get plan context for defaults
  const plan = await getMasterPlan(planId);
  if (!plan) throw new Error('Master plan not found');

  return demandService.createDemand(
    {
      ...data,
      fiscal_year: plan.fiscal_year,
      target_month: data.target_month || plan.planning_month,
      event_type: data.event_type as any,
      priority: (data.priority as any) || 'Medium',
      plan_id: planId,
    },
    userId
  );
}

// Search cars for typeahead
export async function searchCars(
  searchQuery: string,
  limit: number = 20
): Promise<{ car_number: string; car_mark: string; car_type: string; lessee_name: string }[]> {
  return query(
    `SELECT car_number, car_mark, car_type, lessee_name
     FROM cars
     WHERE is_active = TRUE AND car_number ILIKE $1
     ORDER BY car_number
     LIMIT $2`,
    [`${searchQuery}%`, limit]
  );
}
