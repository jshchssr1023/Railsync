import { Request, Response } from 'express';
import logger from '../config/logger';
import * as componentService from '../services/component.service';

/**
 * GET /api/components
 * List components with optional filters
 */
export async function listComponents(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      car_number: req.query.car_number as string | undefined,
      component_type: req.query.component_type as string | undefined,
      status: req.query.status as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const result = await componentService.listComponents(filters);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error listing components');
    res.status(500).json({ success: false, error: 'Failed to list components' });
  }
}

/**
 * GET /api/components/stats
 * Get component statistics, optionally filtered by car_number
 */
export async function getComponentStats(req: Request, res: Response): Promise<void> {
  try {
    const car_number = req.query.car_number as string | undefined;

    const result = await componentService.getComponentStats(car_number);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching component stats');
    res.status(500).json({ success: false, error: 'Failed to get component stats' });
  }
}

/**
 * GET /api/components/:id
 * Get component detail with history
 */
export async function getComponent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const result = await componentService.getComponentWithHistory(id);

    if (!result) {
      res.status(404).json({ success: false, error: 'Component not found' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching component');
    res.status(500).json({ success: false, error: 'Failed to get component' });
  }
}

/**
 * POST /api/components
 * Create a new component record
 */
export async function createComponent(req: Request, res: Response): Promise<void> {
  try {
    const {
      car_number,
      component_type,
      serial_number,
      manufacturer,
      model,
      install_date,
      ...rest
    } = req.body;

    if (!car_number || !component_type) {
      res.status(400).json({ success: false, error: 'car_number and component_type are required' });
      return;
    }

    const userId = req.user?.userId;

    const result = await componentService.createComponent({
      car_number,
      component_type,
      serial_number,
      manufacturer,
      model,
      install_date,
      ...rest,
    }, userId);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error creating component');
    res.status(500).json({ success: false, error: 'Failed to create component' });
  }
}

/**
 * PUT /api/components/:id
 * Update an existing component
 */
export async function updateComponent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const result = await componentService.updateComponent(id, req.body, userId);

    if (!result) {
      res.status(404).json({ success: false, error: 'Component not found' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error updating component');
    res.status(500).json({ success: false, error: 'Failed to update component' });
  }
}

/**
 * POST /api/components/:id/replace
 * Replace a component with a new one
 */
export async function replaceComponent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { newSerialNumber, newManufacturer, shopCode, notes } = req.body;

    if (!newSerialNumber) {
      res.status(400).json({ success: false, error: 'newSerialNumber is required' });
      return;
    }

    const userId = req.user?.userId;

    const result = await componentService.replaceComponent(id, {
      newSerialNumber,
      newManufacturer,
      shopCode,
      notes,
    }, userId);

    if (!result) {
      res.status(404).json({ success: false, error: 'Component not found' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error replacing component');
    res.status(500).json({ success: false, error: 'Failed to replace component' });
  }
}

/**
 * DELETE /api/components/:id
 * Remove a component
 */
export async function removeComponent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.userId;

    const result = await componentService.removeComponent(id, notes, userId);

    if (!result) {
      res.status(404).json({ success: false, error: 'Component not found' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error removing component');
    res.status(500).json({ success: false, error: 'Failed to remove component' });
  }
}

/**
 * POST /api/components/:id/inspect
 * Record an inspection for a component
 */
export async function recordInspection(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { shopCode, notes } = req.body;
    const userId = req.user?.userId;

    const result = await componentService.recordInspection(id, {
      shopCode,
      notes,
    }, userId);

    if (!result) {
      res.status(404).json({ success: false, error: 'Component not found' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error recording inspection');
    res.status(500).json({ success: false, error: 'Failed to record inspection' });
  }
}

/**
 * GET /api/components/:id/history
 * Get component history
 */
export async function getComponentHistory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const result = await componentService.getComponentHistory(id);

    if (!result) {
      res.status(404).json({ success: false, error: 'Component not found' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching component history');
    res.status(500).json({ success: false, error: 'Failed to get component history' });
  }
}

/**
 * GET /api/cars/:carNumber/components
 * Get all components for a specific car
 */
export async function getCarComponents(req: Request, res: Response): Promise<void> {
  try {
    const { carNumber } = req.params;

    const result = await componentService.getCarComponents(carNumber);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching car components');
    res.status(500).json({ success: false, error: 'Failed to get car components' });
  }
}
