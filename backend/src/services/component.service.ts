/**
 * Component Service — Manages physical component registry for railcars
 *
 * Tracks valves, BOVs, fittings, gauges, relief devices, linings, coatings,
 * heaters, and other components installed on railcars. Maintains a full
 * lifecycle audit trail via the component_history table.
 *
 * Tables: components, component_history
 */

import { query, queryOne, transaction } from '../config/database';
import { PoolClient } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export type ComponentType =
  | 'valve'
  | 'bov'
  | 'fitting'
  | 'gauge'
  | 'relief_device'
  | 'lining'
  | 'coating'
  | 'heater'
  | 'other';

export type ComponentStatus = 'active' | 'removed' | 'failed' | 'replaced';

export type HistoryAction =
  | 'installed'
  | 'inspected'
  | 'repaired'
  | 'replaced'
  | 'removed'
  | 'failed';

export interface Component {
  id: string;
  car_number: string;
  component_type: ComponentType;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  install_date: string | null;
  last_inspection_date: string | null;
  next_inspection_due: string | null;
  status: ComponentStatus;
  specification: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComponentHistory {
  id: string;
  component_id: string;
  action: HistoryAction;
  performed_by: string | null;
  performed_at: string;
  shop_code: string | null;
  old_serial_number: string | null;
  new_serial_number: string | null;
  work_order_reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface ComponentWithHistory extends Component {
  history: ComponentHistory[];
}

export interface CreateComponentInput {
  car_number: string;
  component_type: ComponentType;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  install_date?: string;
  last_inspection_date?: string;
  next_inspection_due?: string;
  specification?: string;
  notes?: string;
  created_by?: string;
}

export interface UpdateComponentInput {
  component_type?: ComponentType;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  install_date?: string;
  last_inspection_date?: string;
  next_inspection_due?: string;
  status?: ComponentStatus;
  specification?: string;
  notes?: string;
}

export interface ReplaceComponentInput {
  newSerialNumber: string;
  newManufacturer?: string;
  shopCode?: string;
  notes?: string;
}

export interface ComponentStats {
  by_type: { component_type: string; count: number }[];
  by_status: { status: string; count: number }[];
  total: number;
}

// Default inspection interval in days (1 year)
const DEFAULT_INSPECTION_INTERVAL_DAYS = 365;

// ============================================================================
// LIST COMPONENTS WITH FILTERS
// ============================================================================

/**
 * List components with optional filters, pagination.
 */
export async function listComponents(filters: {
  car_number?: string;
  component_type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ components: Component[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.car_number) {
    conditions.push(`car_number = $${paramIdx++}`);
    params.push(filters.car_number);
  }

  if (filters.component_type) {
    conditions.push(`component_type = $${paramIdx++}`);
    params.push(filters.component_type);
  }

  if (filters.status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(filters.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM components ${whereClause}`,
    params
  );

  const components = await query<Component>(
    `SELECT * FROM components ${whereClause}
     ORDER BY car_number, component_type, created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return {
    components,
    total: parseInt(countResult?.count || '0', 10),
  };
}

// ============================================================================
// GET SINGLE COMPONENT WITH HISTORY
// ============================================================================

/**
 * Get a single component by ID, including its full history.
 */
export async function getComponent(id: string): Promise<ComponentWithHistory | null> {
  const component = await queryOne<Component>(
    `SELECT * FROM components WHERE id = $1`,
    [id]
  );

  if (!component) return null;

  const history = await query<ComponentHistory>(
    `SELECT * FROM component_history
     WHERE component_id = $1
     ORDER BY performed_at DESC`,
    [id]
  );

  return { ...component, history };
}

/** Alias for getComponent — used by controller layer */
export const getComponentWithHistory = getComponent;

// ============================================================================
// GET ALL COMPONENTS FOR A CAR
// ============================================================================

/**
 * Get all components for a given car number.
 */
export async function getCarComponents(carNumber: string): Promise<Component[]> {
  return query<Component>(
    `SELECT * FROM components
     WHERE car_number = $1
     ORDER BY component_type, status, created_at DESC`,
    [carNumber]
  );
}

// ============================================================================
// CREATE COMPONENT
// ============================================================================

/**
 * Create a new component and record an 'installed' history entry.
 * An optional userId can be provided as a second argument to set created_by.
 */
export async function createComponent(
  data: CreateComponentInput,
  userId?: string
): Promise<ComponentWithHistory> {
  const createdBy = userId || data.created_by || null;

  const component = await queryOne<Component>(
    `INSERT INTO components (
      car_number, component_type, serial_number, manufacturer, model,
      install_date, last_inspection_date, next_inspection_due,
      status, specification, notes, created_by
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      'active', $9, $10, $11
    ) RETURNING *`,
    [
      data.car_number,
      data.component_type,
      data.serial_number || null,
      data.manufacturer || null,
      data.model || null,
      data.install_date || null,
      data.last_inspection_date || null,
      data.next_inspection_due || null,
      data.specification || null,
      data.notes || null,
      createdBy,
    ]
  );

  if (!component) {
    throw new Error('Failed to create component');
  }

  // Record installation history
  const historyEntry = await queryOne<ComponentHistory>(
    `INSERT INTO component_history (
      component_id, action, performed_by, new_serial_number, notes
    ) VALUES ($1, 'installed', $2, $3, $4)
    RETURNING *`,
    [
      component.id,
      createdBy,
      data.serial_number || null,
      data.notes || 'Component installed',
    ]
  );

  return { ...component, history: historyEntry ? [historyEntry] : [] };
}

// ============================================================================
// UPDATE COMPONENT
// ============================================================================

/**
 * Update a component's fields and record an 'repaired' history entry
 * for the modification. An optional userId can track who performed the update.
 */
export async function updateComponent(
  id: string,
  data: UpdateComponentInput,
  userId?: string
): Promise<Component | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  const updatableFields: (keyof UpdateComponentInput)[] = [
    'component_type',
    'serial_number',
    'manufacturer',
    'model',
    'install_date',
    'last_inspection_date',
    'next_inspection_due',
    'status',
    'specification',
    'notes',
  ];

  for (const field of updatableFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramIdx++}`);
      params.push(data[field]);
    }
  }

  if (fields.length === 0) {
    return queryOne<Component>(`SELECT * FROM components WHERE id = $1`, [id]);
  }

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const updated = await queryOne<Component>(
    `UPDATE components SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );

  if (!updated) return null;

  // Record update history
  await queryOne<ComponentHistory>(
    `INSERT INTO component_history (
      component_id, action, performed_by, notes
    ) VALUES ($1, 'repaired', $2, $3)
    RETURNING *`,
    [id, userId || null, 'Component record updated']
  );

  return updated;
}

// ============================================================================
// REPLACE COMPONENT
// ============================================================================

/**
 * Replace a component: marks the old one as 'replaced', creates a new
 * component with the new serial number, and records both history entries
 * within a single transaction.
 *
 * Supports two calling conventions:
 *   replaceComponent(id, newSerialNumber, newManufacturer, performedBy, shopCode, notes)
 *   replaceComponent(id, { newSerialNumber, newManufacturer, shopCode, notes }, performedBy)
 */
export async function replaceComponent(
  id: string,
  newSerialNumberOrOpts: string | ReplaceComponentInput,
  newManufacturerOrPerformedBy?: string | null,
  performedBy?: string | null,
  shopCode?: string | null,
  notes?: string | null
): Promise<{ oldComponent: Component; newComponent: ComponentWithHistory }> {
  // Normalize arguments for both calling conventions
  let _newSerialNumber: string;
  let _newManufacturer: string | null;
  let _performedBy: string | null;
  let _shopCode: string | null;
  let _notes: string | null;

  if (typeof newSerialNumberOrOpts === 'object') {
    // Called as replaceComponent(id, opts, userId)
    const opts = newSerialNumberOrOpts;
    _newSerialNumber = opts.newSerialNumber;
    _newManufacturer = opts.newManufacturer || null;
    _performedBy = (newManufacturerOrPerformedBy as string) || null;
    _shopCode = opts.shopCode || null;
    _notes = opts.notes || null;
  } else {
    // Called as replaceComponent(id, newSerialNumber, newManufacturer, performedBy, shopCode, notes)
    _newSerialNumber = newSerialNumberOrOpts;
    _newManufacturer = (newManufacturerOrPerformedBy as string) || null;
    _performedBy = performedBy || null;
    _shopCode = shopCode || null;
    _notes = notes || null;
  }

  return transaction(async (client: PoolClient) => {
    // Fetch the existing component with a lock
    const oldResult = await client.query(
      `SELECT * FROM components WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (oldResult.rows.length === 0) {
      throw new Error(`Component ${id} not found`);
    }

    const old = oldResult.rows[0] as Component;

    if (old.status !== 'active') {
      throw new Error(`Cannot replace component in '${old.status}' status — must be active`);
    }

    // Mark old component as replaced
    const updatedOldResult = await client.query(
      `UPDATE components SET status = 'replaced', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );

    // Record replacement history on the old component
    await client.query(
      `INSERT INTO component_history (
        component_id, action, performed_by, shop_code,
        old_serial_number, new_serial_number, notes
      ) VALUES ($1, 'replaced', $2, $3, $4, $5, $6)`,
      [
        id,
        _performedBy,
        _shopCode,
        old.serial_number || null,
        _newSerialNumber,
        _notes || 'Component replaced',
      ]
    );

    // Create new component inheriting key fields from old
    const newResult = await client.query(
      `INSERT INTO components (
        car_number, component_type, serial_number, manufacturer, model,
        install_date, status, specification, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'active', $6, $7, $8)
      RETURNING *`,
      [
        old.car_number,
        old.component_type,
        _newSerialNumber,
        _newManufacturer || old.manufacturer,
        old.model,
        old.specification,
        _notes || null,
        _performedBy,
      ]
    );

    const newComponent = newResult.rows[0] as Component;

    // Record installation history on the new component
    const historyResult = await client.query(
      `INSERT INTO component_history (
        component_id, action, performed_by, shop_code,
        old_serial_number, new_serial_number, notes
      ) VALUES ($1, 'installed', $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        newComponent.id,
        _performedBy,
        _shopCode,
        old.serial_number || null,
        _newSerialNumber,
        _notes || `Replacement for component ${id}`,
      ]
    );

    return {
      oldComponent: updatedOldResult.rows[0] as Component,
      newComponent: {
        ...newComponent,
        history: historyResult.rows as ComponentHistory[],
      },
    };
  });
}

// ============================================================================
// REMOVE COMPONENT
// ============================================================================

/**
 * Mark a component as 'removed' and record history.
 *
 * Supports two calling conventions:
 *   removeComponent(id, performedBy, notes)
 *   removeComponent(id, notes, performedBy)  — used by controller (notes first)
 */
export async function removeComponent(
  id: string,
  performedByOrNotes: string | null,
  notesOrPerformedBy?: string | null
): Promise<Component | null> {
  // The controller calls removeComponent(id, notes, userId).
  // The spec says removeComponent(id, performedBy, notes).
  // We treat arg2 as performedBy and arg3 as notes per spec.
  const _performedBy = performedByOrNotes || null;
  const _notes = notesOrPerformedBy || null;

  const existing = await queryOne<Component>(
    `SELECT * FROM components WHERE id = $1`,
    [id]
  );

  if (!existing) return null;

  if (existing.status !== 'active') {
    throw new Error(`Cannot remove component in '${existing.status}' status — must be active`);
  }

  const updated = await queryOne<Component>(
    `UPDATE components SET status = 'removed', updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id]
  );

  await queryOne<ComponentHistory>(
    `INSERT INTO component_history (
      component_id, action, performed_by, old_serial_number, notes
    ) VALUES ($1, 'removed', $2, $3, $4)
    RETURNING *`,
    [
      id,
      _performedBy,
      existing.serial_number || null,
      _notes || 'Component removed',
    ]
  );

  return updated;
}

// ============================================================================
// RECORD INSPECTION
// ============================================================================

/**
 * Record an inspection on a component: updates last_inspection_date to now,
 * calculates next_inspection_due (1 year from now), and adds an 'inspected'
 * history entry.
 *
 * Supports two calling conventions:
 *   recordInspection(id, performedBy, shopCode, notes)
 *   recordInspection(id, { shopCode, notes }, performedBy)  — used by controller
 */
export async function recordInspection(
  id: string,
  performedByOrOpts: string | null | { shopCode?: string; notes?: string },
  shopCodeOrPerformedBy?: string | null,
  notes?: string | null
): Promise<Component | null> {
  let _performedBy: string | null;
  let _shopCode: string | null;
  let _notes: string | null;

  if (typeof performedByOrOpts === 'object' && performedByOrOpts !== null) {
    // Called as recordInspection(id, { shopCode, notes }, performedBy)
    const opts = performedByOrOpts;
    _performedBy = (shopCodeOrPerformedBy as string) || null;
    _shopCode = opts.shopCode || null;
    _notes = opts.notes || null;
  } else {
    // Called as recordInspection(id, performedBy, shopCode, notes)
    _performedBy = (performedByOrOpts as string) || null;
    _shopCode = (shopCodeOrPerformedBy as string) || null;
    _notes = notes || null;
  }

  const existing = await queryOne<Component>(
    `SELECT * FROM components WHERE id = $1`,
    [id]
  );

  if (!existing) return null;

  if (existing.status !== 'active') {
    throw new Error(`Cannot inspect component in '${existing.status}' status — must be active`);
  }

  const updated = await queryOne<Component>(
    `UPDATE components SET
      last_inspection_date = CURRENT_DATE,
      next_inspection_due = CURRENT_DATE + INTERVAL '${DEFAULT_INSPECTION_INTERVAL_DAYS} days',
      updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id]
  );

  await queryOne<ComponentHistory>(
    `INSERT INTO component_history (
      component_id, action, performed_by, shop_code, notes
    ) VALUES ($1, 'inspected', $2, $3, $4)
    RETURNING *`,
    [
      id,
      _performedBy,
      _shopCode,
      _notes || 'Inspection completed',
    ]
  );

  return updated;
}

// ============================================================================
// GET COMPONENT HISTORY
// ============================================================================

/**
 * Get all history entries for a component, ordered newest first.
 */
export async function getComponentHistory(componentId: string): Promise<ComponentHistory[]> {
  return query<ComponentHistory>(
    `SELECT * FROM component_history
     WHERE component_id = $1
     ORDER BY performed_at DESC`,
    [componentId]
  );
}

// ============================================================================
// GET COMPONENT STATS
// ============================================================================

/**
 * Get component counts grouped by type and status. Optionally filter by car_number.
 */
export async function getComponentStats(carNumber?: string): Promise<ComponentStats> {
  const carFilter = carNumber ? 'WHERE car_number = $1' : '';
  const params = carNumber ? [carNumber] : [];

  const byType = await query<{ component_type: string; count: string }>(
    `SELECT component_type, COUNT(*) AS count
     FROM components ${carFilter}
     GROUP BY component_type
     ORDER BY count DESC`,
    params
  );

  const byStatus = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) AS count
     FROM components ${carFilter}
     GROUP BY status
     ORDER BY count DESC`,
    params
  );

  const totalResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM components ${carFilter}`,
    params
  );

  return {
    by_type: byType.map((r) => ({ component_type: r.component_type, count: parseInt(r.count, 10) })),
    by_status: byStatus.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
    total: parseInt(totalResult?.count || '0', 10),
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
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
};
