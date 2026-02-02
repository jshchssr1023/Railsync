import { Router } from 'express';
import carController from '../controllers/car.controller';
import shopController from '../controllers/shop.controller';
import ruleController from '../controllers/rule.controller';
import * as authController from '../controllers/auth.controller';
import planningController from '../controllers/planning.controller';
import alertsController from '../controllers/alerts.controller';
import shopImportController from '../controllers/shopImport.controller';
import assignmentController from '../controllers/assignment.controller';
import badOrderController from '../controllers/badOrder.controller';
import servicePlanController from '../controllers/servicePlan.controller';
import shopFilterController from '../controllers/shopFilter.controller';
import { validateEvaluationRequest } from '../middleware/validation';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { query } from '../config/database';

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

// ============================================================================
// SHOP FILTERING ROUTES (Phase B - Proximity & Capability Filtering)
// Static routes MUST come BEFORE parameterized :shopCode routes
// ============================================================================

/**
 * @route   GET /api/shops/filter
 * @desc    Combined filter: proximity + capabilities + tier + region
 * @access  Public
 * @query   latitude, longitude, radiusMiles, capabilityTypes, tier, preferredNetworkOnly, region
 */
router.get('/shops/filter', shopFilterController.filterShops);

/**
 * @route   GET /api/shops/nearby
 * @desc    Find shops within a radius of a given point
 * @access  Public
 * @query   latitude (required), longitude (required), radiusMiles (default: 500)
 */
router.get('/shops/nearby', shopFilterController.findNearbyShops);

/**
 * @route   GET /api/shops/filter-options
 * @desc    Get filter options for dropdowns (regions, tiers, capability types)
 * @access  Public
 */
router.get('/shops/filter-options', shopFilterController.getFilterOptions);

/**
 * @route   GET /api/shops/capability-types
 * @desc    Get list of all capability types
 * @access  Public
 */
router.get('/shops/capability-types', shopFilterController.getCapabilityTypes);

/**
 * @route   GET /api/shops/capability-values/:type
 * @desc    Get unique values for a capability type
 * @access  Public
 */
router.get('/shops/capability-values/:type', shopFilterController.getCapabilityValues);

/**
 * @route   GET /api/shops/by-capabilities
 * @desc    Filter shops by capability types
 * @access  Public
 * @query   capabilityTypes (comma-separated or array)
 */
router.get('/shops/by-capabilities', shopFilterController.filterByCapabilities);

/**
 * @route   GET /api/shops/regions
 * @desc    Get list of all regions
 * @access  Public
 */
router.get('/shops/regions', shopFilterController.getRegions);

// ============================================================================
// SHOP BACKLOG/CAPACITY ROUTES (Parameterized routes)
// ============================================================================

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
// SHOP IMPORT ROUTES (Admin only)
// ============================================================================

/**
 * @route   POST /api/shops/import/attributes
 * @desc    Import shop attributes from CSV data
 * @access  Protected - Admin only
 */
router.post('/shops/import/attributes', authenticate, authorize('admin'), shopImportController.importShopAttributes);

/**
 * @route   POST /api/shops/import/capabilities
 * @desc    Import shop capabilities from CSV data
 * @access  Protected - Admin only
 */
router.post('/shops/import/capabilities', authenticate, authorize('admin'), shopImportController.importShopCapabilities);

/**
 * @route   POST /api/capacity/import/monthly
 * @desc    Import monthly capacity data from CSV
 * @access  Protected - Admin only
 */
router.post('/capacity/import/monthly', authenticate, authorize('admin'), shopImportController.importMonthlyCapacity);

/**
 * @route   POST /api/capacity/import/work
 * @desc    Import work type capacity data from CSV
 * @access  Protected - Admin only
 */
router.post('/capacity/import/work', authenticate, authorize('admin'), shopImportController.importWorkCapacity);

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
      action: req.query.action as any,
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

router.get('/budget/running-repairs', optionalAuth, planningController.getRunningRepairsBudget);
router.put('/budget/running-repairs/:month', authenticate, authorize('admin', 'operator'), planningController.updateRunningRepairsBudget);
router.post('/budget/running-repairs/calculate', authenticate, authorize('admin'), planningController.calculateRunningRepairsBudget);
router.get('/budget/service-events', optionalAuth, planningController.getServiceEventBudgets);
router.post('/budget/service-events', authenticate, authorize('admin', 'operator'), planningController.createServiceEventBudget);
router.put('/budget/service-events/:id', authenticate, authorize('admin', 'operator'), planningController.updateServiceEventBudget);
router.delete('/budget/service-events/:id', authenticate, authorize('admin'), planningController.deleteServiceEventBudget);
router.get('/budget/summary', optionalAuth, planningController.getBudgetSummary);

