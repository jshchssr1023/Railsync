import {
  EvaluationRequestSchema,
  DirectCarInputSchema,
  EvaluationOverridesSchema,
  calculateDerivedFields,
} from './validation';

describe('Validation Schemas', () => {
  describe('DirectCarInputSchema', () => {
    it('should validate minimal car input', () => {
      const input = { product_code: 'Tank' };
      const result = DirectCarInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate full car input', () => {
      const input = {
        product_code: 'Tank',
        stencil_class: 'DOT111',
        material_type: 'Stainless',
        lease_rate: 50.00,
        commodity_cin: 'CIN001',
        car_cleaned_flag: true,
        lining_type: 'High Bake',
        current_lining: 'Epoxy',
        hm201_due: true,
        non_hm201_due: false,
        railroad_damage: false,
        nitrogen_pad_stage: 5,
        has_asbestos: false,
        asbestos_abatement_required: false,
      };
      const result = DirectCarInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty product_code', () => {
      const input = { product_code: '' };
      const result = DirectCarInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid material_type', () => {
      const input = { product_code: 'Tank', material_type: 'InvalidMaterial' };
      const result = DirectCarInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject nitrogen_pad_stage outside 0-9 range', () => {
      const input = { product_code: 'Tank', nitrogen_pad_stage: 10 };
      const result = DirectCarInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('EvaluationOverridesSchema', () => {
    it('should validate empty overrides', () => {
      const result = EvaluationOverridesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate all overrides', () => {
      const overrides = {
        exterior_paint: true,
        new_lining: true,
        interior_blast: true,
        kosher_cleaning: true,
        primary_network: true,
        blast_type: 'Commercial',
        lining_type: 'Rubber',
      };
      const result = EvaluationOverridesSchema.safeParse(overrides);
      expect(result.success).toBe(true);
    });

    it('should reject invalid blast_type', () => {
      const overrides = { blast_type: 'InvalidBlast' };
      const result = EvaluationOverridesSchema.safeParse(overrides);
      expect(result.success).toBe(false);
    });

    it('should reject unknown properties', () => {
      const overrides = { unknown_field: true };
      const result = EvaluationOverridesSchema.safeParse(overrides);
      expect(result.success).toBe(false);
    });
  });

  describe('EvaluationRequestSchema', () => {
    it('should validate car_number request', () => {
      const request = { car_number: 'UTLX123456' };
      const result = EvaluationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate car_input request', () => {
      const request = {
        car_input: { product_code: 'Tank' },
        origin_region: 'Midwest',
      };
      const result = EvaluationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate request with both car_number and car_input', () => {
      const request = {
        car_number: 'UTLX123456',
        car_input: { product_code: 'Tank' },
      };
      const result = EvaluationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject request without car_number or car_input', () => {
      const request = { origin_region: 'Midwest' };
      const result = EvaluationRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should validate full request with overrides', () => {
      const request = {
        car_number: 'UTLX123456',
        overrides: {
          exterior_paint: true,
          primary_network: true,
        },
        origin_region: 'Southeast',
      };
      const result = EvaluationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });
});

describe('Derived Field Calculations', () => {
  describe('calculateDerivedFields', () => {
    it('should identify tank cars', () => {
      const derived = calculateDerivedFields('Tank');
      expect(derived.is_tank).toBe(true);
      expect(derived.product_code_group).toBe('Tank');
      expect(derived.is_hopper).toBe(false);
    });

    it('should identify tank cars from DOT codes', () => {
      const derived = calculateDerivedFields('DOT111A100W');
      expect(derived.is_tank).toBe(true);
      expect(derived.product_code_group).toBe('Tank');
    });

    it('should identify covered hoppers', () => {
      const derived = calculateDerivedFields('Covered Hopper');
      expect(derived.is_covered_hopper).toBe(true);
      expect(derived.is_hopper).toBe(true);
      expect(derived.product_code_group).toBe('Covered Hopper');
    });

    it('should identify boxcars', () => {
      const derived = calculateDerivedFields('Boxcar');
      expect(derived.is_boxcar).toBe(true);
      expect(derived.product_code_group).toBe('Boxcar');
    });

    it('should identify gondolas', () => {
      const derived = calculateDerivedFields('Gondola');
      expect(derived.is_gondola).toBe(true);
      expect(derived.product_code_group).toBe('Gondola');
    });

    it('should identify flatcars', () => {
      const derived = calculateDerivedFields('Flatcar');
      expect(derived.is_flatcar).toBe(true);
      expect(derived.product_code_group).toBe('Flatcar');
    });

    it('should identify autoracks', () => {
      const derived = calculateDerivedFields('Autorack');
      expect(derived.is_autorack).toBe(true);
      expect(derived.product_code_group).toBe('Autorack');
    });

    it('should set product_code_group to Other for unknown types', () => {
      const derived = calculateDerivedFields('UnknownType');
      expect(derived.product_code_group).toBe('Other');
    });

    it('should set requires_hm201 for tank cars with hazmat', () => {
      const derived = calculateDerivedFields('Tank', 'Class 8');
      expect(derived.requires_hm201).toBe(true);
    });

    it('should not set requires_hm201 for tank cars without hazmat', () => {
      const derived = calculateDerivedFields('Tank', null);
      expect(derived.requires_hm201).toBe(false);
    });

    it('should not set requires_hm201 for non-tank cars with hazmat', () => {
      const derived = calculateDerivedFields('Boxcar', 'Class 8');
      expect(derived.requires_hm201).toBe(false);
    });

    it('should handle case-insensitive product codes', () => {
      const derived = calculateDerivedFields('TANK');
      expect(derived.is_tank).toBe(true);
      expect(derived.product_code_group).toBe('Tank');
    });
  });
});
