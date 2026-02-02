import { query, queryOne, transaction } from '../config/database';
import { PoolClient } from 'pg';
import * as assignmentService from './assignment.service';
import { capacityEvents } from './capacity-events.service';

export interface Allocation {
  id: string;
  car_id: string;
  car_number?: string;
  shop_code: string;
  target_month: string;
  status: 'proposed' | 'planned' | 'confirmed' | 'enroute' | 'arrived' | 'complete' | 'cancelled';
  estimated_cost?: number;
  estimated_cost_breakdown?: {
    labor: number;
    material: number;
    freight: number;
    abatement: number;
  };
  actual_cost?: number;
  planned_arrival_date?: string;
  actual_arrival_date?: string;
  actual_completion_date?: string;
  brc_number?: string;
  demand_id?: string;
  scenario_id?: string;
  service_event_id?: string;
  version: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ShopMonthlyCapacity {
  id: string;
  shop_code: string;
  month: string;
  total_capacity: number;
  confirmed_railcars: number;
  planned_railcars: number;
  remaining_capacity: number;
  utilization_pct: number;
  is_at_risk: boolean;
  version: number;
}

export interface CreateAllocationInput {
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
}

// Create a new allocation with capacity check (uses transaction for atomicity)
export async function createAllocation(input: CreateAllocationInput): Promise<Allocation> {
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

  return transaction(async (client: PoolClient) => {
    // Ensure capacity record exists (within transaction)
    await client.query(
      `INSERT INTO shop_monthly_capacity (shop_code, month)
       VALUES ($1, $2)
       ON CONFLICT (shop_code, month) DO NOTHING`,
      [shop_code, target_month]
    );

    // Check capacity if confirming (with row-level lock to prevent race conditions)
    if (status === 'confirmed') {
      const capacityResult = await client.query<ShopMonthlyCapacity>(
        `SELECT * FROM shop_monthly_capacity
         WHERE shop_code = $1 AND month = $2
         FOR UPDATE`,
        [shop_code, target_month]
      );

      const capacity = capacityResult.rows[0];
      if (capacity && capacity.remaining_capacity <= 0) {
        // Allow 10% overcommit
        const overcommitLimit = Math.ceil(capacity.total_capacity * 0.1);
        const overcommit = capacity.confirmed_railcars - capacity.total_capacity;
        if (overcommit >= overcommitLimit) {
          throw new Error(`Shop ${shop_code} is at capacity for ${target_month}. Cannot confirm allocation.`);
        }
      }
    }

    // Insert the allocation (trigger will update capacity counts)
    const result = await client.query<Allocation>(
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
        // Check if already has active assignment (avoid duplicates)
        const existing = await assignmentService.getActiveAssignment(car_number);
        if (!existing) {
          await assignmentService.createAssignment({
            car_number,
            shop_code,
            target_month,
            estimated_cost,
            source: 'demand_plan',
            source_reference_id: result.rows[0].id,
            source_reference_type: 'allocation',
            created_by_id: created_by,
          });
        }
      } catch (err) {
        // Log but don't fail - legacy flow should still work
        console.warn('SSOT write failed (non-blocking):', err);
      }
    }

    return result.rows[0];
  }).then(async (allocation) => {
    // Emit SSE event after transaction commits
    capacityEvents.emitAllocationCreated(
      allocation.shop_code,
      allocation.target_month,
      {
        id: allocation.id,
        car_number: allocation.car_number,
        status: allocation.status,
        version: allocation.version,
      },
      created_by
    );
    return allocation;
  });
}

