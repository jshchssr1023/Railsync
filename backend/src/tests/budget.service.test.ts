/**
 * Budget Service Tests
 *
 * Tests running repairs budget, service event budgets, and summary calculations
 */

import {
  getActiveLeasedCarCount,
  getHistoricalServiceEventStats,
  getRunningRepairsBudget,
  updateRunningRepairsBudget,
  calculateRunningRepairsBudget,
  getServiceEventBudgets,
  createServiceEventBudget,
  updateServiceEventBudget,
  deleteServiceEventBudget,
  getBudgetSummary,
} from '../services/budget.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  pool: { query: jest.fn() },
}));

import { query, queryOne } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

describe('Budget Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Get Active Leased Car Count
  // ============================================================================
  describe('getActiveLeasedCarCount', () => {
    it('should return count of actively leased cars from lease hierarchy', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: 4200 } as any);

      const result = await getActiveLeasedCarCount();

      expect(result).toBe(4200);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('rider_cars rc')
      );
    });

    it('should return 0 when no active leased cars', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getActiveLeasedCarCount();

      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // Get Historical Service Event Stats
  // ============================================================================
  describe('getHistoricalServiceEventStats', () => {
    it('should return historical event counts grouped by type', async () => {
      mockQuery.mockResolvedValueOnce([
        { event_type: 'Qualification', event_count: 850, avg_cost: '4500.00' },
        { event_type: 'Assignment', event_count: 320, avg_cost: '12000.00' },
        { event_type: 'Return', event_count: 210, avg_cost: '8000.00' },
      ] as any);

      const result = await getHistoricalServiceEventStats();

      expect(result).toHaveLength(3);
      expect(result[0].event_type).toBe('Qualification');
      expect(result[0].event_count).toBe(850);
      expect(result[0].avg_cost).toBe(4500);
    });

    it('should return empty array when no historical events', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await getHistoricalServiceEventStats();

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // Get Running Repairs Budget
  // ============================================================================
  describe('getRunningRepairsBudget', () => {
    it('should return running repairs budget for fiscal year', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: '1',
          fiscal_year: 2026,
          month: '2026-01',
          cars_on_lease: '5000',
          allocation_per_car: '150',
          monthly_budget: '750000',
          actual_spend: '700000',
          remaining_budget: '50000',
        },
      ] as any);

      const result = await getRunningRepairsBudget(2026);

      expect(result).toHaveLength(1);
      expect(result[0].cars_on_lease).toBe(5000);
      expect(result[0].monthly_budget).toBe(750000);
    });
  });

  // ============================================================================
  // Update Running Repairs Budget
  // ============================================================================
  describe('updateRunningRepairsBudget', () => {
    it('should update budget with lease-derived car count', async () => {
      // Mock getActiveLeasedCarCount
      mockQueryOne.mockResolvedValueOnce({ count: 5000 } as any);
      // Mock existing row lookup (for preserving allocation_per_car)
      mockQueryOne.mockResolvedValueOnce({
        allocation_per_car: '150',
      } as any);
      // Mock the upsert
      mockQuery.mockResolvedValueOnce([
        {
          id: '1',
          fiscal_year: 2026,
          month: '2026-01',
          cars_on_lease: 5000,
          allocation_per_car: 150,
          monthly_budget: 750000,
          actual_spend: 700000,
          remaining_budget: 50000,
        },
      ] as any);

      const result = await updateRunningRepairsBudget(
        2026,
        '2026-01',
        {
          actual_spend: 700000,
        },
        'user-1'
      );

      expect(result).toBeDefined();
      // cars_on_lease should be derived, not from input
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('rider_cars')
      );
    });

    it('should use provided allocation_per_car when specified', async () => {
      // Mock getActiveLeasedCarCount
      mockQueryOne.mockResolvedValueOnce({ count: 4000 } as any);
      // Mock the upsert
      mockQuery.mockResolvedValueOnce([
        {
          id: '1',
          fiscal_year: 2026,
          month: '2026-01',
          cars_on_lease: 4000,
          allocation_per_car: 200,
          monthly_budget: 800000,
          actual_spend: 0,
          remaining_budget: 800000,
        },
      ] as any);

      const result = await updateRunningRepairsBudget(
        2026,
        '2026-01',
        {
          allocation_per_car: 200,
        },
        'user-1'
      );

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // Calculate Running Repairs Budget
  // ============================================================================
  describe('calculateRunningRepairsBudget', () => {
    it('should generate 12 months of budget', async () => {
      // Each month: getActiveLeasedCarCount + upsert
      for (let i = 0; i < 12; i++) {
        mockQueryOne.mockResolvedValueOnce({ count: 5000 } as any);
        mockQuery.mockResolvedValueOnce([
          { fiscal_year: 2026, month: `2026-${String(i + 1).padStart(2, '0')}` },
        ] as any);
      }

      const result = await calculateRunningRepairsBudget(2026, 150, 'user-1');

      expect(result).toHaveLength(12);
    });
  });

  // ============================================================================
  // Get Service Event Budgets
  // ============================================================================
  describe('getServiceEventBudgets', () => {
    it('should return service event budgets for fiscal year', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 's1',
          fiscal_year: 2026,
          event_type: 'Qualification',
          budgeted_car_count: '1000',
          avg_cost_per_car: '5000',
          total_budget: '5000000',
        },
        {
          id: 's2',
          fiscal_year: 2026,
          event_type: 'I',
          budgeted_car_count: '500',
          avg_cost_per_car: '15000',
          total_budget: '7500000',
        },
      ] as any);

      const result = await getServiceEventBudgets(2026);

      expect(result).toHaveLength(2);
      expect(result[0].budgeted_car_count).toBe(1000);
      expect(result[0].total_budget).toBe(5000000);
    });

    it('should filter by event type', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 's1',
          event_type: 'Qualification',
        },
      ] as any);

      const result = await getServiceEventBudgets(2026, 'Qualification');

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('event_type = $2'),
        [2026, 'Qualification']
      );
    });
  });

  // ============================================================================
  // Create Service Event Budget
  // ============================================================================
  describe('createServiceEventBudget', () => {
    it('should create a service event budget', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'new-budget',
          fiscal_year: 2026,
          event_type: 'Qualification',
          budgeted_car_count: 1000,
          avg_cost_per_car: 5000,
          total_budget: 5000000,
        },
      ] as any);

      const result = await createServiceEventBudget(
        {
          fiscal_year: 2026,
          event_type: 'Qualification',
          budgeted_car_count: 1000,
          avg_cost_per_car: 5000,
        },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(result.total_budget).toBe(5000000);
    });
  });

  // ============================================================================
  // Update Service Event Budget
  // ============================================================================
  describe('updateServiceEventBudget', () => {
    it('should update service event budget and recalculate total', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 's1',
        budgeted_car_count: 1000,
        avg_cost_per_car: 5000,
      } as any);
      mockQuery.mockResolvedValueOnce([
        {
          id: 's1',
          budgeted_car_count: 1200,
          avg_cost_per_car: 5000,
          total_budget: 6000000,
        },
      ] as any);

      const result = await updateServiceEventBudget('s1', {
        budgeted_car_count: 1200,
      });

      expect(result).toBeDefined();
      expect(result!.total_budget).toBe(6000000);
    });

    it('should return null when budget not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await updateServiceEventBudget('nonexistent', {
        budgeted_car_count: 1000,
      });

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Delete Service Event Budget
  // ============================================================================
  describe('deleteServiceEventBudget', () => {
    it('should delete a service event budget', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await deleteServiceEventBudget('s1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM service_event_budget WHERE id = $1',
        ['s1']
      );
    });
  });

  // ============================================================================
  // Get Budget Summary
  // ============================================================================
  describe('getBudgetSummary', () => {
    it('should return comprehensive budget summary', async () => {
      // Running repairs
      mockQueryOne.mockResolvedValueOnce({
        total_budget: '9000000',
        total_actual: '8500000',
      } as any);

      // Service events budget
      mockQueryOne.mockResolvedValueOnce({
        total_budget: '12500000',
      } as any);

      // Allocations (planned vs committed)
      mockQueryOne.mockResolvedValueOnce({
        planned_cost: '2000000',
        committed_cost: '10500000',
      } as any);

      const result = await getBudgetSummary(2026);

      expect(result.fiscal_year).toBe(2026);
      expect(result.running_repairs.total_budget).toBe(9000000);
      expect(result.running_repairs.actual_spend).toBe(8500000);
      expect(result.service_events.total_budget).toBe(12500000);
      expect(result.total.budget).toBe(21500000); // 9M + 12.5M
      expect(result.total.planned).toBe(2000000);
      expect(result.total.shop_committed).toBe(19000000); // 8.5M + 10.5M
    });
  });
});
