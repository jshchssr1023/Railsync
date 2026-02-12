/**
 * Release Service Tests
 *
 * Tests the full car release lifecycle: initiation, approval, execution,
 * completion (with atomic rider_cars deactivation), cancellation,
 * convenience release from shopping events, and query functions.
 *
 * State machine under test:
 *   INITIATED -> APPROVED -> EXECUTING -> COMPLETED (terminal)
 *                                       -> CANCELLED (terminal from any non-terminal)
 */

import {
  initiateRelease,
  approveRelease,
  executeRelease,
  completeRelease,
  cancelRelease,
  releaseFromShoppingEvent,
  getRelease,
  listReleases,
  getActiveReleasesView,
} from '../services/release.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  pool: { query: jest.fn(), connect: jest.fn() },
}));

// Mock dependent services
jest.mock('../services/transition-log.service', () => ({
  logTransition: jest.fn().mockResolvedValue({ id: 'log-1' }),
  canRevert: jest.fn(),
  markReverted: jest.fn().mockResolvedValue(undefined),
  getLastTransition: jest.fn(),
}));

jest.mock('../services/assetEvent.service', () => ({
  recordEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/alerts.service', () => ({
  createAlert: jest.fn().mockResolvedValue({ id: 'alert-1' }),
}));

import { query, queryOne, transaction } from '../config/database';
import { logTransition } from '../services/transition-log.service';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;
const mockLogTransition = logTransition as jest.MockedFunction<typeof logTransition>;

// ==============================================================================
// Test Helpers
// ==============================================================================

