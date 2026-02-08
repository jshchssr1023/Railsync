import { Request, Response } from 'express';
import logger from '../config/logger';
import analyticsService from '../services/analytics.service';
import { ApiResponse } from '../types';

// =============================================================================
// CAPACITY FORECASTING
// =============================================================================

export async function getCapacityForecast(req: Request, res: Response): Promise<void> {
  try {
    const months = parseInt(req.query.months as string) || 6;
    const data = await analyticsService.getCapacityForecast(months);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching capacity forecast');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch capacity forecast',
    } as ApiResponse<null>);
  }
}

export async function getCapacityTrends(req: Request, res: Response): Promise<void> {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const data = await analyticsService.getCapacityTrends(months);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching capacity trends');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch capacity trends',
    } as ApiResponse<null>);
  }
}

export async function getBottleneckShops(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await analyticsService.getBottleneckShops(limit);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching bottleneck shops');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bottleneck shops',
    } as ApiResponse<null>);
  }
}

// =============================================================================
// COST ANALYTICS
// =============================================================================

export async function getCostTrends(req: Request, res: Response): Promise<void> {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const data = await analyticsService.getCostTrends(months);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching cost trends');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cost trends',
    } as ApiResponse<null>);
  }
}

export async function getBudgetComparison(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const data = await analyticsService.getBudgetComparison(fiscalYear);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching budget comparison');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch budget comparison',
    } as ApiResponse<null>);
  }
}

export async function getShopCostComparison(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await analyticsService.getShopCostComparison(limit);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching shop cost comparison');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop cost comparison',
    } as ApiResponse<null>);
  }
}

// =============================================================================
// OPERATIONS KPIs
// =============================================================================

export async function getOperationsKPIs(req: Request, res: Response): Promise<void> {
  try {
    const data = await analyticsService.getOperationsKPIs();

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching operations KPIs');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch operations KPIs',
    } as ApiResponse<null>);
  }
}

export async function getDwellTimeByShop(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 15;
    const data = await analyticsService.getDwellTimeByShop(limit);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching dwell time by shop');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dwell time by shop',
    } as ApiResponse<null>);
  }
}

export async function getThroughputTrends(req: Request, res: Response): Promise<void> {
  try {
    const months = parseInt(req.query.months as string) || 6;
    const data = await analyticsService.getThroughputTrends(months);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching throughput trends');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch throughput trends',
    } as ApiResponse<null>);
  }
}

// =============================================================================
// DEMAND FORECASTING
// =============================================================================

export async function getDemandForecast(req: Request, res: Response): Promise<void> {
  try {
    const months = parseInt(req.query.months as string) || 6;
    const data = await analyticsService.getDemandForecast(months);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching demand forecast');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch demand forecast',
    } as ApiResponse<null>);
  }
}

export async function getDemandByRegion(req: Request, res: Response): Promise<void> {
  try {
    const data = await analyticsService.getDemandByRegion();

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching demand by region');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch demand by region',
    } as ApiResponse<null>);
  }
}

export async function getDemandByCustomer(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await analyticsService.getDemandByCustomer(limit);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching demand by customer');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch demand by customer',
    } as ApiResponse<null>);
  }
}

// =============================================================================
// COST VARIANCE
// =============================================================================

export async function getCostVarianceReport(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const data = await analyticsService.getCostVarianceReport(fiscalYear);
    res.json({ success: true, data } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching cost variance report');
    res.status(500).json({ success: false, error: 'Failed to fetch cost variance report' } as ApiResponse<null>);
  }
}

export async function getCustomerCostBreakdown(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await analyticsService.getCustomerCostBreakdown(fiscalYear, limit);
    res.json({ success: true, data } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching customer cost breakdown');
    res.status(500).json({ success: false, error: 'Failed to fetch customer cost breakdown' } as ApiResponse<null>);
  }
}

// =============================================================================
// SHOP PERFORMANCE
// =============================================================================

export async function getShopPerformanceScores(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const data = await analyticsService.getShopPerformanceScores(limit);
    res.json({ success: true, data } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching shop performance scores');
    res.status(500).json({ success: false, error: 'Failed to fetch shop performance scores' } as ApiResponse<null>);
  }
}

export async function getShopPerformanceTrend(req: Request, res: Response): Promise<void> {
  try {
    const shopCode = req.params.shopCode;
    const months = parseInt(req.query.months as string) || 6;
    const data = await analyticsService.getShopPerformanceTrend(shopCode, months);
    res.json({ success: true, data } as ApiResponse<typeof data>);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching shop performance trend');
    res.status(500).json({ success: false, error: 'Failed to fetch shop performance trend' } as ApiResponse<null>);
  }
}

export default {
  getCapacityForecast,
  getCapacityTrends,
  getBottleneckShops,
  getCostTrends,
  getBudgetComparison,
  getShopCostComparison,
  getOperationsKPIs,
  getDwellTimeByShop,
  getThroughputTrends,
  getDemandForecast,
  getDemandByRegion,
  getDemandByCustomer,
  getCostVarianceReport,
  getCustomerCostBreakdown,
  getShopPerformanceScores,
  getShopPerformanceTrend,
};
