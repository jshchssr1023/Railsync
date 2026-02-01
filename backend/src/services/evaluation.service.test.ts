import { calculateCosts } from './evaluation.service';
import { CarWithCommodity, Shop, EvaluationOverrides } from '../types';
import shopModel from '../models/shop.model';
import * as freightService from './freight.service';

// Mock the shop model
jest.mock('../models/shop.model', () => ({
  getLaborRates: jest.fn(),
  getFreightRate: jest.fn(),
}));

// Mock the freight service
jest.mock('./freight.service', () => ({
  calculateFreightCost: jest.fn(),
}));

const mockGetLaborRates = shopModel.getLaborRates as jest.Mock;
const mockGetFreightRate = shopModel.getFreightRate as jest.Mock;
const mockCalculateFreightCost = freightService.calculateFreightCost as jest.Mock;

const createMockShop = (overrides: Partial<Shop> = {}): Shop => ({
  shop_code: 'TEST001',
  shop_name: 'Test Shop',
  primary_railroad: 'BNSF',
  region: 'Midwest',
  labor_rate: 80,
  material_multiplier: 1.0,
  is_preferred_network: true,
  is_active: true,
  ...overrides,
});

const createMockCar = (overrides: Partial<CarWithCommodity> = {}): CarWithCommodity => ({
  car_number: 'UTLX123456',
  product_code: 'Tank',
  material_type: 'Carbon Steel',
  stencil_class: 'DOT111',
  lining_type: undefined,
  commodity_cin: undefined,
  has_asbestos: false,
  asbestos_abatement_required: false,
  nitrogen_pad_stage: undefined,
  owner_code: 'UTLX',
  ...overrides,
});

