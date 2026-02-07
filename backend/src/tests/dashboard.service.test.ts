/**
 * Dashboard Service Tests
 *
 * Tests dashboard configuration, widget management, and KPI queries
 */

import {
  listWidgets,
  getWidgetById,
  listDashboardConfigs,
  getDashboardConfig,
  createDashboardConfig,
  updateDashboardConfig,
  deleteDashboardConfig,
  getContractsReadiness,
  getMyContractsHealth,
  getBudgetBurnVelocity,
} from '../services/dashboard.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  pool: { query: jest.fn() },
}));

import { query, queryOne } from '../config/database';
import { pool } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockPoolQuery = pool.query as jest.Mock;

describe('Dashboard Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Widget Management
  // ============================================================================
  describe('listWidgets', () => {
    it('should return all active widgets', async () => {
      const result = await listWidgets();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('category');
    });
  });

  describe('getWidgetById', () => {
    it('should return widget when found', async () => {
      const result = await getWidgetById('forecast-summary');

      expect(result).toBeDefined();
      expect(result!.name).toBe('Maintenance Forecast');
    });

    it('should return null when widget not found', async () => {
      const result = await getWidgetById('nonexistent-widget');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Dashboard Configs
  // ============================================================================
  describe('listDashboardConfigs', () => {
    it('should list dashboard configs for user', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          { id: 'config-1', user_id: 'user-1', name: 'My Dashboard', is_default: true },
          { id: 'config-2', user_id: 'user-1', name: 'Secondary Dashboard', is_default: false },
        ],
      } as any);

      const result = await listDashboardConfigs('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].is_default).toBe(true);
    });
  });

  describe('getDashboardConfig', () => {
    it('should return dashboard config when found', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 'config-1', user_id: 'user-1', name: 'My Dashboard' }],
      } as any);

      const result = await getDashboardConfig('config-1', 'user-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('config-1');
    });

    it('should return null when config not found', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await getDashboardConfig('nonexistent', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('createDashboardConfig', () => {
    it('should create a new dashboard config', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as any); // unset defaults
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{
          id: 'new-config',
          user_id: 'user-1',
          name: 'My Custom Dashboard',
          is_default: true,
        }],
      } as any);

      const layout = {
        columns: 3,
        widgets: [
          { id: 'forecast-summary', x: 0, y: 0, w: 2, h: 1 },
        ],
      };

      const result = await createDashboardConfig('user-1', 'My Custom Dashboard', layout, true);

      expect(result).toBeDefined();
      expect(result.name).toBe('My Custom Dashboard');
      expect(result.is_default).toBe(true);
    });
  });

  describe('updateDashboardConfig', () => {
    it('should update dashboard config', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as any); // unset other defaults
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 'config-1', name: 'Updated Dashboard', is_default: true }],
      } as any);

      const result = await updateDashboardConfig('config-1', 'user-1', {
        name: 'Updated Dashboard',
        is_default: true,
      });

      expect(result).toBeDefined();
      expect(result!.name).toBe('Updated Dashboard');
    });
  });

  describe('deleteDashboardConfig', () => {
    it('should delete dashboard config', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      const result = await deleteDashboardConfig('config-1', 'user-1');

      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // KPI Queries
  // ============================================================================
  describe('getContractsReadiness', () => {
    it('should return contracts readiness summary', async () => {
      mockQueryOne.mockResolvedValueOnce({
        total_cars: '5000',
        in_pipeline: '1200',
        available: '3800',
        availability_pct: '76.0',
        need_shopping: '300',
        complete: '3500',
      } as any);

      const result = await getContractsReadiness();

      expect(result).toBeDefined();
      expect(result!.total_cars).toBe('5000');
      expect(result!.availability_pct).toBe('76.0');
    });
  });

  describe('getMyContractsHealth', () => {
    it('should return user-specific contract health', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          status: 'Need Shopping',
          count: '50',
          total_estimated: '250000',
          total_actual: '0',
        },
        {
          status: 'Complete',
          count: '120',
          total_estimated: '600000',
          total_actual: '580000',
        },
      ] as any);

      const result = await getMyContractsHealth('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('Need Shopping');
    });
  });

  describe('getBudgetBurnVelocity', () => {
    it('should calculate budget burn velocity by month', async () => {
      mockQuery.mockResolvedValueOnce([
        { month: '2026-01', monthly_budget: 750000, actual_spend: 700000 },
        { month: '2026-02', monthly_budget: 750000, actual_spend: 720000 },
        { month: '2026-03', monthly_budget: 750000, actual_spend: 0 },
      ] as any);

      const result = await getBudgetBurnVelocity(2026);

      expect(result.fiscal_year).toBe(2026);
      expect(result.total_annual_budget).toBe(2250000);
      expect(result.total_spent).toBe(1420000);
      expect(result.months).toHaveLength(3);
      expect(result.months[0].cumulative_actual).toBe(700000);
      expect(result.months[1].cumulative_actual).toBe(1420000);
    });

    it('should handle months with no spend', async () => {
      mockQuery.mockResolvedValueOnce([
        { month: '2026-01', monthly_budget: 750000, actual_spend: 0 },
      ] as any);

      const result = await getBudgetBurnVelocity(2026);

      expect(result.avg_monthly_burn).toBe(0);
    });
  });
});
