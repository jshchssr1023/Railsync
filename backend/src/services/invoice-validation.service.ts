/**
 * Invoice Validation Engine Service
 * Implements the validation rules from Railsync_Invoice_Processing_Complete_Spec.md
 *
 * Key principle: Railsync is authoritative, not advisory.
 * No BLOCK may be overridden.
 */

import { pool } from '../config/database';

// ==============================================================================
// Types
// ==============================================================================

export type InvoiceType = 'SHOP' | 'MRU';

export type WorkflowState =
  | 'RECEIVED'
  | 'ASSIGNED'
  | 'WAITING_ON_SHOPPING'
  | 'WAITING_ON_CUSTOMER_APPROVAL'
  | 'READY_FOR_IMPORT'
  | 'IMPORTED'
  | 'ADMIN_REVIEW'
  | 'SUBMITTED'
  | 'APPROVER_REVIEW'
  | 'APPROVED'
  | 'BILLING_REVIEW'
  | 'BILLING_APPROVED'
  | 'SAP_STAGED'
  | 'SAP_POSTED'
  | 'PAID'
  | 'CLOSED'
  | 'BLOCKED';

export type ValidationDecision = 'BLOCK' | 'WARN' | 'PASS';

export interface ValidationError {
  code: string;
  message: string;
  decision: ValidationDecision;
  owningRole: 'admin' | 'maintenance' | 'billing' | 'approver' | 'system';
  fixPath?: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  caseId: string;
  targetState: WorkflowState;
  canTransition: boolean;
  blockingErrors: ValidationError[];
  warnings: ValidationError[];
  passedChecks: string[];
  validatedAt: Date;
  context: Record<string, unknown>;
}

export interface InvoiceCaseData {
  id: string;
  invoice_type: InvoiceType;
  workflow_state: WorkflowState;
  lessee?: string;
  special_lessee_approval_confirmed: boolean;
  total_amount?: number;
  car_marks?: string[];
  fms_shopping_id?: string;
  shop_code?: string;
  invoice_date?: Date;
}

export interface AttachmentData {
  attachment_type: 'PDF' | 'TXT' | 'SUPPORT' | 'BRC';
  filename_original: string;
}

// ==============================================================================
// Constants
// ==============================================================================

// Loaded from special_lessees table on first use
let _specialLesseeCache: string[] | null = null;

async function getSpecialLessees(): Promise<string[]> {
  if (_specialLesseeCache) return _specialLesseeCache;
  try {
    const result = await pool.query(`SELECT lessee_name FROM special_lessees WHERE is_active = TRUE`);
    _specialLesseeCache = result.rows.map((r: any) => r.lessee_name.toUpperCase());
  } catch {
    // Fallback if table doesn't exist yet
    _specialLesseeCache = ['EXXON', 'IMPOIL', 'MARATHON'];
  }
  return _specialLesseeCache;
}

const MRU_AUTO_APPROVE_THRESHOLD = 1500;

const ESTIMATE_VARIANCE_TOLERANCE = 100; // $100 for invoice > estimate

const RESPONSIBILITY_NORMALIZATION: Record<string, string> = {
  '7': '1',
  '4': '1',
  '0': '1',
  'W': '1',
  '8': '9',
  '9': '9',
};

// ==============================================================================
// Main Validation Function
// ==============================================================================

