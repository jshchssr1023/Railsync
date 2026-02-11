import { query, queryOne, transaction } from '../config/database';
import { logTransition } from './transition-log.service';

// Types
interface ScopeOfWork {
  id: string;
  scope_library_id: string | null;
  status: 'draft' | 'finalized' | 'sent';
  finalized_at: string | null;
  finalized_by_id: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  items?: SOWItem[];
}

interface SOWItem {
  id: string;
  scope_of_work_id: string;
  line_number: number;
  instruction_text: string;
  source: string;
  ccm_section_id: string | null;
  scope_library_item_id: string | null;
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

export async function createSOW(
  input: { scope_library_id?: string },
  userId: string
): Promise<ScopeOfWork> {
  const result = await queryOne<ScopeOfWork>(
    `INSERT INTO scope_of_work (scope_library_id, status, created_by_id)
     VALUES ($1, 'draft', $2)
     RETURNING *`,
    [input.scope_library_id || null, userId]
  );
  return result!;
}

export async function getSOW(id: string): Promise<ScopeOfWork | null> {
  const sow = await queryOne<ScopeOfWork>(
    `SELECT * FROM scope_of_work WHERE id = $1`,
    [id]
  );

  if (!sow) return null;

  const rows = await query<SOWItem & { jc_id: string; jc_code: string; jc_code_type: string; jc_description: string; jc_is_expected: boolean; jc_notes: string | null }>(
    `SELECT
       sowi.id, sowi.scope_of_work_id, sowi.line_number, sowi.instruction_text,
       sowi.source, sowi.ccm_section_id, sowi.scope_library_item_id,
       sowi.created_at, sowi.updated_at,
       jc.id AS jc_id, jc.code AS jc_code, jc.code_type AS jc_code_type,
       jc.description AS jc_description,
       sowic.is_expected AS jc_is_expected, sowic.notes AS jc_notes
     FROM scope_of_work_items sowi
     LEFT JOIN scope_of_work_item_codes sowic ON sowic.sow_item_id = sowi.id
     LEFT JOIN job_codes jc ON jc.id = sowic.job_code_id
     WHERE sowi.scope_of_work_id = $1
     ORDER BY sowi.line_number`,
    [id]
  );

  const itemsMap = new Map<string, SOWItem>();

  for (const row of rows) {
    if (!itemsMap.has(row.id)) {
      itemsMap.set(row.id, {
        id: row.id,
        scope_of_work_id: row.scope_of_work_id,
        line_number: row.line_number,
        instruction_text: row.instruction_text,
        source: row.source,
        ccm_section_id: row.ccm_section_id,
        scope_library_item_id: row.scope_library_item_id,
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
    ...sow,
    items: Array.from(itemsMap.values()),
  };
}

export async function addSOWItem(
  sowId: string,
  item: { line_number: number; instruction_text: string; source?: string; ccm_section_id?: string; scope_library_item_id?: string }
): Promise<SOWItem> {
  const result = await queryOne<SOWItem>(
    `INSERT INTO scope_of_work_items (scope_of_work_id, line_number, instruction_text, source, ccm_section_id, scope_library_item_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [sowId, item.line_number, item.instruction_text, item.source || null, item.ccm_section_id || null, item.scope_library_item_id || null]
  );
  return result!;
}

export async function updateSOWItem(
  itemId: string,
  input: Partial<{ line_number: number; instruction_text: string; source: string; ccm_section_id: string }>
): Promise<SOWItem | null> {
  // Check SOW is not finalized
  const sowCheck = await queryOne<{ status: string }>(
    `SELECT sow.status FROM scope_of_work sow
     JOIN scope_of_work_items sowi ON sowi.scope_of_work_id = sow.id
     WHERE sowi.id = $1`,
    [itemId]
  );

  if (!sowCheck) return null;

  if (sowCheck.status === 'finalized') {
    throw new Error('Cannot update items on a finalized scope of work');
  }

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

  const result = await queryOne<SOWItem>(
    `UPDATE scope_of_work_items SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return result || null;
}

export async function removeSOWItem(itemId: string): Promise<void> {
  await query(
    `DELETE FROM scope_of_work_items WHERE id = $1`,
    [itemId]
  );
}

export async function addItemJobCode(
  sowItemId: string,
  jobCodeId: string,
  isExpected?: boolean,
  notes?: string
): Promise<void> {
  await query(
    `INSERT INTO scope_of_work_item_codes (sow_item_id, job_code_id, is_expected, notes)
     VALUES ($1, $2, $3, $4)`,
    [sowItemId, jobCodeId, isExpected ?? false, notes || null]
  );
}

export async function removeItemJobCode(sowItemId: string, jobCodeId: string): Promise<void> {
  await query(
    `DELETE FROM scope_of_work_item_codes WHERE sow_item_id = $1 AND job_code_id = $2`,
    [sowItemId, jobCodeId]
  );
}

export async function populateFromLibrary(sowId: string, templateId: string): Promise<number> {
  return await transaction(async (client) => {
    // Read template items with their job codes
    const templateItems = await client.query(
      `SELECT * FROM scope_library_items WHERE scope_library_id = $1 ORDER BY line_number`,
      [templateId]
    );

    let insertedCount = 0;

    for (const item of templateItems.rows) {
      // Insert SOW item
      const insertedItem = await client.query(
        `INSERT INTO scope_of_work_items (scope_of_work_id, line_number, instruction_text, source, ccm_section_id, scope_library_item_id)
         VALUES ($1, $2, $3, 'library', $4, $5)
         RETURNING id`,
        [sowId, item.line_number, item.instruction_text, item.ccm_section_id, item.id]
      );

      const newItemId = insertedItem.rows[0].id;

      // Copy job codes from template item to SOW item
      const itemCodes = await client.query(
        `SELECT job_code_id, is_expected, notes FROM scope_library_item_codes WHERE scope_library_item_id = $1`,
        [item.id]
      );

      for (const code of itemCodes.rows) {
        await client.query(
          `INSERT INTO scope_of_work_item_codes (sow_item_id, job_code_id, is_expected, notes)
           VALUES ($1, $2, $3, $4)`,
          [newItemId, code.job_code_id, code.is_expected, code.notes]
        );
      }

      insertedCount++;
    }

    // Increment usage on the template
    await client.query(
      `UPDATE scope_library SET usage_count = usage_count + 1, last_used_at = NOW() WHERE id = $1`,
      [templateId]
    );

    return insertedCount;
  });
}

export async function populateFromCCM(sowId: string, ccmSectionIds: string[]): Promise<number> {
  // Get current max line number
  const maxLineResult = await queryOne<{ max_line: number }>(
    `SELECT COALESCE(MAX(line_number), 0) AS max_line FROM scope_of_work_items WHERE scope_of_work_id = $1`,
    [sowId]
  );

  let currentLine = maxLineResult?.max_line || 0;
  let insertedCount = 0;

  for (const sectionId of ccmSectionIds) {
    const section = await queryOne<{ id: string; content: string }>(
      `SELECT id, content FROM ccm_sections WHERE id = $1`,
      [sectionId]
    );

    if (!section) continue;

    currentLine++;

    await query(
      `INSERT INTO scope_of_work_items (scope_of_work_id, line_number, instruction_text, source, ccm_section_id)
       VALUES ($1, $2, $3, 'ccm', $4)`,
      [sowId, currentLine, section.content, sectionId]
    );

    insertedCount++;
  }

  return insertedCount;
}

export async function finalizeSOW(id: string, userId: string): Promise<ScopeOfWork | null> {
  const result = await queryOne<ScopeOfWork>(
    `UPDATE scope_of_work
     SET status = 'finalized', finalized_at = NOW(), finalized_by_id = $1, updated_at = NOW()
     WHERE id = $2 AND status = 'draft'
     RETURNING *`,
    [userId, id]
  );

  if (result) {
    await logTransition({
      processType: 'scope_of_work',
      entityId: id,
      fromState: 'draft',
      toState: 'finalized',
      isReversible: false, // DB trigger prevents changes after finalization
      actorId: userId,
    }).catch(() => {}); // non-blocking
  }

  return result || null;
}

export async function saveAsTemplate(
  sowId: string,
  name: string,
  userId: string
): Promise<{ id: string; name: string }> {
  return await transaction(async (client) => {
    // Get SOW details
    const sowResult = await client.query(
      `SELECT * FROM scope_of_work WHERE id = $1`,
      [sowId]
    );

    if (sowResult.rows.length === 0) {
      throw new Error('Scope of work not found');
    }

    // Create scope_library entry
    const templateResult = await client.query(
      `INSERT INTO scope_library (name, created_by_id)
       VALUES ($1, $2)
       RETURNING *`,
      [name, userId]
    );

    const templateId = templateResult.rows[0].id;

    // Read SOW items
    const sowItems = await client.query(
      `SELECT * FROM scope_of_work_items WHERE scope_of_work_id = $1 ORDER BY line_number`,
      [sowId]
    );

    for (const item of sowItems.rows) {
      // Insert scope_library_items
      const newItem = await client.query(
        `INSERT INTO scope_library_items (scope_library_id, line_number, instruction_text, source, ccm_section_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [templateId, item.line_number, item.instruction_text, item.source, item.ccm_section_id]
      );

      const newItemId = newItem.rows[0].id;

      // Copy job codes from SOW item to template item
      const itemCodes = await client.query(
        `SELECT job_code_id, is_expected, notes FROM scope_of_work_item_codes WHERE sow_item_id = $1`,
        [item.id]
      );

      for (const code of itemCodes.rows) {
        await client.query(
          `INSERT INTO scope_library_item_codes (scope_library_item_id, job_code_id, is_expected, notes)
           VALUES ($1, $2, $3, $4)`,
          [newItemId, code.job_code_id, code.is_expected, code.notes]
        );
      }
    }

    return { id: templateId, name };
  });
}
