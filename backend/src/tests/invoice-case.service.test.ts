/**
 * Invoice Case Service Tests
 *
 * Tests state machine transitions, SAP_POSTED irreversibility,
 * validation rule enforcement during transitions, and CRUD operations.
 */

import {
  transitionState,
  createInvoiceCase,
  getInvoiceCase,
  assignCase,
  confirmSpecialLesseeApproval,
  revertLastTransition,
} from '../services/invoice-case.service';

// Mock the database pool
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
  query: jest.fn(),
  queryOne: jest.fn(),
}));

// Mock the invoice-validation service
jest.mock('../services/invoice-validation.service', () => ({
  validateInvoice: jest.fn(),
  saveValidationResult: jest.fn().mockResolvedValue(undefined),
}));

// Mock the transition-log service
jest.mock('../services/transition-log.service', () => ({
  logTransition: jest.fn().mockResolvedValue({ id: 'log-1' }),
  canRevert: jest.fn(),
  markReverted: jest.fn().mockResolvedValue(undefined),
  getLastTransition: jest.fn(),
}));

import { pool } from '../config/database';
import { validateInvoice } from '../services/invoice-validation.service';
import { canRevert, getLastTransition } from '../services/transition-log.service';

const mockPoolQuery = pool.query as jest.MockedFunction<typeof pool.query>;
const mockValidateInvoice = validateInvoice as jest.MockedFunction<typeof validateInvoice>;
const mockCanRevert = canRevert as jest.MockedFunction<typeof canRevert>;
const mockGetLastTransition = getLastTransition as jest.MockedFunction<typeof getLastTransition>;

// ==============================================================================
// Test Helpers
// ==============================================================================

function createMockCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1',
    case_number: 'INV-001',
    invoice_type: 'SHOP',
    workflow_state: 'RECEIVED',
    assigned_admin_id: null,
    total_amount: 1000,
    car_marks: ['UTLX123456'],
    lessee: null,
    special_lessee_approval_confirmed: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Mock the pool.query sequence for a SUCCESSFUL transitionState call:
 * 1. getInvoiceCase -> pool.query SELECT
 * 2. (validateInvoice is mocked separately)
 * 3. (saveValidationResult is mocked separately)
 * 4. pool.query UPDATE invoice_cases SET workflow_state
 * 5. pool.query SELECT is_reversible
 * 6. (logTransition is mocked separately)
 * 7. pool.query INSERT audit event (logAuditEvent)
 */
function mockSuccessfulTransition(fromState: string, toState: string) {
  const existingCase = createMockCase({ workflow_state: fromState });
  const updatedCase = createMockCase({ workflow_state: toState });

  // 1. getInvoiceCase
  mockPoolQuery.mockResolvedValueOnce({ rows: [existingCase] } as never);
  // 2. validateInvoice -- done separately
  // 4. UPDATE workflow_state
  mockPoolQuery.mockResolvedValueOnce({ rows: [updatedCase] } as never);
  // 5. SELECT is_reversible
  mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
  // 7. INSERT audit event
  mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

  mockValidateInvoice.mockResolvedValueOnce({
    caseId: 'case-1',
    targetState: toState as any,
    canTransition: true,
    blockingErrors: [],
    warnings: [],
    passedChecks: ['STATE_TRANSITION_VALID'],
    validatedAt: new Date(),
    context: {},
  });
}

/**
 * Mock the pool.query sequence for a BLOCKED transitionState call:
 * 1. getInvoiceCase -> pool.query SELECT
 * 2. (validateInvoice returns canTransition=false)
 * 3. (saveValidationResult is mocked separately)
 * 4. pool.query INSERT audit event for BLOCKED
 */
