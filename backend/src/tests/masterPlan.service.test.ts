/**
 * Master Plan Service Tests
 *
 * Tests plan CRUD, version management, and allocation operations
 */

import {
  listMasterPlans,
  getMasterPlan,
  createMasterPlan,
  updateMasterPlan,
  deleteMasterPlan,
  createVersionSnapshot,
  listPlanAllocations,
  addCarsToPlan,
  removeAllocationFromPlan,
  getPlanStats,
} from '../services/masterPlan.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  pool: { query: jest.fn() },
}));

// Mock dependent services
jest.mock('../services/assetEvent.service', () => ({
  recordEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
}));

import { query, queryOne } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

describe('Master Plan Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // List Master Plans
  // ============================================================================
  describe('listMasterPlans', () => {
    it('should list all master plans with summary', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'plan-1',
          name: 'FY2026 Plan',
          fiscal_year: 2026,
          status: 'active',
          version_count: 3,
          current_allocation_count: 150,
        },
        {
          id: 'plan-2',
          name: 'FY2025 Plan',
          fiscal_year: 2025,
          status: 'archived',
        },
      ] as any);

      const result = await listMasterPlans();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('FY2026 Plan');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM v_master_plan_summary'),
        []
      );
    });

    it('should filter by fiscal year and status', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 'plan-1', fiscal_year: 2026, status: 'active' },
      ] as any);

      const result = await listMasterPlans({ fiscal_year: 2026, status: 'active' });

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        [2026, 'active']
      );
    });
  });

  // ============================================================================
  // Get Master Plan
  // ============================================================================
  describe('getMasterPlan', () => {
    it('should return plan when found', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'plan-1',
        name: 'FY2026 Plan',
        fiscal_year: 2026,
      } as any);

      const result = await getMasterPlan('plan-1');

      expect(result).toBeDefined();
      expect(result!.name).toBe('FY2026 Plan');
    });

    it('should return null when plan not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getMasterPlan('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Create Master Plan
  // ============================================================================
  describe('createMasterPlan', () => {
    it('should create a new master plan', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'new-plan',
          name: 'Q1 2026 Plan',
          fiscal_year: 2026,
          planning_month: '2026-01',
          status: 'draft',
        },
      ] as any);

      const result = await createMasterPlan({
        name: 'Q1 2026 Plan',
        fiscal_year: 2026,
        planning_month: '2026-01',
        created_by: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Q1 2026 Plan');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Update Master Plan
  // ============================================================================
  describe('updateMasterPlan', () => {
    it('should update plan fields', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'plan-1',
          name: 'Updated Plan Name',
          status: 'active',
        },
      ] as any);

      const result = await updateMasterPlan('plan-1', {
        name: 'Updated Plan Name',
        status: 'active',
      });

      expect(result).toBeDefined();
      expect(result!.name).toBe('Updated Plan Name');
    });

    it('should return existing plan if no updates provided', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'plan-1',
        name: 'Original Name',
      } as any);

      const result = await updateMasterPlan('plan-1', {});

      expect(result).toBeDefined();
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('FROM v_master_plan_summary'),
        ['plan-1']
      );
    });
  });

  // ============================================================================
  // Delete Master Plan
  // ============================================================================
  describe('deleteMasterPlan', () => {
    it('should delete a master plan', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await deleteMasterPlan('plan-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM master_plans WHERE id = $1',
        ['plan-1']
      );
    });
  });

  // ============================================================================
  // Create Version Snapshot
  // ============================================================================
  describe('createVersionSnapshot', () => {
    it('should create a version snapshot', async () => {
      mockQueryOne.mockResolvedValueOnce({ create_plan_version_snapshot: 'version-1' } as any);
      mockQueryOne.mockResolvedValueOnce({
        id: 'version-1',
        plan_id: 'plan-1',
        version_number: 2,
        label: 'Baseline',
      } as any);

      const result = await createVersionSnapshot('plan-1', 'Baseline', 'Initial snapshot', 'user-1');

      expect(result).toBeDefined();
      expect(result!.version_number).toBe(2);
      expect(mockQueryOne).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // List Plan Allocations
  // ============================================================================
  describe('listPlanAllocations', () => {
    it('should list allocations for a plan', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 'alloc-1', plan_id: 'plan-1', car_number: 'UTLX123456', status: 'Need Shopping' },
        { id: 'alloc-2', plan_id: 'plan-1', car_number: 'UTLX123457', status: 'Planned Shopping' },
      ] as any);

      const result = await listPlanAllocations('plan-1');

      expect(result).toHaveLength(2);
      expect(result[0].car_number).toBe('UTLX123456');
    });

    it('should filter allocations by status', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 'alloc-1', status: 'Need Shopping' },
      ] as any);

      const result = await listPlanAllocations('plan-1', { status: 'Need Shopping' });

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('a.status = $2'),
        ['plan-1', 'Need Shopping']
      );
    });
  });

  // ============================================================================
  // Add Cars To Plan
  // ============================================================================
  describe('addCarsToPlan', () => {
    it('should add cars to plan and skip duplicates', async () => {
      // First car: no duplicate
      mockQueryOne.mockResolvedValueOnce(null);
      mockQueryOne.mockResolvedValueOnce({ car_number: 'UTLX123456', id: 'car-1' } as any);
      mockQuery.mockResolvedValueOnce([] as any);

      // Second car: duplicate
      mockQueryOne.mockResolvedValueOnce({ id: 'existing-alloc' } as any);

      const result = await addCarsToPlan('plan-1', ['UTLX123456', 'UTLX123457'], '2026-01', 'user-1');

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for inactive cars', async () => {
      mockQueryOne.mockResolvedValueOnce(null);
      mockQueryOne.mockResolvedValueOnce(null); // car not found

      const result = await addCarsToPlan('plan-1', ['UTLX999999'], '2026-01', 'user-1');

      expect(result.added).toBe(0);
      expect(result.errors).toContain('Car UTLX999999 not found or inactive');
    });
  });

  // ============================================================================
  // Remove Allocation From Plan
  // ============================================================================
  describe('removeAllocationFromPlan', () => {
    it('should remove allocation from plan', async () => {
      mockQueryOne.mockResolvedValueOnce({ car_id: 'car-1' } as any);
      mockQuery.mockResolvedValueOnce([{ id: 'alloc-1' }] as any);

      const result = await removeAllocationFromPlan('plan-1', 'alloc-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE allocations SET plan_id = NULL'),
        ['alloc-1', 'plan-1']
      );
    });
  });

  // ============================================================================
  // Get Plan Stats
  // ============================================================================
  describe('getPlanStats', () => {
    it('should return plan statistics', async () => {
      mockQueryOne.mockResolvedValueOnce({
        total_allocations: '150',
        assigned: '120',
        unassigned: '30',
        total_estimated_cost: '500000',
        planned_cost: '100000',
        committed_cost: '400000',
      } as any);
      mockQuery.mockResolvedValueOnce([
        { status: 'Need Shopping', count: '30', cost: '100000' },
      ] as any);
      mockQuery.mockResolvedValueOnce([
        { shop_code: 'SHOP001', shop_name: 'Shop A', count: '50', cost: '200000' },
      ] as any);

      const result = await getPlanStats('plan-1');

      expect(result.total_allocations).toBe(150);
      expect(result.assigned).toBe(120);
      expect(result.unassigned).toBe(30);
      expect(result.by_status).toHaveLength(1);
      expect(result.by_shop).toHaveLength(1);
    });
  });
});
