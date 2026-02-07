/**
 * Contracts Service Tests
 *
 * Tests customer/lease/rider hierarchy navigation, amendment operations,
 * conflict detection, car validation for shopping, and bulk resync.
 */

import {
  listCustomers,
  getCustomer,
  getCustomerLeases,
  getLease,
  getLeaseRiders,
  getRider,
  getRiderCars,
  getRiderAmendments,
  getAmendment,
  getAmendmentComparison,
  detectConflicts,
  resyncSchedules,
  getCarsWithAmendments,
  validateCarForShopping,
} from '../services/contracts.service';

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

function createMockCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust-1',
    customer_code: 'ACME',
    customer_name: 'Acme Corp',
    is_active: true,
    active_leases: 2,
    total_riders: 5,
    total_cars: 100,
    ...overrides,
  };
}

function createMockLease(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lease-1',
    lease_id: 'ML-001',
    customer_id: 'cust-1',
    customer_name: 'Acme Corp',
    lease_name: 'Primary Tank Car Lease',
    start_date: '2024-01-01',
    end_date: '2029-12-31',
    status: 'Active',
    rider_count: 3,
    car_count: 50,
    monthly_revenue: 25000,
    ...overrides,
  };
}

function createMockRider(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rider-1',
    rider_id: 'RDR-001',
    master_lease_id: 'lease-1',
    lease_id: 'ML-001',
    customer_name: 'Acme Corp',
    rider_name: 'Tank Car Rider A',
    effective_date: '2024-01-01',
    expiration_date: '2029-12-31',
    status: 'Active',
    car_count: 25,
    amendment_count: 2,
    has_pending_amendments: false,
    cars_with_conflicts: 0,
    ...overrides,
  };
}

function createMockAmendment(overrides: Record<string, unknown> = {}) {
  return {
    amendment_id: 'amend-1',
    amendment_code: 'AMD-001',
    rider_id: 'rider-1',
    rider_name: 'Tank Car Rider A',
    lease_id: 'ML-001',
    customer_name: 'Acme Corp',
    amendment_type: 'schedule_change',
    effective_date: '2026-04-01',
    change_summary: 'Updated required shop date',
    status: 'Pending',
    is_latest_version: true,
    required_shop_date: '2026-06-01',
    previous_shop_date: '2026-09-01',
    service_interval_days: 365,
    previous_service_interval: 730,
    cars_impacted: 10,
    approved_by: null,
    approved_at: null,
    created_at: '2026-01-15T00:00:00Z',
    days_until_effective: 75,
    total_cars_affected: 10,
    cars_with_conflicts: 2,
    cars_needing_resync: 3,
    ...overrides,
  };
}

