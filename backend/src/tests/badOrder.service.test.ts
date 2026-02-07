/**
 * Bad Order Service Tests
 *
 * Tests bad order report creation, resolution, and status management
 */

import {
  createBadOrder,
  getBadOrder,
  listBadOrders,
  resolveBadOrder,
  updateBadOrderStatus,
  revertLastTransition,
} from '../services/badOrder.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  pool: { query: jest.fn() },
}));

// Mock dependent services
jest.mock('../services/assignment.service', () => ({
  getActiveAssignment: jest.fn(),
}));

jest.mock('../services/alerts.service', () => ({
  createAlert: jest.fn().mockResolvedValue({ id: 'alert-1' }),
}));

jest.mock('../services/email.service', () => ({
  notifyBadOrder: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/transition-log.service', () => ({
  logTransition: jest.fn().mockResolvedValue({ id: 'log-1' }),
  canRevert: jest.fn(),
  markReverted: jest.fn(),
  getLastTransition: jest.fn(),
}));

import { query, queryOne } from '../config/database';
import { pool } from '../config/database';
import { getActiveAssignment } from '../services/assignment.service';
import { canRevert, getLastTransition } from '../services/transition-log.service';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockPoolQuery = pool.query as jest.Mock;
const mockGetActiveAssignment = getActiveAssignment as jest.MockedFunction<typeof getActiveAssignment>;
const mockCanRevert = canRevert as jest.MockedFunction<typeof canRevert>;
const mockGetLastTransition = getLastTransition as jest.MockedFunction<typeof getLastTransition>;

describe('Bad Order Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Create Bad Order
  // ============================================================================
  describe('createBadOrder', () => {
    it('should create bad order without existing assignment', async () => {
      mockGetActiveAssignment.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValueOnce([
        {
          id: 'bo-1',
          car_number: 'UTLX123456',
          issue_type: 'mechanical_failure',
          severity: 'high',
          status: 'open',
          had_existing_plan: false,
        },
      ] as any);

      const result = await createBadOrder({
        car_number: 'UTLX123456',
        issue_type: 'mechanical_failure',
        issue_description: 'Brake system failure',
        severity: 'high',
        location: 'Chicago',
        created_by_id: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('open');
      expect(result.had_existing_plan).toBe(false);
    });

    it('should create bad order with existing assignment as pending_decision', async () => {
      mockGetActiveAssignment.mockResolvedValueOnce({
        id: 'assign-1',
        shop_code: 'SHOP001',
        target_month: '2026-01',
      } as any);
      mockQuery.mockResolvedValueOnce([
        {
          id: 'bo-1',
          car_number: 'UTLX123456',
          status: 'pending_decision',
          had_existing_plan: true,
          existing_assignment_id: 'assign-1',
        },
      ] as any);

      const result = await createBadOrder({
        car_number: 'UTLX123456',
        issue_type: 'safety_violation',
        issue_description: 'Safety issue detected',
        severity: 'critical',
        created_by_id: 'user-1',
      });

      expect(result.status).toBe('pending_decision');
      expect(result.had_existing_plan).toBe(true);
    });
  });

  // ============================================================================
  // Get Bad Order
  // ============================================================================
  describe('getBadOrder', () => {
    it('should return bad order when found', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'bo-1',
          car_number: 'UTLX123456',
          status: 'open',
        },
      ] as any);

      const result = await getBadOrder('bo-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('bo-1');
    });

    it('should return null when bad order not found', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await getBadOrder('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // List Bad Orders
  // ============================================================================
  describe('listBadOrders', () => {
    it('should list bad orders with pagination', async () => {
      mockQuery.mockResolvedValueOnce([{ total: '10' }] as any);
      mockQuery.mockResolvedValueOnce([
        { id: 'bo-1', car_number: 'UTLX123456', severity: 'high' },
        { id: 'bo-2', car_number: 'UTLX123457', severity: 'medium' },
      ] as any);

      const result = await listBadOrders({ limit: 50, offset: 0 });

      expect(result.total).toBe(10);
      expect(result.reports).toHaveLength(2);
    });

    it('should filter by status', async () => {
      mockQuery.mockResolvedValueOnce([{ total: '5' }] as any);
      mockQuery.mockResolvedValueOnce([
        { id: 'bo-1', status: 'open' },
      ] as any);

      const result = await listBadOrders({ status: 'open' });

      expect(result.reports).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        expect.anything()
      );
    });
  });

  // ============================================================================
  // Resolve Bad Order
  // ============================================================================
  describe('resolveBadOrder', () => {
    it('should resolve bad order with action', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'bo-1',
          status: 'assigned',
          resolution_action: 'expedite_existing',
          assignment_id: 'assign-1',
        },
      ] as any);

      const result = await resolveBadOrder('bo-1', {
        action: 'expedite_existing',
        assignment_id: 'assign-1',
        resolution_notes: 'Expediting repair',
        resolved_by_id: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result!.status).toBe('assigned');
      expect(result!.resolution_action).toBe('expedite_existing');
    });

    it('should set status to pending_decision for planning_review action', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'bo-1',
          status: 'pending_decision',
          resolution_action: 'planning_review',
        },
      ] as any);

      const result = await resolveBadOrder('bo-1', {
        action: 'planning_review',
        resolved_by_id: 'user-1',
      });

      expect(result!.status).toBe('pending_decision');
    });
  });

  // ============================================================================
  // Update Bad Order Status
  // ============================================================================
  describe('updateBadOrderStatus', () => {
    it('should update bad order status', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 'bo-1', status: 'resolved' },
      ] as any);

      const result = await updateBadOrderStatus('bo-1', 'resolved');

      expect(result).toBeDefined();
      expect(result!.status).toBe('resolved');
    });
  });

  // ============================================================================
  // Revert Last Transition
  // ============================================================================
  describe('revertLastTransition', () => {
    it('should revert bad order to previous status', async () => {
      mockCanRevert.mockResolvedValueOnce({ allowed: true, blockers: [] });
      mockGetLastTransition.mockResolvedValueOnce({
        id: 'trans-1',
        from_state: 'open',
        to_state: 'assigned',
      } as any);
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 'bo-1', status: 'open', car_number: 'UTLX123456' }],
      } as any);

      const result = await revertLastTransition('bo-1', 'user-1', 'Reverting decision');

      expect(result).toBeDefined();
      expect(result.status).toBe('open');
      expect(mockCanRevert).toHaveBeenCalledWith('bad_order', 'bo-1');
    });

    it('should throw when revert is not allowed', async () => {
      mockCanRevert.mockResolvedValueOnce({
        allowed: false,
        blockers: ['Already resolved'],
      });

      await expect(
        revertLastTransition('bo-1', 'user-1')
      ).rejects.toThrow('Cannot revert: Already resolved');
    });
  });
});