export async function validateInvoice(
  caseId: string,
  targetState: WorkflowState
): Promise<ValidationResult> {
  const blockingErrors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const passedChecks: string[] = [];
  const context: Record<string, unknown> = {};

  // Fetch case data
  const caseData = await getInvoiceCaseData(caseId);
  if (!caseData) {
    blockingErrors.push({
      code: 'CASE_NOT_FOUND',
      message: 'Invoice case not found',
      decision: 'BLOCK',
      owningRole: 'system',
    });
    return buildResult(caseId, targetState, blockingErrors, warnings, passedChecks, context);
  }

  context.invoiceType = caseData.invoice_type;
  context.currentState = caseData.workflow_state;

  // 1. Validate state transition is allowed
  const transitionValid = await validateStateTransition(
    caseData.workflow_state,
    targetState,
    blockingErrors,
    passedChecks
  );
  if (!transitionValid) {
    return buildResult(caseId, targetState, blockingErrors, warnings, passedChecks, context);
  }

  // 2. File validation (PDF + TXT required)
  await validateFiles(caseId, blockingErrors, warnings, passedChecks);

  // 3. Special lessee validation
  await validateSpecialLessee(caseData, targetState, blockingErrors, warnings, passedChecks);

  // 4. Invoice type-specific validation
  if (caseData.invoice_type === 'SHOP') {
    await validateShopInvoice(caseData, targetState, blockingErrors, warnings, passedChecks, context);
  } else if (caseData.invoice_type === 'MRU') {
    await validateMRUInvoice(caseData, targetState, blockingErrors, warnings, passedChecks, context);
  }

  // 5. Month-end cutoff validation
  await validateMonthEndCutoff(caseData, targetState, blockingErrors, warnings, passedChecks);

  // 6. Car remarking validation
  await validateCarRemarks(caseData, blockingErrors, warnings, passedChecks);

  return buildResult(caseId, targetState, blockingErrors, warnings, passedChecks, context);
}

// ==============================================================================
// Validation Sub-Functions
// ==============================================================================

async function validateStateTransition(
  currentState: WorkflowState,
  targetState: WorkflowState,
  errors: ValidationError[],
  passed: string[]
): Promise<boolean> {
  const result = await pool.query(
    `SELECT is_allowed, required_role, notes
     FROM invoice_state_transitions
     WHERE from_state = $1 AND to_state = $2`,
    [currentState, targetState]
  );

  if (result.rows.length === 0) {
    errors.push({
      code: 'INVALID_TRANSITION',
      message: `State transition from ${currentState} to ${targetState} is not defined`,
      decision: 'BLOCK',
      owningRole: 'system',
    });
    return false;
  }

  const transition = result.rows[0];
  if (!transition.is_allowed) {
    errors.push({
      code: 'TRANSITION_NOT_ALLOWED',
      message: `State transition from ${currentState} to ${targetState} is not allowed: ${transition.notes}`,
      decision: 'BLOCK',
      owningRole: 'system',
    });
    return false;
  }

  passed.push('STATE_TRANSITION_VALID');
  return true;
}

async function validateFiles(
  caseId: string,
  errors: ValidationError[],
  warnings: ValidationError[],
  passed: string[]
): Promise<void> {
  const result = await pool.query(
    `SELECT attachment_type, filename_original
     FROM invoice_attachments
     WHERE invoice_case_id = $1`,
    [caseId]
  );

  const attachments = result.rows as AttachmentData[];
  const hasPDF = attachments.some((a) => a.attachment_type === 'PDF');
  const hasTXT = attachments.some((a) => a.attachment_type === 'TXT');
  const hasBRC = attachments.some((a) => a.attachment_type === 'BRC');

  // PDF required - BLOCK if missing
  if (!hasPDF) {
    errors.push({
      code: 'MISSING_PDF',
      message: 'PDF invoice file is required',
      decision: 'BLOCK',
      owningRole: 'admin',
      fixPath: 'Upload PDF invoice file',
    });
  } else {
    passed.push('PDF_PRESENT');
  }

  // TXT required - BLOCK if missing
  if (!hasTXT) {
    errors.push({
      code: 'MISSING_TXT',
      message: 'TXT data file is required',
      decision: 'BLOCK',
      owningRole: 'admin',
      fixPath: 'Upload TXT data file',
    });
  } else {
    passed.push('TXT_PRESENT');
  }

  // BRC files are ignored per spec (just note it)
  if (hasBRC) {
    passed.push('BRC_IGNORED');
  }
}

