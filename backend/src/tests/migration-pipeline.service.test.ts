/**
 * Migration Pipeline Service Tests
 *
 * Tests CSV parsing, validation of required fields, dry-run mode,
 * rollback functionality, and orchestrated import order.
 */

import {
  importCars,
  importCustomers,
  importContracts,
  importShoppingEvents,
  validateOnly,
  rollbackRun,
  runOrchestration,
} from '../services/migration-pipeline.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
}));

import { query, queryOne } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

// ==============================================================================
// Test Helpers
// ==============================================================================

function mockCreateRun(runId: string = 'run-1') {
  mockQueryOne.mockResolvedValueOnce({ id: runId } as any);
}

function mockUpdateRun() {
  mockQuery.mockResolvedValueOnce([] as any);
}

function mockRecordRowError() {
  mockQuery.mockResolvedValueOnce([] as any);
}

function mockUpsertSuccess() {
  mockQuery.mockResolvedValueOnce([] as any);
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Migration Pipeline Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // CSV Parsing: Cars
  // ============================================================================
  describe('importCars - CSV Parsing', () => {
    it('should parse valid car CSV and import successfully', async () => {
      const csv = `car_number,car_mark,car_type,lessee_name\nUTLX123456,UTLX,Tank,EXXON\nGATX789012,GATX,Hopper,SHELL`;

      mockCreateRun('run-cars');
      mockUpdateRun(); // status: importing
      mockUpsertSuccess(); // car 1
      mockUpsertSuccess(); // car 2
      mockUpdateRun(); // status: complete

      const result = await importCars(csv, 'user-1');

      expect(result.entity_type).toBe('car');
      expect(result.total_rows).toBe(2);
      expect(result.imported).toBe(2);
      expect(result.errors).toBe(0);
    });

    it('should handle alternative column names (car_no)', async () => {
      const csv = `car_no,mark,type\nUTLX111111,UTLX,Tank`;

      mockCreateRun('run-alt');
      mockUpdateRun();
      mockUpsertSuccess();
      mockUpdateRun();

      const result = await importCars(csv);

      expect(result.total_rows).toBe(1);
      expect(result.imported).toBe(1);
    });

    it('should report error when car_number is missing', async () => {
      const csv = `car_mark,car_type\nUTLX,Tank`;

      mockCreateRun('run-err');
      mockUpdateRun();
      mockRecordRowError(); // records the missing field error
      mockUpdateRun();

      const result = await importCars(csv);

      expect(result.total_rows).toBe(1);
      expect(result.imported).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.error_details[0].error_type).toBe('missing_required');
      expect(result.error_details[0].field_name).toBe('car_number');
    });
  });

  // ============================================================================
  // CSV Parsing: Customers
  // ============================================================================
  describe('importCustomers - CSV Parsing', () => {
    it('should parse valid customer CSV and import successfully', async () => {
      const csv = `customer_code,customer_name,billing_city\nCUST001,Acme Corp,Houston\nCUST002,Beta LLC,Dallas`;

      mockCreateRun('run-cust');
      mockUpdateRun();
      mockUpsertSuccess(); // customer 1
      mockUpsertSuccess(); // customer 2
      mockUpdateRun();

      const result = await importCustomers(csv);

      expect(result.entity_type).toBe('customer');
      expect(result.total_rows).toBe(2);
      expect(result.imported).toBe(2);
    });

    it('should report error when customer_code is missing', async () => {
      const csv = `customer_name\nAcme Corp`;

      mockCreateRun('run-cust-err');
      mockUpdateRun();
      mockRecordRowError();
      mockUpdateRun();

      const result = await importCustomers(csv);

      expect(result.errors).toBe(1);
      expect(result.error_details[0].field_name).toBe('customer_code');
    });

    it('should report error when customer_name is missing', async () => {
      const csv = `customer_code\nCUST001`;

      mockCreateRun('run-cust-name');
      mockUpdateRun();
      mockRecordRowError();
      mockUpdateRun();

      const result = await importCustomers(csv);

      expect(result.errors).toBe(1);
      expect(result.error_details[0].field_name).toBe('customer_name');
    });
  });

  // ============================================================================
  // CSV Parsing: Contracts
  // ============================================================================
  describe('importContracts - CSV Parsing', () => {
    it('should report error when contract_number is missing', async () => {
      const csv = `customer_code\nCUST001`;

      mockCreateRun('run-con-err');
      mockUpdateRun();
      mockRecordRowError();
      mockUpdateRun();

      const result = await importContracts(csv);

      expect(result.errors).toBe(1);
      expect(result.error_details[0].field_name).toBe('contract_number');
    });

    it('should report FK error when customer_code not found', async () => {
      const csv = `contract_number,customer_code\nCON-001,MISSING_CUST`;

      mockCreateRun('run-con-fk');
      mockUpdateRun();
      // Customer lookup fails
      mockQueryOne.mockResolvedValueOnce(null);
      mockRecordRowError();
      mockUpdateRun();

      const result = await importContracts(csv);

      expect(result.errors).toBe(1);
      expect(result.error_details[0].error_type).toBe('fk_missing');
      expect(result.error_details[0].error_message).toContain('MISSING_CUST');
    });
  });

  // ============================================================================
  // CSV Parsing: Shopping Events
  // ============================================================================
  describe('importShoppingEvents - CSV Parsing', () => {
    it('should report error when car_number is missing', async () => {
      const csv = `event_type,state\nqualification,Closed`;

      mockCreateRun('run-shop-err');
      mockUpdateRun();
      // No recordRowError needed here because the simple error path
      // in importShoppingEvents does not call recordRowError for missing car_number
      mockUpdateRun();

      const result = await importShoppingEvents(csv);

      expect(result.errors).toBe(1);
    });

    it('should report FK error when referenced car does not exist', async () => {
      const csv = `car_number,event_type\nMISSING_CAR,qualification`;

      mockCreateRun('run-shop-fk');
      mockUpdateRun();
      // Car lookup fails
      mockQueryOne.mockResolvedValueOnce(null);
      mockRecordRowError();
      mockUpdateRun();

      const result = await importShoppingEvents(csv);

      expect(result.errors).toBe(1);
      expect(result.error_details[0].error_type).toBe('fk_missing');
    });
  });

  // ============================================================================
  // Dry-Run / Validate-Only Mode
  // ============================================================================
  describe('validateOnly - Dry Run', () => {
    it('should return validation stats for cars without modifying data', async () => {
      const csv = `car_number,car_mark\nUTLX123456,UTLX\n,GATX`;

      const result = await validateOnly('car', csv);

      expect(result.total_rows).toBe(2);
      expect(result.valid_rows).toBe(1);
      expect(result.error_rows).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error_type).toBe('missing_required');
      // No DB writes should have been attempted
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should return validation stats for customers without modifying data', async () => {
      const csv = `customer_code,customer_name\nCUST001,Acme\n,Missing Name`;

      const result = await validateOnly('customer', csv);

      expect(result.total_rows).toBe(2);
      expect(result.valid_rows).toBe(1);
      expect(result.error_rows).toBe(1);
    });

    it('should return validation stats for invoices checking all required fields', async () => {
      const csv = `invoice_number,invoice_date,invoice_total\nINV-001,2026-01-15,1000\nINV-002,,500\n,,`;

      const result = await validateOnly('invoice', csv);

      expect(result.total_rows).toBe(3);
      // Row 1: valid, Row 2: missing date, Row 3: missing all three
      expect(result.error_rows).toBe(2);
    });

    it('should return unsupported entity type error', async () => {
      const csv = `col1\nval1`;

      const result = await validateOnly('unknown_entity', csv);

      expect(result.error_rows).toBe(1);
      expect(result.errors[0].error_type).toBe('unsupported');
    });
  });

  // ============================================================================
  // Rollback
  // ============================================================================
  describe('rollbackRun', () => {
    it('should delete records within the run time window and mark as failed', async () => {
      // Get run details
      mockQueryOne.mockResolvedValueOnce({
        id: 'run-1',
        entity_type: 'car',
        started_at: '2026-01-15T10:00:00Z',
        completed_at: '2026-01-15T10:05:00Z',
        errors: [],
      } as any);

      // Delete query returns count
      mockQueryOne.mockResolvedValueOnce({ count: '15' } as any);

      // Update run status
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await rollbackRun('run-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.deleted_count).toBe(15);
    });

    it('should return failure when run is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await rollbackRun('nonexistent');

      expect(result.success).toBe(false);
      expect(result.deleted_count).toBe(0);
    });

    it('should return failure when run has no started_at or completed_at', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'run-incomplete',
        entity_type: 'car',
        started_at: null,
        completed_at: null,
        errors: [],
      } as any);

      const result = await rollbackRun('run-incomplete');

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Orchestrated Load
  // ============================================================================
  describe('runOrchestration', () => {
    it('should import entities in dependency order', async () => {
      // We provide only customer and car CSVs
      const fileMap = {
        customer: `customer_code,customer_name\nCUST001,Acme`,
        car: `car_number,car_mark\nUTLX123456,UTLX`,
      };

      // Customer import mocks
      mockCreateRun('run-cust-orch');
      mockUpdateRun();
      mockUpsertSuccess(); // customer insert
      mockUpdateRun();

      // Car import mocks
      mockCreateRun('run-car-orch');
      mockUpdateRun();
      mockUpsertSuccess(); // car insert
      mockUpdateRun();

      const results = await runOrchestration(fileMap, 'user-1');

      expect(results).toHaveLength(2);
      expect(results[0].entity_type).toBe('customer');
      expect(results[1].entity_type).toBe('car');
      // Verify customer was loaded before car (order matters)
      expect(results[0].run_id).toBe('run-cust-orch');
      expect(results[1].run_id).toBe('run-car-orch');
    });

    it('should skip entity types not provided in fileMap', async () => {
      const fileMap = {
        car: `car_number\nUTLX123456`,
      };

      mockCreateRun('run-car-only');
      mockUpdateRun();
      mockUpsertSuccess();
      mockUpdateRun();

      const results = await runOrchestration(fileMap);

      expect(results).toHaveLength(1);
      expect(results[0].entity_type).toBe('car');
    });
  });

  // ============================================================================
  // Import: DB failure handling
  // ============================================================================
  describe('importCars - DB Failure', () => {
    it('should record error when DB insert fails', async () => {
      const csv = `car_number,car_mark\nUTLX123456,UTLX`;

      mockCreateRun('run-db-fail');
      mockUpdateRun();
      // Simulate DB failure
      mockQuery.mockRejectedValueOnce(new Error('unique constraint violation'));
      mockRecordRowError();
      mockUpdateRun();

      const result = await importCars(csv);

      expect(result.imported).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.error_details[0].error_type).toBe('insert_failed');
      expect(result.error_details[0].error_message).toContain('unique constraint violation');
    });
  });
});
