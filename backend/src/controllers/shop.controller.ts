import { Request, Response } from 'express';
import shopModel from '../models/shop.model';
import evaluationService from '../services/evaluation.service';
import { ApiResponse, EvaluationRequest, EvaluationResult, ShopBacklog, ShopCapacity } from '../types';

/**
 * POST /api/shops/evaluate
 * Submit car data + overrides, returns eligible shops with costs
 */
export async function evaluateShops(req: Request, res: Response): Promise<void> {
  try {
    const request: EvaluationRequest = req.body;

    if (!request.car_number) {
      res.status(400).json({
        success: false,
        error: 'car_number is required',
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

export default {
  evaluateShops,
  getShopBacklog,
  listShops,
};
