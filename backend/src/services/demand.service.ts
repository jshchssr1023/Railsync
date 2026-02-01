import { query, queryOne } from '../config/database';
import {
  Demand,
  DemandStatus,
  DemandPriority,
  EventType,
} from '../types';

/**
 * List demands with filters
 */
export async function listDemands(filters: {
  fiscal_year?: number;
  target_month?: string;
  status?: DemandStatus;
  event_type?: EventType;
  limit?: number;
  offset?: number;
}): Promise<{ demands: Demand[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.fiscal_year) {
    conditions.push(`fiscal_year = $${paramIndex++}`);
    params.push(filters.fiscal_year);
  }

  if (filters.target_month) {
    conditions.push(`target_month = $${paramIndex++}`);
    params.push(filters.target_month);
  }

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.event_type) {
    conditions.push(`event_type = $${paramIndex++}`);
    params.push(filters.event_type);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM demands ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count || '0', 10);

  // Get paginated results
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const demands = await query<Demand>(
    `SELECT * FROM demands ${whereClause}
     ORDER BY target_month, priority, name
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return { demands, total };
}

/**
 * Get demand by ID
 */
export async function getDemandById(id: string): Promise<Demand | null> {
  return queryOne<Demand>('SELECT * FROM demands WHERE id = $1', [id]);
}

/**
 * Create a new demand
 */
export async function createDemand(
  data: {
    name: string;
    description?: string;
    fiscal_year: number;
    target_month: string;
    car_count: number;
    event_type: EventType;
    car_type?: string;
    default_lessee_code?: string;
    default_material_type?: string;
    default_lining_type?: string;
    default_commodity?: string;
    priority?: DemandPriority;
    required_network?: string;
    required_region?: string;
    max_cost_per_car?: number;
    excluded_shops?: string[];
  },
  userId?: string
): Promise<Demand> {
  const sql = `
    INSERT INTO demands (
      name, description, fiscal_year, target_month, car_count, event_type,
      car_type, default_lessee_code, default_material_type, default_lining_type,
      default_commodity, priority, required_network, required_region,
      max_cost_per_car, excluded_shops, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *
  `;

  const rows = await query<Demand>(sql, [
    data.name,
    data.description,
    data.fiscal_year,
    data.target_month,
    data.car_count,
    data.event_type,
    data.car_type,
    data.default_lessee_code,
    data.default_material_type || 'Carbon Steel',
    data.default_lining_type,
    data.default_commodity,
    data.priority || 'Medium',
    data.required_network,
    data.required_region,
    data.max_cost_per_car,
    data.excluded_shops,
    userId,
  ]);

  return rows[0];
}

/**
 * Update a demand
 */
export async function updateDemand(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    car_count: number;
    car_type: string;
    default_lessee_code: string;
    default_material_type: string;
    default_lining_type: string;
    default_commodity: string;
    priority: DemandPriority;
    required_network: string;
    required_region: string;
    max_cost_per_car: number;
    excluded_shops: string[];
  }>
): Promise<Demand | null> {
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
  if (data.car_count !== undefined) {
    updates.push(`car_count = $${paramIndex++}`);
    params.push(data.car_count);
  }
  if (data.car_type !== undefined) {
    updates.push(`car_type = $${paramIndex++}`);
    params.push(data.car_type);
  }
  if (data.default_lessee_code !== undefined) {
    updates.push(`default_lessee_code = $${paramIndex++}`);
    params.push(data.default_lessee_code);
  }
  if (data.default_material_type !== undefined) {
    updates.push(`default_material_type = $${paramIndex++}`);
    params.push(data.default_material_type);
  }
  if (data.default_lining_type !== undefined) {
    updates.push(`default_lining_type = $${paramIndex++}`);
    params.push(data.default_lining_type);
  }
  if (data.default_commodity !== undefined) {
    updates.push(`default_commodity = $${paramIndex++}`);
    params.push(data.default_commodity);
  }
  if (data.priority !== undefined) {
    updates.push(`priority = $${paramIndex++}`);
    params.push(data.priority);
  }
  if (data.required_network !== undefined) {
    updates.push(`required_network = $${paramIndex++}`);
    params.push(data.required_network);
  }
  if (data.required_region !== undefined) {
    updates.push(`required_region = $${paramIndex++}`);
    params.push(data.required_region);
  }
  if (data.max_cost_per_car !== undefined) {
    updates.push(`max_cost_per_car = $${paramIndex++}`);
    params.push(data.max_cost_per_car);
  }
  if (data.excluded_shops !== undefined) {
    updates.push(`excluded_shops = $${paramIndex++}`);
    params.push(data.excluded_shops);
  }

  if (updates.length === 0) {
    return getDemandById(id);
  }

  updates.push('updated_at = NOW()');

  const sql = `
    UPDATE demands SET ${updates.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  const rows = await query<Demand>(sql, params);
  return rows[0] || null;
}

/**
 * Update demand status
 */
export async function updateDemandStatus(
  id: string,
  status: DemandStatus
): Promise<Demand | null> {
  const sql = `
    UPDATE demands SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const rows = await query<Demand>(sql, [id, status]);
  return rows[0] || null;
}

/**
 * Delete a demand
 */
export async function deleteDemand(id: string): Promise<boolean> {
  await query('DELETE FROM demands WHERE id = $1', [id]);
  return true;
}

/**
 * Get demand summary by month
 */
export async function getDemandSummaryByMonth(
  fiscalYear: number
): Promise<
  {
    target_month: string;
    total_cars: number;
    by_type: { event_type: string; car_count: number }[];
  }[]
> {
  const sql = `
    SELECT
      target_month,
      SUM(car_count) as total_cars,
      json_agg(json_build_object('event_type', event_type, 'car_count', car_count)) as by_type
    FROM demands
    WHERE fiscal_year = $1
    GROUP BY target_month
    ORDER BY target_month
  `;

  const rows = await query<{
    target_month: string;
    total_cars: string;
    by_type: { event_type: string; car_count: number }[];
  }>(sql, [fiscalYear]);

  return rows.map((row) => ({
    target_month: row.target_month,
    total_cars: parseInt(row.total_cars, 10),
    by_type: row.by_type,
  }));
}

export default {
  listDemands,
  getDemandById,
  createDemand,
  updateDemand,
  updateDemandStatus,
  deleteDemand,
  getDemandSummaryByMonth,
};