// ============================================================================
// PHASE 9 - CAR MASTER ROUTES
// ============================================================================

router.get('/cars-master', optionalAuth, planningController.listCars);
router.get('/cars-master/:carId', optionalAuth, planningController.getCarById);
router.get('/cars/active-count', optionalAuth, planningController.getActiveCarCount);
router.post('/cars/import', authenticate, authorize('admin'), planningController.importCars);

// ============================================================================
// PHASE 9 - DEMAND ROUTES
// ============================================================================

router.get('/demands', optionalAuth, planningController.listDemands);
router.get('/demands/:id', optionalAuth, planningController.getDemandById);
router.post('/demands', authenticate, authorize('admin', 'operator'), planningController.createDemand);
router.put('/demands/:id', authenticate, authorize('admin', 'operator'), planningController.updateDemand);
router.put('/demands/:id/status', authenticate, authorize('admin', 'operator'), planningController.updateDemandStatus);
router.delete('/demands/:id', authenticate, authorize('admin'), planningController.deleteDemand);

// ============================================================================
// PHASE 9 - CAPACITY ROUTES
// ============================================================================

router.get('/capacity', optionalAuth, planningController.getCapacity);
router.get('/capacity/:shopCode/:month/cars', optionalAuth, planningController.getCapacityCars);
router.put('/capacity/:shopCode/:month', authenticate, authorize('admin', 'operator'), planningController.updateCapacity);
router.post('/capacity/initialize', authenticate, authorize('admin'), planningController.initializeCapacity);

// ============================================================================
// PHASE 9 - SCENARIO ROUTES
// ============================================================================

router.get('/scenarios', optionalAuth, planningController.listScenarios);
router.post('/scenarios', authenticate, authorize('admin', 'operator'), planningController.createScenario);
router.put('/scenarios/:id', authenticate, authorize('admin', 'operator'), planningController.updateScenario);

// ============================================================================
// PHASE 9 - ALLOCATION ROUTES
// ============================================================================

router.get('/allocations', optionalAuth, planningController.listAllocations);
router.post('/allocations', authenticate, authorize('admin', 'operator'), planningController.createAllocation);
router.post('/allocations/generate', authenticate, authorize('admin', 'operator'), planningController.generateAllocations);
router.put('/allocations/:id/status', authenticate, authorize('admin', 'operator'), planningController.updateAllocationStatus);
router.post('/allocations/:id/assign', authenticate, authorize('admin', 'operator'), planningController.assignAllocation);

// Shop monthly capacity for Quick Shop
router.get('/shops/:shopCode/monthly-capacity', optionalAuth, planningController.getShopMonthlyCapacity);

// ============================================================================
// PHASE 9 - BRC IMPORT ROUTES
// ============================================================================

router.post('/brc/import', authenticate, authorize('admin', 'operator'), planningController.importBRC);
router.get('/brc/history', authenticate, planningController.getBRCHistory);

// ============================================================================
// PHASE 9 - FORECAST ROUTES
// ============================================================================

router.get('/forecast', optionalAuth, planningController.getForecast);
router.get('/forecast/trends', optionalAuth, planningController.getForecastTrends);

// ============================================================================
// PHASE 9 - DASHBOARD ROUTES
// ============================================================================

router.get('/dashboard/widgets', authenticate, planningController.listWidgets);
router.get('/dashboard/configs', authenticate, planningController.listDashboardConfigs);
router.get('/dashboard/configs/:id', authenticate, planningController.getDashboardConfig);
router.post('/dashboard/configs', authenticate, planningController.createDashboardConfig);
router.put('/dashboard/configs/:id', authenticate, planningController.updateDashboardConfig);
router.delete('/dashboard/configs/:id', authenticate, planningController.deleteDashboardConfig);

// ============================================================================
// PHASE 12 - FLEET VISIBILITY ROUTES
// ============================================================================

