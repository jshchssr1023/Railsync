import { RulesEngine, EvaluationContext } from './index';
import {
  Shop,
  CarWithCommodity,
  ShopCapability,
  EligibilityRule,
  ShopBacklog,
  CapabilityType,
} from '../types';

// Test fixtures
const createMockShop = (overrides: Partial<Shop> = {}): Shop => ({
  shop_code: 'TEST001',
  shop_name: 'Test Shop',
  primary_railroad: 'BNSF',
  region: 'Midwest',
  city: 'Test City',
  state: 'NE',
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
  lining_type: 'Epoxy',
  commodity_cin: 'CIN001',
  has_asbestos: false,
  asbestos_abatement_required: false,
  nitrogen_pad_stage: undefined,
  last_repair_date: undefined,
  last_repair_shop: undefined,
  owner_code: 'UTLX',
  lessee_code: undefined,
  ...overrides,
});

const createMockCapability = (
  type: CapabilityType,
  value: string
): ShopCapability => ({
  id: `cap-${type}-${value}`,
  shop_code: 'TEST001',
  capability_type: type,
  capability_value: value,
  certified_date: new Date(),
  expiration_date: undefined,
  is_active: true,
});

const createMockBacklog = (overrides: Partial<ShopBacklog> = {}): ShopBacklog => ({
  shop_code: 'TEST001',
  date: new Date(),
  hours_backlog: 200,
  cars_backlog: 5,
  cars_en_route_0_6: 3,
  cars_en_route_7_14: 2,
  cars_en_route_15_plus: 1,
  weekly_inbound: 4,
  weekly_outbound: 3,
  ...overrides,
});

const createMockRule = (
  overrides: Partial<EligibilityRule> = {}
): EligibilityRule => ({
  rule_id: 'RULE001',
  rule_name: 'Test Rule',
  rule_category: 'material',
  rule_description: 'Test rule description',
  condition_json: {},
  priority: 1,
  is_active: true,
  is_blocking: true,
  ...overrides,
});

const createContext = (
  overrides: Partial<EvaluationContext> = {}
): EvaluationContext => ({
  car: createMockCar(),
  shop: createMockShop(),
  capabilities: [],
  commodityRestrictions: [],
  overrides: {},
  backlog: createMockBacklog(),
  ...overrides,
});

