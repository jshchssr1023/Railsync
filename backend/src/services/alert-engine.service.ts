/**
 * Alert Engine Service
 *
 * Generates system alerts by checking current system state against business rules.
 * Covers:
 * 1. Qualification due-date alerts (30/60/90 day windows, overdue)
 * 2. SLA breach alerts for shopping events exceeding expected timelines
 * 3. Billing exception alerts (overdue invoices, failed SAP pushes)
 *
 * Uses the alerts table defined in migration 004_add_alerts.sql.
 */

import { query, queryOne } from '../config/database';

// =============================================================================
// 1. QUALIFICATION ALERTS
// =============================================================================

export async function generateQualificationAlerts(): Promise<number> {
  // Find cars with qualifications due within 90 days (or already past due)
  const rows = await query(
    `SELECT q.id, q.car_id, c.car_number, q.qualification_type, q.next_due_date,
            q.status
     FROM qualifications q
     JOIN cars c ON c.id = q.car_id
     WHERE q.status != 'expired'
       AND q.next_due_date IS NOT NULL
       AND q.next_due_date <= CURRENT_DATE + INTERVAL '90 days'
     ORDER BY q.next_due_date ASC`
  );

  let alertCount = 0;

  for (const row of rows) {
    const dueDate = new Date(row.next_due_date);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let alertType: string;
    let severity: string;
    let title: string;

    if (daysUntilDue < 0) {
      alertType = 'qual_overdue';
      severity = 'critical';
      title = `Qualification overdue: ${row.car_number} - ${row.qualification_type}`;
    } else if (daysUntilDue <= 30) {
      alertType = 'qual_due_30';
      severity = 'critical';
      title = `Qualification due within 30 days: ${row.car_number} - ${row.qualification_type}`;
    } else if (daysUntilDue <= 60) {
      alertType = 'qual_due_60';
      severity = 'warning';
      title = `Qualification due within 60 days: ${row.car_number} - ${row.qualification_type}`;
    } else {
      alertType = 'qual_due_90';
      severity = 'info';
      title = `Qualification due within 90 days: ${row.car_number} - ${row.qualification_type}`;
    }

    const message = `Car ${row.car_number} has ${row.qualification_type} qualification due on ${dueDate.toISOString().split('T')[0]}. Days remaining: ${daysUntilDue}.`;

    const metadata = JSON.stringify({
      qualification_id: row.id,
      car_id: row.car_id,
      car_number: row.car_number,
      qualification_type: row.qualification_type,
      next_due_date: row.next_due_date,
      days_until_due: daysUntilDue,
    });

    // Insert only if no active (non-dismissed) alert of the same type for this entity exists
    const result = await query(
      `INSERT INTO alerts (alert_type, severity, title, message, entity_type, entity_id, target_role, metadata)
       SELECT $1, $2, $3, $4, 'car', $5, 'operator', $6::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM alerts WHERE alert_type = $1 AND entity_id = $5 AND is_dismissed = FALSE
       )`,
      [alertType, severity, title, message, row.car_id, metadata]
    );

    // pg returns rowCount for INSERT when using SELECT ... WHERE NOT EXISTS
    if (result && (result as any).rowCount > 0) {
      alertCount++;
    }
  }

  return alertCount;
}

// =============================================================================
// 2. SLA ALERTS
// =============================================================================

export async function generateSLAAlerts(): Promise<number> {
  // Find shopping events open for more than 30 days
  const rows = await query(
    `SELECT se.id, se.car_number, se.shop_code, se.status, se.created_at,
            EXTRACT(DAY FROM NOW() - se.created_at) as days_open
     FROM shopping_events se
     WHERE se.status NOT IN ('COMPLETE', 'CANCELLED', 'HEALTHY')
       AND se.created_at < CURRENT_DATE - INTERVAL '30 days'`
  );

  let alertCount = 0;

  for (const row of rows) {
    const daysOpen = Math.round(Number(row.days_open));
    const title = `SLA breach: Shopping event ${row.car_number} at ${row.shop_code} open ${daysOpen} days`;
    const message = `Shopping event for car ${row.car_number} at shop ${row.shop_code} has been in "${row.status}" status for ${daysOpen} days, exceeding the 30-day SLA.`;

    const metadata = JSON.stringify({
      shopping_event_id: row.id,
      car_number: row.car_number,
      shop_code: row.shop_code,
      status: row.status,
      days_open: daysOpen,
      created_at: row.created_at,
    });

    const result = await query(
      `INSERT INTO alerts (alert_type, severity, title, message, entity_type, entity_id, target_role, metadata)
       SELECT $1, $2, $3, $4, 'car', $5, 'operator', $6::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM alerts WHERE alert_type = $1 AND entity_id = $5 AND is_dismissed = FALSE
       )`,
      ['sla_breach', 'warning', title, message, row.id, metadata]
    );

    if (result && (result as any).rowCount > 0) {
      alertCount++;
    }
  }

  return alertCount;
}