function mockBlockedTransition(fromState: string, toState: string, blockingErrors: any[]) {
  const existingCase = createMockCase({ workflow_state: fromState });

  // 1. getInvoiceCase
  mockPoolQuery.mockResolvedValueOnce({ rows: [existingCase] } as never);
  // 4. INSERT audit event for blocked
  mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

  mockValidateInvoice.mockResolvedValueOnce({
    caseId: 'case-1',
    targetState: toState as any,
    canTransition: false,
    blockingErrors,
    warnings: [],
    passedChecks: [],
    validatedAt: new Date(),
    context: {},
  });
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Invoice Case Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // State Transition: RECEIVED -> ASSIGNED
  // ============================================================================
  describe('Transition: RECEIVED -> ASSIGNED', () => {
    it('should succeed when validation passes', async () => {
      mockSuccessfulTransition('RECEIVED', 'ASSIGNED');

      const result = await transitionState('case-1', 'ASSIGNED', 'user-1');

      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('ASSIGNED');
    });
  });

  // ============================================================================
  // State Transition: ASSIGNED -> ADMIN_REVIEW
  // ============================================================================
  describe('Transition: ASSIGNED -> ADMIN_REVIEW', () => {
    it('should succeed when validation passes', async () => {
      mockSuccessfulTransition('ASSIGNED', 'ADMIN_REVIEW');

      const result = await transitionState('case-1', 'ADMIN_REVIEW', 'user-1');

      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('ADMIN_REVIEW');
    });
  });

  // ============================================================================
  // Blocked Transition: validation fails
  // ============================================================================
  describe('Blocked Transition', () => {
    it('should return failure when validation blocks the transition', async () => {
      mockBlockedTransition('RECEIVED', 'ASSIGNED', [
        { code: 'MISSING_PDF', message: 'PDF required', decision: 'BLOCK', owningRole: 'admin' },
      ]);

      const result = await transitionState('case-1', 'ASSIGNED', 'user-1');

      expect(result.success).toBe(false);
      expect(result.validation?.blockingErrors).toHaveLength(1);
      expect(result.error).toContain('PDF required');
    });
  });

  // ============================================================================
  // Case not found
  // ============================================================================
  describe('Case Not Found', () => {
    it('should return failure when case does not exist', async () => {
      // getInvoiceCase returns empty rows
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await transitionState('nonexistent', 'ASSIGNED', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice case not found');
    });
  });

  // ============================================================================
  // SAP_POSTED is irreversible
  // ============================================================================
  describe('SAP_POSTED Irreversibility', () => {
    it('should not allow revert from SAP_POSTED', async () => {
      mockCanRevert.mockResolvedValueOnce({
        allowed: false,
        blockers: ['This transition is marked as irreversible'],
      });

      await expect(
        revertLastTransition('case-1', 'user-1')
      ).rejects.toThrow('Cannot revert: This transition is marked as irreversible');
    });

    it('should not allow backward transitions from SAP_POSTED via validation', async () => {
      mockBlockedTransition('SAP_POSTED', 'APPROVED', [
        {
          code: 'INVALID_TRANSITION',
          message: 'Cannot transition backward from SAP_POSTED',
          decision: 'BLOCK',
          owningRole: 'system',
        },
      ]);

      const result = await transitionState('case-1', 'APPROVED', 'user-1');

      expect(result.success).toBe(false);
      expect(result.validation?.blockingErrors[0].code).toBe('INVALID_TRANSITION');
    });
  });

  // ============================================================================
  // Transition with warnings (should still succeed)
  // ============================================================================
  describe('Transition with Warnings', () => {
    it('should succeed with warnings but no blocking errors', async () => {
      const existingCase = createMockCase({ workflow_state: 'ASSIGNED' });
      const updatedCase = createMockCase({ workflow_state: 'ADMIN_REVIEW' });

      // 1. getInvoiceCase
      mockPoolQuery.mockResolvedValueOnce({ rows: [existingCase] } as never);
      // 4. UPDATE workflow_state
      mockPoolQuery.mockResolvedValueOnce({ rows: [updatedCase] } as never);
      // 5. SELECT is_reversible
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      // 7. INSERT audit event
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

      mockValidateInvoice.mockResolvedValueOnce({
        caseId: 'case-1',
        targetState: 'ADMIN_REVIEW',
        canTransition: true,
        blockingErrors: [],
        warnings: [{ code: 'ESTIMATE_VARIANCE_MINOR', message: 'Minor variance', decision: 'WARN', owningRole: 'admin' }],
        passedChecks: ['STATE_TRANSITION_VALID'],
        validatedAt: new Date(),
        context: {},
      });

      const result = await transitionState('case-1', 'ADMIN_REVIEW', 'user-1');

      expect(result.success).toBe(true);
      expect(result.validation?.warnings).toHaveLength(1);
    });
  });

  // ============================================================================
  // Assignment auto-transitions from RECEIVED to ASSIGNED
  // ============================================================================
  describe('assignCase', () => {
    it('should auto-transition to ASSIGNED when currently RECEIVED', async () => {
      const receivedCase = createMockCase({ workflow_state: 'RECEIVED' });
      const assignedResult = createMockCase({ assigned_admin_id: 'admin-1', workflow_state: 'RECEIVED' });

      // 1. getInvoiceCase in assignCase
      mockPoolQuery.mockResolvedValueOnce({ rows: [receivedCase] } as never);
      // 2. UPDATE assigned_admin_id
      mockPoolQuery.mockResolvedValueOnce({ rows: [assignedResult] } as never);
      // 3. logAuditEvent for assignment
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

      // Now the auto-transition calls transitionState('case-1', 'ASSIGNED', ...)
      // which does:
      // 4. getInvoiceCase
      mockPoolQuery.mockResolvedValueOnce({ rows: [receivedCase] } as never);
      // validateInvoice mock
      mockValidateInvoice.mockResolvedValueOnce({
        caseId: 'case-1',
        targetState: 'ASSIGNED',
        canTransition: true,
        blockingErrors: [],
        warnings: [],
        passedChecks: ['STATE_TRANSITION_VALID'],
        validatedAt: new Date(),
        context: {},
      });
      // 5. UPDATE workflow_state
      mockPoolQuery.mockResolvedValueOnce({
        rows: [createMockCase({ workflow_state: 'ASSIGNED', assigned_admin_id: 'admin-1' })],
      } as never);
      // 6. SELECT is_reversible
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      // 7. INSERT audit event
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await assignCase('case-1', 'admin-1', 'user-1');

      expect(result).toBeDefined();
      expect(result!.assigned_admin_id).toBe('admin-1');
    });
  });

  // ============================================================================
  // Special Lessee Approval
  // ============================================================================
  describe('confirmSpecialLesseeApproval', () => {
    it('should set the special lessee approval fields', async () => {
      // 1. UPDATE special_lessee_approval_confirmed
      mockPoolQuery.mockResolvedValueOnce({
        rows: [createMockCase({
          special_lessee_approval_confirmed: true,
          special_lessee_approved_by: 'user-1',
          special_lessee_approved_at: new Date(),
        })],
      } as never);
      // 2. logAuditEvent
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await confirmSpecialLesseeApproval('case-1', 'user-1', 'Approved by manager');

      expect(result).toBeDefined();
      expect(result!.special_lessee_approval_confirmed).toBe(true);
    });
  });

  // ============================================================================
  // Revert Last Transition (happy path)
  // ============================================================================
  describe('revertLastTransition', () => {
    it('should revert when the last transition is reversible', async () => {
      mockCanRevert.mockResolvedValueOnce({
        allowed: true,
        previousState: 'RECEIVED',
        transitionId: 'trans-1',
        blockers: [],
      });
      mockGetLastTransition.mockResolvedValueOnce({
        id: 'trans-1',
        from_state: 'RECEIVED',
        to_state: 'ASSIGNED',
        is_reversible: true,
      } as any);

      // The revert calls transitionState(caseId, 'RECEIVED', userId, ...)
      // Mock that full flow:
      const assignedCase = createMockCase({ workflow_state: 'ASSIGNED' });
      const revertedCase = createMockCase({ workflow_state: 'RECEIVED' });

      // getInvoiceCase
      mockPoolQuery.mockResolvedValueOnce({ rows: [assignedCase] } as never);
      // validateInvoice
      mockValidateInvoice.mockResolvedValueOnce({
        caseId: 'case-1',
        targetState: 'RECEIVED',
        canTransition: true,
        blockingErrors: [],
        warnings: [],
        passedChecks: ['STATE_TRANSITION_VALID'],
        validatedAt: new Date(),
        context: {},
      });
      // UPDATE workflow_state
      mockPoolQuery.mockResolvedValueOnce({ rows: [revertedCase] } as never);
      // SELECT is_reversible
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: false }] } as never);
      // logAuditEvent
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await revertLastTransition('case-1', 'user-1', 'Reverting for correction');

      expect(result).toBeDefined();
      expect(result.workflow_state).toBe('RECEIVED');
    });

    it('should throw when no previous state recorded', async () => {
      mockCanRevert.mockResolvedValueOnce({
        allowed: true,
        previousState: undefined,
        blockers: [],
      });

      await expect(
        revertLastTransition('case-1', 'user-1')
      ).rejects.toThrow('Cannot revert: no previous state recorded');
    });

    it('should throw when entity has already moved to a different state', async () => {
      mockCanRevert.mockResolvedValueOnce({
        allowed: false,
        blockers: ['Entity has moved to "ADMIN_REVIEW" since the transition to "ASSIGNED"'],
      });

      await expect(
        revertLastTransition('case-1', 'user-1')
      ).rejects.toThrow('Cannot revert: Entity has moved');
    });
  });
});
