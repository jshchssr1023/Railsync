/**
 * Work Package Service
 * Manages the full lifecycle of work packages — the deliverable unit sent to shops.
 * A work package composes: cover sheet + SOW + CCM snapshot + drawings + project context.
 */

import { query, queryOne, transaction } from '../config/database';
import logger from '../config/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkPackageDetail {
  id: string;
  project_id?: string;
  shopping_event_id?: string;
  allocation_id?: string;
  shopping_packet_id?: string;
  package_number: string;
  version: number;
  status: string;
  car_number: string;
  shop_code: string;
  shop_name?: string;
  lessee_code?: string;
  lessee_name?: string;
  scope_of_work_id?: string;
  ccm_instruction_id?: string;
  special_instructions?: string;
  project_context?: Record<string, unknown>;
  sow_snapshot?: Record<string, unknown>;
  ccm_snapshot?: Record<string, unknown>;
  billable_items_snapshot?: Record<string, unknown>;
  documents_snapshot?: Record<string, unknown>;
  supersedes_id?: string;
  reissue_reason?: string;
  issued_at?: string;
  issued_by?: string;
  assembled_by?: string;
  assembled_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  project_number?: string;
  project_name?: string;
  project_type?: string;
  issued_by_email?: string;
  created_by_email?: string;
  assembled_by_email?: string;
  document_count?: number;
  override_count?: number;
  // Nested
  documents?: WorkPackageDocument[];
  ccm_overrides?: CCMOverride[];
  audit_events?: AuditEvent[];
}

export interface WorkPackageDocument {
  id: string;
  work_package_id: string;
  document_type: string;
  document_name: string;
  file_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
  mfiles_id?: string;
  mfiles_url?: string;
  sort_order: number;
  uploaded_by_id?: string;
  created_at: string;
}

export interface CCMOverride {
  id: string;
  work_package_id: string;
  field_name: string;
  original_value?: string;
  override_value: string;
  override_reason?: string;
  overridden_by?: string;
  overridden_at: string;
}

export interface AuditEvent {
  id: string;
  work_package_id: string;
  event_timestamp: string;
  actor_id?: string;
  actor_email?: string;
  action: string;
  before_state?: string;
  after_state?: string;
  details?: Record<string, unknown>;
}

export interface CreateWorkPackageInput {
  project_id?: string;
  shopping_event_id?: string;
  allocation_id?: string;
  car_number: string;
  shop_code: string;
  special_instructions?: string;
}

export interface AssembleInput {
  scope_of_work_id?: string;
  ccm_instruction_id?: string;
  special_instructions?: string;
}

export interface AddDocumentInput {
  document_type: string;
  document_name: string;
  file_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
}

export interface LinkMFilesInput {
  document_type: string;
  document_name: string;
  mfiles_id: string;
  mfiles_url?: string;
}

export interface CCMOverrideInput {
  field_name: string;
  override_value: string;
  override_reason?: string;
  original_value?: string;
}

// ============================================================================
// WORK PACKAGE CRUD
// ============================================================================

export async function createWorkPackage(
  input: CreateWorkPackageInput,
  userId?: string
): Promise<WorkPackageDetail> {
  return transaction(async (client) => {
    // Generate package number
    const pkgNum = await client.query(`SELECT generate_package_number() AS num`);
    const packageNumber = pkgNum.rows[0]?.num || `WPK-${Date.now()}`;

    // Look up shop name
    const shopResult = await client.query(
      `SELECT shop_name FROM shops WHERE shop_code = $1`,
      [input.shop_code]
    );
    const shopName = shopResult.rows[0]?.shop_name || null;

    // Look up car lessee info
    const carResult = await client.query(
      `SELECT lessee_code, lessee_name FROM cars WHERE car_number = $1`,
      [input.car_number]
    );
    const lesseeCode = carResult.rows[0]?.lessee_code || null;
    const lesseeName = carResult.rows[0]?.lessee_name || null;

    // Build project context if project_id provided
    let projectContext = null;
    if (input.project_id) {
      const projResult = await client.query(
        `SELECT project_number, project_name, project_type, due_date, scope_of_work, special_instructions,
                engineer_notes, lessee_code, lessee_name
         FROM projects WHERE id = $1`,
        [input.project_id]
      );
      if (projResult.rows[0]) {
        projectContext = projResult.rows[0];
      }
    }

    // Insert work package
    const result = await client.query(
      `INSERT INTO work_packages (
        project_id, shopping_event_id, allocation_id,
        package_number, car_number, shop_code, shop_name,
        lessee_code, lessee_name, special_instructions, project_context,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        input.project_id || null,
        input.shopping_event_id || null,
        input.allocation_id || null,
        packageNumber,
        input.car_number,
        input.shop_code,
        shopName,
        lesseeCode,
        lesseeName,
        input.special_instructions || null,
        projectContext ? JSON.stringify(projectContext) : null,
        userId || null,
      ]
    );

    const wp = result.rows[0];

    // Log audit event
    await client.query(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, after_state, details)
       VALUES ($1, $2, 'created', 'draft', $3)`,
      [wp.id, userId || null, JSON.stringify({ package_number: packageNumber, car_number: input.car_number, shop_code: input.shop_code })]
    );

    return wp;
  });
}

