/**
 * Report Builder Service Tests
 *
 * Tests report template listing, execution, CSV export, and saved reports
 */

import {
  listTemplates,
  getTemplate,
  runReport,
  toCSV,
  saveReport,
  listSavedReports,
  getSavedReport,
  deleteSavedReport,
  setSchedule,
  removeSchedule,
} from '../services/report-builder.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  pool: { query: jest.fn() },
}));

import { query, queryOne } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

describe('Report Builder Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Template Operations
  // ============================================================================
  describe('listTemplates', () => {
    it('should return all built-in templates', () => {
      const result = listTemplates();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('available_columns');
    });
  });

  describe('getTemplate', () => {
    it('should return template by ID', () => {
      const result = getTemplate('system-0');

      expect(result).toBeDefined();
      expect(result!.name).toBe('Fleet Inventory');
    });

    it('should return null for invalid template ID', () => {
      const result = getTemplate('invalid-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Report Execution
  // ============================================================================
  describe('runReport', () => {
    it('should execute report with default columns', async () => {
      mockQueryOne.mockResolvedValueOnce({ cnt: '100' } as any);
      mockQuery.mockResolvedValueOnce([
        { car_number: 'UTLX123456', car_type: 'Tank', owner_code: 'UTLX', status: 'active' },
        { car_number: 'UTLX123457', car_type: 'Tank', owner_code: 'UTLX', status: 'active' },
      ] as any);

      const result = await runReport('system-0', {});

      expect(result).toBeDefined();
      expect(result.total).toBe(100);
      expect(result.rows).toHaveLength(2);
      expect(result.columns.length).toBeGreaterThan(0);
    });

    it('should apply filters to report execution', async () => {
      mockQueryOne.mockResolvedValueOnce({ cnt: '50' } as any);
      mockQuery.mockResolvedValueOnce([
        { car_number: 'UTLX123456', car_type: 'Tank', status: 'active' },
      ] as any);

      const result = await runReport('system-0', {
        filters: { car_type: 'Tank', status: 'active' },
      });

      expect(result.total).toBe(50);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['%Tank%', 'active', expect.anything(), expect.anything()])
      );
    });

    it('should handle custom column selection', async () => {
      mockQueryOne.mockResolvedValueOnce({ cnt: '10' } as any);
      mockQuery.mockResolvedValueOnce([
        { car_number: 'UTLX123456', lessee_name: 'Acme Corp' },
      ] as any);

      const result = await runReport('system-0', {
        columns: ['car_number', 'lessee_name'],
      });

      expect(result.columns).toHaveLength(2);
      expect(result.columns[0].key).toBe('car_number');
      expect(result.columns[1].key).toBe('lessee_name');
    });

    it('should apply sorting', async () => {
      mockQueryOne.mockResolvedValueOnce({ cnt: '10' } as any);
      mockQuery.mockResolvedValueOnce([
        { car_number: 'UTLX123456' },
      ] as any);

      await runReport('system-0', {
        sort_by: 'car_number',
        sort_dir: 'DESC',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY'),
        expect.anything()
      );
    });

    it('should throw when template not found', async () => {
      await expect(
        runReport('nonexistent', {})
      ).rejects.toThrow('Template not found');
    });
  });

  // ============================================================================
  // CSV Export
  // ============================================================================
  describe('toCSV', () => {
    it('should convert report result to CSV format', () => {
      const reportResult = {
        columns: [
          { key: 'car_number', label: 'Car Number', type: 'text' },
          { key: 'car_type', label: 'Type', type: 'text' },
          { key: 'cost', label: 'Cost', type: 'currency' },
        ],
        rows: [
          { car_number: 'UTLX123456', car_type: 'Tank', cost: 5000 },
          { car_number: 'UTLX123457', car_type: 'Hopper', cost: 3500 },
        ],
        total: 2,
        generated_at: new Date().toISOString(),
      };

      const csv = toCSV(reportResult);

      expect(csv).toContain('"Car Number","Type","Cost"');
      expect(csv).toContain('"UTLX123456","Tank",5000');
      expect(csv).toContain('"UTLX123457","Hopper",3500');
    });

    it('should handle null values in CSV export', () => {
      const reportResult = {
        columns: [{ key: 'name', label: 'Name', type: 'text' }],
        rows: [{ name: null }],
        total: 1,
        generated_at: new Date().toISOString(),
      };

      const csv = toCSV(reportResult);

      expect(csv).toContain('"Name"\n');
    });

    it('should escape quotes in CSV values', () => {
      const reportResult = {
        columns: [{ key: 'description', label: 'Description', type: 'text' }],
        rows: [{ description: 'Test "quoted" value' }],
        total: 1,
        generated_at: new Date().toISOString(),
      };

      const csv = toCSV(reportResult);

      expect(csv).toContain('"Test ""quoted"" value"');
    });
  });

  // ============================================================================
  // Saved Reports
  // ============================================================================
  describe('saveReport', () => {
    it('should save a report configuration', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'saved-1',
        template_id: 'system-0',
        name: 'My Fleet Report',
        columns: ['car_number', 'car_type'],
        filters: { status: 'active' },
        created_by: 'user-1',
      } as any);

      const result = await saveReport(
        'system-0',
        'My Fleet Report',
        {
          columns: ['car_number', 'car_type'],
          filters: { status: 'active' },
        },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('My Fleet Report');
    });
  });

  describe('listSavedReports', () => {
    it('should list saved reports for user', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 'saved-1', name: 'Report 1', created_by: 'user-1' },
        { id: 'saved-2', name: 'Report 2', created_by: 'user-1' },
      ] as any);

      const result = await listSavedReports('user-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('getSavedReport', () => {
    it('should return saved report when found', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'saved-1',
        name: 'My Report',
      } as any);

      const result = await getSavedReport('saved-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('saved-1');
    });

    it('should return null when saved report not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getSavedReport('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteSavedReport', () => {
    it('should delete saved report', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await deleteSavedReport('saved-1', 'user-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM saved_reports WHERE id = $1 AND created_by = $2',
        ['saved-1', 'user-1']
      );
    });
  });

  // ============================================================================
  // Schedule Management
  // ============================================================================
  describe('setSchedule', () => {
    it('should set schedule for saved report', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'saved-1',
        is_scheduled: true,
        schedule_cron: '0 8 * * 1',
        schedule_recipients: ['user1@example.com', 'user2@example.com'],
      } as any);

      const result = await setSchedule('saved-1', '0 8 * * 1', ['user1@example.com', 'user2@example.com']);

      expect(result).toBeDefined();
      expect(result!.is_scheduled).toBe(true);
      expect(result!.schedule_cron).toBe('0 8 * * 1');
    });
  });

  describe('removeSchedule', () => {
    it('should remove schedule from saved report', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'saved-1',
        is_scheduled: false,
        schedule_cron: null,
        schedule_recipients: null,
      } as any);

      const result = await removeSchedule('saved-1');

      expect(result).toBeDefined();
      expect(result!.is_scheduled).toBe(false);
      expect(result!.schedule_cron).toBeNull();
    });
  });
});
