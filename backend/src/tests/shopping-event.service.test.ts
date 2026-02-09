/**
 * Shopping Event Service Tests
 *
 * Tests state machine transitions, approval gates, and terminal state enforcement
 * for the ShoppingEvent lifecycle.
 */

import {
  transitionState,
  createShoppingEvent,
  getShoppingEvent,
  listShoppingEvents,
  ShoppingEventState,
} from '../services/shopping-event.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  pool: { query: jest.fn() },
}));

// Mock the transition-log service
jest.mock('../services/transition-log.service', () => ({
  logTransition: jest.fn().mockResolvedValue({ id: 'log-1' }),
  canRevert: jest.fn(),
  markReverted: jest.fn(),
  getLastTransition: jest.fn(),
}));

import { query, queryOne, transaction } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;

// ==============================================================================
// Test Helpers
// ==============================================================================

function mockCurrentState(state: ShoppingEventState, eventNumber: string = 'SE-001') {
  // Mock the SELECT state, event_number query used by transitionState
  mockQueryOne.mockResolvedValueOnce({ state, event_number: eventNumber } as any);
}

function mockUpdateReturning(state: ShoppingEventState) {
  // Mock the UPDATE ... RETURNING * query
  mockQueryOne.mockResolvedValueOnce({
    id: 'event-1',
    state,
    event_number: 'SE-001',
    car_number: 'UTLX123456',
    shop_code: 'SHOP001',
    version: 2,
  } as any);
}

function mockApprovalGatePass() {
  // Mock the estimate/final estimate query returning an approved count
  mockQueryOne.mockResolvedValueOnce({ count: '1' } as any);
}

