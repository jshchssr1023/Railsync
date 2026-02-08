import { Request, Response } from 'express';
import logger from '../config/logger';
import * as releaseService from '../services/release.service';

/**
 * POST /api/releases
 */
export async function initiateRelease(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const result = await releaseService.initiateRelease(req.body, userId);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Error initiating release');
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/releases
 */
export async function listReleases(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      car_number: req.query.car_number as string,
      rider_id: req.query.rider_id as string,
      status: req.query.status as any,
      release_type: req.query.release_type as any,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await releaseService.listReleases(filters);
    res.json({ success: true, data: result.releases, total: result.total });
  } catch (error) {
    logger.error({ err: error }, 'Error listing releases');
    res.status(500).json({ success: false, error: 'Failed to list releases' });
  }
}

/**
 * GET /api/releases/active
 */
export async function getActiveReleases(req: Request, res: Response): Promise<void> {
  try {
    const result = await releaseService.getActiveReleasesView();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching active releases');
    res.status(500).json({ success: false, error: 'Failed to get active releases' });
  }
}

/**
 * GET /api/releases/:id
 */
export async function getRelease(req: Request, res: Response): Promise<void> {
  try {
    const result = await releaseService.getRelease(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: 'Release not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching release');
    res.status(500).json({ success: false, error: 'Failed to get release' });
  }
}

/**
 * POST /api/releases/:id/approve
 */
export async function approveRelease(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const result = await releaseService.approveRelease(req.params.id, userId, req.body.notes);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Error approving release');
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/releases/:id/execute
 */
export async function executeRelease(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const result = await releaseService.executeRelease(req.params.id, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Error executing release');
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/releases/:id/complete
 */
export async function completeRelease(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const result = await releaseService.completeRelease(req.params.id, userId, req.body.notes);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Error completing release');
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/releases/:id/cancel
 */
export async function cancelRelease(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, error: 'Cancellation reason is required' });
      return;
    }
    const result = await releaseService.cancelRelease(req.params.id, userId, reason);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Error cancelling release');
    res.status(400).json({ success: false, error: error.message });
  }
}
