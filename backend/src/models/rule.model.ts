import { query, queryOne } from '../config/database';
import { EligibilityRule, RuleCondition } from '../types';

export async function findAll(activeOnly: boolean = true): Promise<EligibilityRule[]> {
  const sql = `
    SELECT *
    FROM eligibility_rules
    ${activeOnly ? 'WHERE is_active = TRUE' : ''}
    ORDER BY priority, rule_id
  `;

  return query<EligibilityRule>(sql);
}

export async function findById(ruleId: string): Promise<EligibilityRule | null> {
  const sql = `SELECT * FROM eligibility_rules WHERE rule_id = $1`;
  return queryOne<EligibilityRule>(sql, [ruleId]);
}

export async function findByCategory(category: string): Promise<EligibilityRule[]> {
  const sql = `
    SELECT *
    FROM eligibility_rules
    WHERE rule_category = $1
      AND is_active = TRUE
    ORDER BY priority
  `;

  return query<EligibilityRule>(sql, [category]);
}

export async function update(
  ruleId: string,
  updates: {
    rule_name?: string;
    rule_description?: string;
    condition_json?: RuleCondition;
    priority?: number;
    is_active?: boolean;
    is_blocking?: boolean;
  }
): Promise<EligibilityRule | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.rule_name !== undefined) {
    fields.push(`rule_name = $${paramIndex++}`);
    values.push(updates.rule_name);
  }
  if (updates.rule_description !== undefined) {
    fields.push(`rule_description = $${paramIndex++}`);
    values.push(updates.rule_description);
  }
  if (updates.condition_json !== undefined) {
    fields.push(`condition_json = $${paramIndex++}`);
    values.push(JSON.stringify(updates.condition_json));
  }
  if (updates.priority !== undefined) {
    fields.push(`priority = $${paramIndex++}`);
    values.push(updates.priority);
  }
  if (updates.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(updates.is_active);
  }
  if (updates.is_blocking !== undefined) {
    fields.push(`is_blocking = $${paramIndex++}`);
    values.push(updates.is_blocking);
  }

  if (fields.length === 0) {
    return findById(ruleId);
  }

  values.push(ruleId);
  const sql = `
    UPDATE eligibility_rules
    SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE rule_id = $${paramIndex}
    RETURNING *
  `;

  return queryOne<EligibilityRule>(sql, values);
}

export async function create(rule: Omit<EligibilityRule, 'created_at' | 'updated_at'>): Promise<EligibilityRule> {
  const sql = `
    INSERT INTO eligibility_rules (
      rule_id, rule_name, rule_category, rule_description,
      condition_json, priority, is_active, is_blocking
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const rows = await query<EligibilityRule>(sql, [
    rule.rule_id,
    rule.rule_name,
    rule.rule_category,
    rule.rule_description,
    JSON.stringify(rule.condition_json),
    rule.priority,
    rule.is_active,
    rule.is_blocking,
  ]);

  return rows[0];
}

export default {
  findAll,
  findById,
  findByCategory,
  update,
  create,
};
