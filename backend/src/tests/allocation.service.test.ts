/**
 * Allocation Service Tests
 *
 * Tests allocation CRUD, status transitions, capacity checks,
 * optimistic locking, revert logic, and list filtering.
 */

import {
  createAllocation,
  updateAllocationStatus,
  getShopMonthlyCapacity,
  listAllocations,
  getAllocationById,
  revertLastTransition,
  deleteAllocation,
} from '../services/allocation.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  pool: { query: jest.fn(), connect: jest.fn() },
}));

// Mock dependent services
jest.mock('../services/assignment.service', () => ({
  getActiveAssignment: jest.fn().mockResolvedValue(null),
  createAssignment: jest.fn().mockResolvedValue({ id: 'assign-1' }),
}));

jest.mock('../services/capacity-events.service', () => ({
  capacityEvents: {
    emitAllocationCreated: jest.fn(),
    emitAllocationUpdated: jest.fn(),
    emitAllocationDeleted: jest.fn(),
  },
}));

jest.mock('../services/assetEvent.service', () => ({
  recordEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/transition-log.service', () => ({
  logTransition: jest.fn().mockResolvedValue({ id: 'log-1' }),
  canRevert: jest.fn(),
  markReverted: jest.fn().mockResolvedValue(undefined),
  getLastTransition: jest.fn(),
}));

import { query, queryOne, transaction, pool } from '../config/database';
import { canRevert, getLastTransition } from '../services/transition-log.service';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;
const mockPoolQuery = (pool as any).query as jest.MockedFunction<any>;
const mockCanRevert = canRevert as jest.MockedFunction<typeof canRevert>;
const mockGetLastTransition = getLastTransition as jest.MockedFunction<typeof getLastTransition>;

// ==============================================================================
// Test Helpers
// ==============================================================================

function createMockAllocation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alloc-1',
    plan_id: null,
    car_id: 'car-1',
    car_mark_number: 'UTLX',
    car_number: 'UTLX123456',
    shop_code: 'SHOP001',
    target_month: '2026-03',
    status: 'planned',
    estimated_cost: 5000,
    actual_cost: null,
    version: 1,
    notes: null,
    created_by: 'user-1',
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

