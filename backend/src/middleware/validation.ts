import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ============================================================================
// Product Code Groups for derived fields
// ============================================================================
export const PRODUCT_CODE_GROUPS = {
  TANK: ['Tank', 'DOT111', 'DOT105', 'DOT117', 'AAR211'],
  HOPPER: ['Hopper', 'Covered Hopper', 'Open Hopper'],
  COVERED_HOPPER: ['Covered Hopper', 'CoveredHopper'],
  BOXCAR: ['Boxcar', 'Box'],
  GONDOLA: ['Gondola', 'Gon'],
  FLATCAR: ['Flatcar', 'Flat'],
  AUTORACK: ['Autorack', 'Auto'],
} as const;

// ============================================================================
// Zod Schemas
// ============================================================================

// Material types
const MaterialTypeSchema = z.enum(['Carbon Steel', 'Stainless', 'Aluminum']);

// Evaluation overrides schema
export const EvaluationOverridesSchema = z.object({
  exterior_paint: z.boolean().optional(),
  new_lining: z.boolean().optional(),
  interior_blast: z.boolean().optional(),
  kosher_cleaning: z.boolean().optional(),
  primary_network: z.boolean().optional(),
  // Extended overrides for Phase 3
  blast_type: z.enum(['Brush', 'Commercial', 'WhiteMetal', 'None']).optional(),
  lining_type: z.string().optional(),
}).strict();

// Direct car input schema (when not using car_number lookup)
export const DirectCarInputSchema = z.object({
  // Car Identity
  product_code: z.string().min(1, 'Product code is required'),
  stencil_class: z.string().optional(),

  // Car Attributes
  material_type: MaterialTypeSchema.optional().default('Carbon Steel'),
  lease_rate: z.number().positive().optional(),

  // Commodity
  commodity_cin: z.string().optional(),
  car_cleaned_flag: z.boolean().optional().default(false),

  // Lining
  lining_type: z.string().optional(),
  current_lining: z.string().optional(),

  // Compliance
  hm201_due: z.boolean().optional().default(false),
  non_hm201_due: z.boolean().optional().default(false),
  railroad_damage: z.boolean().optional().default(false),

  // Special
  nitrogen_pad_stage: z.number().int().min(0).max(9).optional(),
  has_asbestos: z.boolean().optional().default(false),
  asbestos_abatement_required: z.boolean().optional().default(false),
});

// Full evaluation request schema
export const EvaluationRequestSchema = z.object({
  // Option 1: Lookup car by number
  car_number: z.string().optional(),

  // Option 2: Direct car input (for evaluation without DB lookup)
  car_input: DirectCarInputSchema.optional(),

  // Evaluation parameters
  overrides: EvaluationOverridesSchema.optional(),
  origin_region: z.string().optional(),
}).refine(
  (data) => data.car_number || data.car_input,
  { message: 'Either car_number or car_input is required' }
);

// ============================================================================
// Derived Field Calculations
// ============================================================================

export interface DerivedCarFields {
  product_code_group: string;
  is_tank: boolean;
  is_hopper: boolean;
  is_covered_hopper: boolean;
  is_boxcar: boolean;
  is_gondola: boolean;
  is_flatcar: boolean;
  is_autorack: boolean;
  requires_hm201: boolean;
}

/**
 * Calculate derived fields from product code
 */
export function calculateDerivedFields(productCode: string, hazmatClass?: string | null): DerivedCarFields {
  const normalizedCode = productCode.toLowerCase();

  const isTank = PRODUCT_CODE_GROUPS.TANK.some(t => normalizedCode.includes(t.toLowerCase()));
  const isHopper = PRODUCT_CODE_GROUPS.HOPPER.some(h => normalizedCode.includes(h.toLowerCase()));
  const isCoveredHopper = PRODUCT_CODE_GROUPS.COVERED_HOPPER.some(ch => normalizedCode.includes(ch.toLowerCase()));
  const isBoxcar = PRODUCT_CODE_GROUPS.BOXCAR.some(b => normalizedCode.includes(b.toLowerCase()));
  const isGondola = PRODUCT_CODE_GROUPS.GONDOLA.some(g => normalizedCode.includes(g.toLowerCase()));
  const isFlatcar = PRODUCT_CODE_GROUPS.FLATCAR.some(f => normalizedCode.includes(f.toLowerCase()));
  const isAutorack = PRODUCT_CODE_GROUPS.AUTORACK.some(a => normalizedCode.includes(a.toLowerCase()));

  // Determine product code group
  let productCodeGroup = 'Other';
  if (isTank) productCodeGroup = 'Tank';
  else if (isCoveredHopper) productCodeGroup = 'Covered Hopper';
  else if (isHopper) productCodeGroup = 'Hopper';
  else if (isBoxcar) productCodeGroup = 'Boxcar';
  else if (isGondola) productCodeGroup = 'Gondola';
  else if (isFlatcar) productCodeGroup = 'Flatcar';
  else if (isAutorack) productCodeGroup = 'Autorack';

  // HM201 required for regulated tank cars with hazmat
  const requiresHm201 = isTank && !!hazmatClass;

  return {
    product_code_group: productCodeGroup,
    is_tank: isTank,
    is_hopper: isHopper,
    is_covered_hopper: isCoveredHopper,
    is_boxcar: isBoxcar,
    is_gondola: isGondola,
    is_flatcar: isFlatcar,
    is_autorack: isAutorack,
    requires_hm201: requiresHm201,
  };
}

// ============================================================================
// Validation Middleware
// ============================================================================

export type ValidatedEvaluationRequest = z.infer<typeof EvaluationRequestSchema>;

/**
 * Middleware to validate evaluation request body
 */
export function validateEvaluationRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const result = EvaluationRequestSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  // Attach validated data to request
  req.body = result.data;
  next();
}

export default {
  validateEvaluationRequest,
  calculateDerivedFields,
  EvaluationRequestSchema,
  EvaluationOverridesSchema,
  DirectCarInputSchema,
};
