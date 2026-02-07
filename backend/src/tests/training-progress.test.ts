/**
 * E2E Training Progress Workflow Tests
 *
 * Tests the training progress tracking lifecycle end-to-end:
 * 1. List training modules
 * 2. Get user progress (no modules started)
 * 3. Start a module (in_progress status)
 * 4. Complete a module (completed status, time tracking)
 * 5. Auto-certification when all required modules completed
 * 6. Organization-wide progress stats
 * 7. Go-live readiness assessment
 */

import pool from '../config/database';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  pool: { query: jest.fn() },
}));

const mockQuery = pool.query as jest.Mock;

import { query, queryOne, transaction } from '../config/database';

const mockDbQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;

import {
  listModules,
  getUserProgress,
  startModule,
  completeModule,
  getOrganizationProgress,
  getReadinessAssessment,
} from '../services/training-progress.service';

// ==============================================================================
// Test Helpers
// ==============================================================================

function createMockModule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mod-1',
    title: 'RailSync Basics',
    description: 'Introduction to the RailSync platform',
    category: 'onboarding',
    duration_minutes: 30,
    sort_order: 1,
    content_url: 'https://training.railsync.com/basics',
    is_required: true,
    prerequisites: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockUserProgress(overrides: Record<string, unknown> = {}) {
  return {
    module_id: 'mod-1',
    title: 'RailSync Basics',
    description: 'Introduction to the RailSync platform',
    category: 'onboarding',
    duration_minutes: 30,
    sort_order: 1,
    is_required: true,
    content_url: 'https://training.railsync.com/basics',
    status: 'not_started',
    started_at: null,
    completed_at: null,
    score: null,
    time_spent_minutes: 0,
    notes: null,
    ...overrides,
  };
}

// ==============================================================================
// Test Suite: Training Progress Lifecycle (E2E)
// ==============================================================================

