/**
 * E2E Data Reconciliation Workflow Tests
 *
 * Tests the post-migration data reconciliation lifecycle:
 * 1. Get reconciliation dashboard (summary counts)
 * 2. List discrepancies with filters
 * 3. Resolve single discrepancy
 * 4. Bulk resolve discrepancies
 * 5. Detect duplicates
 * 6. Re-run reconciliation
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

// Mock transition-log.service since resolveDiscrepancy calls logTransition
jest.mock('../services/transition-log.service', () => ({
  logTransition: jest.fn().mockResolvedValue({ id: 'tlog-1' }),
}));

import { logTransition } from '../services/transition-log.service';
const mockLogTransition = logTransition as jest.MockedFunction<typeof logTransition>;

import {
  getReconciliationDashboard,
  listDiscrepancies,
  resolveDiscrepancy,
  bulkResolveDiscrepancies,
  detectDuplicates,
  runReconciliation,
} from '../services/data-reconciliation.service';

// ==============================================================================
// Test Helpers
// ==============================================================================

function createMockDiscrepancy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'disc-1',
    run_id: 'run-1',
    entity_type: 'cars',
    entity_id: 'UTLX123456',
    discrepancy_type: 'field_mismatch',
    severity: 'warning',
    field_name: 'car_type',
    source_value: 'Tank Car',
    target_value: 'Tanker',
    details: null,
    resolved_at: null,
    resolved_by: null,
    resolution_type: null,
    notes: null,
    created_at: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

// ==============================================================================
// Test Suite: Data Reconciliation (E2E)
// ==============================================================================

describe('E2E Workflow: Data Reconciliation', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockDbQuery.mockReset();
    mockQueryOne.mockReset();
    mockTransaction.mockReset();
    mockLogTransition.mockClear();
  });

  // --------------------------------------------------------------------------
  // 1. Reconciliation dashboard summary
  // --------------------------------------------------------------------------
  describe('Get reconciliation dashboard with summary counts', () => {
    it('should return total discrepancies broken down by severity, entity type, and type', async () => {
      // Total open discrepancies
      mockQueryOne.mockResolvedValueOnce({ count: '42' } as any);

      // By severity
      mockDbQuery.mockResolvedValueOnce([
        { severity: 'critical', count: '8' },
        { severity: 'warning', count: '24' },
        { severity: 'info', count: '10' },
      ] as any);

      // By entity type
      mockDbQuery.mockResolvedValueOnce([
        { entity_type: 'cars', count: '20' },
        { entity_type: 'customers', count: '12' },
        { entity_type: 'invoices', count: '10' },
      ] as any);

      // By discrepancy type
      mockDbQuery.mockResolvedValueOnce([
        { discrepancy_type: 'field_mismatch', count: '25' },
        { discrepancy_type: 'missing_in_target', count: '12' },
        { discrepancy_type: 'duplicate', count: '5' },
      ] as any);

      const dashboard = await getReconciliationDashboard();

      expect(dashboard.total_discrepancies).toBe(42);
      expect(dashboard.by_severity).toHaveLength(3);
      expect(dashboard.by_severity[0]).toEqual({ severity: 'critical', count: 8 });
      expect(dashboard.by_entity_type).toHaveLength(3);
      expect(dashboard.by_entity_type[0]).toEqual({ entity_type: 'cars', count: 20 });
      expect(dashboard.by_discrepancy_type).toHaveLength(3);
      expect(dashboard.by_discrepancy_type[0]).toEqual({ discrepancy_type: 'field_mismatch', count: 25 });
    });
  });

  // --------------------------------------------------------------------------
  // 2. List discrepancies with filters and pagination
  // --------------------------------------------------------------------------
  describe('List discrepancies with entity type and severity filters', () => {
    it('should return paginated discrepancies filtered by entity_type and status', async () => {
      const discrepancies = [
        createMockDiscrepancy({ id: 'disc-1', severity: 'critical' }),
        createMockDiscrepancy({ id: 'disc-2', severity: 'warning' }),
      ];

      // COUNT query
      mockQueryOne.mockResolvedValueOnce({ total: '2' } as any);
      // Data query
      mockDbQuery.mockResolvedValueOnce(discrepancies as any);

      const result = await listDiscrepancies({
        entity_type: 'cars',
        status: 'open',
        page: 1,
        page_size: 25,
      });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(25);
      expect(result.total_pages).toBe(1);
    });

    it('should return empty results when no discrepancies match filters', async () => {
      mockQueryOne.mockResolvedValueOnce({ total: '0' } as any);
      mockDbQuery.mockResolvedValueOnce([] as any);

      const result = await listDiscrepancies({
        severity: 'critical',
        entity_type: 'allocations',
        status: 'open',
      });

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
      expect(result.total_pages).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Resolve a single discrepancy
  // --------------------------------------------------------------------------
  describe('Resolve single discrepancy with audit logging', () => {
    it('should resolve an open discrepancy and log the transition for audit', async () => {
      const openDiscrepancy = createMockDiscrepancy();
      const resolvedDiscrepancy = createMockDiscrepancy({
        resolved_at: '2026-03-02T09:00:00Z',
        resolved_by: 'user-recon-1',
        resolution_type: 'accept_source',
        notes: 'Source value is correct per CIPROTS export',
      });

      // Fetch existing discrepancy (verify it exists and is open)
      mockQueryOne.mockResolvedValueOnce(openDiscrepancy as any);
      // UPDATE discrepancy
      mockQueryOne.mockResolvedValueOnce(resolvedDiscrepancy as any);
      // logTransition is already mocked at the top level

      const result = await resolveDiscrepancy(
        'disc-1',
        {
          action: 'accept_source',
          notes: 'Source value is correct per CIPROTS export',
        },
        'user-recon-1'
      );

      expect(result.resolved_at).toBeTruthy();
      expect(result.resolved_by).toBe('user-recon-1');
      expect(result.resolution_type).toBe('accept_source');

      // Verify audit log was called
      expect(mockLogTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          processType: 'data_reconciliation',
          entityId: 'disc-1',
          fromState: 'open',
          toState: 'resolved:accept_source',
          actorId: 'user-recon-1',
        })
      );
    });

    it('should throw when attempting to resolve an already-resolved discrepancy', async () => {
      const alreadyResolved = createMockDiscrepancy({
        resolved_at: '2026-03-01T12:00:00Z',
        resolved_by: 'other-user',
      });

      mockQueryOne.mockResolvedValueOnce(alreadyResolved as any);

      await expect(
        resolveDiscrepancy('disc-1', { action: 'accept_target' }, 'user-recon-1')
      ).rejects.toThrow('already resolved');
    });

    it('should throw when discrepancy is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        resolveDiscrepancy('disc-nonexistent', { action: 'ignore' }, 'user-recon-1')
      ).rejects.toThrow('not found');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Bulk resolve discrepancies in a single transaction
  // --------------------------------------------------------------------------
  describe('Bulk resolve discrepancies atomically', () => {
    it('should resolve multiple open discrepancies and return resolved count', async () => {
      const disc1 = createMockDiscrepancy({ id: 'disc-1' });
      const disc2 = createMockDiscrepancy({ id: 'disc-2', entity_id: 'UTLX789012' });

      mockTransaction.mockImplementation(async (callback: (client: any) => Promise<any>) => {
        const mockClient = {
          query: jest.fn(),
        };

        // disc-1: SELECT existing -> open
        mockClient.query.mockResolvedValueOnce({ rows: [disc1] });
        // disc-1: UPDATE resolved
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // disc-1: INSERT audit log
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        // disc-2: SELECT existing -> open
        mockClient.query.mockResolvedValueOnce({ rows: [disc2] });
        // disc-2: UPDATE resolved
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // disc-2: INSERT audit log
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        return callback(mockClient);
      });

      const result = await bulkResolveDiscrepancies(
        ['disc-1', 'disc-2'],
        { action: 'ignore', notes: 'Minor formatting differences, safe to ignore' },
        'user-recon-1'
      );

      expect(result.resolved_count).toBe(2);
      expect(result.resolved_ids).toEqual(['disc-1', 'disc-2']);
    });

    it('should throw when no IDs are provided', async () => {
      await expect(
        bulkResolveDiscrepancies([], { action: 'accept_source' }, 'user-1')
      ).rejects.toThrow('No discrepancy IDs provided');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Detect duplicate records for a given entity type
  // --------------------------------------------------------------------------
  describe('Detect duplicate records across entity types', () => {
    it('should find duplicate customers by normalized name', async () => {
      mockDbQuery.mockResolvedValueOnce([
        {
          a_id: 'cust-1',
          a_name: 'Acme Corporation',
          a_code: 'ACME1',
          b_id: 'cust-2',
          b_name: 'Acme Corporation',
          b_code: 'ACME2',
        },
      ] as any);

      const duplicates = await detectDuplicates('customers');

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].entity_type).toBe('customers');
      expect(duplicates[0].entity_a_id).toBe('cust-1');
      expect(duplicates[0].entity_b_id).toBe('cust-2');
      expect(duplicates[0].match_confidence).toBe(1.0);
      expect(duplicates[0].matched_fields).toContain('customer_name');
    });

    it('should return empty array when no duplicates are found', async () => {
      mockDbQuery.mockResolvedValueOnce([] as any);

      const duplicates = await detectDuplicates('cars');

      expect(duplicates).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Re-run reconciliation for a completed migration run
  // --------------------------------------------------------------------------
  describe('Re-run reconciliation detects new discrepancies after migration', () => {
    it('should detect discrepancies for a completed car migration run', async () => {
      const migrationRun = {
        id: 'mig-run-1',
        entity_type: 'car',
        started_at: '2026-03-01T10:00:00Z',
        completed_at: '2026-03-01T10:05:00Z',
        imported_rows: 100,
        status: 'complete',
      };

      // Fetch migration run
      mockQueryOne.mockResolvedValueOnce(migrationRun as any);

      // Create parallel_run_results entry
      mockQueryOne.mockResolvedValueOnce({ id: 'pr-run-1' } as any);

      // reconcileCars internals:
      // 1. Fetch error rows from migration_row_errors
      mockDbQuery.mockResolvedValueOnce([
        { raw_value: 'UTLX_BAD_001', error_type: 'insert_failed' },
      ] as any);

      // 2. Check if UTLX_BAD_001 exists in cars table -> not found
      mockQueryOne.mockResolvedValueOnce(null);

      // 3. insertDiscrepancy (missing_in_target)
      mockDbQuery.mockResolvedValueOnce([] as any);

      // 4. Source count from migration_runs
      mockQueryOne.mockResolvedValueOnce({ count: '100' } as any);

      // 5. Target count from cars (within time window)
      mockQueryOne.mockResolvedValueOnce({ count: '95' } as any);

      // 6. insertDiscrepancy (record_count mismatch) -- difference is 5
      mockDbQuery.mockResolvedValueOnce([] as any);

      // 7. Update parallel_run_results with mismatch count
      mockDbQuery.mockResolvedValueOnce([] as any);

      const result = await runReconciliation('mig-run-1');

      expect(result.run_id).toBe('mig-run-1');
      // 1 missing_in_target + 1 count_mismatch = 2 new issues
      expect(result.new_issues).toBe(2);
    });

    it('should throw when migration run is not complete', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'mig-run-2',
        entity_type: 'car',
        status: 'importing',
      } as any);

      await expect(
        runReconciliation('mig-run-2')
      ).rejects.toThrow('not complete');
    });

    it('should throw when migration run does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        runReconciliation('nonexistent-run')
      ).rejects.toThrow('not found');
    });
  });
});
