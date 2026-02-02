/**
 * Shop Filtering Service
 * Provides proximity-based and capability-based shop filtering
 */

import { query, queryOne } from '../config/database';

export interface ShopWithDistance {
  shop_code: string;
  shop_name: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  distance_miles: number | null;
  tier: number;
  is_preferred_network: boolean;
}

export interface CapabilityType {
  capability_type: string;
  display_name: string;
  description: string | null;
  sort_order: number;
}

export interface ShopCapabilitySummary {
  shop_code: string;
  shop_name: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  tier: number;
  is_preferred_network: boolean;
  capability_types: string[];
  total_capabilities: number;
  unique_capability_types: number;
}

export interface FilterOptions {
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  capabilityTypes?: string[];
  tier?: number;
  preferredNetworkOnly?: boolean;
  region?: string;
}

/**
 * Get list of all capability types for filter dropdown
 */
export async function getCapabilityTypes(): Promise<CapabilityType[]> {
  const sql = `
    SELECT capability_type, display_name, description, sort_order
    FROM capability_types
    ORDER BY sort_order, capability_type
  `;
  return query<CapabilityType>(sql);
}

/**
 * Get unique capability values for a given type
 */
export async function getCapabilityValues(capabilityType: string): Promise<string[]> {
  const sql = `
    SELECT DISTINCT capability_value
    FROM shop_capabilities
    WHERE capability_type = $1
      AND is_active = TRUE
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    ORDER BY capability_value
  `;
  const rows = await query<{ capability_value: string }>(sql, [capabilityType]);
  return rows.map(r => r.capability_value);
}

/**
 * Get all unique regions
 */
export async function getRegions(): Promise<string[]> {
  const sql = `
    SELECT DISTINCT region
    FROM shops
    WHERE is_active = TRUE AND region IS NOT NULL AND region != ''
    ORDER BY region
  `;
  const rows = await query<{ region: string }>(sql);
  return rows.map(r => r.region);
}

/**
 * Find shops within a radius of a given point
 */
export async function findShopsWithinRadius(
  latitude: number,
  longitude: number,
  radiusMiles: number = 500
): Promise<ShopWithDistance[]> {
  const sql = `
    SELECT * FROM find_shops_within_radius($1, $2, $3)
  `;
  return query<ShopWithDistance>(sql, [latitude, longitude, radiusMiles]);
}

/**
 * Filter shops by capabilities
 */
export async function filterShopsByCapabilities(
  capabilityTypes: string[]
): Promise<ShopCapabilitySummary[]> {
  if (capabilityTypes.length === 0) {
    // Return all shops with their capabilities
    const sql = `SELECT * FROM v_shop_capabilities_summary ORDER BY shop_code`;
    return query<ShopCapabilitySummary>(sql);
  }

  // Find shops that have ALL the required capability types
  const sql = `
    SELECT v.*
    FROM v_shop_capabilities_summary v
    WHERE v.capability_types @> $1::VARCHAR[]
    ORDER BY v.shop_code
  `;
  return query<ShopCapabilitySummary>(sql, [capabilityTypes]);
}

/**
 * Combined filter: proximity + capabilities + other options
 */
export async function filterShops(options: FilterOptions): Promise<ShopWithDistance[]> {
  const params: any[] = [];
  let paramIndex = 1;

  let sql = `
    SELECT
      s.shop_code,
      s.shop_name,
      s.region,
      s.latitude,
      s.longitude,
      s.tier,
      s.is_preferred_network,
  `;

  // Add distance calculation if coordinates provided
  if (options.latitude !== undefined && options.longitude !== undefined) {
    sql += `
      calculate_distance_miles($${paramIndex}, $${paramIndex + 1}, s.latitude, s.longitude) AS distance_miles
    `;
    params.push(options.latitude, options.longitude);
    paramIndex += 2;
  } else {
    sql += `
      NULL::DECIMAL AS distance_miles
    `;
  }

  sql += `
    FROM shops s
  `;

  // Join with capabilities if filtering by capability
  if (options.capabilityTypes && options.capabilityTypes.length > 0) {
    sql += `
      JOIN (
        SELECT DISTINCT shop_code
        FROM shop_capabilities
        WHERE capability_type = ANY($${paramIndex})
          AND is_active = TRUE
          AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
        GROUP BY shop_code
        HAVING COUNT(DISTINCT capability_type) >= $${paramIndex + 1}
      ) sc ON s.shop_code = sc.shop_code
    `;
    params.push(options.capabilityTypes, options.capabilityTypes.length);
    paramIndex += 2;
  }

  sql += ` WHERE s.is_active = TRUE`;

  // Filter by radius
  if (options.latitude !== undefined && options.longitude !== undefined && options.radiusMiles) {
    sql += ` AND calculate_distance_miles($1, $2, s.latitude, s.longitude) <= $${paramIndex}`;
    params.push(options.radiusMiles);
    paramIndex++;
  }

  // Filter by tier
  if (options.tier !== undefined) {
    sql += ` AND s.tier = $${paramIndex}`;
    params.push(options.tier);
    paramIndex++;
  }

  // Filter by preferred network
  if (options.preferredNetworkOnly) {
    sql += ` AND s.is_preferred_network = TRUE`;
  }

  // Filter by region
  if (options.region) {
    sql += ` AND s.region = $${paramIndex}`;
    params.push(options.region);
    paramIndex++;
  }

  // Order by distance if available, otherwise by shop code
  if (options.latitude !== undefined && options.longitude !== undefined) {
    sql += ` ORDER BY distance_miles NULLS LAST, s.shop_code`;
  } else {
    sql += ` ORDER BY s.shop_code`;
  }

  return query<ShopWithDistance>(sql, params);
}

/**
 * Get filter options (for populating dropdowns)
 */
export async function getFilterOptions(): Promise<{
  regions: string[];
  tiers: number[];
  capabilityTypes: CapabilityType[];
}> {
  const [regions, tiers, capabilityTypes] = await Promise.all([
    getRegions(),
    query<{ tier: number }>('SELECT DISTINCT tier FROM shops WHERE is_active = TRUE ORDER BY tier').then(r => r.map(t => t.tier)),
    getCapabilityTypes(),
  ]);

  return { regions, tiers, capabilityTypes };
}

export default {
  getCapabilityTypes,
  getCapabilityValues,
  getRegions,
  findShopsWithinRadius,
  filterShopsByCapabilities,
  filterShops,
  getFilterOptions,
};
