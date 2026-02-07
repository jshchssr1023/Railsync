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
// Test Helpers — SQL-routing mock approach
// ==============================================================================
//
// pool.query is used for ALL database queries in the validation service.
// Rather than using a fragile mockResolvedValueOnce FIFO chain (which breaks
// when internal queries like getSpecialLessees fire in unexpected positions),
// we use a routing implementation that matches queries by SQL content.
// ==============================================================================

interface MockConfig {
  caseData?: ReturnType<typeof createMockCaseData> | null;
  stateTransition?: { allowed: boolean; requiredRole?: string } | null;
  attachments?: { attachment_type: string; filename_original: string }[];
  specialLessees?: { lessee_name: string }[];
  shoppingState?: string | null;
  estimateTotal?: number | null;
  cutoffDates?: { entry_cutoff_date: string; approval_cutoff_date: string; is_locked?: boolean } | null;
  cars?: Record<string, { exists: boolean; priorStencil?: string; remarkTo?: string | null }>;
  shopLocation?: { parent_company: string; city: string } | null;
}

function setupQueryRouter(config: MockConfig) {
  mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
    const s = typeof sql === 'string' ? sql : '';

    // 1. Case data query
    if (s.includes('FROM invoice_cases')) {
      if (config.caseData) {
        return { rows: [config.caseData] } as never;
      }
      return { rows: [] } as never;
    }

    // 2. State transition query
    if (s.includes('invoice_state_transitions')) {
      if (config.stateTransition === null || config.stateTransition === undefined) {
        return { rows: [] } as never;
      }
      if (config.stateTransition.allowed) {
        return {
          rows: [{ is_allowed: true, required_role: config.stateTransition.requiredRole, notes: '' }],
        } as never;
      }
      return { rows: [] } as never;
    }

    // 3. Attachments query
    if (s.includes('invoice_attachments')) {
      return { rows: config.attachments || [] } as never;
    }

    // 4. Special lessees query (fired by getSpecialLessees cache miss)
    if (s.includes('special_lessees')) {
      return {
        rows: config.specialLessees ?? [
          { lessee_name: 'EXXON' },
          { lessee_name: 'IMPOIL' },
          { lessee_name: 'MARATHON' },
        ],
      } as never;
    }

    // 5. Estimate total query (check BEFORE shopping_events since estimate SQL joins shopping_events)
    if (s.includes('estimate_submissions')) {
      if (config.estimateTotal !== undefined && config.estimateTotal !== null) {
        return { rows: [{ total_cost: config.estimateTotal }] } as never;
      }
      return { rows: [] } as never;
    }

    // 6. Shopping event state query
    if (s.includes('shopping_events')) {
      if (config.shoppingState !== undefined && config.shoppingState !== null) {
        return { rows: [{ state: config.shoppingState }] } as never;
      }
      return { rows: [] } as never;
    }

    // 7. Shop location query (MRU validation)
    if (s.includes('FROM shops WHERE shop_code')) {
      if (config.shopLocation) {
        return { rows: [config.shopLocation] } as never;
      }
      return { rows: [] } as never;
    }

    // 8. Cutoff dates query
    if (s.includes('invoice_cutoff_dates')) {
      if (config.cutoffDates) {
        return { rows: [config.cutoffDates] } as never;
      }
      return { rows: [] } as never;
    }

    // 9. Car lookup (by car_number)
    if (s.includes('FROM cars WHERE car_number')) {
      const carMark = params?.[0];
      const carConfig = config.cars?.[carMark];
      if (carConfig?.exists) {
        return { rows: [{ car_number: carMark, prior_stencil: carConfig.priorStencil }] } as never;
      }
      return { rows: [] } as never;
    }

    // 10. Car remark lookup (by prior_stencil)
    if (s.includes('FROM cars WHERE prior_stencil')) {
      const oldMark = params?.[0];
      const carConfig = config.cars?.[oldMark];
      if (carConfig?.remarkTo) {
        return { rows: [{ car_number: carConfig.remarkTo }] } as never;
      }
      return { rows: [] } as never;
    }

    // Default fallback
    return { rows: [] } as never;
  });
}

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [{ attachment_type: 'TXT', filename_original: 'data.txt' }],
        cars: { 'UTLX123456': { exists: true } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [{ attachment_type: 'PDF', filename_original: 'invoice.pdf' }],
        cars: { 'UTLX123456': { exists: true } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        cars: { 'UTLX123456': { exists: true } },
      });

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.passedChecks).toContain('PDF_PRESENT');
      expect(result.passedChecks).toContain('TXT_PRESENT');
    });

    test('BRC files are ignored (not required)', async () => {
      const caseData = createMockCaseData();
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
          { attachment_type: 'BRC', filename_original: 'billing.brc' },
        ],
        cars: { 'UTLX123456': { exists: true } },
      });

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
        setupQueryRouter({
          caseData,
          stateTransition: { allowed: true },
          attachments: [
            { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
            { attachment_type: 'TXT', filename_original: 'data.txt' },
          ],
          cars: { 'UTLX123456': { exists: true } },
        });

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
        setupQueryRouter({
          caseData,
          stateTransition: { allowed: true },
          attachments: [
            { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
            { attachment_type: 'TXT', filename_original: 'data.txt' },
          ],
          cars: { 'UTLX123456': { exists: true } },
        });

        const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

        expect(result.passedChecks).toContain('SPECIAL_LESSEE_APPROVED');
      }
    );

    test('Non-special lessees do not require approval', async () => {
      const caseData = createMockCaseData({
        lessee: 'REGULAR_CUSTOMER',
        special_lessee_approval_confirmed: false,
      });
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        cars: { 'UTLX123456': { exists: true } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        cars: { 'UTLX123456': { exists: true } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        shoppingState: 'ESTIMATE_SUBMITTED',
        estimateTotal: 1000,
        cars: { 'UTLX123456': { exists: true } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        shoppingState: 'RELEASED',
        estimateTotal: 1000,
        cars: { 'UTLX123456': { exists: true } },
      });

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
        total_amount: 900,
      });
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        shoppingState: 'RELEASED',
        estimateTotal: 1000,
        cars: { 'UTLX123456': { exists: true } },
      });

      const result = await validateInvoice('test-case-id', 'READY_FOR_IMPORT');

      expect(result.passedChecks).toContain('ESTIMATE_VARIANCE_OK_UNDER');
    });

    test('WARN when Invoice > Estimate but within $100 tolerance', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'SHOP',
        fms_shopping_id: 'shopping-123',
        total_amount: 1050,
      });
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        shoppingState: 'RELEASED',
        estimateTotal: 1000,
        cars: { 'UTLX123456': { exists: true } },
      });

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
        total_amount: 1200,
      });
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        shoppingState: 'RELEASED',
        estimateTotal: 1000,
        cars: { 'UTLX123456': { exists: true } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        shopLocation: { parent_company: 'Test Corp', city: 'Houston' },
        cars: {
          'CAR001': { exists: true },
          'CAR002': { exists: true },
          'CAR003': { exists: true },
        },
      });

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.passedChecks).toContain('MRU_MULTI_CAR_ALLOWED');
      expect(result.context).toHaveProperty('carCount', 3);
    });

    test('Auto-approve eligible when MRU <= $1500', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'MRU',
        total_amount: 1500,
      });
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        shopLocation: { parent_company: 'Test Corp', city: 'Houston' },
        cars: { 'UTLX123456': { exists: true } },
      });

      const result = await validateInvoice('test-case-id', 'ASSIGNED');

      expect(result.passedChecks).toContain('MRU_AUTO_APPROVE_ELIGIBLE');
      expect(result.context).toHaveProperty('autoApproveEligible', true);
    });

    test('WARN when MRU > $1500 requires Maintenance review', async () => {
      const caseData = createMockCaseData({
        invoice_type: 'MRU',
        total_amount: 2000,
      });
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        shopLocation: { parent_company: 'Test Corp', city: 'Houston' },
        cars: { 'UTLX123456': { exists: true } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        shopLocation: { parent_company: 'Test Corp', city: 'Houston' },
        cars: { 'UTLX123456': { exists: true } },
      });

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
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        cutoffDates: {
          entry_cutoff_date: yesterday.toISOString().split('T')[0],
          approval_cutoff_date: '2026-02-15',
        },
        cars: { 'UTLX123456': { exists: true } },
      });

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
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        cutoffDates: {
          entry_cutoff_date: '2026-02-28',
          approval_cutoff_date: yesterday.toISOString().split('T')[0],
        },
        cars: { 'UTLX123456': { exists: true } },
      });

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
      const future = new Date();
      future.setMonth(future.getMonth() + 1);
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        cutoffDates: {
          entry_cutoff_date: future.toISOString().split('T')[0],
          approval_cutoff_date: future.toISOString().split('T')[0],
        },
        cars: { 'UTLX123456': { exists: true } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        cars: { 'UNKNOWN123': { exists: false, remarkTo: null } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        cars: { 'OLDMARK123': { exists: false, remarkTo: 'NEWMARK456' } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        cars: { 'UTLX123456': { exists: true } },
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: null,
      });

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
      setupQueryRouter({
        caseData,
        stateTransition: { allowed: true },
        attachments: [
          { attachment_type: 'PDF', filename_original: 'invoice.pdf' },
          { attachment_type: 'TXT', filename_original: 'data.txt' },
        ],
        cars: { 'UTLX123456': { exists: true } },
      });

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
      setupQueryRouter({
        caseData: null,
      });

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
