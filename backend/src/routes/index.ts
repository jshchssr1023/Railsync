import { Router } from 'express';
import carController from '../controllers/car.controller';
import shopController from '../controllers/shop.controller';
import ruleController from '../controllers/rule.controller';
import * as authController from '../controllers/auth.controller';
import planningController from '../controllers/planning.controller';
import { validateEvaluationRequest } from '../middleware/validation';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';

const router = Router();

// ============================================================================
// AUTH ROUTES (Public)
// ============================================================================

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT tokens
 * @access  Public
 */
router.post('/auth/login', authController.login);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (viewer role)
 * @access  Public
 */
router.post('/auth/register', authController.register);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/auth/refresh', authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout and revoke all user tokens
 * @access  Protected
 */
router.post('/auth/logout', authenticate, authController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user info
 * @access  Protected
 */
router.get('/auth/me', authenticate, authController.me);

// ============================================================================
// CAR ROUTES
// ============================================================================

/**
 * @route   GET /api/cars/:carNumber
 * @desc    Retrieve car attributes and active service event
 * @access  Public (optionally authenticated for audit)
 */
router.get('/cars/:carNumber', optionalAuth, carController.getCarByNumber);

// ============================================================================
// SHOP ROUTES
// ============================================================================

/**
 * @route   GET /api/shops
 * @desc    List all active shops
 * @access  Public
 */
router.get('/shops', shopController.listShops);

/**
 * @route   POST /api/shops/evaluate
 * @desc    Submit car data + overrides, returns eligible shops with costs
 * @access  Public (optionally authenticated for audit)
 *
 * @body    {
 *            // Option 1: Lookup by car number
 *            car_number?: string,
 *
 *            // Option 2: Direct car input (Phase 3)
 *            car_input?: {
 *              product_code: string,
 *              stencil_class?: string,
 *              material_type?: 'Carbon Steel' | 'Stainless' | 'Aluminum',
 *              commodity_cin?: string,
 *              lining_type?: string,
 *              nitrogen_pad_stage?: number (0-9),
 *              has_asbestos?: boolean,
 *              asbestos_abatement_required?: boolean,
 *              hm201_due?: boolean,
 *              non_hm201_due?: boolean,
 *              railroad_damage?: boolean
 *            },
 *
 *            overrides?: {
 *              exterior_paint?: boolean,
 *              new_lining?: boolean,
 *              interior_blast?: boolean,
 *              kosher_cleaning?: boolean,
 *              primary_network?: boolean,
 *              blast_type?: 'Brush' | 'Commercial' | 'WhiteMetal' | 'None',
 *              lining_type?: string
 *            },
 *            origin_region?: string
 *          }
 */
router.post('/shops/evaluate', optionalAuth, validateEvaluationRequest, shopController.evaluateShops);

/**
 * @route   GET /api/shops/:shopCode/backlog
 * @desc    Get current backlog and capacity metrics
 * @access  Public
 */
router.get('/shops/:shopCode/backlog', shopController.getShopBacklog);

/**
 * @route   PUT /api/shops/:shopCode/backlog
 * @desc    Update shop backlog data (for daily feed)
 * @access  Protected - Operator or Admin
 *
 * @body    {
 *            hours_backlog?: number,
 *            cars_backlog?: number,
 *            cars_en_route_0_6?: number,
 *            cars_en_route_7_14?: number,
 *            cars_en_route_15_plus?: number,
 *            weekly_inbound?: number,
 *            weekly_outbound?: number,
 *            date?: string (ISO date, defaults to today)
 *          }
 */
router.put('/shops/:shopCode/backlog', authenticate, authorize('admin', 'operator'), shopController.updateShopBacklog);

/**
 * @route   PUT /api/shops/:shopCode/capacity
 * @desc    Update shop capacity data
 * @access  Protected - Operator or Admin
 *
 * @body    {
 *            work_type: string (cleaning|flare|mechanical|blast|lining|paint),
 *            weekly_hours_capacity: number,
 *            current_utilization_pct: number
 *          }
 */
router.put('/shops/:shopCode/capacity', authenticate, authorize('admin', 'operator'), shopController.updateShopCapacity);

/**
 * @route   POST /api/shops/backlog/batch
 * @desc    Batch update backlog data for multiple shops (daily feed)
 * @access  Protected - Operator or Admin
 *
 * @body    {
 *            backlogs: [{
 *              shop_code: string,
 *              hours_backlog?: number,
 *              cars_backlog?: number,
 *              ...
 *            }]
 *          }
 */
router.post('/shops/backlog/batch', authenticate, authorize('admin', 'operator'), shopController.batchUpdateBacklog);

// ============================================================================
// RULE ROUTES
// ============================================================================

/**
 * @route   GET /api/rules
 * @desc    List all eligibility rules with status
 * @access  Public (view rules)
 *
 * @query   active: 'true' | 'false' (default: 'true')
 */
router.get('/rules', ruleController.listRules);

/**
 * @route   GET /api/rules/:ruleId
 * @desc    Get a specific rule by ID
 * @access  Public
 */
router.get('/rules/:ruleId', ruleController.getRuleById);

/**
 * @route   PUT /api/rules/:ruleId
 * @desc    Update rule configuration
 * @access  Protected - Admin only
 *
 * @body    {
 *            rule_name?: string,
 *            rule_description?: string,
 *            condition_json?: object,
 *            priority?: number,
 *            is_active?: boolean,
 *            is_blocking?: boolean
 *          }
 */
router.put('/rules/:ruleId', authenticate, authorize('admin'), ruleController.updateRule);

/**
 * @route   POST /api/rules
 * @desc    Create a new rule
 * @access  Protected - Admin only
 *
 * @body    {
 *            rule_id: string,
 *            rule_name: string,
 *            rule_category: string,
 *            rule_description?: string,
 *            condition_json: object,
 *            priority?: number,
 *            is_active?: boolean,
 *            is_blocking?: boolean
 *          }
 */
router.post('/rules', authenticate, authorize('admin'), ruleController.createRule);

// ============================================================================
// SERVICE EVENT ROUTES (Select This Shop feature)
// ============================================================================

/**
 * @route   POST /api/service-events
 * @desc    Create a new service event (select shop for car)
 * @access  Protected - Any authenticated user
 */
router.post('/service-events', authenticate, shopController.createServiceEvent);

/**
 * @route   GET /api/service-events
 * @desc    List service events (with filters)
 * @access  Protected
 */
router.get('/service-events', authenticate, shopController.listServiceEvents);

/**
 * @route   GET /api/service-events/:eventId
 * @desc    Get service event details
 * @access  Protected
 */
router.get('/service-events/:eventId', authenticate, shopController.getServiceEvent);

/**
 * @route   PUT /api/service-events/:eventId/status
 * @desc    Update service event status
 * @access  Protected - Operator or Admin
 */
router.put('/service-events/:eventId/status', authenticate, authorize('admin', 'operator'), shopController.updateServiceEventStatus);

// ============================================================================
// AUDIT LOG ROUTES (Admin only)
// ============================================================================

/**
 * @route   GET /api/audit-logs
 * @desc    Query audit logs with filters
 * @access  Protected - Admin only
 */
router.get('/audit-logs', authenticate, authorize('admin'), async (req, res) => {
  const { queryAuditLogs } = await import('../services/audit.service');

  try {
    const filters = {
      userId: req.query.user_id as string | undefined,
      action: req.query.action as string | undefined,
      entityType: req.query.entity_type as string | undefined,
      entityId: req.query.entity_id as string | undefined,
      startDate: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
      endDate: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const result = await queryAuditLogs(filters);

    res.json({
      success: true,
      data: result.logs,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (error) {
    console.error('Audit log query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query audit logs',
    });
  }
});

// ============================================================================
// ADMIN USER MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   GET /api/admin/users
 * @desc    List all users
 * @access  Protected - Admin only
 */
router.get('/admin/users', authenticate, authorize('admin'), async (req, res) => {
  const { listUsers } = await import('../models/user.model');

  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await listUsers(limit, offset);

    res.json({
      success: true,
      data: result.users,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list users',
    });
  }
});

/**
 * @route   PUT /api/admin/users/:userId/role
 * @desc    Update user role
 * @access  Protected - Admin only
 */
router.put('/admin/users/:userId/role', authenticate, authorize('admin'), async (req, res) => {
  const { updateUserRole } = await import('../models/user.model');
  const { logFromRequest } = await import('../services/audit.service');

  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'operator', 'viewer'].includes(role)) {
      res.status(400).json({
        success: false,
        error: 'Invalid role',
        message: 'Role must be one of: admin, operator, viewer',
      });
      return;
    }

    const user = await updateUserRole(userId, role);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    await logFromRequest(req, 'update', 'user', userId, undefined, { role });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role',
    });
  }
});

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Deactivate user
 * @access  Protected - Admin only
 */
