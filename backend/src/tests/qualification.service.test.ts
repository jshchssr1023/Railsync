/**
 * Qualification Service Tests
 *
 * Tests qualification CRUD, interval calculations, expiry forecasting,
 * compliance scoring (priority), alert thresholds, bulk updates,
 * and status recalculation.
 */

import {
  listQualificationTypes,
  listQualifications,
  createQualification,
  completeQualification,
  bulkUpdateQualifications,
  getQualificationStats,
  getAlerts,
  acknowledgeAlert,
  recalculateAllStatuses,
  getQualificationPriority,
} from '../services/qualification.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import { query, queryOne, pool } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockPoolQuery = (pool as any).query as jest.MockedFunction<any>;
const mockPoolConnect = (pool as any).connect as jest.MockedFunction<any>;

// ==============================================================================
// Test Helpers
// ==============================================================================

function createMockQualification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qual-1',
    car_id: 'car-1',
    qualification_type_id: 'type-1',
    status: 'current',
    last_completed_date: '2025-06-15',
    next_due_date: '2035-06-15',
    expiry_date: '2035-12-31',
    interval_months: 120,
    completed_by: 'shop-tech-1',
    completion_shop_code: 'SHOP001',
    certificate_number: 'CERT-12345',
    notes: null,
    is_exempt: false,
    exempt_reason: null,
    created_at: '2025-06-15T00:00:00Z',
    updated_at: '2025-06-15T00:00:00Z',
    type_code: 'HM201',
    type_name: 'Tank Test',
    regulatory_body: 'FRA',
    car_number: 'UTLX123456',
    car_mark: 'UTLX',
    lessee_name: 'Acme Corp',
    lessee_code: 'ACME',
    current_region: 'Gulf',
    ...overrides,
  };
}

