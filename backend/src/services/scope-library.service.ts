import { query, queryOne, transaction } from '../config/database';

// Types
interface ScopeTemplate {
  id: string;
  name: string;
  car_type: string;
  shopping_type_code: string;
  shopping_reason_code: string;
  description: string;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

interface ScopeTemplateItem {
  id: string;
  scope_library_id: string;
  line_number: number;
  instruction_text: string;
  source: string;
  ccm_section_id: string | null;
  created_at: string;
  updated_at: string;
  job_codes?: JobCodeRef[];
}

interface JobCodeRef {
  id: string;
  code: string;
  code_type: string;
  description: string;
  is_expected: boolean;
  notes: string | null;
}

interface CreateScopeTemplateInput {
  name: string;
  car_type?: string;
  shopping_type_code?: string;
  shopping_reason_code?: string;
  description?: string;
}

export async function createScopeTemplate(
  input: CreateScopeTemplateInput,
  userId: string
): Promise<ScopeTemplate> {
  const result = await queryOne<ScopeTemplate>(
    `INSERT INTO scope_library (name, car_type, shopping_type_code, shopping_reason_code, description, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.name, input.car_type || null, input.shopping_type_code || null, input.shopping_reason_code || null, input.description || null, userId]
  );
  return result!;
}

export async function getScopeTemplate(id: string): Promise<(ScopeTemplate & { items: ScopeTemplateItem[] }) | null> {
  const template = await queryOne<ScopeTemplate>(
    `SELECT * FROM scope_library WHERE id = $1`,
    [id]
  );

  if (!template) return null;

  const rows = await query<ScopeTemplateItem & { jc_id: string; jc_code: string; jc_code_type: string; jc_description: string; jc_is_expected: boolean; jc_notes: string | null }>(
    `SELECT
       sli.id, sli.scope_library_id, sli.line_number, sli.instruction_text,
       sli.source, sli.ccm_section_id, sli.created_at, sli.updated_at,
       jc.id AS jc_id, jc.code AS jc_code, jc.code_type AS jc_code_type,
       jc.description AS jc_description,
       slic.is_expected AS jc_is_expected, slic.notes AS jc_notes
     FROM scope_library_items sli
     LEFT JOIN scope_library_item_codes slic ON slic.scope_library_item_id = sli.id
     LEFT JOIN job_codes jc ON jc.id = slic.job_code_id
     WHERE sli.scope_library_id = $1
     ORDER BY sli.line_number`,
    [id]
  );

  const itemsMap = new Map<string, ScopeTemplateItem>();

  for (const row of rows) {
    if (!itemsMap.has(row.id)) {
      itemsMap.set(row.id, {
        id: row.id,
        scope_library_id: row.scope_library_id,
        line_number: row.line_number,
        instruction_text: row.instruction_text,
        source: row.source,
        ccm_section_id: row.ccm_section_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        job_codes: [],
      });
    }

    if (row.jc_id) {
      itemsMap.get(row.id)!.job_codes!.push({
        id: row.jc_id,
        code: row.jc_code,
        code_type: row.jc_code_type,
        description: row.jc_description,
        is_expected: row.jc_is_expected,
        notes: row.jc_notes,
      });
    }
  }

  return {
    ...template,
    items: Array.from(itemsMap.values()),
  };
}

export async function listScopeTemplates(filters: {
  car_type?: string;
  shopping_type_code?: string;
  shopping_reason_code?: string;
  search?: string;
}): Promise<ScopeTemplate[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.car_type) {
    conditions.push(`car_type = $${paramIndex++}`);
    params.push(filters.car_type);
  }

  if (filters.shopping_type_code) {
    conditions.push(`shopping_type_code = $${paramIndex++}`);
    params.push(filters.shopping_type_code);
  }

  if (filters.shopping_reason_code) {
    conditions.push(`shopping_reason_code = $${paramIndex++}`);
    params.push(filters.shopping_reason_code);
  }

  if (filters.search) {
    conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const results = await query<ScopeTemplate>(
    `SELECT * FROM v_scope_library ${whereClause} ORDER BY updated_at DESC`,
    params
  );

  return results;
}

export async function suggestScopes(
  carType: string,
  shoppingTypeCode: string,
  shoppingReasonCode: string
): Promise<ScopeTemplate[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (carType) {
    conditions.push(`car_type = $${paramIndex++}`);
    params.push(carType);
  }

  if (shoppingTypeCode) {
    conditions.push(`shopping_type_code = $${paramIndex++}`);
    params.push(shoppingTypeCode);
  }

  if (shoppingReasonCode) {
    conditions.push(`shopping_reason_code = $${paramIndex++}`);
    params.push(shoppingReasonCode);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')} AND is_active = true` : 'WHERE is_active = true';

  const results = await query<ScopeTemplate>(
    `SELECT * FROM scope_library ${whereClause} ORDER BY usage_count DESC LIMIT 5`,
    params
  );

  return results;
}

export async function updateScopeTemplate(
  id: string,
  input: Partial<CreateScopeTemplateInput>
): Promise<ScopeTemplate | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    params.push(input.name);
  }

