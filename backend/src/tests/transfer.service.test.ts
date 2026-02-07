/**
 * Transfer Service Tests
 *
 * Tests the full car-to-rider transfer workflow:
 * validateTransferPrerequisites, initiateTransfer, confirmTransfer,
 * completeTransfer, cancelTransfer, getTransfer, listTransfers,
 * getTransferOverview, getRiderTransfers.
 *
 * Covers happy paths, validation blockers, invalid state transitions,
 * atomic operations, and query filtering/pagination.
 */

import {
  validateTransferPrerequisites,
  initiateTransfer,
  confirmTransfer,
  completeTransfer,
  cancelTransfer,
  getTransfer,
  listTransfers,
  getTransferOverview,
  getRiderTransfers,
  CarTransfer,
  InitiateTransferInput,
} from '../services/transfer.service';

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
}));

jest.mock('../services/assetEvent.service', () => ({
  recordEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/alerts.service', () => ({
  createAlert: jest.fn().mockResolvedValue({ id: 'alert-1' }),
}));

import { query, queryOne, transaction } from '../config/database';
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;

// ============================================================================
// HELPERS
// ============================================================================

function createMockTransfer(overrides: Partial<CarTransfer> = {}): CarTransfer {
  return {
    id: 'transfer-1',
    car_number: 'RAIL1234',
    from_rider_id: 'rider-from',
    to_rider_id: 'rider-to',
    transition_type: 'reassignment',
    status: 'Pending',
    initiated_date: '2026-01-15',
    target_completion_date: '2026-02-15',
    completed_date: null,
    requires_shop_visit: false,
    shop_visit_id: null,
    notes: null,
    created_by: 'user-1',
    completed_by: null,
    completion_notes: null,
    cancelled_by: null,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

/**
 * Sets up queryOne mock to return the correct value based on the SQL query text.
 * This is used by validateTransferPrerequisites which makes many sequential queryOne calls.
 */
function setupValidPrerequisiteMocks() {
  mockQueryOne
    // 1. Car exists
    .mockResolvedValueOnce({ car_number: 'RAIL1234' })
    // 2. Car is active on source rider
    .mockResolvedValueOnce({ is_active: true })
    // 3. From rider exists
    .mockResolvedValueOnce({ id: 'rider-from', rider_name: 'Rider A', customer_name: 'Customer X' })
    // 4. To rider exists and is Active
    .mockResolvedValueOnce({ id: 'rider-to', rider_name: 'Rider B', customer_name: 'Customer Y', status: 'Active' })
    // 5. No existing in-progress transfer
    .mockResolvedValueOnce(null)
    // 6. Active assignments count = 0
    .mockResolvedValueOnce({ count: '0' })
    // 7. Pending amendments count = 0
    .mockResolvedValueOnce({ count: '0' })
    // 8. No active release
    .mockResolvedValueOnce(null);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// validateTransferPrerequisites
// ============================================================================

describe('validateTransferPrerequisites', () => {
  it('should return canTransfer=true when all prerequisites are met', async () => {
    setupValidPrerequisiteMocks();

    const result = await validateTransferPrerequisites('RAIL1234', 'rider-from', 'rider-to');

    expect(result.canTransfer).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.car_number).toBe('RAIL1234');
    expect(result.from_rider).toEqual({ id: 'rider-from', name: 'Rider A', customer: 'Customer X' });
    expect(result.to_rider).toEqual({ id: 'rider-to', name: 'Rider B', customer: 'Customer Y' });
    expect(result.active_assignments).toBe(0);
    expect(result.pending_amendments).toBe(0);
  });

  it('should return blocker when car is not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null); // Car not found

    const result = await validateTransferPrerequisites('BADCAR', 'rider-from', 'rider-to');

    expect(result.canTransfer).toBe(false);
    expect(result.blockers).toContain('Car not found');
    expect(result.from_rider).toBeNull();
    expect(result.to_rider).toBeNull();
  });

  it('should return blocker when car has an active transfer already', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ car_number: 'RAIL1234' })    // Car exists
      .mockResolvedValueOnce({ is_active: true })            // Active on source
      .mockResolvedValueOnce({ id: 'rider-from', rider_name: 'Rider A', customer_name: 'CX' }) // From rider
      .mockResolvedValueOnce({ id: 'rider-to', rider_name: 'Rider B', customer_name: 'CY', status: 'Active' }) // To rider
      .mockResolvedValueOnce({ id: 'existing-transfer', status: 'Pending' }) // Existing active transfer
      .mockResolvedValueOnce({ count: '0' })                 // Assignments
      .mockResolvedValueOnce({ count: '0' })                 // Amendments
      .mockResolvedValueOnce(null);                          // No release

    const result = await validateTransferPrerequisites('RAIL1234', 'rider-from', 'rider-to');

    expect(result.canTransfer).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([expect.stringContaining('already has an active transfer')])
    );
  });

  it('should return blocker when car is not active on source rider', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ car_number: 'RAIL1234' })    // Car exists
      .mockResolvedValueOnce(null)                           // NOT active on source rider
      .mockResolvedValueOnce({ id: 'rider-from', rider_name: 'Rider A', customer_name: 'CX' })
      .mockResolvedValueOnce({ id: 'rider-to', rider_name: 'Rider B', customer_name: 'CY', status: 'Active' })
      .mockResolvedValueOnce(null)                           // No existing transfer
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce(null);

    const result = await validateTransferPrerequisites('RAIL1234', 'rider-from', 'rider-to');

    expect(result.canTransfer).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([expect.stringContaining('not active on the source rider')])
    );
  });

  it('should return blocker when source and destination riders are the same', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ car_number: 'RAIL1234' })
      .mockResolvedValueOnce({ is_active: true })
      .mockResolvedValueOnce({ id: 'rider-same', rider_name: 'Rider A', customer_name: 'CX' })
      .mockResolvedValueOnce({ id: 'rider-same', rider_name: 'Rider A', customer_name: 'CX', status: 'Active' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce(null);

    const result = await validateTransferPrerequisites('RAIL1234', 'rider-same', 'rider-same');

    expect(result.canTransfer).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([expect.stringContaining('Source and destination riders are the same')])
    );
  });

  it('should return warnings for active assignments and pending amendments', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ car_number: 'RAIL1234' })
      .mockResolvedValueOnce({ is_active: true })
      .mockResolvedValueOnce({ id: 'rider-from', rider_name: 'Rider A', customer_name: 'CX' })
      .mockResolvedValueOnce({ id: 'rider-to', rider_name: 'Rider B', customer_name: 'CY', status: 'Active' })
      .mockResolvedValueOnce(null)                           // No existing transfer
      .mockResolvedValueOnce({ count: '3' })                 // 3 active assignments
      .mockResolvedValueOnce({ count: '2' })                 // 2 pending amendments
      .mockResolvedValueOnce(null);

    const result = await validateTransferPrerequisites('RAIL1234', 'rider-from', 'rider-to');

    expect(result.canTransfer).toBe(true); // Warnings do not block
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain('3 active assignment(s)');
    expect(result.warnings[1]).toContain('2 pending amendment(s)');
    expect(result.active_assignments).toBe(3);
    expect(result.pending_amendments).toBe(2);
  });

  it('should return blocker when destination rider is not Active', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ car_number: 'RAIL1234' })
      .mockResolvedValueOnce({ is_active: true })
      .mockResolvedValueOnce({ id: 'rider-from', rider_name: 'Rider A', customer_name: 'CX' })
      .mockResolvedValueOnce({ id: 'rider-to', rider_name: 'Rider B', customer_name: 'CY', status: 'Expired' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce(null);

    const result = await validateTransferPrerequisites('RAIL1234', 'rider-from', 'rider-to');

    expect(result.canTransfer).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([expect.stringContaining('Destination rider is Expired')])
    );
  });

  it('should return blocker when car has an active release in progress', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ car_number: 'RAIL1234' })
      .mockResolvedValueOnce({ is_active: true })
      .mockResolvedValueOnce({ id: 'rider-from', rider_name: 'Rider A', customer_name: 'CX' })
      .mockResolvedValueOnce({ id: 'rider-to', rider_name: 'Rider B', customer_name: 'CY', status: 'Active' })
      .mockResolvedValueOnce(null)                           // No existing transfer
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce({ id: 'release-1' });           // Active release exists

    const result = await validateTransferPrerequisites('RAIL1234', 'rider-from', 'rider-to');

    expect(result.canTransfer).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([expect.stringContaining('active release in progress')])
    );
  });
});

