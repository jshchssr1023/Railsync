import { query, queryOne } from '../config/database';

interface OriginLocation {
  location_code: string;
  location_name: string;
  latitude: number;
  longitude: number;
}

interface FreightRate {
  origin_region: string;
  destination_shop: string;
  distance_miles: number;
  base_rate: number;
  per_mile_rate: number;
  fuel_surcharge_pct: number;
}

interface ShopLocation {
  shop_code: string;
  shop_name: string;
  latitude: number;
  longitude: number;
}

interface FreightCalculationResult {
  distance_miles: number;
  base_freight: number;
  fuel_surcharge: number;
  total_freight: number;
  origin_location?: string;
  destination_shop?: string;
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get origin location by code or region
 */
export async function getOriginLocation(
  originCode: string
): Promise<OriginLocation | null> {
  // First try exact code match
  let location = await queryOne<OriginLocation>(
    `SELECT location_code, location_name, latitude, longitude
     FROM origin_locations
     WHERE location_code = $1 AND is_active = TRUE`,
    [originCode.toUpperCase()]
  );

  if (location) return location;

  // Then try region match (partial match)
  location = await queryOne<OriginLocation>(
    `SELECT location_code, location_name, latitude, longitude
     FROM origin_locations
     WHERE region ILIKE $1 AND is_active = TRUE
     LIMIT 1`,
    [`%${originCode}%`]
  );

  return location;
}

/**
 * Get shop location
 */
export async function getShopLocation(
  shopCode: string
): Promise<ShopLocation | null> {
  return queryOne<ShopLocation>(
    `SELECT shop_code, shop_name, latitude, longitude
     FROM shops
     WHERE shop_code = $1 AND is_active = TRUE`,
    [shopCode]
  );
}

/**
 * Get freight rate for origin region and destination shop
 */
export async function getFreightRate(
  originRegion: string,
  destinationShop: string
): Promise<FreightRate | null> {
  return queryOne<FreightRate>(
    `SELECT origin_region, destination_shop, distance_miles, base_rate, per_mile_rate, fuel_surcharge_pct
     FROM freight_rates
     WHERE origin_region = $1 AND destination_shop = $2
       AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
     ORDER BY effective_date DESC
     LIMIT 1`,
    [originRegion, destinationShop]
  );
}

/**
 * Get default freight rate (fallback when no specific route exists)
 */
export async function getDefaultFreightRate(): Promise<FreightRate | null> {
  return queryOne<FreightRate>(
    `SELECT origin_region, destination_shop, distance_miles, base_rate, per_mile_rate, fuel_surcharge_pct
     FROM freight_rates
     WHERE (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
     ORDER BY effective_date DESC
     LIMIT 1`,
    []
  );
}

/**
 * Calculate freight cost based on origin and destination
 */
export async function calculateFreightCost(
  originCode: string,
  shopCode: string
): Promise<FreightCalculationResult> {
  // Default result if we can't calculate
  const defaultResult: FreightCalculationResult = {
    distance_miles: 0,
    base_freight: 500, // Default flat rate
    fuel_surcharge: 75,
    total_freight: 575,
  };

  // Get origin location
  const origin = await getOriginLocation(originCode);
  if (!origin || origin.latitude === null || origin.longitude === null) {
    return defaultResult;
  }

  // Get shop location
  const shop = await getShopLocation(shopCode);
  if (!shop || shop.latitude === null || shop.longitude === null) {
    return defaultResult;
  }

  // Calculate distance
  const distanceMiles = calculateDistance(
    origin.latitude,
    origin.longitude,
    shop.latitude,
    shop.longitude
  );

  // Try to get specific rate for origin region and destination shop
  // Extract region from origin location_code (first part before any delimiter)
  const originRegion = origin.location_code.split('-')[0] || origin.location_code;
  let rate = await getFreightRate(originRegion, shopCode);

  // If no specific rate, try default rate
  if (!rate) {
    rate = await getDefaultFreightRate();
  }

  if (!rate) {
    // No rate found, use default with distance adjustment
    const baseFreight = Math.max(250, distanceMiles * 1.5);
    const fuelSurcharge = baseFreight * 0.15;
    return {
      distance_miles: Math.round(distanceMiles),
      base_freight: Math.round(baseFreight * 100) / 100,
      fuel_surcharge: Math.round(fuelSurcharge * 100) / 100,
      total_freight: Math.round((baseFreight + fuelSurcharge) * 100) / 100,
      origin_location: origin.location_name,
      destination_shop: shop.shop_name,
    };
  }

  // Calculate freight cost using base_rate + per_mile_rate * distance
  const baseFreight = Number(rate.base_rate) + (distanceMiles * Number(rate.per_mile_rate));
  const fuelSurcharge = baseFreight * (Number(rate.fuel_surcharge_pct) / 100);
  const totalFreight = baseFreight + fuelSurcharge;

  return {
    distance_miles: Math.round(distanceMiles),
    base_freight: Math.round(baseFreight * 100) / 100,
    fuel_surcharge: Math.round(fuelSurcharge * 100) / 100,
    total_freight: Math.round(totalFreight * 100) / 100,
    origin_location: origin.location_name,
    destination_shop: shop.shop_name,
  };
}

/**
 * Get all origin locations
 */
export async function listOriginLocations(): Promise<OriginLocation[]> {
  return query<OriginLocation>(
    `SELECT location_code, location_name, latitude, longitude
     FROM origin_locations
     WHERE is_active = TRUE
     ORDER BY location_name`,
    []
  );
}

export default {
  calculateDistance,
  getOriginLocation,
  getShopLocation,
  getFreightRate,
  getDefaultFreightRate,
  calculateFreightCost,
  listOriginLocations,
};