// Update allocation status with optimistic locking (uses transaction for atomicity)
export async function updateAllocationStatus(
  allocationId: string,
  newStatus: Allocation['status'],
  expectedVersion: number
): Promise<Allocation | null> {
  return transaction(async (client: PoolClient) => {
    // First, get the current allocation with lock
    const currentResult = await client.query<Allocation>(
      `SELECT * FROM allocations WHERE id = $1 FOR UPDATE`,
      [allocationId]
    );

    if (currentResult.rows.length === 0) {
      return null;
    }

    const current = currentResult.rows[0];

    // Check version for optimistic locking
    if (current.version !== expectedVersion) {
      throw new Error('Allocation was modified by another user. Please refresh and try again.');
    }

    // If transitioning to confirmed, check capacity
    if (newStatus === 'confirmed' && current.status !== 'confirmed') {
      // Ensure capacity record exists
      await client.query(
        `INSERT INTO shop_monthly_capacity (shop_code, month)
         VALUES ($1, $2)
         ON CONFLICT (shop_code, month) DO NOTHING`,
        [current.shop_code, current.target_month]
      );

      const capacityResult = await client.query<ShopMonthlyCapacity>(
        `SELECT * FROM shop_monthly_capacity
         WHERE shop_code = $1 AND month = $2
         FOR UPDATE`,
        [current.shop_code, current.target_month]
      );

      const capacity = capacityResult.rows[0];
      if (capacity && capacity.remaining_capacity <= 0) {
        const overcommitLimit = Math.ceil(capacity.total_capacity * 0.1);
        const overcommit = capacity.confirmed_railcars - capacity.total_capacity;
        if (overcommit >= overcommitLimit) {
          throw new Error(
            `Shop ${current.shop_code} is at capacity for ${current.target_month}. Cannot confirm allocation.`
          );
        }
      }
    }

    // Update the allocation (trigger will handle capacity adjustments)
    const result = await client.query<Allocation>(
      `UPDATE allocations
       SET status = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [newStatus, allocationId]
    );

    return result.rows[0];
  }).then((allocation) => {
    if (allocation) {
      // Emit SSE event after transaction commits
      capacityEvents.emitAllocationUpdated(
        allocation.shop_code,
        allocation.target_month,
        {
          id: allocation.id,
          car_number: allocation.car_number,
          status: allocation.status,
          version: allocation.version,
        }
      );
    }
    return allocation;
  });
}

// Get shop monthly capacity
export async function getShopMonthlyCapacity(
  shopCode: string,
  month: string
): Promise<ShopMonthlyCapacity | null> {
  // Ensure capacity record exists
  await query(
    `INSERT INTO shop_monthly_capacity (shop_code, month)
     VALUES ($1, $2)
     ON CONFLICT (shop_code, month) DO NOTHING`,
    [shopCode, month]
  );

  return queryOne<ShopMonthlyCapacity>(
    `SELECT * FROM shop_monthly_capacity WHERE shop_code = $1 AND month = $2`,
    [shopCode, month]
  );
}

// Get capacity for multiple months
export async function getShopCapacityRange(
  shopCode: string,
  months: number = 3
): Promise<ShopMonthlyCapacity[]> {
  // Build list of months to query
  const months_list: string[] = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months_list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Ensure all months exist
  for (const month of months_list) {
    await query(
      `INSERT INTO shop_monthly_capacity (shop_code, month)
       VALUES ($1, $2)
       ON CONFLICT (shop_code, month) DO NOTHING`,
      [shopCode, month]
    );
  }

  return query<ShopMonthlyCapacity>(
    `SELECT * FROM shop_monthly_capacity
     WHERE shop_code = $1 AND month = ANY($2)
     ORDER BY month`,
    [shopCode, months_list]
  );
}

// List allocations with filters
export async function listAllocations(filters?: {
  shop_code?: string;
  target_month?: string;
  status?: string;
  car_number?: string;
  limit?: number;
  offset?: number;
}): Promise<{ allocations: Allocation[]; total: number }> {
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  let paramIndex = 1;

  if (filters?.shop_code) {
    conditions.push(`shop_code = $${paramIndex++}`);
    values.push(filters.shop_code);
  }
  if (filters?.target_month) {
    conditions.push(`target_month = $${paramIndex++}`);
    values.push(filters.target_month);
  }
  if (filters?.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(filters.status);
  }
  if (filters?.car_number) {
    conditions.push(`car_number ILIKE $${paramIndex++}`);
    values.push(`%${filters.car_number}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM allocations ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count || '0', 10);

  const limit = filters?.limit || 100;
  const offset = filters?.offset || 0;

  const allocations = await query<Allocation>(
    `SELECT * FROM allocations ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, limit, offset]
  );

  return { allocations, total };
}

// Get allocation by ID
export async function getAllocationById(id: string): Promise<Allocation | null> {
  return queryOne<Allocation>('SELECT * FROM allocations WHERE id = $1', [id]);
}

// Delete allocation
export async function deleteAllocation(id: string): Promise<boolean> {
  // Get allocation details before deleting for the event
  const allocation = await queryOne<Allocation>('SELECT * FROM allocations WHERE id = $1', [id]);

  await query('DELETE FROM allocations WHERE id = $1', [id]);

  // Emit SSE event after deletion
  if (allocation) {
    capacityEvents.emitAllocationDeleted(
      allocation.shop_code,
      allocation.target_month,
      id
    );
  }

  return true;
}