export async function getWorkPackage(id: string): Promise<WorkPackageDetail | null> {
  const wp = await queryOne<WorkPackageDetail>(
    `SELECT * FROM v_work_packages WHERE id = $1`,
    [id]
  );

  if (!wp) return null;

  // Fetch related data in parallel
  const [documents, overrides, auditEvents] = await Promise.all([
    query<WorkPackageDocument>(
      `SELECT * FROM work_package_documents WHERE work_package_id = $1 ORDER BY sort_order, created_at`,
      [id]
    ),
    query<CCMOverride>(
      `SELECT * FROM work_package_ccm_overrides WHERE work_package_id = $1 ORDER BY field_name`,
      [id]
    ),
    query<AuditEvent>(
      `SELECT ae.*, u.email AS actor_email
       FROM work_package_audit_events ae
       LEFT JOIN users u ON u.id = ae.actor_id
       WHERE ae.work_package_id = $1
       ORDER BY ae.event_timestamp DESC`,
      [id]
    ),
  ]);

  return { ...wp, documents, ccm_overrides: overrides, audit_events: auditEvents };
}

export async function listWorkPackages(filters: {
  status?: string;
  project_id?: string;
  shop_code?: string;
  car_number?: string;
  lessee_code?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ packages: WorkPackageDetail[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(filters.status);
  }
  if (filters.project_id) {
    conditions.push(`project_id = $${paramIdx++}`);
    params.push(filters.project_id);
  }
  if (filters.shop_code) {
    conditions.push(`shop_code = $${paramIdx++}`);
    params.push(filters.shop_code);
  }
  if (filters.car_number) {
    conditions.push(`car_number = $${paramIdx++}`);
    params.push(filters.car_number);
  }
  if (filters.lessee_code) {
    conditions.push(`lessee_code = $${paramIdx++}`);
    params.push(filters.lessee_code);
  }
  if (filters.search) {
    conditions.push(`(package_number ILIKE $${paramIdx} OR car_number ILIKE $${paramIdx} OR shop_name ILIKE $${paramIdx} OR lessee_name ILIKE $${paramIdx})`);
    params.push(`%${filters.search}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM v_work_packages ${whereClause}`,
    params
  );

  const packages = await query<WorkPackageDetail>(
    `SELECT * FROM v_work_packages ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return { packages, total: parseInt(countResult?.count || '0', 10) };
}

export async function listForShop(shopCode: string): Promise<WorkPackageDetail[]> {
  return query<WorkPackageDetail>(
    `SELECT * FROM v_shop_work_packages WHERE shop_code = $1 ORDER BY issued_at DESC`,
    [shopCode]
  );
}

// ============================================================================
// WORK PACKAGE LIFECYCLE
// ============================================================================

export async function updateWorkPackage(
  id: string,
  updates: {
    special_instructions?: string;
    scope_of_work_id?: string;
    ccm_instruction_id?: string;
  },
  userId?: string
): Promise<WorkPackageDetail | null> {
  const setClauses: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (updates.special_instructions !== undefined) {
    setClauses.push(`special_instructions = $${paramIdx++}`);
    params.push(updates.special_instructions);
  }
  if (updates.scope_of_work_id !== undefined) {
    setClauses.push(`scope_of_work_id = $${paramIdx++}`);
    params.push(updates.scope_of_work_id);
  }
  if (updates.ccm_instruction_id !== undefined) {
    setClauses.push(`ccm_instruction_id = $${paramIdx++}`);
    params.push(updates.ccm_instruction_id);
  }

  if (setClauses.length === 0) return getWorkPackage(id);

  setClauses.push(`updated_at = NOW()`);

  const result = await queryOne<WorkPackageDetail>(
    `UPDATE work_packages SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx++} AND status = 'draft'
     RETURNING *`,
    [...params, id]
  );

  if (result && userId) {
    await queryOne(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, details)
       VALUES ($1, $2, 'updated', $3)`,
      [id, userId, JSON.stringify(updates)]
    );
  }

  return result;
}

