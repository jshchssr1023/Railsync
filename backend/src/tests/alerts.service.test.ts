/**
 * Alerts Service Tests
 *
 * Tests alert CRUD, read/dismiss lifecycle, bulk dismiss, unread counting,
 * deduplication (alertExists / createAlertIfNotExists), expired cleanup,
 * and all alert generators (qual escalations, invoice overdue,
 * inspection overdue, runAlertGenerators).
 */

import {
  createAlert,
  getActiveAlerts,
  getAlertsByType,
  markAlertRead,
  dismissAlert,
  dismissAlertsByType,
  countUnreadAlerts,
  alertExists,
  createAlertIfNotExists,
  cleanupExpiredAlerts,
  generateQualOverdueEscalations,
  generateInvoiceOverdueAlerts,
  generateInspectionOverdueAlerts,
  runAlertGenerators,
  CreateAlertInput,
} from '../services/alerts.service';

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

function createMockAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alert-1',
    alert_type: 'qual_due_30',
    severity: 'warning',
    title: 'Qualification due in 30 days',
    message: 'Car UTLX123456 tank test due soon.',
    entity_type: 'qualification',
    entity_id: 'qual-1',
    target_user_id: null,
    target_role: 'operator',
    is_read: false,
    is_dismissed: false,
    dismissed_by: null,
    dismissed_at: null,
    expires_at: null,
    metadata: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

function createMockAlertInput(overrides: Partial<CreateAlertInput> = {}): CreateAlertInput {
  return {
    alert_type: 'qual_due_30',
    severity: 'warning',
    title: 'Qualification due in 30 days',
    message: 'Car UTLX123456 tank test due soon.',
    entity_type: 'qualification',
    entity_id: 'qual-1',
    target_role: 'operator',
    ...overrides,
  };
}

// ==============================================================================
// Setup
// ==============================================================================

beforeEach(() => {
  jest.clearAllMocks();
});

// ==============================================================================
// createAlert
// ==============================================================================

describe('createAlert', () => {
  it('should insert alert with all fields and return the created row', async () => {
    const input = createMockAlertInput({
      metadata: { days_remaining: 28 },
    });
    const expected = createMockAlert({ metadata: { days_remaining: 28 } });

    mockQuery.mockResolvedValueOnce([expected]);

    const result = await createAlert(input);

    expect(result).toEqual(expected);
    expect(mockQuery).toHaveBeenCalledTimes(1);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO alerts');
    expect(sql).toContain('RETURNING *');
    expect(params).toEqual([
      'qual_due_30',
      'warning',
      'Qualification due in 30 days',
      'Car UTLX123456 tank test due soon.',
      'qualification',
      'qual-1',
      null, // target_user_id
      'operator',
      null, // expires_at
      JSON.stringify({ days_remaining: 28 }),
    ]);
  });

  it('should pass null for optional fields when not provided', async () => {
    const input: CreateAlertInput = {
      alert_type: 'capacity_warning',
      severity: 'info',
      title: 'Capacity approaching limit',
    };
    const expected = createMockAlert({
      alert_type: 'capacity_warning',
      severity: 'info',
      title: 'Capacity approaching limit',
      message: null,
      entity_type: null,
      entity_id: null,
      target_user_id: null,
      target_role: null,
    });

    mockQuery.mockResolvedValueOnce([expected]);

    const result = await createAlert(input);

    expect(result).toEqual(expected);
    const params = mockQuery.mock.calls[0][1];
    // message, entity_type, entity_id, target_user_id, target_role, expires_at, metadata -> null
    expect(params![3]).toBeNull(); // message
    expect(params![4]).toBeNull(); // entity_type
    expect(params![5]).toBeNull(); // entity_id
    expect(params![6]).toBeNull(); // target_user_id
    expect(params![7]).toBeNull(); // target_role
    expect(params![8]).toBeNull(); // expires_at
    expect(params![9]).toBeNull(); // metadata
  });
});

// ==============================================================================
// getActiveAlerts
// ==============================================================================

