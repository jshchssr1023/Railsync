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

// ============================================================================
// CUSTOMER CRUD ENDPOINTS
// ============================================================================

export async function createCustomer(req: Request, res: Response) {
  try {
    const { customer_code, customer_name, contact_name, contact_email, contact_phone, billing_address, notes } = req.body;
    if (!customer_code || !customer_name) {
      return res.status(400).json({ success: false, error: 'customer_code and customer_name are required' });
    }
    const customer = await contractsService.createCustomer({
      customer_code, customer_name, contact_name, contact_email, contact_phone, billing_address, notes,
    });
    res.status(201).json({ success: true, data: customer });
  } catch (error: any) {
    logger.error({ err: error }, 'Error creating customer');
    const status = error.message.includes('duplicate') ? 409 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to create customer' });
  }
}

export async function updateCustomerHandler(req: Request, res: Response) {
  try {
    const { customerId } = req.params;
    const customer = await contractsService.updateCustomer(customerId, req.body);
    res.json({ success: true, data: customer });
  } catch (error: any) {
    logger.error({ err: error }, 'Error updating customer');
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// LEASE CRUD ENDPOINTS
// ============================================================================

export async function createLease(req: Request, res: Response) {
  try {
    const { lease_id, customer_id, lease_name, start_date, end_date, base_rate_per_car, terms_summary, payment_terms, notes } = req.body;
    if (!lease_id || !customer_id || !start_date) {
      return res.status(400).json({ success: false, error: 'lease_id, customer_id, and start_date are required' });
    }
    const lease = await contractsService.createMasterLease({
      lease_id, customer_id, lease_name, start_date, end_date, base_rate_per_car, terms_summary, payment_terms, notes,
    });
    res.status(201).json({ success: true, data: lease });
  } catch (error: any) {
    logger.error({ err: error }, 'Error creating lease');
    const status = error.message.includes('not found') ? 404 : error.message.includes('duplicate') ? 409 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

export async function updateLeaseHandler(req: Request, res: Response) {
  try {
    const { leaseId } = req.params;
    const lease = await contractsService.updateMasterLease(leaseId, req.body);
    res.json({ success: true, data: lease });
  } catch (error: any) {
    logger.error({ err: error }, 'Error updating lease');
    const status = error.message.includes('not found') ? 404 : error.message.includes('terminated') ? 403 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

export async function deactivateLeaseHandler(req: Request, res: Response) {
  try {
    const { leaseId } = req.params;
    const result = await contractsService.deactivateLease(leaseId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Error deactivating lease');
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// RIDER CRUD ENDPOINTS
// ============================================================================

export async function createRider(req: Request, res: Response) {
  try {
    const { rider_id, master_lease_id, rider_name, effective_date, expiration_date, rate_per_car, specific_terms, notes } = req.body;
    if (!rider_id || !master_lease_id || !effective_date) {
      return res.status(400).json({ success: false, error: 'rider_id, master_lease_id, and effective_date are required' });
    }
    const rider = await contractsService.createLeaseRider(
      { rider_id, master_lease_id, rider_name, effective_date, expiration_date, rate_per_car, specific_terms, notes },
      req.user?.id
    );
    res.status(201).json({ success: true, data: rider });
  } catch (error: any) {
    logger.error({ err: error }, 'Error creating rider');
    const status = error.message.includes('not found') ? 404 : error.message.includes('duplicate') ? 409 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

export async function updateRiderHandler(req: Request, res: Response) {
  try {
    const { riderId } = req.params;
    const rider = await contractsService.updateLeaseRider(riderId, req.body, req.user?.id);
    res.json({ success: true, data: rider });
  } catch (error: any) {
    logger.error({ err: error }, 'Error updating rider');
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
}

export async function deactivateRiderHandler(req: Request, res: Response) {
  try {
    const { riderId } = req.params;
    const result = await contractsService.deactivateRider(riderId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Error deactivating rider');
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// CAR ↔ RIDER ENDPOINTS
// ============================================================================

export async function addCarToRiderHandler(req: Request, res: Response) {
  try {
    const { riderId } = req.params;
    const { car_number, added_date } = req.body;
    if (!car_number) {
      return res.status(400).json({ success: false, error: 'car_number is required' });
    }
    const result = await contractsService.addCarToRider(riderId, car_number, added_date);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Error adding car to rider');
    const status = error.message.includes('not found') ? 404 : error.message.includes('already active') ? 409 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

export async function removeCarFromRiderHandler(req: Request, res: Response) {
  try {
    const { riderId, carNumber } = req.params;
    await contractsService.removeCarFromRider(riderId, carNumber);
    res.json({ success: true, message: `Car ${carNumber} removed from rider` });
  } catch (error: any) {
    logger.error({ err: error }, 'Error removing car from rider');
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// ON-RENT ENDPOINTS
// ============================================================================

export async function getOnRentHistoryHandler(req: Request, res: Response) {
  try {
    const { carNumber } = req.params;
    const periodStart = req.query.start as string | undefined;
    const periodEnd = req.query.end as string | undefined;
    const history = await contractsService.getOnRentHistory(carNumber, periodStart, periodEnd);
    res.json({ success: true, data: history, total: history.length });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting on-rent history');
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// AMENDMENT LIFECYCLE ENDPOINTS
// ============================================================================

export async function createAmendmentHandler(req: Request, res: Response) {
  try {
    const { amendment_id, rider_id, amendment_type, effective_date, change_summary, new_rate,
            required_shop_date, service_interval_days, cars_added, cars_removed, notes } = req.body;
    if (!amendment_id || !rider_id || !amendment_type || !effective_date || !change_summary) {
      return res.status(400).json({ success: false, error: 'amendment_id, rider_id, amendment_type, effective_date, and change_summary are required' });
    }
    const amendment = await contractsService.createAmendment({
      amendment_id, rider_id, amendment_type, effective_date, change_summary,
      new_rate, required_shop_date, service_interval_days, cars_added, cars_removed, notes,
    }, req.user?.id);
    res.status(201).json({ success: true, data: amendment });
  } catch (error: any) {
    logger.error({ err: error }, 'Error creating amendment');
    const status = error.message.includes('not found') ? 404 : error.message.includes('duplicate') ? 409 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

export async function updateAmendmentHandler(req: Request, res: Response) {
  try {
    const { amendmentId } = req.params;
    const amendment = await contractsService.updateAmendment(amendmentId, req.body);
    res.json({ success: true, data: amendment });
  } catch (error: any) {
    logger.error({ err: error }, 'Error updating amendment');
    const status = error.message.includes('not found') ? 404 : error.message.includes('Draft') ? 403 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

export async function submitAmendmentHandler(req: Request, res: Response) {
  try {
    const { amendmentId } = req.params;
    const amendment = await contractsService.submitAmendment(amendmentId, req.user!.id);
    res.json({ success: true, data: amendment });
  } catch (error: any) {
    logger.error({ err: error }, 'Error submitting amendment');
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
}

export async function approveAmendmentHandler(req: Request, res: Response) {
  try {
    const { amendmentId } = req.params;
    const amendment = await contractsService.approveAmendment(amendmentId, req.user!.id);
    res.json({ success: true, data: amendment });
  } catch (error: any) {
    logger.error({ err: error }, 'Error approving amendment');
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
}

export async function rejectAmendmentHandler(req: Request, res: Response) {
  try {
    const { amendmentId } = req.params;
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: 'reason is required' });
    }
    const amendment = await contractsService.rejectAmendment(amendmentId, req.user!.id, reason);
    res.json({ success: true, data: amendment });
  } catch (error: any) {
    logger.error({ err: error }, 'Error rejecting amendment');
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
}

export async function activateAmendmentHandler(req: Request, res: Response) {
  try {
    const { amendmentId } = req.params;
    const amendment = await contractsService.activateAmendment(amendmentId, req.user!.id);
    res.json({ success: true, data: amendment });
  } catch (error: any) {
    logger.error({ err: error }, 'Error activating amendment');
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
}

export async function getAmendmentStateHistoryHandler(req: Request, res: Response) {
  try {
    const { amendmentId } = req.params;
    const history = await contractsService.getAmendmentStateHistory(amendmentId);
    res.json({ success: true, data: history, total: history.length });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting amendment state history');
    res.status(500).json({ success: false, error: error.message });
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
  // CRUD
  createCustomer,
  updateCustomerHandler,
  createLease,
  updateLeaseHandler,
  deactivateLeaseHandler,
  createRider,
  updateRiderHandler,
  deactivateRiderHandler,
  addCarToRiderHandler,
  removeCarFromRiderHandler,
  // On-rent
  getOnRentHistoryHandler,
  // Amendment lifecycle
  createAmendmentHandler,
  updateAmendmentHandler,
  submitAmendmentHandler,
  approveAmendmentHandler,
  rejectAmendmentHandler,
  activateAmendmentHandler,
  getAmendmentStateHistoryHandler,
};