export async function assembleWorkPackage(
  id: string,
  input: AssembleInput,
  userId: string
): Promise<WorkPackageDetail | null> {
  return transaction(async (client) => {
    // Update with assembly data and change status
    const result = await client.query(
      `UPDATE work_packages SET
        scope_of_work_id = COALESCE($1, scope_of_work_id),
        ccm_instruction_id = COALESCE($2, ccm_instruction_id),
        special_instructions = COALESCE($3, special_instructions),
        status = 'assembled',
        assembled_by = $4,
        assembled_at = NOW(),
        updated_at = NOW()
       WHERE id = $5 AND status IN ('draft')
       RETURNING *`,
      [
        input.scope_of_work_id || null,
        input.ccm_instruction_id || null,
        input.special_instructions || null,
        userId,
        id,
      ]
    );

    if (result.rows.length === 0) return null;

    // Log audit event
    await client.query(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, before_state, after_state, details)
       VALUES ($1, $2, 'assembled', 'draft', 'assembled', $3)`,
      [id, userId, JSON.stringify({ scope_of_work_id: input.scope_of_work_id, ccm_instruction_id: input.ccm_instruction_id })]
    );

    return result.rows[0];
  });
}

export async function issueWorkPackage(
  id: string,
  userId: string
): Promise<WorkPackageDetail | null> {
  return transaction(async (client) => {
    // Get current package
    const current = await client.query(
      `SELECT * FROM work_packages WHERE id = $1 AND status IN ('draft', 'assembled')`,
      [id]
    );
    if (current.rows.length === 0) return null;

    const wp = current.rows[0];

    // Build SOW snapshot
    let sowSnapshot = null;
    if (wp.scope_of_work_id) {
      const sowItems = await client.query(
        `SELECT * FROM scope_of_work_items WHERE scope_of_work_id = $1 ORDER BY line_number`,
        [wp.scope_of_work_id]
      );
      sowSnapshot = { scope_of_work_id: wp.scope_of_work_id, items: sowItems.rows };
    }

    // Build CCM snapshot (resolved effective CCM for this car)
    let ccmSnapshot = null;
    try {
      const ccmResult = await client.query(
        `SELECT * FROM ccm_instructions WHERE id = $1 AND is_current = TRUE`,
        [wp.ccm_instruction_id]
      );
      if (ccmResult.rows.length > 0) {
        ccmSnapshot = ccmResult.rows[0];
      }
    } catch {
      // CCM resolution optional — log and continue
      logger.warn({ wpId: id }, 'CCM snapshot resolution failed');
    }

    // Apply CCM overrides to snapshot
    const overrides = await client.query(
      `SELECT * FROM work_package_ccm_overrides WHERE work_package_id = $1`,
      [id]
    );
    if (overrides.rows.length > 0 && ccmSnapshot) {
      ccmSnapshot = {
        ...ccmSnapshot,
        overrides: overrides.rows.map((o: CCMOverride) => ({
          field_name: o.field_name,
          original_value: o.original_value,
          override_value: o.override_value,
          override_reason: o.override_reason,
        })),
      };
    }

    // Build documents snapshot
    const docs = await client.query(
      `SELECT document_type, document_name, mfiles_id, mfiles_url, file_path, sort_order
       FROM work_package_documents WHERE work_package_id = $1 ORDER BY sort_order`,
      [id]
    );
    const documentsSnapshot = docs.rows;

    // Build billable items snapshot
    let billableSnapshot = null;
    if (wp.lessee_code) {
      const billable = await client.query(
        `SELECT item_code, item_description, is_customer_responsible, billing_notes
         FROM billable_items WHERE lessee_code = $1`,
        [wp.lessee_code]
      );
      billableSnapshot = billable.rows;
    }

    // Issue: freeze snapshots, update status
    const result = await client.query(
      `UPDATE work_packages SET
        status = 'issued',
        sow_snapshot = $1,
        ccm_snapshot = $2,
        documents_snapshot = $3,
        billable_items_snapshot = $4,
        issued_at = NOW(),
        issued_by = $5,
        updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        sowSnapshot ? JSON.stringify(sowSnapshot) : null,
        ccmSnapshot ? JSON.stringify(ccmSnapshot) : null,
        documentsSnapshot.length > 0 ? JSON.stringify(documentsSnapshot) : null,
        billableSnapshot ? JSON.stringify(billableSnapshot) : null,
        userId,
        id,
      ]
    );

    // Log audit event
    await client.query(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, before_state, after_state, details)
       VALUES ($1, $2, 'issued', $3, 'issued', $4)`,
      [id, userId, wp.status, JSON.stringify({
        sow_items_count: sowSnapshot?.items?.length || 0,
        documents_count: documentsSnapshot.length,
        overrides_count: overrides.rows.length,
        billable_items_count: billableSnapshot?.length || 0,
      })]
    );

    return result.rows[0];
  });
}

export async function reissueWorkPackage(
  id: string,
  reason: string,
  userId: string
): Promise<WorkPackageDetail | null> {
  return transaction(async (client) => {
    // Get current issued package
    const current = await client.query(
      `SELECT * FROM work_packages WHERE id = $1 AND status = 'issued'`,
      [id]
    );
    if (current.rows.length === 0) return null;

    const old = current.rows[0];

    // Supersede the old package
    await client.query(
      `UPDATE work_packages SET status = 'superseded', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Generate new package number (same base, new version)
    const newVersion = old.version + 1;

    // Create new version
    const result = await client.query(
      `INSERT INTO work_packages (
        project_id, shopping_event_id, allocation_id, shopping_packet_id,
        package_number, version, status,
        car_number, shop_code, shop_name, lessee_code, lessee_name,
        scope_of_work_id, ccm_instruction_id,
        special_instructions, project_context,
        supersedes_id, reissue_reason,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        old.project_id, old.shopping_event_id, old.allocation_id, old.shopping_packet_id,
        old.package_number, newVersion,
        old.car_number, old.shop_code, old.shop_name, old.lessee_code, old.lessee_name,
        old.scope_of_work_id, old.ccm_instruction_id,
        old.special_instructions, old.project_context ? JSON.stringify(old.project_context) : null,
        id, reason,
        userId,
      ]
    );

    const newWp = result.rows[0];

    // Copy documents from old to new
    await client.query(
      `INSERT INTO work_package_documents (work_package_id, document_type, document_name, file_path, file_size_bytes, mime_type, mfiles_id, mfiles_url, sort_order, uploaded_by_id)
       SELECT $1, document_type, document_name, file_path, file_size_bytes, mime_type, mfiles_id, mfiles_url, sort_order, uploaded_by_id
       FROM work_package_documents WHERE work_package_id = $2`,
      [newWp.id, id]
    );

    // Copy CCM overrides from old to new
    await client.query(
      `INSERT INTO work_package_ccm_overrides (work_package_id, field_name, original_value, override_value, override_reason, overridden_by)
       SELECT $1, field_name, original_value, override_value, override_reason, overridden_by
       FROM work_package_ccm_overrides WHERE work_package_id = $2`,
      [newWp.id, id]
    );

    // Log audit events
    await client.query(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, before_state, after_state, details)
       VALUES ($1, $2, 'superseded', 'issued', 'superseded', $3)`,
      [id, userId, JSON.stringify({ reason, superseded_by: newWp.id })]
    );

    await client.query(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, after_state, details)
       VALUES ($1, $2, 'reissued', 'draft', $3)`,
      [newWp.id, userId, JSON.stringify({ reason, supersedes: id, version: newVersion })]
    );

    return newWp;
  });
}

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

export async function addDocument(
  workPackageId: string,
  input: AddDocumentInput,
  userId?: string
): Promise<WorkPackageDocument> {
  const result = await queryOne<WorkPackageDocument>(
    `INSERT INTO work_package_documents (
      work_package_id, document_type, document_name,
      file_path, file_size_bytes, mime_type, uploaded_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      workPackageId,
      input.document_type,
      input.document_name,
      input.file_path || null,
      input.file_size_bytes || null,
      input.mime_type || null,
      userId || null,
    ]
  );

  if (userId) {
    await queryOne(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, details)
       VALUES ($1, $2, 'document_added', $3)`,
      [workPackageId, userId, JSON.stringify({ document_name: input.document_name, document_type: input.document_type })]
    );
  }

  return result!;
}

export async function linkMFilesDocument(
  workPackageId: string,
  input: LinkMFilesInput,
  userId?: string
): Promise<WorkPackageDocument> {
  const result = await queryOne<WorkPackageDocument>(
    `INSERT INTO work_package_documents (
      work_package_id, document_type, document_name,
      mfiles_id, mfiles_url, uploaded_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      workPackageId,
      input.document_type,
      input.document_name,
      input.mfiles_id,
      input.mfiles_url || null,
      userId || null,
    ]
  );

  if (userId) {
    await queryOne(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, details)
       VALUES ($1, $2, 'document_added', $3)`,
      [workPackageId, userId, JSON.stringify({ document_name: input.document_name, mfiles_id: input.mfiles_id })]
    );
  }

  return result!;
}

export async function removeDocument(
  workPackageId: string,
  documentId: string,
  userId?: string
): Promise<boolean> {
  // Get doc name for audit before deleting
  const doc = await queryOne<WorkPackageDocument>(
    `SELECT * FROM work_package_documents WHERE id = $1 AND work_package_id = $2`,
    [documentId, workPackageId]
  );

  if (!doc) return false;

  await queryOne(
    `DELETE FROM work_package_documents WHERE id = $1 AND work_package_id = $2`,
    [documentId, workPackageId]
  );

  if (userId) {
    await queryOne(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, details)
       VALUES ($1, $2, 'document_removed', $3)`,
      [workPackageId, userId, JSON.stringify({ document_name: doc.document_name, document_type: doc.document_type })]
    );
  }

  return true;
}

