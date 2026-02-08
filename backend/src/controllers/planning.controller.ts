import logger from '../config/logger';
import { Request, Response } from 'express';
import * as budgetService from '../services/budget.service';
import * as carImportService from '../services/carImport.service';
import * as demandService from '../services/demand.service';
import * as planningService from '../services/planning.service';
import * as forecastService from '../services/forecast.service';
import * as brcService from '../services/brc.service';
import * as dashboardService from '../services/dashboard.service';
import { logFromRequest } from '../services/audit.service';
import { EventType, DemandStatus, AllocationStatus } from '../types';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ============================================================================
// BUDGET ENDPOINTS
// ============================================================================

export async function getRunningRepairsBudget(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const budget = await budgetService.getRunningRepairsBudget(fiscalYear);

    res.json({ success: true, data: budget });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get running repairs budget error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function updateRunningRepairsBudget(req: Request, res: Response): Promise<void> {
  try {
    const { month } = req.params;
    const fiscalYear = parseInt(req.query.fiscal_year as string) || parseInt(month.split('-')[0]);
    const budget = await budgetService.updateRunningRepairsBudget(
      fiscalYear,
      month,
      req.body,
      req.user?.id
    );

    await logFromRequest(req, 'update', 'running_repairs_budget', month, undefined, req.body);
    res.json({ success: true, data: budget });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update running repairs budget error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Calculate running repairs budget error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getServiceEventBudgets(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const eventType = req.query.event_type as EventType | undefined;
    const budgets = await budgetService.getServiceEventBudgets(fiscalYear, eventType);

    res.json({ success: true, data: budgets });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get service event budgets error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function createServiceEventBudget(req: Request, res: Response): Promise<void> {
  try {
    const budget = await budgetService.createServiceEventBudget(req.body, req.user?.id);
    await logFromRequest(req, 'create', 'service_event_budget', budget.id);
    res.status(201).json({ success: true, data: budget });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create service event budget error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getBudgetSummary(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const summary = await budgetService.getBudgetSummary(fiscalYear);

    res.json({ success: true, data: summary });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get budget summary error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getActiveLeasedCarCount(_req: Request, res: Response): Promise<void> {
  try {
    const count = await budgetService.getActiveLeasedCarCount();
    res.json({ success: true, data: { count, as_of: new Date().toISOString() } });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get active leased car count error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getHistoricalServiceEvents(_req: Request, res: Response): Promise<void> {
  try {
    const events = await budgetService.getHistoricalServiceEventStats();
    res.json({
      success: true,
      data: {
        events,
        period: 'trailing_12_months',
        as_of: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get historical service events error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function updateServiceEventBudget(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const budget = await budgetService.updateServiceEventBudget(id, req.body);
    if (!budget) {
      res.status(404).json({ success: false, error: 'Service event budget not found' });
      return;
    }
    await logFromRequest(req, 'update', 'service_event_budget', id);
    res.json({ success: true, data: budget });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update service event budget error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function deleteServiceEventBudget(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await budgetService.deleteServiceEventBudget(id);
    await logFromRequest(req, 'delete', 'service_event_budget', id);
    res.json({ success: true, message: 'Service event budget deleted' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete service event budget error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'List cars error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get car error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getActiveCarCount(req: Request, res: Response): Promise<void> {
  try {
    const count = await carImportService.getActiveCarCount();
    res.json({ success: true, data: { count } });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get active car count error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function importCars(req: Request, res: Response): Promise<void> {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const content = file ? file.buffer.toString('utf-8') : req.body.content;

    if (!content) {
      res.status(400).json({ success: false, error: 'CSV content required. Upload a file or provide content in the request body.' });
      return;
    }

    const result = await carImportService.importCarsFromCSV(content);
    await logFromRequest(req, 'create', 'car_import', undefined, undefined, {
      imported: result.imported,
      updated: result.updated,
    });

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import cars error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get forecast error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getForecastTrends(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const trends = await forecastService.getForecastTrends(fiscalYear);
    res.json({ success: true, data: trends });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get forecast trends error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
      status: req.query.status as DemandStatus | undefined,
      event_type: req.query.event_type as EventType | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await demandService.listDemands(filters);
    res.json({ success: true, data: result.demands, total: result.total });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List demands error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get demand error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function createDemand(req: Request, res: Response): Promise<void> {
  try {
    const demand = await demandService.createDemand(req.body, req.user?.id);
    await logFromRequest(req, 'create', 'demand', demand.id);
    res.status(201).json({ success: true, data: demand });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create demand error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update demand error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update demand status error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function deleteDemand(req: Request, res: Response): Promise<void> {
  try {
    await demandService.deleteDemand(req.params.id);
    await logFromRequest(req, 'delete', 'demand', req.params.id);
    res.json({ success: true, message: 'Demand deleted' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete demand error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get capacity error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function updateCapacity(req: Request, res: Response): Promise<void> {
  try {
    const { shopCode, month } = req.params;
    const capacity = await planningService.updateShopCapacity(shopCode, month, req.body);
    await logFromRequest(req, 'update', 'shop_capacity', `${shopCode}:${month}`);
    res.json({ success: true, data: capacity });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update capacity error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function initializeCapacity(req: Request, res: Response): Promise<void> {
  try {
    const { default_capacity } = req.body;
    const count = await planningService.initializeCapacity(default_capacity || 20);
    await logFromRequest(req, 'create', 'shop_capacity', 'bulk');
    res.json({ success: true, data: { initialized: count } });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Initialize capacity error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getCapacityCars(req: Request, res: Response): Promise<void> {
  try {
    const { shopCode, month } = req.params;
    const cars = await planningService.getCarsForShopMonth(shopCode, month);
    res.json({ success: true, data: cars });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get capacity cars error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

// ============================================================================
// SCENARIO ENDPOINTS
// ============================================================================

export async function listScenarios(req: Request, res: Response): Promise<void> {
  try {
    const scenarios = await planningService.listScenarios();
    res.json({ success: true, data: scenarios });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List scenarios error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function createScenario(req: Request, res: Response): Promise<void> {
  try {
    const scenario = await planningService.createScenario(req.body, req.user?.id);
    await logFromRequest(req, 'create', 'scenario', scenario.id);
    res.status(201).json({ success: true, data: scenario });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create scenario error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update scenario error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
      status: req.query.status as AllocationStatus | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await planningService.listAllocations(filters);
    res.json({ success: true, data: result.allocations, total: result.total });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List allocations error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Generate allocations error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update allocation status error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function assignAllocation(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { shop_code, target_month, version } = req.body;

    if (!shop_code || !target_month) {
      res.status(400).json({
        success: false,
        error: 'shop_code and target_month are required',
      });
      return;
    }

    const result = await planningService.assignAllocation(
      id,
      shop_code,
      target_month,
      version
    );

    if (result.error) {
      res.status(result.allocation ? 200 : 409).json({
        success: false,
        error: result.error,
      });
      return;
    }

    await logFromRequest(req, 'update', 'allocation', id, undefined, {
      shop_code,
      target_month,
      action: 'assign',
    });

    res.json({ success: true, data: result.allocation });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Assign allocation error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function createAllocation(req: Request, res: Response): Promise<void> {
  try {
    const {
      car_id,
      car_number,
      shop_code,
      target_month,
      status,
      estimated_cost,
      estimated_cost_breakdown,
      service_event_id,
      notes,
    } = req.body;

    if (!car_id || !shop_code || !target_month || !status) {
      res.status(400).json({
        success: false,
        error: 'car_id, shop_code, target_month, and status are required',
      });
      return;
    }

    if (!['planned', 'confirmed'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'status must be "planned" or "confirmed"',
      });
      return;
    }

    const allocation = await planningService.createAllocation({
      car_mark_number: car_id,
      car_number,
      shop_code,
      target_month,
      status,
      estimated_cost,
      estimated_cost_breakdown,
      service_event_id,
      notes,
      created_by: req.user?.id,
    });

    await logFromRequest(req, 'create', 'allocation', allocation.id, undefined, {
      shop_code,
      status,
      target_month,
    });

    res.status(201).json({ success: true, data: allocation });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create allocation error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getShopMonthlyCapacity(req: Request, res: Response): Promise<void> {
  try {
    const { shopCode } = req.params;
    const months = req.query.months ? parseInt(req.query.months as string) : 3;

    const capacity = await planningService.getShopCapacityRange(shopCode, months);

    res.json({ success: true, data: capacity });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get shop monthly capacity error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

// ============================================================================
// BRC IMPORT ENDPOINTS
// ============================================================================

export async function importBRC(req: Request, res: Response): Promise<void> {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const content = file ? file.buffer : req.body.content;
    const filename = file ? file.originalname : (req.body.filename || 'upload.brc');

    if (!content) {
      res.status(400).json({ success: false, error: 'BRC content required. Upload a file or provide content in the request body.' });
      return;
    }

    const result = await brcService.importBRCFile(content, filename, req.user?.id);
    await logFromRequest(req, 'create', 'brc_import', result.id, undefined, {
      matched: result.matched_to_allocation,
      running_repairs: result.created_running_repair,
    });

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import BRC error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getBRCHistory(req: Request, res: Response): Promise<void> {
  try {
    const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
    const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const history = await brcService.getBRCHistory(startDate, endDate, limit);
    res.json({ success: true, data: history });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get BRC history error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

// ============================================================================
// DASHBOARD ENDPOINTS
// ============================================================================

export async function listWidgets(req: Request, res: Response): Promise<void> {
  try {
    const widgets = await dashboardService.listWidgets();
    res.json({ success: true, data: widgets });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List widgets error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function listDashboardConfigs(req: Request, res: Response): Promise<void> {
  try {
    const configs = await dashboardService.listDashboardConfigs(req.user!.id);
    res.json({ success: true, data: configs });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List dashboard configs error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getDashboardConfig(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const config = await dashboardService.getDashboardConfig(id, req.user!.id);
    if (!config) {
      res.status(404).json({ success: false, error: 'Dashboard config not found' });
      return;
    }
    res.json({ success: true, data: config });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get dashboard config error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function createDashboardConfig(req: Request, res: Response): Promise<void> {
  try {
    const { name, layout, is_default } = req.body;
    const config = await dashboardService.createDashboardConfig(
      req.user!.id,
      name,
      layout || dashboardService.getDefaultLayout(),
      is_default
    );
    await logFromRequest(req, 'create', 'dashboard_config', config.id, undefined, { name });
    res.status(201).json({ success: true, data: config });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create dashboard config error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function updateDashboardConfig(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const config = await dashboardService.updateDashboardConfig(id, req.user!.id, req.body);
    if (!config) {
      res.status(404).json({ success: false, error: 'Dashboard config not found' });
      return;
    }
    await logFromRequest(req, 'update', 'dashboard_config', id, undefined, req.body);
    res.json({ success: true, data: config });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update dashboard config error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function deleteDashboardConfig(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deleted = await dashboardService.deleteDashboardConfig(id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Dashboard config not found' });
      return;
    }
    await logFromRequest(req, 'delete', 'dashboard_config', id);
    res.json({ success: true, message: 'Dashboard config deleted' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete dashboard config error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export default {
  // Budget
  getRunningRepairsBudget,
  updateRunningRepairsBudget,
  calculateRunningRepairsBudget,
  getServiceEventBudgets,
  createServiceEventBudget,
  updateServiceEventBudget,
  deleteServiceEventBudget,
  getBudgetSummary,
  getActiveLeasedCarCount,
  getHistoricalServiceEvents,
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
  getCapacityCars,
  updateCapacity,
  initializeCapacity,
  // Scenarios
  listScenarios,
  createScenario,
  updateScenario,
  // Allocations
  listAllocations,
  createAllocation,
  generateAllocations,
  updateAllocationStatus,
  assignAllocation,
  getShopMonthlyCapacity,
  // BRC
  importBRC,
  getBRCHistory,
  // Dashboard
  listWidgets,
  listDashboardConfigs,
  getDashboardConfig,
  createDashboardConfig,
  updateDashboardConfig,
  deleteDashboardConfig,
};