router.delete('/admin/users/:userId', authenticate, authorize('admin'), async (req, res) => {
  const { deactivateUser } = await import('../models/user.model');
  const { logFromRequest } = await import('../services/audit.service');

  try {
    const { userId } = req.params;

    // Prevent self-deactivation
    if (userId === req.user?.id) {
      res.status(400).json({
        success: false,
        error: 'Cannot deactivate yourself',
      });
      return;
    }

    await deactivateUser(userId);
    await logFromRequest(req, 'delete', 'user', userId);

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate user',
    });
  }
});

// ============================================================================
// PHASE 9 - BUDGET ROUTES
// ============================================================================

router.get('/budget/running-repairs', authenticate, planningController.getRunningRepairsBudget);
router.put('/budget/running-repairs/:month', authenticate, authorize('admin', 'operator'), planningController.updateRunningRepairsBudget);
router.post('/budget/running-repairs/calculate', authenticate, authorize('admin'), planningController.calculateRunningRepairsBudget);
router.get('/budget/service-events', authenticate, planningController.getServiceEventBudgets);
router.post('/budget/service-events', authenticate, authorize('admin', 'operator'), planningController.createServiceEventBudget);
router.get('/budget/summary', authenticate, planningController.getBudgetSummary);

// ============================================================================
// PHASE 9 - CAR MASTER ROUTES
// ============================================================================

router.get('/cars-master', authenticate, planningController.listCars);
router.get('/cars-master/:carId', authenticate, planningController.getCarById);
router.get('/cars/active-count', authenticate, planningController.getActiveCarCount);
router.post('/cars/import', authenticate, authorize('admin'), planningController.importCars);

// ============================================================================
// PHASE 9 - FORECAST ROUTES
// ============================================================================

router.get('/forecast', authenticate, planningController.getForecast);
router.get('/forecast/trends', authenticate, planningController.getForecastTrends);

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

export default router;
