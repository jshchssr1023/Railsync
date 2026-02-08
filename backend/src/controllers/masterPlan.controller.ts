import { Request, Response } from 'express';
import logger from '../config/logger';
import * as masterPlanService from '../services/masterPlan.service';

// GET /api/master-plans
export async function listMasterPlans(req: Request, res: Response): Promise<void> {
  try {
    const { fiscal_year, status } = req.query;
    const plans = await masterPlanService.listMasterPlans({
      fiscal_year: fiscal_year ? parseInt(fiscal_year as string) : undefined,
      status: status as string | undefined,
    });
    res.json({ success: true, data: plans });
  } catch (error) {
    logger.error({ err: error }, 'Error listing master plans');
    res.status(500).json({ success: false, error: 'Failed to list master plans' });
  }
}

// GET /api/master-plans/:id
export async function getMasterPlan(req: Request, res: Response): Promise<void> {
  try {
    const plan = await masterPlanService.getMasterPlan(req.params.id);
    if (!plan) {
      res.status(404).json({ success: false, error: 'Master plan not found' });
      return;
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    logger.error({ err: error }, 'Error getting master plan');
    res.status(500).json({ success: false, error: 'Failed to get master plan' });
  }
}

// POST /api/master-plans
export async function createMasterPlan(req: Request, res: Response): Promise<void> {
  try {
    const { name, description, fiscal_year, planning_month } = req.body;

    if (!name || !fiscal_year || !planning_month) {
      res.status(400).json({
        success: false,
        error: 'name, fiscal_year, and planning_month are required',
      });
      return;
    }

    const plan = await masterPlanService.createMasterPlan({
      name,
      description,
      fiscal_year,
      planning_month,
      created_by: req.user?.id,
    });

    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    logger.error({ err: error }, 'Error creating master plan');
    res.status(500).json({ success: false, error: 'Failed to create master plan' });
  }
}

// PUT /api/master-plans/:id
export async function updateMasterPlan(req: Request, res: Response): Promise<void> {
  try {
    const { name, description, status } = req.body;
    const plan = await masterPlanService.updateMasterPlan(req.params.id, {
      name,
      description,
      status,
    });

    if (!plan) {
      res.status(404).json({ success: false, error: 'Master plan not found' });
      return;
    }

    res.json({ success: true, data: plan });
  } catch (error) {
    logger.error({ err: error }, 'Error updating master plan');
    res.status(500).json({ success: false, error: 'Failed to update master plan' });
  }
}

// DELETE /api/master-plans/:id
export async function deleteMasterPlan(req: Request, res: Response): Promise<void> {
  try {
    await masterPlanService.deleteMasterPlan(req.params.id);
    res.json({ success: true, message: 'Master plan deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting master plan');
    res.status(500).json({ success: false, error: 'Failed to delete master plan' });
  }
}

// GET /api/master-plans/:id/versions
export async function listVersions(req: Request, res: Response): Promise<void> {
  try {
    const versions = await masterPlanService.listPlanVersions(req.params.id);
    res.json({ success: true, data: versions });
  } catch (error) {
    logger.error({ err: error }, 'Error listing versions');
    res.status(500).json({ success: false, error: 'Failed to list versions' });
  }
}

// POST /api/master-plans/:id/versions
export async function createVersion(req: Request, res: Response): Promise<void> {
  try {
    const { label, notes } = req.body;
    const version = await masterPlanService.createVersionSnapshot(
      req.params.id,
      label,
      notes,
      req.user?.id
    );

    if (!version) {
      res.status(500).json({ success: false, error: 'Failed to create version snapshot' });
      return;
    }

    res.status(201).json({ success: true, data: version });
  } catch (error) {
    logger.error({ err: error }, 'Error creating version');
    res.status(500).json({ success: false, error: 'Failed to create version' });
  }
}

// GET /api/master-plans/versions/:versionId
export async function getVersion(req: Request, res: Response): Promise<void> {
  try {
    const version = await masterPlanService.getPlanVersion(req.params.versionId);
    if (!version) {
      res.status(404).json({ success: false, error: 'Version not found' });
      return;
    }
    res.json({ success: true, data: version });
  } catch (error) {
    logger.error({ err: error }, 'Error getting version');
    res.status(500).json({ success: false, error: 'Failed to get version' });
  }
}

// GET /api/master-plans/versions/:versionId/allocations
export async function getVersionAllocations(req: Request, res: Response): Promise<void> {
  try {
    const allocations = await masterPlanService.getVersionAllocations(req.params.versionId);
    res.json({ success: true, data: allocations });
  } catch (error) {
    logger.error({ err: error }, 'Error getting version allocations');
    res.status(500).json({ success: false, error: 'Failed to get version allocations' });
  }
}

// POST /api/master-plans/versions/compare
export async function compareVersions(req: Request, res: Response): Promise<void> {
  try {
    const { versionId1, versionId2 } = req.body;

    if (!versionId1 || !versionId2) {
      res.status(400).json({
        success: false,
        error: 'versionId1 and versionId2 are required',
      });
      return;
    }

    const comparison = await masterPlanService.compareVersions(versionId1, versionId2);
    res.json({ success: true, data: comparison });
  } catch (error) {
    logger.error({ err: error }, 'Error comparing versions');
    res.status(500).json({ success: false, error: 'Failed to compare versions' });
  }
}

// ============================================================================
// PLAN ALLOCATION MANAGEMENT
// ============================================================================

// GET /api/master-plans/:id/stats
export async function getPlanStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await masterPlanService.getPlanStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error({ err: error }, 'Error getting plan stats');
    res.status(500).json({ success: false, error: 'Failed to get plan stats' });
  }
}

