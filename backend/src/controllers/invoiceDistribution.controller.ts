/**
 * Invoice Distribution Controller
 * Manages invoice delivery configuration and processing.
 */

import { Request, Response } from 'express';
import * as distributionService from '../services/invoiceDistribution.service';

// GET /api/billing/distribution/configs
export async function listConfigs(req: Request, res: Response): Promise<void> {
  try {
    const result = await distributionService.listDistributionConfigs();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error listing distribution configs:', error);
    res.status(500).json({ success: false, error: 'Failed to list distribution configs' });
  }
}

// GET /api/billing/distribution/configs/:customerId
export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const result = await distributionService.getDistributionConfig(req.params.customerId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting distribution config:', error);
    res.status(500).json({ success: false, error: 'Failed to get distribution config' });
  }
}

// PUT /api/billing/distribution/configs/:customerId
export async function upsertConfig(req: Request, res: Response): Promise<void> {
  try {
    const result = await distributionService.upsertDistributionConfig({
      customer_id: req.params.customerId,
      ...req.body,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating distribution config:', error);
    res.status(500).json({ success: false, error: 'Failed to update distribution config' });
  }
}

// DELETE /api/billing/distribution/configs/:id
export async function deleteConfig(req: Request, res: Response): Promise<void> {
  try {
    const deleted = await distributionService.deleteDistributionConfig(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Config not found' });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting distribution config:', error);
    res.status(500).json({ success: false, error: 'Failed to delete distribution config' });
  }
}

// POST /api/billing/distribution/queue/:invoiceId
export async function queueDelivery(req: Request, res: Response): Promise<void> {
  try {
    const { customerId } = req.body;
    if (!customerId) {
      res.status(400).json({ success: false, error: 'customerId is required' });
      return;
    }
    const result = await distributionService.queueInvoiceDelivery(req.params.invoiceId, customerId);
    if (!result) {
      res.json({ success: true, data: null, message: 'No distribution config found for customer' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error queuing delivery:', error);
    res.status(500).json({ success: false, error: 'Failed to queue delivery' });
  }
}

// POST /api/billing/distribution/process
export async function processDeliveries(req: Request, res: Response): Promise<void> {
  try {
    const result = await distributionService.processPendingDeliveries();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing deliveries:', error);
    res.status(500).json({ success: false, error: 'Failed to process deliveries' });
  }
}

// GET /api/billing/distribution/invoices/:invoiceId/history
export async function getDeliveryHistory(req: Request, res: Response): Promise<void> {
  try {
    const result = await distributionService.getInvoiceDeliveryHistory(req.params.invoiceId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting delivery history:', error);
    res.status(500).json({ success: false, error: 'Failed to get delivery history' });
  }
}

// GET /api/billing/distribution/stats
export async function getDeliveryStats(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = Number(req.query.fiscalYear);
    const fiscalMonth = Number(req.query.fiscalMonth);
    if (!fiscalYear || !fiscalMonth) {
      res.status(400).json({ success: false, error: 'fiscalYear and fiscalMonth are required' });
      return;
    }
    const result = await distributionService.getDeliveryStats(fiscalYear, fiscalMonth);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting delivery stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get delivery stats' });
  }
}

// GET /api/billing/distribution/pending
export async function getPendingDeliveries(req: Request, res: Response): Promise<void> {
  try {
    const limit = Number(req.query.limit) || 50;
    const result = await distributionService.getPendingDeliveries(limit);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting pending deliveries:', error);
    res.status(500).json({ success: false, error: 'Failed to get pending deliveries' });
  }
}