describe('Cost Calculation Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    mockGetLaborRates.mockResolvedValue(new Map());
    mockGetFreightRate.mockResolvedValue(null);
    // Default freight: $500 base + $75 fuel surcharge = $575
    mockCalculateFreightCost.mockResolvedValue({
      distance_miles: 0,
      base_freight: 500,
      fuel_surcharge: 75,
      total_freight: 575,
    });
  });

  describe('calculateCosts - basic scenarios', () => {
    it('should calculate basic cleaning cost with default values', async () => {
      const car = createMockCar();
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Labor: cleaning = 4 hours * $80 = $320
      expect(result.labor_cost).toBe(320);
      // Material: default cleaning cost = $850
      expect(result.material_cost).toBe(850);
      // Abatement: none
      expect(result.abatement_cost).toBe(0);
      // Freight: default = $500 + $75 fuel surcharge = $575
      expect(result.freight_cost).toBe(575);
      // Total: $320 + $850 + $0 + $575 = $1745
      expect(result.total_cost).toBe(1745);
    });

    it('should use commodity recommended_price for cleaning cost', async () => {
      const car = createMockCar({
        commodity: {
          cin_code: 'CIN001',
          description: 'Corn Syrup',
          cleaning_class: 'A',
          recommended_price: 1200,
          requires_kosher: false,
          requires_nitrogen: false,
        },
      });
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Material: commodity recommended_price = $1200 (class A = 1.0x)
      expect(result.material_cost).toBe(1200);
    });

    it('should apply cleaning class multipliers', async () => {
      const car = createMockCar({
        commodity: {
          cin_code: 'CIN004',
          description: 'Sulfuric Acid',
          cleaning_class: 'C',
          recommended_price: 1000,
          requires_kosher: false,
          requires_nitrogen: false,
        },
      });
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Material: $1000 * 1.5 (class C multiplier) = $1500
      expect(result.material_cost).toBe(1500);
    });

    it('should apply class D multiplier (2.0x)', async () => {
      const car = createMockCar({
        commodity: {
          cin_code: 'CIN008',
          description: 'LPG',
          cleaning_class: 'D',
          recommended_price: 1000,
          requires_kosher: false,
          requires_nitrogen: false,
        },
      });
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Material: $1000 * 2.0 (class D multiplier) = $2000
      expect(result.material_cost).toBe(2000);
    });
  });

  describe('calculateCosts - lining costs', () => {
    it('should use lining-specific cost for High Bake', async () => {
      const car = createMockCar({ lining_type: 'High Bake' });
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Labor: cleaning (4h) + lining (16h) = 20h * $80 = $1600
      expect(result.labor_cost).toBe(1600);
      // Material: cleaning ($850) + High Bake lining ($1800) = $2650
      expect(result.material_cost).toBe(2650);
    });

    it('should use lining-specific cost for Rubber (most expensive)', async () => {
      const car = createMockCar({ lining_type: 'Rubber' });
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Material: cleaning ($850) + Rubber lining ($4500) = $5350
      expect(result.material_cost).toBe(5350);
    });

    it('should use lining-specific cost for Vinyl Ester', async () => {
      const car = createMockCar({ lining_type: 'Vinyl Ester' });
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Material: cleaning ($850) + Vinyl Ester ($3800) = $4650
      expect(result.material_cost).toBe(4650);
    });

    it('should add lining cost when new_lining override is set', async () => {
      const car = createMockCar({ lining_type: undefined });
      const shop = createMockShop();
      const overrides: EvaluationOverrides = { new_lining: true };

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Labor includes lining work
      expect(result.labor_cost).toBe(1600); // 20h * $80
      // Material: cleaning ($850) + default Epoxy lining ($2200) = $3050
      expect(result.material_cost).toBe(3050);
    });
  });

  describe('calculateCosts - kosher cleaning', () => {
    it('should add kosher premium when commodity requires kosher', async () => {
      const car = createMockCar({
        commodity: {
          cin_code: 'CIN002',
          description: 'Vegetable Oil - Kosher',
          cleaning_class: 'A',
          recommended_price: 1200,
          requires_kosher: true,
          requires_nitrogen: false,
        },
      });
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Material: $1200 + $500 kosher premium = $1700
      expect(result.material_cost).toBe(1700);
    });

    it('should add kosher premium when override is set', async () => {
      const car = createMockCar();
      const shop = createMockShop();
      const overrides: EvaluationOverrides = { kosher_cleaning: true };

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Material: $850 default + $500 kosher premium = $1350
      expect(result.material_cost).toBe(1350);
    });
  });

  describe('calculateCosts - abatement', () => {
    it('should add abatement cost when asbestos abatement is required', async () => {
      const car = createMockCar({
        has_asbestos: true,
        asbestos_abatement_required: true,
      });
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      expect(result.abatement_cost).toBe(5000);
    });

    it('should not add abatement cost when has_asbestos but abatement not required', async () => {
      const car = createMockCar({
        has_asbestos: true,
        asbestos_abatement_required: false,
      });
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      expect(result.abatement_cost).toBe(0);
    });
  });

  describe('calculateCosts - material multiplier', () => {
    it('should apply shop material multiplier to all material costs', async () => {
      const car = createMockCar();
      const shop = createMockShop({ material_multiplier: 1.2 });
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Material: $850 * 1.2 = $1020
      expect(result.material_cost).toBe(1020);
    });

    it('should apply lower material multiplier', async () => {
      const car = createMockCar();
      const shop = createMockShop({ material_multiplier: 0.9 });
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Material: $850 * 0.9 = $765
      expect(result.material_cost).toBe(765);
    });
  });

  describe('calculateCosts - freight', () => {
    it('should use calculated freight when available', async () => {
      // Mock distance-based freight calculation
      mockCalculateFreightCost.mockResolvedValue({
        distance_miles: 200,
        base_freight: 500,
        fuel_surcharge: 90,
        total_freight: 590,
        origin_location: 'Chicago Hub',
        destination_shop: 'Test Shop',
      });

      const car = createMockCar();
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Freight: calculated value from freight service
      expect(result.freight_cost).toBe(590);
    });

    it('should use default freight when freight service returns default', async () => {
      // Default mock already returns $575 in beforeEach
      const car = createMockCar();
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Default freight: $500 base + $75 fuel surcharge (15%) = $575
      expect(result.freight_cost).toBe(575);
    });
  });

  describe('calculateCosts - labor rates', () => {
    it('should use shop-specific labor rates when available', async () => {
      mockGetLaborRates.mockResolvedValue(
        new Map([
          ['cleaning', { hourly_rate: 100, minimum_hours: 2 }],
        ])
      );

      const car = createMockCar();
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Labor: max(4h * $100, 2h * $100) = $400
      expect(result.labor_cost).toBe(400);
    });

    it('should enforce minimum hours', async () => {
      mockGetLaborRates.mockResolvedValue(
        new Map([
          ['cleaning', { hourly_rate: 100, minimum_hours: 6 }],
        ])
      );

      const car = createMockCar();
      const shop = createMockShop();
      const overrides: EvaluationOverrides = {};

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Labor: max(4h * $100, 6h * $100) = $600 (minimum hours enforced)
      expect(result.labor_cost).toBe(600);
    });
  });

  describe('calculateCosts - combined overrides', () => {
    it('should calculate full cost with all overrides', async () => {
      const car = createMockCar({
        lining_type: 'Plasite',
        asbestos_abatement_required: true,
        commodity: {
          cin_code: 'CIN002',
          description: 'Vegetable Oil - Kosher',
          cleaning_class: 'B',
          recommended_price: 1000,
          requires_kosher: true,
          requires_nitrogen: false,
        },
      });
      const shop = createMockShop({ material_multiplier: 1.1 });
      const overrides: EvaluationOverrides = {
        interior_blast: true,
        exterior_paint: true,
      };

      const result = await calculateCosts(car, shop, overrides, 'Midwest');

      // Labor: cleaning(4) + blast(6) + lining(16) + paint(8) = 34h * $80 = $2720
      expect(result.labor_cost).toBe(2720);
      // Material:
      //   cleaning: $1000 * 1.25 (class B) * 1.1 = $1375
      //   blast: $300 * 1.1 = $330
      //   lining (Plasite): $3200 * 1.1 = $3520
      //   paint: $800 * 1.1 = $880
      //   kosher: $500
      //   Total: $6605
      expect(result.material_cost).toBe(6605);
      // Abatement: $5000
      expect(result.abatement_cost).toBe(5000);
      // Freight: $500 base + $75 fuel surcharge = $575
      expect(result.freight_cost).toBe(575);
      // Total: $2720 + $6605 + $5000 + $575 = $14900
      expect(result.total_cost).toBe(14900);
    });
  });
});
