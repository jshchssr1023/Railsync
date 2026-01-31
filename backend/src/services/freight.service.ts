import { query, queryOne } from '../config/database';

interface OriginLocation {
  location_code: string;
  location_name: string;
  latitude: number;
  longitude: number;
}

interface FreightRate {
  min_miles: number;
  max_miles: number;
  rate_per_mile: number;
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
 * Get freight rate for a given distance
 */
export async function getFreightRateForDistance(
  distanceMiles: number
): Promise<FreightRate | null> {
  return queryOne<FreightRate>(
    `SELECT min_miles, max_miles, rate_per_mile, fuel_surcharge_pct
     FROM freight_rates
     WHERE min_miles <= $1 AND max_miles >= $1
       AND is_active = TRUE
       AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
     ORDER BY effective_date DESC
     LIMIT 1`,
    [Math.round(distanceMiles)]
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

  // Get rate for this distance
  const rate = await getFreightRateForDistance(distanceMiles);
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

  // Calculate freight cost
  const baseFreight = distanceMiles * rate.rate_per_mile;
  const fuelSurcharge = baseFreight * (rate.fuel_surcharge_pct / 100);
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
  getFreightRateForDistance,
  calculateFreightCost,
  listOriginLocations,
};
