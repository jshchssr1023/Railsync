/**
 * E2E Migration Pipeline Workflow Tests
 *
 * Tests the CIPROTS data migration pipeline end-to-end:
 * 1. CSV validation (dry-run)
 * 2. Customer import
 * 3. Car import (after customers)
 * 4. Contract import (after customers)
 * 5. Orchestration run (dependency-ordered)
 * 6. Rollback of a migration run
 * 7. Reconciliation check after import
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
  validateOnly,
  importCustomers,
  importCars,
  importContracts,
  runOrchestration,
  rollbackRun,
  getReconciliationSummary,
} from '../services/migration-pipeline.service';

// ==============================================================================
// Test Helpers
// ==============================================================================

const CUSTOMER_CSV = [
  'customer_code,customer_name,billing_address,billing_city,billing_state',
  'ACME,Acme Corp,123 Main St,Springfield,IL',
  'BETA,Beta Inc,456 Oak Ave,Chicago,IL',
].join('\n');

const CAR_CSV = [
  'car_number,car_mark,car_type,lessee_name,commodity',
  'UTLX123456,UTLX,Tank Car,Acme Corp,Chemical',
  'UTLX789012,UTLX,Hopper,Beta Inc,Grain',
].join('\n');

const CONTRACT_CSV = [
  'contract_number,customer_code,contract_name,status,start_date',
  'CTR-001,ACME,Acme Full Service,active,2025-01-01',
  'CTR-002,BETA,Beta Maintenance,active,2025-06-01',
].join('\n');

const INVALID_CAR_CSV = [
  'car_number,car_mark',
  ',UTLX',
  'UTLX999999,UTLX',
].join('\n');

// ==============================================================================
// Test Suite: Migration Pipeline (E2E)
// ==============================================================================

describe('E2E Workflow: Migration Pipeline', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockDbQuery.mockReset();
    mockQueryOne.mockReset();
    mockTransaction.mockReset();
  });

  // --------------------------------------------------------------------------
  // 1. CSV validation (dry-run) -- no database writes
  // --------------------------------------------------------------------------
  describe('CSV dry-run validation identifies errors without writing data', () => {
    it('should validate customer CSV and report zero errors for well-formed data', async () => {
      const result = await validateOnly('customer', CUSTOMER_CSV);

      expect(result.total_rows).toBe(2);
      expect(result.valid_rows).toBe(2);
      expect(result.error_rows).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields in car CSV during dry-run', async () => {
      // The first row is missing car_number
      const result = await validateOnly('car', INVALID_CAR_CSV);

      expect(result.total_rows).toBe(2);
      expect(result.error_rows).toBe(1);
      expect(result.valid_rows).toBe(1);
      expect(result.errors[0].error_type).toBe('missing_required');
      expect(result.errors[0].field_name).toBe('car_number');
    });

    it('should return unsupported entity type error for unknown types', async () => {
      const result = await validateOnly('unknown_entity', 'col1,col2\nval1,val2');

      expect(result.error_rows).toBe(1);
      expect(result.errors[0].error_type).toBe('unsupported');
      expect(result.errors[0].error_message).toContain('Unknown entity type');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Customer import followed by car import (dependency order)
  // --------------------------------------------------------------------------
  describe('Customer import followed by car import in dependency order', () => {
    it('should import customers first, then cars, respecting dependency chain', async () => {
      // --- Phase 1: Import customers ---
      // createRun
      mockQueryOne.mockResolvedValueOnce({ id: 'run-cust-1' } as any);
      // updateRun (total_rows)
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Row 1: INSERT customer ACME
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Row 2: INSERT customer BETA
      mockDbQuery.mockResolvedValueOnce([] as any);
      // updateRun (final)
      mockDbQuery.mockResolvedValueOnce([] as any);

      const customerResult = await importCustomers(CUSTOMER_CSV, 'user-migration');

      expect(customerResult.entity_type).toBe('customer');
      expect(customerResult.total_rows).toBe(2);
      expect(customerResult.imported).toBe(2);
      expect(customerResult.errors).toBe(0);

      // --- Phase 2: Import cars (customers now exist) ---
      // createRun
      mockQueryOne.mockResolvedValueOnce({ id: 'run-car-1' } as any);
      // updateRun (total_rows)
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Row 1: INSERT car UTLX123456
      mockDbQuery.mockResolvedValueOnce([] as any);
      // Row 2: INSERT car UTLX789012
      mockDbQuery.mockResolvedValueOnce([] as any);
      // updateRun (final)
      mockDbQuery.mockResolvedValueOnce([] as any);

      const carResult = await importCars(CAR_CSV, 'user-migration');

      expect(carResult.entity_type).toBe('car');
      expect(carResult.total_rows).toBe(2);
      expect(carResult.imported).toBe(2);
      expect(carResult.errors).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Contract import with FK validation (customer must exist)
  // --------------------------------------------------------------------------
  describe('Contract import validates foreign key references to customers', () => {
    it('should skip contracts where the referenced customer does not exist', async () => {
      // createRun
      mockQueryOne.mockResolvedValueOnce({ id: 'run-ctr-1' } as any);
      // updateRun (total_rows)
      mockDbQuery.mockResolvedValueOnce([] as any);

      // Row 1: CTR-001 references ACME -- customer lookup succeeds
      mockQueryOne.mockResolvedValueOnce({ id: 'cust-acme' } as any);
      // Check if contract already exists
      mockQueryOne.mockResolvedValueOnce(null);
      // INSERT contract CTR-001
      mockDbQuery.mockResolvedValueOnce([] as any);

      // Row 2: CTR-002 references BETA -- customer lookup fails (not found)
      mockQueryOne.mockResolvedValueOnce(null);
      // recordRowError
      mockDbQuery.mockResolvedValueOnce([] as any);

      // updateRun (final)
      mockDbQuery.mockResolvedValueOnce([] as any);

      const result = await importContracts(CONTRACT_CSV, 'user-migration');

      expect(result.entity_type).toBe('contract');
      expect(result.total_rows).toBe(2);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.error_details[0].error_type).toBe('fk_missing');
      expect(result.error_details[0].error_message).toContain('BETA');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Orchestration run processes entities in dependency order
  // --------------------------------------------------------------------------
  describe('Orchestration run processes entities in dependency order', () => {
    it('should import customers before contracts when both are provided', async () => {
      const importOrder: string[] = [];

      // We track which entity is being created by intercepting createRun calls
      mockQueryOne.mockImplementation(async (sql: string, params?: any[]) => {
        // createRun calls: INSERT INTO migration_runs ... RETURNING id
        if (typeof sql === 'string' && sql.includes('migration_runs') && sql.includes('INSERT')) {
          const entityType = params?.[0];
          importOrder.push(entityType);
          return { id: `run-${entityType}-1` };
        }
        // customer FK lookup for contracts
        if (typeof sql === 'string' && sql.includes('customers WHERE customer_code')) {
          return { id: 'cust-found' };
        }
        // contract existence check
        if (typeof sql === 'string' && sql.includes('master_leases WHERE lease_number')) {
          return null;
        }
        return null;
      });

      // All other DB calls succeed
      mockDbQuery.mockResolvedValue([] as any);

      const fileMap = {
        customer: CUSTOMER_CSV,
        contract: CONTRACT_CSV,
      };

      const results = await runOrchestration(fileMap, 'user-migration');

      expect(results).toHaveLength(2);
      // Customers must be imported before contracts
      expect(importOrder[0]).toBe('customer');
      expect(importOrder[1]).toBe('contract');
      expect(results[0].entity_type).toBe('customer');
      expect(results[1].entity_type).toBe('contract');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Rollback of a completed migration run
  // --------------------------------------------------------------------------
  describe('Rollback of a migration run deletes imported records', () => {
    it('should rollback a completed car migration run and report deleted count', async () => {
      const completedRun = {
        id: 'run-car-1',
        entity_type: 'car',
        source_file: null,
        status: 'complete',
        total_rows: 50,
        valid_rows: 48,
        imported_rows: 48,
        skipped_rows: 0,
        error_rows: 2,
        errors: [],
        warnings: [],
        started_at: '2026-03-01T10:00:00Z',
        completed_at: '2026-03-01T10:05:00Z',
        created_at: '2026-03-01T10:00:00Z',
      };

      // Fetch the migration run
      mockQueryOne.mockResolvedValueOnce(completedRun as any);
      // DELETE FROM cars WHERE created_at in time window
      mockQueryOne.mockResolvedValueOnce({ count: '48' } as any);
      // updateRun (set status to failed with rollback note)
      mockDbQuery.mockResolvedValueOnce([] as any);

      const result = await rollbackRun('run-car-1', 'admin-rollback');

      expect(result.success).toBe(true);
      expect(result.deleted_count).toBe(48);
    });

    it('should fail to rollback a run that has no timestamps', async () => {
      const incompleteRun = {
        id: 'run-incomplete',
        entity_type: 'car',
        status: 'importing',
        started_at: null,
        completed_at: null,
        errors: [],
      };

      mockQueryOne.mockResolvedValueOnce(incompleteRun as any);

      const result = await rollbackRun('run-incomplete', 'admin-rollback');

      expect(result.success).toBe(false);
      expect(result.deleted_count).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Reconciliation summary after import
  // --------------------------------------------------------------------------
  describe('Reconciliation summary reflects migration counts', () => {
    it('should return per-entity record counts and last migration dates', async () => {
      // The function loops through 8 entity types, each with 2 queries
      const entities = ['car', 'customer', 'contract', 'shopping', 'qualification', 'invoice', 'allocation', 'mileage'];

      for (const entity of entities) {
        // COUNT query for each entity's table
        mockQueryOne.mockResolvedValueOnce({ count: '100' } as any);
        // Last migration run query
        if (entity === 'car') {
          mockQueryOne.mockResolvedValueOnce({
            imported_rows: 95,
            created_at: '2026-03-01T10:00:00Z',
          } as any);
        } else if (entity === 'customer') {
          mockQueryOne.mockResolvedValueOnce({
            imported_rows: 50,
            created_at: '2026-03-01T09:00:00Z',
          } as any);
        } else {
          mockQueryOne.mockResolvedValueOnce(null);
        }
      }

      const summary = await getReconciliationSummary();

      expect(summary).toHaveLength(8);

      const carEntry = summary.find(e => e.entity === 'car');
      expect(carEntry).toBeDefined();
      expect(carEntry!.railsync_count).toBe(100);
      expect(carEntry!.last_migration_count).toBe(95);
      expect(carEntry!.last_migration_date).toBe('2026-03-01T10:00:00Z');

      const customerEntry = summary.find(e => e.entity === 'customer');
      expect(customerEntry).toBeDefined();
      expect(customerEntry!.railsync_count).toBe(100);
      expect(customerEntry!.last_migration_count).toBe(50);

      // Entities with no prior migration should have null date
      const shoppingEntry = summary.find(e => e.entity === 'shopping');
      expect(shoppingEntry!.last_migration_date).toBeNull();
      expect(shoppingEntry!.last_migration_count).toBe(0);
    });
  });
});
