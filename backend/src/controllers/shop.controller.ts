import { Request, Response } from 'express';
import shopModel from '../models/shop.model';
import evaluationService from '../services/evaluation.service';
import { ApiResponse, EvaluationRequest, EvaluationResult, ShopBacklog, ShopCapacity } from '../types';

/**
 * POST /api/shops/evaluate
 * Submit car data + overrides, returns eligible shops with costs
 * Supports both car_number lookup and direct car_input
 */
export async function evaluateShops(req: Request, res: Response): Promise<void> {
  try {
    const request: EvaluationRequest = req.body;

    // Validation is now handled by middleware, but keep basic check for backward compat
    if (!request.car_number && !request.car_input) {
      res.status(400).json({
        success: false,
        error: 'Either car_number or car_input is required',
      } as ApiResponse<null>);
      return;
    }

    const results = await evaluationService.evaluateShops(request);

    res.json({
      success: true,
      data: results,
      message: `Evaluated ${results.length} shops, ${results.filter(r => r.is_eligible).length} eligible`,
    } as ApiResponse<EvaluationResult[]>);
  } catch (error: any) {
    console.error('Error evaluating shops:', error);

    if (error.message?.includes('Car not found')) {
      res.status(404).json({
        success: false,
        error: error.message,
      } as ApiResponse<null>);
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

/**
 * GET /api/shops/:shopCode/backlog
 * Get current backlog and capacity metrics
 */
export async function getShopBacklog(req: Request, res: Response): Promise<void> {
  try {
    const { shopCode } = req.params;

    if (!shopCode) {
      res.status(400).json({
        success: false,
        error: 'Shop code is required',
      } as ApiResponse<null>);
      return;
    }

    const shop = await shopModel.findByCode(shopCode);

    if (!shop) {
      res.status(404).json({
        success: false,
        error: `Shop not found: ${shopCode}`,
      } as ApiResponse<null>);
      return;
    }

    const [backlog, capacity, capabilities] = await Promise.all([
      shopModel.getBacklog(shopCode),
      shopModel.getCapacity(shopCode),
      shopModel.getCapabilities(shopCode),
    ]);

    res.json({
      success: true,
      data: {
        shop: {
          shop_code: shop.shop_code,
          shop_name: shop.shop_name,
          primary_railroad: shop.primary_railroad,
          region: shop.region,
          labor_rate: shop.labor_rate,
          is_preferred_network: shop.is_preferred_network,
        },
        backlog: backlog || {
          shop_code: shopCode,
          date: new Date(),
          hours_backlog: 0,
          cars_backlog: 0,
          cars_en_route_0_6: 0,
          cars_en_route_7_14: 0,
          cars_en_route_15_plus: 0,
        },
        capacity,
        capabilities: capabilities.reduce((acc, cap) => {
          const key = cap.capability_type;
          if (!acc[key]) acc[key] = [];
          acc[key].push(cap.capability_value);
          return acc;
        }, {} as Record<string, string[]>),
      },
    } as ApiResponse<{
      shop: any;
      backlog: ShopBacklog;
      capacity: ShopCapacity[];
      capabilities: Record<string, string[]>;
    }>);
  } catch (error) {
    console.error('Error fetching shop backlog:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

/**
 * GET /api/shops
 * List all active shops
 */
export async function listShops(req: Request, res: Response): Promise<void> {
  try {
    const shops = await shopModel.findAll(true);

    res.json({
      success: true,
      data: shops.map(shop => ({
        shop_code: shop.shop_code,
        shop_name: shop.shop_name,
        primary_railroad: shop.primary_railroad,
        region: shop.region,
        labor_rate: shop.labor_rate,
        is_preferred_network: shop.is_preferred_network,
      })),
    } as ApiResponse<any[]>);
  } catch (error) {
    console.error('Error listing shops:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

/**
 * PUT /api/shops/:shopCode/backlog
 * Update shop backlog data (for daily feed)
 */
export async function updateShopBacklog(req: Request, res: Response): Promise<void> {
  try {
    const { shopCode } = req.params;
    const backlogData = req.body;

    if (!shopCode) {
      res.status(400).json({
        success: false,
        error: 'Shop code is required',
      } as ApiResponse<null>);
      return;
    }

    const shop = await shopModel.findByCode(shopCode);
    if (!shop) {
      res.status(404).json({
        success: false,
        error: `Shop not found: ${shopCode}`,
      } as ApiResponse<null>);
      return;
    }

    const result = await shopModel.upsertBacklog({
      shop_code: shopCode,
      ...backlogData,
    });

    res.json({
      success: true,
      data: result,
      message: `Backlog updated for shop ${shopCode}`,
    } as ApiResponse<ShopBacklog | null>);
  } catch (error) {
    console.error('Error updating shop backlog:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

/**
 * PUT /api/shops/:shopCode/capacity
 * Update shop capacity data
 */
export async function updateShopCapacity(req: Request, res: Response): Promise<void> {
  try {
    const { shopCode } = req.params;
    const { work_type, weekly_hours_capacity, current_utilization_pct } = req.body;

    if (!shopCode) {
      res.status(400).json({
        success: false,
        error: 'Shop code is required',
      } as ApiResponse<null>);
      return;
    }

    if (!work_type) {
      res.status(400).json({
        success: false,
        error: 'work_type is required',
      } as ApiResponse<null>);
      return;
    }

    const shop = await shopModel.findByCode(shopCode);
    if (!shop) {
      res.status(404).json({
        success: false,
        error: `Shop not found: ${shopCode}`,
      } as ApiResponse<null>);
      return;
    }

    const result = await shopModel.upsertCapacity(
      shopCode,
      work_type,
      weekly_hours_capacity || 0,
      current_utilization_pct || 0
    );

    res.json({
      success: true,
      data: result,
      message: `Capacity updated for shop ${shopCode}, work type ${work_type}`,
    } as ApiResponse<ShopCapacity | null>);
  } catch (error) {
    console.error('Error updating shop capacity:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

/**
 * POST /api/shops/backlog/batch
 * Batch update backlog data for multiple shops (daily feed)
 */
export async function batchUpdateBacklog(req: Request, res: Response): Promise<void> {
  try {
    const { backlogs } = req.body;

    if (!Array.isArray(backlogs) || backlogs.length === 0) {
      res.status(400).json({
        success: false,
        error: 'backlogs array is required',
      } as ApiResponse<null>);
      return;
    }

    const successCount = await shopModel.batchUpsertBacklogs(backlogs);

    res.json({
      success: true,
      data: { updated_count: successCount, total_count: backlogs.length },
      message: `Updated ${successCount} of ${backlogs.length} shop backlogs`,
    } as ApiResponse<{ updated_count: number; total_count: number }>);
  } catch (error) {
    console.error('Error batch updating backlogs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

export default {
  evaluateShops,
  getShopBacklog,
  listShops,
  updateShopBacklog,
  updateShopCapacity,
  batchUpdateBacklog,
};