function mockApprovalGateFail() {
  // Mock the estimate query returning zero approved
  mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Shopping Event Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // State Transition: REQUESTED -> ASSIGNED_TO_SHOP
  // ============================================================================
  describe('Transition: REQUESTED -> ASSIGNED_TO_SHOP', () => {
    it('should succeed when transitioning from REQUESTED to ASSIGNED_TO_SHOP', async () => {
      mockCurrentState('REQUESTED');
      mockUpdateReturning('ASSIGNED_TO_SHOP');

      const result = await transitionState('event-1', 'ASSIGNED_TO_SHOP', 'user-1');

      expect(result).toBeDefined();
      expect(result.state).toBe('ASSIGNED_TO_SHOP');
    });
  });

  // ============================================================================
  // State Transition: ASSIGNED_TO_SHOP -> INBOUND
  // ============================================================================
  describe('Transition: ASSIGNED_TO_SHOP -> INBOUND', () => {
    it('should succeed when transitioning from ASSIGNED_TO_SHOP to INBOUND', async () => {
      mockCurrentState('ASSIGNED_TO_SHOP');
      mockUpdateReturning('INBOUND');

      const result = await transitionState('event-1', 'INBOUND', 'user-1');

      expect(result).toBeDefined();
      expect(result.state).toBe('INBOUND');
    });
  });

  // ============================================================================
  // State Transition: ESTIMATE_SUBMITTED -> ESTIMATE_UNDER_REVIEW
  // ============================================================================
  describe('Transition: ESTIMATE_SUBMITTED -> ESTIMATE_UNDER_REVIEW', () => {
    it('should succeed when transitioning from ESTIMATE_SUBMITTED to ESTIMATE_UNDER_REVIEW', async () => {
      mockCurrentState('ESTIMATE_SUBMITTED');
      mockUpdateReturning('ESTIMATE_UNDER_REVIEW');

      const result = await transitionState('event-1', 'ESTIMATE_UNDER_REVIEW', 'user-1');

      expect(result).toBeDefined();
      expect(result.state).toBe('ESTIMATE_UNDER_REVIEW');
    });
  });

  // ============================================================================
  // State Transition: ESTIMATE_APPROVED -> WORK_AUTHORIZED (with approval gate)
  // ============================================================================
  describe('Transition: ESTIMATE_APPROVED -> WORK_AUTHORIZED', () => {
    it('should succeed when an approved estimate exists (gate passes)', async () => {
      // WORK_AUTHORIZED has an approval gate: assertApprovedEstimate
      mockApprovalGatePass(); // count = 1 for approved estimate
      mockCurrentState('ESTIMATE_APPROVED');
      mockUpdateReturning('WORK_AUTHORIZED');

      const result = await transitionState('event-1', 'WORK_AUTHORIZED', 'user-1');

      expect(result).toBeDefined();
      expect(result.state).toBe('WORK_AUTHORIZED');
    });

    it('should throw when no approved estimate exists (gate blocks)', async () => {
      mockApprovalGateFail(); // count = 0

      await expect(
        transitionState('event-1', 'WORK_AUTHORIZED', 'user-1')
      ).rejects.toThrow('Gate blocked: cannot authorise work without an approved estimate');
    });
  });

  // ============================================================================
  // State Transition: IN_REPAIR -> QA_COMPLETE
  // ============================================================================
  describe('Transition: IN_REPAIR -> QA_COMPLETE', () => {
    it('should succeed when transitioning from IN_REPAIR to QA_COMPLETE', async () => {
      mockCurrentState('IN_REPAIR');
      mockUpdateReturning('QA_COMPLETE');

      const result = await transitionState('event-1', 'QA_COMPLETE', 'user-1');

      expect(result).toBeDefined();
      expect(result.state).toBe('QA_COMPLETE');
    });
  });

  // ============================================================================
  // Terminal States: RELEASED and CANCELLED cannot transition further
  // ============================================================================
  describe('Terminal States', () => {
    it('should fail when attempting to transition from RELEASED', async () => {
      // The DB trigger should block this, but the service handles the error
      mockCurrentState('RELEASED');
      mockQueryOne.mockRejectedValueOnce(
        new Error('Invalid state transition from RELEASED')
      );

      await expect(
        transitionState('event-1', 'ASSIGNED_TO_SHOP', 'user-1')
      ).rejects.toThrow(/Invalid state transition/);
    });

    it('should fail when attempting to transition from CANCELLED', async () => {
      mockCurrentState('CANCELLED');
      mockQueryOne.mockRejectedValueOnce(
        new Error('Invalid state transition from CANCELLED')
      );

      await expect(
        transitionState('event-1', 'REQUESTED', 'user-1')
      ).rejects.toThrow(/Invalid state transition/);
    });

    it('should allow transition to CANCELLED from any non-terminal state', async () => {
      mockCurrentState('INBOUND');
      mockQueryOne.mockResolvedValueOnce({
        id: 'event-1',
        state: 'CANCELLED',
        event_number: 'SE-001',
        cancelled_at: new Date(),
        cancelled_by_id: 'user-1',
        cancellation_reason: 'Test cancellation',
      } as any);

      const result = await transitionState('event-1', 'CANCELLED', 'user-1', 'Test cancellation');

      expect(result).toBeDefined();
      expect(result.state).toBe('CANCELLED');
    });
  });

  // ============================================================================
  // Approval Gate: FINAL_ESTIMATE_APPROVED requires approved final estimate
  // ============================================================================
  describe('Approval Gate: FINAL_ESTIMATE_APPROVED', () => {
    it('should succeed when final estimate is approved', async () => {
      // assertApprovedFinalEstimate gate
      mockApprovalGatePass();
      mockCurrentState('QA_COMPLETE');
      // Note: actual flow goes QA_COMPLETE -> FINAL_ESTIMATE_SUBMITTED -> FINAL_ESTIMATE_APPROVED
      // but we test the gate on FINAL_ESTIMATE_APPROVED directly
      mockUpdateReturning('FINAL_ESTIMATE_APPROVED');

      const result = await transitionState('event-1', 'FINAL_ESTIMATE_APPROVED', 'user-1');

      expect(result).toBeDefined();
      expect(result.state).toBe('FINAL_ESTIMATE_APPROVED');
    });

    it('should throw when final estimate is not approved', async () => {
      mockApprovalGateFail();

      await expect(
        transitionState('event-1', 'FINAL_ESTIMATE_APPROVED', 'user-1')
      ).rejects.toThrow('Gate blocked: cannot approve final disposition without an approved final estimate');
    });
  });

  // ============================================================================
  // Approval Gate: READY_FOR_RELEASE requires final estimate + responsibility lock
  // ============================================================================
  describe('Approval Gate: READY_FOR_RELEASE', () => {
    it('should succeed when final estimate approved and responsibility locked', async () => {
      // assertApprovedFinalEstimate succeeds
      mockApprovalGatePass();
      // assertResponsibilityLocked succeeds (0 unresolved lines)
      mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);
      mockCurrentState('FINAL_ESTIMATE_APPROVED');
      mockUpdateReturning('READY_FOR_RELEASE');

      const result = await transitionState('event-1', 'READY_FOR_RELEASE', 'user-1');

      expect(result).toBeDefined();
      expect(result.state).toBe('READY_FOR_RELEASE');
    });

    it('should throw when responsibility lines are unresolved', async () => {
      // assertApprovedFinalEstimate succeeds
      mockApprovalGatePass();
      // assertResponsibilityLocked fails (3 unresolved lines)
      mockQueryOne.mockResolvedValueOnce({ count: '3' } as any);

      await expect(
        transitionState('event-1', 'READY_FOR_RELEASE', 'user-1')
      ).rejects.toThrow(/3 estimate line\(s\) have unresolved responsibility/);
    });
  });

  // ============================================================================
  // Create Shopping Event
  // ============================================================================
  describe('createShoppingEvent', () => {
    it('should create a new shopping event in REQUESTED state', async () => {
      // 1. Active-event guard returns null (no existing active event)
      mockQueryOne.mockResolvedValueOnce(null);
      // 2. generate_event_number
      mockQueryOne.mockResolvedValueOnce({ generate_event_number: 'SE-100' } as any);
      // 3. INSERT RETURNING
      mockQueryOne.mockResolvedValueOnce({
        id: 'new-event-id',
        event_number: 'SE-100',
        car_number: 'UTLX999999',
        shop_code: 'SHOP002',
        state: 'REQUESTED',
        version: 1,
      } as any);

      const result = await createShoppingEvent(
        { car_number: 'UTLX999999', shop_code: 'SHOP002' },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(result.event_number).toBe('SE-100');
      expect(result.state).toBe('REQUESTED');
      expect(mockQueryOne).toHaveBeenCalledTimes(3);
    });

    it('should reject creation when car has an active shopping event', async () => {
      // Active-event guard returns existing event
      mockQueryOne.mockResolvedValueOnce({
        id: 'existing-id',
        event_number: 'SE-050',
        state: 'IN_REPAIR',
      } as any);

      await expect(
        createShoppingEvent({ car_number: 'UTLX999999', shop_code: 'SHOP002' }, 'user-1')
      ).rejects.toThrow('already has an active shopping event');
    });
  });

  // ============================================================================
  // Get Shopping Event
  // ============================================================================
  describe('getShoppingEvent', () => {
    it('should return the shopping event when found', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'event-1',
        event_number: 'SE-001',
        state: 'INBOUND',
      } as any);

      const result = await getShoppingEvent('event-1');

      expect(result).toBeDefined();
      expect(result!.state).toBe('INBOUND');
    });

    it('should return null when shopping event is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getShoppingEvent('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // List Shopping Events
  // ============================================================================
  describe('listShoppingEvents', () => {
    it('should return filtered and paginated results', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '25' } as any);
      mockQuery.mockResolvedValueOnce([
        { id: 'e1', event_number: 'SE-001', state: 'REQUESTED' },
        { id: 'e2', event_number: 'SE-002', state: 'REQUESTED' },
      ] as any);

      const result = await listShoppingEvents({ state: 'REQUESTED', limit: 10, offset: 0 });

      expect(result.total).toBe(25);
      expect(result.events).toHaveLength(2);
    });
  });
});
