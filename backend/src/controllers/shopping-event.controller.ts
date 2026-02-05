import { Request, Response } from 'express';
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
import { query } from '../config/database';

// POST /api/shopping-events
export async function createShoppingEvent(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
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
        console.error('Non-critical: project flag detection failed:', flagErr);
      }
    }

    res.status(201).json(event);
  } catch (error: any) {
    console.error('Error creating shopping event:', error);
    res.status(500).json({ error: error.message || 'Failed to create shopping event' });
  }
}

// POST /api/shopping-events/batch
export async function createBatchShoppingEvents(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const result = await createBatchShoppingEventsService(req.body, userId);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating batch shopping events:', error);
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
    console.error('Error listing shopping events:', error);
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
    console.error('Error getting shopping event:', error);
    res.status(500).json({ error: error.message || 'Failed to get shopping event' });
  }
}

// PUT /api/shopping-events/:id/state
export async function transitionState(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const { state, to_state, notes } = req.body;
    const targetState = to_state || state;
    if (!targetState) {
      res.status(400).json({ error: 'Missing required field: state or to_state' });
      return;
    }
    const event = await transitionStateService(req.params.id, targetState, userId, notes);
    res.json(event);
  } catch (error: any) {
    console.error('Error transitioning shopping event state:', error);
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

// GET /api/shopping-events/:id/state-history
export async function getStateHistory(req: Request, res: Response): Promise<void> {
  try {
    const history = await getStateHistoryService(req.params.id);
    res.json(history);
  } catch (error: any) {
    console.error('Error getting state history:', error);
    res.status(500).json({ error: error.message || 'Failed to get state history' });
  }
}

// GET /api/cars/:carNumber/shopping-history
export async function getCarShoppingHistory(req: Request, res: Response): Promise<void> {
  try {
    const history = await getCarShoppingHistoryService(req.params.carNumber);
    res.json(history);
  } catch (error: any) {
    console.error('Error getting car shopping history:', error);
    res.status(500).json({ error: error.message || 'Failed to get car shopping history' });
  }
}
