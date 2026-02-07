/**
 * Commodity Service Tests
 *
 * Tests CRUD operations for the commodity_cleaning_matrix table,
 * cleaning requirement lookups, per-car commodity resolution, and
 * alias functions.
 */

import {
  listCommodities,
  getCommodity,
  getCommodityByCode,
  getCleaningRequirements,
  createCommodity,
  updateCommodity,
  getCleaningRequirementsForCar,
  getCarCleaningRequirements,
  CommodityCleaning,
  CreateCommodityInput,
} from '../services/commodity.service';

// Mock the database module — only dependency
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
}));

import { query, queryOne } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

// ============================================================================
// HELPERS
// ============================================================================

function createMockCommodity(overrides: Partial<CommodityCleaning> = {}): CommodityCleaning {
  return {
    id: 'comm-1',
    commodity_code: 'CORN',
    commodity_name: 'Corn',
    cleaning_class: 'B',
    requires_interior_blast: false,
    requires_exterior_paint: false,
    requires_new_lining: false,
    requires_kosher_cleaning: false,
    special_instructions: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Commodity Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // listCommodities
  // ==========================================================================
  describe('listCommodities', () => {
    it('should return all active commodities by default', async () => {
      const commodities = [
        createMockCommodity({ id: 'comm-1', commodity_code: 'CORN' }),
        createMockCommodity({ id: 'comm-2', commodity_code: 'WHEAT', commodity_name: 'Wheat' }),
      ];
      mockQuery.mockResolvedValueOnce(commodities);

      const result = await listCommodities();

      expect(result).toEqual(commodities);
      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      // Default call should filter by is_active
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('WHERE is_active = TRUE');
      expect(sql).toContain('ORDER BY cleaning_class, commodity_name');
    });

    it('should include inactive commodities when includeInactive is true', async () => {
      const commodities = [
        createMockCommodity({ id: 'comm-1', is_active: true }),
        createMockCommodity({ id: 'comm-2', is_active: false, commodity_code: 'SODA' }),
      ];
      mockQuery.mockResolvedValueOnce(commodities);

      const result = await listCommodities(true);

      expect(result).toEqual(commodities);
      expect(result).toHaveLength(2);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).not.toContain('WHERE is_active = TRUE');
    });

    it('should return empty array when no commodities exist', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await listCommodities();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getCommodity
  // ==========================================================================
  describe('getCommodity', () => {
    it('should return the commodity when found', async () => {
      const commodity = createMockCommodity({ commodity_code: 'ETHANOL' });
      mockQueryOne.mockResolvedValueOnce(commodity);

      const result = await getCommodity('ETHANOL');

      expect(result).toEqual(commodity);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE commodity_code = $1'),
        ['ETHANOL']
      );
    });

    it('should return null when commodity is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getCommodity('NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should handle empty code string', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getCommodity('');

      expect(result).toBeNull();
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.any(String),
        ['']
      );
    });
  });

  // ==========================================================================
  // getCommodityByCode (alias)
  // ==========================================================================
  describe('getCommodityByCode', () => {
    it('should be an alias for getCommodity', () => {
      expect(getCommodityByCode).toBe(getCommodity);
    });
  });

  // ==========================================================================
  // getCleaningRequirements
  // ==========================================================================
  describe('getCleaningRequirements', () => {
    it('should return cleaning requirements with human-readable description', async () => {
      const commodity = createMockCommodity({
        commodity_code: 'CORN',
        commodity_name: 'Corn',
        cleaning_class: 'B',
      });
      mockQueryOne.mockResolvedValueOnce(commodity);

      const result = await getCleaningRequirements('CORN');

      expect(result).not.toBeNull();
      expect(result!.commodity_code).toBe('CORN');
      expect(result!.commodity_name).toBe('Corn');
      expect(result!.cleaning_class).toBe('B');
      expect(result!.cleaning_description).toBe('Class B — hot water wash with degreaser');
      expect(result!.requires_interior_blast).toBe(false);
      expect(result!.requires_exterior_paint).toBe(false);
      expect(result!.requires_new_lining).toBe(false);
      expect(result!.requires_kosher_cleaning).toBe(false);
      expect(result!.special_instructions).toBeNull();
    });

    it('should return correct description for hazmat class', async () => {
      const commodity = createMockCommodity({
        commodity_code: 'HCL',
        commodity_name: 'Hydrochloric Acid',
        cleaning_class: 'hazmat',
        requires_interior_blast: true,
      });
      mockQueryOne.mockResolvedValueOnce(commodity);

      const result = await getCleaningRequirements('HCL');

      expect(result).not.toBeNull();
      expect(result!.cleaning_class).toBe('hazmat');
      expect(result!.cleaning_description).toBe(
        'Hazardous Material — specialized protocol required'
      );
      expect(result!.requires_interior_blast).toBe(true);
    });

    it('should return correct description for kosher class', async () => {
      const commodity = createMockCommodity({
        commodity_code: 'KOSHER-OIL',
        commodity_name: 'Kosher Vegetable Oil',
        cleaning_class: 'kosher',
        requires_kosher_cleaning: true,
      });
      mockQueryOne.mockResolvedValueOnce(commodity);

      const result = await getCleaningRequirements('KOSHER-OIL');

      expect(result).not.toBeNull();
      expect(result!.cleaning_description).toBe(
        'Kosher — certified cleaning with Mashgiach supervision'
      );
      expect(result!.requires_kosher_cleaning).toBe(true);
    });

    it('should return null when commodity is not found or inactive', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getCleaningRequirements('INACTIVE-ITEM');

      expect(result).toBeNull();
      // Verify the query filters by is_active = TRUE
      const sql = mockQueryOne.mock.calls[0][0] as string;
      expect(sql).toContain('is_active = TRUE');
    });

    it('should return "Unknown classification" for unrecognized cleaning class', async () => {
      const commodity = createMockCommodity({
        cleaning_class: 'Z' as any, // Not in CLEANING_DESCRIPTIONS
      });
      mockQueryOne.mockResolvedValueOnce(commodity);

      const result = await getCleaningRequirements('UNKNOWN');

      expect(result).not.toBeNull();
      expect(result!.cleaning_description).toBe('Unknown classification');
    });
  });

  // ==========================================================================
  // createCommodity
  // ==========================================================================
  describe('createCommodity', () => {
    it('should create a new commodity and return the created row', async () => {
      const input: CreateCommodityInput = {
        commodity_code: 'BENZENE',
        commodity_name: 'Benzene',
        cleaning_class: 'hazmat',
        requires_interior_blast: true,
        requires_exterior_paint: true,
        requires_new_lining: false,
        requires_kosher_cleaning: false,
        special_instructions: 'Handle with extreme care',
      };

      const created = createMockCommodity({
        id: 'comm-new',
        commodity_code: 'BENZENE',
        commodity_name: 'Benzene',
        cleaning_class: 'hazmat',
        requires_interior_blast: true,
        requires_exterior_paint: true,
        special_instructions: 'Handle with extreme care',
      });
      mockQueryOne.mockResolvedValueOnce(created);

      const result = await createCommodity(input, 'user-42');

      expect(result).toEqual(created);
      expect(result.commodity_code).toBe('BENZENE');
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO commodity_cleaning_matrix');
      expect(sql).toContain('RETURNING *');
      expect(params).toEqual([
        'BENZENE',
        'Benzene',
        'hazmat',
        true,
        true,
        false,
        false,
        'Handle with extreme care',
      ]);
    });

    it('should default optional boolean fields to false and special_instructions to null', async () => {
      const input: CreateCommodityInput = {
        commodity_code: 'SAND',
        commodity_name: 'Sand',
        cleaning_class: 'E',
      };

      const created = createMockCommodity({
        id: 'comm-sand',
        commodity_code: 'SAND',
        commodity_name: 'Sand',
        cleaning_class: 'E',
      });
      mockQueryOne.mockResolvedValueOnce(created);

      const result = await createCommodity(input);

      expect(result).toEqual(created);
      const params = mockQueryOne.mock.calls[0][1];
      // Booleans default to false, special_instructions defaults to null
      expect(params).toEqual(['SAND', 'Sand', 'E', false, false, false, false, null]);
    });

    it('should throw an error when the insert fails (returns null)', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const input: CreateCommodityInput = {
        commodity_code: 'FAIL',
        commodity_name: 'Fail Item',
        cleaning_class: 'A',
      };

      await expect(createCommodity(input)).rejects.toThrow('Failed to create commodity');
    });
  });

  // ==========================================================================
  // updateCommodity
  // ==========================================================================
  describe('updateCommodity', () => {
    it('should update specified fields and return the updated commodity', async () => {
      const updated = createMockCommodity({
        id: 'comm-1',
        commodity_name: 'Corn (Updated)',
        cleaning_class: 'A',
      });
      mockQueryOne.mockResolvedValueOnce(updated);

      const result = await updateCommodity('comm-1', {
        commodity_name: 'Corn (Updated)',
        cleaning_class: 'A',
      });

      expect(result).toEqual(updated);
      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('UPDATE commodity_cleaning_matrix SET');
      expect(sql).toContain('updated_at = NOW()');
      expect(sql).toContain('RETURNING *');
      // commodity_name = $1, cleaning_class = $2, updated_at = NOW() WHERE id = $3
      expect(params).toEqual(['Corn (Updated)', 'A', 'comm-1']);
    });

    it('should handle partial update with only boolean fields', async () => {
      const updated = createMockCommodity({
        id: 'comm-1',
        requires_interior_blast: true,
        is_active: false,
      });
      mockQueryOne.mockResolvedValueOnce(updated);

      const result = await updateCommodity('comm-1', {
        requires_interior_blast: true,
        is_active: false,
      });

      expect(result).toEqual(updated);
      const params = mockQueryOne.mock.calls[0][1];
      // requires_interior_blast = $1, is_active = $2, updated_at = NOW() WHERE id = $3
      expect(params).toEqual([true, false, 'comm-1']);
    });

    it('should return the current record without updating when no fields provided', async () => {
      const existing = createMockCommodity({ id: 'comm-1' });
      mockQueryOne.mockResolvedValueOnce(existing);

      const result = await updateCommodity('comm-1', {});

      expect(result).toEqual(existing);
      const sql = mockQueryOne.mock.calls[0][0] as string;
      // Should be a SELECT, not an UPDATE
      expect(sql).toContain('SELECT * FROM commodity_cleaning_matrix WHERE id = $1');
      expect(sql).not.toContain('UPDATE');
    });

    it('should return null when the commodity to update is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await updateCommodity('nonexistent-id', {
        commodity_name: 'Ghost',
      });

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getCleaningRequirementsForCar
  // ==========================================================================
  describe('getCleaningRequirementsForCar', () => {
    it('should return cleaning requirements from the commodity_cleaning_matrix (priority 1)', async () => {
      // First call: car lookup with commodity JOIN
      mockQueryOne.mockResolvedValueOnce({
        car_number: 'RAIL-1001',
        commodity_cin: 'CORN',
        commodity_description: 'Corn',
      });
      // Second call: cleaning matrix lookup
      const matrixEntry = createMockCommodity({
        commodity_code: 'CORN',
        commodity_name: 'Corn',
        cleaning_class: 'B',
      });
      mockQueryOne.mockResolvedValueOnce(matrixEntry);

      const result = await getCleaningRequirementsForCar('RAIL-1001');

      expect(result).not.toBeNull();
      expect(result!.car_number).toBe('RAIL-1001');
      expect(result!.commodity_code).toBe('CORN');
      expect(result!.cleaning_class).toBe('B');
      expect(result!.cleaning_description).toBe('Class B — hot water wash with degreaser');
      expect(result!.source).toBe('commodity_cleaning_matrix');
      expect(mockQueryOne).toHaveBeenCalledTimes(2);
    });

    it('should fall back to commodities table when cleaning matrix has no entry (priority 2)', async () => {
      // First call: car lookup — car exists with a commodity_cin
      mockQueryOne.mockResolvedValueOnce({
        car_number: 'RAIL-2002',
        commodity_cin: 'SUGAR',
        commodity_description: 'Sugar',
      });
      // Second call: cleaning matrix lookup — not found
      mockQueryOne.mockResolvedValueOnce(null);
      // Third call: commodities table fallback
      mockQueryOne.mockResolvedValueOnce({
        cin_code: 'SUGAR',
        description: 'Sugar',
        cleaning_class: 'C',
        requires_kosher: false,
      });

      const result = await getCleaningRequirementsForCar('RAIL-2002');

      expect(result).not.toBeNull();
      expect(result!.car_number).toBe('RAIL-2002');
      expect(result!.commodity_code).toBe('SUGAR');
      expect(result!.commodity_name).toBe('Sugar');
      expect(result!.cleaning_class).toBe('C');
      expect(result!.cleaning_description).toBe('Class C — standard rinse and steam');
      expect(result!.source).toBe('commodities_table');
      // Fallback defaults for boolean fields
      expect(result!.requires_interior_blast).toBe(false);
      expect(result!.requires_exterior_paint).toBe(false);
      expect(result!.requires_new_lining).toBe(false);
      expect(result!.requires_kosher_cleaning).toBe(false);
      expect(result!.special_instructions).toBeNull();
      expect(mockQueryOne).toHaveBeenCalledTimes(3);
    });

    it('should return null when car is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getCleaningRequirementsForCar('GHOST-CAR');

      expect(result).toBeNull();
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
    });

    it('should return "none" source when car exists but has no commodity_cin', async () => {
      // Car exists but commodity_cin is null
      mockQueryOne.mockResolvedValueOnce({
        car_number: 'RAIL-3003',
        commodity_cin: null,
        commodity_description: null,
      });

      const result = await getCleaningRequirementsForCar('RAIL-3003');

      expect(result).not.toBeNull();
      expect(result!.car_number).toBe('RAIL-3003');
      expect(result!.commodity_code).toBe('UNKNOWN');
      expect(result!.commodity_name).toBe('No commodity assigned');
      expect(result!.cleaning_class).toBe('none');
      expect(result!.cleaning_description).toBe('No cleaning required');
      expect(result!.source).toBe('none');
      // Only one DB call — no commodity_cin to look up
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
    });

    it('should return "none" source when commodity_cin exists but neither matrix nor commodities table has data', async () => {
      // Car exists with a commodity_cin
      mockQueryOne.mockResolvedValueOnce({
        car_number: 'RAIL-4004',
        commodity_cin: 'ORPHAN',
        commodity_description: null,
      });
      // Cleaning matrix: not found
      mockQueryOne.mockResolvedValueOnce(null);
      // Commodities table fallback: not found
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getCleaningRequirementsForCar('RAIL-4004');

      expect(result).not.toBeNull();
      expect(result!.commodity_code).toBe('UNKNOWN');
      expect(result!.source).toBe('none');
      expect(mockQueryOne).toHaveBeenCalledTimes(3);
    });

    it('should handle commodities table fallback with null cleaning_class (defaults to "none")', async () => {
      mockQueryOne.mockResolvedValueOnce({
        car_number: 'RAIL-5005',
        commodity_cin: 'WATER',
        commodity_description: 'Water',
      });
      // Cleaning matrix: not found
      mockQueryOne.mockResolvedValueOnce(null);
      // Commodities table: found but cleaning_class is null
      mockQueryOne.mockResolvedValueOnce({
        cin_code: 'WATER',
        description: 'Water',
        cleaning_class: null,
        requires_kosher: false,
      });

      const result = await getCleaningRequirementsForCar('RAIL-5005');

      expect(result).not.toBeNull();
      expect(result!.cleaning_class).toBe('none');
      expect(result!.cleaning_description).toBe('No cleaning required');
      expect(result!.source).toBe('commodities_table');
    });

    it('should propagate requires_kosher from commodities table fallback', async () => {
      mockQueryOne.mockResolvedValueOnce({
        car_number: 'RAIL-6006',
        commodity_cin: 'K-OIL',
        commodity_description: 'Kosher Oil',
      });
      mockQueryOne.mockResolvedValueOnce(null); // matrix miss
      mockQueryOne.mockResolvedValueOnce({
        cin_code: 'K-OIL',
        description: 'Kosher Oil',
        cleaning_class: 'kosher',
        requires_kosher: true,
      });

      const result = await getCleaningRequirementsForCar('RAIL-6006');

      expect(result).not.toBeNull();
      expect(result!.requires_kosher_cleaning).toBe(true);
      expect(result!.cleaning_class).toBe('kosher');
      expect(result!.source).toBe('commodities_table');
    });
  });

  // ==========================================================================
  // getCarCleaningRequirements (alias)
  // ==========================================================================
  describe('getCarCleaningRequirements', () => {
    it('should be an alias for getCleaningRequirementsForCar', () => {
      expect(getCarCleaningRequirements).toBe(getCleaningRequirementsForCar);
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe('Edge cases', () => {
    it('should pass empty string to the database when getCommodity is called with empty code', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getCommodity('');

      expect(result).toBeNull();
      expect(mockQueryOne).toHaveBeenCalledWith(expect.any(String), ['']);
    });

    it('should handle special characters in commodity code', async () => {
      const commodity = createMockCommodity({
        commodity_code: "O'KEEFE-#1",
        commodity_name: "O'Keefe Blend #1",
      });
      mockQueryOne.mockResolvedValueOnce(commodity);

      const result = await getCommodity("O'KEEFE-#1");

      expect(result).toEqual(commodity);
      expect(mockQueryOne).toHaveBeenCalledWith(expect.any(String), ["O'KEEFE-#1"]);
    });

    it('should return all cleaning class descriptions correctly', async () => {
      const descriptions: Record<string, string> = {
        A: 'Class A — solvent/steam cleaning',
        B: 'Class B — hot water wash with degreaser',
        C: 'Class C — standard rinse and steam',
        D: 'Class D — vapor purge, minimal wash',
        E: 'Class E — dry clean or air purge only',
        kosher: 'Kosher — certified cleaning with Mashgiach supervision',
        hazmat: 'Hazardous Material — specialized protocol required',
        none: 'No cleaning required',
      };

      for (const [classKey, expectedDesc] of Object.entries(descriptions)) {
        mockQueryOne.mockResolvedValueOnce(
          createMockCommodity({ cleaning_class: classKey as any })
        );

        const result = await getCleaningRequirements(`TEST-${classKey}`);
        expect(result).not.toBeNull();
        expect(result!.cleaning_description).toBe(expectedDesc);
      }

      expect(mockQueryOne).toHaveBeenCalledTimes(Object.keys(descriptions).length);
    });
  });
});
