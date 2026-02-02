/**
 * Service Plan Controller - API endpoints for service plan management
 */

import { Request, Response } from 'express';
import {
  createServicePlan,
  getServicePlan,
  listServicePlans,
  updateServicePlan,
  deleteServicePlan,
  createOption,
  getOption,
  listOptions,
  updateOption,
  deleteOption,
  finalizeOption,
  addCarToOption,
  listOptionCars,
  removeCarFromOption,
  approveServicePlan,
  rejectServicePlan,
  ServicePlanStatus,
} from '../services/servicePlan.service';

// ============================================================================
// SERVICE PLAN ENDPOINTS
// ============================================================================

export async function createPlan(req: Request, res: Response) {
  try {
    const {
      customer_code,
      name,
      description,
      car_flow_rate,
      start_date,
      end_date,
      fiscal_year,
      response_deadline,
    } = req.body;

    if (!name || !start_date || !end_date || !fiscal_year) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, start_date, end_date, fiscal_year',
      });
    }

    const plan = await createServicePlan({
      customer_code,
      name,
      description,
      car_flow_rate: car_flow_rate || 0,
      start_date,
      end_date,
      fiscal_year,
      response_deadline,
      created_by_id: req.user?.id,
    });

    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error('Create service plan error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create service plan',
    });
  }
}

export async function getPlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const plan = await getServicePlan(id);

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Service plan not found' });
    }

    // Get options with the plan
    const options = await listOptions(id);

    return res.json({ success: true, data: { ...plan, options } });
  } catch (err) {
    console.error('Get service plan error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get service plan',
    });
  }
}

export async function listPlans(req: Request, res: Response) {
  try {
    const { customer_code, status, fiscal_year, limit, offset } = req.query;

    const result = await listServicePlans({
      customer_code: customer_code as string,
      status: status as ServicePlanStatus,
      fiscal_year: fiscal_year ? parseInt(fiscal_year as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    return res.json({ success: true, data: result.plans, total: result.total });
  } catch (err) {
    console.error('List service plans error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list service plans',
    });
  }
}

export async function updatePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const plan = await updateServicePlan(id, req.body);

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Service plan not found' });
    }

    return res.json({ success: true, data: plan });
  } catch (err) {
    console.error('Update service plan error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update service plan',
    });
  }
}

export async function deletePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await deleteServicePlan(id);
    return res.json({ success: true, message: 'Service plan deleted' });
  } catch (err) {
    console.error('Delete service plan error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete service plan',
    });
  }
}

// ============================================================================
// OPTION ENDPOINTS
// ============================================================================

export async function createPlanOption(req: Request, res: Response) {
  try {
    const { planId } = req.params;
    const { option_name, description, is_recommended } = req.body;

    if (!option_name) {
      return res.status(400).json({ success: false, error: 'option_name is required' });
    }

    const option = await createOption(planId, { option_name, description, is_recommended });
    return res.status(201).json({ success: true, data: option });
  } catch (err) {
    console.error('Create option error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create option',
    });
  }
}

export async function getPlanOption(req: Request, res: Response) {
  try {
    const { optionId } = req.params;
    const option = await getOption(optionId);

    if (!option) {
      return res.status(404).json({ success: false, error: 'Option not found' });
    }

    // Get cars for this option
    const cars = await listOptionCars(optionId);

    return res.json({ success: true, data: { ...option, cars } });
  } catch (err) {
    console.error('Get option error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get option',
    });
  }
}

export async function listPlanOptions(req: Request, res: Response) {
  try {
    const { planId } = req.params;
    const options = await listOptions(planId);
    return res.json({ success: true, data: options });
  } catch (err) {
    console.error('List options error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list options',
    });
  }
}

export async function updatePlanOption(req: Request, res: Response) {
  try {
    const { optionId } = req.params;
    const option = await updateOption(optionId, req.body);

    if (!option) {
      return res.status(404).json({ success: false, error: 'Option not found' });
    }

    return res.json({ success: true, data: option });
  } catch (err) {
    console.error('Update option error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update option',
    });
  }
}

export async function deletePlanOption(req: Request, res: Response) {
  try {
    const { optionId } = req.params;
    await deleteOption(optionId);
    return res.json({ success: true, message: 'Option deleted' });
  } catch (err) {
    console.error('Delete option error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete option',
    });
  }
}

export async function finalizePlanOption(req: Request, res: Response) {
  try {
    const { optionId } = req.params;
    const option = await finalizeOption(optionId);

    if (!option) {
      return res.status(404).json({ success: false, error: 'Option not found' });
    }

    return res.json({ success: true, data: option });
  } catch (err) {
    console.error('Finalize option error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to finalize option',
    });
  }
}

// ============================================================================
// OPTION CARS ENDPOINTS
// ============================================================================

export async function addCarToOptionHandler(req: Request, res: Response) {
  try {
    const { optionId } = req.params;
    const { car_number, car_id, shop_code, target_month, estimated_cost, service_options } =
      req.body;

    if (!car_number || !shop_code) {
      return res.status(400).json({
        success: false,
        error: 'car_number and shop_code are required',
      });
    }

    const car = await addCarToOption(optionId, {
      car_number,
      car_id,
      shop_code,
      target_month,
      estimated_cost,
      service_options,
    });

    return res.status(201).json({ success: true, data: car });
  } catch (err) {
    console.error('Add car to option error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add car to option',
    });
  }
}

export async function listOptionCarsHandler(req: Request, res: Response) {
  try {
    const { optionId } = req.params;
    const cars = await listOptionCars(optionId);
    return res.json({ success: true, data: cars });
  } catch (err) {
    console.error('List option cars error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list option cars',
    });
  }
}

export async function removeCarFromOptionHandler(req: Request, res: Response) {
  try {
    const { carId } = req.params;
    await removeCarFromOption(carId);
    return res.json({ success: true, message: 'Car removed from option' });
  } catch (err) {
    console.error('Remove car from option error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove car from option',
    });
  }
}

// ============================================================================
// APPROVAL ENDPOINTS
// ============================================================================

export async function approvePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { option_id, notes } = req.body;

    if (!option_id) {
      return res.status(400).json({ success: false, error: 'option_id is required' });
    }

    const approvedBy = req.user?.email || 'system';
    const result = await approveServicePlan(id, option_id, approvedBy, notes);

    return res.json({
      success: true,
      data: result.plan,
      created_assignments: result.created_assignments,
      skipped_conflicts: result.skipped_conflicts,
    });
  } catch (err) {
    console.error('Approve service plan error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to approve service plan',
    });
  }
}

export async function rejectPlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const plan = await rejectServicePlan(id, reason);

    return res.json({ success: true, data: plan });
  } catch (err) {
    console.error('Reject service plan error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reject service plan',
    });
  }
}

export default {
  createPlan,
  getPlan,
  listPlans,
  updatePlan,
  deletePlan,
  createPlanOption,
  getPlanOption,
  listPlanOptions,
  updatePlanOption,
  deletePlanOption,
  finalizePlanOption,
  addCarToOptionHandler,
  listOptionCarsHandler,
  removeCarFromOptionHandler,
  approvePlan,
  rejectPlan,
};
