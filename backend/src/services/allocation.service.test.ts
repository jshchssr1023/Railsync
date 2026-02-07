import * as allocationService from './allocation.service';
import { query, queryOne, transaction } from '../config/database';
import { PoolClient } from 'pg';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;

describe('Allocation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAllocation', () => {
    it('should create a planned allocation successfully', async () => {
      const mockClient = {
        query: jest.fn(),
      } as unknown as PoolClient;

      // Setup transaction mock to execute the callback
      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient);
      });

      // Mock capacity insert
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Mock allocation insert
      const mockAllocation = {
        id: 'test-id',
        car_mark_number: 'CAR001',
        shop_code: 'BNSF001',
        target_month: '2026-02',
        status: 'planned',
        version: 1,
      };
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [mockAllocation] });

      const result = await allocationService.createAllocation({
        car_mark_number: 'CAR001',
        shop_code: 'BNSF001',
        target_month: '2026-02',
        status: 'planned',
      });

      expect(result).toEqual(mockAllocation);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    it('should check capacity when confirming and allow if space available', async () => {
      const mockClient = {
        query: jest.fn(),
      } as unknown as PoolClient;

      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient);
      });

      // Mock capacity insert
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Mock capacity check with available space
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          shop_code: 'BNSF001',
          month: '2026-02',
          total_capacity: 50,
          confirmed_railcars: 40,
          remaining_capacity: 10,
        }],
      });

      // Mock allocation insert
      const mockAllocation = {
        id: 'test-id',
        car_mark_number: 'CAR001',
        shop_code: 'BNSF001',
        target_month: '2026-02',
        status: 'confirmed',
        version: 1,
      };
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [mockAllocation] });

      const result = await allocationService.createAllocation({
        car_mark_number: 'CAR001',
        shop_code: 'BNSF001',
        target_month: '2026-02',
        status: 'confirmed',
      });

      expect(result.status).toBe('confirmed');
    });

    it('should reject confirmation when at capacity and over 10% overcommit', async () => {
      const mockClient = {
        query: jest.fn(),
      } as unknown as PoolClient;

      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient);
      });

      // Mock capacity insert
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Mock capacity check - at capacity with max overcommit reached
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          shop_code: 'BNSF001',
          month: '2026-02',
          total_capacity: 50,
          confirmed_railcars: 55, // 5 over, which is exactly 10%
          planned_railcars: 0,
          remaining_capacity: 0,
        }],
      });

      await expect(allocationService.createAllocation({
        car_mark_number: 'CAR001',
        shop_code: 'BNSF001',
        target_month: '2026-02',
        status: 'confirmed',
      })).rejects.toThrow('is at capacity');
    });

    it('should allow 10% overcommit when confirming', async () => {
      const mockClient = {
        query: jest.fn(),
      } as unknown as PoolClient;

      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient);
      });

      // Mock capacity insert
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Mock capacity check - at capacity but under 10% overcommit
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          shop_code: 'BNSF001',
          month: '2026-02',
          total_capacity: 50,
          confirmed_railcars: 52, // 2 over, which is 4% (under 10%)
          remaining_capacity: 0,
        }],
      });

      // Mock allocation insert
      const mockAllocation = {
        id: 'test-id',
        status: 'confirmed',
        version: 1,
      };
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [mockAllocation] });

      const result = await allocationService.createAllocation({
        car_mark_number: 'CAR001',
        shop_code: 'BNSF001',
        target_month: '2026-02',
        status: 'confirmed',
      });

      expect(result.status).toBe('confirmed');
    });
  });

  describe('updateAllocationStatus', () => {
    it('should update status with correct version', async () => {
      const mockClient = {
        query: jest.fn(),
      } as unknown as PoolClient;

      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient);
      });

      // Mock current allocation
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'test-id',
          status: 'planned',
          version: 1,
          shop_code: 'BNSF001',
          target_month: '2026-02',
        }],
      });

      // Mock update
      const updatedAllocation = {
        id: 'test-id',
        status: 'cancelled',
        version: 2,
      };
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [updatedAllocation] });

      const result = await allocationService.updateAllocationStatus('test-id', 'cancelled', 1);

      expect(result?.status).toBe('cancelled');
      expect(result?.version).toBe(2);
    });

    it('should reject update with stale version (optimistic lock)', async () => {
      const mockClient = {
        query: jest.fn(),
      } as unknown as PoolClient;

      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient);
      });

      // Mock current allocation with newer version
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'test-id',
          status: 'planned',
          version: 2, // Current version is 2
        }],
      });

      // Try to update with old version 1
      await expect(
        allocationService.updateAllocationStatus('test-id', 'cancelled', 1)
      ).rejects.toThrow('modified by another user');
    });

    it('should return null for non-existent allocation', async () => {
      const mockClient = {
        query: jest.fn(),
      } as unknown as PoolClient;

      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient);
      });

      // Mock no allocation found
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await allocationService.updateAllocationStatus('non-existent', 'cancelled', 1);

      expect(result).toBeNull();
    });
  });

  describe('getShopMonthlyCapacity', () => {
    it('should return capacity for existing shop-month', async () => {
      // Mock ensure exists
      mockQuery.mockResolvedValueOnce([]);

      // Mock get capacity
      const mockCapacity = {
        id: 'cap-id',
        shop_code: 'BNSF001',
        month: '2026-02',
        total_capacity: 50,
        confirmed_railcars: 10,
        planned_railcars: 5,
      };
      mockQueryOne.mockResolvedValueOnce(mockCapacity);

      const result = await allocationService.getShopMonthlyCapacity('BNSF001', '2026-02');

      expect(result).toEqual(mockCapacity);
    });
  });

  describe('listAllocations', () => {
    it('should return filtered allocations', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '2' });
      mockQuery.mockResolvedValueOnce([
        { id: '1', car_mark_number: 'CAR001', status: 'planned' },
        { id: '2', car_id: 'CAR002', status: 'planned' },
      ]);

      const result = await allocationService.listAllocations({
        status: 'planned',
        limit: 10,
      });

      expect(result.total).toBe(2);
      expect(result.allocations).toHaveLength(2);
    });

    it('should return empty array when no allocations match', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '0' });
      mockQuery.mockResolvedValueOnce([]);

      const result = await allocationService.listAllocations({
        shop_code: 'NON_EXISTENT',
      });

      expect(result.total).toBe(0);
      expect(result.allocations).toHaveLength(0);
    });
  });
});