describe('getActiveAlerts', () => {
  it('should query v_active_alerts by userId', async () => {
    const alerts = [createMockAlert(), createMockAlert({ id: 'alert-2' })];
    mockQuery.mockResolvedValueOnce(alerts);

    const result = await getActiveAlerts('user-1', undefined, 50);

    expect(result).toEqual(alerts);
    expect(result).toHaveLength(2);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('v_active_alerts');
    expect(params![0]).toBe('user-1');
    expect(params![2]).toBe(50);
  });

  it('should query v_active_alerts by role', async () => {
    const alerts = [createMockAlert({ target_role: 'admin' })];
    mockQuery.mockResolvedValueOnce(alerts);

    const result = await getActiveAlerts(undefined, 'admin');

    expect(result).toEqual(alerts);
    const params = mockQuery.mock.calls[0][1];
    expect(params![0]).toBeNull(); // userId -> null
    expect(params![1]).toBe('admin');
  });

  it('should respect custom limit', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await getActiveAlerts('user-1', 'operator', 10);

    const params = mockQuery.mock.calls[0][1];
    expect(params![2]).toBe(10);
  });

  it('should default limit to 50 when not provided', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await getActiveAlerts('user-1');

    const params = mockQuery.mock.calls[0][1];
    expect(params![2]).toBe(50);
  });
});

// ==============================================================================
// getAlertsByType
// ==============================================================================

describe('getAlertsByType', () => {
  it('should return unread non-dismissed alerts of given type by default', async () => {
    const alerts = [createMockAlert({ alert_type: 'demurrage_risk' })];
    mockQuery.mockResolvedValueOnce(alerts);

    const result = await getAlertsByType('demurrage_risk');

    expect(result).toEqual(alerts);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('alert_type = $1');
    expect(sql).toContain('is_dismissed = FALSE');
    expect(sql).toContain('is_read = FALSE');
    expect(mockQuery.mock.calls[0][1]).toEqual(['demurrage_risk']);
  });

  it('should include read alerts when includeRead is true', async () => {
    const alerts = [
      createMockAlert({ is_read: false }),
      createMockAlert({ id: 'alert-2', is_read: true }),
    ];
    mockQuery.mockResolvedValueOnce(alerts);

    const result = await getAlertsByType('qual_due_30', true);

    expect(result).toHaveLength(2);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('is_read = FALSE');
    // Still excludes dismissed
    expect(sql).toContain('is_dismissed = FALSE');
  });
});

// ==============================================================================
// markAlertRead
// ==============================================================================

describe('markAlertRead', () => {
  it('should set is_read=TRUE and return updated alert', async () => {
    const updated = createMockAlert({ is_read: true, updated_at: '2026-01-16T12:00:00Z' });
    mockQuery.mockResolvedValueOnce([updated]);

    const result = await markAlertRead('alert-1');

    expect(result).toEqual(updated);
    expect(result!.is_read).toBe(true);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('SET is_read = TRUE');
    expect(sql).toContain('RETURNING *');
    expect(params).toEqual(['alert-1']);
  });

  it('should return null when alert not found', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await markAlertRead('nonexistent');

    expect(result).toBeNull();
  });
});

// ==============================================================================
// dismissAlert
// ==============================================================================

describe('dismissAlert', () => {
  it('should set is_dismissed=TRUE with dismissed_by and return updated alert', async () => {
    const dismissed = createMockAlert({
      is_dismissed: true,
      dismissed_by: 'user-5',
      dismissed_at: '2026-01-16T14:00:00Z',
    });
    mockQuery.mockResolvedValueOnce([dismissed]);

    const result = await dismissAlert('alert-1', 'user-5');

    expect(result).toEqual(dismissed);
    expect(result!.is_dismissed).toBe(true);
    expect(result!.dismissed_by).toBe('user-5');
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('SET is_dismissed = TRUE');
    expect(sql).toContain('dismissed_by = $2');
    expect(params).toEqual(['alert-1', 'user-5']);
  });

  it('should return null when alert not found', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await dismissAlert('nonexistent', 'user-5');

    expect(result).toBeNull();
  });
});

// ==============================================================================
// dismissAlertsByType
// ==============================================================================

describe('dismissAlertsByType', () => {
  it('should bulk dismiss all non-dismissed alerts of a type and return count', async () => {
    mockQuery.mockResolvedValueOnce([{ count: '7' }]);

    const result = await dismissAlertsByType('qual_due_30', 'user-3');

    expect(result).toBe(7);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('alert_type = $1 AND is_dismissed = FALSE');
    expect(sql).toContain('dismissed_by = $2');
    expect(params).toEqual(['qual_due_30', 'user-3']);
  });

  it('should return 0 when no alerts match', async () => {
    mockQuery.mockResolvedValueOnce([{ count: '0' }]);

    const result = await dismissAlertsByType('capacity_critical', 'user-3');

    expect(result).toBe(0);
  });
});

// ==============================================================================
// countUnreadAlerts
// ==============================================================================

