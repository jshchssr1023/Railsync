import { Request, Response } from 'express';
import * as transferService from '../services/transfer.service';

/**
 * POST /api/transfers/validate
 */
export async function validatePrerequisites(req: Request, res: Response): Promise<void> {
  try {
    const { car_number, from_rider_id, to_rider_id } = req.body;
    if (!car_number || !from_rider_id || !to_rider_id) {
      res.status(400).json({ success: false, error: 'car_number, from_rider_id, and to_rider_id are required' });
      return;
    }
    const result = await transferService.validateTransferPrerequisites(car_number, from_rider_id, to_rider_id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error validating transfer:', error);
    res.status(500).json({ success: false, error: 'Failed to validate transfer prerequisites' });
  }
}

/**
 * POST /api/transfers
 */
export async function initiateTransfer(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const result = await transferService.initiateTransfer(req.body, userId);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error initiating transfer:', error);
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/transfers
 */
export async function listTransfers(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      car_number: req.query.car_number as string,
      from_rider_id: req.query.from_rider_id as string,
      to_rider_id: req.query.to_rider_id as string,
      status: req.query.status as any,
      transition_type: req.query.transition_type as any,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await transferService.listTransfers(filters);
    res.json({ success: true, data: result.transfers, total: result.total });
  } catch (error) {
    console.error('Error listing transfers:', error);
    res.status(500).json({ success: false, error: 'Failed to list transfers' });
  }
}

/**
 * GET /api/transfers/overview
 */
export async function getTransferOverview(req: Request, res: Response): Promise<void> {
  try {
    const result = await transferService.getTransferOverview();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching transfer overview:', error);
    res.status(500).json({ success: false, error: 'Failed to get transfer overview' });
  }
}

/**
 * GET /api/transfers/:id
 */
export async function getTransfer(req: Request, res: Response): Promise<void> {
  try {
    const result = await transferService.getTransfer(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: 'Transfer not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching transfer:', error);
    res.status(500).json({ success: false, error: 'Failed to get transfer' });
  }
}

/**
 * POST /api/transfers/:id/confirm
 */
export async function confirmTransfer(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const result = await transferService.confirmTransfer(req.params.id, userId, req.body.notes);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error confirming transfer:', error);
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/transfers/:id/complete
 */
export async function completeTransfer(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const result = await transferService.completeTransfer(req.params.id, userId, req.body.notes);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error completing transfer:', error);
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/transfers/:id/cancel
 */
export async function cancelTransfer(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, error: 'Cancellation reason is required' });
      return;
    }
    const result = await transferService.cancelTransfer(req.params.id, userId, reason);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error cancelling transfer:', error);
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/riders/:riderId/transfers
 */
export async function getRiderTransfers(req: Request, res: Response): Promise<void> {
  try {
    const result = await transferService.getRiderTransfers(req.params.riderId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching rider transfers:', error);
    res.status(500).json({ success: false, error: 'Failed to get rider transfers' });
  }
}
