/**
 * Bad Order Service - Manages bad order reports
 *
 * Bad orders represent cars that need unplanned repair work.
 * The service integrates with SSOT assignments for conflict detection.
 */

import { query, pool } from '../config/database';
import { getActiveAssignment } from './assignment.service';
import { createAlert } from './alerts.service';
import { notifyBadOrder } from './email.service';
import { logTransition, canRevert, markReverted, getLastTransition } from './transition-log.service';

// ============================================================================
// TYPES
// ============================================================================

export type BadOrderSeverity = 'critical' | 'high' | 'medium' | 'low';
export type BadOrderStatus = 'open' | 'pending_decision' | 'assigned' | 'resolved';
export type ResolutionAction = 'expedite_existing' | 'new_shop_combined' | 'repair_only' | 'planning_review';

export interface BadOrderReport {
  id: string;
  car_id?: string;
  car_number: string;
  reported_date: string;
  issue_type: string;
  issue_description: string;
  severity: BadOrderSeverity;
  location?: string;
  reported_by?: string;
  reporter_contact?: string;
  status: BadOrderStatus;
  resolution_action?: ResolutionAction;
  assignment_id?: string;
  resolved_at?: string;
  resolved_by_id?: string;
  resolution_notes?: string;
  existing_assignment_id?: string;
  existing_shop_code?: string;
  existing_target_month?: string;
  had_existing_plan: boolean;
  created_at: string;
  created_by_id?: string;
}

export interface CreateBadOrderInput {
  car_number: string;
  issue_type: string;
  issue_description: string;
  severity: BadOrderSeverity;
  location?: string;
  reported_by?: string;
  reporter_contact?: string;
  created_by_id?: string;
}

