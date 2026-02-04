import { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { ApiResponse } from '../types';

// =============================================================================
// CONTRACTS READINESS
// =============================================================================

export async function getContractsReadiness(req: Request, res: Response): Promise<void> {
  try {
    const data = await dashboardService.getContractsReadiness();

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    console.error('Error fetching contracts readiness:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contracts readiness',
    } as ApiResponse<null>);
  }
}

export async function getNeedShoppingAlert(req: Request, res: Response): Promise<void> {
  try {
    const data = await dashboardService.getNeedShoppingAlert();

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    console.error('Error fetching need shopping alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch need shopping alert',
    } as ApiResponse<null>);
  }
}

// =============================================================================
// USER-CENTRIC ACCOUNTABILITY
// =============================================================================

export async function getMyContractsHealth(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      } as ApiResponse<null>);
      return;
    }

    const data = await dashboardService.getMyContractsHealth(userId);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    console.error('Error fetching my contracts health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contracts health',
    } as ApiResponse<null>);
  }
}

export async function getManagerPerformance(req: Request, res: Response): Promise<void> {
  try {
    const data = await dashboardService.getManagerPerformance();

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    console.error('Error fetching manager performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch manager performance',
    } as ApiResponse<null>);
  }
}

// =============================================================================
// OPERATIONAL VELOCITY & EFFICIENCY
// =============================================================================

export async function getDwellTimeHeatmap(req: Request, res: Response): Promise<void> {
  try {
    const data = await dashboardService.getDwellTimeHeatmap();

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    console.error('Error fetching dwell time heatmap:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dwell time heatmap',
    } as ApiResponse<null>);
  }
}

export async function getShopThroughput(req: Request, res: Response): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await dashboardService.getShopThroughput(days);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    console.error('Error fetching shop throughput:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop throughput',
    } as ApiResponse<null>);
  }
}

export async function getUpcomingReleases(req: Request, res: Response): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const data = await dashboardService.getUpcomingReleases(days);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    console.error('Error fetching upcoming releases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming releases',
    } as ApiResponse<null>);
  }
}

// =============================================================================
// FINANCIAL & RISK METRICS
// =============================================================================

export async function getHighCostExceptions(req: Request, res: Response): Promise<void> {
  try {
    const thresholdPct = parseInt(req.query.threshold as string) || 10;
    const data = await dashboardService.getHighCostExceptions(thresholdPct);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    console.error('Error fetching high cost exceptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch high cost exceptions',
    } as ApiResponse<null>);
  }
}

export async function getExpiryForecast(req: Request, res: Response): Promise<void> {
  try {
    const data = await dashboardService.getExpiryForecast();

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    console.error('Error fetching expiry forecast:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expiry forecast',
    } as ApiResponse<null>);
  }
}

export async function getBudgetBurnVelocity(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const data = await dashboardService.getBudgetBurnVelocity(fiscalYear);

    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    console.error('Error fetching budget burn velocity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch budget burn velocity',
    } as ApiResponse<null>);
  }
}

export default {
  getContractsReadiness,
  getNeedShoppingAlert,
  getMyContractsHealth,
  getManagerPerformance,
  getDwellTimeHeatmap,
  getShopThroughput,
  getUpcomingReleases,
  getHighCostExceptions,
  getExpiryForecast,
  getBudgetBurnVelocity,
};
