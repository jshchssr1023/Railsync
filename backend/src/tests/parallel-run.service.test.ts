/**
 * Parallel Run Service Tests
 *
 * Tests comparison functions for invoices, car statuses, billing totals, and mileage.
 * Tests health score calculation and go-live checklist generation.
 */

import {
  compareInvoices,
  compareCarStatuses,
  compareBillingTotals,
  compareMileage,
  getGoLiveChecklist,
  getHealthScore,
  resolveDiscrepancy,
} from '../services/parallel-run.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
}));

import { query, queryOne } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Parallel Run Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Compare Invoices
  // ============================================================================
  describe('compareInvoices', () => {
    it('should produce correct match and mismatch counts', async () => {
      const ciprotsCsv = [
        'invoice_number,customer_code,total_amount,line_count',
        'INV-001,CUST001,1000.00,5',
        'INV-002,CUST002,2000.00,3',
        'INV-003,CUST003,500.00,2',
      ].join('\n');

      // RailSync invoices query
      mockQuery.mockResolvedValueOnce([
        { invoice_number: 'INV-001', customer_code: 'CUST001', total_amount: 1000.00, line_count: 5 },
        { invoice_number: 'INV-002', customer_code: 'CUST002', total_amount: 2500.00, line_count: 3 }, // mismatch
        // INV-003 is missing from RailSync
      ] as any);

      // Create parallel run record
      mockQueryOne.mockResolvedValueOnce({ id: 'prun-1' } as any);

      // Discrepancy inserts: INV-003 existence + INV-002 amount mismatch
      mockQuery.mockResolvedValueOnce([] as any); // INV-002 mismatch
      mockQuery.mockResolvedValueOnce([] as any); // INV-003 ciprots-only

      // Final update of parallel_run_results
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await compareInvoices(ciprotsCsv, '2026-01');

      expect(result.comparison_type).toBe('invoices');
      expect(result.ciprots_count).toBe(3);
      expect(result.railsync_count).toBe(2);
      expect(result.match_count).toBe(1); // INV-001 matches
      expect(result.mismatch_count).toBe(1); // INV-002 differs
      expect(result.ciprots_only_count).toBe(1); // INV-003
    });

    it('should count exact matches correctly when amounts differ by less than $0.01', async () => {
      const ciprotsCsv = [
        'invoice_number,total_amount',
        'INV-001,1000.005',
      ].join('\n');

      mockQuery.mockResolvedValueOnce([
        { invoice_number: 'INV-001', customer_code: 'C1', total_amount: 1000.00, line_count: 1 },
      ] as any);
      mockQueryOne.mockResolvedValueOnce({ id: 'prun-2' } as any);
      mockQuery.mockResolvedValueOnce([] as any); // final update

      const result = await compareInvoices(ciprotsCsv, '2026-01');

      expect(result.match_count).toBe(1);
      expect(result.mismatch_count).toBe(0);
    });
  });

  // ============================================================================
  // Compare Car Statuses
  // ============================================================================
  describe('compareCarStatuses', () => {
    it('should detect status mismatches', async () => {
      const ciprotsCsv = [
        'car_number,status',
        'UTLX111,Active',
        'UTLX222,Retired',
        'UTLX333,Active',
      ].join('\n');

      // Create parallel run record
      mockQueryOne.mockResolvedValueOnce({ id: 'prun-status' } as any);

      // Car lookups - one at a time
      mockQueryOne.mockResolvedValueOnce({ current_status: 'Active' } as any);   // UTLX111 - match
      mockQueryOne.mockResolvedValueOnce({ current_status: 'Active' } as any);   // UTLX222 - mismatch
      mockQuery.mockResolvedValueOnce([] as any); // discrepancy insert for UTLX222
      mockQueryOne.mockResolvedValueOnce(null);                                   // UTLX333 - not found
      mockQuery.mockResolvedValueOnce([] as any); // discrepancy insert for UTLX333

      // Total cars count
      mockQueryOne.mockResolvedValueOnce({ count: '100' } as any);

      // Final update
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await compareCarStatuses(ciprotsCsv);

      expect(result.comparison_type).toBe('car_status');
      expect(result.match_count).toBe(1);
      expect(result.mismatch_count).toBe(1);
      expect(result.ciprots_only_count).toBe(1);
    });
  });

  // ============================================================================
  // Compare Billing Totals
  // ============================================================================
  describe('compareBillingTotals', () => {
    it('should detect billing total discrepancies', async () => {
      const ciprotsCsv = [
        'customer_code,total_billed,car_count',
        'CUST001,50000.00,10',
        'CUST002,30000.00,5',
      ].join('\n');

      // RailSync billing totals
      mockQuery.mockResolvedValueOnce([
        { customer_code: 'CUST001', total_billed: 50000.00, car_count: 10 }, // match
        { customer_code: 'CUST003', total_billed: 10000.00, car_count: 2 },  // railsync-only
      ] as any);

      mockQueryOne.mockResolvedValueOnce({ id: 'prun-billing' } as any);

      // CUST002 is ciprots-only
      mockQuery.mockResolvedValueOnce([] as any); // discrepancy insert
      // CUST003 is railsync-only
      mockQuery.mockResolvedValueOnce([] as any); // discrepancy insert

      // Final update
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await compareBillingTotals(ciprotsCsv, '2026-01');

      expect(result.comparison_type).toBe('billing_totals');
      expect(result.match_count).toBe(1);
      expect(result.ciprots_only_count).toBe(1);
      expect(result.railsync_only_count).toBe(1);
    });
  });

  // ============================================================================
  // Compare Mileage
  // ============================================================================
  describe('compareMileage', () => {
    it('should detect mileage discrepancies', async () => {
      const ciprotsCsv = [
        'car_number,total_miles,railroad',
        'UTLX111,5000,BNSF',
        'UTLX222,3000,UP',
      ].join('\n');

      // RailSync mileage
      mockQuery.mockResolvedValueOnce([
        { car_number: 'UTLX111', miles: 5000 }, // exact match
        { car_number: 'UTLX222', miles: 3500 }, // mismatch (diff = 500, critical severity)
      ] as any);

      mockQueryOne.mockResolvedValueOnce({ id: 'prun-mileage' } as any);

      // Discrepancy insert for UTLX222
      mockQuery.mockResolvedValueOnce([] as any);

      // Final update
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await compareMileage(ciprotsCsv, '2026-01-01');

      expect(result.comparison_type).toBe('mileage');
      expect(result.match_count).toBe(1);
      expect(result.mismatch_count).toBe(1);
    });
  });

  // ============================================================================
  // Health Score Calculation
  // ============================================================================
  describe('getHealthScore', () => {
    it('should calculate health score with known inputs', async () => {
      // Latest invoice match %
      mockQueryOne.mockResolvedValueOnce({ match_pct: 99.5 } as any);
      // Latest status match %
      mockQueryOne.mockResolvedValueOnce({ match_pct: 98.0 } as any);
      // Open discrepancies by severity
      mockQuery.mockResolvedValueOnce([
        { severity: 'critical', cnt: 0 },
        { severity: 'warning', cnt: 3 },
      ] as any);
      // Resolution stats
      mockQueryOne.mockResolvedValueOnce({ total: 100, resolved: 97 } as any);
      // Trend data
      mockQuery.mockResolvedValueOnce([
        { period: 'recent', avg_match: 99.5 },
        { period: 'prior', avg_match: 98.0 },
      ] as any);
      // Run stats
      mockQueryOne.mockResolvedValueOnce({
        total_runs: 15,
        first_run: '2026-01-01',
      } as any);

      const result = await getHealthScore();

      // Verify the composite score formula:
      // invoice(99.5) * 0.40 + status(98) * 0.25 + resolution(97) * 0.20 + (no criticals = 100) * 0.15
      // = 39.8 + 24.5 + 19.4 + 15 = 98.7 -> rounds to 99
      expect(result.overall_score).toBe(99);
      expect(result.invoice_score).toBe(99.5);
      expect(result.status_score).toBe(98.0);
      expect(result.resolution_rate).toBe(97);
      expect(result.open_critical).toBe(0);
      expect(result.open_warning).toBe(3);
      expect(result.trend_direction).toBe('improving'); // 99.5 > 98.0 + 1
      expect(result.go_live_ready).toBe(true);
      expect(result.total_runs).toBe(15);
    });

    it('should report not go-live ready when critical discrepancies exist', async () => {
      mockQueryOne.mockResolvedValueOnce({ match_pct: 99.0 } as any);
      mockQueryOne.mockResolvedValueOnce({ match_pct: 98.0 } as any);
      mockQuery.mockResolvedValueOnce([
        { severity: 'critical', cnt: 2 },
        { severity: 'warning', cnt: 5 },
      ] as any);
      mockQueryOne.mockResolvedValueOnce({ total: 50, resolved: 40 } as any);
      mockQuery.mockResolvedValueOnce([
        { period: 'recent', avg_match: 99.0 },
        { period: 'prior', avg_match: 99.0 },
      ] as any);
      mockQueryOne.mockResolvedValueOnce({ total_runs: 5, first_run: '2026-01-20' } as any);

      const result = await getHealthScore();

      expect(result.go_live_ready).toBe(false);
      expect(result.open_critical).toBe(2);
      expect(result.trend_direction).toBe('stable');
    });
  });

  // ============================================================================
  // Go-Live Checklist
  // ============================================================================
  describe('getGoLiveChecklist', () => {
    it('should return correct check structure with all items', async () => {
      // 1. invoiceAccuracy
      mockQueryOne.mockResolvedValueOnce({ match_pct: 99.5 } as any);
      // 2. statusAccuracy
      mockQueryOne.mockResolvedValueOnce({ match_pct: 99.0 } as any);
      // 3. billingAccuracy
      mockQueryOne.mockResolvedValueOnce({ match_pct: 99.2 } as any);
      // 4. noCriticalDiscrepancies
      mockQueryOne.mockResolvedValueOnce({ cnt: 0 } as any);
      // 5. resolutionRate
      mockQueryOne.mockResolvedValueOnce({ total: 200, resolved: 195 } as any);
      // 6. minimumParallelDays
      mockQueryOne.mockResolvedValueOnce({ first_date: '2026-01-01' } as any);
      // 7. minimumRuns
      mockQueryOne.mockResolvedValueOnce({ cnt: 15 } as any);
      // 8. allEntitiesMigrated
      mockQuery.mockResolvedValueOnce([
        { entity_type: 'car' },
        { entity_type: 'contract' },
        { entity_type: 'shopping' },
        { entity_type: 'qualification' },
        { entity_type: 'customer' },
        { entity_type: 'invoice' },
      ] as any);
      // 9. dataReconciled
      mockQuery.mockResolvedValueOnce([
        { comparison_type: 'invoices', total_compared: 100 },
        { comparison_type: 'car_status', total_compared: 50 },
        { comparison_type: 'billing_totals', total_compared: 30 },
        { comparison_type: 'mileage', total_compared: 20 },
        { comparison_type: 'allocations', total_compared: 10 },
      ] as any);

      const result = await getGoLiveChecklist();

      expect(result.items).toHaveLength(9);
      expect(result.overall).toBe(true);

      // Verify specific checks
      const invoiceCheck = result.items.find(i => i.check === 'invoiceAccuracy');
      expect(invoiceCheck?.passed).toBe(true);
      expect(invoiceCheck?.value).toBe('99.5%');

      const criticalCheck = result.items.find(i => i.check === 'noCriticalDiscrepancies');
      expect(criticalCheck?.passed).toBe(true);
      expect(criticalCheck?.value).toBe('0');

      const runsCheck = result.items.find(i => i.check === 'minimumRuns');
      expect(runsCheck?.passed).toBe(true);
    });

    it('should report overall=false when any check fails', async () => {
      // 1. invoiceAccuracy - fails
      mockQueryOne.mockResolvedValueOnce({ match_pct: 95 } as any);
      // 2-9: pass everything else
      mockQueryOne.mockResolvedValueOnce({ match_pct: 99 } as any);
      mockQueryOne.mockResolvedValueOnce({ match_pct: 99 } as any);
      mockQueryOne.mockResolvedValueOnce({ cnt: 0 } as any);
      mockQueryOne.mockResolvedValueOnce({ total: 100, resolved: 96 } as any);
      mockQueryOne.mockResolvedValueOnce({ first_date: '2026-01-01' } as any);
      mockQueryOne.mockResolvedValueOnce({ cnt: 15 } as any);
      mockQuery.mockResolvedValueOnce([
        { entity_type: 'car' }, { entity_type: 'contract' }, { entity_type: 'shopping' },
        { entity_type: 'qualification' }, { entity_type: 'customer' }, { entity_type: 'invoice' },
      ] as any);
      mockQuery.mockResolvedValueOnce([
        { comparison_type: 'invoices', total_compared: 100 },
        { comparison_type: 'car_status', total_compared: 50 },
        { comparison_type: 'billing_totals', total_compared: 30 },
        { comparison_type: 'mileage', total_compared: 20 },
        { comparison_type: 'allocations', total_compared: 10 },
      ] as any);

      const result = await getGoLiveChecklist();

      expect(result.overall).toBe(false);
      expect(result.items.find(i => i.check === 'invoiceAccuracy')?.passed).toBe(false);
    });
  });

  // ============================================================================
  // Resolve Discrepancy
  // ============================================================================
  describe('resolveDiscrepancy', () => {
    it('should mark a discrepancy as resolved', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 'disc-1' }] as any);

      const result = await resolveDiscrepancy('disc-1', 'user-1', 'Investigated and confirmed correct');

      expect(result).toBe(true);
    });

    it('should return false when discrepancy not found', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await resolveDiscrepancy('nonexistent', 'user-1', 'notes');

      expect(result).toBe(false);
    });
  });
});
