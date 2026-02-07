/**
 * Demand Service Tests
 *
 * Tests demand CRUD operations, status transitions, and filtering
 */

import {
  listDemands,
  getDemandById,
  createDemand,
  updateDemand,
  updateDemandStatus,
  deleteDemand,
  getDemandSummaryByMonth,
  revertLastTransition,
} from '../services/demand.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  pool: { query: jest.fn() },
}));

// Mock the transition-log service
jest.mock('../services/transition-log.service', () => ({
  logTransition: jest.fn().mockResolvedValue({ id: 'log-1' }),
  canRevert: jest.fn(),
  markReverted: jest.fn(),
  getLastTransition: jest.fn(),
}));

import { query, queryOne } from '../config/database';
import { pool } from '../config/database';
import { canRevert, getLastTransition } from '../services/transition-log.service';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockPoolQuery = pool.query as jest.Mock;
const mockCanRevert = canRevert as jest.MockedFunction<typeof canRevert>;
const mockGetLastTransition = getLastTransition as jest.MockedFunction<typeof getLastTransition>;

describe('Demand Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // List Demands
  // ============================================================================
  describe('listDemands', () => {
    it('should list demands with filters and pagination', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '15' } as any);
      mockQuery.mockResolvedValueOnce([
        { id: 'd1', name: 'Demand 1', fiscal_year: 2026, status: 'Forecast' },
        { id: 'd2', name: 'Demand 2', fiscal_year: 2026, status: 'Forecast' },
      ] as any);

      const result = await listDemands({ fiscal_year: 2026, status: 'Forecast', limit: 10, offset: 0 });

      expect(result.total).toBe(15);
      expect(result.demands).toHaveLength(2);
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should handle filters for plan_id', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '5' } as any);
      mockQuery.mockResolvedValueOnce([
        { id: 'd1', name: 'Demand 1', plan_id: 'plan-1' },
      ] as any);

      const result = await listDemands({ plan_id: 'plan-1', limit: 50, offset: 0 });

      expect(result.total).toBe(5);
      expect(result.demands).toHaveLength(1);
    });
  });

  // ============================================================================
  // Get Demand By ID
  // ============================================================================
  describe('getDemandById', () => {
    it('should return demand when found', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'd1',
        name: 'Test Demand',
        status: 'Forecast',
      } as any);

      const result = await getDemandById('d1');

      expect(result).toBeDefined();
      expect(result!.name).toBe('Test Demand');
    });

    it('should return null when demand not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getDemandById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Create Demand
  // ============================================================================
  describe('createDemand', () => {
    it('should create a new demand', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'new-demand',
          name: 'Q1 Qualifications',
          fiscal_year: 2026,
          target_month: '2026-01',
          car_count: 100,
          event_type: 'Qualification',
          status: 'Forecast',
        },
      ] as any);

      const result = await createDemand(
        {
          name: 'Q1 Qualifications',
          fiscal_year: 2026,
          target_month: '2026-01',
          car_count: 100,
          event_type: 'Qualification',
          priority: 'High',
        },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Q1 Qualifications');
      expect(result.event_type).toBe('Q');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Update Demand Status
  // ============================================================================
  describe('updateDemandStatus', () => {
    it('should update demand status and log transition', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 'd1', status: 'Forecast' } as any);
      mockQuery.mockResolvedValueOnce([
        { id: 'd1', name: 'Demand 1', status: 'Complete' },
      ] as any);

      const result = await updateDemandStatus('d1', 'Complete', 'user-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('Complete');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE demands'),
        ['d1', 'Complete']
      );
    });

    it('should return null when demand not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await updateDemandStatus('nonexistent', 'Complete');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Delete Demand
  // ============================================================================
  describe('deleteDemand', () => {
    it('should delete a demand', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await deleteDemand('d1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM demands WHERE id = $1', ['d1']);
    });
  });

  // ============================================================================
  // Get Demand Summary By Month
  // ============================================================================
  describe('getDemandSummaryByMonth', () => {
    it('should return demand summary grouped by month', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          target_month: '2026-01',
          total_cars: '150',
          by_type: [
            { event_type: 'Qualification', car_count: 100 },
            { event_type: 'I', car_count: 50 },
          ],
        },
      ] as any);

      const result = await getDemandSummaryByMonth(2026);

      expect(result).toHaveLength(1);
      expect(result[0].target_month).toBe('2026-01');
      expect(result[0].total_cars).toBe(150);
      expect(result[0].by_type).toHaveLength(2);
    });
  });

  // ============================================================================
  // Revert Last Transition
  // ============================================================================
  describe('revertLastTransition', () => {
    it('should revert the last transition when allowed', async () => {
      mockCanRevert.mockResolvedValueOnce({ allowed: true, blockers: [] });
      mockGetLastTransition.mockResolvedValueOnce({
        id: 'trans-1',
        from_state: 'Active',
        to_state: 'Complete',
      } as any);
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 'd1', name: 'Demand 1', status: 'Forecast' }],
      } as any);

      const result = await revertLastTransition('d1', 'user-1', 'Reverting to active');

      expect(result).toBeDefined();
      expect(result.status).toBe('Active');
      expect(mockCanRevert).toHaveBeenCalledWith('demand', 'd1');
    });

    it('should throw when revert is not allowed', async () => {
      mockCanRevert.mockResolvedValueOnce({
        allowed: false,
        blockers: ['Transition is irreversible'],
      });

      await expect(
        revertLastTransition('d1', 'user-1')
      ).rejects.toThrow('Cannot revert: Transition is irreversible');
    });

    it('should throw when no transition exists', async () => {
      mockCanRevert.mockResolvedValueOnce({ allowed: true, blockers: [] });
      mockGetLastTransition.mockResolvedValueOnce(null);

      await expect(
        revertLastTransition('d1', 'user-1')
      ).rejects.toThrow('No transition to revert');
    });
  });
});
