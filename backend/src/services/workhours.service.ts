import { query, queryOne } from '../config/database';
import { CarWithCommodity, EvaluationOverrides, HoursByType } from '../types';

interface WorkHoursFactor {
  factor_type: string;
  factor_value: string;
  work_type: string;
  base_hours: number;
  multiplier: number;
}

// Default base hours if no factors found
const DEFAULT_BASE_HOURS: Record<string, number> = {
  cleaning: 4,
  flare: 2,
  mechanical: 8,
  blast: 6,
  lining: 12,
  paint: 4,
  other: 2,
};

/**
 * Get work hours factors from database
 */
export async function getWorkHoursFactors(
  factorType: string,
  factorValue: string
): Promise<WorkHoursFactor[]> {
  return query<WorkHoursFactor>(
    `SELECT factor_type, factor_value, work_type, base_hours, multiplier
     FROM work_hours_factors
     WHERE factor_type = $1 AND factor_value = $2
       AND effective_date <= CURRENT_DATE
     ORDER BY effective_date DESC`,
    [factorType, factorValue]
  );
}

/**
 * Get multiplier for a specific factor
 */
export async function getFactorMultiplier(
  factorType: string,
  factorValue: string,
  workType: string
): Promise<number> {
  const factor = await queryOne<WorkHoursFactor>(
    `SELECT multiplier
     FROM work_hours_factors
     WHERE factor_type = $1 AND factor_value = $2 AND work_type = $3
       AND effective_date <= CURRENT_DATE
     ORDER BY effective_date DESC
     LIMIT 1`,
    [factorType, factorValue, workType]
  );

  return factor?.multiplier || 1.0;
}

/**
 * Get base hours for a specific factor
 */
export async function getFactorBaseHours(
  factorType: string,
  factorValue: string,
  workType: string
): Promise<number> {
  const factor = await queryOne<WorkHoursFactor>(
    `SELECT base_hours
     FROM work_hours_factors
     WHERE factor_type = $1 AND factor_value = $2 AND work_type = $3
       AND effective_date <= CURRENT_DATE
     ORDER BY effective_date DESC
     LIMIT 1`,
    [factorType, factorValue, workType]
  );

  return factor?.base_hours || 0;
}

/**
 * Calculate work hours using factor-based estimation model
 *
 * The model considers:
 * 1. Car type base hours
 * 2. Material type multipliers
 * 3. Cleaning class multipliers (from commodity)
 * 4. Lining type additional hours
 * 5. Special requirements (kosher, asbestos, nitrogen)
 */
export async function calculateWorkHours(
  car: CarWithCommodity,
  overrides: EvaluationOverrides
): Promise<HoursByType> {
  const hours: HoursByType = {
    cleaning: 0,
    flare: 0,
    mechanical: 0,
    blast: 0,
    lining: 0,
    paint: 0,
    other: 0,
  };

  // Get product code group for car type base hours
  const productCode = car.product_code || 'Tank';

  // Fetch base hours for this car type
  const carTypeFactors = await getWorkHoursFactors('car_type', productCode);

  // Apply car type base hours
  for (const factor of carTypeFactors) {
    const workType = factor.work_type as keyof HoursByType;
    if (workType in hours) {
      hours[workType] += factor.base_hours;
    }
  }

  // If no factors found, use defaults
  if (carTypeFactors.length === 0) {
    hours.cleaning = DEFAULT_BASE_HOURS.cleaning;
  }

  // Apply material type multipliers
  const materialType = car.material_type || 'Carbon Steel';
  for (const workType of Object.keys(hours) as Array<keyof HoursByType>) {
    if (hours[workType] > 0) {
      const multiplier = await getFactorMultiplier('material', materialType, workType);
      hours[workType] *= multiplier;
    }
  }

  // Apply cleaning class multiplier (if commodity has cleaning class)
  const cleaningClass = car.commodity?.cleaning_class || 'A';
  const cleaningMultiplier = await getFactorMultiplier('cleaning_class', cleaningClass, 'cleaning');
  hours.cleaning *= cleaningMultiplier;

  // Add lining-specific hours if new lining or car has lining
  if (overrides.new_lining || car.lining_type) {
    const liningType = overrides.lining_type || car.lining_type || 'Epoxy';
    const liningAdditional = await getFactorBaseHours('lining', liningType, 'lining');
    hours.lining += liningAdditional || DEFAULT_BASE_HOURS.lining;
  }

  // Add blast hours if interior blast requested
  if (overrides.interior_blast) {
    if (hours.blast === 0) {
      hours.blast = DEFAULT_BASE_HOURS.blast;
    }
    // Apply material multiplier to blast
    const blastMultiplier = await getFactorMultiplier('material', materialType, 'blast');
    hours.blast *= blastMultiplier;
  }

  // Add paint hours if exterior paint requested
  if (overrides.exterior_paint) {
    hours.paint = DEFAULT_BASE_HOURS.paint;
  }

  // Add mechanical hours if substantial work being done
  if (hours.blast > 0 || hours.lining > 0) {
    if (hours.mechanical === 0) {
      hours.mechanical = DEFAULT_BASE_HOURS.mechanical;
    }
  }

  // Add flare hours for nitrogen pad cars
  if (car.nitrogen_pad_stage && car.nitrogen_pad_stage > 0) {
    const nitrogenHours = await getFactorBaseHours('special', 'Nitrogen', 'other');
    hours.flare = DEFAULT_BASE_HOURS.flare;
    // Add extra hours per nitrogen stage
    hours.other += (nitrogenHours || 1) * car.nitrogen_pad_stage;
  }

  // Add kosher cleaning premium hours
  if (car.commodity?.requires_kosher || overrides.kosher_cleaning) {
    const kosherHours = await getFactorBaseHours('special', 'Kosher', 'cleaning');
    hours.cleaning += kosherHours || 2;
  }

  // Add asbestos abatement hours
  if (car.asbestos_abatement_required) {
    const asbestosHours = await getFactorBaseHours('special', 'Asbestos', 'other');
    hours.other += asbestosHours || 8;
  }

  // Round all values to 1 decimal place
  for (const key of Object.keys(hours) as Array<keyof HoursByType>) {
    hours[key] = Math.round(hours[key] * 10) / 10;
  }

  return hours;
}

/**
 * Get total estimated hours for a job
 */
export function getTotalHours(hours: HoursByType): number {
  return Object.values(hours).reduce((sum, h) => sum + h, 0);
}

export default {
  getWorkHoursFactors,
  getFactorMultiplier,
  getFactorBaseHours,
  calculateWorkHours,
  getTotalHours,
};
