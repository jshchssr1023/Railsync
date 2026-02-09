/**
 * End-to-End Workflow Integration Tests
 *
 * This test suite validates critical business workflows across the Railsync platform:
 * 1. Shopping Event Lifecycle - from request to release with approval gates
 * 2. Invoice Case Workflow - from receipt through SAP posting with validation
 * 3. Cross-Process Integration - interactions between shopping and invoicing
 *
 * Tests verify state transitions, audit logging, revert eligibility, and business rules.
 */

import {
  createShoppingEvent,
  transitionState as shoppingTransition,
  revertLastTransition as revertShoppingTransition,
  ShoppingEventState,
} from '../services/shopping-event.service';

import {
  createInvoiceCase,
  transitionState as invoiceTransition,
  revertLastTransition as revertInvoiceTransition,
} from '../services/invoice-case.service';

import {
  logTransition,
  canRevert,
  markReverted,
  getLastTransition,
} from '../services/transition-log.service';

// ==============================================================================
// Mock Database Configuration
// ==============================================================================

jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  pool: { query: jest.fn() },
}));

// Mock invoice validation service
jest.mock('../services/invoice-validation.service', () => ({
  validateInvoice: jest.fn(),
  saveValidationResult: jest.fn().mockResolvedValue(undefined),
  WorkflowState: jest.fn(),
  ValidationResult: jest.fn(),
  InvoiceType: jest.fn(),
}));

// Mock transition-log service
jest.mock('../services/transition-log.service', () => ({
  logTransition: jest.fn(),
  canRevert: jest.fn(),
  markReverted: jest.fn(),
  getLastTransition: jest.fn(),
}));

import { query, queryOne, transaction, pool } from '../config/database';
import { validateInvoice, saveValidationResult } from '../services/invoice-validation.service';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;
const mockPoolQuery = pool.query as jest.MockedFunction<typeof pool.query>;
const mockValidateInvoice = validateInvoice as jest.MockedFunction<typeof validateInvoice>;
const mockSaveValidationResult = saveValidationResult as jest.MockedFunction<typeof saveValidationResult>;
const mockLogTransition = logTransition as jest.MockedFunction<typeof logTransition>;
const mockCanRevert = canRevert as jest.MockedFunction<typeof canRevert>;
const mockMarkReverted = markReverted as jest.MockedFunction<typeof markReverted>;
const mockGetLastTransition = getLastTransition as jest.MockedFunction<typeof getLastTransition>;

// ==============================================================================
// Test Helpers
// ==============================================================================

function mockShoppingEventState(state: ShoppingEventState, eventNumber: string = 'SE-001') {
  mockQueryOne.mockResolvedValueOnce({ state, event_number: eventNumber } as any);
}

function mockShoppingEventUpdate(state: ShoppingEventState) {
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
  mockQueryOne.mockResolvedValueOnce({ count: '1' } as any);
}

function mockApprovalGateFail() {
  mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);
}

function mockResponsibilityLocked() {
  mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);
}

function createMockInvoiceCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1',
    case_number: 'INV-001',
    invoice_type: 'SHOP',
    workflow_state: 'RECEIVED',
    assigned_admin_id: null,
    total_amount: 5000,
    car_marks: ['UTLX123456'],
    lessee: null,
    special_lessee_approval_confirmed: false,
    currency: 'USD',
    received_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function mockInvoiceValidationSuccess(toState: string) {
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

function mockInvoiceValidationFailure(toState: string, errorMessage: string) {
  mockValidateInvoice.mockResolvedValueOnce({
    caseId: 'case-1',
    targetState: toState as any,
    canTransition: false,
    blockingErrors: [{
      code: 'VALIDATION_ERROR',
      message: errorMessage,
      decision: 'BLOCK' as const,
      owningRole: 'admin' as const,
    }],
    warnings: [],
    passedChecks: [],
    validatedAt: new Date(),
    context: {},
  });
}

// ==============================================================================
// Test Suite 1: Shopping Event Lifecycle
// ==============================================================================

describe('E2E Workflow: Shopping Event Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogTransition.mockResolvedValue({ id: 'log-1' } as any);
  });

  describe('Creating a Shopping Event', () => {
    it('should create a shopping event in REQUESTED state', async () => {
      // Mock active-event guard (no existing active event)
      mockQueryOne.mockResolvedValueOnce(null);

      // Mock generate_event_number function
      mockQueryOne.mockResolvedValueOnce({ generate_event_number: 'SE-100' } as any);

      // Mock INSERT RETURNING
      mockQueryOne.mockResolvedValueOnce({
        id: 'new-event-id',
        event_number: 'SE-100',
        car_number: 'UTLX999999',
        shop_code: 'SHOP002',
        state: 'REQUESTED',
        version: 1,
        created_by_id: 'user-1',
      } as any);

      const result = await createShoppingEvent(
        { car_number: 'UTLX999999', shop_code: 'SHOP002' },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(result.event_number).toBe('SE-100');
      expect(result.state).toBe('REQUESTED');
      expect(result.car_number).toBe('UTLX999999');
    });
  });

  describe('Complete State Transition Lifecycle', () => {
    it('should successfully transition through all states: REQUESTED → RELEASED', async () => {
      const userId = 'user-1';
      const eventId = 'event-1';

      // Transition 1: REQUESTED → ASSIGNED_TO_SHOP
      mockShoppingEventState('REQUESTED');
      mockShoppingEventUpdate('ASSIGNED_TO_SHOP');
      let result = await shoppingTransition(eventId, 'ASSIGNED_TO_SHOP', userId);
      expect(result.state).toBe('ASSIGNED_TO_SHOP');
      expect(mockLogTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          processType: 'shopping_event',
          entityId: eventId,
          fromState: 'REQUESTED',
          toState: 'ASSIGNED_TO_SHOP',
          isReversible: true,
        })
      );

      // Transition 2: ASSIGNED_TO_SHOP → INBOUND
      mockShoppingEventState('ASSIGNED_TO_SHOP');
      mockShoppingEventUpdate('INBOUND');
      result = await shoppingTransition(eventId, 'INBOUND', userId);
      expect(result.state).toBe('INBOUND');
      expect(mockLogTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: 'ASSIGNED_TO_SHOP',
          toState: 'INBOUND',
          isReversible: true,
        })
      );

      // Transition 3: INBOUND → INSPECTION
      mockShoppingEventState('INBOUND');
      mockShoppingEventUpdate('INSPECTION');
      result = await shoppingTransition(eventId, 'INSPECTION', userId);
      expect(result.state).toBe('INSPECTION');

      // Transition 4: INSPECTION → ESTIMATE_SUBMITTED
      mockShoppingEventState('INSPECTION');
      mockShoppingEventUpdate('ESTIMATE_SUBMITTED');
      result = await shoppingTransition(eventId, 'ESTIMATE_SUBMITTED', userId);
      expect(result.state).toBe('ESTIMATE_SUBMITTED');

      // Transition 5: ESTIMATE_SUBMITTED → ESTIMATE_UNDER_REVIEW
      mockShoppingEventState('ESTIMATE_SUBMITTED');
      mockShoppingEventUpdate('ESTIMATE_UNDER_REVIEW');
      result = await shoppingTransition(eventId, 'ESTIMATE_UNDER_REVIEW', userId);
      expect(result.state).toBe('ESTIMATE_UNDER_REVIEW');

      // Transition 6: ESTIMATE_UNDER_REVIEW → ESTIMATE_APPROVED
      mockShoppingEventState('ESTIMATE_UNDER_REVIEW');
      mockShoppingEventUpdate('ESTIMATE_APPROVED');
      result = await shoppingTransition(eventId, 'ESTIMATE_APPROVED', userId);
      expect(result.state).toBe('ESTIMATE_APPROVED');

      // Transition 7: ESTIMATE_APPROVED → WORK_AUTHORIZED (requires approval gate)
      mockApprovalGatePass(); // Approved estimate exists
      mockShoppingEventState('ESTIMATE_APPROVED');
      mockShoppingEventUpdate('WORK_AUTHORIZED');
      result = await shoppingTransition(eventId, 'WORK_AUTHORIZED', userId);
      expect(result.state).toBe('WORK_AUTHORIZED');

      // Transition 8: WORK_AUTHORIZED → IN_REPAIR
      mockShoppingEventState('WORK_AUTHORIZED');
      mockShoppingEventUpdate('IN_REPAIR');
      result = await shoppingTransition(eventId, 'IN_REPAIR', userId);
      expect(result.state).toBe('IN_REPAIR');

      // Transition 9: IN_REPAIR → QA_COMPLETE
      mockShoppingEventState('IN_REPAIR');
      mockShoppingEventUpdate('QA_COMPLETE');
      result = await shoppingTransition(eventId, 'QA_COMPLETE', userId);
      expect(result.state).toBe('QA_COMPLETE');

      // Transition 10: QA_COMPLETE → FINAL_ESTIMATE_SUBMITTED
      mockShoppingEventState('QA_COMPLETE');
      mockShoppingEventUpdate('FINAL_ESTIMATE_SUBMITTED');
      result = await shoppingTransition(eventId, 'FINAL_ESTIMATE_SUBMITTED', userId);
      expect(result.state).toBe('FINAL_ESTIMATE_SUBMITTED');

      // Transition 11: FINAL_ESTIMATE_SUBMITTED → FINAL_ESTIMATE_APPROVED (requires approval gate)
      mockApprovalGatePass(); // Approved final estimate exists
      mockShoppingEventState('FINAL_ESTIMATE_SUBMITTED');
      mockShoppingEventUpdate('FINAL_ESTIMATE_APPROVED');
      result = await shoppingTransition(eventId, 'FINAL_ESTIMATE_APPROVED', userId);
      expect(result.state).toBe('FINAL_ESTIMATE_APPROVED');

      // Transition 12: FINAL_ESTIMATE_APPROVED → READY_FOR_RELEASE (requires approval + responsibility lock)
      mockApprovalGatePass(); // Approved final estimate exists
      mockResponsibilityLocked(); // No unresolved responsibilities
      mockShoppingEventState('FINAL_ESTIMATE_APPROVED');
      mockShoppingEventUpdate('READY_FOR_RELEASE');
      result = await shoppingTransition(eventId, 'READY_FOR_RELEASE', userId);
      expect(result.state).toBe('READY_FOR_RELEASE');

      // Transition 13: READY_FOR_RELEASE → RELEASED (terminal state)
      mockApprovalGatePass(); // Approved final estimate exists
      mockResponsibilityLocked(); // No unresolved responsibilities
      mockShoppingEventState('READY_FOR_RELEASE');
      mockShoppingEventUpdate('RELEASED');
      result = await shoppingTransition(eventId, 'RELEASED', userId);
      expect(result.state).toBe('RELEASED');

      // Verify logTransition was called for all transitions
      expect(mockLogTransition).toHaveBeenCalledTimes(13);
    });
  });

  describe('Transition Logging', () => {
    it('should call logTransition for each state change', async () => {
      mockShoppingEventState('REQUESTED');
      mockShoppingEventUpdate('ASSIGNED_TO_SHOP');

      await shoppingTransition('event-1', 'ASSIGNED_TO_SHOP', 'user-1', 'Test notes');

      expect(mockLogTransition).toHaveBeenCalledWith({
        processType: 'shopping_event',
        entityId: 'event-1',
        entityNumber: 'SE-001',
        fromState: 'REQUESTED',
        toState: 'ASSIGNED_TO_SHOP',
        isReversible: true,
        actorId: 'user-1',
        notes: 'Test notes',
      });
    });
  });

  describe('Reversible Transition Revert', () => {
    it('should successfully revert a reversible transition', async () => {
      const eventId = 'event-1';
      const userId = 'user-1';

      // Mock canRevert to allow revert
      mockCanRevert.mockResolvedValueOnce({
        allowed: true,
        previousState: 'REQUESTED',
        transitionId: 'trans-1',
        blockers: [],
      });

      // Mock getLastTransition
      mockGetLastTransition.mockResolvedValueOnce({
        id: 'trans-1',
        from_state: 'REQUESTED',
        to_state: 'ASSIGNED_TO_SHOP',
        is_reversible: true,
      } as any);

      // Mock the reverse transition (ASSIGNED_TO_SHOP → REQUESTED)
      mockShoppingEventState('ASSIGNED_TO_SHOP');
      mockShoppingEventUpdate('REQUESTED');

      // Mock second getLastTransition for reversal transition
      mockGetLastTransition.mockResolvedValueOnce({
        id: 'trans-2',
        from_state: 'ASSIGNED_TO_SHOP',
        to_state: 'REQUESTED',
      } as any);

      const result = await revertShoppingTransition(eventId, userId);

      expect(result.state).toBe('REQUESTED');
      expect(mockCanRevert).toHaveBeenCalledWith('shopping_event', eventId);
      expect(mockMarkReverted).toHaveBeenCalledWith('trans-1', userId, 'trans-2');
    });
  });

  describe('Irreversible Transition Blocking', () => {
    it('should block revert of an irreversible transition', async () => {
      const eventId = 'event-1';
      const userId = 'user-1';

      // Mock canRevert to disallow revert
      mockCanRevert.mockResolvedValueOnce({
        allowed: false,
        previousState: 'IN_REPAIR',
        transitionId: 'trans-5',
        blockers: ['This transition is marked as irreversible'],
      });

      await expect(
        revertShoppingTransition(eventId, userId)
      ).rejects.toThrow('Cannot revert: This transition is marked as irreversible');

      expect(mockCanRevert).toHaveBeenCalledWith('shopping_event', eventId);
      expect(mockMarkReverted).not.toHaveBeenCalled();
    });
  });

  describe('Approval Gate Enforcement', () => {
    it('should block WORK_AUTHORIZED transition without approved estimate', async () => {
      mockApprovalGateFail(); // No approved estimate

      await expect(
        shoppingTransition('event-1', 'WORK_AUTHORIZED', 'user-1')
      ).rejects.toThrow('Gate blocked: cannot authorise work without an approved estimate');
    });

    it('should block READY_FOR_RELEASE without responsibility lock', async () => {
      mockApprovalGatePass(); // Approved final estimate exists
      mockQueryOne.mockResolvedValueOnce({ count: '5' } as any); // 5 unresolved responsibilities

      await expect(
        shoppingTransition('event-1', 'READY_FOR_RELEASE', 'user-1')
      ).rejects.toThrow(/5 estimate line\(s\) have unresolved responsibility/);
    });
  });
});