// ============================================================================
// initiateTransfer
// ============================================================================

describe('initiateTransfer', () => {
  const validInput: InitiateTransferInput = {
    car_number: 'RAIL1234',
    from_rider_id: 'rider-from',
    to_rider_id: 'rider-to',
    transition_type: 'reassignment',
    target_completion_date: '2026-02-15',
    notes: 'Scheduled transfer',
  };

  it('should create a transfer in Pending status on happy path', async () => {
    // First 8 calls are for validateTransferPrerequisites
    setupValidPrerequisiteMocks();

    // 9th call: the INSERT returning the new transfer
    const mockTransfer = createMockTransfer({ notes: 'Scheduled transfer' });
    mockQueryOne.mockResolvedValueOnce(mockTransfer);

    const result = await initiateTransfer(validInput, 'user-1');

    expect(result).toEqual(mockTransfer);
    expect(result.status).toBe('Pending');
    expect(result.car_number).toBe('RAIL1234');
    // Verify the INSERT was called (9th call to queryOne)
    expect(mockQueryOne).toHaveBeenCalledTimes(9);
    const insertCall = mockQueryOne.mock.calls[8];
    expect(insertCall[0]).toContain('INSERT INTO car_lease_transitions');
    expect(insertCall[1]).toEqual([
      'RAIL1234',
      'rider-from',
      'rider-to',
      'reassignment',
      '2026-02-15',
      false,
      'Scheduled transfer',
      'user-1',
    ]);
  });

  it('should throw when validation fails (blockers present)', async () => {
    // Car not found scenario
    mockQueryOne.mockResolvedValueOnce(null);

    await expect(initiateTransfer(validInput, 'user-1'))
      .rejects
      .toThrow('Cannot initiate transfer: Car not found');
  });
});

