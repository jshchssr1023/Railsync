import { Request, Response } from 'express';
import {
  createShoppingRequest as createService,
  getShoppingRequest as getService,
  listShoppingRequests as listService,
  updateShoppingRequest as updateService,
  approveShoppingRequest as approveService,
  rejectShoppingRequest as rejectService,
  cancelShoppingRequest as cancelService,
} from '../services/shopping-request.service';
import {
  uploadAttachment as uploadService,
  listAttachments as listAttachmentsService,
  deleteAttachment as deleteAttachmentService,
} from '../services/shopping-request-attachment.service';

// POST /api/shopping-requests
export async function create(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!req.body.car_number) {
      res.status(400).json({ error: 'car_number is required' });
      return;
    }
    const result = await createService(req.body, userId);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error creating shopping request:', error);
    res.status(500).json({ error: error.message || 'Failed to create shopping request' });
  }
}

// GET /api/shopping-requests
export async function list(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      car_number: req.query.car_number as string | undefined,
      customer_email: req.query.customer_email as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await listService(filters);
    res.json({ success: true, data: result.requests, total: result.total });
  } catch (error: any) {
    console.error('Error listing shopping requests:', error);
    res.status(500).json({ error: error.message || 'Failed to list shopping requests' });
  }
}

// GET /api/shopping-requests/:id
export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const result = await getService(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Shopping request not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error getting shopping request:', error);
    res.status(500).json({ error: error.message || 'Failed to get shopping request' });
  }
}

// PUT /api/shopping-requests/:id
export async function update(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const result = await updateService(req.params.id, req.body, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error updating shopping request:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}

// PUT /api/shopping-requests/:id/approve
export async function approve(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const { shop_code, notes } = req.body;
    if (!shop_code) {
      res.status(400).json({ error: 'shop_code is required for approval' });
      return;
    }
    const result = await approveService(req.params.id, userId, shop_code, notes);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error approving shopping request:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}

// PUT /api/shopping-requests/:id/reject
export async function reject(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const { notes } = req.body;
    if (!notes) {
      res.status(400).json({ error: 'notes are required for rejection' });
      return;
    }
    const result = await rejectService(req.params.id, userId, notes);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error rejecting shopping request:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}

// PUT /api/shopping-requests/:id/cancel
export async function cancel(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const result = await cancelService(req.params.id, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error cancelling shopping request:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}

// POST /api/shopping-requests/:id/attachments
export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const file = (req as any).file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    const documentType = req.body.document_type || 'other';
    const result = await uploadService(req.params.id, file, documentType, userId);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({ error: error.message || 'Failed to upload attachment' });
  }
}

// GET /api/shopping-requests/:id/attachments
export async function listAttachments(req: Request, res: Response): Promise<void> {
  try {
    const result = await listAttachmentsService(req.params.id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error listing attachments:', error);
    res.status(500).json({ error: error.message || 'Failed to list attachments' });
  }
}

// DELETE /api/shopping-requests/:id/attachments/:attachmentId
export async function deleteAttachment(req: Request, res: Response): Promise<void> {
  try {
    await deleteAttachmentService(req.params.attachmentId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting attachment:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
}