function createMockCapacity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cap-1',
    shop_code: 'SHOP001',
    month: '2026-03',
    total_capacity: 20,
    confirmed_railcars: 10,
    planned_railcars: 5,
    remaining_capacity: 5,
    utilization_pct: 75,
    is_at_risk: false,
    version: 1,
    ...overrides,
  };
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Allocation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Create Allocation (via transaction)
  // ============================================================================
  describe('createAllocation', () => {
    it('should create a planned allocation through transaction', async () => {
      const mockAlloc = createMockAllocation();

      // transaction mock: execute the callback directly with a mock client
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // INSERT shop_monthly_capacity
            .mockResolvedValueOnce({ rows: [mockAlloc] }), // INSERT allocation RETURNING *
        };
        return callback(mockClient);
      });

      const result = await createAllocation({
        car_mark_number: 'UTLX',
        car_number: 'UTLX123456',
        shop_code: 'SHOP001',
        target_month: '2026-03',
        status: 'planned',
        estimated_cost: 5000,
        created_by: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('planned');
      expect(result.shop_code).toBe('SHOP001');
    });

    it('should check capacity when confirming and throw on capacity exceeded', async () => {
      const fullCapacity = createMockCapacity({
        remaining_capacity: 0,
        total_capacity: 10,
        confirmed_railcars: 9,
        planned_railcars: 2,
      });

      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // INSERT capacity
            .mockResolvedValueOnce({ rows: [fullCapacity] }), // SELECT capacity FOR UPDATE
        };
        return callback(mockClient);
      });

      await expect(
        createAllocation({
          car_mark_number: 'UTLX',
          car_number: 'UTLX123456',
          shop_code: 'SHOP001',
          target_month: '2026-03',
          status: 'confirmed',
          created_by: 'user-1',
        })
      ).rejects.toThrow(/at capacity/);
    });
  });

  // ============================================================================
  // Update Allocation Status (Optimistic Locking)
  // ============================================================================
  describe('updateAllocationStatus', () => {
    it('should update status with correct version', async () => {
      const current = createMockAllocation({ version: 1, status: 'planned' });
      const updated = createMockAllocation({ version: 2, status: 'confirmed' });

      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [current] }) // SELECT FOR UPDATE
            .mockResolvedValueOnce({ rows: [] }) // INSERT capacity
            .mockResolvedValueOnce({ rows: [createMockCapacity({ remaining_capacity: 5 })] }) // SELECT capacity FOR UPDATE
            .mockResolvedValueOnce({ rows: [updated] }), // UPDATE RETURNING *
        };
        return callback(mockClient);
      });

      const result = await updateAllocationStatus('alloc-1', 'confirmed', 1);

      expect(result).toBeDefined();
      expect(result!.status).toBe('confirmed');
    });

    it('should throw on version mismatch (optimistic locking)', async () => {
      const current = createMockAllocation({ version: 3, status: 'planned' });

      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [current] }), // SELECT FOR UPDATE - version 3
        };
        return callback(mockClient);
      });

      await expect(
        updateAllocationStatus('alloc-1', 'confirmed', 1) // expect version 1, actual is 3
      ).rejects.toThrow(/modified by another user/);
    });

    it('should return null when allocation not found', async () => {
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }), // SELECT FOR UPDATE returns nothing
        };
        return callback(mockClient);
      });

      const result = await updateAllocationStatus('nonexistent', 'confirmed', 1);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Get Shop Monthly Capacity
  // ============================================================================
  describe('getShopMonthlyCapacity', () => {
    it('should return capacity for a shop and month', async () => {
      const capacity = createMockCapacity();

      // INSERT ON CONFLICT DO NOTHING
      mockQuery.mockResolvedValueOnce([] as any);
      // SELECT capacity
      mockQueryOne.mockResolvedValueOnce(capacity as any);

      const result = await getShopMonthlyCapacity('SHOP001', '2026-03');

      expect(result).toBeDefined();
      expect(result!.shop_code).toBe('SHOP001');
      expect(result!.remaining_capacity).toBe(5);
    });
  });

  // ============================================================================
  // List Allocations with Filters
  // ============================================================================
  describe('listAllocations', () => {
    it('should return filtered and paginated allocations', async () => {
      // COUNT query
      mockQueryOne.mockResolvedValueOnce({ count: '15' } as any);
      // SELECT allocations
      mockQuery.mockResolvedValueOnce([
        createMockAllocation({ id: 'alloc-1' }),
        createMockAllocation({ id: 'alloc-2' }),
      ] as any);

      const result = await listAllocations({ shop_code: 'SHOP001', limit: 10, offset: 0 });

      expect(result.total).toBe(15);
      expect(result.allocations).toHaveLength(2);
    });

    it('should return empty results when no allocations match', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await listAllocations({ status: 'cancelled' });

      expect(result.total).toBe(0);
      expect(result.allocations).toHaveLength(0);
    });
  });

  // ============================================================================
  // Get Allocation by ID
  // ============================================================================
  describe('getAllocationById', () => {
    it('should return allocation when found', async () => {
      mockQueryOne.mockResolvedValueOnce(createMockAllocation() as any);

      const result = await getAllocationById('alloc-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('alloc-1');
    });

    it('should return null when not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getAllocationById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Revert Last Transition
  // ============================================================================
  describe('revertLastTransition', () => {
    it('should revert when the last transition is reversible', async () => {
      mockCanRevert.mockResolvedValueOnce({
        allowed: true,
        previousState: 'planned',
        transitionId: 'trans-1',
        blockers: [],
      });
      mockGetLastTransition.mockResolvedValueOnce({
        id: 'trans-1',
        from_state: 'planned',
        to_state: 'confirmed',
        is_reversible: true,
      } as any);

      // pool.query for UPDATE allocations
      mockPoolQuery.mockResolvedValueOnce({
        rows: [createMockAllocation({ status: 'planned', version: 3 })],
      });

      const result = await revertLastTransition('alloc-1', 'user-1', 'Reverting for correction');

      expect(result).toBeDefined();
      expect(result.status).toBe('planned');
    });

    it('should throw when revert is not allowed', async () => {
      mockCanRevert.mockResolvedValueOnce({
        allowed: false,
        blockers: ['Allocation has moved to a different state'],
      });

      await expect(
        revertLastTransition('alloc-1', 'user-1')
      ).rejects.toThrow(/Cannot revert/);
    });

    it('should throw when no transition to revert', async () => {
      mockCanRevert.mockResolvedValueOnce({
        allowed: true,
        previousState: 'planned',
        blockers: [],
      });
      mockGetLastTransition.mockResolvedValueOnce(null);

      await expect(
        revertLastTransition('alloc-1', 'user-1')
      ).rejects.toThrow('No transition to revert');
    });
  });

  // ============================================================================
  // Delete Allocation
  // ============================================================================
  describe('deleteAllocation', () => {
    it('should delete allocation and emit event', async () => {
      // queryOne to get allocation before delete
      mockQueryOne.mockResolvedValueOnce(createMockAllocation() as any);
      // query for DELETE
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await deleteAllocation('alloc-1');

      expect(result).toBe(true);
    });
  });
});
