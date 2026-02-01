import { Request, Response } from 'express';
import * as budgetService from '../services/budget.service';
import * as carImportService from '../services/carImport.service';
import * as demandService from '../services/demand.service';
import * as planningService from '../services/planning.service';
import * as forecastService from '../services/forecast.service';
import * as brcService from '../services/brc.service';
import { logFromRequest } from '../services/audit.service';

// ============================================================================
// BUDGET ENDPOINTS
// ============================================================================

export async function getRunningRepairsBudget(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const budget = await budgetService.getRunningRepairsBudget(fiscalYear);

    res.json({ success: true, data: budget });
  } catch (error: any) {
    console.error('Get running repairs budget error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateRunningRepairsBudget(req: Request, res: Response): Promise<void> {
  try {
    const { month } = req.params;
    const fiscalYear = parseInt(month.split('-')[0]);
    const budget = await budgetService.updateRunningRepairsBudget(
      fiscalYear,
      month,
      req.body,
      req.user?.id
    );

    await logFromRequest(req, 'update', 'running_repairs_budget', month, undefined, req.body);
    res.json({ success: true, data: budget });
  } catch (error: any) {
    console.error('Update running repairs budget error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function calculateRunningRepairsBudget(req: Request, res: Response): Promise<void> {
  try {
    const { fiscal_year, allocation_per_car } = req.body;
    const budget = await budgetService.calculateRunningRepairsBudget(
      fiscal_year || new Date().getFullYear(),
      allocation_per_car || 150,
      req.user?.id
    );

    await logFromRequest(req, 'create', 'running_repairs_budget', String(fiscal_year));
    res.json({ success: true, data: budget });
  } catch (error: any) {
    console.error('Calculate running repairs budget error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getServiceEventBudgets(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const eventType = req.query.event_type as any;
    const budgets = await budgetService.getServiceEventBudgets(fiscalYear, eventType);

    res.json({ success: true, data: budgets });
  } catch (error: any) {
    console.error('Get service event budgets error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createServiceEventBudget(req: Request, res: Response): Promise<void> {
  try {
    const budget = await budgetService.createServiceEventBudget(req.body, req.user?.id);
    await logFromRequest(req, 'create', 'service_event_budget', budget.id);
    res.status(201).json({ success: true, data: budget });
  } catch (error: any) {
    console.error('Create service event budget error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getBudgetSummary(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const summary = await budgetService.getBudgetSummary(fiscalYear);

    res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('Get budget summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// CAR ENDPOINTS
// ============================================================================

export async function listCars(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      portfolio_status: req.query.portfolio_status as string,
      current_status: req.query.current_status as string,
      lessee_code: req.query.lessee_code as string,
      car_type: req.query.car_type as string,
      tank_qual_year: req.query.tank_qual_year ? parseInt(req.query.tank_qual_year as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await carImportService.listCars(filters);
    res.json({ success: true, data: result.cars, total: result.total });
  } catch (error: any) {
    console.error('List cars error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getCarById(req: Request, res: Response): Promise<void> {
  try {
    const car = await carImportService.getCarById(req.params.carId);
    if (!car) {
      res.status(404).json({ success: false, error: 'Car not found' });
      return;
    }
    res.json({ success: true, data: car });
  } catch (error: any) {
    console.error('Get car error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getActiveCarCount(req: Request, res: Response): Promise<void> {
  try {
    const count = await carImportService.getActiveCarCount();
    res.json({ success: true, data: { count } });
  } catch (error: any) {
    console.error('Get active car count error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function importCars(req: Request, res: Response): Promise<void> {
  try {
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ success: false, error: 'CSV content required' });
      return;
    }

    const result = await carImportService.importCarsFromCSV(content);
    await logFromRequest(req, 'create', 'car_import', undefined, undefined, {
      imported: result.imported,
      updated: result.updated,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Import cars error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// FORECAST ENDPOINTS
// ============================================================================

export async function getForecast(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const forecast = await forecastService.getMaintenanceForecast(fiscalYear);
    res.json({ success: true, data: forecast });
  } catch (error: any) {
    console.error('Get forecast error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getForecastTrends(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const trends = await forecastService.getForecastTrends(fiscalYear);
    res.json({ success: true, data: trends });
  } catch (error: any) {
    console.error('Get forecast trends error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// DEMAND ENDPOINTS
// ============================================================================

export async function listDemands(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      fiscal_year: req.query.fiscal_year ? parseInt(req.query.fiscal_year as string) : undefined,
      target_month: req.query.target_month as string,
      status: req.query.status as any,
      event_type: req.query.event_type as any,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await demandService.listDemands(filters);
    res.json({ success: true, data: result.demands, total: result.total });
  } catch (error: any) {
    console.error('List demands error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getDemandById(req: Request, res: Response): Promise<void> {
  try {
    const demand = await demandService.getDemandById(req.params.id);
    if (!demand) {
      res.status(404).json({ success: false, error: 'Demand not found' });
      return;
    }
    res.json({ success: true, data: demand });
  } catch (error: any) {
    console.error('Get demand error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createDemand(req: Request, res: Response): Promise<void> {
  try {
    const demand = await demandService.createDemand(req.body, req.user?.id);
    await logFromRequest(req, 'create', 'demand', demand.id);
    res.status(201).json({ success: true, data: demand });
  } catch (error: any) {
    console.error('Create demand error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateDemand(req: Request, res: Response): Promise<void> {
  try {
    const demand = await demandService.updateDemand(req.params.id, req.body);
    if (!demand) {
      res.status(404).json({ success: false, error: 'Demand not found' });
      return;
    }
    await logFromRequest(req, 'update', 'demand', demand.id);
    res.json({ success: true, data: demand });
  } catch (error: any) {
    console.error('Update demand error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateDemandStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    const demand = await demandService.updateDemandStatus(req.params.id, status);
    if (!demand) {
      res.status(404).json({ success: false, error: 'Demand not found' });
      return;
    }
    await logFromRequest(req, 'update', 'demand', demand.id, undefined, { status });
    res.json({ success: true, data: demand });
  } catch (error: any) {
    console.error('Update demand status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteDemand(req: Request, res: Response): Promise<void> {
  try {
    await demandService.deleteDemand(req.params.id);
    await logFromRequest(req, 'delete', 'demand', req.params.id);
    res.json({ success: true, message: 'Demand deleted' });
  } catch (error: any) {
    console.error('Delete demand error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// CAPACITY ENDPOINTS
// ============================================================================

export async function getCapacity(req: Request, res: Response): Promise<void> {
  try {
    const startMonth = req.query.start_month as string;
    const endMonth = req.query.end_month as string;
    const network = req.query.network as string;

    if (!startMonth || !endMonth) {
      res.status(400).json({ success: false, error: 'start_month and end_month required' });
      return;
    }

    const capacity = await planningService.getShopCapacity(startMonth, endMonth, network);
    res.json({ success: true, data: capacity });
  } catch (error: any) {
    console.error('Get capacity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateCapacity(req: Request, res: Response): Promise<void> {
  try {
    const { shopCode, month } = req.params;
    const capacity = await planningService.updateShopCapacity(shopCode, month, req.body);
    await logFromRequest(req, 'update', 'shop_capacity', `${shopCode}:${month}`);
    res.json({ success: true, data: capacity });
  } catch (error: any) {
    console.error('Update capacity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function initializeCapacity(req: Request, res: Response): Promise<void> {
  try {
    const { default_capacity } = req.body;
    const count = await planningService.initializeCapacity(default_capacity || 20);
    await logFromRequest(req, 'create', 'shop_capacity', 'bulk');
    res.json({ success: true, data: { initialized: count } });
  } catch (error: any) {
    console.error('Initialize capacity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// SCENARIO ENDPOINTS
// ============================================================================

export async function listScenarios(req: Request, res: Response): Promise<void> {
  try {
    const scenarios = await planningService.listScenarios();
    res.json({ success: true, data: scenarios });
  } catch (error: any) {
    console.error('List scenarios error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createScenario(req: Request, res: Response): Promise<void> {
  try {
    const scenario = await planningService.createScenario(req.body, req.user?.id);
    await logFromRequest(req, 'create', 'scenario', scenario.id);
    res.status(201).json({ success: true, data: scenario });
  } catch (error: any) {
    console.error('Create scenario error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateScenario(req: Request, res: Response): Promise<void> {
  try {
    const scenario = await planningService.updateScenario(req.params.id, req.body);
    if (!scenario) {
      res.status(404).json({ success: false, error: 'Scenario not found or is system-defined' });
      return;
    }
    await logFromRequest(req, 'update', 'scenario', scenario.id);
    res.json({ success: true, data: scenario });
  } catch (error: any) {
    console.error('Update scenario error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// ALLOCATION ENDPOINTS
// ============================================================================

export async function listAllocations(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      demand_id: req.query.demand_id as string,
      shop_code: req.query.shop_code as string,
      target_month: req.query.target_month as string,
      status: req.query.status as any,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await planningService.listAllocations(filters);
    res.json({ success: true, data: result.allocations, total: result.total });
  } catch (error: any) {
    console.error('List allocations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function generateAllocations(req: Request, res: Response): Promise<void> {
  try {
    const { demand_ids, scenario_id, preview_only } = req.body;

    if (!demand_ids || !Array.isArray(demand_ids) || demand_ids.length === 0) {
      res.status(400).json({ success: false, error: 'demand_ids array required' });
      return;
    }

    const result = await planningService.generateAllocations(
      { demand_ids, scenario_id, preview_only },
      req.user?.id
    );

    if (!preview_only) {
      await logFromRequest(req, 'create', 'allocations', 'batch', undefined, {
        demand_ids,
        total_cars: result.summary.total_cars,
      });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Generate allocations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateAllocationStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    const allocation = await planningService.updateAllocationStatus(req.params.id, status);
    if (!allocation) {
      res.status(404).json({ success: false, error: 'Allocation not found' });
      return;
    }
    await logFromRequest(req, 'update', 'allocation', allocation.id, undefined, { status });
    res.json({ success: true, data: allocation });
  } catch (error: any) {
    console.error('Update allocation status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================================
// BRC IMPORT ENDPOINTS
// ============================================================================

export async function importBRC(req: Request, res: Response): Promise<void> {
  try {
    const { content, filename } = req.body;
    if (!content) {
      res.status(400).json({ success: false, error: 'BRC content required' });
      return;
    }

    const result = await brcService.importBRCFile(content, filename || 'upload.brc', req.user?.id);
    await logFromRequest(req, 'create', 'brc_import', result.id, undefined, {
      matched: result.matched_to_allocation,
      running_repairs: result.created_running_repair,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Import BRC error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getBRCHistory(req: Request, res: Response): Promise<void> {
  try {
    const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
    const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const history = await brcService.getBRCHistory(startDate, endDate, limit);
    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Get BRC history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  // Budget
  getRunningRepairsBudget,
  updateRunningRepairsBudget,
  calculateRunningRepairsBudget,
  getServiceEventBudgets,
  createServiceEventBudget,
  getBudgetSummary,
  // Cars
  listCars,
  getCarById,
  getActiveCarCount,
  importCars,
  // Forecast
  getForecast,
  getForecastTrends,
  // Demands
  listDemands,
  getDemandById,
  createDemand,
  updateDemand,
  updateDemandStatus,
  deleteDemand,
  // Capacity
  getCapacity,
  updateCapacity,
  initializeCapacity,
  // Scenarios
  listScenarios,
  createScenario,
  updateScenario,
  // Allocations
  listAllocations,
  generateAllocations,
  updateAllocationStatus,
  // BRC
  importBRC,
  getBRCHistory,
};