async function validateSpecialLessee(
  caseData: InvoiceCaseData,
  targetState: WorkflowState,
  errors: ValidationError[],
  warnings: ValidationError[],
  passed: string[]
): Promise<void> {
  if (!caseData.lessee) {
    passed.push('NO_LESSEE_CHECK');
    return;
  }

  const specialLessees = await getSpecialLessees();
  const isSpecialLessee = specialLessees.includes(caseData.lessee.toUpperCase());

  if (!isSpecialLessee) {
    passed.push('NOT_SPECIAL_LESSEE');
    return;
  }

  // Special lessee check only matters for states beyond WAITING_ON_CUSTOMER_APPROVAL
  const statesRequiringApproval: WorkflowState[] = [
    'READY_FOR_IMPORT',
    'IMPORTED',
    'ADMIN_REVIEW',
    'SUBMITTED',
    'APPROVER_REVIEW',
    'APPROVED',
    'BILLING_REVIEW',
    'BILLING_APPROVED',
    'SAP_STAGED',
    'SAP_POSTED',
  ];

  if (!statesRequiringApproval.includes(targetState)) {
    passed.push('SPECIAL_LESSEE_CHECK_NOT_REQUIRED');
    return;
  }

  if (!caseData.special_lessee_approval_confirmed) {
    errors.push({
      code: 'SPECIAL_LESSEE_APPROVAL_REQUIRED',
      message: `Invoice for special lessee (${caseData.lessee}) requires Maintenance confirmation before processing`,
      decision: 'BLOCK',
      owningRole: 'maintenance',
      fixPath: 'Obtain Maintenance Manager approval for special lessee invoice',
      details: { lessee: caseData.lessee },
    });
  } else {
    passed.push('SPECIAL_LESSEE_APPROVED');
  }
}

async function validateShopInvoice(
  caseData: InvoiceCaseData,
  targetState: WorkflowState,
  errors: ValidationError[],
  warnings: ValidationError[],
  passed: string[],
  context: Record<string, unknown>
): Promise<void> {
  // SHOP invoice requires shopping to exist
  if (!caseData.fms_shopping_id) {
    // Check if we're trying to progress beyond WAITING_ON_SHOPPING
    const statesRequiringShopping: WorkflowState[] = [
      'READY_FOR_IMPORT',
      'IMPORTED',
      'ADMIN_REVIEW',
      'SUBMITTED',
    ];

    if (statesRequiringShopping.includes(targetState)) {
      errors.push({
        code: 'SHOPPING_NOT_FOUND',
        message: 'SHOP invoice requires a valid shopping record in FMS',
        decision: 'BLOCK',
        owningRole: 'admin',
        fixPath: 'Create shopping record in FMS and link to this invoice',
      });
    }
  } else {
    passed.push('SHOPPING_EXISTS');

    // Validate Final Docs approved
    const finalDocsApproved = await checkFinalDocsApproved(caseData.fms_shopping_id);
    context.finalDocsApproved = finalDocsApproved;

    if (!finalDocsApproved) {
      errors.push({
        code: 'FINAL_DOCS_NOT_APPROVED',
        message: 'Final Docs must be approved before invoice can proceed',
        decision: 'BLOCK',
        owningRole: 'admin',
        fixPath: 'Approve Final Docs in FMS',
      });
    } else {
      passed.push('FINAL_DOCS_APPROVED');
    }

    // Validate estimate mismatch
    await validateEstimateMismatch(caseData, errors, warnings, passed, context);
  }
}

