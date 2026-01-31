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
} from '../types';

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
  // Fetch car data
  const car = await carModel.findByCarNumber(request.car_number);
  if (!car) {
    throw new Error(`Car not found: ${request.car_number}`);
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

  // Calculate freight cost
  let freightCost = 0;
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
  };
}

export default {
  evaluateShops,
};