function createMockRelease(overrides: Record<string, unknown> = {}) {
  return {
    id: 'release-1',
    car_number: 'UTLX123456',
    rider_id: 'rider-1',
    assignment_id: 'assign-1',
    shopping_event_id: null,
    release_type: 'lease_expiry',
    status: 'INITIATED',
    initiated_by: 'user-1',
    approved_by: null,
    approved_at: null,
    completed_by: null,
    completed_at: null,
    cancelled_by: null,
    cancelled_at: null,
    cancellation_reason: null,
    transition_id: null,
    notes: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Release Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Initiate Release
  // ============================================================================
  describe('initiateRelease', () => {
    it('should create a release when car is active on rider and no duplicate exists', async () => {
      const mockRelease = createMockRelease();

      // 1st queryOne: rider_cars lookup - car is active on rider
      mockQueryOne.mockResolvedValueOnce({ car_number: 'UTLX123456', is_active: true } as any);
      // 2nd queryOne: duplicate check - no existing non-terminal release
      mockQueryOne.mockResolvedValueOnce(null);
      // 3rd queryOne: INSERT RETURNING *
      mockQueryOne.mockResolvedValueOnce(mockRelease as any);

      const result = await initiateRelease(
        {
          car_number: 'UTLX123456',
          rider_id: 'rider-1',
          release_type: 'lease_expiry',
          assignment_id: 'assign-1',
          notes: 'Lease ending',
        },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('release-1');
      expect(result.status).toBe('INITIATED');
      expect(result.car_number).toBe('UTLX123456');
      expect(result.rider_id).toBe('rider-1');
      // Verify rider_cars validation was called
      expect(mockQueryOne).toHaveBeenCalledTimes(3);
    });

    it('should throw when car is not active on the rider', async () => {
      // rider_cars lookup returns null (car not active)
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        initiateRelease(
          {
            car_number: 'UTLX999999',
            rider_id: 'rider-1',
            release_type: 'lease_expiry',
          },
          'user-1'
        )
      ).rejects.toThrow('Car UTLX999999 is not active on rider rider-1');
    });

    it('should throw when a duplicate pending release exists for the car', async () => {
      // rider_cars lookup - car is active
      mockQueryOne.mockResolvedValueOnce({ car_number: 'UTLX123456', is_active: true } as any);
      // duplicate check - existing non-terminal release found
      mockQueryOne.mockResolvedValueOnce({ id: 'release-existing', status: 'APPROVED' } as any);

      await expect(
        initiateRelease(
          {
            car_number: 'UTLX123456',
            rider_id: 'rider-1',
            release_type: 'lease_expiry',
          },
          'user-1'
        )
      ).rejects.toThrow('Car UTLX123456 already has an active release (APPROVED)');
    });

    it('should throw when the INSERT returns null', async () => {
      mockQueryOne.mockResolvedValueOnce({ car_number: 'UTLX123456', is_active: true } as any);
      mockQueryOne.mockResolvedValueOnce(null); // no duplicate
      mockQueryOne.mockResolvedValueOnce(null); // INSERT fails, returns null

      await expect(
        initiateRelease(
          {
            car_number: 'UTLX123456',
            rider_id: 'rider-1',
            release_type: 'voluntary_return',
          },
          'user-1'
        )
      ).rejects.toThrow('Failed to create release');
    });

    it('should log a transition after successful initiation', async () => {
      const mockRelease = createMockRelease();

      mockQueryOne.mockResolvedValueOnce({ car_number: 'UTLX123456', is_active: true } as any);
      mockQueryOne.mockResolvedValueOnce(null);
      mockQueryOne.mockResolvedValueOnce(mockRelease as any);

      await initiateRelease(
        {
          car_number: 'UTLX123456',
          rider_id: 'rider-1',
          release_type: 'lease_expiry',
        },
        'user-1'
      );

      expect(mockLogTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          processType: 'car_release',
          entityId: 'release-1',
          entityNumber: 'UTLX123456',
          fromState: undefined,
          toState: 'INITIATED',
          isReversible: true,
          actorId: 'user-1',
        })
      );
    });
  });

  // ============================================================================
  // Approve Release
  // ============================================================================
  describe('approveRelease', () => {
    it('should approve a release in INITIATED status', async () => {
      const initiated = createMockRelease({ status: 'INITIATED' });
      const approved = createMockRelease({
        status: 'APPROVED',
        approved_by: 'user-2',
        approved_at: '2026-01-16T00:00:00Z',
      });

      // getRelease call inside approveRelease
      mockQueryOne.mockResolvedValueOnce(initiated as any);
      // UPDATE RETURNING *
      mockQueryOne.mockResolvedValueOnce(approved as any);

      const result = await approveRelease('release-1', 'user-2', 'Looks good');

      expect(result).toBeDefined();
      expect(result.status).toBe('APPROVED');
      expect(result.approved_by).toBe('user-2');
    });

    it('should throw when release is not in INITIATED status', async () => {
      const executing = createMockRelease({ status: 'EXECUTING' });
      mockQueryOne.mockResolvedValueOnce(executing as any);

      await expect(
        approveRelease('release-1', 'user-2')
      ).rejects.toThrow('Cannot approve release in status EXECUTING');
    });

    it('should throw when release is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        approveRelease('nonexistent', 'user-2')
      ).rejects.toThrow('Release nonexistent not found');
    });
  });

  // ============================================================================
  // Execute Release
  // ============================================================================
  describe('executeRelease', () => {
    it('should move an APPROVED release to EXECUTING', async () => {
      const approved = createMockRelease({ status: 'APPROVED' });
      const executing = createMockRelease({ status: 'EXECUTING' });

      mockQueryOne.mockResolvedValueOnce(approved as any);
      mockQueryOne.mockResolvedValueOnce(executing as any);

      const result = await executeRelease('release-1', 'user-3');

      expect(result).toBeDefined();
      expect(result.status).toBe('EXECUTING');
    });

    it('should throw when release is not in APPROVED status', async () => {
      const initiated = createMockRelease({ status: 'INITIATED' });
      mockQueryOne.mockResolvedValueOnce(initiated as any);

      await expect(
        executeRelease('release-1', 'user-3')
      ).rejects.toThrow('Cannot execute release in status INITIATED');
    });

    it('should throw when release is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        executeRelease('nonexistent', 'user-3')
      ).rejects.toThrow('Release nonexistent not found');
    });

    it('should log a non-reversible transition on execution', async () => {
      const approved = createMockRelease({ status: 'APPROVED' });
      const executing = createMockRelease({ status: 'EXECUTING' });

      mockQueryOne.mockResolvedValueOnce(approved as any);
      mockQueryOne.mockResolvedValueOnce(executing as any);

      await executeRelease('release-1', 'user-3');

      expect(mockLogTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          processType: 'car_release',
          fromState: 'APPROVED',
          toState: 'EXECUTING',
          isReversible: false,
          actorId: 'user-3',
        })
      );
    });
  });

  // ============================================================================
  // Complete Release (Atomic Transaction)
  // ============================================================================
  describe('completeRelease', () => {
    it('should atomically complete release and deactivate rider_cars', async () => {
      const executing = createMockRelease({
        status: 'EXECUTING',
        assignment_id: 'assign-1',
        transition_id: 'trans-1',
      });
      const completed = createMockRelease({
        status: 'COMPLETED',
        completed_by: 'user-4',
        completed_at: '2026-01-17T00:00:00Z',
      });

      // getRelease inside completeRelease
      mockQueryOne.mockResolvedValueOnce(executing as any);

      // transaction mock: call the callback with a mock client
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            // 1. UPDATE car_releases SET status = 'COMPLETED'
            .mockResolvedValueOnce({ rows: [completed] })
            // 2. UPDATE rider_cars SET status = 'off_rent'
            .mockResolvedValueOnce({ rows: [] })
            // 3. UPDATE car_assignments (linked assignment)
            .mockResolvedValueOnce({ rows: [] })
            // 4. UPDATE car_lease_transitions (linked transition)
            .mockResolvedValueOnce({ rows: [] }),
        };
        return callback(mockClient);
      });

      // After transaction: queryOne for car lookup (asset event)
      mockQueryOne.mockResolvedValueOnce({ id: 'car-uuid-1' } as any);

      const result = await completeRelease('release-1', 'user-4', 'All done');

      expect(result).toBeDefined();
      expect(result.status).toBe('COMPLETED');
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('should deactivate rider_cars within the transaction', async () => {
      const executing = createMockRelease({
        status: 'EXECUTING',
        assignment_id: null,
        transition_id: null,
      });
      const completed = createMockRelease({ status: 'COMPLETED', completed_by: 'user-4' });

      mockQueryOne.mockResolvedValueOnce(executing as any);

      let capturedClient: any;
      mockTransaction.mockImplementation(async (callback: any) => {
        capturedClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [completed] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return callback(capturedClient);
      });

      // car lookup for asset event
      mockQueryOne.mockResolvedValueOnce({ id: 'car-uuid-1' } as any);

      await completeRelease('release-1', 'user-4');

      // Only 2 queries: release update + rider_cars deactivation (no linked assignment/transition)
      expect(capturedClient.query).toHaveBeenCalledTimes(2);
      const deactivateCall = capturedClient.query.mock.calls[1];
      expect(deactivateCall[0]).toContain('UPDATE rider_cars');
      expect(deactivateCall[0]).toContain('is_active = FALSE');
      expect(deactivateCall[1]).toEqual(['rider-1', 'UTLX123456']);
    });

    it('should throw when release is not in EXECUTING status', async () => {
      const approved = createMockRelease({ status: 'APPROVED' });
      mockQueryOne.mockResolvedValueOnce(approved as any);

      await expect(
        completeRelease('release-1', 'user-4')
      ).rejects.toThrow('Cannot complete release in status APPROVED');
    });

    it('should throw when release is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        completeRelease('nonexistent', 'user-4')
      ).rejects.toThrow('Release nonexistent not found');
    });

    it('should complete linked assignment and transition within the transaction', async () => {
      const executing = createMockRelease({
        status: 'EXECUTING',
        assignment_id: 'assign-99',
        transition_id: 'trans-99',
      });
      const completed = createMockRelease({ status: 'COMPLETED' });

      mockQueryOne.mockResolvedValueOnce(executing as any);

      let capturedClient: any;
      mockTransaction.mockImplementation(async (callback: any) => {
        capturedClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [completed] })  // release update
            .mockResolvedValueOnce({ rows: [] })            // rider_cars deactivate
            .mockResolvedValueOnce({ rows: [] })            // assignment complete
            .mockResolvedValueOnce({ rows: [] }),           // transition complete
        };
        return callback(capturedClient);
      });

      mockQueryOne.mockResolvedValueOnce({ id: 'car-uuid-1' } as any);

      await completeRelease('release-1', 'user-4', 'Done');

      // Should have 4 queries in the transaction
      expect(capturedClient.query).toHaveBeenCalledTimes(4);

      // 3rd call: UPDATE car_assignments
      const assignmentCall = capturedClient.query.mock.calls[2];
      expect(assignmentCall[0]).toContain('UPDATE car_assignments');
      expect(assignmentCall[1]).toContain('assign-99');

      // 4th call: UPDATE car_lease_transitions
      const transitionCall = capturedClient.query.mock.calls[3];
      expect(transitionCall[0]).toContain('UPDATE car_lease_transitions');
      expect(transitionCall[1]).toContain('trans-99');
    });

    it('should skip assignment and transition updates when not linked', async () => {
      const executing = createMockRelease({
        status: 'EXECUTING',
        assignment_id: null,
        transition_id: null,
      });
      const completed = createMockRelease({ status: 'COMPLETED' });

      mockQueryOne.mockResolvedValueOnce(executing as any);

      let capturedClient: any;
      mockTransaction.mockImplementation(async (callback: any) => {
        capturedClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [completed] })  // release update
            .mockResolvedValueOnce({ rows: [] }),           // rider_cars deactivate
        };
        return callback(capturedClient);
      });

      mockQueryOne.mockResolvedValueOnce(null); // car lookup returns null

      await completeRelease('release-1', 'user-4');

      // Only 2 queries: release update + rider_cars deactivation (no assignment/transition)
      expect(capturedClient.query).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Cancel Release
  // ============================================================================
  describe('cancelRelease', () => {
    it('should cancel a release from INITIATED status', async () => {
      const initiated = createMockRelease({ status: 'INITIATED' });
      const cancelled = createMockRelease({
        status: 'CANCELLED',
        cancelled_by: 'user-5',
        cancelled_at: '2026-01-18T00:00:00Z',
        cancellation_reason: 'Plans changed',
      });

      mockQueryOne.mockResolvedValueOnce(initiated as any);
      mockQueryOne.mockResolvedValueOnce(cancelled as any);

      const result = await cancelRelease('release-1', 'user-5', 'Plans changed');

      expect(result).toBeDefined();
      expect(result.status).toBe('CANCELLED');
      expect(result.cancellation_reason).toBe('Plans changed');
    });

    it('should cancel a release from APPROVED status', async () => {
      const approved = createMockRelease({ status: 'APPROVED' });
      const cancelled = createMockRelease({ status: 'CANCELLED' });

      mockQueryOne.mockResolvedValueOnce(approved as any);
      mockQueryOne.mockResolvedValueOnce(cancelled as any);

      const result = await cancelRelease('release-1', 'user-5', 'No longer needed');

      expect(result.status).toBe('CANCELLED');
    });

    it('should cancel a release from EXECUTING status', async () => {
      const executing = createMockRelease({ status: 'EXECUTING' });
      const cancelled = createMockRelease({ status: 'CANCELLED' });

      mockQueryOne.mockResolvedValueOnce(executing as any);
      mockQueryOne.mockResolvedValueOnce(cancelled as any);

      const result = await cancelRelease('release-1', 'user-5', 'Abort release');

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw when trying to cancel a COMPLETED release', async () => {
      const completed = createMockRelease({ status: 'COMPLETED' });
      mockQueryOne.mockResolvedValueOnce(completed as any);

      await expect(
        cancelRelease('release-1', 'user-5', 'Too late')
      ).rejects.toThrow('Cannot cancel release in terminal status COMPLETED');
    });

    it('should throw when trying to cancel an already CANCELLED release', async () => {
      const cancelled = createMockRelease({ status: 'CANCELLED' });
      mockQueryOne.mockResolvedValueOnce(cancelled as any);

      await expect(
        cancelRelease('release-1', 'user-5', 'Double cancel')
      ).rejects.toThrow('Cannot cancel release in terminal status CANCELLED');
    });

    it('should throw when release is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        cancelRelease('nonexistent', 'user-5', 'Does not exist')
      ).rejects.toThrow('Release nonexistent not found');
    });
  });

  // ============================================================================
  // Get Release
  // ============================================================================
  describe('getRelease', () => {
    it('should return a release when found', async () => {
      const mockRelease = createMockRelease();
      mockQueryOne.mockResolvedValueOnce(mockRelease as any);

      const result = await getRelease('release-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('release-1');
      expect(result!.car_number).toBe('UTLX123456');
      expect(mockQueryOne).toHaveBeenCalledWith(
        'SELECT * FROM car_releases WHERE id = $1',
        ['release-1']
      );
    });

    it('should return null when release is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getRelease('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // List Releases
  // ============================================================================
  describe('listReleases', () => {
    it('should return filtered releases with pagination', async () => {
      // COUNT query
      mockQueryOne.mockResolvedValueOnce({ total: '25' } as any);
      // SELECT releases
      mockQuery.mockResolvedValueOnce([
        createMockRelease({ id: 'release-1' }),
        createMockRelease({ id: 'release-2' }),
      ] as any);

      const result = await listReleases({
        car_number: 'UTLX',
        status: 'INITIATED',
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(25);
      expect(result.releases).toHaveLength(2);
    });

    it('should return empty results when no releases match', async () => {
      mockQueryOne.mockResolvedValueOnce({ total: '0' } as any);
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await listReleases({ status: 'COMPLETED' });

      expect(result.total).toBe(0);
      expect(result.releases).toHaveLength(0);
    });

    it('should apply rider_id filter', async () => {
      mockQueryOne.mockResolvedValueOnce({ total: '3' } as any);
      mockQuery.mockResolvedValueOnce([
        createMockRelease({ id: 'release-1', rider_id: 'rider-7' }),
      ] as any);

      const result = await listReleases({ rider_id: 'rider-7' });

      expect(result.total).toBe(3);
      expect(result.releases).toHaveLength(1);
      // Verify the COUNT query included rider_id condition
      const countCall = mockQueryOne.mock.calls[0];
      expect(countCall[0]).toContain('rider_id');
    });

    it('should apply release_type filter', async () => {
      mockQueryOne.mockResolvedValueOnce({ total: '5' } as any);
      mockQuery.mockResolvedValueOnce([
        createMockRelease({ release_type: 'shop_complete' }),
      ] as any);

      const result = await listReleases({ release_type: 'shop_complete' });

      expect(result.total).toBe(5);
      const countCall = mockQueryOne.mock.calls[0];
      expect(countCall[0]).toContain('release_type');
    });

    it('should use default limit and offset when not provided', async () => {
      mockQueryOne.mockResolvedValueOnce({ total: '2' } as any);
      mockQuery.mockResolvedValueOnce([
        createMockRelease({ id: 'release-1' }),
        createMockRelease({ id: 'release-2' }),
      ] as any);

      const result = await listReleases({});

      expect(result.total).toBe(2);
      expect(result.releases).toHaveLength(2);
      // Verify LIMIT 50 OFFSET 0 defaults were used in the SELECT query
      const selectCall = mockQuery.mock.calls[0];
      expect(selectCall[1]).toContain(50);  // default limit
      expect(selectCall[1]).toContain(0);   // default offset
    });
  });

  // ============================================================================
  // Get Active Releases View
  // ============================================================================
  describe('getActiveReleasesView', () => {
    it('should return data from the materialized view', async () => {
      const viewData = [
        createMockRelease({ id: 'release-1', status: 'INITIATED' }),
        createMockRelease({ id: 'release-2', status: 'EXECUTING' }),
      ];
      mockQuery.mockResolvedValueOnce(viewData as any);

      const result = await getActiveReleasesView();

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM v_active_releases ORDER BY created_at DESC',
        []
      );
    });

    it('should return empty array when no active releases exist', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await getActiveReleasesView();

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // Release From Shopping Event (Convenience)
  // ============================================================================
  describe('releaseFromShoppingEvent', () => {
    it('should create a release from a shopping event with linked assignment', async () => {
      const mockRelease = createMockRelease({
        release_type: 'shop_complete',
        shopping_event_id: 'event-1',
        assignment_id: 'assign-55',
      });

      // 1st queryOne: find rider for car (releaseFromShoppingEvent)
      mockQueryOne.mockResolvedValueOnce({ rider_id: 'rider-1' } as any);
      // 2nd queryOne: find linked assignment
      mockQueryOne.mockResolvedValueOnce({ id: 'assign-55' } as any);
      // 3rd queryOne: rider_cars validation (inside initiateRelease)
      mockQueryOne.mockResolvedValueOnce({ car_number: 'UTLX123456', is_active: true } as any);
      // 4th queryOne: duplicate check (inside initiateRelease)
      mockQueryOne.mockResolvedValueOnce(null);
      // 5th queryOne: INSERT RETURNING * (inside initiateRelease)
      mockQueryOne.mockResolvedValueOnce(mockRelease as any);

      const result = await releaseFromShoppingEvent(
        'event-1',
        'UTLX123456',
        'SHOP001',
        'user-6'
      );

      expect(result).toBeDefined();
      expect(result.release_type).toBe('shop_complete');
      expect(result.shopping_event_id).toBe('event-1');
    });

    it('should throw when car is not active on any rider', async () => {
      // rider_cars lookup returns null
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        releaseFromShoppingEvent('event-1', 'UTLX999999', 'SHOP001', 'user-6')
      ).rejects.toThrow('Car UTLX999999 is not active on any rider');
    });

    it('should create release without linked assignment when none found', async () => {
      const mockRelease = createMockRelease({
        release_type: 'shop_complete',
        shopping_event_id: 'event-2',
        assignment_id: null,
      });

      // find rider for car
      mockQueryOne.mockResolvedValueOnce({ rider_id: 'rider-1' } as any);
      // find linked assignment - none found
      mockQueryOne.mockResolvedValueOnce(null);
      // rider_cars validation (inside initiateRelease)
      mockQueryOne.mockResolvedValueOnce({ car_number: 'UTLX123456', is_active: true } as any);
      // duplicate check
      mockQueryOne.mockResolvedValueOnce(null);
      // INSERT RETURNING *
      mockQueryOne.mockResolvedValueOnce(mockRelease as any);

      const result = await releaseFromShoppingEvent(
        'event-2',
        'UTLX123456',
        'SHOP002',
        'user-6'
      );

      expect(result).toBeDefined();
      expect(result.assignment_id).toBeNull();
      expect(result.release_type).toBe('shop_complete');
    });
  });
});