async function validateEstimateMismatch(
  caseData: InvoiceCaseData,
  errors: ValidationError[],
  warnings: ValidationError[],
  passed: string[],
  context: Record<string, unknown>
): Promise<void> {
  if (!caseData.fms_shopping_id || !caseData.total_amount) {
    return;
  }

  // Get estimate total from shopping
  const estimateTotal = await getEstimateTotal(caseData.fms_shopping_id);
  context.estimateTotal = estimateTotal;
  context.invoiceTotal = caseData.total_amount;

  if (estimateTotal === null) {
    warnings.push({
      code: 'NO_ESTIMATE_FOUND',
      message: 'No estimate found for comparison',
      decision: 'WARN',
      owningRole: 'admin',
    });
    return;
  }

  const variance = caseData.total_amount - estimateTotal;
  context.variance = variance;

  // Allowed mismatch per spec:
  // - Invoice < Estimate: OK (CB unchanged)
  // - Invoice > Estimate ≤ $100: OK (CB unchanged)
  // - Invoice > Estimate > $100: BLOCK

  if (variance <= 0) {
    // Invoice ≤ Estimate - OK
    passed.push('ESTIMATE_VARIANCE_OK_UNDER');
  } else if (variance <= ESTIMATE_VARIANCE_TOLERANCE) {
    // Invoice > Estimate but within tolerance
    passed.push('ESTIMATE_VARIANCE_OK_WITHIN_TOLERANCE');
    warnings.push({
      code: 'ESTIMATE_VARIANCE_MINOR',
      message: `Invoice exceeds estimate by $${variance.toFixed(2)} (within $${ESTIMATE_VARIANCE_TOLERANCE} tolerance)`,
      decision: 'WARN',
      owningRole: 'admin',
      details: { variance, tolerance: ESTIMATE_VARIANCE_TOLERANCE },
    });
  } else {
    // Invoice > Estimate > $100 - BLOCK
    errors.push({
      code: 'ESTIMATE_VARIANCE_EXCEEDED',
      message: `Invoice exceeds estimate by $${variance.toFixed(2)} (exceeds $${ESTIMATE_VARIANCE_TOLERANCE} tolerance)`,
      decision: 'BLOCK',
      owningRole: 'maintenance',
      fixPath: 'Review estimate variance with Maintenance Manager',
      details: { variance, tolerance: ESTIMATE_VARIANCE_TOLERANCE, estimateTotal, invoiceTotal: caseData.total_amount },
    });
  }
}

async function validateMRUInvoice(
  caseData: InvoiceCaseData,
  targetState: WorkflowState,
  errors: ValidationError[],
  warnings: ValidationError[],
  passed: string[],
  context: Record<string, unknown>
): Promise<void> {
  // MRU specific rules

  // Multi-car is allowed for MRU
  if (caseData.car_marks && caseData.car_marks.length > 1) {
    passed.push('MRU_MULTI_CAR_ALLOWED');
    context.carCount = caseData.car_marks.length;
  }

  // Parent location check: MRU invoices need a valid shop with parent location
  if (caseData.shop_code) {
    try {
      const shopResult = await pool.query(
        'SELECT parent_company, city FROM shops WHERE shop_code = $1',
        [caseData.shop_code]
      );
      if (shopResult.rows.length > 0) {
        passed.push('MRU_SHOP_LOCATION_VERIFIED');
        context.shopCity = shopResult.rows[0].city;
      } else {
        warnings.push({
          code: 'MRU_SHOP_NOT_FOUND',
          message: `Shop ${caseData.shop_code} not found in shop registry`,
          decision: 'WARN',
          owningRole: 'admin',
          details: { shop_code: caseData.shop_code },
        });
      }
    } catch {
      // Non-blocking — location check is advisory
    }
  } else {
    warnings.push({
      code: 'MRU_NO_SHOP_LOCATION',
      message: 'No shop code provided for MRU invoice — parent location cannot be verified',
      decision: 'WARN',
      owningRole: 'admin',
      details: {},
    });
  }

  // Amount threshold rules
  if (caseData.total_amount !== undefined) {
    if (caseData.total_amount <= MRU_AUTO_APPROVE_THRESHOLD) {
      // ≤ $1500 → auto RSPD = 1
      passed.push('MRU_AUTO_APPROVE_ELIGIBLE');
      context.autoApproveEligible = true;
    } else {
      // > $1500 → Maintenance review required
      warnings.push({
        code: 'MRU_MAINTENANCE_REVIEW_REQUIRED',
        message: `MRU invoice of $${caseData.total_amount.toFixed(2)} exceeds $${MRU_AUTO_APPROVE_THRESHOLD} threshold - Maintenance review required`,
        decision: 'WARN',
        owningRole: 'maintenance',
        details: { amount: caseData.total_amount, threshold: MRU_AUTO_APPROVE_THRESHOLD },
      });
      context.autoApproveEligible = false;
    }
  }

  // Check for FMS shopping - if exists, treat as SHOP
  if (caseData.fms_shopping_id) {
    warnings.push({
      code: 'MRU_HAS_FMS_SHOPPING',
      message: 'MRU invoice has FMS shopping record - will be treated as SHOP invoice',
      decision: 'WARN',
      owningRole: 'admin',
    });
    context.treatAsShop = true;
  }
}