function createMockClient() {
  const client = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return client;
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Qualification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Qualification Types
  // ============================================================================
  describe('listQualificationTypes', () => {
    it('should return active qualification types', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 'type-1', code: 'HM201', name: 'Tank Test', regulatory_body: 'FRA', default_interval_months: 120, is_active: true },
        { id: 'type-2', code: 'DOT111', name: 'Safety Valve', regulatory_body: 'DOT', default_interval_months: 60, is_active: true },
      ] as any);

      const result = await listQualificationTypes();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('HM201');
    });
  });

  // ============================================================================
  // List Qualifications with Filters
  // ============================================================================
  describe('listQualifications', () => {
    it('should return filtered qualifications with pagination', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '42' } as any);
      mockQuery.mockResolvedValueOnce([
        createMockQualification({ status: 'overdue' }),
        createMockQualification({ id: 'qual-2', status: 'due' }),
      ] as any);

      const result = await listQualifications({ status: 'overdue', limit: 10, offset: 0 });

      expect(result.total).toBe(42);
      expect(result.qualifications).toHaveLength(2);
    });

    it('should filter by car_id', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '3' } as any);
      mockQuery.mockResolvedValueOnce([
        createMockQualification(),
      ] as any);

      const result = await listQualifications({ car_id: 'car-1' });

      expect(result.total).toBe(3);
    });
  });

  // ============================================================================
  // Create Qualification (with transaction)
  // ============================================================================
  describe('createQualification', () => {
    it('should create a qualification and log history', async () => {
      const mockClient = createMockClient();
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      // BEGIN
      mockClient.query.mockResolvedValueOnce(undefined);
      // INSERT qualification
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockQualification({ status: 'unknown' })],
      });
      // INSERT history
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // COMMIT
      mockClient.query.mockResolvedValueOnce(undefined);

      const result = await createQualification({
        car_id: 'car-1',
        qualification_type_id: 'type-1',
      }, 'user-1');

      expect(result).toBeDefined();
      expect(result.car_id).toBe('car-1');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw on invalid date', async () => {
      await expect(
        createQualification({
          car_id: 'car-1',
          qualification_type_id: 'type-1',
          last_completed_date: 'not-a-date',
        })
      ).rejects.toThrow('Invalid last_completed_date');
    });
  });

  // ============================================================================
  // Complete Qualification (Interval Calculation & Expiry Forecasting)
  // ============================================================================
  describe('completeQualification', () => {
    it('should advance next_due_date by interval_months from completion date', async () => {
      // getQualificationById
      mockQueryOne.mockResolvedValueOnce(
        createMockQualification({ interval_months: 120, status: 'due', next_due_date: '2026-01-15' }) as any
      );

      const mockClient = createMockClient();
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      // BEGIN
      mockClient.query.mockResolvedValueOnce(undefined);
      // UPDATE qualification
      const completedDate = '2026-02-01';
      // Expected: next_due_date = 2026-02-01 + 120 months = 2036-02-01
      // Expected: expiry_date = 2036-12-31
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockQualification({
          status: 'current',
          last_completed_date: completedDate,
          next_due_date: '2036-02-01',
          expiry_date: '2036-12-31',
        })],
      });
      // INSERT history
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // COMMIT
      mockClient.query.mockResolvedValueOnce(undefined);

      const result = await completeQualification('qual-1', {
        completed_date: completedDate,
        completed_by: 'tech-1',
        completion_shop_code: 'SHOP001',
        certificate_number: 'CERT-NEW',
      }, 'user-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('current');
      expect(result!.next_due_date).toBe('2036-02-01');
      expect(result!.expiry_date).toBe('2036-12-31');
    });

    it('should default to 120 months when interval_months is null', async () => {
      mockQueryOne.mockResolvedValueOnce(
        createMockQualification({ interval_months: null, status: 'overdue' }) as any
      );

      const mockClient = createMockClient();
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      mockClient.query.mockResolvedValueOnce(undefined); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockQualification({ status: 'current' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // history
      mockClient.query.mockResolvedValueOnce(undefined); // COMMIT

      const result = await completeQualification('qual-1', {
        completed_date: '2026-03-01',
      });

      expect(result).toBeDefined();
      expect(result!.status).toBe('current');
    });

    it('should return null when qualification not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await completeQualification('nonexistent', {
        completed_date: '2026-03-01',
      });

      expect(result).toBeNull();
    });

    it('should throw on invalid completed_date', async () => {
      await expect(
        completeQualification('qual-1', { completed_date: 'bad-date' })
      ).rejects.toThrow('Invalid completed_date');
    });
  });

  // ============================================================================
  // Bulk Update Qualifications
  // ============================================================================
  describe('bulkUpdateQualifications', () => {
    it('should update multiple qualifications and return count', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 5 });
      // logHistory calls (5 times, non-blocking)
      mockPoolQuery.mockResolvedValue({ rows: [] });

      const result = await bulkUpdateQualifications(
        ['q-1', 'q-2', 'q-3', 'q-4', 'q-5'],
        { status: 'exempt', notes: 'Batch exemption' },
        'user-1'
      );

      expect(result.updated).toBe(5);
    });

    it('should return 0 when empty ids array', async () => {
      const result = await bulkUpdateQualifications([], { status: 'current' });

      expect(result.updated).toBe(0);
    });

    it('should throw when exceeding bulk update limit', async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => `q-${i}`);

      await expect(
        bulkUpdateQualifications(tooManyIds, { status: 'current' })
      ).rejects.toThrow(/limited to 500/);
    });
  });

  // ============================================================================
  // Fleet Stats (KPIs / Compliance Scoring)
  // ============================================================================
  describe('getQualificationStats', () => {
    it('should return parsed fleet qualification stats', async () => {
      mockQueryOne.mockResolvedValueOnce({
        total_cars: '500',
        overdue_count: '12',
        due_count: '25',
        due_soon_count: '40',
        current_count: '400',
        exempt_count: '15',
        unknown_count: '8',
        overdue_cars: '10',
        due_cars: '20',
        unacked_alerts: '7',
      } as any);

      const result = await getQualificationStats();

      expect(result.total_cars).toBe(500);
      expect(result.overdue_count).toBe(12);
      expect(result.current_count).toBe(400);
      expect(result.unacked_alerts).toBe(7);
    });

    it('should return zeros when stats view returns null', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getQualificationStats();

      expect(result.total_cars).toBe(0);
      expect(result.overdue_count).toBe(0);
    });
  });

  // ============================================================================
  // Qualification Priority (Alert Threshold Checks)
  // ============================================================================
  describe('getQualificationPriority', () => {
    it('should return priority 1 (Critical) when overdue qualifications exist', async () => {
      mockQueryOne.mockResolvedValueOnce({
        overdue_count: '2',
        due_count: '1',
        due_soon_count: '3',
        earliest_due: '2025-12-01',
      } as any);

      const result = await getQualificationPriority('car-1');

      expect(result.recommended_priority).toBe(1);
      expect(result.reason).toContain('overdue');
      expect(result.overdue_count).toBe(2);
    });

    it('should return priority 2 (High) when qualifications are due within 30 days', async () => {
      mockQueryOne.mockResolvedValueOnce({
        overdue_count: '0',
        due_count: '1',
        due_soon_count: '2',
        earliest_due: '2026-02-15',
      } as any);

      const result = await getQualificationPriority('car-2');

      expect(result.recommended_priority).toBe(2);
      expect(result.reason).toContain('30 days');
    });

    it('should return priority 3 (Medium) when qualifications are due within 90 days', async () => {
      mockQueryOne.mockResolvedValueOnce({
        overdue_count: '0',
        due_count: '0',
        due_soon_count: '1',
        earliest_due: '2026-04-01',
      } as any);

      const result = await getQualificationPriority('car-3');

      expect(result.recommended_priority).toBe(3);
      expect(result.reason).toContain('90 days');
    });

    it('should return priority 4 (Low) when no urgent needs', async () => {
      mockQueryOne.mockResolvedValueOnce({
        overdue_count: '0',
        due_count: '0',
        due_soon_count: '0',
        earliest_due: '2027-01-01',
      } as any);

      const result = await getQualificationPriority('car-4');

      expect(result.recommended_priority).toBe(4);
      expect(result.reason).toBe('No urgent qualification needs');
    });
  });

  // ============================================================================
  // Alerts
  // ============================================================================
  describe('getAlerts', () => {
    it('should return unacknowledged alerts with pagination', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '15' } as any);
      mockQuery.mockResolvedValueOnce([
        { id: 'alert-1', alert_type: 'warning_30', is_acknowledged: false, days_until_due: 25 },
        { id: 'alert-2', alert_type: 'overdue', is_acknowledged: false, days_until_due: -5 },
      ] as any);

      const result = await getAlerts({ is_acknowledged: false, limit: 10 });

      expect(result.total).toBe(15);
      expect(result.alerts).toHaveLength(2);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert and return true', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await acknowledgeAlert('alert-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when alert is already acknowledged', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await acknowledgeAlert('alert-already-acked', 'user-1');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Batch Status Recalculation
  // ============================================================================
  describe('recalculateAllStatuses', () => {
    it('should return number of updated qualifications', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 23 });

      const result = await recalculateAllStatuses();

      expect(result.updated).toBe(23);
    });
  });
});
