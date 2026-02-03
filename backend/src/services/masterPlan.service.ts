import { query, queryOne } from '../config/database';

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