router.get('/fleet/metrics', async (req, res) => {
  const tier = req.query.tier ? parseInt(req.query.tier as string) : null;
  try {
    let result;
    if (tier) {
      result = await query(`
        SELECT
          COUNT(*) FILTER (WHERE a.current_status = 'in_shop') AS in_shop_count,
          COUNT(*) FILTER (WHERE a.current_status IN ('planned','proposed')) AS planned_count,
          COUNT(*) FILTER (WHERE a.current_status = 'enroute') AS enroute_count,
          COUNT(*) FILTER (WHERE a.current_status = 'dispo') AS dispo_count,
          COUNT(*) FILTER (WHERE a.current_status = 'scheduled') AS scheduled_count,
          COUNT(*) FILTER (WHERE a.current_status = 'completed') AS completed_count,
          COUNT(*) AS total_fleet,
          COALESCE(SUM(CAST(a.estimated_cost AS DECIMAL)), 0) AS total_planned_cost,
          COALESCE(SUM(CAST(a.actual_cost AS DECIMAL)), 0) AS total_actual_cost
        FROM allocations a
        LEFT JOIN shops s ON a.shop_code = s.shop_code
        WHERE a.status NOT IN ('Released', 'cancelled')
          AND COALESCE(s.tier, 1) = $1
      `, [tier]);
    } else {
      result = await query('SELECT * FROM v_fleet_summary LIMIT 1');
    }
    res.json({
      success: true,
      data: result[0] || {},
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Fleet metrics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch fleet metrics' });
  }
});

router.get('/fleet/monthly-volumes', async (req, res) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const tier = req.query.tier ? parseInt(req.query.tier as string) : null;
  try {
    let result;
    if (tier) {
      result = await query(`
        SELECT
          a.target_month as month,
          COUNT(*) FILTER (WHERE a.current_status = 'in_shop') AS in_shop,
          COUNT(*) FILTER (WHERE a.current_status = 'planned') AS planned,
          COUNT(*) FILTER (WHERE a.current_status = 'scheduled') AS scheduled,
          COUNT(*) FILTER (WHERE a.current_status = 'enroute') AS enroute,
          COUNT(*) AS total_cars,
          COALESCE(SUM(CAST(a.estimated_cost AS DECIMAL)), 0) AS planned_cost,
          COALESCE(SUM(CAST(a.actual_cost AS DECIMAL)), 0) AS actual_cost
        FROM allocations a
        LEFT JOIN shops s ON a.shop_code = s.shop_code
        WHERE a.target_month LIKE $1
          AND a.status NOT IN ('Released', 'cancelled')
          AND COALESCE(s.tier, 1) = $2
        GROUP BY a.target_month
        ORDER BY a.target_month
      `, [`${year}%`, tier]);
    } else {
      result = await query(
        "SELECT * FROM v_monthly_volumes WHERE month LIKE $1 ORDER BY month",
        [`${year}%`]
      );
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Monthly volumes error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch monthly volumes' });
  }
});

router.get('/fleet/tier-summary', async (req, res) => {
  const tier = req.query.tier ? parseInt(req.query.tier as string) : null;
  try {
    let result;
    if (tier) {
      result = await query(
        'SELECT * FROM v_tier_summary WHERE tier = $1 ORDER BY tier',
        [tier]
      );
    } else {
      result = await query('SELECT * FROM v_tier_summary ORDER BY tier');
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Tier summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tier summary' });
  }
});

// Dynamic filter options endpoint
router.get('/filters/options', async (req, res) => {
  try {
    // Get distinct tiers from shops
    const tiersResult = await query(`
      SELECT DISTINCT COALESCE(tier, 1) as tier
      FROM shops
      WHERE tier IS NOT NULL
      ORDER BY tier
    `);

    // Get distinct product codes (car types) from allocations
    const carTypesResult = await query(`
      SELECT DISTINCT c.product_code, c.product_code_group
      FROM cars c
      WHERE c.product_code IS NOT NULL AND c.product_code != ''
      ORDER BY c.product_code
      LIMIT 50
    `);

    // Get distinct work types
    const workTypesResult = await query(`
      SELECT DISTINCT work_type
      FROM allocations
      WHERE work_type IS NOT NULL AND work_type != ''
      ORDER BY work_type
    `);

    res.json({
      success: true,
      data: {
        tiers: tiersResult.map((r: { tier: number }) => r.tier),
        carTypes: carTypesResult.map((r: { product_code: string; product_code_group: string }) => ({
          code: r.product_code,
          group: r.product_code_group,
        })),
        workTypes: workTypesResult.map((r: { work_type: string }) => r.work_type),
      },
    });
  } catch (error) {
    console.error('Filter options error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch filter options' });
  }
});

// ============================================================================
// PHASE 10 - ALERTS ROUTES
// ============================================================================

router.get('/alerts', authenticate, alertsController.getAlerts);
router.get('/alerts/count', authenticate, alertsController.getAlertCount);
router.put('/alerts/:alertId/read', authenticate, alertsController.markRead);
router.delete('/alerts/:alertId', authenticate, alertsController.dismissAlert);
router.delete('/alerts/type/:alertType', authenticate, authorize('admin'), alertsController.dismissByType);
router.post('/alerts/scan/:scanType', authenticate, authorize('admin'), alertsController.triggerScan);

// ============================================================================
// PHASE 13 - PIPELINE VIEW ROUTES
// ============================================================================

router.get('/pipeline/buckets', async (req, res) => {
  try {
    const statusAutomation = await import('../services/status-automation.service');

    const [buckets, backlog, pipeline, active, healthy] = await Promise.all([
      statusAutomation.getPipelineBuckets(),
      statusAutomation.getBacklogCars(),
      statusAutomation.getPipelineCars(),
      statusAutomation.getActiveCars(),
      statusAutomation.getHealthyCars(),
    ]);

    res.json({
      success: true,
      data: {
        summary: buckets,
        backlog,
        pipeline,
        active,
        healthy,
      },
    });
  } catch (err) {
    console.error('Pipeline buckets error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch pipeline buckets' });
  }
});

router.post('/pipeline/recalculate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const statusAutomation = await import('../services/status-automation.service');
    const result = await statusAutomation.recalculatePipelineStatuses();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Pipeline recalculate error:', err);
    res.status(500).json({ success: false, error: 'Failed to recalculate pipeline statuses' });
  }
});

