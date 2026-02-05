/**
 * Invoice Validation Engine Tests
 * Tests all validation rules from Railsync_Invoice_Processing_Complete_Spec.md
 */

import {
  validateInvoice,
  normalizeResponsibilityCode,
  isResponsibilityEquivalent,
  WorkflowState,
  ValidationResult,
} from '../services/invoice-validation.service';

// Mock the database pool
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../config/database';
const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

// ==============================================================================
// Test Helpers
// ==============================================================================

function createMockCaseData(overrides: Partial<{
  id: string;
  invoice_type: 'SHOP' | 'MRU';
  workflow_state: WorkflowState;
  lessee: string | null;
  special_lessee_approval_confirmed: boolean;
  total_amount: number | null;
  car_marks: string[] | null;
  fms_shopping_id: string | null;
  shop_code: string | null;
  invoice_date: Date | null;
}> = {}) {
  return {
    id: 'test-case-id',
    invoice_type: 'SHOP' as const,
    workflow_state: 'RECEIVED' as WorkflowState,
    lessee: null,
    special_lessee_approval_confirmed: false,
    total_amount: 1000,
    car_marks: ['UTLX123456'],
    fms_shopping_id: null,
    shop_code: 'SHOP001',
    invoice_date: new Date('2026-01-15'),
    ...overrides,
  };
}

function mockCaseQuery(caseData: ReturnType<typeof createMockCaseData>) {
  mockQuery.mockResolvedValueOnce({ rows: [caseData] } as never);
}

function mockStateTransition(allowed: boolean, requiredRole?: string) {
  mockQuery.mockResolvedValueOnce({
    rows: allowed ? [{ is_allowed: true, required_role: requiredRole, notes: '' }] : [],
  } as never);
}

function mockAttachments(attachments: { attachment_type: string; filename_original: string }[]) {
  mockQuery.mockResolvedValueOnce({ rows: attachments } as never);
}

function mockCarExists(carNumber: string, exists: boolean, priorStencil?: string) {
  if (exists) {
    mockQuery.mockResolvedValueOnce({ rows: [{ car_number: carNumber, prior_stencil: priorStencil }] } as never);
  } else {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
  }
}

function mockRemarkQuery(oldMark: string, newMark: string | null) {
  if (newMark) {
    mockQuery.mockResolvedValueOnce({ rows: [{ car_number: newMark }] } as never);
  } else {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
  }
}

function mockCutoffDates(entryCutoff: string, approvalCutoff: string, isLocked: boolean = false) {
  mockQuery.mockResolvedValueOnce({
    rows: [{
      entry_cutoff_date: entryCutoff,
      approval_cutoff_date: approvalCutoff,
      is_locked: isLocked,
    }],
  } as never);
}

function mockNoCutoffDates() {
  mockQuery.mockResolvedValueOnce({ rows: [] } as never);
}

function mockShoppingEvent(state: string) {
  mockQuery.mockResolvedValueOnce({ rows: [{ state }] } as never);
}

function mockNoShoppingEvent() {
  mockQuery.mockResolvedValueOnce({ rows: [] } as never);
}

