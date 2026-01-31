import { Request, Response } from 'express';
import carModel from '../models/car.model';
import { ApiResponse, CarWithCommodity, ServiceEvent } from '../types';

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
    console.error('Error fetching car:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

export default {
  getCarByNumber,
};