router.post('/pipeline/status-update', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { allocationId, csvStatus, csvScheduled } = req.body;

    if (!allocationId || !csvStatus) {
      res.status(400).json({ success: false, error: 'allocationId and csvStatus required' });
      return;
    }

    const statusAutomation = await import('../services/status-automation.service');
    const result = await statusAutomation.processStatusUpdate(allocationId, csvStatus, csvScheduled);

    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// ============================================================================
// SSOT - CAR ASSIGNMENTS (Phase 1)
// ============================================================================

// List assignments with filters
router.get('/assignments', optionalAuth, assignmentController.listAssignments);

// Check for conflicts before creating assignment
router.get('/assignments/check-conflicts', optionalAuth, assignmentController.checkConflicts);

// Suggest service options for a car (based on qualification dates, bad orders, etc.)
router.get('/cars/:car_number/service-options', optionalAuth, assignmentController.suggestServiceOptions);

// Get single assignment with service options
router.get('/assignments/:id', optionalAuth, assignmentController.getAssignment);

// Create new assignment (enforces one-active-per-car)
router.post('/assignments', authenticate, assignmentController.createAssignment);

// Update assignment
router.put('/assignments/:id', authenticate, assignmentController.updateAssignment);

// Update assignment status
router.put('/assignments/:id/status', authenticate, assignmentController.updateAssignmentStatus);

// Expedite assignment (move to priority 1, immediate)
router.post('/assignments/:id/expedite', authenticate, assignmentController.expediteAssignment);

// Cancel assignment
router.post('/assignments/:id/cancel', authenticate, assignmentController.cancelAssignment);

// Service options for an assignment
router.get('/assignments/:assignmentId/service-options', optionalAuth, assignmentController.getServiceOptions);
router.post('/assignments/:assignmentId/service-options', authenticate, assignmentController.addServiceOption);
router.put('/service-options/:optionId', authenticate, assignmentController.updateServiceOption);
router.delete('/service-options/:optionId', authenticate, assignmentController.deleteServiceOption);

// ============================================================================
// BAD ORDER ROUTES
// ============================================================================

// List bad orders with filters
router.get('/bad-orders', optionalAuth, badOrderController.listBadOrders);

// Get single bad order
router.get('/bad-orders/:id', optionalAuth, badOrderController.getBadOrder);

// Create bad order report (detects existing assignments)
router.post('/bad-orders', authenticate, badOrderController.createBadOrder);

// Resolve bad order (choose action: expedite_existing, new_shop_combined, repair_only, planning_review)
router.post('/bad-orders/:id/resolve', authenticate, badOrderController.resolveBadOrder);

// ============================================================================
// SERVICE PLAN ROUTES (Phase 3)
// ============================================================================

// Service Plans CRUD
router.get('/service-plans', optionalAuth, servicePlanController.listPlans);
router.get('/service-plans/:id', optionalAuth, servicePlanController.getPlan);
router.post('/service-plans', authenticate, servicePlanController.createPlan);
router.put('/service-plans/:id', authenticate, servicePlanController.updatePlan);
router.delete('/service-plans/:id', authenticate, authorize('admin'), servicePlanController.deletePlan);

// Service Plan Approval Workflow
router.post('/service-plans/:id/approve', authenticate, servicePlanController.approvePlan);
router.post('/service-plans/:id/reject', authenticate, servicePlanController.rejectPlan);

// Service Plan Options
router.get('/service-plans/:planId/options', optionalAuth, servicePlanController.listPlanOptions);
router.post('/service-plans/:planId/options', authenticate, servicePlanController.createPlanOption);
router.get('/service-plan-options/:optionId', optionalAuth, servicePlanController.getPlanOption);
router.put('/service-plan-options/:optionId', authenticate, servicePlanController.updatePlanOption);
router.delete('/service-plan-options/:optionId', authenticate, servicePlanController.deletePlanOption);
router.post('/service-plan-options/:optionId/finalize', authenticate, servicePlanController.finalizePlanOption);

// Option Cars
router.get('/service-plan-options/:optionId/cars', optionalAuth, servicePlanController.listOptionCarsHandler);
router.post('/service-plan-options/:optionId/cars', authenticate, servicePlanController.addCarToOptionHandler);
router.delete('/service-plan-option-cars/:carId', authenticate, servicePlanController.removeCarFromOptionHandler);

// ============================================================================
// FLEET HIERARCHY ROUTES (Customer → Lease → Rider → Cars)
// ============================================================================

import fleetController from '../controllers/fleet.controller';

// Customers
router.get('/customers', optionalAuth, fleetController.listCustomers);
router.get('/customers/:customerId', optionalAuth, fleetController.getCustomer);
router.get('/customers/:customerId/leases', optionalAuth, fleetController.getCustomerLeases);

// Leases
router.get('/leases/:leaseId', optionalAuth, fleetController.getLease);
router.get('/leases/:leaseId/riders', optionalAuth, fleetController.getLeaseRiders);

// Riders
router.get('/riders/:riderId', optionalAuth, fleetController.getRider);
router.get('/riders/:riderId/cars', optionalAuth, fleetController.getRiderCars);
router.get('/riders/:riderId/amendments', optionalAuth, fleetController.getRiderAmendments);
router.post('/riders/:riderId/resync-schedule', authenticate, authorize('admin', 'operator'), fleetController.resyncRiderSchedules);

// Amendments
router.get('/amendments/:amendmentId', optionalAuth, fleetController.getAmendment);
router.post('/amendments/:amendmentId/detect-conflicts', authenticate, fleetController.detectAmendmentConflicts);

// Fleet with Amendment Status
router.get('/fleet/cars-with-amendments', optionalAuth, fleetController.getCarsWithAmendments);

// Car Shopping Validation (checks for outdated terms)
router.get('/cars/:carNumber/validate-shopping', optionalAuth, fleetController.validateCarForShopping);

// ============================================================================
// SHOPPING CLASSIFICATION ROUTES
// ============================================================================

// Shopping Types (12 canonical types)
router.get('/shopping-types', async (req, res) => {
  try {
    const types = await query(`
      SELECT id, code, name, description, is_planned, default_cost_owner, tier_preference, sort_order
      FROM shopping_types WHERE is_active = TRUE ORDER BY sort_order
    `);
    res.json({ success: true, data: types });
  } catch (err) {
    console.error('Shopping types error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch shopping types' });
  }
});

// Shopping Reasons (filtered by type)
router.get('/shopping-reasons', async (req, res) => {
  try {
    const typeId = req.query.type_id as string;
    const typeCode = req.query.type_code as string;

    let sql = `SELECT * FROM v_shopping_reasons`;
    const params: any[] = [];

    if (typeId) {
      sql += ` WHERE type_id = $1`;
      params.push(typeId);
    } else if (typeCode) {
      sql += ` WHERE type_code = $1`;
      params.push(typeCode);
    }

    sql += ` ORDER BY sort_order`;
    const reasons = await query(sql, params);
    res.json({ success: true, data: reasons });
  } catch (err) {
    console.error('Shopping reasons error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch shopping reasons' });
  }
});

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
