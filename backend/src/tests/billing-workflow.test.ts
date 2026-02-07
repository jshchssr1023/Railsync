/**
 * E2E Billing Workflow Tests
 *
 * Tests the billing run lifecycle end-to-end:
 * 1. Creating a billing run (month-end)
 * 2. Preflight validation
 * 3. Approving a billing run (state: pending -> approved)
 * 4. Completing a billing run (state: approved -> completed)
 * 5. Cost allocation entry creation
 * 6. Cost allocation summary retrieval
 */

import pool from '../config/database';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  pool: { query: jest.fn() },
}));

const mockQuery = pool.query as jest.Mock;

import { query, queryOne, transaction } from '../config/database';

const mockDbQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;

import {
  runPreflight,
  createBillingRun,
  approveBillingRun,
  completeBillingRun,
  getBillingRun,
  createCostAllocationEntry,
  getCostAllocationSummary,
  getBillingSummary,
} from '../services/billing.service';

// ==============================================================================
// Test Helpers
// ==============================================================================

function createMockBillingRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    fiscal_year: 2026,
    fiscal_month: 3,
    run_type: 'rental',
    preflight_passed: false,
    preflight_results: null,
    status: 'preflight',
    invoices_generated: 0,
    total_amount: 0,
    error_count: 0,
    errors: null,
    initiated_by: 'user-billing-1',
    approved_by: null,
    approved_at: null,
    completed_at: null,
    created_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function createMockCostAllocationEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cae-1',
    allocation_id: 'alloc-1',
    customer_id: 'cust-1',
    car_number: 'UTLX123456',
    labor_cost: 1200,
    material_cost: 800,
    freight_cost: 200,
    total_cost: 2200,
    billing_entity: 'owner',
    lessee_share_pct: 60,
    owner_share_pct: 40,
    lessee_amount: 1320,
    owner_amount: 880,
    applied_to_invoice_id: null,
    applied_at: null,
    brc_number: 'BRC-001',
    shopping_event_id: 'se-1',
    scope_of_work_id: null,
    status: 'allocated',
    allocated_by: 'user-billing-1',
    notes: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

// ==============================================================================
// Test Suite: Billing Run Lifecycle (E2E)
// ==============================================================================

