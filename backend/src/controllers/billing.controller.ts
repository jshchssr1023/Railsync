/**
 * Billing Controller
 * API endpoints for billing runs, outbound invoices, rate management,
 * mileage tracking, chargebacks, adjustments, and billing summaries.
 */

import { Request, Response } from 'express';
import * as billingService from '../services/billing.service';

// ============================================================================
// BILLING RUNS
// ============================================================================

// POST /api/billing/runs/preflight
export async function runPreflight(req: Request, res: Response): Promise<void> {
  try {
    const { fiscalYear, fiscalMonth } = req.body;
    if (!fiscalYear || !fiscalMonth) {
      res.status(400).json({ success: false, error: 'fiscalYear and fiscalMonth are required' });
      return;
    }
    const result = await billingService.runPreflight(Number(fiscalYear), Number(fiscalMonth));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error running billing preflight:', error);
    res.status(500).json({ success: false, error: 'Failed to run billing preflight' });
  }
}

// POST /api/billing/runs
export async function createBillingRun(req: Request, res: Response): Promise<void> {
  try {
    const { fiscalYear, fiscalMonth, runType } = req.body;
    const userId = (req as any).user?.userId;
    if (!fiscalYear || !fiscalMonth || !runType) {
      res.status(400).json({ success: false, error: 'fiscalYear, fiscalMonth, and runType are required' });
      return;
    }
    const result = await billingService.createBillingRun(
      Number(fiscalYear), Number(fiscalMonth), runType, userId
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating billing run:', error);
    res.status(500).json({ success: false, error: 'Failed to create billing run' });
  }
}

// GET /api/billing/runs
export async function listBillingRuns(req: Request, res: Response): Promise<void> {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const result = await billingService.listBillingRuns(limit, offset);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error listing billing runs:', error);
    res.status(500).json({ success: false, error: 'Failed to list billing runs' });
  }
}

// GET /api/billing/runs/:id
export async function getBillingRun(req: Request, res: Response): Promise<void> {
  try {
    const result = await billingService.getBillingRun(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: 'Billing run not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting billing run:', error);
    res.status(500).json({ success: false, error: 'Failed to get billing run' });
  }
}

// ============================================================================
// OUTBOUND INVOICES
// ============================================================================