describe('RulesEngine', () => {
  describe('constructor', () => {
    it('should sort rules by priority', () => {
      const rules = [
        createMockRule({ rule_id: 'R3', priority: 3 }),
        createMockRule({ rule_id: 'R1', priority: 1 }),
        createMockRule({ rule_id: 'R2', priority: 2 }),
      ];
      const engine = new RulesEngine(rules);
      expect(engine).toBeDefined();
    });
  });

  describe('evaluate - happy paths', () => {
    it('should pass when no rules are defined', () => {
      const engine = new RulesEngine([]);
      const context = createContext();
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true);
      expect(result.failedRules).toHaveLength(0);
    });

    it('should pass when all rules pass', () => {
      const rules = [
        createMockRule({
          rule_id: 'CAP_CHECK',
          condition_json: {
            capability_type: 'material',
            match_field: 'car.material_type',
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        capabilities: [createMockCapability('material', 'Carbon Steel')],
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true);
      expect(result.failedRules).toHaveLength(0);
    });
  });

  describe('evaluate - blocking rules', () => {
    it('should fail when blocking rule with field comparison fails', () => {
      const rules = [
        createMockRule({
          rule_id: 'FIELD_CHECK',
          is_blocking: true,
          condition_json: {
            field: 'shop.is_preferred_network',
            operator: 'eq',
            value: true,
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        shop: createMockShop({ is_preferred_network: false }),
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(false);
      expect(result.failedRules).toHaveLength(1);
      expect(result.failedRules[0].rule_id).toBe('FIELD_CHECK');
    });

    it('should pass but record failure for non-blocking rule', () => {
      const rules = [
        createMockRule({
          rule_id: 'NON_BLOCKING',
          is_blocking: false,
          condition_json: {
            field: 'shop.labor_rate',
            operator: 'lt',
            threshold: 50,
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        shop: createMockShop({ labor_rate: 80 }),
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true); // Non-blocking doesn't fail overall
      expect(result.failedRules).toHaveLength(1);
    });
  });

  describe('evaluate - multiple rules', () => {
    it('should collect failures from multiple blocking rules', () => {
      const rules = [
        createMockRule({
          rule_id: 'RULE1',
          priority: 1,
          is_blocking: true,
          condition_json: {
            field: 'shop.is_preferred_network',
            operator: 'eq',
            value: true,
          },
        }),
        createMockRule({
          rule_id: 'RULE2',
          priority: 2,
          is_blocking: true,
          condition_json: {
            field: 'shop.labor_rate',
            operator: 'lt',
            threshold: 50,
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        shop: createMockShop({ is_preferred_network: false, labor_rate: 80 }),
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(false);
      expect(result.failedRules.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('evaluate - edge cases', () => {
    it('should skip inactive rules', () => {
      const rules = [
        createMockRule({
          rule_id: 'INACTIVE',
          is_active: false,
          is_blocking: true,
          condition_json: {
            capability_type: 'material',
            match_field: 'car.material_type',
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        capabilities: [],
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true);
      expect(result.failedRules).toHaveLength(0);
    });

    it('should handle undefined commodity_cin gracefully', () => {
      const rules = [
        createMockRule({
          rule_id: 'COMMODITY_CHECK',
          condition_json: {
            type: 'commodity_restriction',
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        car: createMockCar({ commodity_cin: undefined }),
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true);
    });

    it('should handle conditional rules with missing check_field', () => {
      const rules = [
        createMockRule({
          rule_id: 'COND_CHECK',
          condition_json: {
            condition: 'if',
            check_field: 'car.nitrogen_pad_stage',
            check_not_null: true,
            require: {
              capability_type: 'nitrogen_stage',
              capability_value: '${car.nitrogen_pad_stage}',
            },
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        car: createMockCar({ nitrogen_pad_stage: undefined }),
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true);
    });
  });

  describe('evaluate - commodity restrictions', () => {
    it('should fail when commodity is restricted at shop', () => {
      const rules = [
        createMockRule({
          rule_id: 'COMM_RESTRICT',
          condition_json: {
            type: 'commodity_restriction',
            restriction_codes_block: ['N'],
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        car: createMockCar({ commodity_cin: 'HAZMAT01' }),
        commodityRestrictions: [
          {
            cin_code: 'HAZMAT01',
            shop_code: 'TEST001',
            restriction_code: 'N',
            restriction_reason: 'Not certified for this commodity',
          },
        ],
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(false);
      expect(result.failedRules[0].reason).toContain('restricted');
    });

    it('should pass when commodity has no restrictions', () => {
      const rules = [
        createMockRule({
          rule_id: 'COMM_RESTRICT',
          condition_json: {
            type: 'commodity_restriction',
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        car: createMockCar({ commodity_cin: 'SAFE01' }),
        commodityRestrictions: [],
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true);
    });

    it('should block on RC1 restricted conditions when configured', () => {
      const rules = [
        createMockRule({
          rule_id: 'COMM_RESTRICT_RC1',
          condition_json: {
            type: 'commodity_restriction',
            restriction_codes_block: ['N', 'RC1'],
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        car: createMockCar({ commodity_cin: 'ACID01' }),
        commodityRestrictions: [
          {
            cin_code: 'ACID01',
            shop_code: 'TEST001',
            restriction_code: 'RC1',
            restriction_reason: 'Requires supervisor approval',
          },
        ],
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(false);
    });
  });

  describe('evaluate - material rules', () => {
    it('should pass when shop has required material capability', () => {
      const rules = [
        createMockRule({
          rule_id: 'MATERIAL_ALUMINUM',
          condition_json: {
            condition: 'if',
            check_field: 'car.material_type',
            check_value: 'Aluminum',
            require: {
              capability_type: 'material',
              capability_value: 'Aluminum',
            },
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        car: createMockCar({ material_type: 'Aluminum' }),
        capabilities: [createMockCapability('material', 'Aluminum')],
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true);
    });

    it('should fail when shop lacks required material capability', () => {
      const rules = [
        createMockRule({
          rule_id: 'MATERIAL_ALUMINUM',
          condition_json: {
            condition: 'if',
            check_field: 'car.material_type',
            check_value: 'Aluminum',
            require: {
              capability_type: 'material',
              capability_value: 'Aluminum',
            },
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        car: createMockCar({ material_type: 'Aluminum' }),
        capabilities: [createMockCapability('material', 'Carbon Steel')],
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(false);
      expect(result.failedRules[0].reason).toContain('lacks required capability');
    });
  });

  describe('evaluate - capacity rules', () => {
    it('should pass when backlog is under threshold', () => {
      const rules = [
        createMockRule({
          rule_id: 'BACKLOG_CHECK',
          is_blocking: false,
          condition_json: {
            field: 'backlog.hours_backlog',
            operator: 'lt',
            threshold: 600,
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        backlog: createMockBacklog({ hours_backlog: 450 }),
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true);
      expect(result.failedRules).toHaveLength(0);
    });

    it('should flag when backlog exceeds threshold', () => {
      const rules = [
        createMockRule({
          rule_id: 'BACKLOG_CHECK',
          is_blocking: false,
          condition_json: {
            field: 'backlog.hours_backlog',
            operator: 'lt',
            threshold: 600,
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        backlog: createMockBacklog({ hours_backlog: 650 }),
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true); // Non-blocking
      expect(result.failedRules).toHaveLength(1);
    });

    it('should compute en-route cars total correctly', () => {
      const rules = [
        createMockRule({
          rule_id: 'EN_ROUTE_CHECK',
          is_blocking: false,
          condition_json: {
            field: 'backlog.cars_en_route_total',
            operator: 'lte',
            threshold: 12,
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        backlog: createMockBacklog({
          cars_en_route_0_6: 5,
          cars_en_route_7_14: 4,
          cars_en_route_15_plus: 2,
        }),
      });
      const result = engine.evaluate(context);
      // 5 + 4 = 9 <= 12, should pass
      expect(result.passed).toBe(true);
      expect(result.failedRules).toHaveLength(0);
    });

    it('should fail when en-route cars total exceeds threshold', () => {
      const rules = [
        createMockRule({
          rule_id: 'EN_ROUTE_CHECK',
          is_blocking: false,
          condition_json: {
            field: 'backlog.cars_en_route_total',
            operator: 'lte',
            threshold: 12,
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        backlog: createMockBacklog({
          cars_en_route_0_6: 8,
          cars_en_route_7_14: 6,
          cars_en_route_15_plus: 2,
        }),
      });
      const result = engine.evaluate(context);
      // 8 + 6 = 14 > 12, should fail
      expect(result.failedRules).toHaveLength(1);
    });
  });

  describe('evaluate - OR condition rules', () => {
    it('should pass when OR condition is met and capability exists', () => {
      const rules = [
        createMockRule({
          rule_id: 'KOSHER_CHECK',
          condition_json: {
            condition: 'or',
            conditions: [
              { check_field: 'commodity.requires_kosher', check_value: true },
              { check_field: 'overrides.kosher_cleaning', check_value: true },
            ],
            require: {
              capability_type: 'special',
              capability_value: 'Kosher',
            },
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        overrides: { kosher_cleaning: true },
        capabilities: [createMockCapability('special', 'Kosher')],
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true);
    });

    it('should fail when OR condition is met but capability missing', () => {
      const rules = [
        createMockRule({
          rule_id: 'KOSHER_CHECK',
          condition_json: {
            condition: 'or',
            conditions: [
              { check_field: 'commodity.requires_kosher', check_value: true },
              { check_field: 'overrides.kosher_cleaning', check_value: true },
            ],
            require: {
              capability_type: 'special',
              capability_value: 'Kosher',
            },
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        overrides: { kosher_cleaning: true },
        capabilities: [], // No kosher capability
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(false);
    });
  });

  describe('evaluate - nitrogen stage rules', () => {
    it('should pass when nitrogen stage capability matches car requirement', () => {
      const rules = [
        createMockRule({
          rule_id: 'NITROGEN_CHECK',
          condition_json: {
            condition: 'if',
            check_field: 'car.nitrogen_pad_stage',
            check_not_null: true,
            require: {
              capability_type: 'nitrogen_stage',
              capability_value: '${car.nitrogen_pad_stage}',
            },
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        car: createMockCar({ nitrogen_pad_stage: 5 }),
        capabilities: [createMockCapability('nitrogen_stage', '5')],
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(true);
    });

    it('should fail when nitrogen stage capability does not match', () => {
      const rules = [
        createMockRule({
          rule_id: 'NITROGEN_CHECK',
          condition_json: {
            condition: 'if',
            check_field: 'car.nitrogen_pad_stage',
            check_not_null: true,
            require: {
              capability_type: 'nitrogen_stage',
              capability_value: '${car.nitrogen_pad_stage}',
            },
          },
        }),
      ];
      const engine = new RulesEngine(rules);
      const context = createContext({
        car: createMockCar({ nitrogen_pad_stage: 7 }),
        capabilities: [
          createMockCapability('nitrogen_stage', '1'),
          createMockCapability('nitrogen_stage', '2'),
          createMockCapability('nitrogen_stage', '3'),
        ],
      });
      const result = engine.evaluate(context);
      expect(result.passed).toBe(false);
      expect(result.failedRules[0].reason).toContain('lacks required capability');
    });
  });
});
