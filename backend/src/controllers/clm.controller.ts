import { Request, Response } from 'express';
import * as clmService from '../services/clm-integration.service';

export async function syncLocations(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const result = await clmService.syncCarLocations(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to sync car locations' });
  }
}

export async function getCarLocation(req: Request, res: Response): Promise<void> {
  try {
    const location = await clmService.getCarLocation(req.params.carNumber);
    if (!location) { res.status(404).json({ error: 'No location found for this car' }); return; }
    res.json({ success: true, data: location });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get car location' });
  }
}

export async function listCarLocations(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      railroad: req.query.railroad as string | undefined,
      state: req.query.state as string | undefined,
      location_type: req.query.location_type as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await clmService.getAllCarLocations(filters);
    res.json({ success: true, data: result.locations, total: result.total });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list car locations' });
  }
}

export async function getLocationHistory(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const history = await clmService.getLocationHistory(req.params.carNumber, limit);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get location history' });
  }
}

export async function checkConnection(req: Request, res: Response): Promise<void> {
  try {
    const result = await clmService.checkCLMConnection();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check CLM connection' });
  }
}
