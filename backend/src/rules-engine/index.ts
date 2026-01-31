import {
  EligibilityRule,
  RuleCondition,
  CarWithCommodity,
  Shop,
  ShopCapability,
  CommodityRestriction,
  EvaluationOverrides,
  FailedRule,
  ShopBacklog,
} from '../types';

export interface EvaluationContext {
  car: CarWithCommodity;
  shop: Shop;
  capabilities: ShopCapability[];
  commodityRestrictions: CommodityRestriction[];
  overrides: EvaluationOverrides;
  backlog?: ShopBacklog;
}

export interface RuleEvaluationResult {
  passed: boolean;
  failedRules: FailedRule[];
}

/**
 * Rules Engine for evaluating shop eligibility
 * Processes JSON-based configurable rules against car and shop data
 */
export class RulesEngine {
  private rules: EligibilityRule[];

  constructor(rules: EligibilityRule[]) {
    // Sort rules by priority (lower = higher priority)
    this.rules = rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Evaluate all rules for a given context
   */
  evaluate(context: EvaluationContext): RuleEvaluationResult {
    const failedRules: FailedRule[] = [];
    let passed = true;

    for (const rule of this.rules) {
      if (!rule.is_active) continue;

      const result = this.evaluateRule(rule, context);

      if (!result.passed) {
        failedRules.push({
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          rule_category: rule.rule_category,
          reason: result.reason,
        });

        // If rule is blocking, shop is ineligible
        if (rule.is_blocking) {
          passed = false;
        }
      }
    }

    return { passed, failedRules };
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(
    rule: EligibilityRule,
    context: EvaluationContext
  ): { passed: boolean; reason: string } {
    try {
      const condition = rule.condition_json;

      // Handle different rule types
      if (condition.type === 'commodity_restriction') {
        return this.evaluateCommodityRestriction(rule, context);
      }

      if (condition.condition === 'if') {
        return this.evaluateConditionalRule(rule, context);
      }

      if (condition.condition === 'or') {
        return this.evaluateOrCondition(rule, context);
      }

      if (condition.field && condition.operator) {
        return this.evaluateFieldRule(rule, context);
      }

      // Default: pass if no condition matches
      return { passed: true, reason: '' };
    } catch (error) {
      console.error(`Error evaluating rule ${rule.rule_id}:`, error);
      return { passed: true, reason: '' }; // Fail open on error
    }
  }

  /**
   * Evaluate commodity restriction rules
   */
  private evaluateCommodityRestriction(
    rule: EligibilityRule,
    context: EvaluationContext
  ): { passed: boolean; reason: string } {
    const { car, shop, commodityRestrictions } = context;
    const condition = rule.condition_json;

    if (!car.commodity_cin) {
      return { passed: true, reason: '' };
    }

    const restriction = commodityRestrictions.find(
      (r) => r.cin_code === car.commodity_cin && r.shop_code === shop.shop_code
    );

    if (!restriction) {
      // No restriction means allowed
      return { passed: true, reason: '' };
    }

    const blockedCodes = condition.restriction_codes_block || ['N'];

    if (blockedCodes.includes(restriction.restriction_code)) {
      return {
        passed: false,
        reason: `Commodity ${car.commodity_cin} is restricted at this shop (${restriction.restriction_code}): ${restriction.restriction_reason || 'No reason provided'}`,
      };
    }

    return { passed: true, reason: '' };
  }

  /**
   * Evaluate conditional (if-then) rules
   */
  private evaluateConditionalRule(
    rule: EligibilityRule,
    context: EvaluationContext
  ): { passed: boolean; reason: string } {
    const condition = rule.condition_json;

    // Check if the condition applies
    const checkValue = this.getFieldValue(condition.check_field!, context);

    let conditionApplies = false;

    if (condition.check_not_null) {
      conditionApplies = checkValue !== null && checkValue !== undefined;
    } else if (condition.check_value !== undefined) {
      conditionApplies = checkValue === condition.check_value;
    }

    if (!conditionApplies) {
      // Condition doesn't apply, rule passes
      return { passed: true, reason: '' };
    }

    // Condition applies, check requirement
    const require = condition.require;
    if (!require) {
      return { passed: true, reason: '' };
    }

    // Check capability requirement
    if (require.capability_type) {
      let requiredValue = require.capability_value;

      // Handle template variables like ${car.nitrogen_pad_stage}
      if (requiredValue?.startsWith('${') && requiredValue?.endsWith('}')) {
        const fieldPath = requiredValue.slice(2, -1);
        requiredValue = String(this.getFieldValue(fieldPath, context));
      }

      const hasCapability = context.capabilities.some(
        (cap) =>
          cap.capability_type === require.capability_type &&
          cap.capability_value === requiredValue &&
          cap.is_active
      );

      if (!hasCapability) {
        return {
          passed: false,
          reason: `Shop lacks required capability: ${require.capability_type} = ${requiredValue}`,
        };
      }
    }

    // Check field requirement
    if (require.field) {
      const fieldValue = this.getFieldValue(require.field, context);
      if (fieldValue !== require.value) {
        return {
          passed: false,
          reason: `Shop does not meet requirement: ${require.field} = ${require.value}`,
        };
      }
    }

    return { passed: true, reason: '' };
  }

  /**
   * Evaluate OR condition rules (any sub-condition triggers the requirement)
   */
  private evaluateOrCondition(
    rule: EligibilityRule,
    context: EvaluationContext
  ): { passed: boolean; reason: string } {
    const condition = rule.condition_json;
    const conditions = condition.conditions || [];

    // Check if any sub-condition is true
    const anyConditionMet = conditions.some((subCond) => {
      const value = this.getFieldValue(subCond.check_field!, context);
      return value === subCond.check_value;
    });

    if (!anyConditionMet) {
      // None of the trigger conditions are met, rule passes
      return { passed: true, reason: '' };
    }

    // At least one condition is met, check requirement
    const require = condition.require;
    if (!require) {
      return { passed: true, reason: '' };
    }

    if (require.capability_type) {
      const hasCapability = context.capabilities.some(
        (cap) =>
          cap.capability_type === require.capability_type &&
          cap.capability_value === require.capability_value &&
          cap.is_active
      );

      if (!hasCapability) {
        return {
          passed: false,
          reason: `Shop lacks required capability: ${require.capability_type} = ${require.capability_value}`,
        };
      }
    }

    return { passed: true, reason: '' };
  }

  /**
   * Evaluate field comparison rules
   */
  private evaluateFieldRule(
    rule: EligibilityRule,
    context: EvaluationContext
  ): { passed: boolean; reason: string } {
    const condition = rule.condition_json;
    const fieldValue = this.getFieldValue(condition.field!, context);

    // Handle capability matching
    if (condition.capability_type && condition.match_field) {
      const matchValue = this.getFieldValue(condition.match_field, context);
      const hasCapability = context.capabilities.some(
        (cap) =>
          cap.capability_type === condition.capability_type &&
          cap.capability_value === matchValue &&
          cap.is_active
      );

      if (!hasCapability) {
        return {
          passed: false,
          reason: `Shop cannot handle ${condition.capability_type}: ${matchValue}`,
        };
      }
      return { passed: true, reason: '' };
    }

    // Handle comparison operators
    const operator = condition.operator;
    const threshold = condition.threshold;
    const value = condition.value;

    switch (operator) {
      case 'lt':
        if (fieldValue >= threshold!) {
          return {
            passed: false,
            reason: `${condition.field} (${fieldValue}) exceeds threshold (${threshold})`,
          };
        }
        break;
      case 'lte':
        if (fieldValue > threshold!) {
          return {
            passed: false,
            reason: `${condition.field} (${fieldValue}) exceeds threshold (${threshold})`,
          };
        }
        break;
      case 'gt':
        if (fieldValue <= threshold!) {
          return {
            passed: false,
            reason: `${condition.field} (${fieldValue}) below threshold (${threshold})`,
          };
        }
        break;
      case 'gte':
        if (fieldValue < threshold!) {
          return {
            passed: false,
            reason: `${condition.field} (${fieldValue}) below threshold (${threshold})`,
          };
        }
        break;
      case 'eq':
        if (fieldValue !== value) {
          return {
            passed: false,
            reason: `${condition.field} (${fieldValue}) does not equal ${value}`,
          };
        }
        break;
      case 'in':
        if (!Array.isArray(value) || !value.includes(fieldValue)) {
          return {
            passed: false,
            reason: `${condition.field} (${fieldValue}) not in allowed values`,
          };
        }
        break;
    }

    return { passed: true, reason: '' };
  }

  /**
   * Get a field value from the evaluation context using dot notation
   */
  private getFieldValue(fieldPath: string, context: EvaluationContext): any {
    const parts = fieldPath.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }
}

export default RulesEngine;
