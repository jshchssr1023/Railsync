import { Request, Response } from 'express';
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
    console.error('Error listing master plans:', error);
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
    console.error('Error getting master plan:', error);
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
    console.error('Error creating master plan:', error);
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
    console.error('Error updating master plan:', error);
    res.status(500).json({ success: false, error: 'Failed to update master plan' });
  }
}

// DELETE /api/master-plans/:id
export async function deleteMasterPlan(req: Request, res: Response): Promise<void> {
  try {
    await masterPlanService.deleteMasterPlan(req.params.id);
    res.json({ success: true, message: 'Master plan deleted' });
  } catch (error) {
    console.error('Error deleting master plan:', error);
    res.status(500).json({ success: false, error: 'Failed to delete master plan' });
  }
}

// GET /api/master-plans/:id/versions
export async function listVersions(req: Request, res: Response): Promise<void> {
  try {
    const versions = await masterPlanService.listPlanVersions(req.params.id);
    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('Error listing versions:', error);
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
    console.error('Error creating version:', error);
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
    console.error('Error getting version:', error);
    res.status(500).json({ success: false, error: 'Failed to get version' });
  }
}

// GET /api/master-plans/versions/:versionId/allocations
export async function getVersionAllocations(req: Request, res: Response): Promise<void> {
  try {
    const allocations = await masterPlanService.getVersionAllocations(req.params.versionId);
    res.json({ success: true, data: allocations });
  } catch (error) {
    console.error('Error getting version allocations:', error);
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
    console.error('Error comparing versions:', error);
    res.status(500).json({ success: false, error: 'Failed to compare versions' });
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
};