function createMockRiderCar(overrides: Record<string, unknown> = {}) {
  return {
    car_number: 'UTLX123456',
    car_type: 'Tank',
    material_type: 'Carbon Steel',
    lessee_name: 'Acme Corp',
    current_status: 'Active',
    rider_id: 'rider-1',
    rider_name: 'Tank Car Rider A',
    required_shop_date: '2026-06-01',
    next_service_due: '2026-06-01',
    has_pending_amendment: false,
    amendment_conflict: false,
    conflict_reason: null,
    has_active_transition: false,
    transition_details: null,
    active_assignments: 0,
    ...overrides,
  };
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Contracts Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Customer Operations
  // ============================================================================
  describe('listCustomers', () => {
    it('should return active customers ordered by car count', async () => {
      mockQuery.mockResolvedValueOnce([
        createMockCustomer({ total_cars: 100 }),
        createMockCustomer({ id: 'cust-2', customer_code: 'BETA', total_cars: 50 }),
      ] as any);

      const result = await listCustomers(true);

      expect(result).toHaveLength(2);
      expect(result[0].total_cars).toBe(100);
    });

    it('should return all customers when activeOnly is false', async () => {
      mockQuery.mockResolvedValueOnce([
        createMockCustomer(),
        createMockCustomer({ id: 'cust-2', is_active: false }),
      ] as any);

      const result = await listCustomers(false);

      expect(result).toHaveLength(2);
    });
  });

  describe('getCustomer', () => {
    it('should return customer with aggregated counts', async () => {
      mockQueryOne.mockResolvedValueOnce(createMockCustomer() as any);

      const result = await getCustomer('cust-1');

      expect(result).toBeDefined();
      expect(result!.customer_code).toBe('ACME');
      expect(result!.active_leases).toBe(2);
    });

    it('should return null for non-existent customer', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getCustomer('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Lease Hierarchy Navigation
  // ============================================================================
  describe('getCustomerLeases', () => {
    it('should return leases for a customer', async () => {
      mockQuery.mockResolvedValueOnce([
        createMockLease(),
        createMockLease({ id: 'lease-2', lease_id: 'ML-002', status: 'Expired' }),
      ] as any);

      const result = await getCustomerLeases('cust-1');

      expect(result).toHaveLength(2);
      expect(result[0].lease_id).toBe('ML-001');
    });
  });

  describe('getLeaseRiders', () => {
    it('should return riders for a lease with amendment metadata', async () => {
      mockQuery.mockResolvedValueOnce([
        createMockRider(),
        createMockRider({ id: 'rider-2', rider_id: 'RDR-002', has_pending_amendments: true, cars_with_conflicts: 3 }),
      ] as any);

      const result = await getLeaseRiders('lease-1');

      expect(result).toHaveLength(2);
      expect(result[1].has_pending_amendments).toBe(true);
      expect(result[1].cars_with_conflicts).toBe(3);
    });
  });

  describe('getRiderCars', () => {
    it('should return cars on a rider with transition and amendment details', async () => {
      mockQuery.mockResolvedValueOnce([
        createMockRiderCar(),
        createMockRiderCar({
          car_number: 'UTLX789012',
          has_active_transition: true,
          transition_details: { type: 'transfer', status: 'Pending', from_customer: 'Acme', to_customer: 'Beta', target_date: '2026-06-01' },
        }),
      ] as any);

      const result = await getRiderCars('rider-1');

      expect(result).toHaveLength(2);
      expect(result[1].has_active_transition).toBe(true);
      expect(result[1].transition_details?.type).toBe('transfer');
    });
  });

  // ============================================================================
  // Amendment Operations
  // ============================================================================
  describe('getAmendment', () => {
    it('should return amendment details', async () => {
      mockQueryOne.mockResolvedValueOnce(createMockAmendment() as any);

      const result = await getAmendment('amend-1');

      expect(result).toBeDefined();
      expect(result!.amendment_code).toBe('AMD-001');
      expect(result!.status).toBe('Pending');
      expect(result!.cars_impacted).toBe(10);
    });

    it('should return null for non-existent amendment', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getAmendment('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAmendmentComparison', () => {
    it('should return before/after comparison for changed fields', async () => {
      // getAmendment is called internally
      mockQueryOne.mockResolvedValueOnce(createMockAmendment() as any);

      const result = await getAmendmentComparison('amend-1');

      expect(result.length).toBeGreaterThan(0);
      const shopDateComparison = result.find(c => c.field === 'Required Shop Date');
      expect(shopDateComparison).toBeDefined();
      expect(shopDateComparison!.before).toBe('2026-09-01');
      expect(shopDateComparison!.after).toBe('2026-06-01');
    });

    it('should return empty array when amendment not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getAmendmentComparison('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('detectConflicts', () => {
    it('should return the number of conflicts detected', async () => {
      mockQueryOne.mockResolvedValueOnce({ detect_amendment_conflicts: 3 } as any);

      const result = await detectConflicts('amend-1');

      expect(result).toBe(3);
    });

    it('should return 0 when no conflicts', async () => {
      mockQueryOne.mockResolvedValueOnce({ detect_amendment_conflicts: 0 } as any);

      const result = await detectConflicts('amend-clean');

      expect(result).toBe(0);
    });
  });

  describe('resyncSchedules', () => {
    it('should return count of resynced schedules', async () => {
      mockQueryOne.mockResolvedValueOnce({ resync_rider_schedules: 12 } as any);

      const result = await resyncSchedules('rider-1', 'user-1');

      expect(result).toBe(12);
    });
  });

  // ============================================================================
  // Cars With Amendments (Filtered View)
  // ============================================================================
  describe('getCarsWithAmendments', () => {
    it('should return filtered cars with pagination', async () => {
      // Count
      mockQueryOne.mockResolvedValueOnce({ total: '35' } as any);
      // Cars
      mockQuery.mockResolvedValueOnce([
        createMockRiderCar({ amendment_conflict: true, conflict_reason: 'Schedule overlap' }),
        createMockRiderCar({ car_number: 'UTLX789012', has_pending_amendment: true }),
      ] as any);

      const result = await getCarsWithAmendments({ hasConflict: true, limit: 10, offset: 0 });

      expect(result.total).toBe(35);
      expect(result.cars).toHaveLength(2);
    });
  });

  // ============================================================================
  // Car Validation for Shopping
  // ============================================================================
  describe('validateCarForShopping', () => {
    it('should return canShop=true with no issues for a clean car', async () => {
      mockQueryOne.mockResolvedValueOnce(
        createMockRiderCar({ amendment_id: null }) as any
      );

      const result = await validateCarForShopping('UTLX123456');

      expect(result.canShop).toBe(true);
      expect(result.hasOutdatedTerms).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn when car is in lease transition', async () => {
      mockQueryOne.mockResolvedValueOnce(
        createMockRiderCar({ has_active_transition: true, amendment_id: null }) as any
      );

      const result = await validateCarForShopping('UTLX123456');

      expect(result.canShop).toBe(true);
      expect(result.warnings).toContain('Car is in transition between lessees');
    });

    it('should flag outdated terms when pending amendment exists', async () => {
      // First call: getRiderCar with amendment_id
      mockQueryOne.mockResolvedValueOnce(
        createMockRiderCar({ has_pending_amendment: true, amendment_id: 'amend-1' }) as any
      );
      // getAmendment
      mockQueryOne.mockResolvedValueOnce(createMockAmendment() as any);
      // getAmendmentComparison (calls getAmendment internally)
      mockQueryOne.mockResolvedValueOnce(createMockAmendment() as any);

      const result = await validateCarForShopping('UTLX123456');

      expect(result.canShop).toBe(true);
      expect(result.hasOutdatedTerms).toBe(true);
      expect(result.amendment).toBeDefined();
      expect(result.comparison!.length).toBeGreaterThan(0);
    });

    it('should return canShop=true with warning when car not found in lease system', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await validateCarForShopping('UNKNOWN_CAR');

      expect(result.canShop).toBe(true);
      expect(result.hasOutdatedTerms).toBe(false);
      expect(result.warnings).toContain('Car not found in lease system');
    });
  });
});
