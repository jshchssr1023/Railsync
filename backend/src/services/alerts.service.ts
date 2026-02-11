import { query, queryOne } from '../config/database';

export type AlertType =
  | 'qual_due_30'
  | 'qual_due_60'
  | 'qual_due_90'
  | 'capacity_warning'
  | 'capacity_critical'
  | 'demurrage_risk'
  | 'brc_received'
  | 'bad_order_reported'
  | 'bad_order_critical'
  | 'assignment_expedited'
  | 'assignment_conflict'
  | 'project_car_at_shop'
  | 'car_released'
  | 'car_transferred'
  | 'qual_overdue_escalation'
  | 'sla_breach'
  | 'billing_exception'
  | 'invoice_overdue'
  | 'inspection_overdue'
  | 'component_due'
  | 'car_scrapped';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message?: string;
  entity_type?: string;
  entity_id?: string;
  target_user_id?: string;
  target_role?: string;
  is_read: boolean;
  is_dismissed: boolean;
  dismissed_by?: string;
  dismissed_at?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertInput {
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message?: string;
  entity_type?: string;
  entity_id?: string;
  target_user_id?: string;
  target_role?: string;
  expires_at?: Date;
  metadata?: Record<string, unknown>;
}

// Create a new alert
export async function createAlert(input: CreateAlertInput): Promise<Alert> {
  const result = await query<Alert>(
    `INSERT INTO alerts (
      alert_type, severity, title, message,
      entity_type, entity_id, target_user_id, target_role,
      expires_at, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      input.alert_type,
      input.severity,
      input.title,
      input.message || null,
      input.entity_type || null,
      input.entity_id || null,
      input.target_user_id || null,
      input.target_role || null,
      input.expires_at || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );

  return result[0];
}

// Get active alerts for a user
export async function getActiveAlerts(
  userId?: string,
  role?: string,
  limit = 50
): Promise<Alert[]> {
  return query<Alert>(
    `SELECT * FROM v_active_alerts
     WHERE (target_user_id IS NULL OR target_user_id = $1)
       AND (target_role IS NULL OR target_role = $2)
     LIMIT $3`,
    [userId || null, role || null, limit]
  );
}

// Get alerts by type
export async function getAlertsByType(
  alertType: AlertType,
  includeRead = false
): Promise<Alert[]> {
  const readClause = includeRead ? '' : 'AND is_read = FALSE';
  return query<Alert>(
    `SELECT * FROM alerts
     WHERE alert_type = $1
       AND is_dismissed = FALSE
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       ${readClause}
     ORDER BY created_at DESC`,
    [alertType]
  );
}

// Mark alert as read
export async function markAlertRead(alertId: string): Promise<Alert | null> {
  const result = await query<Alert>(
    `UPDATE alerts
     SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [alertId]
  );
  return result[0] || null;
}

// Dismiss alert
export async function dismissAlert(
  alertId: string,
  userId: string
): Promise<Alert | null> {
  const result = await query<Alert>(
    `UPDATE alerts
     SET is_dismissed = TRUE, dismissed_by = $2, dismissed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [alertId, userId]
  );
  return result[0] || null;
}

// Bulk dismiss alerts
export async function dismissAlertsByType(
  alertType: AlertType,
  userId: string
): Promise<number> {
  const result = await query<{ count: string }>(
    `WITH dismissed AS (
       UPDATE alerts
       SET is_dismissed = TRUE, dismissed_by = $2, dismissed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE alert_type = $1 AND is_dismissed = FALSE
       RETURNING id
     )
     SELECT COUNT(*) as count FROM dismissed`,
    [alertType, userId]
  );
  return parseInt(result[0]?.count || '0', 10);
}

// Count unread alerts for user
export async function countUnreadAlerts(
  userId?: string,
  role?: string
): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM v_active_alerts
     WHERE is_read = FALSE
       AND (target_user_id IS NULL OR target_user_id = $1)
       AND (target_role IS NULL OR target_role = $2)`,
    [userId || null, role || null]
  );
  return parseInt(result?.count || '0', 10);
}

// Check if similar alert exists (to prevent duplicates)
export async function alertExists(
  alertType: AlertType,
  entityType: string,
  entityId: string
): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM alerts
       WHERE alert_type = $1
         AND entity_type = $2
         AND entity_id = $3
         AND is_dismissed = FALSE
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     ) as exists`,
    [alertType, entityType, entityId]
  );
  return result?.exists || false;
}

// Create alert if not exists
export async function createAlertIfNotExists(
  input: CreateAlertInput
): Promise<Alert | null> {
  if (input.entity_type && input.entity_id) {
    const exists = await alertExists(
      input.alert_type,
      input.entity_type,
      input.entity_id
    );
    if (exists) {
      return null;
    }
  }
  return createAlert(input);
}

// Cleanup expired alerts (call periodically)
export async function cleanupExpiredAlerts(): Promise<number> {
  const result = await query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM alerts
       WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
       RETURNING id
     )
     SELECT COUNT(*) as count FROM deleted`,
    []
  );
  return parseInt(result[0]?.count || '0', 10);
}