// =============================================================================
// 3. BILLING ALERTS
// =============================================================================

export async function generateBillingAlerts(): Promise<number> {
  let alertCount = 0;

  // 3a. Overdue outbound invoices
  const overdueInvoices = await query(
    `SELECT id, invoice_number, customer_name, due_date, total_amount
     FROM outbound_invoices
     WHERE status = 'sent' AND due_date < CURRENT_DATE`
  );

  for (const inv of overdueInvoices) {
    const title = `Overdue invoice: ${inv.invoice_number}`;
    const message = `Invoice ${inv.invoice_number} for ${inv.customer_name || 'unknown'} was due on ${new Date(inv.due_date).toISOString().split('T')[0]} and remains unpaid.`;

    const metadata = JSON.stringify({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name,
      due_date: inv.due_date,
      total_amount: inv.total_amount,
    });

    const result = await query(
      `INSERT INTO alerts (alert_type, severity, title, message, entity_type, entity_id, target_role, metadata)
       SELECT $1, $2, $3, $4, 'invoice', $5, 'admin', $6::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM alerts WHERE alert_type = $1 AND entity_id = $5 AND is_dismissed = FALSE
       )`,
      ['billing_overdue', 'warning', title, message, inv.id, metadata]
    );

    if (result && (result as any).rowCount > 0) {
      alertCount++;
    }
  }

  // 3b. Failed SAP pushes in last 24 hours
  const sapFailures = await queryOne(
    `SELECT COUNT(*)::int as fail_count
     FROM integration_sync_log
     WHERE system_name = 'sap'
       AND status = 'failed'
       AND created_at > CURRENT_DATE - INTERVAL '24 hours'`
  );

  const failCount = sapFailures?.fail_count || 0;

  if (failCount > 0) {
    const title = `SAP integration failures: ${failCount} in last 24 hours`;
    const message = `${failCount} SAP push operations have failed in the last 24 hours. Review the integration sync log for details.`;

    const metadata = JSON.stringify({
      fail_count: failCount,
      checked_at: new Date().toISOString(),
    });

    // Use a fixed entity_id for the SAP failure batch alert to avoid duplicates
    const result = await query(
      `INSERT INTO alerts (alert_type, severity, title, message, entity_type, entity_id, target_role, metadata)
       SELECT $1, $2, $3, $4, 'integration', 'sap_daily_failures', 'admin', $5::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM alerts WHERE alert_type = $1 AND entity_id = 'sap_daily_failures' AND is_dismissed = FALSE
       )`,
      ['sap_push_failure', 'critical', title, message, metadata]
    );

    if (result && (result as any).rowCount > 0) {
      alertCount++;
    }
  }

  return alertCount;
}

// =============================================================================
// 4. ORCHESTRATOR
// =============================================================================

export async function runAlertGeneration(): Promise<{
  qualification_alerts: number;
  sla_alerts: number;
  billing_alerts: number;
  total: number;
  generated_at: string;
}> {
  const qualification_alerts = await generateQualificationAlerts();
  const sla_alerts = await generateSLAAlerts();
  const billing_alerts = await generateBillingAlerts();

  return {
    qualification_alerts,
    sla_alerts,
    billing_alerts,
    total: qualification_alerts + sla_alerts + billing_alerts,
    generated_at: new Date().toISOString(),
  };
}

// =============================================================================
// 5. GET ACTIVE ALERTS
// =============================================================================

export async function getActiveAlerts(_userId?: string, _role?: string): Promise<any[]> {
  const rows = await query(
    `SELECT * FROM alerts
     WHERE is_dismissed = FALSE
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     ORDER BY
       CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
       created_at DESC
     LIMIT 100`
  );

  return rows;
}

// =============================================================================
// 6. DISMISS ALERT
// =============================================================================

export async function dismissAlert(alertId: string, userId: string): Promise<void> {
  await query(
    `UPDATE alerts
     SET is_dismissed = TRUE,
         dismissed_at = NOW(),
         dismissed_by = $2
     WHERE id = $1`,
    [alertId, userId]
  );
}

// =============================================================================
// 7. ALERT STATS
// =============================================================================

export async function getAlertStats(): Promise<{
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  total_active: number;
}> {
  const severityRows = await query(
    `SELECT severity, COUNT(*)::int as count
     FROM alerts
     WHERE is_dismissed = FALSE
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     GROUP BY severity`
  );

  const typeRows = await query(
    `SELECT alert_type, COUNT(*)::int as count
     FROM alerts
     WHERE is_dismissed = FALSE
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     GROUP BY alert_type`
  );

  const by_severity: Record<string, number> = {};
  for (const row of severityRows) {
    by_severity[row.severity] = row.count;
  }

  const by_type: Record<string, number> = {};
  for (const row of typeRows) {
    by_type[row.alert_type] = row.count;
  }

  const total_active = Object.values(by_severity).reduce((sum, n) => sum + n, 0);

  return { by_severity, by_type, total_active };
}