// ============================================================================
// confirmTransfer
// ============================================================================

describe('confirmTransfer', () => {
  it('should move transfer from Pending to InProgress', async () => {
    const pendingTransfer = createMockTransfer({ status: 'Pending' });
    const confirmedTransfer = createMockTransfer({ status: 'InProgress' });

    // getTransfer call
    mockQueryOne.mockResolvedValueOnce(pendingTransfer);
    // UPDATE returning confirmed transfer
    mockQueryOne.mockResolvedValueOnce(confirmedTransfer);

    const result = await confirmTransfer('transfer-1', 'user-1', 'Approved by ops');

    expect(result.status).toBe('InProgress');
    // Verify the UPDATE was called with correct params
    const updateCall = mockQueryOne.mock.calls[1];
    expect(updateCall[0]).toContain("status = 'InProgress'");
    expect(updateCall[1]).toEqual(['Approved by ops', 'transfer-1']);
  });

  it('should throw when transfer is not in Pending status', async () => {
    const inProgressTransfer = createMockTransfer({ status: 'InProgress' });
    mockQueryOne.mockResolvedValueOnce(inProgressTransfer);

    await expect(confirmTransfer('transfer-1', 'user-1'))
      .rejects
      .toThrow('Cannot confirm transfer in status InProgress');
  });

  it('should throw when transfer is not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    await expect(confirmTransfer('nonexistent', 'user-1'))
      .rejects
      .toThrow('Transfer nonexistent not found');
  });
});

// ============================================================================
// completeTransfer
// ============================================================================

describe('completeTransfer', () => {
  it('should atomically deactivate source rider_cars, create destination rider_cars, and mark Complete', async () => {
    const inProgressTransfer = createMockTransfer({ status: 'InProgress' });
    const completedTransfer = createMockTransfer({ status: 'Complete', completed_date: '2026-02-01', completed_by: 'user-1' });

    // getTransfer call
    mockQueryOne.mockResolvedValueOnce(inProgressTransfer);

    // transaction mock: simulate the client and call the callback
    const mockClient = {
      query: jest.fn()
        // 1. Deactivate source rider_cars
        .mockResolvedValueOnce({ rows: [] })
        // 2. Create destination rider_cars
        .mockResolvedValueOnce({ rows: [] })
        // 3. Update transition to Complete
        .mockResolvedValueOnce({ rows: [completedTransfer] }),
    };
    mockTransaction.mockImplementation(async (cb) => cb(mockClient));

    // queryOne for car lookup (for assetEvent recording)
    mockQueryOne.mockResolvedValueOnce({ id: 'car-uuid-1' });

    const result = await completeTransfer('transfer-1', 'user-1', 'Transfer completed on site');

    expect(result.status).toBe('Complete');

    // Verify the transaction client calls
    expect(mockClient.query).toHaveBeenCalledTimes(3);

    // 1. Deactivate on source rider
    const deactivateCall = mockClient.query.mock.calls[0];
    expect(deactivateCall[0]).toContain('UPDATE rider_cars SET');
    expect(deactivateCall[0]).toContain('is_active = FALSE');
    expect(deactivateCall[1]).toEqual(['rider-from', 'RAIL1234']);

    // 2. Create on destination rider
    const createCall = mockClient.query.mock.calls[1];
    expect(createCall[0]).toContain('INSERT INTO rider_cars');
    expect(createCall[1]).toEqual(['rider-to', 'RAIL1234']);

    // 3. Mark Complete
    const completeCall = mockClient.query.mock.calls[2];
    expect(completeCall[0]).toContain("status = 'Complete'");
    expect(completeCall[1]).toEqual(['user-1', 'Transfer completed on site', 'transfer-1']);
  });

  it('should throw when transfer is not in InProgress status', async () => {
    const pendingTransfer = createMockTransfer({ status: 'Pending' });
    mockQueryOne.mockResolvedValueOnce(pendingTransfer);

    await expect(completeTransfer('transfer-1', 'user-1'))
      .rejects
      .toThrow('Cannot complete transfer in status Pending');
  });

  it('should throw when transfer is not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    await expect(completeTransfer('nonexistent', 'user-1'))
      .rejects
      .toThrow('Transfer nonexistent not found');
  });

  it('should throw when from_rider_id or to_rider_id is missing', async () => {
    const badTransfer = createMockTransfer({ status: 'InProgress', from_rider_id: null });
    mockQueryOne.mockResolvedValueOnce(badTransfer);

    await expect(completeTransfer('transfer-1', 'user-1'))
      .rejects
      .toThrow('Transfer must have both source and destination riders');
  });
});