async function validateMonthEndCutoff(
  caseData: InvoiceCaseData,
  targetState: WorkflowState,
  errors: ValidationError[],
  warnings: ValidationError[],
  passed: string[]
): Promise<void> {
  if (!caseData.invoice_date) {
    passed.push('NO_INVOICE_DATE_FOR_CUTOFF');
    return;
  }

  const invoiceDate = new Date(caseData.invoice_date);
  const fiscalYear = invoiceDate.getFullYear();
  const fiscalMonth = invoiceDate.getMonth() + 1;

  const result = await pool.query(
    `SELECT entry_cutoff_date, approval_cutoff_date, is_locked
     FROM invoice_cutoff_dates
     WHERE fiscal_year = $1 AND fiscal_month = $2`,
    [fiscalYear, fiscalMonth]
  );

  if (result.rows.length === 0) {
    passed.push('NO_CUTOFF_DEFINED');
    return;
  }

  const cutoff = result.rows[0];
  const today = new Date();

  // Entry cutoff check (for states up to SUBMITTED)
  const entryStates: WorkflowState[] = ['READY_FOR_IMPORT', 'IMPORTED', 'ADMIN_REVIEW', 'SUBMITTED'];
  if (entryStates.includes(targetState)) {
    if (today > new Date(cutoff.entry_cutoff_date)) {
      errors.push({
        code: 'PAST_ENTRY_CUTOFF',
        message: `Past entry cutoff date (${cutoff.entry_cutoff_date}) for fiscal period ${fiscalYear}-${fiscalMonth}`,
        decision: 'BLOCK',
        owningRole: 'admin',
        fixPath: 'Contact Finance to request cutoff extension',
      });
      return;
    }
    passed.push('WITHIN_ENTRY_CUTOFF');
  }

  // Approval cutoff check (for states beyond SUBMITTED)
  const approvalStates: WorkflowState[] = ['APPROVER_REVIEW', 'APPROVED', 'BILLING_REVIEW', 'BILLING_APPROVED'];
  if (approvalStates.includes(targetState)) {
    if (today > new Date(cutoff.approval_cutoff_date)) {
      errors.push({
        code: 'PAST_APPROVAL_CUTOFF',
        message: `Past approval cutoff date (${cutoff.approval_cutoff_date}) for fiscal period ${fiscalYear}-${fiscalMonth}`,
        decision: 'BLOCK',
        owningRole: 'approver',
        fixPath: 'Contact Finance to request cutoff extension',
      });
      return;
    }
    passed.push('WITHIN_APPROVAL_CUTOFF');
  }
}

