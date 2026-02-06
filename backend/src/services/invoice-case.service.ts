/**
 * Invoice Case Service
 * Handles InvoiceCase CRUD, state transitions, assignment, and audit logging
 */

import { pool } from '../config/database';
import {
  validateInvoice,
  saveValidationResult,
  WorkflowState,
  ValidationResult,
  InvoiceType,
} from './invoice-validation.service';
import {
  logTransition,
  canRevert,
  markReverted,
  getLastTransition,
} from './transition-log.service';

// ==============================================================================
// Types
// ==============================================================================

export interface InvoiceCase {
  id: string;
  case_number: string;
  invoice_id?: string;
  invoice_type: InvoiceType;
  workflow_state: WorkflowState;
  previous_state?: WorkflowState;
  state_changed_at: Date;
  assigned_admin_id?: string;
  assigned_at?: Date;
  vendor_name?: string;
  shop_id?: string;
  shop_code?: string;
  invoice_number?: string;
  invoice_date?: Date;
  currency: string;
  total_amount?: number;
  car_marks?: string[];
  lessee?: string;
  special_lessee_approval_confirmed: boolean;
  special_lessee_approved_by?: string;
  special_lessee_approved_at?: Date;
  fms_shopping_id?: string;
  fms_workflow_id?: string;
  received_at: Date;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreateInvoiceCaseInput {
  invoice_id?: string;
  invoice_type: InvoiceType;
  vendor_name?: string;
  shop_code?: string;
  invoice_number?: string;
  invoice_date?: Date;
  currency?: string;
  total_amount?: number;
  car_marks?: string[];
  lessee?: string;
  fms_shopping_id?: string;
  fms_workflow_id?: string;
}

export interface UpdateInvoiceCaseInput {
  vendor_name?: string;
  shop_code?: string;
  invoice_number?: string;
  invoice_date?: Date;
  total_amount?: number;
  car_marks?: string[];
  lessee?: string;
  fms_shopping_id?: string;
  fms_workflow_id?: string;
  special_lessee_approval_confirmed?: boolean;
}

export interface AuditEventInput {
  invoice_case_id: string;
  actor_id?: string;
  actor_email?: string;
  actor_role?: string;
  action: string;
  before_state?: WorkflowState;
  after_state?: WorkflowState;
  event_data?: Record<string, unknown>;
  notes?: string;
  validation_result?: ValidationResult;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
}

export interface ListInvoiceCasesFilters {
  workflow_state?: WorkflowState;
  invoice_type?: InvoiceType;
  assigned_admin_id?: string;
  shop_code?: string;
  lessee?: string;
  search?: string;
  from_date?: Date;
  to_date?: Date;
}

// ==============================================================================
// CRUD Operations
// ==============================================================================

export async function createInvoiceCase(
  input: CreateInvoiceCaseInput,
  userId?: string
): Promise<InvoiceCase> {
  const result = await pool.query(
    `INSERT INTO invoice_cases (
       invoice_id, invoice_type, vendor_name, shop_code, invoice_number,
       invoice_date, currency, total_amount, car_marks, lessee,
       fms_shopping_id, fms_workflow_id, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      input.invoice_id || null,
      input.invoice_type,
      input.vendor_name || null,
      input.shop_code || null,
      input.invoice_number || null,
      input.invoice_date || null,
      input.currency || 'USD',
      input.total_amount || null,
      input.car_marks || null,
      input.lessee || null,
      input.fms_shopping_id || null,
      input.fms_workflow_id || null,
      userId || null,
    ]
  );

  const invoiceCase = result.rows[0] as InvoiceCase;

  // Log audit event
  await logAuditEvent({
    invoice_case_id: invoiceCase.id,
    actor_id: userId,
    action: 'CASE_CREATED',
    after_state: 'RECEIVED',
    event_data: input as unknown as Record<string, unknown>,
  });

  return invoiceCase;
}

export async function getInvoiceCase(id: string): Promise<InvoiceCase | null> {
  const result = await pool.query(
    `SELECT * FROM invoice_cases WHERE id = $1`,
    [id]
  );

  return result.rows.length > 0 ? (result.rows[0] as InvoiceCase) : null;
}

export async function getInvoiceCaseByCaseNumber(caseNumber: string): Promise<InvoiceCase | null> {
  const result = await pool.query(
    `SELECT * FROM invoice_cases WHERE case_number = $1`,
    [caseNumber]
  );

  return result.rows.length > 0 ? (result.rows[0] as InvoiceCase) : null;
}

export async function listInvoiceCases(
  filters: ListInvoiceCasesFilters = {},
  page: number = 1,
  limit: number = 25
): Promise<{ cases: InvoiceCase[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | Date | number)[] = [];
  let paramIndex = 1;

  if (filters.workflow_state) {
    conditions.push(`ic.workflow_state = $${paramIndex++}`);
    params.push(filters.workflow_state);
  }

  if (filters.invoice_type) {
    conditions.push(`ic.invoice_type = $${paramIndex++}`);
    params.push(filters.invoice_type);
  }

  if (filters.assigned_admin_id) {
    conditions.push(`ic.assigned_admin_id = $${paramIndex++}`);
    params.push(filters.assigned_admin_id);
  }

  if (filters.shop_code) {
    conditions.push(`ic.shop_code = $${paramIndex++}`);
    params.push(filters.shop_code);
  }

  if (filters.lessee) {
    conditions.push(`ic.lessee ILIKE $${paramIndex++}`);
    params.push(`%${filters.lessee}%`);
  }

  if (filters.search) {
    conditions.push(`(
      ic.case_number ILIKE $${paramIndex} OR
      ic.invoice_number ILIKE $${paramIndex} OR
      ic.vendor_name ILIKE $${paramIndex}
    )`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters.from_date) {
    conditions.push(`ic.received_at >= $${paramIndex++}`);
    params.push(filters.from_date);
  }

  if (filters.to_date) {
    conditions.push(`ic.received_at <= $${paramIndex++}`);
    params.push(filters.to_date);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM invoice_cases ic ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get paginated results with assigned admin name
  const offset = (page - 1) * limit;
  const dataResult = await pool.query(
    `SELECT ic.*,
       TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS assigned_admin_name,
       u.email AS assigned_admin_email
     FROM invoice_cases ic
     LEFT JOIN users u ON ic.assigned_admin_id = u.id
     ${whereClause}
     ORDER BY ic.received_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return {
    cases: dataResult.rows as InvoiceCase[],
    total,
  };
}

export async function updateInvoiceCase(
  id: string,
  input: UpdateInvoiceCaseInput,
  userId?: string
): Promise<InvoiceCase | null> {
  const existingCase = await getInvoiceCase(id);
  if (!existingCase) return null;

  const updates: string[] = [];
  const params: (string | Date | number | boolean | string[] | null)[] = [];
  let paramIndex = 1;

  if (input.vendor_name !== undefined) {
    updates.push(`vendor_name = $${paramIndex++}`);
    params.push(input.vendor_name);
  }
  if (input.shop_code !== undefined) {
    updates.push(`shop_code = $${paramIndex++}`);
    params.push(input.shop_code);
  }
  if (input.invoice_number !== undefined) {
    updates.push(`invoice_number = $${paramIndex++}`);
    params.push(input.invoice_number);
  }
  if (input.invoice_date !== undefined) {
    updates.push(`invoice_date = $${paramIndex++}`);
    params.push(input.invoice_date);
  }
  if (input.total_amount !== undefined) {
    updates.push(`total_amount = $${paramIndex++}`);
    params.push(input.total_amount);
  }
  if (input.car_marks !== undefined) {
    updates.push(`car_marks = $${paramIndex++}`);
    params.push(input.car_marks);
  }
  if (input.lessee !== undefined) {
    updates.push(`lessee = $${paramIndex++}`);
    params.push(input.lessee);
  }
  if (input.fms_shopping_id !== undefined) {
    updates.push(`fms_shopping_id = $${paramIndex++}`);
    params.push(input.fms_shopping_id);
  }
  if (input.fms_workflow_id !== undefined) {
    updates.push(`fms_workflow_id = $${paramIndex++}`);
    params.push(input.fms_workflow_id);
  }
  if (input.special_lessee_approval_confirmed !== undefined) {
    updates.push(`special_lessee_approval_confirmed = $${paramIndex++}`);
    params.push(input.special_lessee_approval_confirmed);
    if (input.special_lessee_approval_confirmed && userId) {
      updates.push(`special_lessee_approved_by = $${paramIndex++}`);
      params.push(userId);
      updates.push(`special_lessee_approved_at = NOW()`);
    }
  }

  if (userId) {
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);
  }

  if (updates.length === 0) return existingCase;

  params.push(id);
  const result = await pool.query(
    `UPDATE invoice_cases SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  // Log audit event
  await logAuditEvent({
    invoice_case_id: id,
    actor_id: userId,
    action: 'CASE_UPDATED',
    event_data: { changes: input },
  });

  return result.rows[0] as InvoiceCase;
}

// ==============================================================================
// State Transitions
// ==============================================================================

export async function transitionState(
  caseId: string,
  targetState: WorkflowState,
  userId?: string,
  notes?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; case?: InvoiceCase; validation?: ValidationResult; error?: string }> {
  // Get current case
  const existingCase = await getInvoiceCase(caseId);
  if (!existingCase) {
    return { success: false, error: 'Invoice case not found' };
  }

  // Run validation
  const validation = await validateInvoice(caseId, targetState);

  // Save validation result
  await saveValidationResult(validation, userId);

  if (!validation.canTransition) {
    // Log blocked transition attempt
    await logAuditEvent({
      invoice_case_id: caseId,
      actor_id: userId,
      action: 'STATE_TRANSITION_BLOCKED',
      before_state: existingCase.workflow_state,
      after_state: targetState,
      notes,
      validation_result: validation,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return {
      success: false,
      validation,
      error: validation.blockingErrors.map((e) => e.message).join('; '),
    };
  }

  // Perform transition
  const result = await pool.query(
    `UPDATE invoice_cases
     SET workflow_state = $1, updated_by = $2
     WHERE id = $3
     RETURNING *`,
    [targetState, userId || null, caseId]
  );

  const updatedCase = result.rows[0] as InvoiceCase;

  // Log to unified transition log
  const transRow = await pool.query(
    'SELECT is_reversible FROM invoice_state_transitions WHERE from_state = $1 AND to_state = $2',
    [existingCase.workflow_state, targetState]
  );
  const isReversible = transRow.rows[0]?.is_reversible ?? false;

  await logTransition({
    processType: 'invoice_case',
    entityId: caseId,
    entityNumber: existingCase.case_number,
    fromState: existingCase.workflow_state,
    toState: targetState,
    isReversible,
    actorId: userId,
    notes,
  });

  // Log successful transition
  await logAuditEvent({
    invoice_case_id: caseId,
    actor_id: userId,
    action: 'STATE_TRANSITIONED',
    before_state: existingCase.workflow_state,
    after_state: targetState,
    notes,
    validation_result: validation,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { success: true, case: updatedCase, validation };
}

/**
 * Revert the last state transition for an invoice case.
 * Validates revert eligibility, performs the reverse transition, and logs the reversal.
 */
export async function revertLastTransition(
  caseId: string,
  userId: string,
  notes?: string
): Promise<InvoiceCase> {
  // 1. Check if revert is allowed
  const eligibility = await canRevert('invoice_case', caseId);
  if (!eligibility.allowed) {
    throw new Error(`Cannot revert: ${eligibility.blockers.join('; ')}`);
  }

  const previousState = eligibility.previousState as WorkflowState;
  if (!previousState) {
    throw new Error('Cannot revert: no previous state recorded');
  }

  // 2. Get the last transition for marking it as reversed later
  const lastTransition = await getLastTransition('invoice_case', caseId);
  if (!lastTransition) {
    throw new Error('Cannot revert: no transition found');
  }

  // 3. Perform the reverse transition
  const result = await transitionState(
    caseId,
    previousState,
    userId,
    notes || 'Reverted by user'
  );

  if (!result.success) {
    throw new Error(`Revert transition failed: ${result.error}`);
  }

  // 4. Log the reversal transition (marked as non-reversible)
  const reversalLog = await logTransition({
    processType: 'invoice_case',
    entityId: caseId,
    entityNumber: result.case!.case_number,
    fromState: lastTransition.to_state,
    toState: previousState,
    isReversible: false,
    actorId: userId,
    notes: notes || 'Reverted by user',
  });

  // 5. Mark the original transition as reversed
  await markReverted(lastTransition.id, userId, reversalLog.id);

  return result.case!;
}

// ==============================================================================
// Assignment
// ==============================================================================

export async function assignCase(
  caseId: string,
  adminId: string,
  assignedBy?: string,
  notes?: string
): Promise<InvoiceCase | null> {
  const existingCase = await getInvoiceCase(caseId);
  if (!existingCase) return null;

  const result = await pool.query(
    `UPDATE invoice_cases
     SET assigned_admin_id = $1, assigned_at = NOW(), updated_by = $2
     WHERE id = $3
     RETURNING *`,
    [adminId, assignedBy || adminId, caseId]
  );

  // Log assignment
  await logAuditEvent({
    invoice_case_id: caseId,
    actor_id: assignedBy,
    action: 'CASE_ASSIGNED',
    event_data: { assigned_to: adminId },
    notes,
  });

  // Auto-transition to ASSIGNED state if currently RECEIVED
  if (existingCase.workflow_state === 'RECEIVED') {
    await transitionState(caseId, 'ASSIGNED', assignedBy);
  }

  return result.rows[0] as InvoiceCase;
}

export async function unassignCase(caseId: string, userId?: string): Promise<InvoiceCase | null> {
  const result = await pool.query(
    `UPDATE invoice_cases
     SET assigned_admin_id = NULL, assigned_at = NULL, updated_by = $1
     WHERE id = $2
     RETURNING *`,
    [userId || null, caseId]
  );

  if (result.rows.length > 0) {
    await logAuditEvent({
      invoice_case_id: caseId,
      actor_id: userId,
      action: 'CASE_UNASSIGNED',
    });
  }

  return result.rows.length > 0 ? (result.rows[0] as InvoiceCase) : null;
}

// ==============================================================================
// Special Lessee Approval
// ==============================================================================

export async function confirmSpecialLesseeApproval(
  caseId: string,
  userId: string,
  notes?: string
): Promise<InvoiceCase | null> {
  const result = await pool.query(
    `UPDATE invoice_cases
     SET special_lessee_approval_confirmed = true,
         special_lessee_approved_by = $1,
         special_lessee_approved_at = NOW(),
         updated_by = $1
     WHERE id = $2
     RETURNING *`,
    [userId, caseId]
  );

  if (result.rows.length > 0) {
    await logAuditEvent({
      invoice_case_id: caseId,
      actor_id: userId,
      action: 'SPECIAL_LESSEE_APPROVED',
      notes,
    });
  }

  return result.rows.length > 0 ? (result.rows[0] as InvoiceCase) : null;
}

// ==============================================================================
// Audit Events
// ==============================================================================

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  await pool.query(
    `INSERT INTO invoice_audit_events (
       invoice_case_id, actor_id, actor_email, actor_role, action,
       before_state, after_state, event_data, notes, validation_result,
       ip_address, user_agent, request_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      input.invoice_case_id,
      input.actor_id || null,
      input.actor_email || null,
      input.actor_role || null,
      input.action,
      input.before_state || null,
      input.after_state || null,
      input.event_data ? JSON.stringify(input.event_data) : null,
      input.notes || null,
      input.validation_result ? JSON.stringify(input.validation_result) : null,
      input.ip_address || null,
      input.user_agent || null,
      input.request_id || null,
    ]
  );
}

export async function getAuditEvents(
  caseId: string,
  limit: number = 100
): Promise<AuditEventInput[]> {
  const result = await pool.query(
    `SELECT * FROM invoice_audit_events
     WHERE invoice_case_id = $1
     ORDER BY event_timestamp DESC
     LIMIT $2`,
    [caseId, limit]
  );

  return result.rows;
}

// ==============================================================================
// Dashboard / Summary
// ==============================================================================

export async function getCasesByState(): Promise<{ state: WorkflowState; count: number; total_amount: number }[]> {
  const result = await pool.query(
    `SELECT workflow_state AS state, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_amount
     FROM invoice_cases
     GROUP BY workflow_state
     ORDER BY workflow_state`
  );

  return result.rows.map((row: { state: WorkflowState; count: string; total_amount: string }) => ({
    state: row.state,
    count: parseInt(row.count),
    total_amount: parseFloat(row.total_amount),
  }));
}

export async function getCaseSummary(caseId: string): Promise<{
  case: InvoiceCase;
  attachments: { type: string; count: number }[];
  auditCount: number;
  lastValidation: ValidationResult | null;
} | null> {
  const invoiceCase = await getInvoiceCase(caseId);
  if (!invoiceCase) return null;

  // Get attachment counts
  const attachmentsResult = await pool.query(
    `SELECT attachment_type AS type, COUNT(*) AS count
     FROM invoice_attachments
     WHERE invoice_case_id = $1
     GROUP BY attachment_type`,
    [caseId]
  );

  // Get audit event count
  const auditResult = await pool.query(
    `SELECT COUNT(*) FROM invoice_audit_events WHERE invoice_case_id = $1`,
    [caseId]
  );

  // Get latest validation
  const validationResult = await pool.query(
    `SELECT * FROM invoice_validation_results
     WHERE invoice_case_id = $1
     ORDER BY validated_at DESC
     LIMIT 1`,
    [caseId]
  );

  return {
    case: invoiceCase,
    attachments: attachmentsResult.rows.map((r: { type: string; count: string }) => ({ type: r.type, count: parseInt(r.count) })),
    auditCount: parseInt(auditResult.rows[0].count),
    lastValidation: validationResult.rows.length > 0 ? {
      caseId: validationResult.rows[0].invoice_case_id,
      targetState: validationResult.rows[0].target_state,
      canTransition: validationResult.rows[0].can_transition,
      blockingErrors: validationResult.rows[0].blocking_errors || [],
      warnings: validationResult.rows[0].warnings || [],
      passedChecks: [],
      validatedAt: validationResult.rows[0].validated_at,
      context: validationResult.rows[0].validation_context || {},
    } : null,
  };
}