function mockEstimate(totalCost: number | null) {
  if (totalCost !== null) {
    mockQuery.mockResolvedValueOnce({ rows: [{ total_cost: totalCost }] } as never);
  } else {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
  }
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Invoice Validation Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // File Validation Tests
  // ============================================================================
  describe('File Validation', () => {
    test('BLOCK when PDF is missing', async () => {
      const caseData = createMockCaseData();
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([{ attachment_type: 'TXT', filename_original: 'data.txt' }]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.canTransition).toBe(false);
      expect(result.blockingErrors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_PDF',
          decision: 'BLOCK',
          owningRole: 'admin',
        })
      );
    });

    test('BLOCK when TXT is missing', async () => {
      const caseData = createMockCaseData();
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([{ attachment_type: 'PDF', filename_original: 'invoice.pdf' }]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.canTransition).toBe(false);
      expect(result.blockingErrors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_TXT',
          decision: 'BLOCK',
          owningRole: 'admin',
        })
      );
    });

    test('PASS when both PDF and TXT are present', async () => {
      const caseData = createMockCaseData();
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.passedChecks).toContain('PDF_PRESENT');
      expect(result.passedChecks).toContain('TXT_PRESENT');
    });

    test('BRC files are ignored (not required)', async () => {
      const caseData = createMockCaseData();
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
        { attachment_type: 'BRC', filename_original: 'billing.brc' },
      ]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.passedChecks).toContain('BRC_IGNORED');
      expect(result.blockingErrors).not.toContainEqual(
        expect.objectContaining({ code: 'MISSING_BRC' })
      );
    });
  });

  // ============================================================================
  // Special Lessee Tests
  // ============================================================================
  describe('Special Lessee Validation', () => {
    const specialLessees = ['EXXON', 'IMPOIL', 'MARATHON'];

    test.each(specialLessees)(
      'BLOCK for special lessee %s without approval',
      async (lessee) => {
        const caseData = createMockCaseData({
          lessee,
          special_lessee_approval_confirmed: false,
        });
        mockCaseQuery(caseData);
        mockStateTransition(true);
        mockAttachments([
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ]);
        mockNoCutoffDates();
        mockCarExists('UTLX123456', true);

        const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

        expect(result.canTransition).toBe(false);
        expect(result.blockingErrors).toContainEqual(
          expect.objectContaining({
            code: 'SPECIAL_LESSEE_APPROVAL_REQUIRED',
            decision: 'BLOCK',
            owningRole: 'maintenance',
          })
        );
      }
    );

    test.each(specialLessees)(
      'PASS for special lessee %s with approval confirmed',
      async (lessee) => {
        const caseData = createMockCaseData({
          lessee,
          special_lessee_approval_confirmed: true,
        });
        mockCaseQuery(caseData);
        mockStateTransition(true);
        mockAttachments([
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ]);
        mockNoCutoffDates();
        mockCarExists('UTLX123456', true);

        const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

        expect(result.passedChecks).toContain('SPECIAL_LESSEE_APPROVED');
      }
    );

    test('Non-special lessees do not require approval', async () => {
      const caseData = createMockCaseData({
        lessee: 'REGULAR_CUSTOMER',
        special_lessee_approval_confirmed: false,
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

      expect(result.passedChecks).toContain('NOT_SPECIAL_LESSEE');
      expect(result.blockingErrors).not.toContainEqual(
        expect.objectContaining({ code: 'SPECIAL_LESSEE_APPROVAL_REQUIRED' })
      );
    });
  });

  // ============================================================================
  // SHOP Invoice Tests
  // ============================================================================
  describe('SHOP Invoice Validation', () => {
    test('BLOCK when shopping does not exist', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'SHOP',
        fms_shopping_id: null,
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

      expect(result.canTransition).toBe(false);
      expect(result.blockingErrors).toContainEqual(
        expect.objectContaining({
          code: 'SHOPPING_NOT_FOUND',
          decision: 'BLOCK',
        })
      );
    });

    test('BLOCK when Final Docs not approved', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'SHOP',
        fms_shopping_id: 'shopping-123',
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockShoppingEvent('ESTIMATE_SUBMITTED'); // Not yet approved
      mockEstimate(1000); // Estimate mismatch check still runs
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

      expect(result.canTransition).toBe(false);
      expect(result.blockingErrors).toContainEqual(
        expect.objectContaining({
          code: 'FINAL_DOCS_NOT_APPROVED',
          decision: 'BLOCK',
        })
      );
    });

    test('PASS when Final Docs are approved', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'SHOP',
        fms_shopping_id: 'shopping-123',
        total_amount: 1000,
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockShoppingEvent('RELEASED'); // Approved state
      mockEstimate(1000); // Exact match
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

      expect(result.passedChecks).toContain('FINAL_DOCS_APPROVED');
    });
  });

  // ============================================================================
  // Estimate Mismatch Tests
  // ============================================================================
  describe('Estimate Mismatch Validation', () => {
    test('PASS when Invoice < Estimate (under budget)', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'SHOP',
        fms_shopping_id: 'shopping-123',
        total_amount: 900, // Invoice is less than estimate
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockShoppingEvent('RELEASED');
      mockEstimate(1000); // Estimate is higher
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

      expect(result.passedChecks).toContain('ESTIMATE_VARIANCE_OK_UNDER');
    });

    test('WARN when Invoice > Estimate but within $100 tolerance', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'SHOP',
        fms_shopping_id: 'shopping-123',
        total_amount: 1050, // $50 over estimate
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockShoppingEvent('RELEASED');
      mockEstimate(1000);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

      expect(result.passedChecks).toContain('ESTIMATE_VARIANCE_OK_WITHIN_TOLERANCE');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'ESTIMATE_VARIANCE_MINOR',
          decision: 'WARN',
        })
      );
    });

    test('BLOCK when Invoice > Estimate by more than $100', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'SHOP',
        fms_shopping_id: 'shopping-123',
        total_amount: 1200, // $200 over estimate
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockShoppingEvent('RELEASED');
      mockEstimate(1000);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

      expect(result.canTransition).toBe(false);
      expect(result.blockingErrors).toContainEqual(
        expect.objectContaining({
          code: 'ESTIMATE_VARIANCE_EXCEEDED',
          decision: 'BLOCK',
          owningRole: 'maintenance',
        })
      );
    });
  });

  // ============================================================================
  // MRU Invoice Tests
  // ============================================================================
  describe('MRU Invoice Validation', () => {
    test('Multi-car allowed for MRU', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'MRU',
        car_marks: ['CAR001', 'CAR002', 'CAR003'],
        total_amount: 1000,
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('CAR001', true);
      mockCarExists('CAR002', true);
      mockCarExists('CAR003', true);

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.passedChecks).toContain('MRU_MULTI_CAR_ALLOWED');
      expect(result.context).toHaveProperty('carCount', 3);
    });

    test('Auto-approve eligible when MRU <= $1500', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'MRU',
        total_amount: 1500,
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.passedChecks).toContain('MRU_AUTO_APPROVE_ELIGIBLE');
      expect(result.context).toHaveProperty('autoApproveEligible', true);
    });

    test('WARN when MRU > $1500 requires Maintenance review', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'MRU',
        total_amount: 2000,
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'MRU_MAINTENANCE_REVIEW_REQUIRED',
          decision: 'WARN',
          owningRole: 'maintenance',
        })
      );
      expect(result.context).toHaveProperty('autoApproveEligible', false);
    });

    test('MRU with FMS shopping treated as SHOP', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'MRU',
        fms_shopping_id: 'shopping-123',
        total_amount: 1000,
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'MRU_HAS_FMS_SHOPPING',
          decision: 'WARN',
        })
      );
      expect(result.context).toHaveProperty('treatAsShop', true);
    });
  });

  // ============================================================================
  // Month-End Cutoff Tests
  // ============================================================================
  describe('Month-End Cutoff Validation', () => {
    test('BLOCK when past entry cutoff date', async () => {
      const caseData = createMockCaseData({
        invoice_date: new Date('2026-01-15'),
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      // Set entry cutoff to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      mockCutoffDates(yesterday.toISOString().split('T')[0], '2026-02-15');
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

      expect(result.canTransition).toBe(false);
      expect(result.blockingErrors).toContainEqual(
        expect.objectContaining({
          code: 'PAST_ENTRY_CUTOFF',
          decision: 'BLOCK',
        })
      );
    });

    test('BLOCK when past approval cutoff date', async () => {
      const caseData = createMockCaseData({
        invoice_date: new Date('2026-01-15'),
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      // Set approval cutoff to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      mockCutoffDates('2026-02-28', yesterday.toISOString().split('T')[0]);
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'APPROVER_REVIEW');

      expect(result.canTransition).toBe(false);
      expect(result.blockingErrors).toContainEqual(
        expect.objectContaining({
          code: 'PAST_APPROVAL_CUTOFF',
          decision: 'BLOCK',
        })
      );
    });

    test('PASS when within cutoff dates', async () => {
      const caseData = createMockCaseData({
        invoice_date: new Date('2026-01-15'),
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      // Set cutoffs in the future
      const future = new Date();
      future.setMonth(future.getMonth() + 1);
      mockCutoffDates(future.toISOString().split('T')[0], future.toISOString().split('T')[0]);
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

      expect(result.passedChecks).toContain('WITHIN_ENTRY_CUTOFF');
    });
  });

  // ============================================================================
  // Car Remarking Tests
  // ============================================================================
  describe('Car Remarking Validation', () => {
    test('BLOCK when car not found in system', async () => {
      const caseData = createMockCaseData({
        car_marks: ['UNKNOWN123'],
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('UNKNOWN123', false);
      mockRemarkQuery('UNKNOWN123', null); // Not a remark either

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.canTransition).toBe(false);
      expect(result.blockingErrors).toContainEqual(
        expect.objectContaining({
          code: 'CAR_NOT_FOUND',
          decision: 'BLOCK',
          owningRole: 'admin',
        })
      );
    });

    test('WARN when car has been remarked', async () => {
      const caseData = createMockCaseData({
        car_marks: ['OLDMARK123'],
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('OLDMARK123', false);
      mockRemarkQuery('OLDMARK123', 'NEWMARK456'); // Found as remarked

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'CAR_REMARKED',
          decision: 'WARN',
        })
      );
    });

    test('PASS when car exists in system', async () => {
      const caseData = createMockCaseData({
        car_marks: ['UTLX123456'],
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.passedChecks).toContain('CAR_VALID_UTLX123456');
    });
  });

  // ============================================================================
  // State Transition Tests
  // ============================================================================
  describe('State Transition Validation', () => {
    test('BLOCK for invalid state transition', async () => {
      const caseData = createMockCaseData({
        workflow_state: 'RECEIVED',
      });
      mockCaseQuery(caseData);
      mockStateTransition(false); // Not allowed

      // Try to skip to APPROVED (not a valid transition from RECEIVED)
      const result = await validateInvoice('test-case-id', 'APPROVED');

      expect(result.canTransition).toBe(false);
      expect(result.blockingErrors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_TRANSITION',
          decision: 'BLOCK',
          owningRole: 'system',
        })
      );
    });

    test('PASS for valid state transition', async () => {
      const caseData = createMockCaseData({
        workflow_state: 'RECEIVED',
      });
      mockCaseQuery(caseData);
      mockStateTransition(true);
      mockAttachments([
        { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
        { attachment_type: 'TXT', filename_original: 'data.txt' },
      ]);
      mockNoCutoffDates();
      mockCarExists('UTLX123456', true);

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.passedChecks).toContain('STATE_TRANSITION_VALID');
    });
  });

  // ============================================================================
  // Responsibility Code Normalization Tests
  // ============================================================================
  describe('Responsibility Code Normalization', () => {
    test.each([
      ['7', '1'],
      ['4', '1'],
      ['0', '1'],
      ['W', '1'],
    ])('Code %s normalizes to Lessor (1)', (input, expected) => {
      expect(normalizeResponsibilityCode(input)).toBe(expected);
    });

    test.each([
      ['8', '9'],
      ['9', '9'],
    ])('Code %s normalizes to %s', (input, expected) => {
      expect(normalizeResponsibilityCode(input)).toBe(expected);
    });

    test('Unknown codes remain unchanged', () => {
      expect(normalizeResponsibilityCode('5')).toBe('5');
      expect(normalizeResponsibilityCode('X')).toBe('X');
    });

    test('Equivalent codes match correctly', () => {
      expect(isResponsibilityEquivalent('7', '4')).toBe(true); // Both normalize to 1
      expect(isResponsibilityEquivalent('8', '9')).toBe(true); // Both normalize to 9
      expect(isResponsibilityEquivalent('7', '8')).toBe(false); // 1 vs 9
    });
  });

  // ============================================================================
  // Case Not Found Test
  // ============================================================================
  describe('Case Not Found', () => {
    test('BLOCK when case does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never); // No case found

      const result = await validateInvoice('nonexistent-id', 'ASSIGNED');

      expect(result.canTransition).toBe(false);
      expect(result.blockingErrors).toContainEqual(
        expect.objectContaining({
          code: 'CASE_NOT_FOUND',
          decision: 'BLOCK',
        })
      );
    });
  });
});
