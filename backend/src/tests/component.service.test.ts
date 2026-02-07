/**
 * Component Service Tests
 *
 * Tests component CRUD, lifecycle operations (replace, remove, inspect),
 * history tracking, and statistical queries.
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  pool: { query: jest.fn(), connect: jest.fn() },
}));

import {
  listComponents,
  getComponent,
  getComponentWithHistory,
  getCarComponents,
  createComponent,
  updateComponent,
  replaceComponent,
  removeComponent,
  recordInspection,
  getComponentHistory,
  getComponentStats,
} from '../services/component.service';

import type {
  Component,
  ComponentHistory,
  ComponentWithHistory,
  CreateComponentInput,
  UpdateComponentInput,
} from '../services/component.service';

import { query, queryOne, transaction } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockComponent(overrides: Partial<Component> = {}): Component {
  return {
    id: 'comp-uuid-1',
    car_number: 'GATX-12345',
    component_type: 'valve',
    serial_number: 'SN-001',
    manufacturer: 'Acme Corp',
    model: 'V-100',
    install_date: '2025-01-15',
    last_inspection_date: '2025-06-01',
    next_inspection_due: '2026-06-01',
    status: 'active',
    specification: 'SPEC-A',
    notes: null,
    created_by: 'user-1',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-06-01T12:00:00Z',
    ...overrides,
  };
}

function createMockHistory(overrides: Partial<ComponentHistory> = {}): ComponentHistory {
  return {
    id: 'hist-uuid-1',
    component_id: 'comp-uuid-1',
    action: 'installed',
    performed_by: 'user-1',
    performed_at: '2025-01-15T10:00:00Z',
    shop_code: null,
    old_serial_number: null,
    new_serial_number: 'SN-001',
    work_order_reference: null,
    notes: 'Component installed',
    created_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Component Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // listComponents
  // ==========================================================================
  describe('listComponents', () => {
    it('should return components with default pagination when no filters are provided', async () => {
      const comp1 = createMockComponent();
      const comp2 = createMockComponent({ id: 'comp-uuid-2', serial_number: 'SN-002' });

      mockQueryOne.mockResolvedValueOnce({ count: '2' } as any);
      mockQuery.mockResolvedValueOnce([comp1, comp2] as any);

      const result = await listComponents({});

      expect(result.total).toBe(2);
      expect(result.components).toHaveLength(2);
      expect(result.components[0].id).toBe('comp-uuid-1');
      expect(result.components[1].id).toBe('comp-uuid-2');

      // Count query should have no WHERE clause
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        []
      );
      // Data query should include LIMIT 50 OFFSET 0 by default
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        [50, 0]
      );
    });

    it('should apply car_number, component_type, and status filters', async () => {
      const comp = createMockComponent({ status: 'active', component_type: 'gauge' });

      mockQueryOne.mockResolvedValueOnce({ count: '1' } as any);
      mockQuery.mockResolvedValueOnce([comp] as any);

      const result = await listComponents({
        car_number: 'GATX-12345',
        component_type: 'gauge',
        status: 'active',
        limit: 10,
        offset: 5,
      });

      expect(result.total).toBe(1);
      expect(result.components).toHaveLength(1);

      // Count query params should contain all 3 filter values
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        ['GATX-12345', 'gauge', 'active']
      );
      // Data query params should contain the 3 filter values + limit + offset
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        ['GATX-12345', 'gauge', 'active', 10, 5]
      );
    });

    it('should return empty results when no components match', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '0' } as any);
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await listComponents({ car_number: 'UNKNOWN-999' });

      expect(result.total).toBe(0);
      expect(result.components).toHaveLength(0);
    });

    it('should handle null count result gracefully', async () => {
      mockQueryOne.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await listComponents({});

      expect(result.total).toBe(0);
      expect(result.components).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getComponent / getComponentWithHistory
  // ==========================================================================
  describe('getComponent', () => {
    it('should return component with its history (newest first)', async () => {
      const comp = createMockComponent();
      const hist1 = createMockHistory({ id: 'hist-1', action: 'inspected', performed_at: '2025-06-01T12:00:00Z' });
      const hist2 = createMockHistory({ id: 'hist-2', action: 'installed', performed_at: '2025-01-15T10:00:00Z' });

      mockQueryOne.mockResolvedValueOnce(comp as any);
      mockQuery.mockResolvedValueOnce([hist1, hist2] as any);

      const result = await getComponent('comp-uuid-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('comp-uuid-1');
      expect(result!.history).toHaveLength(2);
      expect(result!.history[0].action).toBe('inspected');
      expect(result!.history[1].action).toBe('installed');

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM components WHERE id = $1'),
        ['comp-uuid-1']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY performed_at DESC'),
        ['comp-uuid-1']
      );
    });

    it('should return null when component is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getComponent('nonexistent-id');

      expect(result).toBeNull();
      // Should NOT attempt to fetch history if component is missing
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('getComponentWithHistory should be an alias for getComponent', () => {
      expect(getComponentWithHistory).toBe(getComponent);
    });
  });

  // ==========================================================================
  // getCarComponents
  // ==========================================================================
  describe('getCarComponents', () => {
    it('should return all components for a car ordered by type, status, created_at DESC', async () => {
      const comp1 = createMockComponent({ component_type: 'fitting', serial_number: 'SN-F1' });
      const comp2 = createMockComponent({ component_type: 'valve', serial_number: 'SN-V1' });

      mockQuery.mockResolvedValueOnce([comp1, comp2] as any);

      const result = await getCarComponents('GATX-12345');

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE car_number = $1'),
        ['GATX-12345']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY component_type, status, created_at DESC'),
        expect.any(Array)
      );
    });

    it('should return empty array when car has no components', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await getCarComponents('EMPTY-CAR');

      expect(result).toHaveLength(0);
    });
  });

  // ==========================================================================
  // createComponent
  // ==========================================================================
  describe('createComponent', () => {
    it('should create a component and record an installed history entry', async () => {
      const newComp = createMockComponent({ id: 'new-comp-1' });
      const histEntry = createMockHistory({
        id: 'hist-new-1',
        component_id: 'new-comp-1',
        action: 'installed',
      });

      // First call: INSERT component
      mockQueryOne.mockResolvedValueOnce(newComp as any);
      // Second call: INSERT history
      mockQueryOne.mockResolvedValueOnce(histEntry as any);

      const input: CreateComponentInput = {
        car_number: 'GATX-12345',
        component_type: 'valve',
        serial_number: 'SN-001',
        manufacturer: 'Acme Corp',
        model: 'V-100',
        install_date: '2025-01-15',
        notes: 'Fresh install',
      };

      const result = await createComponent(input, 'user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('new-comp-1');
      expect(result.history).toHaveLength(1);
      expect(result.history[0].action).toBe('installed');

      // Verify the INSERT query was called
      expect(mockQueryOne).toHaveBeenCalledTimes(2);
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO components'),
        expect.arrayContaining(['GATX-12345', 'valve', 'SN-001', 'Acme Corp'])
      );
      // History entry records installed action
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("'installed'"),
        expect.arrayContaining(['new-comp-1', 'user-1', 'SN-001'])
      );
    });

    it('should use data.created_by when userId is not provided', async () => {
      const newComp = createMockComponent({ id: 'new-comp-2', created_by: 'data-user' });
      const histEntry = createMockHistory({ component_id: 'new-comp-2' });

      mockQueryOne.mockResolvedValueOnce(newComp as any);
      mockQueryOne.mockResolvedValueOnce(histEntry as any);

      const input: CreateComponentInput = {
        car_number: 'GATX-12345',
        component_type: 'bov',
        created_by: 'data-user',
      };

      await createComponent(input);

      // Should pass 'data-user' as the created_by value (11th param)
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO components'),
        expect.arrayContaining(['data-user'])
      );
    });

    it('should throw when INSERT fails (returns null)', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const input: CreateComponentInput = {
        car_number: 'GATX-12345',
        component_type: 'valve',
      };

      await expect(createComponent(input)).rejects.toThrow('Failed to create component');
    });
  });

  // ==========================================================================
  // updateComponent
  // ==========================================================================
  describe('updateComponent', () => {
    it('should update specified fields and record a repaired history entry', async () => {
      const updatedComp = createMockComponent({
        manufacturer: 'New Mfg',
        notes: 'Updated notes',
      });

      // First call: UPDATE component
      mockQueryOne.mockResolvedValueOnce(updatedComp as any);
      // Second call: INSERT history
      mockQueryOne.mockResolvedValueOnce(createMockHistory({ action: 'repaired' }) as any);

      const data: UpdateComponentInput = {
        manufacturer: 'New Mfg',
        notes: 'Updated notes',
      };

      const result = await updateComponent('comp-uuid-1', data, 'user-2');

      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe('New Mfg');

      // UPDATE query should set manufacturer and notes
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE components SET'),
        expect.arrayContaining(['New Mfg', 'Updated notes', 'comp-uuid-1'])
      );
      // History entry records repaired action
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("'repaired'"),
        ['comp-uuid-1', 'user-2', 'Component record updated']
      );
    });

    it('should return null when component is not found', async () => {
      // UPDATE returns null (no matching row)
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await updateComponent('nonexistent', { status: 'removed' });

      expect(result).toBeNull();
      // History should NOT be recorded if component not found
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
    });

    it('should return existing component when no fields to update', async () => {
      const existing = createMockComponent();
      mockQueryOne.mockResolvedValueOnce(existing as any);

      const result = await updateComponent('comp-uuid-1', {});

      expect(result).toBeDefined();
      expect(result!.id).toBe('comp-uuid-1');
      // Should only SELECT, no UPDATE
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM components WHERE id = $1'),
        ['comp-uuid-1']
      );
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // replaceComponent
  // ==========================================================================
  describe('replaceComponent', () => {
    it('should atomically mark old component as replaced and create new one (positional args)', async () => {
      const oldComp = createMockComponent({ serial_number: 'SN-OLD' });
      const updatedOldComp = createMockComponent({ serial_number: 'SN-OLD', status: 'replaced' });
      const newComp = createMockComponent({
        id: 'comp-uuid-new',
        serial_number: 'SN-NEW',
        status: 'active',
      });
      const newHistEntry = createMockHistory({
        component_id: 'comp-uuid-new',
        action: 'installed',
        new_serial_number: 'SN-NEW',
        old_serial_number: 'SN-OLD',
      });

      const mockClient = {
        query: jest.fn()
          // 1. SELECT old component (FOR UPDATE)
          .mockResolvedValueOnce({ rows: [oldComp] })
          // 2. UPDATE old to 'replaced'
          .mockResolvedValueOnce({ rows: [updatedOldComp] })
          // 3. INSERT history on old (replaced)
          .mockResolvedValueOnce({ rows: [] })
          // 4. INSERT new component
          .mockResolvedValueOnce({ rows: [newComp] })
          // 5. INSERT history on new (installed)
          .mockResolvedValueOnce({ rows: [newHistEntry] }),
      };

      mockTransaction.mockImplementation(async (fn) => fn(mockClient as any));

      const result = await replaceComponent(
        'comp-uuid-1',
        'SN-NEW',
        'New Manufacturer',
        'user-3',
        'SHOP-A',
        'Routine replacement'
      );

      expect(result.oldComponent.status).toBe('replaced');
      expect(result.newComponent.id).toBe('comp-uuid-new');
      expect(result.newComponent.serial_number).toBe('SN-NEW');
      expect(result.newComponent.history).toHaveLength(1);
      expect(result.newComponent.history[0].action).toBe('installed');

      // Verify transaction was used
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      // Verify the SELECT ... FOR UPDATE
      expect(mockClient.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FOR UPDATE'),
        ['comp-uuid-1']
      );
      // Verify old component marked replaced
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("status = 'replaced'"),
        ['comp-uuid-1']
      );
    });

    it('should support object-based calling convention', async () => {
      const oldComp = createMockComponent({ serial_number: 'SN-OLD' });
      const updatedOldComp = createMockComponent({ status: 'replaced' });
      const newComp = createMockComponent({ id: 'comp-new-2', serial_number: 'SN-BRAND-NEW' });
      const newHist = createMockHistory({ component_id: 'comp-new-2', action: 'installed' });

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [oldComp] })
          .mockResolvedValueOnce({ rows: [updatedOldComp] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [newComp] })
          .mockResolvedValueOnce({ rows: [newHist] }),
      };

      mockTransaction.mockImplementation(async (fn) => fn(mockClient as any));

      const result = await replaceComponent(
        'comp-uuid-1',
        { newSerialNumber: 'SN-BRAND-NEW', newManufacturer: 'Beta Corp', shopCode: 'SHOP-B', notes: 'Upgrade' },
        'user-4'
      );

      expect(result.oldComponent).toBeDefined();
      expect(result.newComponent).toBeDefined();

      // New component INSERT should use 'SN-BRAND-NEW'
      expect(mockClient.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('INSERT INTO components'),
        expect.arrayContaining(['SN-BRAND-NEW', 'Beta Corp'])
      );
    });

    it('should throw when component is not found', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }),
      };

      mockTransaction.mockImplementation(async (fn) => fn(mockClient as any));

      await expect(
        replaceComponent('nonexistent', 'SN-NEW', null, 'user-1')
      ).rejects.toThrow('Component nonexistent not found');
    });

    it('should throw when component is not in active status', async () => {
      const removedComp = createMockComponent({ status: 'removed' });

      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [removedComp] }),
      };

      mockTransaction.mockImplementation(async (fn) => fn(mockClient as any));

      await expect(
        replaceComponent('comp-uuid-1', 'SN-NEW', null, 'user-1')
      ).rejects.toThrow("Cannot replace component in 'removed' status");
    });
  });

  // ==========================================================================
  // removeComponent
  // ==========================================================================
  describe('removeComponent', () => {
    it('should mark an active component as removed and record history', async () => {
      const existing = createMockComponent({ status: 'active' });
      const updated = createMockComponent({ status: 'removed' });
      const histEntry = createMockHistory({ action: 'removed' });

      // 1. SELECT existing
      mockQueryOne.mockResolvedValueOnce(existing as any);
      // 2. UPDATE to removed
      mockQueryOne.mockResolvedValueOnce(updated as any);
      // 3. INSERT history
      mockQueryOne.mockResolvedValueOnce(histEntry as any);

      const result = await removeComponent('comp-uuid-1', 'user-5', 'End of service life');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('removed');

      // Verify SELECT to check existence and status
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT * FROM components WHERE id = $1'),
        ['comp-uuid-1']
      );
      // Verify UPDATE
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("status = 'removed'"),
        ['comp-uuid-1']
      );
      // Verify history entry recorded
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("'removed'"),
        expect.arrayContaining(['comp-uuid-1', 'user-5'])
      );
    });

    it('should return null when component is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await removeComponent('nonexistent', 'user-5', 'Notes');

      expect(result).toBeNull();
      // Should only have called the SELECT, not UPDATE or history INSERT
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
    });

    it('should throw when component is already removed (not active)', async () => {
      const alreadyRemoved = createMockComponent({ status: 'removed' });
      mockQueryOne.mockResolvedValueOnce(alreadyRemoved as any);

      await expect(
        removeComponent('comp-uuid-1', 'user-5', null)
      ).rejects.toThrow("Cannot remove component in 'removed' status");
    });

    it('should throw when component is in replaced status', async () => {
      const replaced = createMockComponent({ status: 'replaced' });
      mockQueryOne.mockResolvedValueOnce(replaced as any);

      await expect(
        removeComponent('comp-uuid-1', 'user-5', null)
      ).rejects.toThrow("Cannot remove component in 'replaced' status");
    });
  });

  // ==========================================================================
  // recordInspection
  // ==========================================================================
  describe('recordInspection', () => {
    it('should update inspection dates and record inspected history (positional args)', async () => {
      const existing = createMockComponent({ status: 'active' });
      const updated = createMockComponent({
        last_inspection_date: '2026-02-07',
        next_inspection_due: '2027-02-07',
      });
      const histEntry = createMockHistory({ action: 'inspected', shop_code: 'SHOP-X' });

      // 1. SELECT existing
      mockQueryOne.mockResolvedValueOnce(existing as any);
      // 2. UPDATE inspection dates
      mockQueryOne.mockResolvedValueOnce(updated as any);
      // 3. INSERT history
      mockQueryOne.mockResolvedValueOnce(histEntry as any);

      const result = await recordInspection('comp-uuid-1', 'inspector-1', 'SHOP-X', 'Annual inspection');

      expect(result).not.toBeNull();
      expect(result!.last_inspection_date).toBe('2026-02-07');
      expect(result!.next_inspection_due).toBe('2027-02-07');

      // Verify UPDATE query sets dates
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('last_inspection_date = CURRENT_DATE'),
        ['comp-uuid-1']
      );
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('next_inspection_due = CURRENT_DATE'),
        expect.any(Array)
      );
      // Verify history records inspected action
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("'inspected'"),
        ['comp-uuid-1', 'inspector-1', 'SHOP-X', 'Annual inspection']
      );
    });

    it('should support object-based calling convention', async () => {
      const existing = createMockComponent({ status: 'active' });
      const updated = createMockComponent();
      const histEntry = createMockHistory({ action: 'inspected' });

      mockQueryOne.mockResolvedValueOnce(existing as any);
      mockQueryOne.mockResolvedValueOnce(updated as any);
      mockQueryOne.mockResolvedValueOnce(histEntry as any);

      const result = await recordInspection(
        'comp-uuid-1',
        { shopCode: 'SHOP-Y', notes: 'Passed all checks' },
        'inspector-2'
      );

      expect(result).not.toBeNull();

      // History should use the resolved performedBy from the third arg
      expect(mockQueryOne).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("'inspected'"),
        ['comp-uuid-1', 'inspector-2', 'SHOP-Y', 'Passed all checks']
      );
    });

    it('should return null when component is not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await recordInspection('nonexistent', 'inspector-1', null, null);

      expect(result).toBeNull();
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
    });

    it('should throw when component is not active', async () => {
      const failedComp = createMockComponent({ status: 'failed' });
      mockQueryOne.mockResolvedValueOnce(failedComp as any);

      await expect(
        recordInspection('comp-uuid-1', 'inspector-1', null, null)
      ).rejects.toThrow("Cannot inspect component in 'failed' status");
    });
  });

  // ==========================================================================
  // getComponentHistory
  // ==========================================================================
  describe('getComponentHistory', () => {
    it('should return all history entries ordered newest first', async () => {
      const hist1 = createMockHistory({
        id: 'hist-3',
        action: 'inspected',
        performed_at: '2025-12-01T10:00:00Z',
      });
      const hist2 = createMockHistory({
        id: 'hist-2',
        action: 'repaired',
        performed_at: '2025-06-01T10:00:00Z',
      });
      const hist3 = createMockHistory({
        id: 'hist-1',
        action: 'installed',
        performed_at: '2025-01-15T10:00:00Z',
      });

      mockQuery.mockResolvedValueOnce([hist1, hist2, hist3] as any);

      const result = await getComponentHistory('comp-uuid-1');

      expect(result).toHaveLength(3);
      expect(result[0].action).toBe('inspected');
      expect(result[1].action).toBe('repaired');
      expect(result[2].action).toBe('installed');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE component_id = $1'),
        ['comp-uuid-1']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY performed_at DESC'),
        expect.any(Array)
      );
    });

    it('should return empty array when component has no history', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await getComponentHistory('comp-no-history');

      expect(result).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getComponentStats
  // ==========================================================================
  describe('getComponentStats', () => {
    it('should return counts by type and status for all components', async () => {
      const byType = [
        { component_type: 'valve', count: '15' },
        { component_type: 'gauge', count: '8' },
        { component_type: 'fitting', count: '5' },
      ];
      const byStatus = [
        { status: 'active', count: '20' },
        { status: 'removed', count: '5' },
        { status: 'replaced', count: '3' },
      ];

      // 1. byType query
      mockQuery.mockResolvedValueOnce(byType as any);
      // 2. byStatus query
      mockQuery.mockResolvedValueOnce(byStatus as any);
      // 3. total count
      mockQueryOne.mockResolvedValueOnce({ count: '28' } as any);

      const result = await getComponentStats();

      expect(result.total).toBe(28);
      expect(result.by_type).toHaveLength(3);
      expect(result.by_type[0]).toEqual({ component_type: 'valve', count: 15 });
      expect(result.by_type[1]).toEqual({ component_type: 'gauge', count: 8 });
      expect(result.by_status).toHaveLength(3);
      expect(result.by_status[0]).toEqual({ status: 'active', count: 20 });

      // No WHERE clause when carNumber is not provided
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.not.stringContaining('WHERE'),
        []
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.not.stringContaining('WHERE'),
        []
      );
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE'),
        []
      );
    });

    it('should filter stats by car_number when provided', async () => {
      const byType = [{ component_type: 'valve', count: '3' }];
      const byStatus = [{ status: 'active', count: '3' }];

      mockQuery.mockResolvedValueOnce(byType as any);
      mockQuery.mockResolvedValueOnce(byStatus as any);
      mockQueryOne.mockResolvedValueOnce({ count: '3' } as any);

      const result = await getComponentStats('GATX-12345');

      expect(result.total).toBe(3);
      expect(result.by_type).toHaveLength(1);
      expect(result.by_type[0].count).toBe(3);

      // WHERE clause should be present with car_number
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('WHERE car_number = $1'),
        ['GATX-12345']
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('WHERE car_number = $1'),
        ['GATX-12345']
      );
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE car_number = $1'),
        ['GATX-12345']
      );
    });

    it('should handle null total count gracefully', async () => {
      mockQuery.mockResolvedValueOnce([] as any);
      mockQuery.mockResolvedValueOnce([] as any);
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getComponentStats();

      expect(result.total).toBe(0);
      expect(result.by_type).toHaveLength(0);
      expect(result.by_status).toHaveLength(0);
    });
  });
});
