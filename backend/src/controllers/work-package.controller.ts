/**
 * Work Package Controller
 * API endpoint handlers for work package management
 */

import { Request, Response } from 'express';
import logger from '../config/logger';
import * as wpService from '../services/work-package.service';

// ============================================================================
// CRUD
// ============================================================================

export async function createWorkPackage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { project_id, shopping_event_id, allocation_id, car_number, shop_code, special_instructions } = req.body;

    if (!car_number || !shop_code) {
      res.status(400).json({ success: false, error: 'car_number and shop_code are required' });
      return;
    }

    const wp = await wpService.createWorkPackage(
      { project_id, shopping_event_id, allocation_id, car_number, shop_code, special_instructions },
      userId
    );
    res.status(201).json({ success: true, data: wp });
  } catch (error) {
    logger.error({ err: error }, 'Error creating work package');
    res.status(500).json({ success: false, error: 'Failed to create work package' });
  }
}

export async function getWorkPackage(req: Request, res: Response): Promise<void> {
  try {
    const wp = await wpService.getWorkPackage(req.params.id);
    if (!wp) {
      res.status(404).json({ success: false, error: 'Work package not found' });
      return;
    }
    res.json({ success: true, data: wp });
  } catch (error) {
    logger.error({ err: error }, 'Error getting work package');
    res.status(500).json({ success: false, error: 'Failed to get work package' });
  }
}

export async function listWorkPackages(req: Request, res: Response): Promise<void> {
  try {
    const { status, project_id, shop_code, car_number, lessee_code, search, limit, offset } = req.query;
    const result = await wpService.listWorkPackages({
      status: status as string,
      project_id: project_id as string,
      shop_code: shop_code as string,
      car_number: car_number as string,
      lessee_code: lessee_code as string,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    res.json({ success: true, data: result.packages, meta: { total: result.total } });
  } catch (error) {
    logger.error({ err: error }, 'Error listing work packages');
    res.status(500).json({ success: false, error: 'Failed to list work packages' });
  }
}

export async function listForShop(req: Request, res: Response): Promise<void> {
  try {
    const shopCode = (req as any).shopCodeFilter || req.user?.shop_code;
    if (!shopCode) {
      res.status(403).json({ success: false, error: 'No shop code associated with this user' });
      return;
    }
    const packages = await wpService.listForShop(shopCode);
    res.json({ success: true, data: packages });
  } catch (error) {
    logger.error({ err: error }, 'Error listing shop work packages');
    res.status(500).json({ success: false, error: 'Failed to list work packages' });
  }
}

export async function updateWorkPackage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const wp = await wpService.updateWorkPackage(req.params.id, req.body, userId);
    if (!wp) {
      res.status(404).json({ success: false, error: 'Work package not found or not in draft status' });
      return;
    }
    res.json({ success: true, data: wp });
  } catch (error) {
    logger.error({ err: error }, 'Error updating work package');
    res.status(500).json({ success: false, error: 'Failed to update work package' });
  }
}

// ============================================================================
// LIFECYCLE
// ============================================================================

export async function assembleWorkPackage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const wp = await wpService.assembleWorkPackage(req.params.id, req.body, userId);
    if (!wp) {
      res.status(404).json({ success: false, error: 'Work package not found or not in draft status' });
      return;
    }
    res.json({ success: true, data: wp });
  } catch (error) {
    logger.error({ err: error }, 'Error assembling work package');
    res.status(500).json({ success: false, error: 'Failed to assemble work package' });
  }
}

export async function issueWorkPackage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const wp = await wpService.issueWorkPackage(req.params.id, userId);
    if (!wp) {
      res.status(404).json({ success: false, error: 'Work package not found or not in draft/assembled status' });
      return;
    }
    res.json({ success: true, data: wp });
  } catch (error) {
    logger.error({ err: error }, 'Error issuing work package');
    res.status(500).json({ success: false, error: 'Failed to issue work package' });
  }
}

export async function reissueWorkPackage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, error: 'Reissue reason is required' });
      return;
    }
    const wp = await wpService.reissueWorkPackage(req.params.id, reason, userId);
    if (!wp) {
      res.status(404).json({ success: false, error: 'Work package not found or not in issued status' });
      return;
    }
    res.json({ success: true, data: wp });
  } catch (error) {
    logger.error({ err: error }, 'Error reissuing work package');
    res.status(500).json({ success: false, error: 'Failed to reissue work package' });
  }
}

// ============================================================================
// DOCUMENTS
// ============================================================================

export async function addDocument(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { document_type, document_name, file_path, file_size_bytes, mime_type } = req.body;
    if (!document_type || !document_name) {
      res.status(400).json({ success: false, error: 'document_type and document_name are required' });
      return;
    }
    const doc = await wpService.addDocument(
      req.params.id,
      { document_type, document_name, file_path, file_size_bytes, mime_type },
      userId
    );
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    logger.error({ err: error }, 'Error adding document');
    res.status(500).json({ success: false, error: 'Failed to add document' });
  }
}

export async function linkMFilesDocument(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { document_type, document_name, mfiles_id, mfiles_url } = req.body;
    if (!document_type || !document_name || !mfiles_id) {
      res.status(400).json({ success: false, error: 'document_type, document_name, and mfiles_id are required' });
      return;
    }
    const doc = await wpService.linkMFilesDocument(
      req.params.id,
      { document_type, document_name, mfiles_id, mfiles_url },
      userId
    );
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    logger.error({ err: error }, 'Error linking M-Files document');
    res.status(500).json({ success: false, error: 'Failed to link document' });
  }
}

export async function removeDocument(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const removed = await wpService.removeDocument(req.params.id, req.params.docId, userId);
    if (!removed) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }
    res.json({ success: true, data: { removed: true } });
  } catch (error) {
    logger.error({ err: error }, 'Error removing document');
    res.status(500).json({ success: false, error: 'Failed to remove document' });
  }
}

// ============================================================================
// CCM OVERRIDES
// ============================================================================

export async function addCCMOverride(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { field_name, override_value, override_reason, original_value } = req.body;
    if (!field_name || !override_value) {
      res.status(400).json({ success: false, error: 'field_name and override_value are required' });
      return;
    }
    const override = await wpService.addCCMOverride(
      req.params.id,
      { field_name, override_value, override_reason, original_value },
      userId
    );
    res.status(201).json({ success: true, data: override });
  } catch (error) {
    logger.error({ err: error }, 'Error adding CCM override');
    res.status(500).json({ success: false, error: 'Failed to add CCM override' });
  }
}

export async function removeCCMOverride(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const removed = await wpService.removeCCMOverride(req.params.id, req.params.field, userId);
    if (!removed) {
      res.status(404).json({ success: false, error: 'Override not found' });
      return;
    }
    res.json({ success: true, data: { removed: true } });
  } catch (error) {
    logger.error({ err: error }, 'Error removing CCM override');
    res.status(500).json({ success: false, error: 'Failed to remove CCM override' });
  }
}

// ============================================================================
// AUDIT & HISTORY
// ============================================================================

export async function getAuditHistory(req: Request, res: Response): Promise<void> {
  try {
    const events = await wpService.getAuditHistory(req.params.id);
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ err: error }, 'Error getting audit history');
    res.status(500).json({ success: false, error: 'Failed to get audit history' });
  }
}

// ============================================================================
// SUMMARY
// ============================================================================

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const summary = await wpService.getWorkPackageSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error({ err: error }, 'Error getting work package summary');
    res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
}