// ============================================================================
// cancelTransfer
// ============================================================================

describe('cancelTransfer', () => {
  it('should cancel a Pending transfer', async () => {
    const pendingTransfer = createMockTransfer({ status: 'Pending' });
    const cancelledTransfer = createMockTransfer({
      status: 'Cancelled',
      cancelled_by: 'user-1',
      cancelled_at: '2026-02-01T12:00:00Z',
      cancellation_reason: 'No longer needed',
    });

    mockQueryOne.mockResolvedValueOnce(pendingTransfer);
    mockQueryOne.mockResolvedValueOnce(cancelledTransfer);

    const result = await cancelTransfer('transfer-1', 'user-1', 'No longer needed');

    expect(result.status).toBe('Cancelled');
    expect(result.cancellation_reason).toBe('No longer needed');

    const updateCall = mockQueryOne.mock.calls[1];
    expect(updateCall[0]).toContain("status = 'Cancelled'");
    expect(updateCall[1]).toEqual(['user-1', 'No longer needed', 'transfer-1']);
  });

  it('should cancel an InProgress transfer', async () => {
    const inProgressTransfer = createMockTransfer({ status: 'InProgress' });
    const cancelledTransfer = createMockTransfer({ status: 'Cancelled', cancellation_reason: 'Customer changed mind' });

    mockQueryOne.mockResolvedValueOnce(inProgressTransfer);
    mockQueryOne.mockResolvedValueOnce(cancelledTransfer);

    const result = await cancelTransfer('transfer-1', 'user-1', 'Customer changed mind');

    expect(result.status).toBe('Cancelled');
  });

  it('should throw when transfer is already Complete', async () => {
    const completedTransfer = createMockTransfer({ status: 'Complete' });
    mockQueryOne.mockResolvedValueOnce(completedTransfer);

    await expect(cancelTransfer('transfer-1', 'user-1', 'Too late'))
      .rejects
      .toThrow('Cannot cancel transfer in terminal status Complete');
  });

  it('should throw when transfer is already Cancelled', async () => {
    const cancelledTransfer = createMockTransfer({ status: 'Cancelled' });
    mockQueryOne.mockResolvedValueOnce(cancelledTransfer);

    await expect(cancelTransfer('transfer-1', 'user-1', 'Double cancel'))
      .rejects
      .toThrow('Cannot cancel transfer in terminal status Cancelled');
  });

  it('should throw when transfer is not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    await expect(cancelTransfer('nonexistent', 'user-1', 'reason'))
      .rejects
      .toThrow('Transfer nonexistent not found');
  });
});

// ============================================================================
// getTransfer
// ============================================================================

describe('getTransfer', () => {
  it('should return a transfer when found', async () => {
    const mockTransfer = createMockTransfer();
    mockQueryOne.mockResolvedValueOnce(mockTransfer);

    const result = await getTransfer('transfer-1');

    expect(result).toEqual(mockTransfer);
    expect(mockQueryOne).toHaveBeenCalledWith(
      'SELECT * FROM car_lease_transitions WHERE id = $1',
      ['transfer-1']
    );
  });

  it('should return null when transfer is not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const result = await getTransfer('nonexistent');

    expect(result).toBeNull();
  });
});

