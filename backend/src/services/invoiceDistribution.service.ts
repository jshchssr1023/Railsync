/**
 * Invoice Distribution Service
 * Automated email delivery of outbound invoices to customers.
 * Manages delivery configuration, template selection, and tracking.
 */

import { query, queryOne } from '../config/database';

// ============================================================================
// Types
// ============================================================================

export interface DistributionConfig {
  id: string;
  customer_id: string;
  delivery_method: 'email' | 'portal' | 'mail' | 'edi';
  email_recipients: string[];
  cc_recipients: string[];
  template_name: string;
  include_line_detail: boolean;
  include_pdf: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryRecord {
  id: string;
  invoice_id: string;
  customer_id: string;
  delivery_method: string;
  recipients: string[];
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  created_at: string;
}

// ============================================================================
// Distribution Config CRUD
// ============================================================================

export async function getDistributionConfig(
  customerId: string
): Promise<DistributionConfig | null> {
  return queryOne<DistributionConfig>(
    `SELECT * FROM invoice_distribution_config WHERE customer_id = $1 AND is_active = TRUE`,
    [customerId]
  );
}

export async function listDistributionConfigs(): Promise<DistributionConfig[]> {
  return query<DistributionConfig>(
    `SELECT idc.*, c.customer_code, c.customer_name
     FROM invoice_distribution_config idc
     JOIN customers c ON c.id = idc.customer_id
     WHERE idc.is_active = TRUE
     ORDER BY c.customer_name`
  );
}

export async function upsertDistributionConfig(data: {
  customer_id: string;
  delivery_method: string;
  email_recipients: string[];
  cc_recipients?: string[];
  template_name?: string;
  include_line_detail?: boolean;
  include_pdf?: boolean;
}): Promise<DistributionConfig> {
  const rows = await query<DistributionConfig>(
    `INSERT INTO invoice_distribution_config (
      customer_id, delivery_method, email_recipients, cc_recipients,
      template_name, include_line_detail, include_pdf
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (customer_id) WHERE is_active = TRUE
    DO UPDATE SET
      delivery_method = EXCLUDED.delivery_method,
      email_recipients = EXCLUDED.email_recipients,
      cc_recipients = EXCLUDED.cc_recipients,
      template_name = EXCLUDED.template_name,
      include_line_detail = EXCLUDED.include_line_detail,
      include_pdf = EXCLUDED.include_pdf,
      updated_at = NOW()
    RETURNING *`,
    [
      data.customer_id,
      data.delivery_method,
      data.email_recipients,
      data.cc_recipients || [],
      data.template_name || 'standard',
      data.include_line_detail !== false,
      data.include_pdf !== false,
    ]
  );
  return rows[0];
}

export async function deleteDistributionConfig(id: string): Promise<boolean> {
  const rows = await query(
    `UPDATE invoice_distribution_config SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows.length > 0;
}

// ============================================================================
// Invoice Delivery
// ============================================================================

/**
 * Queue an invoice for delivery based on the customer's distribution config.
 * In production this would trigger an email job; here we record the delivery attempt.
 */
export async function queueInvoiceDelivery(
  invoiceId: string,
  customerId: string
): Promise<DeliveryRecord | null> {
  const config = await getDistributionConfig(customerId);
  if (!config || config.email_recipients.length === 0) {
    return null;
  }

  const rows = await query<DeliveryRecord>(
    `INSERT INTO invoice_delivery_log (
      invoice_id, customer_id, delivery_method, recipients, status
    ) VALUES ($1, $2, $3, $4, 'pending')
    RETURNING *`,
    [invoiceId, customerId, config.delivery_method, config.email_recipients]
  );

  return rows[0] || null;
}

/**
 * Mark a delivery as sent.
 */
export async function markDeliverySent(
  deliveryId: string
): Promise<DeliveryRecord | null> {
  const rows = await query<DeliveryRecord>(
    `UPDATE invoice_delivery_log
     SET status = 'sent', sent_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [deliveryId]
  );
  return rows[0] || null;
}

/**
 * Mark a delivery as failed.
 */
export async function markDeliveryFailed(
  deliveryId: string,
  errorMessage: string
): Promise<DeliveryRecord | null> {
  const rows = await query<DeliveryRecord>(
    `UPDATE invoice_delivery_log
     SET status = 'failed', error_message = $2
     WHERE id = $1
     RETURNING *`,
    [deliveryId, errorMessage]
  );
  return rows[0] || null;
}

/**
 * Get delivery history for an invoice.
 */
export async function getInvoiceDeliveryHistory(
  invoiceId: string
): Promise<DeliveryRecord[]> {
  return query<DeliveryRecord>(
    `SELECT * FROM invoice_delivery_log
     WHERE invoice_id = $1
     ORDER BY created_at DESC`,
    [invoiceId]
  );
}

/**
 * Get all pending deliveries (for batch processing).
 */
export async function getPendingDeliveries(
  limit: number = 50
): Promise<DeliveryRecord[]> {
  return query<DeliveryRecord>(
    `SELECT idl.*, c.customer_name, oi.invoice_number, oi.invoice_total
     FROM invoice_delivery_log idl
     JOIN customers c ON c.id = idl.customer_id
     JOIN outbound_invoices oi ON oi.id = idl.invoice_id
     WHERE idl.status = 'pending'
     ORDER BY idl.created_at
     LIMIT $1`,
    [limit]
  );
}

/**
 * Send all pending deliveries for a billing run.
 * Returns count of sent and failed deliveries.
 */
export async function processPendingDeliveries(): Promise<{
  sent: number;
  failed: number;
  errors: string[];
}> {
  const pending = await getPendingDeliveries(100);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const delivery of pending) {
    try {
      // In production, this would call an email service (SendGrid, SES, etc.)
      // For now, we simulate successful delivery
      await markDeliverySent(delivery.id);

      // Update invoice status to 'sent'
      await query(
        `UPDATE outbound_invoices SET status = 'sent', sent_to_customer_at = NOW(), sent_via = $2, updated_at = NOW()
         WHERE id = $1 AND status IN ('approved', 'sent')`,
        [delivery.invoice_id, delivery.delivery_method]
      );

      sent++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await markDeliveryFailed(delivery.id, msg);
      errors.push(`Invoice ${delivery.invoice_id}: ${msg}`);
      failed++;
    }
  }

  return { sent, failed, errors };
}

/**
 * Get delivery stats for a billing period.
 */
export async function getDeliveryStats(
  fiscalYear: number,
  fiscalMonth: number
): Promise<{
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
}> {
  const row = await queryOne<{
    total: string;
    pending: string;
    sent: string;
    delivered: string;
    failed: string;
    bounced: string;
  }>(
    `SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN idl.status = 'pending' THEN 1 END) AS pending,
      COUNT(CASE WHEN idl.status = 'sent' THEN 1 END) AS sent,
      COUNT(CASE WHEN idl.status = 'delivered' THEN 1 END) AS delivered,
      COUNT(CASE WHEN idl.status = 'failed' THEN 1 END) AS failed,
      COUNT(CASE WHEN idl.status = 'bounced' THEN 1 END) AS bounced
     FROM invoice_delivery_log idl
     JOIN outbound_invoices oi ON oi.id = idl.invoice_id
     WHERE oi.fiscal_year = $1 AND oi.fiscal_month = $2`,
    [fiscalYear, fiscalMonth]
  );

  return {
    total: Number(row?.total || 0),
    pending: Number(row?.pending || 0),
    sent: Number(row?.sent || 0),
    delivered: Number(row?.delivered || 0),
    failed: Number(row?.failed || 0),
    bounced: Number(row?.bounced || 0),
  };
}
