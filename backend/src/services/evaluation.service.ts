import carModel from '../models/car.model';
import shopModel from '../models/shop.model';
import ruleModel from '../models/rule.model';
import { RulesEngine, EvaluationContext } from '../rules-engine';
import {
  EvaluationRequest,
  EvaluationResult,
  EvaluationOverrides,
  CostBreakdown,
  ShopBacklog,
  CarWithCommodity,
  Shop,
  CommodityRestriction,
  HoursByType,
  RestrictionCode,
  DirectCarInput,
} from '../types';
import { calculateDerivedFields } from '../middleware/validation';
import { calculateFreightCost } from './freight.service';
import { calculateWorkHours } from './workhours.service';
import { getQualificationPriority } from './qualification.service';
import { queryOne } from '../config/database';

const DEFAULT_LABOR_HOURS = {
  cleaning: 4,
  flare: 2,
  mechanical: 8,
  blast: 6,
  lining: 16,
  paint: 8,
};

const DEFAULT_MATERIAL_COSTS = {
  cleaning: 150,
  blast: 300,
  lining: 2500,
  paint: 800,
};

// Lining-specific material costs (more accurate than generic lining cost)
const LINING_MATERIAL_COSTS: Record<string, number> = {
  'High Bake': 1800,
  'Plasite': 3200,
  'Rubber': 4500,
  'Vinyl Ester': 3800,
  'Epoxy': 2200,
};

// Cleaning class cost multipliers (A=easiest, D=hardest)
const CLEANING_CLASS_MULTIPLIERS: Record<string, number> = {
  'A': 1.0,
  'B': 1.25,
  'C': 1.5,
  'D': 2.0,
};

const ABATEMENT_BASE_COST = 5000;
const KOSHER_CLEANING_PREMIUM = 500;
const DEFAULT_CLEANING_COST = 850;

/**
 * Evaluate all shops for a given car and return ranked results
 */
export async function evaluateShops(
  request: EvaluationRequest
): Promise<EvaluationResult[]> {
  // Get car data - either from DB lookup or direct input
  let car: CarWithCommodity;

  if (request.car_number) {
    // Option 1: Lookup car by number (existing behavior)
    const dbCar = await carModel.findByCarNumber(request.car_number);
    if (!dbCar) {
      throw new Error(`Car not found: ${request.car_number}`);
    }
    car = dbCar;
  } else if (request.car_input) {
    // Option 2: Build car from direct input (new in Phase 3)
    car = buildCarFromInput(request.car_input);
  } else {
    throw new Error('Either car_number or car_input is required');
  }

  // Fetch all shops and related data
  const [shops, allCapabilities, allBacklogs, allCapacities, rules] = await Promise.all([
    shopModel.findAll(true),
    shopModel.getAllCapabilities(),
    shopModel.getAllBacklogs(),
    shopModel.getAllCapacities(),
    ruleModel.findAll(true),
  ]);

  // Fetch commodity restrictions if car has a commodity
  let commodityRestrictions: CommodityRestriction[] = [];
  if (car.commodity_cin) {
    commodityRestrictions = await shopModel.getCommodityRestrictions(car.commodity_cin);
  }

  const overrides: EvaluationOverrides = request.overrides || {};
  const originRegion = request.origin_region || 'Midwest';

  // Look up qualification priority for this car (if it exists in the qualifications table)
  let qualPriority: { recommended_priority: number; reason: string; overdue_count: number; due_soon_count: number } | undefined;
  if (request.car_number) {
    try {
      const carRow = await queryOne<{ id: string }>('SELECT id FROM cars WHERE car_number = $1', [request.car_number]);
      if (carRow?.id) {
        qualPriority = await getQualificationPriority(carRow.id);
      }
    } catch {
      // Non-blocking: if qualification lookup fails, proceed without it
    }
  }

  // Initialize rules engine
  const rulesEngine = new RulesEngine(rules);

  // Evaluate each shop
  const results: EvaluationResult[] = [];

  for (const shop of shops) {
    const capabilities = allCapabilities.get(shop.shop_code) || [];
    const backlog = allBacklogs.get(shop.shop_code) || createDefaultBacklog(shop.shop_code);
    const capacity = allCapacities.get(shop.shop_code) || [];

    const context: EvaluationContext = {
      car,
      shop,
      capabilities,
      commodityRestrictions,
      overrides,
      backlog,
    };

    const ruleResult = rulesEngine.evaluate(context);

    // Calculate costs
    const costBreakdown = await calculateCosts(
      car,
      shop,
      overrides,
      originRegion
    );

    // Calculate hours by work type using factor-based model
    let hoursByType: HoursByType;
    try {
      hoursByType = await calculateWorkHours(car, overrides);
    } catch {
      // Fallback to simple calculation if service fails
      hoursByType = calculateHoursByTypeFallback(car, overrides);
    }

    // Get restriction code for this shop-commodity combination
    const restrictionCode = getRestrictionCode(
      car.commodity_cin,
      shop.shop_code,
      commodityRestrictions
    );

    results.push({
      shop: {
        shop_code: shop.shop_code,
        shop_name: shop.shop_name,
        primary_railroad: shop.primary_railroad,
        region: shop.region,
        labor_rate: shop.labor_rate,
        is_preferred_network: shop.is_preferred_network,
      },
      is_eligible: ruleResult.passed,
      failed_rules: ruleResult.failedRules,
      cost_breakdown: costBreakdown,
      backlog,
      capacity,
      hours_by_type: hoursByType,
      restriction_code: restrictionCode,
      rules: ruleResult.allRules,
      qualification_priority: qualPriority,
    });
  }

  // Sort results: eligible first, then by total cost
  results.sort((a, b) => {
    // Eligible shops first
    if (a.is_eligible !== b.is_eligible) {
      return a.is_eligible ? -1 : 1;
    }
    // Then by preferred network if override is set
    if (overrides.primary_network && a.shop.is_preferred_network !== b.shop.is_preferred_network) {
      return a.shop.is_preferred_network ? -1 : 1;
    }
    // Then by total cost
    return a.cost_breakdown.total_cost - b.cost_breakdown.total_cost;
  });

  return results;
}

