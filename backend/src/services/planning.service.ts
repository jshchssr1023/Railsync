import { query, queryOne } from '../config/database';
import {
  Allocation,
  AllocationStatus,
  Scenario,
  ScenarioWeights,
  ShopMonthlyCapacity,
  EvaluationResult,
  DirectCarInput,
} from '../types';
import { evaluateShops } from './evaluation.service';
import { getDemandById, updateDemandStatus } from './demand.service';
import * as assignmentService from './assignment.service';

// ============================================================================
// SHOP MONTHLY CAPACITY
// ============================================================================

/**
 * Get shop capacity for a date range
 */
export async function getShopCapacity(
  startMonth: string,
  endMonth: string,
  network?: string
): Promise<ShopMonthlyCapacity[]> {
  let sql = `
    SELECT
      smc.*,
      (smc.total_capacity - smc.allocated_count) as available_capacity,
      CASE WHEN smc.total_capacity > 0
        THEN (smc.allocated_count::decimal / smc.total_capacity) * 100
        ELSE 0
      END as utilization_pct
    FROM shop_monthly_capacity smc
    JOIN shops s ON smc.shop_code = s.shop_code
    WHERE smc.month >= $1 AND smc.month <= $2
  `;

  const params: any[] = [startMonth, endMonth];

  if (network) {
    sql += ` AND s.is_preferred_network = $3`;
    params.push(network === 'AITX' || network === 'Primary');
  }

  sql += ' ORDER BY smc.shop_code, smc.month';

  const rows = await query<ShopMonthlyCapacity>(sql, params);

  // Convert string numeric fields to numbers (PostgreSQL returns DECIMAL as strings)
  return rows.map(row => ({
    ...row,
    total_capacity: Number(row.total_capacity) || 0,
    allocated_count: Number(row.allocated_count) || 0,
    completed_count: Number(row.completed_count) || 0,
    available_capacity: Number(row.available_capacity) || 0,
    utilization_pct: Number(row.utilization_pct) || 0,
    // Convert extra fields if present (from database but not in type)
    ...(('confirmed_railcars' in row) && { confirmed_railcars: Number((row as any).confirmed_railcars) || 0 }),
    ...(('planned_railcars' in row) && { planned_railcars: Number((row as any).planned_railcars) || 0 }),
  }));
}

/**
 * Update shop capacity for a month
 */
export async function updateShopCapacity(
  shopCode: string,
  month: string,
  data: {
    total_capacity?: number;
    allocated_count?: number;
    completed_count?: number;
  }
): Promise<ShopMonthlyCapacity> {
  const sql = `
    INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity, allocated_count, completed_count)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (shop_code, month) DO UPDATE SET
      total_capacity = COALESCE($3, shop_monthly_capacity.total_capacity),
      allocated_count = COALESCE($4, shop_monthly_capacity.allocated_count),
      completed_count = COALESCE($5, shop_monthly_capacity.completed_count),
      updated_at = NOW()
    RETURNING *,
      (total_capacity - allocated_count) as available_capacity,
      CASE WHEN total_capacity > 0
        THEN (allocated_count::decimal / total_capacity) * 100
        ELSE 0
      END as utilization_pct
  `;

  const rows = await query<ShopMonthlyCapacity>(sql, [
    shopCode,
    month,
    data.total_capacity || 0,
    data.allocated_count || 0,
    data.completed_count || 0,
  ]);

  return rows[0];
}

/**
 * Initialize capacity for all shops for next 18 months
 */
export async function initializeCapacity(
  defaultCapacity: number = 20
): Promise<number> {
  // Get all active shops
  const shops = await query<{ shop_code: string }>('SELECT shop_code FROM shops WHERE is_active = TRUE');

  // Generate next 18 months
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
  }

  let count = 0;
  for (const shop of shops) {
    for (const month of months) {
      await updateShopCapacity(shop.shop_code, month, { total_capacity: defaultCapacity });
      count++;
    }
  }

  return count;
}

// ============================================================================
// SCENARIOS
// ============================================================================

/**
 * List all scenarios
 */
export async function listScenarios(): Promise<Scenario[]> {
  return query<Scenario>('SELECT * FROM scenarios ORDER BY is_default DESC, name');
}

/**
 * Get scenario by ID
 */
