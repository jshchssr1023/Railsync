/**
 * Project Audit Service - Immutable audit event writer for project plan lifecycle.
 *
 * All audit events are append-only. The database trigger prevents_update/delete.
 * Pattern mirrors invoice_audit_events from migration 031.
 */

import { query } from '../config/database';
import type { ProjectPlanAuditEvent } from '../types';

export interface AuditEventInput {
  project_id: string;
  project_assignment_id?: string;
  car_number?: string;
  actor_id?: string;
  actor_email?: string;
  action: string;
  before_state?: string;
  after_state?: string;
  plan_snapshot?: Record<string, unknown>;
  reason?: string;
  notes?: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Write a single immutable audit event
 */
export async function writeAuditEvent(input: AuditEventInput): Promise<ProjectPlanAuditEvent> {
  const sql = `
    INSERT INTO project_plan_audit_events (
      project_id, project_assignment_id, car_number,
      actor_id, actor_email, action,
      before_state, after_state, plan_snapshot,
      reason, notes, ip_address, user_agent
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
    RETURNING *
  `;

  const rows = await query<ProjectPlanAuditEvent>(sql, [
    input.project_id,
    input.project_assignment_id || null,
    input.car_number || null,
    input.actor_id || null,
    input.actor_email || null,
    input.action,
    input.before_state || null,
    input.after_state || null,
    input.plan_snapshot ? JSON.stringify(input.plan_snapshot) : null,
    input.reason || null,
    input.notes || null,
    input.ip_address || null,
    input.user_agent || null,
  ]);

  return rows[0];
}

/**
 * Write audit event within an existing transaction client
 */
export async function writeAuditEventTx(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: ProjectPlanAuditEvent[] }> },
  input: AuditEventInput
): Promise<ProjectPlanAuditEvent> {
  const sql = `
    INSERT INTO project_plan_audit_events (
      project_id, project_assignment_id, car_number,
      actor_id, actor_email, action,
      before_state, after_state, plan_snapshot,
      reason, notes, ip_address, user_agent
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
    RETURNING *
  `;

  const result = await client.query(sql, [
    input.project_id,
    input.project_assignment_id || null,
    input.car_number || null,
    input.actor_id || null,
    input.actor_email || null,
    input.action,
    input.before_state || null,
    input.after_state || null,
    input.plan_snapshot ? JSON.stringify(input.plan_snapshot) : null,
    input.reason || null,
    input.notes || null,
    input.ip_address || null,
    input.user_agent || null,
  ]);

  return result.rows[0];
}

/**
 * Get audit events for a project
 */
export async function getProjectAuditEvents(
  projectId: string,
  carNumber?: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ events: ProjectPlanAuditEvent[]; total: number }> {
  const conditions = ['ppae.project_id = $1'];
  const params: (string | number)[] = [projectId];
  let paramIdx = 2;

  if (carNumber) {
    conditions.push(`ppae.car_number = $${paramIdx++}`);
    params.push(carNumber);
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*) as total FROM project_plan_audit_events ppae WHERE ${whereClause}`,
    params
  );

  const total = parseInt(countResult[0]?.total || '0', 10);

  const sql = `
    SELECT ppae.*,
      TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS actor_name
    FROM project_plan_audit_events ppae
    LEFT JOIN users u ON u.id = ppae.actor_id
    WHERE ${whereClause}
    ORDER BY ppae.event_timestamp DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  params.push(limit, offset);
  const events = await query<ProjectPlanAuditEvent>(sql, params);

  return { events, total };
}

export default {
  writeAuditEvent,
  writeAuditEventTx,
  getProjectAuditEvents,
};