// GET /api/master-plans/:id/allocations
export async function listPlanAllocations(req: Request, res: Response): Promise<void> {
  try {
    const { status, shop_code, unassigned } = req.query;
    const allocations = await masterPlanService.listPlanAllocations(req.params.id, {
      status: status as string | undefined,
      shop_code: shop_code as string | undefined,
      unassigned: unassigned === 'true',
    });
    res.json({ success: true, data: allocations });
  } catch (error) {
    logger.error({ err: error }, 'Error listing plan allocations');
    res.status(500).json({ success: false, error: 'Failed to list plan allocations' });
  }
}

// POST /api/master-plans/:id/allocations/add-cars
export async function addCarsToPlan(req: Request, res: Response): Promise<void> {
  try {
    const { car_numbers, target_month } = req.body;

    if (!car_numbers || !Array.isArray(car_numbers) || car_numbers.length === 0) {
      res.status(400).json({ success: false, error: 'car_numbers array is required' });
      return;
    }

    // Get plan to determine target_month if not provided
    const plan = await masterPlanService.getMasterPlan(req.params.id);
    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }

    const month = target_month || plan.planning_month;
    const result = await masterPlanService.addCarsToPlan(
      req.params.id,
      car_numbers,
      month,
      req.user!.id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error adding cars to plan');
    res.status(500).json({ success: false, error: 'Failed to add cars to plan' });
  }
}

// POST /api/master-plans/:id/allocations/import-demands
export async function importFromDemands(req: Request, res: Response): Promise<void> {
  try {
    const { demand_ids, scenario_id } = req.body;

    if (!demand_ids || !Array.isArray(demand_ids) || demand_ids.length === 0) {
      res.status(400).json({ success: false, error: 'demand_ids array is required' });
      return;
    }

    const result = await masterPlanService.importFromDemands(
      req.params.id,
      demand_ids,
      scenario_id,
      req.user?.id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error importing demands');
    res.status(500).json({ success: false, error: 'Failed to import demands' });
  }
}

// DELETE /api/master-plans/:id/allocations/:allocationId
export async function removeAllocationFromPlan(req: Request, res: Response): Promise<void> {
  try {
    const removed = await masterPlanService.removeAllocationFromPlan(
      req.params.id,
      req.params.allocationId
    );

    if (!removed) {
      res.status(404).json({ success: false, error: 'Allocation not found in this plan' });
      return;
    }

    res.json({ success: true, message: 'Allocation removed from plan' });
  } catch (error) {
    logger.error({ err: error }, 'Error removing allocation');
    res.status(500).json({ success: false, error: 'Failed to remove allocation' });
  }
}

// PUT /api/master-plans/:id/allocations/:allocationId/assign-shop
export async function assignShopToAllocation(req: Request, res: Response): Promise<void> {
  try {
    const { shop_code, target_month, expected_version } = req.body;

    if (!shop_code) {
      res.status(400).json({ success: false, error: 'shop_code is required' });
      return;
    }

    // Get plan for default target_month
    const plan = await masterPlanService.getMasterPlan(req.params.id);
    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }

    const month = target_month || plan.planning_month;
    const result = await masterPlanService.assignShopToAllocation(
      req.params.allocationId,
      shop_code,
      month,
      expected_version
    );

    if (result.error) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.allocation });
  } catch (error) {
    logger.error({ err: error }, 'Error assigning shop');
    res.status(500).json({ success: false, error: 'Failed to assign shop' });
  }
}

// GET /api/master-plans/:id/demands
export async function listPlanDemands(req: Request, res: Response): Promise<void> {
  try {
    const result = await masterPlanService.listPlanDemands(req.params.id);
    res.json({ success: true, data: result.demands, total: result.total });
  } catch (error) {
    logger.error({ err: error }, 'Error listing plan demands');
    res.status(500).json({ success: false, error: 'Failed to list plan demands' });
  }
}

// POST /api/master-plans/:id/demands
export async function createDemandForPlan(req: Request, res: Response): Promise<void> {
  try {
    const { name, event_type, car_count, target_month, priority, description,
            car_type, default_lessee_code, required_network, required_region,
            max_cost_per_car } = req.body;

    if (!name || !event_type || !car_count) {
      res.status(400).json({
        success: false,
        error: 'name, event_type, and car_count are required',
      });
      return;
    }

    const demand = await masterPlanService.createDemandForPlan(
      req.params.id,
      {
        name,
        event_type,
        car_count,
        target_month,
        priority,
        description,
        car_type,
        default_lessee_code,
        required_network,
        required_region,
        max_cost_per_car,
      },
      req.user?.id
    );

    res.status(201).json({ success: true, data: demand });
  } catch (error: any) {
    logger.error({ err: error }, 'Error creating demand for plan');
    if (error.message === 'Master plan not found') {
      res.status(404).json({ success: false, error: 'Master plan not found' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create demand for plan' });
  }
}

// GET /api/cars-search
export async function searchCars(req: Request, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string) || '';
    const limit = parseInt(req.query.limit as string) || 20;

    if (q.length < 1) {
      res.json({ success: true, data: [] });
      return;
    }

    const cars = await masterPlanService.searchCars(q, Math.min(limit, 50));
    res.json({ success: true, data: cars });
  } catch (error) {
    logger.error({ err: error }, 'Error searching cars');
    res.status(500).json({ success: false, error: 'Failed to search cars' });
  }
}

export default {
  listMasterPlans,
  getMasterPlan,
  createMasterPlan,
  updateMasterPlan,
  deleteMasterPlan,
  listVersions,
  createVersion,
  getVersion,
  getVersionAllocations,
  compareVersions,
  getPlanStats,
  listPlanAllocations,
  addCarsToPlan,
  importFromDemands,
  removeAllocationFromPlan,
  assignShopToAllocation,
  listPlanDemands,
  createDemandForPlan,
  searchCars,
};
