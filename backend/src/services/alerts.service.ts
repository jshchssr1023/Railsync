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
  | 'project_car_at_shop';

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
