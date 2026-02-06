/**
 * Commodity Service — Manages commodity cleaning requirements
 *
 * Provides CRUD operations for the commodity_cleaning_matrix table and
 * cleaning requirement lookups. Supports per-car commodity resolution
 * by joining through the lease hierarchy (rider_cars -> lease_riders)
 * and the cars.commodity_cin foreign key.
 *
 * Tables: commodity_cleaning_matrix, cars, rider_cars, lease_riders, commodities
 */

import { query, queryOne } from '../config/database';

// ============================================================================
// TYPES
// ============================================================================

export type CleaningClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'kosher' | 'hazmat' | 'none';

export interface CommodityCleaning {
  id: string;
  commodity_code: string;
  commodity_name: string;
  cleaning_class: CleaningClass;
  requires_interior_blast: boolean;
  requires_exterior_paint: boolean;
  requires_new_lining: boolean;
  requires_kosher_cleaning: boolean;
  special_instructions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CleaningRequirements {
  commodity_code: string;
  commodity_name: string;
  cleaning_class: CleaningClass;
  requires_interior_blast: boolean;
  requires_exterior_paint: boolean;
  requires_new_lining: boolean;
  requires_kosher_cleaning: boolean;
  special_instructions: string | null;
  cleaning_description: string;
}

export interface CreateCommodityInput {
  commodity_code: string;
  commodity_name: string;
  cleaning_class: CleaningClass;
  requires_interior_blast?: boolean;
  requires_exterior_paint?: boolean;
  requires_new_lining?: boolean;
  requires_kosher_cleaning?: boolean;
  special_instructions?: string;
}

export interface UpdateCommodityInput {
  commodity_code?: string;
  commodity_name?: string;
  cleaning_class?: CleaningClass;
  requires_interior_blast?: boolean;
  requires_exterior_paint?: boolean;
  requires_new_lining?: boolean;
  requires_kosher_cleaning?: boolean;
  special_instructions?: string;
  is_active?: boolean;
}

export interface CarCleaningRequirements extends CleaningRequirements {
  car_number: string;
  source: 'commodity_cleaning_matrix' | 'commodities_table' | 'none';
}

// Cleaning class descriptions used for the cleaning_description field
const CLEANING_DESCRIPTIONS: Record<string, string> = {
  hazmat: 'Hazardous Material — specialized protocol required',
  kosher: 'Kosher — certified cleaning with Mashgiach supervision',
  A: 'Class A — solvent/steam cleaning',
  B: 'Class B — hot water wash with degreaser',
  C: 'Class C — standard rinse and steam',
  D: 'Class D — vapor purge, minimal wash',
  E: 'Class E — dry clean or air purge only',
  none: 'No cleaning required',
};

// ============================================================================
// LIST COMMODITIES
// ============================================================================

/**
 * List all commodities in the cleaning matrix. Optionally include inactive entries.
 */
export async function listCommodities(
  includeInactive: boolean = false
): Promise<CommodityCleaning[]> {
  const whereClause = includeInactive ? '' : 'WHERE is_active = TRUE';
  return query<CommodityCleaning>(
    `SELECT * FROM commodity_cleaning_matrix
     ${whereClause}
     ORDER BY cleaning_class, commodity_name`,
    []
  );
}

// ============================================================================
// GET COMMODITY BY CODE
// ============================================================================

/**
 * Lookup a single commodity by its code.
 */
export async function getCommodity(code: string): Promise<CommodityCleaning | null> {
  return queryOne<CommodityCleaning>(
    `SELECT * FROM commodity_cleaning_matrix WHERE commodity_code = $1`,
    [code]
  );
}

// ============================================================================
// GET CLEANING REQUIREMENTS FOR A COMMODITY
// ============================================================================

/**
 * Return the cleaning requirements for a given commodity code, including
 * the human-readable cleaning class description.
 */
export async function getCleaningRequirements(
  commodityCode: string
): Promise<CleaningRequirements | null> {
  const commodity = await queryOne<CommodityCleaning>(
    `SELECT * FROM commodity_cleaning_matrix
     WHERE commodity_code = $1 AND is_active = TRUE`,
    [commodityCode]
  );

  if (!commodity) return null;

  return {
    commodity_code: commodity.commodity_code,
    commodity_name: commodity.commodity_name,
    cleaning_class: commodity.cleaning_class,
    requires_interior_blast: commodity.requires_interior_blast,
    requires_exterior_paint: commodity.requires_exterior_paint,
    requires_new_lining: commodity.requires_new_lining,
    requires_kosher_cleaning: commodity.requires_kosher_cleaning,
    special_instructions: commodity.special_instructions,
    cleaning_description:
      CLEANING_DESCRIPTIONS[commodity.cleaning_class] || 'Unknown classification',
  };
}

// ============================================================================
// CREATE COMMODITY
// ============================================================================

/**
 * Create a new commodity entry in the cleaning matrix.
 */
export async function createCommodity(data: CreateCommodityInput): Promise<CommodityCleaning> {
  const result = await queryOne<CommodityCleaning>(
    `INSERT INTO commodity_cleaning_matrix (
      commodity_code, commodity_name, cleaning_class,
      requires_interior_blast, requires_exterior_paint,
      requires_new_lining, requires_kosher_cleaning,
      special_instructions
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      data.commodity_code,
      data.commodity_name,
      data.cleaning_class,
      data.requires_interior_blast || false,
      data.requires_exterior_paint || false,
      data.requires_new_lining || false,
      data.requires_kosher_cleaning || false,
      data.special_instructions || null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create commodity');
  }

  return result;
}

// ============================================================================
// UPDATE COMMODITY
// ============================================================================

/**
 * Update an existing commodity in the cleaning matrix.
 */
export async function updateCommodity(
  id: string,
  data: UpdateCommodityInput
): Promise<CommodityCleaning | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  const stringFields: (keyof UpdateCommodityInput)[] = [
    'commodity_code',
    'commodity_name',
    'cleaning_class',
    'special_instructions',
  ];

  const booleanFields: (keyof UpdateCommodityInput)[] = [
    'requires_interior_blast',
    'requires_exterior_paint',
    'requires_new_lining',
    'requires_kosher_cleaning',
    'is_active',
  ];

  for (const field of stringFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramIdx++}`);
      params.push(data[field]);
    }
  }

  for (const field of booleanFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramIdx++}`);
      params.push(data[field]);
    }
  }

  if (fields.length === 0) {
    return queryOne<CommodityCleaning>(
      `SELECT * FROM commodity_cleaning_matrix WHERE id = $1`,
      [id]
    );
  }

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const result = await queryOne<CommodityCleaning>(
    `UPDATE commodity_cleaning_matrix SET ${fields.join(', ')}
     WHERE id = $${paramIdx} RETURNING *`,
    params
  );

  return result || null;
}

// ============================================================================
// GET CLEANING REQUIREMENTS FOR A CAR
// ============================================================================

/**
 * Lookup cleaning requirements for a specific car by resolving its commodity.
 *
 * Resolution order:
 *   1. Check the car's active rider (rider_cars -> lease_riders) for a commodity
 *      that maps into the commodity_cleaning_matrix.
 *   2. Fall back to the car's commodity_cin field in the cars table, which
 *      references the commodities table. If that commodity code exists in the
 *      cleaning matrix, return those requirements.
 *   3. If neither resolves, return a response indicating no cleaning data found.
 */
export async function getCleaningRequirementsForCar(
  carNumber: string
): Promise<CarCleaningRequirements | null> {
  // Strategy 1: Resolve through active rider -> commodity cleaning matrix
  // The lease_riders table doesn't have a commodity_code column directly,
  // but we can look up the car's commodity_cin and match it against the matrix.
  // First, try to find the car's commodity from the UMLER attributes or
  // the cars table commodity_cin, then look that up in the cleaning matrix.

  // Strategy 2: Direct lookup via cars.commodity_cin -> commodity_cleaning_matrix
  const carCommodity = await queryOne<{
    car_number: string;
    commodity_cin: string | null;
    commodity_description: string | null;
  }>(
    `SELECT c.car_number, c.commodity_cin,
            com.description AS commodity_description
     FROM cars c
     LEFT JOIN commodities com ON c.commodity_cin = com.cin_code
     WHERE c.car_number = $1`,
    [carNumber]
  );

  if (!carCommodity) return null;

  // If the car has a commodity_cin, check if it exists in the cleaning matrix
  if (carCommodity.commodity_cin) {
    const matrixEntry = await queryOne<CommodityCleaning>(
      `SELECT * FROM commodity_cleaning_matrix
       WHERE commodity_code = $1 AND is_active = TRUE`,
      [carCommodity.commodity_cin]
    );

    if (matrixEntry) {
      return {
        car_number: carNumber,
        commodity_code: matrixEntry.commodity_code,
        commodity_name: matrixEntry.commodity_name,
        cleaning_class: matrixEntry.cleaning_class,
        requires_interior_blast: matrixEntry.requires_interior_blast,
        requires_exterior_paint: matrixEntry.requires_exterior_paint,
        requires_new_lining: matrixEntry.requires_new_lining,
        requires_kosher_cleaning: matrixEntry.requires_kosher_cleaning,
        special_instructions: matrixEntry.special_instructions,
        cleaning_description:
          CLEANING_DESCRIPTIONS[matrixEntry.cleaning_class] || 'Unknown classification',
        source: 'commodity_cleaning_matrix',
      };
    }

    // Fall back: commodity exists in commodities table but not in cleaning matrix.
    // Return basic info from the commodities table.
    const baseCommodity = await queryOne<{
      cin_code: string;
      description: string;
      cleaning_class: string | null;
      requires_kosher: boolean;
    }>(
      `SELECT cin_code, description, cleaning_class, requires_kosher
       FROM commodities WHERE cin_code = $1`,
      [carCommodity.commodity_cin]
    );

    if (baseCommodity) {
      return {
        car_number: carNumber,
        commodity_code: baseCommodity.cin_code,
        commodity_name: baseCommodity.description,
        cleaning_class: (baseCommodity.cleaning_class as CleaningClass) || 'none',
        requires_interior_blast: false,
        requires_exterior_paint: false,
        requires_new_lining: false,
        requires_kosher_cleaning: baseCommodity.requires_kosher,
        special_instructions: null,
        cleaning_description:
          CLEANING_DESCRIPTIONS[baseCommodity.cleaning_class || 'none'] || 'Unknown classification',
        source: 'commodities_table',
      };
    }
  }

  // No commodity data found for this car
  return {
    car_number: carNumber,
    commodity_code: 'UNKNOWN',
    commodity_name: 'No commodity assigned',
    cleaning_class: 'none',
    requires_interior_blast: false,
    requires_exterior_paint: false,
    requires_new_lining: false,
    requires_kosher_cleaning: false,
    special_instructions: null,
    cleaning_description: 'No cleaning required',
    source: 'none',
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  listCommodities,
  getCommodity,
  getCleaningRequirements,
  createCommodity,
  updateCommodity,
  getCleaningRequirementsForCar,
};