export async function getScenarioById(id: string): Promise<Scenario | null> {
  return queryOne<Scenario>('SELECT * FROM scenarios WHERE id = $1', [id]);
}

/**
 * Get default scenario
 */
export async function getDefaultScenario(): Promise<Scenario | null> {
  return queryOne<Scenario>('SELECT * FROM scenarios WHERE is_default = TRUE LIMIT 1');
}

/**
 * Create a scenario
 */
export async function createScenario(
  data: {
    name: string;
    description?: string;
    weights: ScenarioWeights;
    constraints?: Record<string, any>;
  },
  userId?: string
): Promise<Scenario> {
  const sql = `
    INSERT INTO scenarios (name, description, weights, constraints, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  const rows = await query<Scenario>(sql, [
    data.name,
    data.description,
    JSON.stringify(data.weights),
    JSON.stringify(data.constraints || {}),
    userId,
  ]);

  return rows[0];
}

/**
 * Update a scenario
 */
export async function updateScenario(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    weights: ScenarioWeights;
    constraints: Record<string, any>;
    is_default: boolean;
  }>
): Promise<Scenario | null> {
  // If setting as default, unset other defaults first
  if (data.is_default) {
    await query('UPDATE scenarios SET is_default = FALSE WHERE is_default = TRUE');
  }

  const updates: string[] = [];
  const params: any[] = [id];
  let paramIndex = 2;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    params.push(data.description);
  }
  if (data.weights !== undefined) {
    updates.push(`weights = $${paramIndex++}`);
    params.push(JSON.stringify(data.weights));
  }
  if (data.constraints !== undefined) {
    updates.push(`constraints = $${paramIndex++}`);
    params.push(JSON.stringify(data.constraints));
  }
  if (data.is_default !== undefined) {
    updates.push(`is_default = $${paramIndex++}`);
    params.push(data.is_default);
  }

  if (updates.length === 0) return getScenarioById(id);

  updates.push('updated_at = NOW()');

  const sql = `UPDATE scenarios SET ${updates.join(', ')} WHERE id = $1 AND is_system = FALSE RETURNING *`;
  const rows = await query<Scenario>(sql, params);
  return rows[0] || null;
}

/**
 * Delete a scenario (non-system only)
 */
export async function deleteScenario(id: string): Promise<boolean> {
  await query('DELETE FROM scenarios WHERE id = $1 AND is_system = FALSE', [id]);
  return true;
}

// ============================================================================
// ALLOCATIONS
// ============================================================================

/**
 * List allocations with filters
 */
export async function listAllocations(filters: {
  demand_id?: string;
  shop_code?: string;
  target_month?: string;
  status?: AllocationStatus;
  limit?: number;
  offset?: number;
}): Promise<{ allocations: Allocation[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.demand_id) {
    conditions.push(`demand_id = $${paramIndex++}`);
    params.push(filters.demand_id);
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
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM allocations ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const allocations = await query<Allocation>(
    `SELECT * FROM allocations ${whereClause}
     ORDER BY target_month, shop_code
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return { allocations, total };
}

/**
 * Update allocation status
 */