  if (input.car_type !== undefined) {
    fields.push(`car_type = $${paramIndex++}`);
    params.push(input.car_type);
  }

  if (input.shopping_type_code !== undefined) {
    fields.push(`shopping_type_code = $${paramIndex++}`);
    params.push(input.shopping_type_code);
  }

  if (input.shopping_reason_code !== undefined) {
    fields.push(`shopping_reason_code = $${paramIndex++}`);
    params.push(input.shopping_reason_code);
  }

  if (input.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    params.push(input.description);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const result = await queryOne<ScopeTemplate>(
    `UPDATE scope_library SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return result || null;
}

export async function addTemplateItem(
  templateId: string,
  item: { line_number: number; instruction_text: string; source?: string; ccm_section_id?: string }
): Promise<ScopeTemplateItem> {
  const result = await queryOne<ScopeTemplateItem>(
    `INSERT INTO scope_library_items (scope_library_id, line_number, instruction_text, source, ccm_section_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [templateId, item.line_number, item.instruction_text, item.source || null, item.ccm_section_id || null]
  );
  return result!;
}

export async function updateTemplateItem(
  itemId: string,
  input: Partial<{ line_number: number; instruction_text: string; source: string; ccm_section_id: string }>
): Promise<ScopeTemplateItem | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (input.line_number !== undefined) {
    fields.push(`line_number = $${paramIndex++}`);
    params.push(input.line_number);
  }

  if (input.instruction_text !== undefined) {
    fields.push(`instruction_text = $${paramIndex++}`);
    params.push(input.instruction_text);
  }

  if (input.source !== undefined) {
    fields.push(`source = $${paramIndex++}`);
    params.push(input.source);
  }

  if (input.ccm_section_id !== undefined) {
    fields.push(`ccm_section_id = $${paramIndex++}`);
    params.push(input.ccm_section_id);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = NOW()`);
  params.push(itemId);

  const result = await queryOne<ScopeTemplateItem>(
    `UPDATE scope_library_items SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return result || null;
}

export async function removeTemplateItem(itemId: string): Promise<void> {
  await query(
    `DELETE FROM scope_library_items WHERE id = $1`,
    [itemId]
  );
}

export async function addItemJobCode(
  itemId: string,
  jobCodeId: string,
  isExpected?: boolean,
  notes?: string
): Promise<void> {
  await query(
    `INSERT INTO scope_library_item_codes (scope_library_item_id, job_code_id, is_expected, notes)
     VALUES ($1, $2, $3, $4)`,
    [itemId, jobCodeId, isExpected ?? false, notes || null]
  );
}

export async function removeItemJobCode(itemId: string, jobCodeId: string): Promise<void> {
  await query(
    `DELETE FROM scope_library_item_codes WHERE scope_library_item_id = $1 AND job_code_id = $2`,
    [itemId, jobCodeId]
  );
}

export async function incrementUsage(id: string): Promise<void> {
  await query(
    `UPDATE scope_library SET usage_count = usage_count + 1, last_used_at = NOW() WHERE id = $1`,
    [id]
  );
}
