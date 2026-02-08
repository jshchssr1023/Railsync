import { Request, Response } from 'express';
import * as sapService from '../services/sap-integration.service';
import * as sfService from '../services/salesforce-sync.service';

// ============================================================================
// CONNECTION STATUS
// ============================================================================

export async function getConnectionStatuses(req: Request, res: Response): Promise<void> {
  try {
    const statuses = await sapService.getConnectionStatuses();
    res.json({ success: true, data: statuses });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get connection statuses' });
  }
}

// ============================================================================
// SAP PUSH ENDPOINTS
// ============================================================================

export async function pushApprovedCosts(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { allocationId } = req.body;
    if (!allocationId) { res.status(400).json({ error: 'allocationId is required' }); return; }
    const result = await sapService.pushApprovedCosts(allocationId, userId);
    res.json({ success: result.success, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to push approved costs' });
  }
}

export async function pushBillingTrigger(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { invoiceId } = req.body;
    if (!invoiceId) { res.status(400).json({ error: 'invoiceId is required' }); return; }
    const result = await sapService.pushBillingTrigger(invoiceId, userId);
    res.json({ success: result.success, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to push billing trigger' });
  }
}

export async function pushMileage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { mileageRecordId } = req.body;
    if (!mileageRecordId) { res.status(400).json({ error: 'mileageRecordId is required' }); return; }
    const result = await sapService.pushMileage(mileageRecordId, userId);
    res.json({ success: result.success, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to push mileage' });
  }
}

export async function pushInvoiceToSAP(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { invoiceId } = req.body;
    if (!invoiceId) { res.status(400).json({ error: 'invoiceId is required' }); return; }
    const result = await sapService.pushInvoiceToSAP(invoiceId, userId);
    res.json({ success: result.success, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to push invoice to SAP' });
  }
}

export async function batchPushToSAP(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.body.limit || 100;
    const result = await sapService.batchPushToSAP(limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to batch push' });
  }
}

export async function checkSAPConnection(req: Request, res: Response): Promise<void> {
  try {
    const result = await sapService.checkSAPConnection();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check SAP connection' });
  }
}

// ============================================================================
// SALESFORCE SYNC ENDPOINTS
// ============================================================================

export async function sfPullCustomers(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const result = await sfService.pullCustomers(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to pull customers' });
  }
}

export async function sfPullContacts(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const result = await sfService.pullContacts(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to pull contacts' });
  }
}

export async function sfFullSync(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const result = await sfService.runFullSync(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to run full sync' });
  }
}

export async function checkSFConnection(req: Request, res: Response): Promise<void> {
  try {
    const result = await sfService.checkSalesforceConnection();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check Salesforce connection' });
  }
}

// ============================================================================
// SYNC LOG ENDPOINTS
// ============================================================================

export async function getSyncLog(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      system: req.query.system as string | undefined,
      status: req.query.status as string | undefined,
      entity_type: req.query.entity_type as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await sapService.getSyncLog(filters);
    res.json({ success: true, data: result.entries, total: result.total });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get sync log' });
  }
}

export async function getSyncStats(req: Request, res: Response): Promise<void> {
  try {
    const result = await sapService.getSyncStats();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get sync stats' });
  }
}

export async function retrySyncEntry(req: Request, res: Response): Promise<void> {
  try {
    const result = await sapService.retrySyncEntry(req.params.id);
    res.json({ success: result.success, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retry sync entry' });
  }
}

// ============================================================================
// SAP PAYLOAD VALIDATION & FIELD MAPPINGS
// ============================================================================

export async function validateSAPPayload(req: Request, res: Response): Promise<void> {
  try {
    const { documentType, sourceData } = req.body;
    if (!documentType || !sourceData) {
      res.status(400).json({ error: 'documentType and sourceData are required' });
      return;
    }
    const result = await sapService.validateSAPPayload(documentType, sourceData);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to validate SAP payload' });
  }
}

export async function getSAPFieldMappings(req: Request, res: Response): Promise<void> {
  try {
    const documentType = req.query.document_type as string;
    if (!documentType) {
      res.status(400).json({ error: 'document_type query parameter is required' });
      return;
    }
    const mappings = await sapService.getFieldMappingsByType(documentType);
    res.json({ success: true, data: mappings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get SAP field mappings' });
  }
}

// ============================================================================
// SALESFORCE SYNC MAP & PUSH
// ============================================================================

export async function sfPullDealStages(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const result = await sfService.pullDealStages(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to pull deal stages' });
  }
}

export async function sfPushBillingStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { customerId, billingData } = req.body;
    if (!customerId || !billingData) {
      res.status(400).json({ error: 'customerId and billingData are required' });
      return;
    }
    const result = await sfService.pushCustomerBillingStatus(customerId, billingData, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to push billing status' });
  }
}

export async function getSFSyncMap(req: Request, res: Response): Promise<void> {
  try {
    const entityType = req.query.entity_type as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const result = await sfService.getSyncMapEntries(entityType, limit);
    res.json({ success: true, data: result.entries, total: result.total });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get sync map' });
  }
}