export async function updateAllocationStatus(
  id: string,
  status: AllocationStatus
): Promise<Allocation | null> {
  const sql = `
    UPDATE allocations SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const rows = await query<Allocation>(sql, [id, status]);

  // Update capacity counts if status changed to Complete
  if (rows[0] && status === 'Complete') {
    await query(
      `UPDATE shop_monthly_capacity SET
        allocated_count = allocated_count - 1,
        completed_count = completed_count + 1,
        updated_at = NOW()
      WHERE shop_code = $1 AND month = $2`,
      [rows[0].shop_code, rows[0].target_month]
    );
  }

  return rows[0] || null;
}

/**
 * Create a new allocation with capacity check
 */
export async function createAllocation(input: {
  car_id: string;
  car_number?: string;
  shop_code: string;
  target_month: string;
  status: 'planned' | 'confirmed';
  estimated_cost?: number;
  estimated_cost_breakdown?: Record<string, number>;
  service_event_id?: string;
  notes?: string;
  created_by?: string;
}): Promise<Allocation> {
  const {
    car_id,
    car_number,
    shop_code,
    target_month,
    status,
    estimated_cost,
    estimated_cost_breakdown,
    service_event_id,
    notes,
    created_by,
  } = input;

  // Check capacity if confirming
  if (status === 'confirmed') {
    const capacityRows = await query<{ remaining: number }>(
      `SELECT (total_capacity - allocated_count) as remaining
       FROM shop_monthly_capacity
       WHERE shop_code = $1 AND month = $2`,
      [shop_code, target_month]
    );

    if (capacityRows.length > 0 && capacityRows[0].remaining <= 0) {
      // Check overcommit limit (10%)
      const limitRow = await queryOne<{ total_capacity: number; allocated_count: number }>(
        `SELECT total_capacity, allocated_count FROM shop_monthly_capacity WHERE shop_code = $1 AND month = $2`,
        [shop_code, target_month]
      );

      if (limitRow) {
        const overcommitLimit = Math.ceil(limitRow.total_capacity * 0.1);
        const overcommit = limitRow.allocated_count - limitRow.total_capacity;
        if (overcommit >= overcommitLimit) {
          throw new Error(`Shop ${shop_code} is at capacity for ${target_month}. Cannot confirm allocation.`);
        }
      }
    }
  }

  // Insert allocation
  const rows = await query<Allocation>(
    `INSERT INTO allocations (
      car_id, car_number, shop_code, target_month, status,
      estimated_cost, estimated_cost_breakdown, service_event_id,
      notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      car_id,
      car_number || null,
      shop_code,
      target_month,
      status,
      estimated_cost || null,
      estimated_cost_breakdown ? JSON.stringify(estimated_cost_breakdown) : null,
      service_event_id || null,
      notes || null,
      created_by || null,
    ]
  );

  // SSOT: Also write to car_assignments if car_number is provided
  if (car_number) {
    try {
      const existing = await assignmentService.getActiveAssignment(car_number);
      if (!existing) {
        await assignmentService.createAssignment({
          car_number,
          shop_code,
          target_month,
          estimated_cost,
          source: 'demand_plan',
          source_reference_id: rows[0].id,
          source_reference_type: 'allocation',
          created_by_id: created_by,
        });
      }
    } catch (err) {
      console.warn('SSOT write failed (non-blocking):', err);
    }
  }

  // Update capacity count
  if (status === 'confirmed') {
    await query(
      `INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity, allocated_count)
       VALUES ($1, $2, 50, 1)
       ON CONFLICT (shop_code, month) DO UPDATE SET
         allocated_count = shop_monthly_capacity.allocated_count + 1,
         updated_at = NOW()`,
      [shop_code, target_month]
    );
  }

  return rows[0];
}

/**
 * Get capacity for a shop for multiple months
 */
export async function getShopCapacityRange(
  shopCode: string,
  months: number = 3
): Promise<ShopMonthlyCapacity[]> {
  // Generate month strings
  const now = new Date();
  const monthsList: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthsList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Ensure all months exist
  for (const month of monthsList) {
    await query(
      `INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity)
       VALUES ($1, $2, 50)
       ON CONFLICT (shop_code, month) DO NOTHING`,
      [shopCode, month]
    );
  }

  // Return capacity data
  const rows = await query<ShopMonthlyCapacity>(
    `SELECT *,
       (total_capacity - allocated_count) as available_capacity,
       CASE WHEN total_capacity > 0
         THEN (allocated_count::decimal / total_capacity) * 100
         ELSE 0
       END as utilization_pct,
       (allocated_count >= total_capacity * 0.9) as is_at_risk
     FROM shop_monthly_capacity
     WHERE shop_code = $1 AND month = ANY($2)
     ORDER BY month`,
    [shopCode, monthsList]
  );

  // Convert string numeric fields to numbers
  return rows.map(row => ({
    ...row,
    total_capacity: Number(row.total_capacity) || 0,
    allocated_count: Number(row.allocated_count) || 0,
    completed_count: Number(row.completed_count) || 0,
    available_capacity: Number(row.available_capacity) || 0,
    utilization_pct: Number(row.utilization_pct) || 0,
    ...(('confirmed_railcars' in row) && { confirmed_railcars: Number((row as any).confirmed_railcars) || 0 }),
    ...(('planned_railcars' in row) && { planned_railcars: Number((row as any).planned_railcars) || 0 }),
  }));
}