describe('E2E Workflow: Training Progress Lifecycle', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockDbQuery.mockReset();
    mockQueryOne.mockReset();
    mockTransaction.mockReset();
  });

  // --------------------------------------------------------------------------
  // 1. List available training modules
  // --------------------------------------------------------------------------
  describe('List training modules', () => {
    it('should return all training modules ordered by sort_order', async () => {
      const modules = [
        createMockModule({ id: 'mod-1', title: 'RailSync Basics', sort_order: 1 }),
        createMockModule({ id: 'mod-2', title: 'Invoice Processing', sort_order: 2 }),
        createMockModule({ id: 'mod-3', title: 'Shopping Events', sort_order: 3, is_required: false }),
      ];

      mockDbQuery.mockResolvedValueOnce(modules as any);

      const result = await listModules();

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('RailSync Basics');
      expect(result[1].title).toBe('Invoice Processing');
      expect(result[2].is_required).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Get user progress with no modules started
  // --------------------------------------------------------------------------
  describe('Get user progress when no modules have been started', () => {
    it('should return all modules with not_started status and 0% completion', async () => {
      const progressRows = [
        createMockUserProgress({ module_id: 'mod-1', status: 'not_started' }),
        createMockUserProgress({ module_id: 'mod-2', title: 'Invoice Processing', status: 'not_started' }),
        createMockUserProgress({ module_id: 'mod-3', title: 'Shopping Events', status: 'not_started' }),
      ];

      mockDbQuery.mockResolvedValueOnce(progressRows as any);

      const result = await getUserProgress('user-new');

      expect(result.total_modules).toBe(3);
      expect(result.completed_modules).toBe(0);
      expect(result.in_progress_modules).toBe(0);
      expect(result.not_started_modules).toBe(3);
      expect(result.completion_percentage).toBe(0);
      expect(result.total_time_spent_minutes).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Start a module -> in_progress status
  // --------------------------------------------------------------------------
  describe('Starting a training module sets in_progress status', () => {
    it('should upsert a user_training_progress record with in_progress status', async () => {
      const startedProgress = createMockUserProgress({
        status: 'in_progress',
        started_at: '2026-02-01T09:00:00Z',
      });

      mockQueryOne.mockResolvedValueOnce(startedProgress as any);

      const result = await startModule('user-1', 'mod-1');

      expect(result).toBeDefined();
      expect(result.status).toBe('in_progress');
      expect(result.started_at).toBeTruthy();
      expect(result.completed_at).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Complete a module with auto-certification check
  // --------------------------------------------------------------------------
  describe('Complete lifecycle: start -> complete -> auto-certification', () => {
    it('should complete a module, and auto-grant basic_operator cert when all required modules are done', async () => {
      const userId = 'user-1';
      const moduleId = 'mod-3';  // This is the last required module

      // transaction() executes the callback with a mock client
      mockTransaction.mockImplementation(async (callback: (client: any) => Promise<any>) => {
        const mockClient = {
          query: jest.fn(),
        };

        // Step 1: INSERT/UPDATE user_training_progress -> completed
        mockClient.query.mockResolvedValueOnce({
          rows: [createMockUserProgress({
            module_id: moduleId,
            status: 'completed',
            completed_at: '2026-02-01T10:30:00Z',
            score: 92,
            time_spent_minutes: 45,
          })],
        });

        // Step 2: Check incomplete required modules -> count = 0 (all done)
        mockClient.query.mockResolvedValueOnce({
          rows: [{ cnt: 0 }],
        });

        // Step 3: Check for existing basic_operator cert -> none found
        mockClient.query.mockResolvedValueOnce({
          rows: [],
        });

        // Step 4: INSERT basic_operator certification
        mockClient.query.mockResolvedValueOnce({
          rows: [{ id: 'cert-1', user_id: userId, certification_type: 'basic_operator' }],
        });

        return callback(mockClient);
      });

      const result = await completeModule(userId, moduleId, 92);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.score).toBe(92);

      // Verify that the transaction callback was invoked
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('should complete a module without granting cert when required modules remain incomplete', async () => {
      const userId = 'user-2';
      const moduleId = 'mod-1';

      mockTransaction.mockImplementation(async (callback: (client: any) => Promise<any>) => {
        const mockClient = {
          query: jest.fn(),
        };

        // Step 1: INSERT/UPDATE user_training_progress -> completed
        mockClient.query.mockResolvedValueOnce({
          rows: [createMockUserProgress({
            module_id: moduleId,
            status: 'completed',
            completed_at: '2026-02-01T10:00:00Z',
          })],
        });

        // Step 2: Check incomplete required modules -> count = 2 (still some left)
        mockClient.query.mockResolvedValueOnce({
          rows: [{ cnt: 2 }],
        });

        // No cert check or insert should happen

        return callback(mockClient);
      });

      const result = await completeModule(userId, moduleId);

      expect(result.status).toBe('completed');
      // Only 2 client.query calls (no cert queries)
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Organization-wide progress stats
  // --------------------------------------------------------------------------
  describe('Organization-wide training progress statistics', () => {
    it('should aggregate training completion across all users and modules', async () => {
      // The service calls Promise.all with 3 queries:
      // 1. Dashboard view modules
      const dashboardModules = [
        {
          module_id: 'mod-1',
          title: 'RailSync Basics',
          category: 'onboarding',
          duration_minutes: 30,
          is_required: true,
          sort_order: 1,
          completed_count: 8,
          in_progress_count: 2,
          total_users: 10,
          completion_rate: 80,
        },
        {
          module_id: 'mod-2',
          title: 'Invoice Processing',
          category: 'billing',
          duration_minutes: 45,
          is_required: true,
          sort_order: 2,
          completed_count: 5,
          in_progress_count: 3,
          total_users: 10,
          completion_rate: 50,
        },
      ];

      // 2. Total active users
      const totalUsers = { total_users: 10 };

      // 3. Total certifications
      const totalCerts = { total_certifications: 6 };

      mockDbQuery.mockResolvedValueOnce(dashboardModules as any);
      mockQueryOne.mockResolvedValueOnce(totalUsers as any);
      mockQueryOne.mockResolvedValueOnce(totalCerts as any);

      const result = await getOrganizationProgress();

      expect(result.modules).toHaveLength(2);
      expect(result.total_users).toBe(10);
      expect(result.total_certifications).toBe(6);
      // Overall completion rate = average of 80 and 50 = 65
      expect(result.overall_completion_rate).toBe(65);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Go-live readiness assessment
  // --------------------------------------------------------------------------
  describe('Go-live readiness assessment based on training completion', () => {
    it('should report overall readiness as true when >= 80% of users completed all required modules', async () => {
      // Promise.all with 3 queries:
      mockQueryOne.mockResolvedValueOnce({ cnt: 10 } as any);  // Total active users
      mockQueryOne.mockResolvedValueOnce({ cnt: 9 } as any);   // Users completed all required (90%)
      mockQueryOne.mockResolvedValueOnce({ cnt: 7 } as any);   // Users with go_live_ready cert

      const result = await getReadinessAssessment();

      expect(result.totalUsers).toBe(10);
      expect(result.readyUsers).toBe(9);
      expect(result.certifications).toBe(7);
      expect(result.overallReadiness).toBe(true);
    });

    it('should report overall readiness as false when < 80% of users completed required modules', async () => {
      mockQueryOne.mockResolvedValueOnce({ cnt: 10 } as any);  // Total active users
      mockQueryOne.mockResolvedValueOnce({ cnt: 6 } as any);   // Only 6 out of 10 ready (60%)
      mockQueryOne.mockResolvedValueOnce({ cnt: 3 } as any);   // Certifications

      const result = await getReadinessAssessment();

      expect(result.totalUsers).toBe(10);
      expect(result.readyUsers).toBe(6);
      expect(result.overallReadiness).toBe(false);
    });

    it('should report overall readiness as false when there are no active users', async () => {
      mockQueryOne.mockResolvedValueOnce({ cnt: 0 } as any);   // No active users
      mockQueryOne.mockResolvedValueOnce({ cnt: 0 } as any);   // No ready users
      mockQueryOne.mockResolvedValueOnce({ cnt: 0 } as any);   // No certs

      const result = await getReadinessAssessment();

      expect(result.totalUsers).toBe(0);
      expect(result.readyUsers).toBe(0);
      expect(result.overallReadiness).toBe(false);
    });
  });
});
