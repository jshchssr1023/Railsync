/**
 * Transition Log Service Tests
 *
 * Tests state transition logging, revert eligibility checks, and history tracking
 */

import {
  logTransition,
  getLastTransition,
  canRevert,
  markReverted,
  getTransitionHistory,
} from '../services/transition-log.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  pool: { query: jest.fn() },
}));

import { pool } from '../config/database';

const mockQuery = pool.query as jest.Mock;

describe('Transition Log Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Log Transition
  // ============================================================================
  describe('logTransition', () => {
    it('should log a state transition', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'trans-1',
          process_type: 'shopping_event',
          entity_id: 'event-1',
          entity_number: 'SE-001',
          from_state: 'REQUESTED',
          to_state: 'ASSIGNED_TO_SHOP',
          is_reversible: true,
          actor_id: 'user-1',
        }],
      } as any);

      const result = await logTransition({
        processType: 'shopping_event',
        entityId: 'event-1',
        entityNumber: 'SE-001',
        fromState: 'REQUESTED',
        toState: 'ASSIGNED_TO_SHOP',
        isReversible: true,
        actorId: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.process_type).toBe('shopping_event');
      expect(result.to_state).toBe('ASSIGNED_TO_SHOP');
    });

    it('should handle side effects in transition log', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'trans-1',
          side_effects: [
            { type: 'create', entity_type: 'shopping_event', entity_id: 'event-2' },
          ],
        }],
      } as any);

      const result = await logTransition({
        processType: 'allocation',
        entityId: 'alloc-1',
        fromState: 'Need Shopping',
        toState: 'Planned Shopping',
        isReversible: true,
        sideEffects: [
          { type: 'create', entity_type: 'shopping_event', entity_id: 'event-2' },
        ],
      });

      expect(result.side_effects).toHaveLength(1);
    });
  });

  // ============================================================================
  // Get Last Transition
  // ============================================================================
  describe('getLastTransition', () => {
    it('should return the most recent non-reversed transition', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'trans-3',
          process_type: 'shopping_event',
          entity_id: 'event-1',
          from_state: 'INBOUND',
          to_state: 'IN_REPAIR',
          reversed_at: null,
        }],
      } as any);

      const result = await getLastTransition('shopping_event', 'event-1');

      expect(result).toBeDefined();
      expect(result!.to_state).toBe('IN_REPAIR');
      expect(result!.reversed_at).toBeNull();
    });

    it('should return null when no transitions exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await getLastTransition('shopping_event', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Can Revert
  // ============================================================================
  describe('canRevert', () => {
    it('should allow revert when conditions are met', async () => {
      // getLastTransition
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'trans-1',
          from_state: 'REQUESTED',
          to_state: 'ASSIGNED_TO_SHOP',
          is_reversible: true,
          side_effects: [],
        }],
      } as any);

      // getCurrentEntityState
      mockQuery.mockResolvedValueOnce({
        rows: [{ state: 'ASSIGNED_TO_SHOP' }],
      } as any);

      const result = await canRevert('shopping_event', 'event-1');

      expect(result.allowed).toBe(true);
      expect(result.blockers).toHaveLength(0);
      expect(result.previousState).toBe('REQUESTED');
    });

    it('should block revert when transition is irreversible', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'trans-1',
          from_state: 'QA_COMPLETE',
          to_state: 'RELEASED',
          is_reversible: false,
        }],
      } as any);

      const result = await canRevert('shopping_event', 'event-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers).toContain('This transition is marked as irreversible');
    });

    it('should block revert when entity has moved to different state', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'trans-1',
          from_state: 'INBOUND',
          to_state: 'IN_REPAIR',
          is_reversible: true,
          side_effects: [],
        }],
      } as any);

      mockQuery.mockResolvedValueOnce({
        rows: [{ state: 'QA_COMPLETE' }],
      } as any);

      const result = await canRevert('shopping_event', 'event-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.blockers[0]).toContain('has moved to');
    });

    it('should block revert when side effects have advanced', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'trans-1',
          to_state: 'Planned Shopping',
          is_reversible: true,
          side_effects: [
            { type: 'create', entity_type: 'shopping_event', entity_id: 'event-2' },
          ],
        }],
      } as any);

      mockQuery.mockResolvedValueOnce({
        rows: [{ status: 'Planned Shopping' }],
      } as any);

      // Check side effect state
      mockQuery.mockResolvedValueOnce({
        rows: [{ state: 'IN_REPAIR' }],
      } as any);

      const result = await canRevert('allocation', 'alloc-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers.some(b => b.includes('has advanced'))).toBe(true);
    });

    it('should return no transition when entity has no history', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await canRevert('shopping_event', 'event-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers).toContain('No transition history found');
    });
  });

  // ============================================================================
  // Mark Reverted
  // ============================================================================
  describe('markReverted', () => {
    it('should mark transition as reverted', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      await markReverted('trans-1', 'user-1', 'reversal-trans-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE state_transition_log'),
        ['trans-1', 'user-1', 'reversal-trans-1']
      );
    });
  });

  // ============================================================================
  // Get Transition History
  // ============================================================================
  describe('getTransitionHistory', () => {
    it('should return full transition history for entity', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'trans-1',
            process_type: 'shopping_event',
            entity_id: 'event-1',
            from_state: null,
            to_state: 'REQUESTED',
            created_at: '2026-01-01T10:00:00Z',
          },
          {
            id: 'trans-2',
            process_type: 'shopping_event',
            entity_id: 'event-1',
            from_state: 'REQUESTED',
            to_state: 'ASSIGNED_TO_SHOP',
            created_at: '2026-01-02T10:00:00Z',
          },
          {
            id: 'trans-3',
            process_type: 'shopping_event',
            entity_id: 'event-1',
            from_state: 'ASSIGNED_TO_SHOP',
            to_state: 'INBOUND',
            created_at: '2026-01-03T10:00:00Z',
          },
        ],
      } as any);

      const result = await getTransitionHistory('shopping_event', 'event-1');

      expect(result).toHaveLength(3);
      expect(result[0].to_state).toBe('REQUESTED');
      expect(result[1].to_state).toBe('ASSIGNED_TO_SHOP');
      expect(result[2].to_state).toBe('INBOUND');
    });

    it('should return empty array when no history exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await getTransitionHistory('shopping_event', 'nonexistent');

      expect(result).toHaveLength(0);
    });
  });
});
