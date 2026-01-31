import { query, queryOne } from '../config/database';
import {
  Shop,
  ShopCapability,
  ShopBacklog,
  ShopCapacity,
  CommodityRestriction,
} from '../types';

export async function findAll(activeOnly: boolean = true): Promise<Shop[]> {
  const sql = `
    SELECT *
    FROM shops
    ${activeOnly ? 'WHERE is_active = TRUE' : ''}
    ORDER BY shop_name
  `;

  return query<Shop>(sql);
}

export async function findByCode(shopCode: string): Promise<Shop | null> {
  const sql = `SELECT * FROM shops WHERE shop_code = $1`;
  return queryOne<Shop>(sql, [shopCode]);
}

export async function getCapabilities(shopCode: string): Promise<ShopCapability[]> {
  const sql = `
    SELECT *
    FROM shop_capabilities
    WHERE shop_code = $1
      AND is_active = TRUE
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    ORDER BY capability_type, capability_value
  `;

  return query<ShopCapability>(sql, [shopCode]);
}

export async function getAllCapabilities(): Promise<Map<string, ShopCapability[]>> {
  const sql = `
    SELECT *
    FROM shop_capabilities
    WHERE is_active = TRUE
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    ORDER BY shop_code, capability_type, capability_value
  `;

  const rows = await query<ShopCapability>(sql);
  const map = new Map<string, ShopCapability[]>();

  for (const row of rows) {
    const existing = map.get(row.shop_code) || [];
    existing.push(row);
    map.set(row.shop_code, existing);
  }

  return map;
}

export async function getBacklog(shopCode: string): Promise<ShopBacklog | null> {
  const sql = `
    SELECT *
    FROM shop_backlog
    WHERE shop_code = $1
      AND date = CURRENT_DATE
  `;

  return queryOne<ShopBacklog>(sql, [shopCode]);
}

export async function getAllBacklogs(): Promise<Map<string, ShopBacklog>> {
  const sql = `
    SELECT *
    FROM shop_backlog
    WHERE date = CURRENT_DATE
  `;

  const rows = await query<ShopBacklog>(sql);
  const map = new Map<string, ShopBacklog>();

  for (const row of rows) {
    map.set(row.shop_code, row);
  }

  return map;
}

export async function getCapacity(shopCode: string): Promise<ShopCapacity[]> {
  const sql = `
    SELECT *
    FROM shop_capacity
    WHERE shop_code = $1
      AND effective_date <= CURRENT_DATE
    ORDER BY work_type
  `;

  return query<ShopCapacity>(sql, [shopCode]);
}

export async function getAllCapacities(): Promise<Map<string, ShopCapacity[]>> {
  const sql = `
    SELECT DISTINCT ON (shop_code, work_type)
      *
    FROM shop_capacity
    WHERE effective_date <= CURRENT_DATE
    ORDER BY shop_code, work_type, effective_date DESC
  `;

  const rows = await query<ShopCapacity>(sql);
  const map = new Map<string, ShopCapacity[]>();

  for (const row of rows) {
    const existing = map.get(row.shop_code) || [];
    existing.push(row);
    map.set(row.shop_code, existing);
  }

  return map;
}

export async function getCommodityRestrictions(
  cinCode: string
): Promise<CommodityRestriction[]> {
  const sql = `
    SELECT *
    FROM commodity_restrictions
    WHERE cin_code = $1
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
  `;

  return query<CommodityRestriction>(sql, [cinCode]);
}

export async function getFreightRate(
  originRegion: string,
  shopCode: string
): Promise<{ base_rate: number; per_mile_rate: number; distance_miles: number; fuel_surcharge_pct: number } | null> {
  const sql = `
    SELECT base_rate, per_mile_rate, distance_miles, fuel_surcharge_pct
    FROM freight_rates
    WHERE origin_region = $1
      AND destination_shop = $2
      AND effective_date <= CURRENT_DATE
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    ORDER BY effective_date DESC
    LIMIT 1
  `;

  return queryOne(sql, [originRegion, shopCode]);
}

export async function getLaborRates(
  shopCode: string
): Promise<Map<string, { hourly_rate: number; minimum_hours: number }>> {
  const sql = `
    SELECT DISTINCT ON (work_type)
      work_type, hourly_rate, minimum_hours
    FROM labor_rates
    WHERE shop_code = $1
      AND effective_date <= CURRENT_DATE
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    ORDER BY work_type, effective_date DESC
  `;

  const rows = await query<{ work_type: string; hourly_rate: number; minimum_hours: number }>(sql, [shopCode]);
  const map = new Map<string, { hourly_rate: number; minimum_hours: number }>();

  for (const row of rows) {
    map.set(row.work_type, { hourly_rate: row.hourly_rate, minimum_hours: row.minimum_hours });
  }

  return map;
}

export default {
  findAll,
  findByCode,
  getCapabilities,
  getAllCapabilities,
  getBacklog,
  getAllBacklogs,
  getCapacity,
  getAllCapacities,
  getCommodityRestrictions,
  getFreightRate,
  getLaborRates,
};
