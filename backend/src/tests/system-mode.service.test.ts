/**
 * System Mode Service Tests
 *
 * Tests valid and invalid system mode transitions during cutover.
 * Modes: parallel -> cutover -> live (with rollback: cutover -> parallel)
 */

import {
  getSystemMode,
  setSystemMode,
  getSystemSetting,
  setSystemSetting,
} from '../services/system-mode.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
}));

import { query, queryOne } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

// ==============================================================================
// Test Helpers
// ==============================================================================

function mockCurrentMode(mode: string) {
  // getSystemMode makes three queryOne calls:
  // 1. system_mode
  mockQueryOne.mockResolvedValueOnce({
    value: JSON.stringify(mode),
    updated_at: '2026-01-15T10:00:00Z',
    updated_by: 'user-1',
  } as any);
  // 2. cutover_started_at
  mockQueryOne.mockResolvedValueOnce(
    mode === 'cutover' || mode === 'live'
      ? { value: JSON.stringify('2026-01-15T10:00:00Z') }
      : null
  );
  // 3. go_live_date
  mockQueryOne.mockResolvedValueOnce(
    mode === 'live'
      ? { value: JSON.stringify('2026-02-01T00:00:00Z') }
      : null
  );
}

function mockSetModeUpdate() {
  // UPDATE system_settings for mode
  mockQuery.mockResolvedValueOnce([] as any);
}

function mockSetTimestampUpdate() {
  // UPDATE system_settings for cutover_started_at or go_live_date
  mockQuery.mockResolvedValueOnce([] as any);
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('System Mode Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Valid Transition: parallel -> cutover
  // ============================================================================
  describe('Transition: parallel -> cutover', () => {
    it('should succeed when transitioning from parallel to cutover', async () => {
      // getSystemMode for validation
      mockCurrentMode('parallel');

      // UPDATE mode to cutover
      mockSetModeUpdate();
      // SET cutover_started_at
      mockSetTimestampUpdate();

      // getSystemMode for return value
      mockCurrentMode('cutover');

      const result = await setSystemMode('cutover', 'user-1');

      expect(result.mode).toBe('cutover');
      expect(result.cutover_started_at).not.toBeNull();
    });
  });

  // ============================================================================
  // Valid Transition: cutover -> live
  // ============================================================================
  describe('Transition: cutover -> live', () => {
    it('should succeed when transitioning from cutover to live', async () => {
      mockCurrentMode('cutover');
      mockSetModeUpdate();
      mockSetTimestampUpdate(); // go_live_date
      mockCurrentMode('live');

      const result = await setSystemMode('live', 'user-1');

      expect(result.mode).toBe('live');
      expect(result.go_live_date).not.toBeNull();
    });
  });

  // ============================================================================
  // Valid Transition: cutover -> parallel (rollback)
  // ============================================================================
  describe('Transition: cutover -> parallel (rollback)', () => {
    it('should allow rolling back from cutover to parallel', async () => {
      mockCurrentMode('cutover');
      mockSetModeUpdate();
      // No timestamp update for parallel (no cutover or go-live date set)
      mockCurrentMode('parallel');

      const result = await setSystemMode('parallel', 'user-1');

      expect(result.mode).toBe('parallel');
    });
  });

  // ============================================================================
  // Invalid Transition: live -> anything
  // ============================================================================
  describe('Transition: live -> (anything)', () => {
    it('should throw when attempting to transition from live to parallel', async () => {
      mockCurrentMode('live');

      await expect(
        setSystemMode('parallel', 'user-1')
      ).rejects.toThrow("Cannot transition from 'live' to 'parallel'. Allowed: none");
    });

    it('should throw when attempting to transition from live to cutover', async () => {
      mockCurrentMode('live');

      await expect(
        setSystemMode('cutover', 'user-1')
      ).rejects.toThrow("Cannot transition from 'live' to 'cutover'. Allowed: none");
    });
  });

  // ============================================================================
  // Invalid Transition: parallel -> live (skipping cutover)
  // ============================================================================
  describe('Transition: parallel -> live (invalid skip)', () => {
    it('should throw when attempting to skip directly from parallel to live', async () => {
      mockCurrentMode('parallel');

      await expect(
        setSystemMode('live', 'user-1')
      ).rejects.toThrow("Cannot transition from 'parallel' to 'live'. Allowed: cutover");
    });
  });

  // ============================================================================
  // getSystemMode
  // ============================================================================
  describe('getSystemMode', () => {
    it('should return the current system mode info', async () => {
      mockCurrentMode('parallel');

      const result = await getSystemMode();

      expect(result.mode).toBe('parallel');
      expect(result.cutover_started_at).toBeNull();
      expect(result.go_live_date).toBeNull();
      expect(result.updated_at).toBeDefined();
    });

    it('should default to parallel when no mode is set', async () => {
      // system_mode not found
      mockQueryOne.mockResolvedValueOnce(null);
      // cutover_started_at
      mockQueryOne.mockResolvedValueOnce(null);
      // go_live_date
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getSystemMode();

      expect(result.mode).toBe('parallel');
    });
  });

  // ============================================================================
  // getSystemSetting
  // ============================================================================
  describe('getSystemSetting', () => {
    it('should return parsed JSON value for a setting', async () => {
      mockQueryOne.mockResolvedValueOnce({
        value: JSON.stringify({ max_retries: 3 }),
      } as any);

      const result = await getSystemSetting('max_retries');

      expect(result).toEqual({ max_retries: 3 });
    });

    it('should return null when setting not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getSystemSetting('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // setSystemSetting
  // ============================================================================
  describe('setSystemSetting', () => {
    it('should upsert a system setting', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      await setSystemSetting('maintenance_window', '02:00-04:00', 'user-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_settings'),
        ['maintenance_window', JSON.stringify('02:00-04:00'), 'user-1']
      );
    });
  });
});
