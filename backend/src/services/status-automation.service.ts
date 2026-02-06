import { query, queryOne, transaction } from '../config/database';

interface StatusUpdateResult {
  success: boolean;
  newStatus?: string;
  newPipelineStatus?: string;
  lastShoppingDate?: string;
  planStatusYear?: number;
  error?: string;
}

interface AllocationRecord {
  id: string;
  car_id: string;
  current_status: string;
  pipeline_status: string;
  last_shopping_date: string | null;
  plan_status_year: number;
  shop_code: string | null;
  work_type: string | null;
  needs_shopping_reason: string | null;
}

/**
 * Process status update based on CSV-derived business rules
 * Handles status transitions, date rollovers, and pipeline categorization
 */
export async function processStatusUpdate(
  allocationId: string,
  csvStatus: string,
  csvScheduled?: string
): Promise<StatusUpdateResult> {
  return transaction(async (client) => {
    // Get current allocation
    const allocation = await queryOne<AllocationRecord>(
      `SELECT id, car_id, current_status, pipeline_status, last_shopping_date,
              plan_status_year, shop_code, work_type, needs_shopping_reason
       FROM allocations WHERE id = $1`,
      [allocationId]
    );

    if (!allocation) {
      return { success: false, error: 'Allocation not found' };
    }

    let newStatus = allocation.current_status;
    let newPipelineStatus = allocation.pipeline_status;
    let newLastShopping = allocation.last_shopping_date;
    let newPlanYear = allocation.plan_status_year;

    // Completion & Date Rollover
    if (csvStatus === 'Complete' && allocation.current_status !== 'completed') {
      newStatus = 'completed';
      newLastShopping = new Date().toISOString().split('T')[0];
      newPlanYear = (allocation.plan_status_year || new Date().getFullYear()) + 4;
      newPipelineStatus = 'healthy';
    }

    // Car State Mapping based on CSV status
    if (csvStatus === 'To Be Routed') {
      if (csvScheduled === 'Planned Shopping') {
        newStatus = 'scheduled';
        newPipelineStatus = allocation.shop_code ? 'pipeline' : 'backlog';
      } else {
        newStatus = 'planned';
        newPipelineStatus = 'backlog';
      }
    } else if (csvStatus === 'Arrived') {
      newStatus = 'in_shop';
      newPipelineStatus = 'active';
    } else if (csvStatus === 'Enroute') {
      newStatus = 'enroute';
      newPipelineStatus = 'active';
    } else if (csvStatus === 'Released') {
      newStatus = 'completed';
      newPipelineStatus = 'complete';
      if (!newLastShopping) {
        newLastShopping = new Date().toISOString().split('T')[0];
      }
    }

    // Update allocation
    await client.query(
      `UPDATE allocations
       SET current_status = $1,
           pipeline_status = $2,
           last_shopping_date = $3,
           plan_status_year = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [newStatus, newPipelineStatus, newLastShopping, newPlanYear, allocationId]
    );

    return {
      success: true,
      newStatus,
      newPipelineStatus,
      lastShoppingDate: newLastShopping || undefined,
      planStatusYear: newPlanYear,
    };
  });
}

/**
 * Batch process status updates from CSV import
 */
export async function batchProcessStatusUpdates(
  updates: Array<{ allocationId: string; csvStatus: string; csvScheduled?: string }>
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  for (const update of updates) {
    const result = await processStatusUpdate(
      update.allocationId,
      update.csvStatus,
      update.csvScheduled
    );

    if (result.success) {
      processed++;
    } else {
      errors.push(`${update.allocationId}: ${result.error}`);
    }
  }

  return { processed, errors };
}

/**
 * Recalculate pipeline status for all allocations
 * Useful for data repair or after bulk imports
 */
export async function recalculatePipelineStatuses(): Promise<{ updated: number }> {
  const result = await query(
    `UPDATE allocations SET pipeline_status =
        CASE
            WHEN current_status IN ('planned', 'scheduled') AND shop_code IS NULL THEN 'backlog'
            WHEN current_status = 'scheduled' AND shop_code IS NOT NULL THEN 'pipeline'
            WHEN current_status IN ('enroute', 'in_shop') THEN 'active'
            WHEN current_status IN ('completed', 'dispo') THEN 'healthy'
            ELSE 'backlog'
        END
     WHERE status NOT IN ('Released')
     RETURNING id`
  );

  return { updated: result.length };
}

/**
 * Get pipeline bucket summary
 */
export async function getPipelineBuckets(): Promise<{
  backlog: number;
  pipeline: number;
  active: number;
  healthy: number;
  complete: number;
}> {
  const result = await query<{ pipeline_status: string; car_count: string }>(
    `SELECT pipeline_status, car_count FROM v_pipeline_buckets`
  );

  const buckets = {
    backlog: 0,
    pipeline: 0,
    active: 0,
    healthy: 0,
    complete: 0,
  };

  for (const row of result) {
    const status = row.pipeline_status as keyof typeof buckets;
    if (status in buckets) {
      buckets[status] = parseInt(row.car_count, 10);
    }
  }

  // Combine 'complete' into 'healthy' to match v_healthy_cars which includes both
  buckets.healthy += buckets.complete;

  return buckets;
}

/**
 * Get cars in each pipeline bucket
 */
export async function getBacklogCars(): Promise<unknown[]> {
  return query(`SELECT * FROM v_backlog_cars`);
}

export async function getPipelineCars(): Promise<unknown[]> {
  return query(`SELECT * FROM v_pipeline_cars`);
}

export async function getActiveCars(): Promise<unknown[]> {
  return query(`SELECT * FROM v_active_cars`);
}

export async function getHealthyCars(): Promise<unknown[]> {
  return query(`SELECT * FROM v_healthy_cars`);
}

export default {
  processStatusUpdate,
  batchProcessStatusUpdates,
  recalculatePipelineStatuses,
  getPipelineBuckets,
  getBacklogCars,
  getPipelineCars,
  getActiveCars,
  getHealthyCars,
};