// ============================================================================
// listTransfers
// ============================================================================

describe('listTransfers', () => {
  it('should return transfers with filters applied', async () => {
    const transfers = [
      createMockTransfer({ id: 'transfer-1', status: 'Pending' }),
      createMockTransfer({ id: 'transfer-2', status: 'Pending' }),
    ];

    // Count query
    mockQueryOne.mockResolvedValueOnce({ total: '2' });
    // Main query
    mockQuery.mockResolvedValueOnce(transfers);

    const result = await listTransfers({
      car_number: 'RAIL',
      status: 'Pending',
      from_rider_id: 'rider-from',
    });

    expect(result.total).toBe(2);
    expect(result.transfers).toHaveLength(2);

    // Verify count query includes WHERE conditions
    const countCall = mockQueryOne.mock.calls[0];
    expect(countCall[0]).toContain('WHERE');
    expect(countCall[0]).toContain('car_number ILIKE');
    expect(countCall[0]).toContain('from_rider_id =');
    expect(countCall[0]).toContain('status =');
    expect(countCall[1]).toEqual(['%RAIL%', 'rider-from', 'Pending']);
  });

  it('should handle pagination with limit and offset', async () => {
    const transfers = [createMockTransfer({ id: 'transfer-3' })];

    mockQueryOne.mockResolvedValueOnce({ total: '10' });
    mockQuery.mockResolvedValueOnce(transfers);

    const result = await listTransfers({ limit: 5, offset: 5 });

    expect(result.total).toBe(10);
    expect(result.transfers).toHaveLength(1);

    // Verify LIMIT and OFFSET are passed to the main query
    const mainQueryCall = mockQuery.mock.calls[0];
    expect(mainQueryCall[0]).toContain('LIMIT');
    expect(mainQueryCall[0]).toContain('OFFSET');
    expect(mainQueryCall[1]).toEqual([5, 5]);
  });

  it('should default to limit 50 and offset 0 when not specified', async () => {
    mockQueryOne.mockResolvedValueOnce({ total: '0' });
    mockQuery.mockResolvedValueOnce([]);

    await listTransfers({});

    const mainQueryCall = mockQuery.mock.calls[0];
    // params should include default limit=50 and offset=0
    expect(mainQueryCall[1]).toEqual([50, 0]);
  });

  it('should handle array status filter', async () => {
    mockQueryOne.mockResolvedValueOnce({ total: '5' });
    mockQuery.mockResolvedValueOnce([]);

    await listTransfers({ status: ['Pending', 'InProgress'] as any });

    const countCall = mockQueryOne.mock.calls[0];
    expect(countCall[0]).toContain('status = ANY');
  });
});

// ============================================================================
// getTransferOverview
// ============================================================================

describe('getTransferOverview', () => {
  it('should return data from the materialized view', async () => {
    const overviewData = [
      { id: 'transfer-1', car_number: 'RAIL1234', status: 'Pending', from_rider_name: 'Rider A', to_rider_name: 'Rider B' },
      { id: 'transfer-2', car_number: 'RAIL5678', status: 'InProgress', from_rider_name: 'Rider C', to_rider_name: 'Rider D' },
    ];
    mockQuery.mockResolvedValueOnce(overviewData);

    const result = await getTransferOverview();

    expect(result).toEqual(overviewData);
    expect(result).toHaveLength(2);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM v_transfer_overview ORDER BY created_at DESC',
      []
    );
  });
});

// ============================================================================
// getRiderTransfers
// ============================================================================

describe('getRiderTransfers', () => {
  it('should return all transfers for a rider (as source or destination)', async () => {
    const transfers = [
      createMockTransfer({ id: 'transfer-1', from_rider_id: 'rider-x', to_rider_id: 'rider-y' }),
      createMockTransfer({ id: 'transfer-2', from_rider_id: 'rider-z', to_rider_id: 'rider-x' }),
    ];
    mockQuery.mockResolvedValueOnce(transfers);

    const result = await getRiderTransfers('rider-x');

    expect(result).toEqual(transfers);
    expect(result).toHaveLength(2);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('from_rider_id = $1 OR to_rider_id = $1'),
      ['rider-x']
    );
  });

  it('should return empty array when rider has no transfers', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await getRiderTransfers('rider-none');

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });
});
