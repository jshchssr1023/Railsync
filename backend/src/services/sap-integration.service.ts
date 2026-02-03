/**
 * SAP Integration Service (Placeholder)
 * Handles pushing approved invoices to SAP for payment
 *
 * This is a placeholder implementation. Real SAP integration will require:
 * - SAP connection configuration (RFC/BAPI or REST API)
 * - Invoice document format mapping
 * - Error handling and retry logic
 * - Audit trail and status tracking
 */

import { query } from '../config/database';
import * as invoiceService from './invoice.service';

// ============================================================================
// TYPES
// ============================================================================

export interface SAPPushRequest {
  invoice_id: string;
  invoice_number: string;
  vendor_code: string;
  invoice_date: Date;
  invoice_total: number;
  line_items: {
    car_number: string;
    job_code?: string;
    why_made_code?: string;
    amount: number;
    description?: string;
  }[];
}

export interface SAPPushResponse {
  success: boolean;
  sap_document_id?: string;
  error?: string;
  response_data?: Record<string, unknown>;
}

// ============================================================================
// PLACEHOLDER IMPLEMENTATION
// ============================================================================

/**
 * Push invoice to SAP (placeholder)
 *
 * TODO: Implement actual SAP integration when ready
 * - Connect to SAP system
 * - Format invoice for SAP
 * - Handle response and errors
 */
export async function pushInvoiceToSAP(invoiceId: string): Promise<SAPPushResponse> {
  // Get invoice details
  const invoice = await invoiceService.getInvoice(invoiceId);
  if (!invoice) {
    return {
      success: false,
      error: 'Invoice not found',
    };
  }

  // Verify invoice is approved
  if (invoice.status !== 'approved' && invoice.status !== 'auto_approved') {
    return {
      success: false,
      error: 'Invoice must be approved before pushing to SAP',
    };
  }

  // Get line items
  const lineItems = await invoiceService.getInvoiceLineItems(invoiceId);

  // Build SAP request payload (for logging/debugging)
  const sapPayload: SAPPushRequest = {
    invoice_id: invoiceId,
    invoice_number: invoice.invoice_number,
    vendor_code: invoice.vendor_code || '',
    invoice_date: invoice.invoice_date,
    invoice_total: invoice.invoice_total,
    line_items: lineItems.map(li => ({
      car_number: li.car_number || '',
      job_code: li.job_code,
      why_made_code: li.why_made_code,
      amount: li.total_amount,
      description: li.description,
    })),
  };

  // =========================================================================
  // PLACEHOLDER: Simulate SAP push
  // Replace this section with actual SAP integration code
  // =========================================================================

  console.log('[SAP PLACEHOLDER] Would push invoice to SAP:', {
    invoice_number: sapPayload.invoice_number,
    vendor_code: sapPayload.vendor_code,
    total: sapPayload.invoice_total,
    line_count: sapPayload.line_items.length,
  });

  // Simulate SAP response
  const mockDocumentId = `SAP${Date.now()}`;
  const mockResponse = {
    status: 'CREATED',
    document_id: mockDocumentId,
    timestamp: new Date().toISOString(),
    message: 'Invoice document created successfully (placeholder)',
  };

  // =========================================================================
  // END PLACEHOLDER
  // =========================================================================

  // Update invoice with SAP response
  await invoiceService.markInvoiceSentToSap(invoiceId, mockDocumentId, mockResponse);

  return {
    success: true,
    sap_document_id: mockDocumentId,
    response_data: mockResponse,
  };
}

/**
 * Check SAP connection status (placeholder)
 */
export async function checkSAPConnection(): Promise<{
  connected: boolean;
  status: string;
  last_check: Date;
}> {
  // Placeholder - always returns connected
  return {
    connected: true,
    status: 'placeholder_mode',
    last_check: new Date(),
  };
}

/**
 * Get SAP push history for an invoice
 */
export async function getSAPPushHistory(invoiceId: string): Promise<{
  invoice_id: string;
  sap_document_id: string | null;
  sent_at: Date | null;
  response: Record<string, unknown> | null;
}[]> {
  const result = await query<{
    id: string;
    sap_document_id: string | null;
    sent_to_sap_at: Date | null;
    sap_response: Record<string, unknown> | null;
  }>(
    `SELECT id, sap_document_id, sent_to_sap_at, sap_response
     FROM invoices WHERE id = $1`,
    [invoiceId]
  );

  return result.map(r => ({
    invoice_id: r.id,
    sap_document_id: r.sap_document_id,
    sent_at: r.sent_to_sap_at,
    response: r.sap_response,
  }));
}

/**
 * Batch push approved invoices to SAP
 * This could be called by a scheduled job
 */
export async function batchPushToSAP(limit: number = 100): Promise<{
  processed: number;
  successful: number;
  failed: number;
  errors: { invoice_id: string; error: string }[];
}> {
  // Get approved invoices not yet sent to SAP
  const pendingInvoices = await query<{ id: string }>(
    `SELECT id FROM invoices
     WHERE status IN ('approved', 'auto_approved')
       AND sap_document_id IS NULL
     ORDER BY approved_at ASC
     LIMIT $1`,
    [limit]
  );

  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [] as { invoice_id: string; error: string }[],
  };

  for (const invoice of pendingInvoices) {
    results.processed++;
    const pushResult = await pushInvoiceToSAP(invoice.id);

    if (pushResult.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push({
        invoice_id: invoice.id,
        error: pushResult.error || 'Unknown error',
      });
    }
  }

  return results;
}

export default {
  pushInvoiceToSAP,
  checkSAPConnection,
  getSAPPushHistory,
  batchPushToSAP,
};