// ============================================================================
// ALLOCATION ENGINE
// ============================================================================

interface AllocationRequest {
  demand_ids: string[];
  scenario_id?: string;
  preview_only?: boolean;
}

interface AllocationSummary {
  allocations: Allocation[];
  summary: {
    total_cars: number;
    total_cost: number;
    avg_cost_per_car: number;
    by_network: { network: string; count: number; cost: number }[];
    unallocated_cars: number;
  };
  warnings: string[];
}

/**
 * Generate allocations for demands using the existing shop evaluation engine
 */
export async function generateAllocations(
  request: AllocationRequest,
  userId?: string
): Promise<AllocationSummary> {
  const allocations: Partial<Allocation>[] = [];
  const warnings: string[] = [];

  // Get scenario
  let scenario: Scenario | null = null;
  if (request.scenario_id) {
    scenario = await getScenarioById(request.scenario_id);
  }
  if (!scenario) {
    scenario = await getDefaultScenario();
  }

  // Load capacity map
  const capacityMap = new Map<string, number>();
  const now = new Date();
  const startMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const endYear = now.getFullYear() + 2;
  const endMonth = `${endYear}-12`;

  const capacityRows = await getShopCapacity(startMonth, endMonth);
  for (const row of capacityRows) {
    const key = `${row.shop_code}:${row.month}`;
    capacityMap.set(key, row.total_capacity - row.allocated_count);
  }

  let totalUnallocated = 0;

  // Process each demand
  for (const demandId of request.demand_ids) {
    const demand = await getDemandById(demandId);
    if (!demand) {
      warnings.push(`Demand ${demandId} not found`);
      continue;
    }

    // Build car input from demand defaults
    const carInput: DirectCarInput = {
      product_code: demand.car_type || 'TANK',
      material_type: (demand.default_material_type as any) || 'Carbon Steel',
      lining_type: demand.default_lining_type,
      commodity_cin: demand.default_commodity,
    };

    // Call existing evaluation engine with EvaluationRequest
    const shopResults = await evaluateShops({
      car_input: carInput,
      overrides: {},
      origin_region: demand.required_region,
    });

    // Filter eligible shops with capacity
    const eligibleShops = shopResults
      .filter((s) => s.is_eligible)
      .filter((s) => {
        const key = `${s.shop.shop_code}:${demand.target_month}`;
        return (capacityMap.get(key) || 0) > 0;
      });

    if (eligibleShops.length === 0) {
      warnings.push(`No eligible shops with capacity for "${demand.name}"`);
      totalUnallocated += demand.car_count;
      continue;
    }

    // Apply scenario weights to rank shops
    const rankedShops = applyScenarioWeights(eligibleShops, scenario?.weights);

    // Distribute cars to shops
    let remainingCars = demand.car_count;

    for (const shopResult of rankedShops) {
      if (remainingCars <= 0) break;

      const key = `${shopResult.shop.shop_code}:${demand.target_month}`;
      const available = capacityMap.get(key) || 0;
      const toAllocate = Math.min(remainingCars, available);

      if (toAllocate > 0) {
        // Create allocation records
        for (let i = 0; i < toAllocate; i++) {
          allocations.push({
            demand_id: demand.id,
            scenario_id: scenario?.id,
            car_id: `${demand.name.substring(0, 10)}-${allocations.length + 1}`,
            shop_code: shopResult.shop.shop_code,
            target_month: demand.target_month,
            estimated_cost: shopResult.cost_breakdown.total_cost,
            estimated_cost_breakdown: shopResult.cost_breakdown,
            status: 'Planned Shopping',
            created_by: userId,
          });
        }

        // Decrement capacity in our local map
        capacityMap.set(key, available - toAllocate);
        remainingCars -= toAllocate;
      }
    }

    if (remainingCars > 0) {
      warnings.push(`${remainingCars} cars unallocated for "${demand.name}"`);
      totalUnallocated += remainingCars;
    }
  }

  // Calculate summary
  const totalCars = allocations.length;
  const totalCost = allocations.reduce((sum, a) => sum + (a.estimated_cost || 0), 0);

  // Group by network
  const byNetwork = new Map<string, { count: number; cost: number }>();
  for (const alloc of allocations) {
    const shopInfo = await queryOne<{ is_preferred_network: boolean }>(
      'SELECT is_preferred_network FROM shops WHERE shop_code = $1',
      [alloc.shop_code]
    );
    const network = shopInfo?.is_preferred_network ? 'AITX' : 'External';
    const existing = byNetwork.get(network) || { count: 0, cost: 0 };
    existing.count++;
    existing.cost += alloc.estimated_cost || 0;
    byNetwork.set(network, existing);
  }

  // Save allocations if not preview
  if (!request.preview_only && allocations.length > 0) {
    for (const alloc of allocations) {
      const allocResult = await query(
        `INSERT INTO allocations (
          demand_id, scenario_id, car_id, shop_code, target_month,
          estimated_cost, estimated_cost_breakdown, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          alloc.demand_id,
          alloc.scenario_id,
          alloc.car_id,
          alloc.shop_code,
          alloc.target_month,
          alloc.estimated_cost,
          JSON.stringify(alloc.estimated_cost_breakdown),
          alloc.status,
          alloc.created_by,
        ]
      );

      // SSOT: Also write to car_assignments if car_number, shop_code, and target_month are provided
      if (alloc.car_number && alloc.shop_code && alloc.target_month) {
        try {
          const existing = await assignmentService.getActiveAssignment(alloc.car_number);
          if (!existing) {
            await assignmentService.createAssignment({
              car_number: alloc.car_number,
              shop_code: alloc.shop_code,
              target_month: alloc.target_month,
              estimated_cost: alloc.estimated_cost,
              source: 'scenario_export',
              source_reference_id: allocResult[0]?.id,
              source_reference_type: 'allocation',
              created_by_id: alloc.created_by,
            });
          }
        } catch (err) {
          console.warn('SSOT write failed (non-blocking):', err);
        }
      }

      // Update capacity table
      await query(
        `UPDATE shop_monthly_capacity SET
          allocated_count = allocated_count + 1,
          updated_at = NOW()
        WHERE shop_code = $1 AND month = $2`,
        [alloc.shop_code, alloc.target_month]
      );
    }

    // Update demand statuses
    for (const demandId of request.demand_ids) {
      await updateDemandStatus(demandId, 'Allocated');
    }
  }

  return {
    allocations: allocations as Allocation[],
    summary: {
      total_cars: totalCars,
      total_cost: totalCost,
      avg_cost_per_car: totalCars > 0 ? totalCost / totalCars : 0,
      by_network: Array.from(byNetwork.entries()).map(([network, data]) => ({
        network,
        ...data,
      })),
      unallocated_cars: totalUnallocated,
    },
    warnings,
  };
}

/**
 * Apply scenario weights to rank shop results
 */
function applyScenarioWeights(
  shops: EvaluationResult[],
  weights?: ScenarioWeights
): EvaluationResult[] {
  if (!weights) return shops;

  const scored = shops.map((shop) => {
    // Normalize factors (0-100 scale, higher is better)
    const costScore = 100 - normalizeValue(shop.cost_breakdown.total_cost, 5000, 50000);
    const capacityScore = 100 - normalizeValue(shop.backlog.hours_backlog, 0, 500);
    const aitxScore = shop.shop.is_preferred_network ? 100 : 25;
    const qualityScore = 70; // Default quality score (could be enhanced later)

    // Calculate weighted score
    const weightedScore =
      (costScore * weights.cost) / 100 +
      (capacityScore * weights.capacity_balance) / 100 +
      (aitxScore * weights.aitx_preference) / 100 +
      (qualityScore * weights.quality_score) / 100;

    return { shop, score: weightedScore };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.shop);
}

/**
 * Normalize a value to 0-100 scale
 */
function normalizeValue(value: number, min: number, max: number): number {
  if (value <= min) return 0;
  if (value >= max) return 100;
  return ((value - min) / (max - min)) * 100;
}

export default {
  getShopCapacity,
  updateShopCapacity,
  initializeCapacity,
  listScenarios,
  getScenarioById,
  getDefaultScenario,
  createScenario,
  updateScenario,
  deleteScenario,
  listAllocations,
  createAllocation,
  updateAllocationStatus,
  generateAllocations,
  getShopCapacityRange,
};