// ==============================================================================
// Test Suite 2: Invoice Case Workflow
// ==============================================================================

describe('E2E Workflow: Invoice Case Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogTransition.mockResolvedValue({ id: 'log-1' } as any);
    mockSaveValidationResult.mockResolvedValue(undefined);
  });

  describe('Creating an Invoice Case', () => {
    it('should create an invoice case in RECEIVED state', async () => {
      const newCase = createMockInvoiceCase({ workflow_state: 'RECEIVED' });

      mockPoolQuery.mockResolvedValueOnce({ rows: [newCase] } as never); // INSERT
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never); // logAuditEvent

      const result = await createInvoiceCase(
        {
          invoice_type: 'SHOP',
          vendor_name: 'Test Vendor',
          total_amount: 5000,
        },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(result.workflow_state).toBe('RECEIVED');
    });
  });

  describe('Complete State Transition Lifecycle', () => {
    it('should successfully transition through all states: RECEIVED → SAP_POSTED', async () => {
      const caseId = 'case-1';
      const userId = 'user-1';

      // Transition 1: RECEIVED → ASSIGNED
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'RECEIVED' })] } as never); // getInvoiceCase
      mockInvoiceValidationSuccess('ASSIGNED');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'ASSIGNED' })] } as never); // UPDATE
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never); // SELECT is_reversible
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never); // logAuditEvent
      let result = await invoiceTransition(caseId, 'ASSIGNED', userId);
      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('ASSIGNED');

      // Transition 2: ASSIGNED → ADMIN_REVIEW
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'ASSIGNED' })] } as never);
      mockInvoiceValidationSuccess('ADMIN_REVIEW');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'ADMIN_REVIEW' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);
      result = await invoiceTransition(caseId, 'ADMIN_REVIEW', userId);
      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('ADMIN_REVIEW');

      // Transition 3: ADMIN_REVIEW → SUBMITTED
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'ADMIN_REVIEW' })] } as never);
      mockInvoiceValidationSuccess('SUBMITTED');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'SUBMITTED' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);
      result = await invoiceTransition(caseId, 'SUBMITTED', userId);
      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('SUBMITTED');

      // Transition 4: SUBMITTED → APPROVER_REVIEW
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'SUBMITTED' })] } as never);
      mockInvoiceValidationSuccess('APPROVER_REVIEW');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'APPROVER_REVIEW' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);
      result = await invoiceTransition(caseId, 'APPROVER_REVIEW', userId);
      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('APPROVER_REVIEW');

      // Transition 5: APPROVER_REVIEW → APPROVED
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'APPROVER_REVIEW' })] } as never);
      mockInvoiceValidationSuccess('APPROVED');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'APPROVED' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);
      result = await invoiceTransition(caseId, 'APPROVED', userId);
      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('APPROVED');

      // Transition 6: APPROVED → BILLING_REVIEW
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'APPROVED' })] } as never);
      mockInvoiceValidationSuccess('BILLING_REVIEW');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'BILLING_REVIEW' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);
      result = await invoiceTransition(caseId, 'BILLING_REVIEW', userId);
      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('BILLING_REVIEW');

      // Transition 7: BILLING_REVIEW → BILLING_APPROVED
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'BILLING_REVIEW' })] } as never);
      mockInvoiceValidationSuccess('BILLING_APPROVED');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'BILLING_APPROVED' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);
      result = await invoiceTransition(caseId, 'BILLING_APPROVED', userId);
      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('BILLING_APPROVED');

      // Transition 8: BILLING_APPROVED → SAP_STAGED
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'BILLING_APPROVED' })] } as never);
      mockInvoiceValidationSuccess('SAP_STAGED');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'SAP_STAGED' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);
      result = await invoiceTransition(caseId, 'SAP_STAGED', userId);
      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('SAP_STAGED');

      // Transition 9: SAP_STAGED → SAP_POSTED (irreversible terminal state)
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'SAP_STAGED' })] } as never);
      mockInvoiceValidationSuccess('SAP_POSTED');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'SAP_POSTED' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: false }] } as never); // Irreversible!
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);
      result = await invoiceTransition(caseId, 'SAP_POSTED', userId);
      expect(result.success).toBe(true);
      expect(result.case?.workflow_state).toBe('SAP_POSTED');

      // Verify logTransition was called with correct reversibility flags
      expect(mockLogTransition).toHaveBeenCalledTimes(9);
      expect(mockLogTransition).toHaveBeenLastCalledWith(
        expect.objectContaining({
          processType: 'invoice_case',
          toState: 'SAP_POSTED',
          isReversible: false, // SAP_POSTED is irreversible
        })
      );
    });
  });

  describe('Revert Eligibility Check', () => {
    it('should successfully revert a reversible invoice transition', async () => {
      const caseId = 'case-1';
      const userId = 'user-1';

      // Mock canRevert to allow revert
      mockCanRevert.mockResolvedValueOnce({
        allowed: true,
        previousState: 'ADMIN_REVIEW',
        transitionId: 'trans-1',
        blockers: [],
      });

      // Mock getLastTransition
      mockGetLastTransition.mockResolvedValueOnce({
        id: 'trans-1',
        from_state: 'ADMIN_REVIEW',
        to_state: 'SUBMITTED',
        is_reversible: true,
        case_number: 'INV-001',
      } as any);

      // Mock the reverse transition (SUBMITTED → ADMIN_REVIEW)
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'SUBMITTED' })] } as never); // getInvoiceCase
      mockInvoiceValidationSuccess('ADMIN_REVIEW');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'ADMIN_REVIEW' })] } as never); // UPDATE
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never); // SELECT is_reversible
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never); // logAuditEvent

      const result = await revertInvoiceTransition(caseId, userId, 'Reverting submission');

      expect(result.workflow_state).toBe('ADMIN_REVIEW');
      expect(mockCanRevert).toHaveBeenCalledWith('invoice_case', caseId);
    });
  });

  describe('SAP_POSTED Revert Blocking', () => {
    it('should block revert of SAP_POSTED transition', async () => {
      const caseId = 'case-1';
      const userId = 'user-1';

      // Mock canRevert to disallow revert (SAP_POSTED is irreversible)
      mockCanRevert.mockResolvedValueOnce({
        allowed: false,
        previousState: 'SAP_STAGED',
        transitionId: 'trans-9',
        blockers: ['This transition is marked as irreversible'],
      });

      await expect(
        revertInvoiceTransition(caseId, userId)
      ).rejects.toThrow('Cannot revert: This transition is marked as irreversible');

      expect(mockCanRevert).toHaveBeenCalledWith('invoice_case', caseId);
    });
  });

  describe('Validation Rule Enforcement', () => {
    it('should block transition when validation fails', async () => {
      const caseId = 'case-1';
      const userId = 'user-1';

      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'RECEIVED' })] } as never);
      mockInvoiceValidationFailure('ASSIGNED', 'Missing required attachments');
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never); // logAuditEvent for blocked transition

      const result = await invoiceTransition(caseId, 'ASSIGNED', userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required attachments');
      expect(result.validation?.canTransition).toBe(false);
    });
  });
});

