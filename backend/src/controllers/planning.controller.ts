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

export default {
  getRunningRepairsBudget,
  updateRunningRepairsBudget,
  calculateRunningRepairsBudget,
  getServiceEventBudgets,
  createServiceEventBudget,
  getBudgetSummary,
  listCars,
  getCarById,
  getActiveCarCount,
  importCars,
  getForecast,
  getForecastTrends,
};