// ============================================================================
// ALERT GENERATORS — scan for conditions and create alerts
// ============================================================================

/**
 * Scan for overdue qualifications that haven't had an escalation alert yet.
 */
export async function generateQualOverdueEscalations(): Promise<number> {
  const overdue = await query<{ id: string; car_number: string; qualification_type: string; next_due_date: string }>(
    `SELECT q.id, c.car_number, qt.name as qualification_type, q.next_due_date
     FROM qualifications q
     JOIN cars c ON c.id = q.car_id
     JOIN qualification_types qt ON qt.id = q.qualification_type_id
     WHERE q.status = 'overdue'
       AND q.next_due_date < CURRENT_DATE - INTERVAL '30 days'
       AND NOT EXISTS (
         SELECT 1 FROM alerts a
         WHERE a.alert_type = 'qual_overdue_escalation'
           AND a.entity_id = q.id::text
           AND a.is_dismissed = FALSE
       )`
  );

  let created = 0;
  for (const q of overdue) {
    await createAlertIfNotExists({
      alert_type: 'qual_overdue_escalation',
      severity: 'critical',
      title: `CRITICAL: ${q.qualification_type} overdue 30+ days on ${q.car_number}`,
      message: `Car ${q.car_number} has been overdue for ${q.qualification_type} since ${q.next_due_date}. Immediate action required.`,
      entity_type: 'qualification',
      entity_id: q.id,
      target_role: 'admin',
    });
    created++;
  }
  return created;
}

/**
 * Scan for overdue invoices (sent but unpaid past due date).
 */
export async function generateInvoiceOverdueAlerts(): Promise<number> {
  const overdue = await query<{ id: string; invoice_number: string; customer_name: string; due_date: string; total_amount: number }>(
    `SELECT oi.id, oi.invoice_number, c.customer_name, oi.due_date, oi.total_amount
     FROM outbound_invoices oi
     JOIN customers c ON c.id = oi.customer_id
     WHERE oi.status = 'sent'
       AND oi.due_date < CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM alerts a
         WHERE a.alert_type = 'invoice_overdue'
           AND a.entity_id = oi.id::text
           AND a.is_dismissed = FALSE
       )`
  );

  let created = 0;
  for (const inv of overdue) {
    await createAlertIfNotExists({
      alert_type: 'invoice_overdue',
      severity: 'warning',
      title: `Invoice ${inv.invoice_number} overdue — ${inv.customer_name}`,
      message: `Invoice ${inv.invoice_number} for $${inv.total_amount.toFixed(2)} was due ${inv.due_date} and remains unpaid.`,
      entity_type: 'outbound_invoice',
      entity_id: inv.id,
      target_role: 'operator',
    });
    created++;
  }
  return created;
}

/**
 * Scan for components with overdue inspections.
 */
export async function generateInspectionOverdueAlerts(): Promise<number> {
  const overdue = await query<{ id: string; car_number: string; component_type: string; serial_number: string; next_inspection_due: string }>(
    `SELECT id, car_number, component_type, serial_number, next_inspection_due
     FROM components
     WHERE status = 'active'
       AND next_inspection_due < CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM alerts a
         WHERE a.alert_type = 'inspection_overdue'
           AND a.entity_id = id::text
           AND a.is_dismissed = FALSE
       )`
  );

  let created = 0;
  for (const comp of overdue) {
    await createAlertIfNotExists({
      alert_type: 'inspection_overdue',
      severity: 'warning',
      title: `Inspection overdue: ${comp.component_type} on ${comp.car_number}`,
      message: `Component ${comp.serial_number} (${comp.component_type}) on car ${comp.car_number} was due for inspection on ${comp.next_inspection_due}.`,
      entity_type: 'component',
      entity_id: comp.id,
      target_role: 'operator',
    });
    created++;
  }
  return created;
}

/**
 * Run all alert generators. Called by a scheduled job.
 */
export async function runAlertGenerators(): Promise<{
  qual_escalations: number;
  invoice_overdue: number;
  inspection_overdue: number;
  expired_cleaned: number;
}> {
  const [qual_escalations, invoice_overdue, inspection_overdue, expired_cleaned] = await Promise.all([
    generateQualOverdueEscalations(),
    generateInvoiceOverdueAlerts(),
    generateInspectionOverdueAlerts(),
    cleanupExpiredAlerts(),
  ]);
  return { qual_escalations, invoice_overdue, inspection_overdue, expired_cleaned };
}
