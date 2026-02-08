import { Request, Response } from 'express';
import logger from '../config/logger';
import * as commodityService from '../services/commodity.service';

/**
 * GET /api/commodities
 * List all commodities, optionally including inactive ones
 */
export async function listCommodities(req: Request, res: Response): Promise<void> {
  try {
    const includeInactive = req.query.includeInactive === 'true';

    const result = await commodityService.listCommodities(includeInactive);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error listing commodities');
    res.status(500).json({ success: false, error: 'Failed to list commodities' });
  }
}

/**
 * GET /api/commodities/:code
 * Look up a commodity by its code
 */
export async function getCommodityByCode(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;

    const result = await commodityService.getCommodityByCode(code);

    if (!result) {
      res.status(404).json({ success: false, error: `Commodity not found: ${code}` });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching commodity');
    res.status(500).json({ success: false, error: 'Failed to get commodity' });
  }
}

/**
 * GET /api/commodities/:code/cleaning
 * Get cleaning requirements for a commodity
 */
export async function getCommodityCleaningRequirements(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;

    const result = await commodityService.getCleaningRequirements(code);

    if (!result) {
      res.status(404).json({ success: false, error: `Commodity not found: ${code}` });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching cleaning requirements');
    res.status(500).json({ success: false, error: 'Failed to get cleaning requirements' });
  }
}

/**
 * POST /api/commodities
 * Create a new commodity
 */
export async function createCommodity(req: Request, res: Response): Promise<void> {
  try {
    const { code, name } = req.body;

    if (!code || !name) {
      res.status(400).json({ success: false, error: 'code and name are required' });
      return;
    }

    const userId = req.user!.id;

    const result = await commodityService.createCommodity(req.body, userId);

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ success: false, error: 'Commodity with this code already exists' });
      return;
    }
    logger.error({ err: error }, 'Error creating commodity');
    res.status(500).json({ success: false, error: 'Failed to create commodity' });
  }
}

/**
 * PUT /api/commodities/:id
 * Update an existing commodity
 */
export async function updateCommodity(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await commodityService.updateCommodity(id, req.body, userId);

    if (!result) {
      res.status(404).json({ success: false, error: 'Commodity not found' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error updating commodity');
    res.status(500).json({ success: false, error: 'Failed to update commodity' });
  }
}

/**
 * GET /api/cars/:carNumber/cleaning-requirements
 * Get cleaning requirements for a car based on its rider's commodity
 */
export async function getCarCleaningRequirements(req: Request, res: Response): Promise<void> {
  try {
    const { carNumber } = req.params;

    const result = await commodityService.getCarCleaningRequirements(carNumber);

    if (!result) {
      res.status(404).json({ success: false, error: `Car not found or no commodity assigned: ${carNumber}` });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching car cleaning requirements');
    res.status(500).json({ success: false, error: 'Failed to get car cleaning requirements' });
  }
}
