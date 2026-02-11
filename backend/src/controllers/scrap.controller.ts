import { Request, Response } from 'express';
import logger from '../config/logger';
import * as scrapService from '../services/scrap.service';

/**
 * POST /api/scraps
 */
export async function createScrapProposal(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const result = await scrapService.createScrapProposal(req.body, userId);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Error creating scrap proposal');
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/scraps
 */
export async function listScraps(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      car_number: req.query.car_number as string,
      status: req.query.status as any,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await scrapService.listScraps(filters);
    res.json({ success: true, data: result.scraps, total: result.total });
  } catch (error) {
    logger.error({ err: error }, 'Error listing scraps');
    res.status(500).json({ success: false, error: 'Failed to list scraps' });
  }
}

/**
 * GET /api/scraps/active
 */
export async function getActiveScraps(req: Request, res: Response): Promise<void> {
  try {
    const result = await scrapService.getActiveScrapsView();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching active scraps');
    res.status(500).json({ success: false, error: 'Failed to get active scraps' });
  }
}

/**
 * GET /api/scraps/:id
 */
export async function getScrap(req: Request, res: Response): Promise<void> {
  try {
    const result = await scrapService.getScrap(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: 'Scrap not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching scrap');
    res.status(500).json({ success: false, error: 'Failed to get scrap' });
  }
}

/**
 * PUT /api/scraps/:id
 * Handles all status transitions + field updates
 */
export async function updateScrap(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { status, ...data } = req.body;

    if (!status) {
      res.status(400).json({ success: false, error: 'Status is required for scrap updates' });
      return;
    }

    const result = await scrapService.transitionScrap(req.params.id, status, userId, data);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Error updating scrap');
    res.status(400).json({ success: false, error: error.message });
  }
}
