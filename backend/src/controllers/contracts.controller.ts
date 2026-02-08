/**
 * Contracts Controller - Lease Hierarchy and Amendment Management
 *
 * API endpoints for Customer → Lease → Rider → Cars navigation
 */

import { Request, Response } from 'express';
import logger from '../config/logger';
import * as contractsService from '../services/contracts.service';

// ============================================================================
// CUSTOMER ENDPOINTS
// ============================================================================

export async function listCustomers(req: Request, res: Response) {
  try {
    const activeOnly = req.query.active !== 'false';
    const customers = await contractsService.listCustomers(activeOnly);

    res.json({
      success: true,
      data: customers,
      total: customers.length,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error listing customers');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list customers',
    });
  }
}

export async function getCustomer(req: Request, res: Response) {
  try {
    const { customerId } = req.params;
    const customer = await contractsService.getCustomer(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting customer');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get customer',
    });
  }
}

export async function getCustomerLeases(req: Request, res: Response) {
  try {
    const { customerId } = req.params;
    const leases = await contractsService.getCustomerLeases(customerId);

    res.json({
      success: true,
      data: leases,
      total: leases.length,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting customer leases');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get customer leases',
    });
  }
}

// ============================================================================
// LEASE ENDPOINTS
// ============================================================================

export async function getLease(req: Request, res: Response) {
  try {
    const { leaseId } = req.params;
    const lease = await contractsService.getLease(leaseId);

    if (!lease) {
      return res.status(404).json({
        success: false,
        error: 'Lease not found',
      });
    }

    res.json({
      success: true,
      data: lease,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting lease');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get lease',
    });
  }
}

export async function getLeaseRiders(req: Request, res: Response) {
  try {
    const { leaseId } = req.params;
    const riders = await contractsService.getLeaseRiders(leaseId);

    res.json({
      success: true,
      data: riders,
      total: riders.length,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting lease riders');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get lease riders',
    });
  }
}

// ============================================================================
// RIDER ENDPOINTS
// ============================================================================

export async function getRider(req: Request, res: Response) {
  try {
    const { riderId } = req.params;
    const rider = await contractsService.getRider(riderId);

    if (!rider) {
      return res.status(404).json({
        success: false,
        error: 'Rider not found',
      });
    }

    res.json({
      success: true,
      data: rider,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting rider');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get rider',
    });
  }
}

export async function getRiderCars(req: Request, res: Response) {
  try {
    const { riderId } = req.params;
    const cars = await contractsService.getRiderCars(riderId);

    res.json({
      success: true,
      data: cars,
      total: cars.length,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting rider cars');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get rider cars',
    });
  }
}

export async function getRiderAmendments(req: Request, res: Response) {
  try {
    const { riderId } = req.params;
    const amendments = await contractsService.getRiderAmendments(riderId);

    res.json({
      success: true,
      data: amendments,
      total: amendments.length,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting rider amendments');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get rider amendments',
    });
  }
}

export async function resyncRiderSchedules(req: Request, res: Response) {
  try {
    const { riderId } = req.params;
    const userId = req.user?.id;

    const count = await contractsService.resyncSchedules(riderId, userId);

    res.json({
      success: true,
      data: {
        cars_updated: count,
        message: `Updated ${count} car schedules to align with amendment terms`,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error resyncing rider schedules');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resync schedules',
    });
  }
}

// ============================================================================
// AMENDMENT ENDPOINTS
// ============================================================================

export async function getAmendment(req: Request, res: Response) {
  try {
    const { amendmentId } = req.params;
    const amendment = await contractsService.getAmendment(amendmentId);

    if (!amendment) {
      return res.status(404).json({
        success: false,
        error: 'Amendment not found',
      });
    }

    // Get comparison data
    const comparison = await contractsService.getAmendmentComparison(amendmentId);

    res.json({
      success: true,
      data: {
        ...amendment,
        comparison,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting amendment');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get amendment',
    });
  }
}

export async function detectAmendmentConflicts(req: Request, res: Response) {
  try {
    const { amendmentId } = req.params;
    const conflictsFound = await contractsService.detectConflicts(amendmentId);

    res.json({
      success: true,
      data: {
        conflicts_found: conflictsFound,
        message: conflictsFound > 0
          ? `Found ${conflictsFound} cars with scheduling conflicts`
          : 'No conflicts detected',
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error detecting conflicts');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to detect conflicts',
    });
  }
}

// ============================================================================
// CONTRACTS OVERVIEW WITH AMENDMENTS
// ============================================================================

export async function getCarsWithAmendments(req: Request, res: Response) {
  try {
    const filters = {
      hasAmendment: req.query.hasAmendment === 'true' ? true : req.query.hasAmendment === 'false' ? false : undefined,
      hasConflict: req.query.hasConflict === 'true' ? true : req.query.hasConflict === 'false' ? false : undefined,
      hasTransition: req.query.hasTransition === 'true' ? true : req.query.hasTransition === 'false' ? false : undefined,
      customerId: req.query.customerId as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const result = await contractsService.getCarsWithAmendments(filters);

    res.json({
      success: true,
      data: result.cars,
      total: result.total,
      filters,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting cars with amendments');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get cars with amendments',
    });
  }
}

// ============================================================================
// CAR SHOPPING VALIDATION
// ============================================================================

export async function validateCarForShopping(req: Request, res: Response) {
  try {
    const { carNumber } = req.params;
    const result = await contractsService.validateCarForShopping(carNumber);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error validating car for shopping');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate car',
    });
  }
}

export default {
  listCustomers,
  getCustomer,
  getCustomerLeases,
  getLease,
  getLeaseRiders,
  getRider,
  getRiderCars,
  getRiderAmendments,
  resyncRiderSchedules,
  getAmendment,
  detectAmendmentConflicts,
  getCarsWithAmendments,
  validateCarForShopping,
};
