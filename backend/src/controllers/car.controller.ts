import { Request, Response } from 'express';
import logger from '../config/logger';
import carModel from '../models/car.model';
import { ApiResponse, CarWithCommodity, ServiceEvent } from '../types';
import * as assetEventService from '../services/assetEvent.service';
import * as carUmlerService from '../services/carUmler.service';

/**
 * GET /api/cars/:carNumber
 * Retrieve car attributes and active service event
 */
export async function getCarByNumber(req: Request, res: Response): Promise<void> {
  try {
    const { carNumber } = req.params;

    if (!carNumber) {
      res.status(400).json({
        success: false,
        error: 'Car number is required',
      } as ApiResponse<null>);
      return;
    }

    const car = await carModel.findByCarNumber(carNumber);

    if (!car) {
      res.status(404).json({
        success: false,
        error: `Car not found: ${carNumber}`,
      } as ApiResponse<null>);
      return;
    }

    // Get active service event if any
    const serviceEvent = await carModel.getActiveServiceEvent(carNumber);

    res.json({
      success: true,
      data: {
        car,
        active_service_event: serviceEvent,
      },
    } as ApiResponse<{ car: CarWithCommodity; active_service_event: ServiceEvent | null }>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching car');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

/**
 * GET /api/cars/:carNumber/history
 * Get asset event history for a car
 */
export async function getCarHistory(req: Request, res: Response): Promise<void> {
  try {
    const { carNumber } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const events = await assetEventService.getCarHistoryByNumber(carNumber, limit);

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching car history');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

/**
 * GET /api/cars/:carNumber/umler
 * Get UMLER engineering attributes for a car
 */
export async function getCarUmler(req: Request, res: Response): Promise<void> {
  try {
    const { carNumber } = req.params;
    const data = await carUmlerService.findByCarNumber(carNumber);

    res.json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching UMLER attributes');
    res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse<null>);
  }
}

/**
 * PUT /api/cars/:carNumber/umler
 * Create or update UMLER attributes for a car
 */
export async function updateCarUmler(req: Request, res: Response): Promise<void> {
  try {
    const { carNumber } = req.params;
    const userId = req.user?.id;

    const data = await carUmlerService.upsert(carNumber, req.body, userId);
    if (!data) {
      res.status(404).json({ success: false, error: `Car not found: ${carNumber}` } as ApiResponse<null>);
      return;
    }

    res.json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, 'Error updating UMLER attributes');
    res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse<null>);
  }
}

/**
 * POST /api/cars/umler/import
 * Bulk import UMLER attributes from CSV
 */
export async function importUmlerCSV(req: Request, res: Response): Promise<void> {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      res.status(400).json({ success: false, error: 'CSV content is required in request body' } as ApiResponse<null>);
      return;
    }

    const userId = req.user?.id;
    const result = await carUmlerService.importCSV(content, userId);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error importing UMLER CSV');
    res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse<null>);
  }
}

export default {
  getCarByNumber,
  getCarHistory,
  getCarUmler,
  updateCarUmler,
  importUmlerCSV,
};