describe('countUnreadAlerts', () => {
  it('should count unread alerts for a specific user', async () => {
    mockQueryOne.mockResolvedValueOnce({ count: '12' });

    const result = await countUnreadAlerts('user-1');

    expect(result).toBe(12);
    const [sql, params] = mockQueryOne.mock.calls[0];
    expect(sql).toContain('v_active_alerts');
    expect(sql).toContain('is_read = FALSE');
    expect(params![0]).toBe('user-1');
  });

  it('should count unread alerts for a specific role', async () => {
    mockQueryOne.mockResolvedValueOnce({ count: '5' });

    const result = await countUnreadAlerts(undefined, 'admin');

    expect(result).toBe(5);
    const params = mockQueryOne.mock.calls[0][1];
    expect(params![0]).toBeNull();
    expect(params![1]).toBe('admin');
  });

  it('should return 0 when queryOne returns null', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const result = await countUnreadAlerts();

    expect(result).toBe(0);
  });
});

// ==============================================================================
// alertExists
// ==============================================================================

describe('alertExists', () => {
  it('should return true when a matching non-dismissed alert exists', async () => {
    mockQueryOne.mockResolvedValueOnce({ exists: true });

    const result = await alertExists('qual_due_30', 'qualification', 'qual-1');

    expect(result).toBe(true);
    const [sql, params] = mockQueryOne.mock.calls[0];
    expect(sql).toContain('SELECT EXISTS');
    expect(sql).toContain('alert_type = $1');
    expect(sql).toContain('entity_type = $2');
    expect(sql).toContain('entity_id = $3');
    expect(sql).toContain('is_dismissed = FALSE');
    expect(params).toEqual(['qual_due_30', 'qualification', 'qual-1']);
  });

  it('should return false when no matching alert exists', async () => {
    mockQueryOne.mockResolvedValueOnce({ exists: false });

    const result = await alertExists('capacity_warning', 'shop', 'shop-99');

    expect(result).toBe(false);
  });

  it('should return false when queryOne returns null', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const result = await alertExists('sla_breach', 'contract', 'c-1');

    expect(result).toBe(false);
  });
});

// ==============================================================================
// createAlertIfNotExists
// ==============================================================================

