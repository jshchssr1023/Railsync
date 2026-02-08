import { Request, Response } from 'express';
import logger from '../config/logger';
import {
  createShoppingEvent as createShoppingEventService,
  createBatchShoppingEvents as createBatchShoppingEventsService,
  getShoppingEvent as getShoppingEventService,
  listShoppingEvents as listShoppingEventsService,
  transitionState as transitionStateService,
  getStateHistory as getStateHistoryService,
  getCarShoppingHistory as getCarShoppingHistoryService,
  ShoppingEventState,
} from '../services/shopping-event.service';
import { detectProjectForCar } from '../services/project-planning.service';
import { query, queryOne } from '../config/database';

// POST /api/shopping-events
export async function createShoppingEvent(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const event = await createShoppingEventService(req.body, userId);

    // Auto-detect project car and flag the shopping event
    if (event.car_number) {
      try {
        const detection = await detectProjectForCar(event.car_number);
        if (detection) {
          await query(
            `UPDATE shopping_events
             SET project_flag_checked = TRUE, flagged_project_id = $2
             WHERE id = $1`,
            [event.id, detection.project_id]
          );
          event.flagged_project_id = detection.project_id;
          event.project_flag_checked = true;
        } else {
          await query(
            `UPDATE shopping_events SET project_flag_checked = TRUE WHERE id = $1`,
            [event.id]
          );
        }
      } catch (flagErr) {
        logger.error({ err: flagErr }, 'Non-critical: project flag detection failed');
      }
    }

    res.status(201).json(event);
  } catch (error: any) {
    logger.error({ err: error }, 'Error creating shopping event');
    res.status(500).json({ error: error.message || 'Failed to create shopping event' });
  }
}

// POST /api/shopping-events/batch
export async function createBatchShoppingEvents(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const result = await createBatchShoppingEventsService(req.body, userId);
    res.status(201).json(result);
  } catch (error: any) {
    logger.error({ err: error }, 'Error creating batch shopping events');
    res.status(500).json({ error: error.message || 'Failed to create batch shopping events' });
  }
}

// GET /api/shopping-events
export async function listShoppingEvents(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      state: req.query.state as ShoppingEventState | undefined,
      shop_code: req.query.shop_code as string | undefined,
      car_number: req.query.car_number as string | undefined,
      batch_id: req.query.batch_id as string | undefined,
      shopping_type_code: req.query.shopping_type_code as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await listShoppingEventsService(filters);
    res.json(result);
  } catch (error: any) {
    logger.error({ err: error }, 'Error listing shopping events');
    res.status(500).json({ error: error.message || 'Failed to list shopping events' });
  }
}

// GET /api/shopping-events/:id
export async function getShoppingEvent(req: Request, res: Response): Promise<void> {
  try {
    const event = await getShoppingEventService(req.params.id);
    if (!event) {
      res.status(404).json({ error: 'Shopping event not found' });
      return;
    }
    res.json(event);
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting shopping event');
    res.status(500).json({ error: error.message || 'Failed to get shopping event' });
  }
}

// PUT /api/shopping-events/:id/state
export async function transitionState(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { state, to_state, notes } = req.body;
    const targetState = to_state || state;
    if (!targetState) {
      res.status(400).json({ error: 'Missing required field: state or to_state' });
      return;
    }
    const event = await transitionStateService(req.params.id, targetState, userId, notes);
    res.json(event);
  } catch (error: any) {
    logger.error({ err: error }, 'Error transitioning shopping event state');
    if (error.message?.includes('Gate blocked')) {
      res.status(409).json({ error: error.message });
      return;
    }
    if (error.message?.includes('Invalid state transition')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to transition state' });
  }
}

// PATCH /api/shopping-events/:id  — update mutable fields (e.g. shop_code)
export async function updateShoppingEvent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { shop_code } = req.body;

    // Validate at least one updatable field is provided
    if (!shop_code) {
      res.status(400).json({ error: 'No updatable fields provided. Supported: shop_code' });
      return;
    }

    // Only allow reassignment when event is in REQUESTED or ASSIGNED_TO_SHOP state
    const existing = await queryOne<{ id: string; state: string }>(
      `SELECT id, state FROM shopping_events WHERE id = $1`,
      [id]
    );
    if (!existing) {
      res.status(404).json({ error: 'Shopping event not found' });
      return;
    }
    const currentState = existing.state;
    const reassignableStates = ['REQUESTED', 'ASSIGNED_TO_SHOP'];
    if (!reassignableStates.includes(currentState)) {
      res.status(409).json({
        error: `Cannot reassign shop when event is in ${currentState} state. Allowed states: ${reassignableStates.join(', ')}`,
      });
      return;
    }

    const updatedRows = await query(
      `UPDATE shopping_events
       SET shop_code = $2, updated_by_id = $3, updated_at = NOW(), version = version + 1
       WHERE id = $1
       RETURNING *`,
      [id, shop_code, userId]
    );

    logger.info({ eventId: id, shop_code, userId }, 'Shopping event shop reassigned');
    res.json(updatedRows[0]);
  } catch (error: any) {
    logger.error({ err: error }, 'Error updating shopping event');
    res.status(500).json({ error: error.message || 'Failed to update shopping event' });
  }
}

// GET /api/shopping-events/:id/state-history
export async function getStateHistory(req: Request, res: Response): Promise<void> {
  try {
    const history = await getStateHistoryService(req.params.id);
    res.json(history);
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting state history');
    res.status(500).json({ error: error.message || 'Failed to get state history' });
  }
}

// GET /api/cars/:carNumber/shopping-history
export async function getCarShoppingHistory(req: Request, res: Response): Promise<void> {
  try {
    const history = await getCarShoppingHistoryService(req.params.carNumber);
    res.json(history);
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting car shopping history');
    res.status(500).json({ error: error.message || 'Failed to get car shopping history' });
  }
}