// ==============================================================================
// Test Suite 3: Cross-Process Integration
// ==============================================================================

describe('E2E Workflow: Cross-Process Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogTransition.mockResolvedValue({ id: 'log-1' } as any);
    mockSaveValidationResult.mockResolvedValue(undefined);
  });

  describe('Shopping Request Approval Creates Shopping Event', () => {
    it('should create a shopping event when a shopping request is approved', async () => {
      const userId = 'user-1';

      // Simulate shopping request approval creating a shopping event
      // 0. Active-event guard (no existing active event)
      mockQueryOne.mockResolvedValueOnce(null);

      // 1. Generate event number
      mockQueryOne.mockResolvedValueOnce({ generate_event_number: 'SE-200' } as any);

      // 2. Insert shopping event
      mockQueryOne.mockResolvedValueOnce({
        id: 'event-2',
        event_number: 'SE-200',
        car_number: 'UTLX777777',
        shop_code: 'SHOP003',
        state: 'REQUESTED',
        version: 1,
        created_by_id: userId,
      } as any);

      const shoppingEvent = await createShoppingEvent(
        {
          car_number: 'UTLX777777',
          shop_code: 'SHOP003',
          shopping_type_code: 'REPAIR',
        },
        userId
      );

      expect(shoppingEvent).toBeDefined();
      expect(shoppingEvent.state).toBe('REQUESTED');
      expect(shoppingEvent.event_number).toBe('SE-200');

      // This would typically be triggered by a shopping request approval
      // Here we verify the integration point exists
    });
  });

  describe('Shopping Event Completion Triggers Invoice Eligibility', () => {
    it('should make shopping event eligible for invoicing after RELEASED state', async () => {
      const userId = 'user-1';
      const eventId = 'event-1';

      // Complete the shopping event lifecycle to RELEASED
      mockApprovalGatePass(); // Approved final estimate
      mockResponsibilityLocked(); // Locked responsibilities
      mockShoppingEventState('READY_FOR_RELEASE');
      mockShoppingEventUpdate('RELEASED');

      const releasedEvent = await shoppingTransition(eventId, 'RELEASED', userId);

      expect(releasedEvent.state).toBe('RELEASED');

      // Now the event should be eligible for invoice creation
      // Simulate creating an invoice case linked to this shopping event
      const newInvoiceCase = createMockInvoiceCase({
        fms_shopping_id: eventId,
        invoice_type: 'SHOP',
        car_marks: ['UTLX123456'],
      });

      mockPoolQuery.mockResolvedValueOnce({ rows: [newInvoiceCase] } as never); // INSERT
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never); // logAuditEvent

      const invoiceCase = await createInvoiceCase(
        {
          invoice_type: 'SHOP',
          fms_shopping_id: eventId,
          vendor_name: 'Shop Vendor',
          car_marks: ['UTLX123456'],
          total_amount: 10000,
        },
        userId
      );

      expect(invoiceCase).toBeDefined();
      expect(invoiceCase.fms_shopping_id).toBe(eventId);
      expect(invoiceCase.workflow_state).toBe('RECEIVED');
    });
  });

  describe('End-to-End: Shopping Event → Invoice Processing → SAP Posting', () => {
    it('should complete full cycle from shopping event to SAP posting', async () => {
      const userId = 'user-1';
      const eventId = 'event-1';

      // PHASE 1: Complete shopping event to RELEASED
      mockApprovalGatePass();
      mockResponsibilityLocked();
      mockShoppingEventState('READY_FOR_RELEASE');
      mockShoppingEventUpdate('RELEASED');

      const releasedEvent = await shoppingTransition(eventId, 'RELEASED', userId);
      expect(releasedEvent.state).toBe('RELEASED');

      // PHASE 2: Create invoice case from shopping event
      const newInvoiceCase = createMockInvoiceCase({
        fms_shopping_id: eventId,
        invoice_type: 'SHOP',
      });

      mockPoolQuery.mockResolvedValueOnce({ rows: [newInvoiceCase] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

      const invoiceCase = await createInvoiceCase(
        {
          invoice_type: 'SHOP',
          fms_shopping_id: eventId,
          total_amount: 8500,
        },
        userId
      );

      expect(invoiceCase.fms_shopping_id).toBe(eventId);

      // PHASE 3: Process invoice through to SAP_POSTED
      const caseId = invoiceCase.id;

      // RECEIVED → ASSIGNED
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'RECEIVED' })] } as never);
      mockInvoiceValidationSuccess('ASSIGNED');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'ASSIGNED' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);
      await invoiceTransition(caseId, 'ASSIGNED', userId);

      // ... intermediate states (ADMIN_REVIEW → SUBMITTED → APPROVER_REVIEW → APPROVED → BILLING_REVIEW → BILLING_APPROVED → SAP_STAGED)
      // Fast-forward to SAP_POSTED for brevity

      // SAP_STAGED → SAP_POSTED
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'SAP_STAGED' })] } as never);
      mockInvoiceValidationSuccess('SAP_POSTED');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'SAP_POSTED' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: false }] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

      const finalResult = await invoiceTransition(caseId, 'SAP_POSTED', userId);

      expect(finalResult.success).toBe(true);
      expect(finalResult.case?.workflow_state).toBe('SAP_POSTED');

      // Verify the complete workflow was logged
      expect(mockLogTransition).toHaveBeenCalled();
    });
  });

  describe('Transition Log Audit Trail', () => {
    it('should maintain complete audit trail across both processes', async () => {
      const userId = 'user-1';

      // Shopping event transition
      mockShoppingEventState('REQUESTED');
      mockShoppingEventUpdate('ASSIGNED_TO_SHOP');
      await shoppingTransition('event-1', 'ASSIGNED_TO_SHOP', userId, 'Assigned to shop for repair');

      // Invoice case transition
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'RECEIVED' })] } as never);
      mockInvoiceValidationSuccess('ASSIGNED');
      mockPoolQuery.mockResolvedValueOnce({ rows: [createMockInvoiceCase({ workflow_state: 'ASSIGNED' })] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_reversible: true }] } as never);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);
      await invoiceTransition('case-1', 'ASSIGNED', userId, 'Assigned to admin for review');

      // Verify both processes logged transitions
      expect(mockLogTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          processType: 'shopping_event',
          actorId: userId,
          notes: 'Assigned to shop for repair',
        })
      );

      expect(mockLogTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          processType: 'invoice_case',
          actorId: userId,
          notes: 'Assigned to admin for review',
        })
      );
    });
  });
});
