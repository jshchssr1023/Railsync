import { Request, Response } from 'express';
import logger from '../config/logger';
import shopModel from '../models/shop.model';
import evaluationService from '../services/evaluation.service';
import * as assignmentService from '../services/assignment.service';
import { ApiResponse, EvaluationRequest, EvaluationResult, ShopBacklog, ShopCapacity, ServiceEvent } from '../types';
import { query, queryOne } from '../config/database';
import { logFromRequest } from '../services/audit.service';

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
    logger.error({ err: error }, 'Error evaluating shops');

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
    logger.error({ err: error }, 'Error fetching shop backlog');
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
    logger.error({ err: error }, 'Error listing shops');
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
    logger.error({ err: error }, 'Error updating shop backlog');
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
    logger.error({ err: error }, 'Error updating shop capacity');
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
    logger.error({ err: error }, 'Error batch updating backlogs');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
}

// ============================================================================
// SERVICE EVENT ENDPOINTS
// ============================================================================

/**
 * POST /api/service-events
 * Create a new service event (select shop for car)
 */
export async function createServiceEvent(req: Request, res: Response): Promise<void> {
  try {
    const {
      car_number,
      assigned_shop,
      car_input,
      evaluation_result,
      overrides,
      notes,
    } = req.body;

    if (!car_number && !car_input?.product_code) {
      res.status(400).json({
        success: false,
        error: 'Either car_number or car_input with product_code is required',
      });
      return;
    }

    if (!assigned_shop) {
      res.status(400).json({
        success: false,
        error: 'assigned_shop is required',
      });
      return;
    }

    // Verify shop exists
    const shop = await shopModel.findByCode(assigned_shop);
    if (!shop) {
      res.status(404).json({
        success: false,
        error: `Shop not found: ${assigned_shop}`,
      });
      return;
    }

    // Check for conflicts with SSOT before creating
    const carNum = car_number || car_input?.product_code || 'DIRECT_INPUT';
    const conflict = await assignmentService.checkConflicts(carNum);

    if (conflict) {
      res.status(409).json({
        success: false,
        error: 'Conflict detected',
        conflict: {
          type: conflict.type,
          message: conflict.message,
          existing_assignment: conflict.existing_assignment,
        },
      });
      return;
    }

    // Write to SSOT (car_assignments) - this is now the source of truth
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    let assignment;
    try {
      assignment = await assignmentService.createAssignment({
        car_number: carNum,
        shop_code: assigned_shop,
        target_month: currentMonth,
        estimated_cost: evaluation_result?.cost_breakdown?.total_cost || undefined,
        source: 'quick_shop',
        created_by_id: req.user?.id,
      });
    } catch (err) {
      logger.error({ err: err }, 'Failed to create SSOT assignment');
      // Continue with legacy flow if SSOT fails (shouldn't happen)
    }

    // Legacy: Also insert into service_events for backward compatibility
    const result = await queryOne<ServiceEvent>(
      `INSERT INTO service_events (
         car_number, event_type, status, assigned_shop, estimated_cost,
         override_exterior_paint, override_new_lining, override_interior_blast,
         override_kosher_cleaning, override_primary_network,
         car_input, evaluation_result, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        carNum,
        'shop_assignment',
        'pending',
        assigned_shop,
        evaluation_result?.cost_breakdown?.total_cost || null,
        overrides?.exterior_paint || false,
        overrides?.new_lining || false,
        overrides?.interior_blast || false,
        overrides?.kosher_cleaning || false,
        overrides?.primary_network || false,
        car_input ? JSON.stringify(car_input) : null,
        evaluation_result ? JSON.stringify(evaluation_result) : null,
        notes || null,
        req.user?.id || null,
      ]
    );

    // Audit log
    await logFromRequest(req, 'shop_select', 'car_assignment', assignment?.id || result?.event_id, undefined, {
      car_number: carNum,
      assigned_shop,
      estimated_cost: evaluation_result?.cost_breakdown?.total_cost,
      ssot_assignment_id: assignment?.id,
    });

    res.status(201).json({
      success: true,
      data: result,
      assignment: assignment, // Include SSOT assignment in response
      message: `Service event created for car ${carNum} at shop ${assigned_shop}`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error creating service event');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * GET /api/service-events
 * List service events with filters
 */
export async function listServiceEvents(req: Request, res: Response): Promise<void> {
  try {
    const {
      status,
      assigned_shop,
      car_number,
      limit = '50',
      offset = '0',
    } = req.query;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status as string);
    }

    if (assigned_shop) {
      conditions.push(`assigned_shop = $${paramIndex++}`);
      params.push(assigned_shop as string);
    }

    if (car_number) {
      conditions.push(`car_number ILIKE $${paramIndex++}`);
      params.push(`%${car_number}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    const events = await query<ServiceEvent>(
      `SELECT se.*, s.shop_name, u.email as created_by_email
       FROM service_events se
       LEFT JOIN shops s ON se.assigned_shop = s.shop_code
       LEFT JOIN users u ON se.created_by = u.id
       ${whereClause}
       ORDER BY se.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limitNum, offsetNum]
    );

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM service_events ${whereClause}`,
      params
    );
    const total = countResult ? parseInt(countResult.count, 10) : 0;

    res.json({
      success: true,
      data: events,
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error listing service events');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * GET /api/service-events/:eventId
 * Get service event details
 */
export async function getServiceEvent(req: Request, res: Response): Promise<void> {
  try {
    const { eventId } = req.params;

    const event = await queryOne<ServiceEvent & { shop_name: string; created_by_email: string }>(
      `SELECT se.*, s.shop_name, u.email as created_by_email
       FROM service_events se
       LEFT JOIN shops s ON se.assigned_shop = s.shop_code
       LEFT JOIN users u ON se.created_by = u.id
       WHERE se.event_id = $1`,
      [eventId]
    );

    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Service event not found',
      });
      return;
    }

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching service event');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * PUT /api/service-events/:eventId/status
 * Update service event status
 */
export async function updateServiceEventStatus(req: Request, res: Response): Promise<void> {
  try {
    const { eventId } = req.params;
    const { status, actual_cost, notes } = req.body;

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    // Get current state for audit
    const current = await queryOne<ServiceEvent>(
      'SELECT * FROM service_events WHERE event_id = $1',
      [eventId]
    );

    if (!current) {
      res.status(404).json({
        success: false,
        error: 'Service event not found',
      });
      return;
    }

    const result = await queryOne<ServiceEvent>(
      `UPDATE service_events
       SET status = $1,
           actual_cost = COALESCE($2, actual_cost),
           notes = COALESCE($3, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE event_id = $4
       RETURNING *`,
      [status, actual_cost, notes, eventId]
    );

    // Audit log
    await logFromRequest(
      req,
      'update',
      'service_event',
      eventId,
      { status: current.status, actual_cost: current.actual_cost },
      { status, actual_cost }
    );

    res.json({
      success: true,
      data: result,
      message: `Service event status updated to ${status}`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error updating service event status');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

export default {
  evaluateShops,
  getShopBacklog,
  listShops,
  updateShopBacklog,
  updateShopCapacity,
  batchUpdateBacklog,
  createServiceEvent,
  listServiceEvents,
  getServiceEvent,
  updateServiceEventStatus,
};