// POST /api/billing/invoices/generate
export async function generateInvoices(req: Request, res: Response): Promise<void> {
  try {
    const { fiscalYear, fiscalMonth } = req.body;
    const userId = (req as any).user?.userId;
    if (!fiscalYear || !fiscalMonth) {
      res.status(400).json({ success: false, error: 'fiscalYear and fiscalMonth are required' });
      return;
    }
    const result = await billingService.generateMonthlyInvoices(
      Number(fiscalYear), Number(fiscalMonth), userId
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error generating invoices:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invoices' });
  }
}

// GET /api/billing/invoices
export async function listInvoices(req: Request, res: Response): Promise<void> {
  try {
    const result = await billingService.listOutboundInvoices({
      status: req.query.status as any,
      customer_id: req.query.customerId as string,
      fiscal_year: req.query.fiscalYear ? Number(req.query.fiscalYear) : undefined,
      fiscal_month: req.query.fiscalMonth ? Number(req.query.fiscalMonth) : undefined,
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error listing invoices:', error);
    res.status(500).json({ success: false, error: 'Failed to list invoices' });
  }
}

// GET /api/billing/invoices/:id
export async function getInvoice(req: Request, res: Response): Promise<void> {
  try {
    const result = await billingService.getOutboundInvoice(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to get invoice' });
  }
}

// PUT /api/billing/invoices/:id/approve
export async function approveInvoice(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const result = await billingService.approveOutboundInvoice(req.params.id, userId);
    if (!result) {
      res.status(404).json({ success: false, error: 'Invoice not found or not in approvable state' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error approving invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to approve invoice' });
  }
}

// PUT /api/billing/invoices/:id/void
export async function voidInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, error: 'Reason is required to void an invoice' });
      return;
    }
    const result = await billingService.voidOutboundInvoice(req.params.id, reason);
    if (!result) {
      res.status(404).json({ success: false, error: 'Invoice not found or not in voidable state' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error voiding invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to void invoice' });
  }
}

// ============================================================================
// RATE MANAGEMENT
// ============================================================================

// GET /api/billing/rates/:riderId/history
export async function getRateHistory(req: Request, res: Response): Promise<void> {
  try {
    const result = await billingService.getRateHistory(req.params.riderId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting rate history:', error);
    res.status(500).json({ success: false, error: 'Failed to get rate history' });
  }
}

// PUT /api/billing/rates/:riderId
export async function updateRate(req: Request, res: Response): Promise<void> {
  try {
    const { newRate, effectiveDate, changeType, reason } = req.body;
    const userId = (req as any).user?.userId;
    if (!newRate || !effectiveDate || !changeType) {
      res.status(400).json({ success: false, error: 'newRate, effectiveDate, and changeType are required' });
      return;
    }
    const result = await billingService.updateRate(
      req.params.riderId, Number(newRate), effectiveDate, changeType, reason || '', userId
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating rate:', error);
    res.status(500).json({ success: false, error: 'Failed to update rate' });
  }
}

// ============================================================================
// MILEAGE
// ============================================================================

// POST /api/billing/mileage/files
export async function registerMileageFile(req: Request, res: Response): Promise<void> {
  try {
    const { filename, fileType, reportingPeriod } = req.body;
    const userId = (req as any).user?.userId;
    if (!filename || !reportingPeriod) {
      res.status(400).json({ success: false, error: 'filename and reportingPeriod are required' });
      return;
    }
    const result = await billingService.createMileageFile(
      filename, fileType || 'manual', reportingPeriod, userId
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error registering mileage file:', error);
    res.status(500).json({ success: false, error: 'Failed to register mileage file' });
  }
}

// POST /api/billing/mileage/files/:fileId/import
export async function importMileageRecords(req: Request, res: Response): Promise<void> {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      res.status(400).json({ success: false, error: 'records array is required' });
      return;
    }
    const result = await billingService.importMileageRecords(req.params.fileId, records);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error importing mileage records:', error);
    res.status(500).json({ success: false, error: 'Failed to import mileage records' });
  }
}

// GET /api/billing/mileage/summary
export async function getMileageSummary(req: Request, res: Response): Promise<void> {
  try {
    const customerId = req.query.customerId as string;
    const period = req.query.period as string;
    if (!customerId || !period) {
      res.status(400).json({ success: false, error: 'customerId and period are required' });
      return;
    }
    const result = await billingService.getMileageSummary(customerId, period);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting mileage summary:', error);
    res.status(500).json({ success: false, error: 'Failed to get mileage summary' });
  }
}

// PUT /api/billing/mileage/records/:id/verify
export async function verifyMileageRecord(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const result = await billingService.verifyMileageRecord(req.params.id, userId);
    if (!result) {
      res.status(404).json({ success: false, error: 'Mileage record not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error verifying mileage record:', error);
    res.status(500).json({ success: false, error: 'Failed to verify mileage record' });
  }
}

// ============================================================================
// CHARGEBACKS
// ============================================================================

// POST /api/billing/chargebacks
export async function createChargeback(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const result = await billingService.createChargeback({
      ...req.body,
      customer_id: req.body.customerId || req.body.customer_id,
      car_number: req.body.carNumber || req.body.car_number,
      chargeback_type: req.body.chargebackType || req.body.chargeback_type,
      rider_id: req.body.riderId || req.body.rider_id,
      submitted_by: userId,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating chargeback:', error);
    res.status(500).json({ success: false, error: 'Failed to create chargeback' });
  }
}

// GET /api/billing/chargebacks
export async function listChargebacks(req: Request, res: Response): Promise<void> {
  try {
    const result = await billingService.listChargebacks({
      status: req.query.status as any,
      customer_id: req.query.customerId as string,
      car_number: req.query.carNumber as string,
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error listing chargebacks:', error);
    res.status(500).json({ success: false, error: 'Failed to list chargebacks' });
  }
}

// PUT /api/billing/chargebacks/:id/review
export async function reviewChargeback(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const { approved, notes } = req.body;
    if (typeof approved !== 'boolean') {
      res.status(400).json({ success: false, error: 'approved (boolean) is required' });
      return;
    }
    const result = await billingService.reviewChargeback(req.params.id, userId, approved, notes);
    if (!result) {
      res.status(404).json({ success: false, error: 'Chargeback not found or not in reviewable state' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error reviewing chargeback:', error);
    res.status(500).json({ success: false, error: 'Failed to review chargeback' });
  }
}

// POST /api/billing/chargebacks/generate-invoice
export async function generateChargebackInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { customerId, fiscalYear, fiscalMonth } = req.body;
    const userId = (req as any).user?.userId;
    if (!customerId || !fiscalYear || !fiscalMonth) {
      res.status(400).json({ success: false, error: 'customerId, fiscalYear, and fiscalMonth are required' });
      return;
    }
    const result = await billingService.generateChargebackInvoice(
      customerId, Number(fiscalYear), Number(fiscalMonth), userId
    );
    if (!result) {
      res.json({ success: true, data: null, message: 'No approved chargebacks to invoice' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error generating chargeback invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to generate chargeback invoice' });
  }
}

// ============================================================================
// ADJUSTMENTS
// ============================================================================

// POST /api/billing/adjustments
export async function createAdjustment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const result = await billingService.createAdjustment({
      ...req.body,
      customer_id: req.body.customerId || req.body.customer_id,
      adjustment_type: req.body.adjustmentType || req.body.adjustment_type,
      rider_id: req.body.riderId || req.body.rider_id,
      car_number: req.body.carNumber || req.body.car_number,
      source_event: req.body.sourceEvent || req.body.source_event,
      source_event_id: req.body.sourceEventId || req.body.source_event_id,
      requested_by: userId,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating adjustment:', error);
    res.status(500).json({ success: false, error: 'Failed to create adjustment' });
  }
}

// GET /api/billing/adjustments/pending
export async function listPendingAdjustments(req: Request, res: Response): Promise<void> {
  try {
    const customerId = req.query.customerId as string | undefined;
    const result = await billingService.listPendingAdjustments(customerId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error listing pending adjustments:', error);
    res.status(500).json({ success: false, error: 'Failed to list pending adjustments' });
  }
}

// PUT /api/billing/adjustments/:id/approve
export async function approveAdjustment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const result = await billingService.approveAdjustment(req.params.id, userId);
    if (!result) {
      res.status(404).json({ success: false, error: 'Adjustment not found or not pending' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error approving adjustment:', error);
    res.status(500).json({ success: false, error: 'Failed to approve adjustment' });
  }
}

// PUT /api/billing/adjustments/:id/reject
export async function rejectAdjustment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, error: 'Reason is required' });
      return;
    }
    const result = await billingService.rejectAdjustment(req.params.id, userId, reason);
    if (!result) {
      res.status(404).json({ success: false, error: 'Adjustment not found or not pending' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error rejecting adjustment:', error);
    res.status(500).json({ success: false, error: 'Failed to reject adjustment' });
  }
}

// ============================================================================
// BILLING SUMMARY
// ============================================================================

// GET /api/billing/summary
export async function getBillingSummary(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = Number(req.query.fiscalYear);
    const fiscalMonth = Number(req.query.fiscalMonth);
    if (!fiscalYear || !fiscalMonth) {
      res.status(400).json({ success: false, error: 'fiscalYear and fiscalMonth are required' });
      return;
    }
    const result = await billingService.getBillingSummary(fiscalYear, fiscalMonth);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting billing summary:', error);
    res.status(500).json({ success: false, error: 'Failed to get billing summary' });
  }
}

// GET /api/billing/customers/:customerId/history
export async function getCustomerInvoiceHistory(req: Request, res: Response): Promise<void> {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const result = await billingService.getCustomerInvoiceHistory(req.params.customerId, limit, offset);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting customer invoice history:', error);
    res.status(500).json({ success: false, error: 'Failed to get customer invoice history' });
  }
}