export interface ResolveBadOrderInput {
  action: ResolutionAction;
  assignment_id?: string;
  resolution_notes?: string;
  resolved_by_id?: string;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export async function createBadOrder(input: CreateBadOrderInput): Promise<BadOrderReport> {
  // Check if car has existing active assignment
  const existingAssignment = await getActiveAssignment(input.car_number);

  const sql = `
    INSERT INTO bad_order_reports (
      car_number, reported_date, issue_type, issue_description, severity,
      location, reported_by, reporter_contact, status,
      had_existing_plan, existing_assignment_id, existing_shop_code, existing_target_month,
      created_by_id
    ) VALUES (
      $1, CURRENT_DATE, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13
    )
    RETURNING *
  `;

  const result = await query(sql, [
    input.car_number,
    input.issue_type,
    input.issue_description,
    input.severity,
    input.location || null,
    input.reported_by || null,
    input.reporter_contact || null,
    existingAssignment ? 'pending_decision' : 'open',
    !!existingAssignment,
    existingAssignment?.id || null,
    existingAssignment?.shop_code || null,
    existingAssignment?.target_month || null,
    input.created_by_id || null,
  ]);

  const badOrder = result[0];

  // Create alert for planning team
  const isCritical = input.severity === 'critical';
  await createAlert({
    alert_type: isCritical ? 'bad_order_critical' : 'bad_order_reported',
    severity: isCritical ? 'critical' : 'warning',
    title: `Bad Order: ${input.car_number}`,
    message: `${input.issue_type.replace(/_/g, ' ')} - ${input.issue_description.substring(0, 100)}`,
    entity_type: 'bad_order_reports',
    entity_id: badOrder.id,
    target_role: 'planner',
    metadata: {
      car_number: input.car_number,
      severity: input.severity,
      has_existing_plan: !!existingAssignment,
    },
  });

  // Queue email notifications for subscribed users
  try {
    await notifyBadOrder({
      car_number: input.car_number,
      shop_code: existingAssignment?.shop_code || 'Unassigned',
      issue: `${input.issue_type.replace(/_/g, ' ')}: ${input.issue_description.substring(0, 100)}`,
      reporter: input.reported_by || 'Unknown',
    });
  } catch (emailErr) {
    console.error('[BadOrder] Failed to queue email notifications:', emailErr);
    // Don't fail the bad order creation if email fails
  }

  return badOrder;
}

export async function getBadOrder(id: string): Promise<BadOrderReport | null> {
  const sql = `SELECT * FROM bad_order_reports WHERE id = $1`;
  const result = await query(sql, [id]);
  return result[0] || null;
}

export async function listBadOrders(filters: {
  car_number?: string;
  status?: BadOrderStatus | BadOrderStatus[];
  severity?: BadOrderSeverity;
  limit?: number;
  offset?: number;
}): Promise<{ reports: BadOrderReport[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (filters.car_number) {
    conditions.push(`car_number ILIKE $${paramIndex++}`);
    params.push(`%${filters.car_number}%`);
  }

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(`status = ANY($${paramIndex++})`);
      params.push(filters.status as unknown as string);
    } else {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
  }

  if (filters.severity) {
    conditions.push(`severity = $${paramIndex++}`);
    params.push(filters.severity);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countSql = `SELECT COUNT(*) as total FROM bad_order_reports ${whereClause}`;
  const countResult = await query(countSql, params);
  const total = parseInt(countResult[0]?.total || '0');

  // Get paginated results
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  const dataSql = `
    SELECT * FROM bad_order_reports
    ${whereClause}
    ORDER BY
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  const reports = await query(dataSql, [...params, limit, offset]);

  return { reports, total };
}

export async function resolveBadOrder(
  id: string,
  input: ResolveBadOrderInput
): Promise<BadOrderReport | null> {
  const sql = `
    UPDATE bad_order_reports SET
      status = CASE
        WHEN $2 = 'planning_review' THEN 'pending_decision'
        ELSE 'assigned'
      END,
      resolution_action = $2,
      assignment_id = $3,
      resolution_notes = $4,
      resolved_at = NOW(),
      resolved_by_id = $5
    WHERE id = $1
    RETURNING *
  `;

  const result = await query(sql, [
    id,
    input.action,
    input.assignment_id || null,
    input.resolution_notes || null,
    input.resolved_by_id || null,
  ]);

  const badOrder = result[0] || null;

  // Log the state transition
  if (badOrder) {
    const toState = input.action === 'planning_review' ? 'pending_decision' : 'assigned';
    await logTransition({
      processType: 'bad_order',
      entityId: id,
      entityNumber: badOrder.report_number || badOrder.car_number || id,
      fromState: 'open',
      toState,
      isReversible: true,
      actorId: input.resolved_by_id,
      notes: `Resolution: ${input.action}`,
    });
  }

  return badOrder;
}

export async function updateBadOrderStatus(
  id: string,
  status: BadOrderStatus
): Promise<BadOrderReport | null> {
  const sql = `
    UPDATE bad_order_reports SET status = $2
    WHERE id = $1
    RETURNING *
  `;
  const result = await query(sql, [id, status]);
  return result[0] || null;
}

export async function revertLastTransition(
  id: string,
  userId: string,
  notes?: string
): Promise<BadOrderReport> {
  const eligibility = await canRevert('bad_order', id);
  if (!eligibility.allowed) {
    throw new Error(`Cannot revert: ${eligibility.blockers.join('; ')}`);
  }

  const lastTransition = await getLastTransition('bad_order', id);
  if (!lastTransition) throw new Error('No transition to revert');

  // Revert the bad order to previous status
  const result = await pool.query(
    `UPDATE bad_order_reports
     SET status = $1, resolved_at = NULL, resolution_action = NULL, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [lastTransition.from_state || 'open', id]
  );

  if (!result.rows[0]) throw new Error('Bad order not found');

  // Log the reversal
  const reversalEntry = await logTransition({
    processType: 'bad_order',
    entityId: id,
    entityNumber: result.rows[0].report_number || result.rows[0].car_number || id,
    fromState: lastTransition.to_state,
    toState: lastTransition.from_state || 'open',
    isReversible: false,
    actorId: userId,
    notes: notes || 'Reverted by user',
  });

  await markReverted(lastTransition.id, userId, reversalEntry.id);

  return result.rows[0];
}
