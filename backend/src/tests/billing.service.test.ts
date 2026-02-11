/**
 * Billing Service Tests
 *
 * Tests preflight validation, invoice number generation, billing adjustments,
 * adjustment approve/reject workflows, billing run creation, and billing run
 * approve/complete lifecycle.
 */

import {
  runPreflight,
  generateInvoiceNumber,
  createAdjustment,
  approveAdjustment,
  rejectAdjustment,
  approveBillingRun,
  completeBillingRun,
  getBillingSummary,
  approveOutboundInvoice,
  voidOutboundInvoice,
} from '../services/billing.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  pool: { query: jest.fn() },
}));

import { query, queryOne } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

// ==============================================================================
// Test Helpers
// ==============================================================================

function createMockAdjustment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'adj-1',
    customer_id: 'cust-1',
    rider_id: null,
    car_number: null,
    adjustment_type: 'credit',
    amount: -500,
    description: 'Rate correction credit',
    source_event: null,
    source_event_id: null,
    status: 'pending',
    requested_by: 'user-1',
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    applied_to_invoice_id: null,
    applied_at: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

function createMockBillingRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    fiscal_year: 2026,
    fiscal_month: 3,
    run_type: 'rental',
    preflight_passed: true,
    preflight_results: null,
    status: 'review',
    invoices_generated: 5,
    total_amount: 50000,
    error_count: 0,
    errors: null,
    initiated_by: 'user-1',
    approved_by: null,
    approved_at: null,
    completed_at: null,
    created_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Billing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Preflight Validation
  // ============================================================================
  describe('runPreflight', () => {
    it('should pass when all checks succeed', async () => {
      // Check 1: riders with rates - none missing
      mockQuery.mockResolvedValueOnce([] as any);
      // Check 2: no duplicate billing run
      mockQueryOne.mockResolvedValueOnce(null);
      // Check 3: mileage files reconciled - none pending
      mockQuery.mockResolvedValueOnce([] as any);
      // Check 4: no existing invoices
      mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);

      const result = await runPreflight(2026, 3);

      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(4);
      expect(result.checks.every(c => c.passed)).toBe(true);
    });

    it('should fail when riders are missing rates', async () => {
      // Check 1: riders without rates
      mockQuery.mockResolvedValueOnce([
        { rider_id: 'r-1', rider_code: 'RDR001', rider_name: 'Rider A', customer_code: 'CUST001' },
      ] as any);
      // Check 2: no duplicate run
      mockQueryOne.mockResolvedValueOnce(null);
      // Check 3: mileage reconciled
      mockQuery.mockResolvedValueOnce([] as any);
      // Check 4: no existing invoices
      mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);

      const result = await runPreflight(2026, 3);

      expect(result.passed).toBe(false);
      const riderCheck = result.checks.find(c => c.name === 'riders_have_rates');
      expect(riderCheck?.passed).toBe(false);
      expect(riderCheck?.message).toContain('1 active rider(s) missing rates');
    });

    it('should fail when a duplicate billing run exists', async () => {
      mockQuery.mockResolvedValueOnce([] as any);
      // Check 2: existing billing run found
      mockQueryOne.mockResolvedValueOnce({ id: 'existing-run', status: 'review' } as any);
      mockQuery.mockResolvedValueOnce([] as any);
      mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);

      const result = await runPreflight(2026, 3);

      expect(result.passed).toBe(false);
      const dupCheck = result.checks.find(c => c.name === 'no_duplicate_run');
      expect(dupCheck?.passed).toBe(false);
      expect(dupCheck?.message).toContain('already exists');
    });

    it('should fail when mileage files are unreconciled', async () => {
      mockQuery.mockResolvedValueOnce([] as any);
      mockQueryOne.mockResolvedValueOnce(null);
      // Check 3: unreconciled mileage files
      mockQuery.mockResolvedValueOnce([
        { id: 'mf-1', filename: 'mileage_jan.csv', status: 'uploaded' },
      ] as any);
      mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);

      const result = await runPreflight(2026, 3);

      expect(result.passed).toBe(false);
      const mileageCheck = result.checks.find(c => c.name === 'mileage_reconciled');
      expect(mileageCheck?.passed).toBe(false);
    });
  });

  // ============================================================================
  // Invoice Number Generation
  // ============================================================================
  describe('generateInvoiceNumber', () => {
    it('should generate a properly formatted invoice number', async () => {
      // Customer lookup
      mockQueryOne.mockResolvedValueOnce({ customer_code: 'ACME' } as any);
      // Count existing invoices
      mockQueryOne.mockResolvedValueOnce({ count: '2' } as any);

      const result = await generateInvoiceNumber('cust-1', 2026, 3);

      expect(result).toBe('INV-ACME-202603-003');
    });

    it('should throw when customer not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        generateInvoiceNumber('nonexistent', 2026, 3)
      ).rejects.toThrow('Customer not found');
    });

    it('should generate sequence 001 for first invoice in period', async () => {
      mockQueryOne.mockResolvedValueOnce({ customer_code: 'BETA' } as any);
      mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);

      const result = await generateInvoiceNumber('cust-2', 2026, 1);

      expect(result).toBe('INV-BETA-202601-001');
    });
  });

  // ============================================================================
  // Billing Adjustments
  // ============================================================================
  describe('createAdjustment', () => {
    it('should create a pending adjustment', async () => {
      mockQuery.mockResolvedValueOnce([createMockAdjustment()] as any);

      const result = await createAdjustment({
        customer_id: 'cust-1',
        adjustment_type: 'credit',
        amount: -500,
        description: 'Rate correction credit',
        requested_by: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.amount).toBe(-500);
    });
  });

  describe('approveAdjustment', () => {
    it('should approve a pending adjustment', async () => {
      mockQuery.mockResolvedValueOnce([
        createMockAdjustment({ status: 'approved', approved_by: 'admin-1' }),
      ] as any);

      const result = await approveAdjustment('adj-1', 'admin-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('approved');
      expect(result!.approved_by).toBe('admin-1');
    });

    it('should return null when adjustment is not in pending status', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await approveAdjustment('adj-already-approved', 'admin-1');

      expect(result).toBeNull();
    });
  });

  describe('rejectAdjustment', () => {
    it('should reject a pending adjustment with a reason', async () => {
      mockQuery.mockResolvedValueOnce([
        createMockAdjustment({
          status: 'rejected',
          approved_by: 'admin-1',
          rejection_reason: 'Insufficient justification',
        }),
      ] as any);

      const result = await rejectAdjustment('adj-1', 'admin-1', 'Insufficient justification');

      expect(result).toBeDefined();
      expect(result!.status).toBe('rejected');
      expect(result!.rejection_reason).toBe('Insufficient justification');
    });
  });

  // ============================================================================
  // Billing Run Approve/Complete Workflow
  // ============================================================================
  describe('approveBillingRun', () => {
    it('should approve a billing run in review status', async () => {
      mockQuery.mockResolvedValueOnce([
        createMockBillingRun({ status: 'approved', approved_by: 'admin-1' }),
      ] as any);

      const result = await approveBillingRun('run-1', 'admin-1', 'Looks good');

      expect(result).toBeDefined();
      expect(result!.status).toBe('approved');
    });

    it('should return null when run is not in review status', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await approveBillingRun('run-completed', 'admin-1');

      expect(result).toBeNull();
    });
  });

  describe('completeBillingRun', () => {
    it('should complete an approved billing run', async () => {
      mockQuery.mockResolvedValueOnce([
        createMockBillingRun({ status: 'completed', completed_at: '2026-03-02T00:00:00Z' }),
      ] as any);

      const result = await completeBillingRun('run-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
    });

    it('should return null when run is not in approved or posting status', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await completeBillingRun('run-review');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Billing Summary
  // ============================================================================
  describe('getBillingSummary', () => {
    it('should return aggregated billing summary', async () => {
      mockQueryOne.mockResolvedValueOnce({
        total_invoices: '10',
        total_rental: '40000',
        total_mileage: '5000',
        total_chargebacks: '2000',
        total_adjustments: '-500',
        grand_total: '46500',
        draft_count: '3',
        approved_count: '5',
        sent_count: '2',
        paid_count: '0',
      } as any);

      const result = await getBillingSummary(2026, 3);

      expect(result.total_invoices).toBe(10);
      expect(result.grand_total).toBe(46500);
      expect(result.draft_count).toBe(3);
      expect(result.approved_count).toBe(5);
    });

    it('should return zero values when no invoices exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getBillingSummary(2026, 12);

      expect(result.total_invoices).toBe(0);
      expect(result.grand_total).toBe(0);
    });
  });

  // ============================================================================
  // Outbound Invoice Approve/Void
  // ============================================================================
  describe('approveOutboundInvoice', () => {
    it('should approve a draft invoice', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'inv-1',
        status: 'approved',
        approved_by: 'admin-1',
      }] as any);

      const result = await approveOutboundInvoice('inv-1', 'admin-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('approved');
    });

    it('should return null when invoice is already approved or beyond', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await approveOutboundInvoice('inv-sent', 'admin-1');

      expect(result).toBeNull();
    });
  });

  describe('voidOutboundInvoice', () => {
    it('should void an invoice with a reason', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'inv-1',
        status: 'void',
        notes: 'VOIDED: Duplicate invoice',
      }] as any);

      const result = await voidOutboundInvoice('inv-1', 'Duplicate invoice');

      expect(result).toBeDefined();
      expect(result!.status).toBe('void');
    });

    it('should return null when invoice is already void or paid', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await voidOutboundInvoice('inv-paid', 'Cancellation');

      expect(result).toBeNull();
    });
  });
});