describe('E2E Workflow: Billing Run Lifecycle', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockDbQuery.mockReset();
    mockQueryOne.mockReset();
    mockTransaction.mockReset();
  });

  // --------------------------------------------------------------------------
  // 1. Full billing run lifecycle: create -> preflight -> approve -> complete
  // --------------------------------------------------------------------------
  describe('Complete billing run lifecycle from creation to completion', () => {
    it('should progress a billing run through all states: preflight -> review -> approved -> completed', async () => {
      const userId = 'user-billing-1';
      const fiscalYear = 2026;
      const fiscalMonth = 3;

      // PHASE 1: Create a billing run (triggers preflight internally)
      // Step 1a: INSERT billing run
      mockDbQuery.mockResolvedValueOnce([createMockBillingRun()] as any);
      // Step 1b: Preflight check 1 - riders with rates (none missing)
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Step 1c: Preflight check 2 - no duplicate billing run
      mockQueryOne.mockResolvedValueOnce(null);
      // Step 1d: Preflight check 3 - mileage files reconciled
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Step 1e: Preflight check 4 - no existing invoices
      mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);
      // Step 1f: Update preflight results
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Step 1g: Update status to generating
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Step 1h: Get active customers (none for simplicity)
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Step 1i: Update billing run with results
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Step 1j: Fetch final billing run state
      mockQueryOne.mockResolvedValueOnce(
        createMockBillingRun({
          status: 'review',
          preflight_passed: true,
          invoices_generated: 0,
          total_amount: 0,
        }) as any
      );

      const billingRun = await createBillingRun(fiscalYear, fiscalMonth, 'rental', userId);

      expect(billingRun).toBeDefined();
      expect(billingRun.status).toBe('review');
      expect(billingRun.preflight_passed).toBe(true);

      // PHASE 2: Approve the billing run (review -> approved)
      mockDbQuery.mockResolvedValueOnce([
        createMockBillingRun({
          status: 'approved',
          approved_by: userId,
          approved_at: '2026-03-01T12:00:00Z',
        }),
      ] as any);

      const approved = await approveBillingRun(billingRun.id, userId, 'All invoices look correct');

      expect(approved).toBeDefined();
      expect(approved!.status).toBe('approved');
      expect(approved!.approved_by).toBe(userId);

      // PHASE 3: Complete the billing run (approved -> completed)
      mockDbQuery.mockResolvedValueOnce([
        createMockBillingRun({
          status: 'completed',
          approved_by: userId,
          completed_at: '2026-03-01T14:00:00Z',
        }),
      ] as any);

      const completed = await completeBillingRun(billingRun.id);

      expect(completed).toBeDefined();
      expect(completed!.status).toBe('completed');
      expect(completed!.completed_at).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Preflight failure blocks billing run from progressing
  // --------------------------------------------------------------------------
  describe('Preflight failure prevents billing run from generating invoices', () => {
    it('should set billing run status to failed when preflight checks fail', async () => {
      const userId = 'user-billing-1';

      // INSERT billing run
      mockDbQuery.mockResolvedValueOnce([createMockBillingRun()] as any);
      // Preflight check 1: riders missing rates (fail)
      mockDbQuery.mockResolvedValueOnce([
        { rider_id: 'r-1', rider_code: 'RDR001', rider_name: 'Test Rider', customer_code: 'CUST001' },
      ] as any);
      // Preflight check 2: no duplicate run
      mockQueryOne.mockResolvedValueOnce(null);
      // Preflight check 3: mileage reconciled
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Preflight check 4: no existing invoices
      mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);
      // Update preflight results
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Update status to failed
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Fetch final billing run
      mockQueryOne.mockResolvedValueOnce(
        createMockBillingRun({ status: 'failed', preflight_passed: false }) as any
      );

      const billingRun = await createBillingRun(2026, 3, 'rental', userId);

      expect(billingRun.status).toBe('failed');
      expect(billingRun.preflight_passed).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Approve billing run only from review state
  // --------------------------------------------------------------------------
  describe('Approving a billing run from an invalid state', () => {
    it('should return null when attempting to approve a run not in review status', async () => {
      // The SQL WHERE clause includes status = 'review', so no rows returned
      mockDbQuery.mockResolvedValueOnce([] as any);

      const result = await approveBillingRun('run-already-completed', 'admin-1');

      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Complete billing run only from approved or posting state
  // --------------------------------------------------------------------------
  describe('Completing a billing run from an invalid state', () => {
    it('should return null when attempting to complete a run not in approved/posting status', async () => {
      mockDbQuery.mockResolvedValueOnce([] as any);

      const result = await completeBillingRun('run-still-in-review');

      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Cost allocation entry creation with lessee/owner split
  // --------------------------------------------------------------------------
  describe('Cost allocation entry creation and split calculation', () => {
    it('should create a cost allocation entry with correct lessee/owner split', async () => {
      const expectedEntry = createMockCostAllocationEntry({
        lessee_share_pct: 60,
        owner_share_pct: 40,
        total_cost: 2200,
        lessee_amount: 1320,
        owner_amount: 880,
      });

      mockDbQuery.mockResolvedValueOnce([expectedEntry] as any);

      const entry = await createCostAllocationEntry({
        allocation_id: 'alloc-1',
        customer_id: 'cust-1',
        car_number: 'UTLX123456',
        labor_cost: 1200,
        material_cost: 800,
        freight_cost: 200,
        total_cost: 2200,
        lessee_share_pct: 60,
        brc_number: 'BRC-001',
        shopping_event_id: 'se-1',
        allocated_by: 'user-billing-1',
      });

      expect(entry).toBeDefined();
      expect(entry.status).toBe('allocated');
      expect(entry.lessee_share_pct).toBe(60);
      expect(entry.owner_share_pct).toBe(40);
      expect(entry.lessee_amount).toBe(1320);
      expect(entry.owner_amount).toBe(880);
      expect(entry.total_cost).toBe(2200);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Cost allocation summary retrieval by fiscal period
  // --------------------------------------------------------------------------
  describe('Cost allocation summary retrieval', () => {
    it('should return aggregated cost allocation summary by customer for a billing period', async () => {
      const summaryRows = [
        {
          customer_id: 'cust-1',
          customer_code: 'ACME',
          customer_name: 'Acme Corp',
          billing_month: '2026-03-01',
          allocation_count: 12,
          total_cost: 48000,
          labor_total: 25000,
          material_total: 15000,
          freight_total: 8000,
          lessee_billable: 28800,
          owner_absorbed: 19200,
          pending_count: 2,
          allocated_count: 8,
          invoiced_count: 2,
        },
        {
          customer_id: 'cust-2',
          customer_code: 'BETA',
          customer_name: 'Beta Inc',
          billing_month: '2026-03-01',
          allocation_count: 5,
          total_cost: 18000,
          labor_total: 10000,
          material_total: 6000,
          freight_total: 2000,
          lessee_billable: 10800,
          owner_absorbed: 7200,
          pending_count: 0,
          allocated_count: 5,
          invoiced_count: 0,
        },
      ];

      mockDbQuery.mockResolvedValueOnce(summaryRows as any);

      const summary = await getCostAllocationSummary(2026, 3);

      expect(summary).toHaveLength(2);
      expect(summary[0].customer_code).toBe('ACME');
      expect(summary[0].total_cost).toBe(48000);
      expect(summary[0].lessee_billable).toBe(28800);
      expect(summary[1].customer_code).toBe('BETA');
      expect(summary[1].allocation_count).toBe(5);
    });
  });
});
