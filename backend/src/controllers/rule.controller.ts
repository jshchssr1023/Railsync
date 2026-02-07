import { Request, Response } from 'express';
import logger from '../config/logger';
import ruleModel from '../models/rule.model';
import { ApiResponse, EligibilityRule } from '../types';

/**
 * GET /api/rules
 * List all eligibility rules with status
 */
export async function listRules(req: Request, res: Response): Promise<void> {
  try {
    const activeOnly = req.query.active !== 'false';
    const rules = await ruleModel.findAll(activeOnly);

    res.json({
      success: true,
      data: rules.map(rule => ({
        rule_id: rule.rule_id,
        rule_name: rule.rule_name,
        rule_category: rule.rule_category,
        rule_description: rule.rule_description,
        priority: rule.priority,
        is_active: rule.is_active,
        is_blocking: rule.is_blocking,
        condition_json: rule.condition_json,
      })),
    } as ApiResponse<any[]>);
  } catch (error) {
    logger.error({ err: error }, 'Error listing rules');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

/**
 * GET /api/rules/:ruleId
 * Get a specific rule by ID
 */
export async function getRuleById(req: Request, res: Response): Promise<void> {
  try {
    const { ruleId } = req.params;

    if (!ruleId) {
      res.status(400).json({
        success: false,
        error: 'Rule ID is required',
      } as ApiResponse<null>);
      return;
    }

    const rule = await ruleModel.findById(ruleId);

    if (!rule) {
      res.status(404).json({
        success: false,
        error: `Rule not found: ${ruleId}`,
      } as ApiResponse<null>);
      return;
    }

    res.json({
      success: true,
      data: rule,
    } as ApiResponse<EligibilityRule>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching rule');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

/**
 * PUT /api/rules/:ruleId
 * Update rule configuration
 */
export async function updateRule(req: Request, res: Response): Promise<void> {
  try {
    const { ruleId } = req.params;
    const updates = req.body;

    if (!ruleId) {
      res.status(400).json({
        success: false,
        error: 'Rule ID is required',
      } as ApiResponse<null>);
      return;
    }

    // Validate updates
    const allowedFields = [
      'rule_name',
      'rule_description',
      'condition_json',
      'priority',
      'is_active',
      'is_blocking',
    ];

    const invalidFields = Object.keys(updates).filter(
      (key) => !allowedFields.includes(key)
    );

    if (invalidFields.length > 0) {
      res.status(400).json({
        success: false,
        error: `Invalid fields: ${invalidFields.join(', ')}`,
      } as ApiResponse<null>);
      return;
    }

    // Check if rule exists
    const existingRule = await ruleModel.findById(ruleId);
    if (!existingRule) {
      res.status(404).json({
        success: false,
        error: `Rule not found: ${ruleId}`,
      } as ApiResponse<null>);
      return;
    }

    const updatedRule = await ruleModel.update(ruleId, updates);

    res.json({
      success: true,
      data: updatedRule,
      message: 'Rule updated successfully',
    } as ApiResponse<EligibilityRule>);
  } catch (error) {
    logger.error({ err: error }, 'Error updating rule');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

/**
 * POST /api/rules
 * Create a new rule
 */
export async function createRule(req: Request, res: Response): Promise<void> {
  try {
    const ruleData = req.body;

    // Validate required fields
    const requiredFields = ['rule_id', 'rule_name', 'rule_category', 'condition_json'];
    const missingFields = requiredFields.filter(
      (field) => !ruleData[field]
    );

    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      } as ApiResponse<null>);
      return;
    }

    // Check if rule already exists
    const existingRule = await ruleModel.findById(ruleData.rule_id);
    if (existingRule) {
      res.status(409).json({
        success: false,
        error: `Rule already exists: ${ruleData.rule_id}`,
      } as ApiResponse<null>);
      return;
    }

    const newRule = await ruleModel.create({
      rule_id: ruleData.rule_id,
      rule_name: ruleData.rule_name,
      rule_category: ruleData.rule_category,
      rule_description: ruleData.rule_description || null,
      condition_json: ruleData.condition_json,
      priority: ruleData.priority || 100,
      is_active: ruleData.is_active !== false,
      is_blocking: ruleData.is_blocking !== false,
    });

    res.status(201).json({
      success: true,
      data: newRule,
      message: 'Rule created successfully',
    } as ApiResponse<EligibilityRule>);
  } catch (error) {
    logger.error({ err: error }, 'Error creating rule');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

export default {
  listRules,
  getRuleById,
  updateRule,
  createRule,
};