async function validateCarRemarks(
  caseData: InvoiceCaseData,
  errors: ValidationError[],
  warnings: ValidationError[],
  passed: string[]
): Promise<void> {
  if (!caseData.car_marks || caseData.car_marks.length === 0) {
    passed.push('NO_CAR_MARKS_TO_VALIDATE');
    return;
  }

  // Check each car exists in system
  for (const carMark of caseData.car_marks) {
    const result = await pool.query(
      `SELECT car_number, prior_stencil FROM cars WHERE car_number = $1`,
      [carMark]
    );

    if (result.rows.length === 0) {
      // Car not found - check if it's a remarked car
      const remarkResult = await pool.query(
        `SELECT car_number FROM cars WHERE prior_stencil = $1`,
        [carMark]
      );

      if (remarkResult.rows.length > 0) {
        warnings.push({
          code: 'CAR_REMARKED',
          message: `Car ${carMark} has been remarked to ${remarkResult.rows[0].car_number}`,
          decision: 'WARN',
          owningRole: 'admin',
          details: { oldMark: carMark, newMark: remarkResult.rows[0].car_number },
        });
      } else {
        errors.push({
          code: 'CAR_NOT_FOUND',
          message: `Car ${carMark} not found in system`,
          decision: 'BLOCK',
          owningRole: 'admin',
          fixPath: 'Resolve car stencil before processing invoice',
          details: { carMark },
        });
      }
    } else {
      passed.push(`CAR_VALID_${carMark}`);
    }
  }
}

// ==============================================================================
// Helper Functions
// ==============================================================================

async function getInvoiceCaseData(caseId: string): Promise<InvoiceCaseData | null> {
  const result = await pool.query(
    `SELECT
       id,
       invoice_type,
       workflow_state,
       lessee,
       special_lessee_approval_confirmed,
       total_amount,
       car_marks,
       fms_shopping_id,
       shop_code,
       invoice_date
     FROM invoice_cases
     WHERE id = $1`,
    [caseId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as InvoiceCaseData;
}

async function checkFinalDocsApproved(shoppingId: string): Promise<boolean> {
  // Check shopping_events table for Final Docs approval
  const result = await pool.query(
    `SELECT state FROM shopping_events WHERE id = $1::uuid OR event_number = $1`,
    [shoppingId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  // Final docs considered approved if state is past ESTIMATE_APPROVED
  const approvedStates = [
    'WORK_AUTHORIZED',
    'IN_REPAIR',
    'QA_COMPLETE',
    'FINAL_ESTIMATE_SUBMITTED',
    'FINAL_ESTIMATE_APPROVED',
    'READY_FOR_RELEASE',
    'RELEASED',
  ];

  return approvedStates.includes(result.rows[0].state);
}

async function getEstimateTotal(shoppingId: string): Promise<number | null> {
  // Get latest approved estimate total for this shopping event
  const result = await pool.query(
    `SELECT es.total_cost
     FROM estimate_submissions es
     JOIN shopping_events se ON es.shopping_event_id = se.id
     WHERE (se.id = $1::uuid OR se.event_number = $1)
       AND es.status = 'approved'
     ORDER BY es.version_number DESC
     LIMIT 1`,
    [shoppingId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return parseFloat(result.rows[0].total_cost);
}

function buildResult(
  caseId: string,
  targetState: WorkflowState,
  blockingErrors: ValidationError[],
  warnings: ValidationError[],
  passedChecks: string[],
  context: Record<string, unknown>
): ValidationResult {
  return {
    caseId,
    targetState,
    canTransition: blockingErrors.length === 0,
    blockingErrors,
    warnings,
    passedChecks,
    validatedAt: new Date(),
    context,
  };
}

// ==============================================================================
// Responsibility Code Normalization
// ==============================================================================

export function normalizeResponsibilityCode(code: string): string {
  return RESPONSIBILITY_NORMALIZATION[code] || code;
}

export function isResponsibilityEquivalent(code1: string, code2: string): boolean {
  return normalizeResponsibilityCode(code1) === normalizeResponsibilityCode(code2);
}

// ==============================================================================
// Persist Validation Result
// ==============================================================================

export async function saveValidationResult(result: ValidationResult, userId?: string): Promise<void> {
  await pool.query(
    `INSERT INTO invoice_validation_results
       (invoice_case_id, validated_at, validated_by, target_state, can_transition, blocking_errors, warnings, validation_context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      result.caseId,
      result.validatedAt,
      userId || null,
      result.targetState,
      result.canTransition,
      JSON.stringify(result.blockingErrors),
      JSON.stringify(result.warnings),
      JSON.stringify(result.context),
    ]
  );
}
