/**
 * Invoice Controller
 * API endpoints for invoice management
 */

import { Request, Response } from 'express';
import * as invoiceService from '../services/invoice.service';
import * as invoiceParser from '../services/invoice-parser.service';
import * as invoiceMatching from '../services/invoice-matching.service';

// ============================================================================
// INVOICE ENDPOINTS
// ============================================================================

export async function createInvoice(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const invoice = await invoiceService.createInvoice({
      ...req.body,
      created_by: userId,
    });
    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
}

/**
 * Upload and parse invoice file (PDF or EDI 500-byte)
 */
export async function uploadInvoice(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const file = (req as any).file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Parse the uploaded file
    const parsed = await invoiceParser.parseInvoiceBuffer(file.buffer, file.originalname);

    // Create the invoice
    const invoice = await invoiceService.createInvoice({
      ...parsed.invoice,
      created_by: userId,
    });

    // Create line items
    if (parsed.line_items.length > 0) {
      const lineItemsWithInvoiceId = parsed.line_items.map(li => ({
        ...li,
        invoice_id: invoice.id,
      }));
      await invoiceService.createLineItemsBatch(lineItemsWithInvoiceId);
    }

    // Run matching against BRC data
    const matchSummary = await invoiceMatching.processInvoice(invoice.id);

    // Get the updated invoice with stats
    const updatedInvoice = await invoiceService.getInvoice(invoice.id);

    res.status(201).json({
      invoice: updatedInvoice,
      match_summary: matchSummary,
      parse_warnings: parsed.parse_warnings,
    });
  } catch (error) {
    console.error('Error uploading invoice:', error);
    res.status(500).json({ error: 'Failed to upload and process invoice' });
  }
}

/**
 * Re-run matching for an invoice (after manual corrections)
 */
export async function rematchInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const matchSummary = await invoiceMatching.rematchInvoice(id);
    const invoice = await invoiceService.getInvoice(id);

    res.json({
      invoice,
      match_summary: matchSummary,
    });
  } catch (error) {
    console.error('Error rematching invoice:', error);
    res.status(500).json({ error: 'Failed to rematch invoice' });
  }
}

export async function getInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const invoice = await invoiceService.getInvoice(id);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
}

export async function listInvoices(req: Request, res: Response): Promise<void> {
  try {
    const { status, shop_code, start_date, end_date, search, limit, offset } = req.query;

    const filters: Parameters<typeof invoiceService.listInvoices>[0] = {};

    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        filters.status = status.split(',') as invoiceService.InvoiceStatus[];
      } else {
        filters.status = status as invoiceService.InvoiceStatus;
      }
    }
    if (shop_code) filters.shop_code = shop_code as string;
    if (start_date) filters.start_date = start_date as string;
    if (end_date) filters.end_date = end_date as string;
    if (search) filters.search = search as string;
    if (limit) filters.limit = parseInt(limit as string, 10);
    if (offset) filters.offset = parseInt(offset as string, 10);

    const result = await invoiceService.listInvoices(filters);
    res.json(result);
  } catch (error) {
    console.error('Error listing invoices:', error);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
}

export async function updateInvoiceStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = (req as any).user?.id;

    const invoice = await invoiceService.updateInvoiceStatus(id, status, userId, notes);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    res.json(invoice);
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
}

// ============================================================================
// LINE ITEM ENDPOINTS
// ============================================================================

export async function getInvoiceLineItems(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lineItems = await invoiceService.getInvoiceLineItems(id);
    res.json(lineItems);
  } catch (error) {
    console.error('Error fetching line items:', error);
    res.status(500).json({ error: 'Failed to fetch line items' });
  }
}

export async function updateLineItemMatch(req: Request, res: Response): Promise<void> {
  try {
    const { id, lineId } = req.params;
    const { match_status, allocation_id, confidence, notes } = req.body;

    const lineItem = await invoiceService.updateLineItemMatch(
      lineId,
      match_status,
      allocation_id,
      confidence,
      notes
    );
    if (!lineItem) {
      res.status(404).json({ error: 'Line item not found' });
      return;
    }
    res.json(lineItem);
  } catch (error) {
    console.error('Error updating line item match:', error);
    res.status(500).json({ error: 'Failed to update line item match' });
  }
}

export async function verifyLineItem(req: Request, res: Response): Promise<void> {
  try {
    const { id, lineId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const lineItem = await invoiceService.verifyLineItem(lineId, userId);
    if (!lineItem) {
      res.status(404).json({ error: 'Line item not found' });
      return;
    }
    res.json(lineItem);
  } catch (error) {
    console.error('Error verifying line item:', error);
    res.status(500).json({ error: 'Failed to verify line item' });
  }
}

// ============================================================================
// BRC COMPARISON
// ============================================================================

export async function getInvoiceComparison(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const comparison = await invoiceService.getInvoiceComparison(id);
    if (!comparison) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    res.json(comparison);
  } catch (error) {
    console.error('Error fetching invoice comparison:', error);
    res.status(500).json({ error: 'Failed to fetch invoice comparison' });
  }
}

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

export async function approveInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = (req as any).user?.id;

    // Update status to approved
    const invoice = await invoiceService.updateInvoiceStatus(id, 'approved', userId, notes);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Trigger SAP push if integration is configured
    let sapResult: { pushed: boolean; document_number?: string } = { pushed: false };
    try {
      const { pushInvoiceToSAP } = await import('../services/sap-integration.service');
      const pushResponse = await pushInvoiceToSAP(id, userId);
      if (pushResponse.success) {
        sapResult = { pushed: true, document_number: pushResponse.sap_document_id };
        console.log(`Invoice ${id} approved by ${userId} and pushed to SAP (doc ${pushResponse.sap_document_id}).`);
      }
    } catch (sapErr) {
      // SAP push is non-blocking; log and continue
      console.warn(`Invoice ${id} approved but SAP push failed:`, sapErr);
    }

    res.json({ ...invoice, sap: sapResult, message: sapResult.pushed ? 'Invoice approved and pushed to SAP.' : 'Invoice approved.' });
  } catch (error) {
    console.error('Error approving invoice:', error);
    res.status(500).json({ error: 'Failed to approve invoice' });
  }
}

export async function rejectInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = (req as any).user?.id;

    if (!notes) {
      res.status(400).json({ error: 'Rejection reason is required' });
      return;
    }

    const invoice = await invoiceService.updateInvoiceStatus(id, 'rejected', userId, notes);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error rejecting invoice:', error);
    res.status(500).json({ error: 'Failed to reject invoice' });
  }
}

// ============================================================================
// APPROVAL QUEUE STATS
// ============================================================================

export async function getApprovalQueueStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await invoiceService.getApprovalQueueStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching approval queue stats:', error);
    res.status(500).json({ error: 'Failed to fetch approval queue stats' });
  }
}

export async function getPendingReviewInvoices(req: Request, res: Response): Promise<void> {
  try {
    const invoices = await invoiceService.getPendingReviewInvoices();
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching pending review invoices:', error);
    res.status(500).json({ error: 'Failed to fetch pending review invoices' });
  }
}

export default {
  createInvoice,
  uploadInvoice,
  rematchInvoice,
  getInvoice,
  listInvoices,
  updateInvoiceStatus,
  getInvoiceLineItems,
  updateLineItemMatch,
  verifyLineItem,
  getInvoiceComparison,
  approveInvoice,
  rejectInvoice,
  getApprovalQueueStats,
  getPendingReviewInvoices,
};