/**
 * Calculate costs for a specific shop
 * Incorporates commodity pricing, lining-specific costs, and cleaning class multipliers
 */
export async function calculateCosts(
  car: CarWithCommodity,
  shop: Shop,
  overrides: EvaluationOverrides,
  originRegion: string
): Promise<CostBreakdown> {
  // Get labor rates for this shop
  const laborRates = await shopModel.getLaborRates(shop.shop_code);

  // Calculate labor cost based on work needed
  let laborCost = 0;
  const workTypes: string[] = ['cleaning']; // Always need cleaning

  if (overrides.interior_blast) {
    workTypes.push('blast');
  }
  if (overrides.new_lining || car.lining_type) {
    workTypes.push('lining');
  }
  if (overrides.exterior_paint) {
    workTypes.push('paint');
  }

  for (const workType of workTypes) {
    const rate = laborRates.get(workType);
    if (rate) {
      const hours = DEFAULT_LABOR_HOURS[workType as keyof typeof DEFAULT_LABOR_HOURS] || 4;
      laborCost += Math.max(rate.hourly_rate * hours, rate.hourly_rate * rate.minimum_hours);
    } else {
      // Use shop's default labor rate
      const hours = DEFAULT_LABOR_HOURS[workType as keyof typeof DEFAULT_LABOR_HOURS] || 4;
      laborCost += shop.labor_rate * hours;
    }
  }

  // Calculate material cost with enhanced logic
  let materialCost = 0;
  for (const workType of workTypes) {
    if (workType === 'cleaning') {
      // Use commodity recommended price if available, otherwise default
      const baseCleaningCost = car.commodity?.recommended_price || DEFAULT_CLEANING_COST;

      // Apply cleaning class multiplier if commodity has a cleaning class
      const cleaningClass = car.commodity?.cleaning_class || 'A';
      const classMultiplier = CLEANING_CLASS_MULTIPLIERS[cleaningClass] || 1.0;

      materialCost += baseCleaningCost * classMultiplier * shop.material_multiplier;
    } else if (workType === 'lining') {
      // Use lining-specific cost if available
      const liningType = car.lining_type || 'Epoxy';
      const liningCost = LINING_MATERIAL_COSTS[liningType] || DEFAULT_MATERIAL_COSTS.lining;
      materialCost += liningCost * shop.material_multiplier;
    } else {
      // Standard material cost for other work types
      const baseCost = DEFAULT_MATERIAL_COSTS[workType as keyof typeof DEFAULT_MATERIAL_COSTS] || 0;
      materialCost += baseCost * shop.material_multiplier;
    }
  }

  // Add kosher cleaning premium if required
  const requiresKosher = car.commodity?.requires_kosher || overrides.kosher_cleaning;
  if (requiresKosher) {
    materialCost += KOSHER_CLEANING_PREMIUM;
  }

  // Calculate abatement cost if needed
  let abatementCost = 0;
  if (car.asbestos_abatement_required) {
    abatementCost = ABATEMENT_BASE_COST;
  }

  // Calculate freight cost using distance-based calculation
  let freightCost = 0;
  try {
    const freightResult = await calculateFreightCost(originRegion, shop.shop_code);
    freightCost = freightResult.total_freight;
  } catch {
    // Fallback to legacy method if new calculation fails
    const freightRate = await shopModel.getFreightRate(originRegion, shop.shop_code);
    if (freightRate) {
      freightCost = freightRate.base_rate;
      if (freightRate.distance_miles && freightRate.per_mile_rate) {
        freightCost += freightRate.distance_miles * freightRate.per_mile_rate;
      }
      freightCost *= (1 + freightRate.fuel_surcharge_pct / 100);
    } else {
      // Default freight cost
      freightCost = 500;
    }
  }

  const totalCost = laborCost + materialCost + abatementCost + freightCost;

  return {
    labor_cost: Math.round(laborCost * 100) / 100,
    material_cost: Math.round(materialCost * 100) / 100,
    abatement_cost: Math.round(abatementCost * 100) / 100,
    freight_cost: Math.round(freightCost * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
  };
}

function createDefaultBacklog(shopCode: string): ShopBacklog {
  return {
    shop_code: shopCode,
    date: new Date(),
    hours_backlog: 0,
    cars_backlog: 0,
    cars_en_route_0_6: 0,
    cars_en_route_7_14: 0,
    cars_en_route_15_plus: 0,
    weekly_inbound: 0,
    weekly_outbound: 0,
  };
}

/**
 * Fallback: Calculate estimated hours by work type for a car (simple model)
 * Used when factor-based calculation is not available
 */
function calculateHoursByTypeFallback(
  car: CarWithCommodity,
  overrides: EvaluationOverrides
): HoursByType {
  const hours: HoursByType = {
    cleaning: DEFAULT_LABOR_HOURS.cleaning,
    flare: 0,
    mechanical: 0,
    blast: 0,
    lining: 0,
    paint: 0,
    other: 0,
  };

  // Add hours based on work needed
  if (overrides.interior_blast) {
    hours.blast = DEFAULT_LABOR_HOURS.blast;
  }

  if (overrides.new_lining || car.lining_type) {
    hours.lining = DEFAULT_LABOR_HOURS.lining;
  }

  if (overrides.exterior_paint) {
    hours.paint = DEFAULT_LABOR_HOURS.paint;
  }

  // Mechanical hours if car has any substantial work
  if (hours.blast > 0 || hours.lining > 0) {
    hours.mechanical = DEFAULT_LABOR_HOURS.mechanical;
  }

  // Flare work for nitrogen pad cars
  if (car.nitrogen_pad_stage && car.nitrogen_pad_stage > 0) {
    hours.flare = DEFAULT_LABOR_HOURS.flare;
  }

  return hours;
}

/**
 * Get the restriction code for a commodity-shop combination
 */
function getRestrictionCode(
  commodityCin: string | undefined,
  shopCode: string,
  restrictions: CommodityRestriction[]
): RestrictionCode | null {
  if (!commodityCin) {
    return null;
  }

  const restriction = restrictions.find(
    (r) => r.cin_code === commodityCin && r.shop_code === shopCode
  );

  return restriction?.restriction_code || null;
}

/**
 * Build a CarWithCommodity object from direct input
 * Used when evaluating without a car_number DB lookup
 */
function buildCarFromInput(input: DirectCarInput): CarWithCommodity {
  // Calculate derived fields (used for product_code normalization)
  const derived = calculateDerivedFields(input.product_code);

  return {
    car_number: 'DIRECT_INPUT',
    // Use the derived product_code_group for consistent product_code values
    product_code: derived.product_code_group !== 'Other' ? derived.product_code_group : input.product_code,
    material_type: input.material_type || 'Carbon Steel',
    stencil_class: input.stencil_class,
    lining_type: input.lining_type || input.current_lining,
    commodity_cin: input.commodity_cin,
    has_asbestos: input.has_asbestos || false,
    asbestos_abatement_required: input.asbestos_abatement_required || false,
    nitrogen_pad_stage: input.nitrogen_pad_stage,
  };
}

export default {
  evaluateShops,
};