describe('createAlertIfNotExists', () => {
  it('should create alert when no duplicate exists', async () => {
    const input = createMockAlertInput();
    const expected = createMockAlert();

    // alertExists check -> false
    mockQueryOne.mockResolvedValueOnce({ exists: false });
    // createAlert INSERT
    mockQuery.mockResolvedValueOnce([expected]);

    const result = await createAlertIfNotExists(input);

    expect(result).toEqual(expected);
    // Should have called alertExists (queryOne) then createAlert (query)
    expect(mockQueryOne).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('should return null when duplicate alert already exists', async () => {
    const input = createMockAlertInput();

    // alertExists check -> true
    mockQueryOne.mockResolvedValueOnce({ exists: true });

    const result = await createAlertIfNotExists(input);

    expect(result).toBeNull();
    // Should NOT have called createAlert
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('should skip existence check and always create when no entity_type/entity_id', async () => {
    const input = createMockAlertInput({
      entity_type: undefined,
      entity_id: undefined,
    });
    const expected = createMockAlert({ entity_type: null, entity_id: null });

    mockQuery.mockResolvedValueOnce([expected]);

    const result = await createAlertIfNotExists(input);

    expect(result).toEqual(expected);
    // Should NOT have called alertExists since no entity context
    expect(mockQueryOne).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

// ==============================================================================
// cleanupExpiredAlerts
// ==============================================================================

describe('cleanupExpiredAlerts', () => {
  it('should delete expired alerts and return count', async () => {
    mockQuery.mockResolvedValueOnce([{ count: '15' }]);

    const result = await cleanupExpiredAlerts();

    expect(result).toBe(15);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM alerts');
    expect(sql).toContain('expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP');
    expect(sql).toContain('COUNT(*)');
  });

  it('should return 0 when no expired alerts exist', async () => {
    mockQuery.mockResolvedValueOnce([{ count: '0' }]);

    const result = await cleanupExpiredAlerts();

    expect(result).toBe(0);
  });
});

// ==============================================================================
// generateQualOverdueEscalations
// ==============================================================================

describe('generateQualOverdueEscalations', () => {
  it('should find overdue quals 30+ days and create critical alerts', async () => {
    const overdueQuals = [
      {
        id: 'qual-10',
        car_number: 'UTLX111111',
        qualification_type: 'Tank Test',
        next_due_date: '2025-11-01',
      },
      {
        id: 'qual-11',
        car_number: 'UTLX222222',
        qualification_type: 'Valve Inspection',
        next_due_date: '2025-10-15',
      },
    ];

    // First call: SELECT overdue qualifications
    mockQuery.mockResolvedValueOnce(overdueQuals);
    // For each qual: alertExists (queryOne) + createAlert (query)
    // qual-10: alertExists -> false, then createAlert
    mockQueryOne.mockResolvedValueOnce({ exists: false });
    mockQuery.mockResolvedValueOnce([createMockAlert({ id: 'alert-new-1', alert_type: 'qual_overdue_escalation' })]);
    // qual-11: alertExists -> false, then createAlert
    mockQueryOne.mockResolvedValueOnce({ exists: false });
    mockQuery.mockResolvedValueOnce([createMockAlert({ id: 'alert-new-2', alert_type: 'qual_overdue_escalation' })]);

    const result = await generateQualOverdueEscalations();

    expect(result).toBe(2);

    // First query is the overdue scan
    const scanSql = mockQuery.mock.calls[0][0] as string;
    expect(scanSql).toContain('qualifications');
    expect(scanSql).toContain("status = 'overdue'");
    expect(scanSql).toContain("INTERVAL '30 days'");

    // createAlertIfNotExists was called with critical severity and correct entity info
    const insertSql1 = mockQuery.mock.calls[1][0] as string;
    expect(insertSql1).toContain('INSERT INTO alerts');
    const insertParams1 = mockQuery.mock.calls[1][1] as unknown[];
    expect(insertParams1[0]).toBe('qual_overdue_escalation');
    expect(insertParams1[1]).toBe('critical');
    expect(insertParams1[4]).toBe('qualification'); // entity_type
    expect(insertParams1[5]).toBe('qual-10'); // entity_id
    expect(insertParams1[7]).toBe('admin'); // target_role
  });

  it('should return 0 when no overdue qualifications found', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await generateQualOverdueEscalations();

    expect(result).toBe(0);
    expect(mockQuery).toHaveBeenCalledTimes(1); // Only the scan query
  });
});

// ==============================================================================
// generateInvoiceOverdueAlerts
// ==============================================================================

describe('generateInvoiceOverdueAlerts', () => {
  it('should find overdue invoices and create warning alerts', async () => {
    const overdueInvoices = [
      {
        id: 'inv-1',
        invoice_number: 'INV-2026-001',
        customer_name: 'Acme Corp',
        due_date: '2026-01-01',
        total_amount: 15000.5,
      },
    ];

    // Scan query
    mockQuery.mockResolvedValueOnce(overdueInvoices);
    // alertExists -> false
    mockQueryOne.mockResolvedValueOnce({ exists: false });
    // createAlert INSERT
    mockQuery.mockResolvedValueOnce([createMockAlert({ id: 'alert-inv-1', alert_type: 'invoice_overdue' })]);

    const result = await generateInvoiceOverdueAlerts();

    expect(result).toBe(1);

    // Verify scan query
    const scanSql = mockQuery.mock.calls[0][0] as string;
    expect(scanSql).toContain('outbound_invoices');
    expect(scanSql).toContain("status = 'sent'");
    expect(scanSql).toContain('due_date < CURRENT_DATE');

    // Verify alert creation params
    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(insertParams[0]).toBe('invoice_overdue');
    expect(insertParams[1]).toBe('warning');
    expect((insertParams[2] as string)).toContain('INV-2026-001');
    expect((insertParams[3] as string)).toContain('$15000.50');
    expect(insertParams[4]).toBe('outbound_invoice'); // entity_type
    expect(insertParams[5]).toBe('inv-1'); // entity_id
    expect(insertParams[7]).toBe('operator'); // target_role
  });

  it('should return 0 when no overdue invoices found', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await generateInvoiceOverdueAlerts();

    expect(result).toBe(0);
  });
});

// ==============================================================================
// generateInspectionOverdueAlerts
// ==============================================================================

describe('generateInspectionOverdueAlerts', () => {
  it('should find overdue component inspections and create warning alerts', async () => {
    const overdueComponents = [
      {
        id: 'comp-1',
        car_number: 'UTLX333333',
        component_type: 'Brake Valve',
        serial_number: 'BV-12345',
        next_inspection_due: '2025-12-15',
      },
      {
        id: 'comp-2',
        car_number: 'UTLX444444',
        component_type: 'Coupler',
        serial_number: 'CP-67890',
        next_inspection_due: '2025-11-30',
      },
    ];

    // Scan query
    mockQuery.mockResolvedValueOnce(overdueComponents);
    // comp-1: alertExists -> false, then createAlert
    mockQueryOne.mockResolvedValueOnce({ exists: false });
    mockQuery.mockResolvedValueOnce([createMockAlert({ id: 'alert-comp-1', alert_type: 'inspection_overdue' })]);
    // comp-2: alertExists -> false, then createAlert
    mockQueryOne.mockResolvedValueOnce({ exists: false });
    mockQuery.mockResolvedValueOnce([createMockAlert({ id: 'alert-comp-2', alert_type: 'inspection_overdue' })]);

    const result = await generateInspectionOverdueAlerts();

    expect(result).toBe(2);

    // Verify scan query
    const scanSql = mockQuery.mock.calls[0][0] as string;
    expect(scanSql).toContain('components');
    expect(scanSql).toContain("status = 'active'");
    expect(scanSql).toContain('next_inspection_due < CURRENT_DATE');

    // Verify first alert creation
    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(insertParams[0]).toBe('inspection_overdue');
    expect(insertParams[1]).toBe('warning');
    expect((insertParams[2] as string)).toContain('Brake Valve');
    expect((insertParams[2] as string)).toContain('UTLX333333');
    expect((insertParams[3] as string)).toContain('BV-12345');
    expect(insertParams[4]).toBe('component'); // entity_type
    expect(insertParams[5]).toBe('comp-1'); // entity_id
    expect(insertParams[7]).toBe('operator'); // target_role
  });

  it('should return 0 when no overdue inspections found', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await generateInspectionOverdueAlerts();

    expect(result).toBe(0);
  });
});

// ==============================================================================
// runAlertGenerators
// ==============================================================================

describe('runAlertGenerators', () => {
  it('should run all generators in parallel and return combined results', async () => {
    // The function calls four things in parallel via Promise.all:
    //   generateQualOverdueEscalations  -> query (scan)
    //   generateInvoiceOverdueAlerts    -> query (scan)
    //   generateInspectionOverdueAlerts -> query (scan)
    //   cleanupExpiredAlerts            -> query (delete expired)
    //
    // Since they run in parallel the call order to mockQuery is non-deterministic.
    // We resolve all scan queries with empty arrays (0 items found) and
    // the cleanup with a count of 3.
    //
    // We can use mockQuery.mockImplementation to inspect the SQL and route accordingly.

    mockQuery.mockImplementation(async (sql: string) => {
      const s = sql as string;
      if (s.includes('qualifications')) {
        return [] as any; // no overdue quals
      }
      if (s.includes('outbound_invoices')) {
        return [] as any; // no overdue invoices
      }
      if (s.includes('components')) {
        return [] as any; // no overdue inspections
      }
      if (s.includes('DELETE FROM alerts')) {
        return [{ count: '3' }] as any; // 3 expired cleaned
      }
      return [] as any;
    });

    const result = await runAlertGenerators();

    expect(result).toEqual({
      qual_escalations: 0,
      invoice_overdue: 0,
      inspection_overdue: 0,
      expired_cleaned: 3,
    });

    // All four generators should have been invoked (at least 4 query calls)
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it('should aggregate counts from all generators when items are found', async () => {
    // This test verifies the aggregation when generators find overdue items.
    // We use mockImplementation to route each SQL to the right response.
    let queryCallIndex = 0;
    const queryResponses: Record<string, unknown[][]> = {
      qualifications: [
        // Scan returns 1 overdue qual
        [{ id: 'q1', car_number: 'CAR1', qualification_type: 'Tank Test', next_due_date: '2025-10-01' }],
      ],
      outbound_invoices: [
        // Scan returns 0 overdue invoices
        [],
      ],
      components: [
        // Scan returns 1 overdue component
        [{ id: 'c1', car_number: 'CAR2', component_type: 'Valve', serial_number: 'SN1', next_inspection_due: '2025-11-01' }],
      ],
    };

    mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      const s = sql as string;
      if (s.includes('DELETE FROM alerts')) {
        return [{ count: '5' }] as any;
      }
      if (s.includes('FROM qualifications') && !s.includes('INSERT')) {
        return queryResponses.qualifications[0] as any;
      }
      if (s.includes('FROM outbound_invoices') && !s.includes('INSERT')) {
        return queryResponses.outbound_invoices[0] as any;
      }
      if (s.includes('FROM components') && !s.includes('INSERT')) {
        return queryResponses.components[0] as any;
      }
      if (s.includes('INSERT INTO alerts')) {
        return [createMockAlert({ id: `alert-gen-${++queryCallIndex}` })] as any;
      }
      return [] as any;
    });

    // alertExists calls for qual and component (both return false -> will create)
    mockQueryOne.mockResolvedValue({ exists: false });

    const result = await runAlertGenerators();

    expect(result).toEqual({
      qual_escalations: 1,
      invoice_overdue: 0,
      inspection_overdue: 1,
      expired_cleaned: 5,
    });
  });
});