// ============================================================================
// CCM OVERRIDE OPERATIONS
// ============================================================================

export async function addCCMOverride(
  workPackageId: string,
  input: CCMOverrideInput,
  userId?: string
): Promise<CCMOverride> {
  const result = await queryOne<CCMOverride>(
    `INSERT INTO work_package_ccm_overrides (
      work_package_id, field_name, original_value, override_value, override_reason, overridden_by
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (work_package_id, field_name)
    DO UPDATE SET
      override_value = EXCLUDED.override_value,
      override_reason = EXCLUDED.override_reason,
      overridden_by = EXCLUDED.overridden_by,
      overridden_at = NOW()
    RETURNING *`,
    [
      workPackageId,
      input.field_name,
      input.original_value || null,
      input.override_value,
      input.override_reason || null,
      userId || null,
    ]
  );

  if (userId) {
    await queryOne(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, details)
       VALUES ($1, $2, 'ccm_overridden', $3)`,
      [workPackageId, userId, JSON.stringify({ field_name: input.field_name, original: input.original_value, override: input.override_value })]
    );
  }

  return result!;
}

export async function removeCCMOverride(
  workPackageId: string,
  fieldName: string,
  userId?: string
): Promise<boolean> {
  const result = await queryOne<CCMOverride>(
    `DELETE FROM work_package_ccm_overrides
     WHERE work_package_id = $1 AND field_name = $2
     RETURNING *`,
    [workPackageId, fieldName]
  );

  if (!result) return false;

  if (userId) {
    await queryOne(
      `INSERT INTO work_package_audit_events (work_package_id, actor_id, action, details)
       VALUES ($1, $2, 'ccm_override_removed', $3)`,
      [workPackageId, userId, JSON.stringify({ field_name: fieldName })]
    );
  }

  return true;
}

// ============================================================================
// AUDIT
// ============================================================================

export async function getAuditHistory(workPackageId: string): Promise<AuditEvent[]> {
  return query<AuditEvent>(
    `SELECT ae.*, u.email AS actor_email
     FROM work_package_audit_events ae
     LEFT JOIN users u ON u.id = ae.actor_id
     WHERE ae.work_package_id = $1
     ORDER BY ae.event_timestamp DESC`,
    [workPackageId]
  );
}

export async function getVersionHistory(packageNumber: string): Promise<WorkPackageDetail[]> {
  return query<WorkPackageDetail>(
    `SELECT * FROM v_work_package_history WHERE package_number = $1`,
    [packageNumber]
  );
}

// ============================================================================
// SUMMARY / STATS
// ============================================================================

export async function getWorkPackageSummary(): Promise<{
  total: number;
  by_status: Record<string, number>;
  by_project: { project_name: string; count: number }[];
}> {
  const totalResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM work_packages WHERE status != 'superseded'`
  );

  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) FROM work_packages GROUP BY status ORDER BY status`
  );

  const projectResult = await query<{ project_name: string; count: string }>(
    `SELECT COALESCE(p.project_name, 'No Project') AS project_name, COUNT(*) as count
     FROM work_packages wp
     LEFT JOIN projects p ON p.id = wp.project_id
     WHERE wp.status != 'superseded'
     GROUP BY p.project_name
     ORDER BY count DESC
     LIMIT 10`
  );

  const byStatus: Record<string, number> = {};
  for (const row of statusResult) {
    byStatus[row.status] = parseInt(row.count, 10);
  }

  return {
    total: parseInt(totalResult?.count || '0', 10),
    by_status: byStatus,
    by_project: projectResult.map(r => ({ project_name: r.project_name, count: parseInt(r.count, 10) })),
  };
}
