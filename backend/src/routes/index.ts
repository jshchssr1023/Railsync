import { Router } from 'express';
import logger from '../config/logger';
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
import sseController from '../controllers/sse.controller';
import masterPlanController from '../controllers/masterPlan.controller';
import notificationController from '../controllers/notification.controller';
import invoiceController from '../controllers/invoice.controller';
import analyticsController from '../controllers/analytics.controller';
import userManagementController from '../controllers/userManagement.controller';
import dashboardController from '../controllers/dashboard.controller';
import * as jobCodeController from '../controllers/job-code.controller';
import * as ccmController from '../controllers/ccm.controller';
import * as ccmInstructionsService from '../services/ccm-instructions.service';
import * as scopeLibraryController from '../controllers/scope-library.controller';
import * as sowController from '../controllers/scope-of-work.controller';
import * as shoppingEventController from '../controllers/shopping-event.controller';
import * as shoppingEventService from '../services/shopping-event.service';
import * as transitionLogService from '../services/transition-log.service';
import * as shoppingPacketController from '../controllers/shopping-packet.controller';
import * as estimateController from '../controllers/estimate-workflow.controller';
import * as invoiceCaseController from '../controllers/invoice-case.controller';
import * as shoppingRequestController from '../controllers/shopping-request.controller';
import * as budgetScenarioController from '../controllers/budgetScenario.controller';
import * as qualificationController from '../controllers/qualification.controller';
import * as projectPlanningService from '../services/project-planning.service';
import * as projectAuditService from '../services/project-audit.service';
import * as demandService from '../services/demand.service';
import * as allocationService from '../services/allocation.service';
import multer from 'multer';
import { validateEvaluationRequest } from '../middleware/validation';

// Configure multer for CSV / BRC file uploads (memory storage)
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.txt', '.brc', '.dat', '.tsv'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowedTypes.includes(ext) || file.mimetype === 'text/csv' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: CSV, TXT, BRC, DAT, TSV'));
    }
  },
});

// Configure multer for invoice file uploads (memory storage)
const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.edi', '.txt', '.500'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowedTypes.includes(ext) || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, EDI, TXT, 500'));
    }
  },
});
// Allowed MIME types for document uploads (packets and shopping requests)
const allowedDocMimeTypes = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain',
];

const safeDocFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (allowedDocMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Accepted: PDF, images, Office documents, CSV.'));
  }
};

// Configure multer for packet document uploads
const packetDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: safeDocFileFilter,
});
// Configure multer for shopping request attachment uploads
const shoppingRequestUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: safeDocFileFilter,
});

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
 * @route   POST /api/cars/umler/import
 * @desc    Bulk import UMLER attributes from CSV
 * @access  Admin only
 */
router.post('/cars/umler/import', authenticate, authorize('admin'), carController.importUmlerCSV);

/**
 * @route   GET /api/cars/:carNumber/history
 * @desc    Get asset event history for a car
 * @access  Authenticated
 */
router.get('/cars/:carNumber/history', authenticate, carController.getCarHistory);

/**
 * @route   GET /api/cars/:carNumber/umler
 * @desc    Get UMLER engineering attributes for a car
 * @access  Authenticated
 */
router.get('/cars/:carNumber/umler', authenticate, carController.getCarUmler);

/**
 * @route   PUT /api/cars/:carNumber/umler
 * @desc    Create or update UMLER attributes for a car
 * @access  Admin only
 */
router.put('/cars/:carNumber/umler', authenticate, authorize('admin'), carController.updateCarUmler);

/**
 * @route   GET /api/cars/:carNumber
 * @desc    Retrieve car attributes and active service event
 * @access  Public (optionally authenticated for audit)
 */
router.get('/cars/:carNumber', optionalAuth, carController.getCarByNumber);

/**
 * @route   GET /api/cars-browse
 * @desc    List all cars for browse page with essential fields
 * @access  Public
 */
router.get('/cars-browse', optionalAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT car_number, car_mark, car_type, lessee_name, lessee_code,
             commodity, current_status, tank_qual_year, car_age,
             is_jacketed, is_lined, csr_name, current_region,
             contract_expiration, portfolio_status
      FROM cars
      WHERE is_active = TRUE
      ORDER BY car_number
    `);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Cars browse error');
    res.status(500).json({ success: false, error: 'Failed to fetch cars' });
  }
});

// ============================================================================
// CONTRACTS BROWSE ROUTES
// ============================================================================

/**
 * @route   GET /api/contracts-browse/filters
 * @desc    Returns distinct filter values for contracts browse dropdowns
 * @access  Public
 */
router.get('/contracts-browse/filters', optionalAuth, async (req, res) => {
  try {
    const [statuses, regions, lessees] = await Promise.all([
      query(`SELECT DISTINCT current_status as value FROM cars WHERE is_active = TRUE AND current_status IS NOT NULL ORDER BY current_status`),
      query(`SELECT DISTINCT current_region as value FROM cars WHERE is_active = TRUE AND current_region IS NOT NULL ORDER BY current_region`),
      query(`SELECT DISTINCT lessee_name as value FROM cars WHERE is_active = TRUE AND lessee_name IS NOT NULL ORDER BY lessee_name`),
    ]);
    res.json({
      success: true,
      data: {
        statuses: statuses.map((r: any) => r.value),
        regions: regions.map((r: any) => r.value),
        lessees: lessees.map((r: any) => r.value),
      }
    });
  } catch (err) {
    logger.error({ err }, 'Contracts browse filters error');
    res.status(500).json({ success: false, error: 'Failed to fetch filter options' });
  }
});

/**
 * @route   GET /api/contracts-browse/types
 * @desc    Returns car type hierarchy with counts for tree navigation
 * @access  Public
 */
router.get('/contracts-browse/types', optionalAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COALESCE(car_type, 'Unclassified') as car_type,
        COALESCE(commodity, 'Unassigned') as commodity,
        COUNT(*)::int as count
      FROM cars
      WHERE is_active = TRUE
      GROUP BY car_type, commodity
      ORDER BY car_type, commodity
    `);

    // Shape into tree structure grouped by car_type
    const typeMap = new Map<string, { name: string; count: number; children: { name: string; count: number }[] }>();

    for (const row of result) {
      if (!typeMap.has(row.car_type)) {
        typeMap.set(row.car_type, { name: row.car_type, count: 0, children: [] });
      }
      const node = typeMap.get(row.car_type)!;
      node.count += row.count;
      node.children.push({ name: row.commodity, count: row.count });
    }

    const tree = Array.from(typeMap.values());

    res.json({ success: true, data: tree });
  } catch (err) {
    logger.error({ err }, 'Contracts browse types error');
    res.status(500).json({ success: false, error: 'Failed to fetch car types' });
  }
});

/**
 * @route   GET /api/contracts-browse/cars
 * @desc    Paginated, filtered, sorted car list for contracts browse page
 * @access  Public
 */
router.get('/contracts-browse/cars', optionalAuth, async (req, res) => {
  try {
    // Parse pagination params
    let page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    let limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = (page - 1) * limit;

    // Parse filter params
    const carType = req.query.car_type as string | undefined;
    const commodity = req.query.commodity as string | undefined;
    const status = req.query.status as string | undefined;
    const region = req.query.region as string | undefined;
    const lessee = req.query.lessee as string | undefined;
    const search = req.query.search as string | undefined;

    // Parse sort params with whitelist
    const allowedSortColumns = [
      'car_number', 'car_type', 'lessee_name', 'commodity',
      'current_status', 'current_region', 'car_age', 'tank_qual_year'
    ];
    const sort = allowedSortColumns.includes(req.query.sort as string)
      ? (req.query.sort as string)
      : 'car_number';
    const order = (req.query.order as string)?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Build WHERE clause dynamically with parameterized queries
    const conditions: string[] = ['is_active = TRUE'];
    const params: any[] = [];
    let paramIndex = 1;

    if (carType) {
      conditions.push(`car_type = $${paramIndex++}`);
      params.push(carType);
    }
    if (commodity) {
      conditions.push(`commodity = $${paramIndex++}`);
      params.push(commodity);
    }
    if (status) {
      conditions.push(`current_status = $${paramIndex++}`);
      params.push(status);
    }
    if (region) {
      conditions.push(`current_region = $${paramIndex++}`);
      params.push(region);
    }
    if (lessee) {
      conditions.push(`lessee_name ILIKE $${paramIndex++}`);
      params.push(`%${lessee}%`);
    }
    if (search) {
      conditions.push(`car_number ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM cars WHERE ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Get paginated rows
    const dataResult = await query(
      `SELECT car_number, car_mark, car_type, lessee_name, commodity,
              current_status, current_region, car_age, is_jacketed, is_lined,
              tank_qual_year, contract_number, plan_status
       FROM cars
       WHERE ${whereClause}
       ORDER BY ${sort} ${order}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: dataResult,
      pagination: { page, limit, total, totalPages }
    });
  } catch (err) {
    logger.error({ err }, 'Contracts browse cars error');
    res.status(500).json({ success: false, error: 'Failed to fetch cars' });
  }
});

/**
 * @route   GET /api/contracts-browse/car/:carNumber
 * @desc    Full car detail for side drawer including related data
 * @access  Public
 */
router.get('/contracts-browse/car/:carNumber', optionalAuth, async (req, res) => {
  try {
    const { carNumber } = req.params;

    // Get full car record
    const carResult = await query(
      `SELECT * FROM cars WHERE car_number = $1`,
      [carNumber]
    );

    if (carResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Car not found' });
    }

    // Get shopping events count
    const countResult = await query(
      `SELECT COUNT(*)::int as count FROM shopping_events WHERE car_number = $1`,
      [carNumber]
    );

    // Get active shopping event
    const activeEventResult = await query(
      `SELECT id, event_number, state, shop_code
       FROM shopping_events
       WHERE car_number = $1 AND state != 'RELEASED' AND state != 'CANCELLED'
       LIMIT 1`,
      [carNumber]
    );

    // Get lease info through rider_cars -> lease_riders -> master_leases -> customers
    const leaseResult = await query(
      `SELECT ml.lease_id, ml.lease_name, ml.status as lease_status,
              c.customer_name, c.customer_code
       FROM rider_cars rc
       JOIN lease_riders lr ON rc.rider_id = lr.id
       JOIN master_leases ml ON lr.master_lease_id = ml.id
       JOIN customers c ON ml.customer_id = c.id
       WHERE rc.car_number = $1 AND rc.is_active = true
       LIMIT 1`,
      [carNumber]
    );

    res.json({
      success: true,
      data: {
        car: carResult[0],
        shopping_events_count: countResult[0]?.count || 0,
        active_shopping_event: activeEventResult[0] || null,
        lease_info: leaseResult[0] || null
      }
    });
  } catch (err) {
    logger.error({ err }, 'Contracts browse car detail error');
    res.status(500).json({ success: false, error: 'Failed to fetch car detail' });
  }
});

/**
 * @route   GET /api/cars/:carNumber/details
 * @desc    Get comprehensive car details for car card view
 * @access  Public
 */
router.get('/cars/:carNumber/details', optionalAuth, async (req, res) => {
  try {
    const { carNumber } = req.params;
    const result = await query(
      `SELECT * FROM v_car_details WHERE car_number = $1`,
      [carNumber]
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Car not found' });
    }

    res.json({ success: true, data: result[0] });
  } catch (err) {
    logger.error({ err }, 'Car details error');
    res.status(500).json({ success: false, error: 'Failed to fetch car details' });
  }
});

// ============================================================================
// SHOP ROUTES
// ============================================================================

/**
 * @route   GET /api/shops
 * @desc    List all active shops
 * @access  Public
 */
router.get('/shops', authenticate, shopController.listShops);

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
router.get('/shops/filter', authenticate, shopFilterController.filterShops);

/**
 * @route   GET /api/shops/nearby
 * @desc    Find shops within a radius of a given point
 * @access  Public
 * @query   latitude (required), longitude (required), radiusMiles (default: 500)
 */
router.get('/shops/nearby', authenticate, shopFilterController.findNearbyShops);

/**
 * @route   GET /api/shops/filter-options
 * @desc    Get filter options for dropdowns (regions, tiers, capability types)
 * @access  Public
 */
router.get('/shops/filter-options', authenticate, shopFilterController.getFilterOptions);

/**
 * @route   GET /api/shops/capability-types
 * @desc    Get list of all capability types
 * @access  Public
 */
router.get('/shops/capability-types', authenticate, shopFilterController.getCapabilityTypes);

/**
 * @route   GET /api/shops/capability-values/:type
 * @desc    Get unique values for a capability type
 * @access  Public
 */
router.get('/shops/capability-values/:type', authenticate, shopFilterController.getCapabilityValues);

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
router.get('/rules', authenticate, ruleController.listRules);

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
    logger.error({ err: error }, 'Audit log query error');
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
    logger.error({ err: error }, 'List users error');
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
    logger.error({ err: error }, 'Update user role error');
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
    logger.error({ err: error }, 'Deactivate user error');
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
router.post('/cars/import', authenticate, authorize('admin'), csvUpload.single('file'), planningController.importCars);

// ============================================================================
// PHASE 9 - DEMAND ROUTES
// ============================================================================

router.get('/demands', optionalAuth, planningController.listDemands);
router.get('/demands/:id', optionalAuth, planningController.getDemandById);
router.post('/demands', authenticate, authorize('admin', 'operator'), planningController.createDemand);
router.put('/demands/:id', authenticate, authorize('admin', 'operator'), planningController.updateDemand);
router.put('/demands/:id/status', authenticate, authorize('admin', 'operator'), planningController.updateDemandStatus);
router.delete('/demands/:id', authenticate, authorize('admin'), planningController.deleteDemand);
router.post('/demands/import', authenticate, authorize('admin'), csvUpload.single('file'), async (req, res, next) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const content = file ? file.buffer.toString('utf-8') : req.body.content;
    if (!content) {
      res.status(400).json({ success: false, error: 'CSV content required. Upload a file or provide content in the request body.' });
      return;
    }
    const result = await demandService.importDemandsFromCSV(content, req.user?.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/demands/:id/revert', authenticate, authorize('admin', 'operator'), async (req, res, next) => {
  try {
    const result = await demandService.revertLastTransition(req.params.id, req.user.id, req.body.notes);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

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
router.post('/allocations/:id/revert', authenticate, authorize('admin', 'operator'), async (req, res, next) => {
  try {
    const result = await allocationService.revertLastTransition(req.params.id, req.user.id, req.body.notes);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Shop monthly capacity for Quick Shop
router.get('/shops/:shopCode/monthly-capacity', optionalAuth, planningController.getShopMonthlyCapacity);

// ============================================================================
// PHASE 9 - BRC IMPORT ROUTES
// ============================================================================

router.post('/brc/import', authenticate, authorize('admin', 'operator'), csvUpload.single('file'), planningController.importBRC);
router.get('/brc/history', authenticate, planningController.getBRCHistory);

// ============================================================================
// PHASE 9 - FORECAST ROUTES
// ============================================================================

router.get('/forecast', optionalAuth, planningController.getForecast);
router.get('/forecast/trends', optionalAuth, planningController.getForecastTrends);
router.get('/forecast/pipeline', optionalAuth, budgetScenarioController.getPipelineMetrics);

// ============================================================================
// BUDGET SCENARIOS
// ============================================================================

router.get('/budget-scenarios', authenticate, budgetScenarioController.listScenarios);
router.get('/budget-scenarios/:id', authenticate, budgetScenarioController.getScenario);
router.post('/budget-scenarios', authenticate, budgetScenarioController.createScenario);
router.put('/budget-scenarios/:id', authenticate, budgetScenarioController.updateScenario);
router.delete('/budget-scenarios/:id', authenticate, budgetScenarioController.deleteScenario);
router.get('/budget-scenarios/:id/impact', authenticate, budgetScenarioController.calculateImpact);

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
// PHASE 12 - CONTRACTS VISIBILITY ROUTES
// ============================================================================

router.get('/contracts/metrics', authenticate, async (req, res) => {
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
    logger.error({ err: error }, 'Contracts metrics error');
    res.status(500).json({ success: false, error: 'Failed to fetch contracts metrics' });
  }
});

router.get('/contracts/monthly-volumes', authenticate, async (req, res) => {
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
    logger.error({ err: error }, 'Monthly volumes error');
    res.status(500).json({ success: false, error: 'Failed to fetch monthly volumes' });
  }
});

router.get('/contracts/tier-summary', authenticate, async (req, res) => {
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
    logger.error({ err: error }, 'Tier summary error');
    res.status(500).json({ success: false, error: 'Failed to fetch tier summary' });
  }
});

// Dynamic filter options endpoint
router.get('/filters/options', authenticate, async (req, res) => {
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
    logger.error({ err: error }, 'Filter options error');
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

router.get('/pipeline/buckets', authenticate, async (req, res) => {
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
    logger.error({ err }, 'Pipeline buckets error');
    res.status(500).json({ success: false, error: 'Failed to fetch pipeline buckets' });
  }
});

router.post('/pipeline/recalculate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const statusAutomation = await import('../services/status-automation.service');
    const result = await statusAutomation.recalculatePipelineStatuses();
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Pipeline recalculate error');
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
    logger.error({ err }, 'Status update error');
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
// ALLOCATION LINE ITEMS (Budget Integration)
// ============================================================================

/**
 * @route   POST /api/allocations/:id/line-items
 * @desc    Add shopping type line items to allocation for budget tracking
 * @access  Protected
 */
router.post('/allocations/:id/line-items', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { line_items } = req.body;

    if (!line_items || !Array.isArray(line_items)) {
      return res.status(400).json({ success: false, error: 'line_items array required' });
    }

    // Clear existing line items
    await query('DELETE FROM allocation_line_items WHERE allocation_id = $1', [id]);

    // Insert new line items
    for (const item of line_items) {
      await query(`
        INSERT INTO allocation_line_items (
          allocation_id, shopping_type_id, shopping_reason_id,
          description, estimated_cost, cost_owner, customer_billable, project_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id,
        item.shopping_type_id,
        item.shopping_reason_id || null,
        item.description || null,
        item.estimated_cost || 0,
        item.cost_owner || 'lessor',
        item.customer_billable || false,
        item.project_number || null,
      ]);
    }

    // Get updated allocation with totals
    const result = await query(`
      SELECT a.*,
        (SELECT jsonb_agg(jsonb_build_object(
          'id', li.id,
          'type_code', st.code,
          'type_name', st.name,
          'reason_name', sr.name,
          'estimated_cost', li.estimated_cost,
          'customer_billable', li.customer_billable
        ))
        FROM allocation_line_items li
        JOIN shopping_types st ON li.shopping_type_id = st.id
        LEFT JOIN shopping_reasons sr ON li.shopping_reason_id = sr.id
        WHERE li.allocation_id = a.id) AS line_items
      FROM allocations a WHERE a.id = $1
    `, [id]);

    res.json({ success: true, data: result[0] });
  } catch (err) {
    logger.error({ err }, 'Add line items error');
    res.status(500).json({ success: false, error: 'Failed to add line items' });
  }
});

/**
 * @route   GET /api/allocations/:id/line-items
 * @desc    Get line items for an allocation
 * @access  Public
 */
router.get('/allocations/:id/line-items', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT li.*, st.code AS type_code, st.name AS type_name, sr.name AS reason_name
      FROM allocation_line_items li
      JOIN shopping_types st ON li.shopping_type_id = st.id
      LEFT JOIN shopping_reasons sr ON li.shopping_reason_id = sr.id
      WHERE li.allocation_id = $1
      ORDER BY st.sort_order
    `, [id]);

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Get line items error');
    res.status(500).json({ success: false, error: 'Failed to get line items' });
  }
});

/**
 * @route   GET /api/budget/summary
 * @desc    Get budget summary by month
 * @access  Public
 */
router.get('/budget/monthly-summary', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_budget_by_month');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Budget summary error');
    res.status(500).json({ success: false, error: 'Failed to get budget summary' });
  }
});

/**
 * @route   GET /api/budget/by-type
 * @desc    Get budget breakdown by shopping type
 * @access  Public
 */
router.get('/budget/by-type', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_budget_by_type');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Budget by type error');
    res.status(500).json({ success: false, error: 'Failed to get budget by type' });
  }
});

/**
 * @route   GET /api/budget/by-lessee
 * @desc    Get customer billable amounts by lessee
 * @access  Public
 */
router.get('/budget/by-lessee', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_budget_by_lessee');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Budget by lessee error');
    res.status(500).json({ success: false, error: 'Failed to get budget by lessee' });
  }
});

// ============================================================================
// QUALIFICATION REPORTS
// ============================================================================

router.get('/reports/qual-dashboard', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_qual_dashboard');
    res.json({ success: true, data: result[0] });
  } catch (err) {
    logger.error({ err }, 'Qual dashboard error');
    res.status(500).json({ success: false, error: 'Failed to get qual dashboard' });
  }
});

router.get('/reports/qual-by-year', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_qual_by_year');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Qual by year error');
    res.status(500).json({ success: false, error: 'Failed to get qual by year' });
  }
});

router.get('/reports/overdue-cars', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await query('SELECT * FROM v_overdue_cars LIMIT $1', [limit]);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Overdue cars error');
    res.status(500).json({ success: false, error: 'Failed to get overdue cars' });
  }
});

router.get('/reports/upcoming-quals', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await query('SELECT * FROM v_upcoming_quals LIMIT $1', [limit]);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Upcoming quals error');
    res.status(500).json({ success: false, error: 'Failed to get upcoming quals' });
  }
});

router.get('/reports/qual-by-csr', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_qual_by_csr');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Qual by CSR error');
    res.status(500).json({ success: false, error: 'Failed to get qual by CSR' });
  }
});

router.get('/reports/qual-by-lessee', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_qual_by_lessee');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Qual by lessee error');
    res.status(500).json({ success: false, error: 'Failed to get qual by lessee' });
  }
});

router.get('/reports/qual-by-region', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_qual_by_region');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Qual by region error');
    res.status(500).json({ success: false, error: 'Failed to get qual by region' });
  }
});

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

// Revert last transition on a bad order
router.post('/bad-orders/:id/revert', authenticate, badOrderController.revertBadOrder);

// ============================================================================
// SHOP DESIGNATIONS & STORAGE COMMODITIES
// ============================================================================

/**
 * @route   GET /api/shops/browse/hierarchy
 * @desc    Get shops grouped by designation → network → shop with metrics
 * @access  Public
 */
router.get('/shops/browse/hierarchy', optionalAuth, async (req, res) => {
  try {
    // Get all active shops with their data
    const shops = await query(`
      SELECT s.shop_code, s.shop_name, s.primary_railroad, s.region, s.tier,
             s.is_preferred_network, s.shop_designation, s.capacity, s.labor_rate,
             COALESCE(s.material_markup, 15.00) as material_markup,
             s.latitude, s.longitude, s.city, s.state,
             b.cars_backlog, b.hours_backlog, b.cars_en_route_0_6, b.cars_en_route_7_14, b.cars_en_route_15_plus
      FROM shops s
      LEFT JOIN LATERAL (
        SELECT cars_backlog, hours_backlog, cars_en_route_0_6, cars_en_route_7_14, cars_en_route_15_plus
        FROM shop_backlog WHERE shop_code = s.shop_code ORDER BY date DESC LIMIT 1
      ) b ON true
      WHERE s.is_active = true
      ORDER BY s.shop_designation, s.tier, s.primary_railroad, s.shop_name
    `);

    // Group into designation → network → shops
    const groups: Record<string, any> = {};
    for (const shop of shops) {
      const designation = shop.shop_designation || 'repair';
      const network = shop.primary_railroad || 'Other';

      if (!groups[designation]) {
        groups[designation] = { designation, networks: {}, metrics: {
          total_shops: 0, total_capacity: 0, cars_in_shop: 0, cars_enroute: 0,
          preferred_count: 0, non_preferred_count: 0,
          avg_labor_rate: 0, avg_material_markup: 0,
          labor_rate_sum: 0, markup_sum: 0
        }};
      }

      const g = groups[designation];
      g.metrics.total_shops++;
      g.metrics.total_capacity += parseInt(shop.capacity) || 0;
      g.metrics.cars_in_shop += parseInt(shop.cars_backlog) || 0;
      g.metrics.cars_enroute += (parseInt(shop.cars_en_route_0_6) || 0) + (parseInt(shop.cars_en_route_7_14) || 0) + (parseInt(shop.cars_en_route_15_plus) || 0);
      if (shop.is_preferred_network) g.metrics.preferred_count++; else g.metrics.non_preferred_count++;
      g.metrics.labor_rate_sum += parseFloat(shop.labor_rate) || 0;
      g.metrics.markup_sum += parseFloat(shop.material_markup) || 0;

      if (!g.networks[network]) {
        g.networks[network] = { network, tier: shop.tier, shops: [] };
      }

      // Compute load indicator
      const carsInShop = parseInt(shop.cars_backlog) || 0;
      const cap = parseInt(shop.capacity) || 1;
      const loadPct = Math.round((carsInShop / cap) * 100);
      const loadStatus = loadPct >= 90 ? 'red' : loadPct >= 70 ? 'yellow' : 'green';

      g.networks[network].shops.push({
        shop_code: shop.shop_code,
        shop_name: shop.shop_name,
        region: shop.region,
        tier: shop.tier,
        capacity: parseInt(shop.capacity) || 0,
        cars_in_shop: carsInShop,
        cars_enroute: (parseInt(shop.cars_en_route_0_6) || 0) + (parseInt(shop.cars_en_route_7_14) || 0) + (parseInt(shop.cars_en_route_15_plus) || 0),
        labor_rate: parseFloat(shop.labor_rate) || 0,
        material_markup: parseFloat(shop.material_markup) || 0,
        is_preferred_network: shop.is_preferred_network,
        load_pct: loadPct,
        load_status: loadStatus,
        latitude: shop.latitude ? parseFloat(shop.latitude) : null,
        longitude: shop.longitude ? parseFloat(shop.longitude) : null,
      });
    }

    // Finalize metrics and convert networks to arrays
    const result = Object.values(groups).map((g: any) => {
      if (g.metrics.total_shops > 0) {
        g.metrics.avg_labor_rate = Math.round((g.metrics.labor_rate_sum / g.metrics.total_shops) * 100) / 100;
        g.metrics.avg_material_markup = Math.round((g.metrics.markup_sum / g.metrics.total_shops) * 100) / 100;
      }
      delete g.metrics.labor_rate_sum;
      delete g.metrics.markup_sum;
      g.networks = Object.values(g.networks).sort((a: any, b: any) => a.tier - b.tier || a.network.localeCompare(b.network));
      return g;
    });

    // Sort: repair first, then storage, then scrap
    const order = { repair: 0, storage: 1, scrap: 2 };
    result.sort((a: any, b: any) => (order[a.designation as keyof typeof order] ?? 9) - (order[b.designation as keyof typeof order] ?? 9));

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Shop hierarchy error');
    res.status(500).json({ success: false, error: 'Failed to get shop hierarchy' });
  }
});

/**
 * @route   GET /api/shops/browse/detail/:shopCode
 * @desc    Get detailed shop info for the side drawer
 * @access  Public
 */
router.get('/shops/browse/detail/:shopCode', optionalAuth, async (req, res) => {
  try {
    const { shopCode } = req.params;

    // Shop base info
    const shopResult = await query(`
      SELECT s.*, COALESCE(s.material_markup, 15.00) as material_markup
      FROM shops s WHERE s.shop_code = $1
    `, [shopCode]);

    if (shopResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const shop = shopResult[0];

    // Backlog
    const backlogResult = await query(`
      SELECT * FROM shop_backlog WHERE shop_code = $1 ORDER BY date DESC LIMIT 1
    `, [shopCode]);

    // Capacity by work type
    const capacityResult = await query(`
      SELECT work_type, weekly_hours_capacity, current_utilization_pct, available_hours
      FROM shop_capacity WHERE shop_code = $1 ORDER BY work_type
    `, [shopCode]);

    // Capabilities
    const capResult = await query(`
      SELECT capability_type, capability_value
      FROM shop_capabilities WHERE shop_code = $1 ORDER BY capability_type, capability_value
    `, [shopCode]);

    const capabilities: Record<string, string[]> = {};
    for (const c of capResult) {
      if (!capabilities[c.capability_type]) capabilities[c.capability_type] = [];
      capabilities[c.capability_type].push(c.capability_value);
    }

    // Active shopping events at this shop
    const eventsResult = await query(`
      SELECT COUNT(*)::int as active_events,
             COUNT(*) FILTER (WHERE state IN ('IN_REPAIR','INSPECTION','QA_COMPLETE'))::int as in_progress
      FROM shopping_events
      WHERE shop_code = $1 AND state NOT IN ('RELEASED','CANCELLED')
    `, [shopCode]);

    res.json({
      success: true,
      data: {
        shop: {
          shop_code: shop.shop_code,
          shop_name: shop.shop_name,
          primary_railroad: shop.primary_railroad,
          region: shop.region,
          city: shop.city,
          state: shop.state,
          tier: shop.tier,
          shop_designation: shop.shop_designation || 'repair',
          capacity: parseInt(shop.capacity) || 0,
          labor_rate: parseFloat(shop.labor_rate) || 0,
          material_markup: parseFloat(shop.material_markup) || 0,
          is_preferred_network: shop.is_preferred_network,
          latitude: shop.latitude ? parseFloat(shop.latitude) : null,
          longitude: shop.longitude ? parseFloat(shop.longitude) : null,
        },
        backlog: backlogResult[0] || null,
        capacity: capacityResult,
        capabilities,
        active_events: eventsResult[0]?.active_events || 0,
        in_progress: eventsResult[0]?.in_progress || 0,
      }
    });
  } catch (err) {
    logger.error({ err }, 'Shop detail error');
    res.status(500).json({ success: false, error: 'Failed to get shop detail' });
  }
});

/**
 * @route   GET /api/shops/by-designation/:designation
 * @desc    Get shops filtered by designation (repair, storage, scrap)
 * @access  Public
 */
router.get('/shops/by-designation/:designation', optionalAuth, async (req, res) => {
  try {
    const { designation } = req.params;
    if (!['repair', 'storage', 'scrap'].includes(designation)) {
      return res.status(400).json({ success: false, error: 'Invalid designation. Must be: repair, storage, or scrap' });
    }

    const result = await query(`
      SELECT shop_code, shop_name, region, city, state, tier, latitude, longitude
      FROM shops
      WHERE shop_designation = $1 AND is_active = true
      ORDER BY region, shop_name
    `, [designation]);

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Shops by designation error');
    res.status(500).json({ success: false, error: 'Failed to get shops by designation' });
  }
});

/**
 * @route   GET /api/shops/designation-summary
 * @desc    Get count of shops by designation
 * @access  Public
 */
router.get('/shops/designation-summary', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_shops_by_designation');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Designation summary error');
    res.status(500).json({ success: false, error: 'Failed to get designation summary' });
  }
});

/**
 * @route   PUT /api/shops/:shopCode/designation
 * @desc    Update shop designation (admin only)
 * @access  Protected - Admin only
 */
router.put('/shops/:shopCode/designation', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { shopCode } = req.params;
    const { designation } = req.body;

    if (!['repair', 'storage', 'scrap'].includes(designation)) {
      return res.status(400).json({ success: false, error: 'Invalid designation. Must be: repair, storage, or scrap' });
    }

    const result = await query(`
      UPDATE shops SET shop_designation = $2, updated_at = NOW()
      WHERE shop_code = $1
      RETURNING shop_code, shop_name, shop_designation, region
    `, [shopCode, designation]);

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    res.json({ success: true, data: result[0] });
  } catch (err) {
    logger.error({ err }, 'Update designation error');
    res.status(500).json({ success: false, error: 'Failed to update shop designation' });
  }
});

/**
 * @route   PUT /api/shops/bulk-designation
 * @desc    Bulk update shop designations (admin only)
 * @access  Protected - Admin only
 */
router.put('/shops/bulk-designation', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { shop_codes, designation } = req.body;

    if (!Array.isArray(shop_codes) || shop_codes.length === 0) {
      return res.status(400).json({ success: false, error: 'shop_codes array required' });
    }

    if (!['repair', 'storage', 'scrap'].includes(designation)) {
      return res.status(400).json({ success: false, error: 'Invalid designation' });
    }

    const result = await query(`
      UPDATE shops SET shop_designation = $2, updated_at = NOW()
      WHERE shop_code = ANY($1)
      RETURNING shop_code, shop_name, shop_designation
    `, [shop_codes, designation]);

    res.json({ success: true, data: result, updated: result.length });
  } catch (err) {
    logger.error({ err }, 'Bulk designation error');
    res.status(500).json({ success: false, error: 'Failed to bulk update designations' });
  }
});

/**
 * @route   GET /api/storage-commodities
 * @desc    Get list of commodities for storage prep
 * @access  Public
 */
router.get('/storage-commodities', optionalAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, cin, name, hazmat_class, requires_cleaning, requires_nitrogen, sort_order
      FROM storage_commodities
      WHERE is_active = true
      ORDER BY sort_order, name
    `);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Storage commodities error');
    res.status(500).json({ success: false, error: 'Failed to get storage commodities' });
  }
});

/**
 * @route   GET /api/shopping-types/:typeId/required-designation
 * @desc    Get required shop designation for a shopping type
 * @access  Public
 */
router.get('/shopping-types/:typeId/required-designation', optionalAuth, async (req, res) => {
  try {
    const { typeId } = req.params;
    const result = await query(`
      SELECT required_designation
      FROM shopping_type_designations
      WHERE shopping_type_id = $1
    `, [typeId]);

    // If no specific designation required, default to 'repair'
    const designation = result[0]?.required_designation || 'repair';
    res.json({ success: true, data: { required_designation: designation } });
  } catch (err) {
    logger.error({ err }, 'Required designation error');
    res.status(500).json({ success: false, error: 'Failed to get required designation' });
  }
});

/**
 * @route   GET /api/shops/for-shopping-type/:typeId
 * @desc    Get shops filtered by shopping type's required designation
 * @access  Public
 */
router.get('/shops/for-shopping-type/:typeId', optionalAuth, async (req, res) => {
  try {
    const { typeId } = req.params;

    // Get required designation for this shopping type
    const designationResult = await query(`
      SELECT required_designation
      FROM shopping_type_designations
      WHERE shopping_type_id = $1
    `, [typeId]);

    const designation = designationResult[0]?.required_designation || 'repair';

    // Get shops with that designation
    const shops = await query(`
      SELECT shop_code, shop_name, region, city, state, tier, latitude, longitude
      FROM shops
      WHERE shop_designation = $1 AND is_active = true
      ORDER BY region, shop_name
    `, [designation]);

    res.json({
      success: true,
      data: {
        required_designation: designation,
        shops: shops
      }
    });
  } catch (err) {
    logger.error({ err }, 'Shops for shopping type error');
    res.status(500).json({ success: false, error: 'Failed to get shops for shopping type' });
  }
});

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
// CONTRACTS HIERARCHY ROUTES (Customer → Lease → Rider → Cars)
// ============================================================================

import contractsController from '../controllers/contracts.controller';

// Customers
router.get('/customers', optionalAuth, contractsController.listCustomers);
router.get('/customers/:customerId', optionalAuth, contractsController.getCustomer);
router.get('/customers/:customerId/leases', optionalAuth, contractsController.getCustomerLeases);

// Leases
router.get('/leases/:leaseId', optionalAuth, contractsController.getLease);
router.get('/leases/:leaseId/riders', optionalAuth, contractsController.getLeaseRiders);

// Riders
router.get('/riders/:riderId', optionalAuth, contractsController.getRider);
router.get('/riders/:riderId/cars', optionalAuth, contractsController.getRiderCars);
router.get('/riders/:riderId/amendments', optionalAuth, contractsController.getRiderAmendments);
router.post('/riders/:riderId/resync-schedule', authenticate, authorize('admin', 'operator'), contractsController.resyncRiderSchedules);

// Amendments
router.get('/amendments/:amendmentId', optionalAuth, contractsController.getAmendment);
router.post('/amendments/:amendmentId/detect-conflicts', authenticate, contractsController.detectAmendmentConflicts);

// Contracts with Amendment Status
router.get('/contracts/cars-with-amendments', optionalAuth, contractsController.getCarsWithAmendments);

// Car Shopping Validation (checks for outdated terms)
router.get('/cars/:carNumber/validate-shopping', optionalAuth, contractsController.validateCarForShopping);

// ============================================================================
// SHOPPING CLASSIFICATION ROUTES
// ============================================================================

// Shopping Types (18 canonical types with cost allocation)
router.get('/shopping-types', authenticate, async (req, res) => {
  try {
    const types = await query(`
      SELECT id, code, name, description, is_planned, default_cost_owner, tier_preference, sort_order,
             estimated_cost, customer_billable, project_required
      FROM shopping_types WHERE is_active = TRUE ORDER BY sort_order
    `);
    res.json({ success: true, data: types });
  } catch (err) {
    logger.error({ err }, 'Shopping types error');
    res.status(500).json({ success: false, error: 'Failed to fetch shopping types' });
  }
});

// Shopping Reasons (filtered by type)
router.get('/shopping-reasons', authenticate, async (req, res) => {
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
    logger.error({ err }, 'Shopping reasons error');
    res.status(500).json({ success: false, error: 'Failed to fetch shopping reasons' });
  }
});

// ============================================================================
// SSE (Server-Sent Events) ROUTES - Real-time Capacity Updates
// ============================================================================

/**
 * @route   GET /api/events/capacity
 * @desc    Subscribe to real-time capacity change events via SSE
 * @access  Public (optionally authenticated)
 */
router.get('/events/capacity', sseController.subscribeToCapacityEvents);

/**
 * @route   GET /api/events/status
 * @desc    Get SSE connection status for monitoring
 * @access  Public
 */
router.get('/events/status', sseController.getConnectionStatus);

/**
 * @route   POST /api/events/test
 * @desc    Emit a test event for debugging
 * @access  Protected - Admin only
 */
router.post('/events/test', authenticate, authorize('admin'), sseController.emitTestEvent);

// ============================================================================
// ============================================================================
// MASTER PLAN VERSIONING
// ============================================================================

router.get('/master-plans', authenticate, masterPlanController.listMasterPlans);
router.get('/master-plans/versions/:versionId', authenticate, masterPlanController.getVersion);
router.get('/master-plans/versions/:versionId/allocations', authenticate, masterPlanController.getVersionAllocations);
router.post('/master-plans/versions/compare', authenticate, masterPlanController.compareVersions);
router.get('/master-plans/:id', authenticate, masterPlanController.getMasterPlan);
router.post('/master-plans', authenticate, authorize('admin', 'operator'), masterPlanController.createMasterPlan);
router.put('/master-plans/:id', authenticate, authorize('admin', 'operator'), masterPlanController.updateMasterPlan);
router.delete('/master-plans/:id', authenticate, authorize('admin'), masterPlanController.deleteMasterPlan);
router.get('/master-plans/:id/versions', authenticate, masterPlanController.listVersions);
router.post('/master-plans/:id/versions', authenticate, authorize('admin', 'operator'), masterPlanController.createVersion);

// MASTER PLAN — ALLOCATION MANAGEMENT
router.get('/master-plans/:id/stats', authenticate, masterPlanController.getPlanStats);
router.get('/master-plans/:id/allocations', authenticate, masterPlanController.listPlanAllocations);
router.post('/master-plans/:id/allocations/add-cars', authenticate, authorize('admin', 'operator'), masterPlanController.addCarsToPlan);
router.post('/master-plans/:id/allocations/import-demands', authenticate, authorize('admin', 'operator'), masterPlanController.importFromDemands);
router.delete('/master-plans/:id/allocations/:allocationId', authenticate, authorize('admin', 'operator'), masterPlanController.removeAllocationFromPlan);
router.put('/master-plans/:id/allocations/:allocationId/assign-shop', authenticate, authorize('admin', 'operator'), masterPlanController.assignShopToAllocation);

// MASTER PLAN — DEMAND MANAGEMENT
router.get('/master-plans/:id/demands', authenticate, masterPlanController.listPlanDemands);
router.post('/master-plans/:id/demands', authenticate, authorize('admin', 'operator'), masterPlanController.createDemandForPlan);

// CAR SEARCH (typeahead)
router.get('/cars-search', authenticate, masterPlanController.searchCars);

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get current user's notification preferences
 * @access  Protected
 */
router.get('/notifications/preferences', authenticate, notificationController.getPreferences);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update current user's notification preferences
 * @access  Protected
 */
router.put('/notifications/preferences', authenticate, notificationController.updatePreferences);

/**
 * @route   GET /api/notifications/queue/status
 * @desc    Get email queue status (admin only)
 * @access  Protected - Admin only
 */
router.get('/notifications/queue/status', authenticate, authorize('admin'), notificationController.getQueueStatus);

/**
 * @route   POST /api/notifications/queue/process
 * @desc    Manually process email queue (admin only)
 * @access  Protected - Admin only
 */
router.post('/notifications/queue/process', authenticate, authorize('admin'), notificationController.processQueue);

// ============================================================================
// CAPACITY RESERVATIONS (Master Planning)
// ============================================================================

/**
 * @route   GET /api/capacity/calendar
 * @desc    Get shop capacity calendar by month (base - reserved = available)
 * @access  Protected
 */
router.get('/capacity/calendar', authenticate, async (req, res) => {
  try {
    const shopCode = req.query.shop_code as string;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    let sql = `SELECT * FROM v_shop_capacity_calendar WHERE year >= $1`;
    const params: any[] = [year];

    if (shopCode) {
      sql += ` AND shop_code = $2`;
      params.push(shopCode);
    }

    sql += ` ORDER BY shop_name, year, month`;
    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Capacity calendar error');
    res.status(500).json({ success: false, error: 'Failed to fetch capacity calendar' });
  }
});

/**
 * @route   GET /api/capacity/reservations
 * @desc    List capacity reservations with filters
 * @access  Protected
 */
router.get('/capacity/reservations', authenticate, async (req, res) => {
  try {
    const { shop_code, lessee_code, status, year, month } = req.query;

    let sql = `SELECT * FROM v_capacity_reservations WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (shop_code) {
      paramCount++;
      sql += ` AND shop_code = $${paramCount}`;
      params.push(shop_code);
    }
    if (lessee_code) {
      paramCount++;
      sql += ` AND lessee_code = $${paramCount}`;
      params.push(lessee_code);
    }
    if (status) {
      paramCount++;
      sql += ` AND status = $${paramCount}`;
      params.push(status);
    }
    if (year) {
      paramCount++;
      sql += ` AND start_year <= $${paramCount} AND end_year >= $${paramCount}`;
      params.push(parseInt(year as string));
    }
    if (month && year) {
      paramCount++;
      sql += ` AND (
        (start_year < $${paramCount - 1}) OR
        (start_year = $${paramCount - 1} AND start_month <= $${paramCount})
      ) AND (
        (end_year > $${paramCount - 1}) OR
        (end_year = $${paramCount - 1} AND end_month >= $${paramCount})
      )`;
      params.push(parseInt(month as string));
    }

    sql += ` ORDER BY start_year, start_month, shop_name`;
    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Reservations list error');
    res.status(500).json({ success: false, error: 'Failed to fetch reservations' });
  }
});

/**
 * @route   GET /api/capacity/reservations/by-lessee
 * @desc    Get reservations summary by lessee
 * @access  Protected
 */
router.get('/capacity/reservations/by-lessee', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_reservations_by_lessee');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Reservations by lessee error');
    res.status(500).json({ success: false, error: 'Failed to fetch reservations by lessee' });
  }
});

/**
 * @route   GET /api/capacity/reservations/:id
 * @desc    Get single reservation details
 * @access  Protected
 */
router.get('/capacity/reservations/:id', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_capacity_reservations WHERE id = $1', [req.params.id]);
    if (result.length === 0) {
      res.status(404).json({ success: false, error: 'Reservation not found' });
      return;
    }
    res.json({ success: true, data: result[0] });
  } catch (err) {
    logger.error({ err }, 'Reservation get error');
    res.status(500).json({ success: false, error: 'Failed to fetch reservation' });
  }
});

/**
 * @route   POST /api/capacity/reservations
 * @desc    Create new capacity reservation
 * @access  Protected - Operator+
 */
router.post('/capacity/reservations', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { shop_code, lessee_code, lessee_name, start_year, start_month, end_year, end_month, reserved_slots, notes } = req.body;

    if (!shop_code || !lessee_code || !start_year || !start_month || !reserved_slots) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const userId = req.user?.id;

    const result = await query(`
      INSERT INTO capacity_reservations (shop_code, lessee_code, lessee_name, start_year, start_month, end_year, end_month, reserved_slots, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      shop_code, lessee_code, lessee_name || null,
      start_year, start_month,
      end_year || start_year, end_month || start_month,
      reserved_slots, notes || null, userId
    ]);

    const created = await query('SELECT * FROM v_capacity_reservations WHERE id = $1', [result[0].id]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    logger.error({ err }, 'Reservation create error');
    res.status(500).json({ success: false, error: 'Failed to create reservation' });
  }
});

/**
 * @route   PUT /api/capacity/reservations/:id
 * @desc    Update capacity reservation
 * @access  Protected - Operator+
 */
router.put('/capacity/reservations/:id', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { reserved_slots, end_year, end_month, notes } = req.body;

    await query(`
      UPDATE capacity_reservations
      SET reserved_slots = COALESCE($1, reserved_slots),
          end_year = COALESCE($2, end_year),
          end_month = COALESCE($3, end_month),
          notes = COALESCE($4, notes),
          updated_at = NOW()
      WHERE id = $5
    `, [reserved_slots, end_year, end_month, notes, req.params.id]);

    const updated = await query('SELECT * FROM v_capacity_reservations WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Reservation update error');
    res.status(500).json({ success: false, error: 'Failed to update reservation' });
  }
});

/**
 * @route   POST /api/capacity/reservations/:id/confirm
 * @desc    Confirm reservation (hard block capacity)
 * @access  Protected - Operator+
 */
router.post('/capacity/reservations/:id/confirm', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const userId = req.user?.id;

    // Check capacity before confirming
    const reservation = await query('SELECT * FROM capacity_reservations WHERE id = $1', [req.params.id]);
    if (reservation.length === 0) {
      res.status(404).json({ success: false, error: 'Reservation not found' });
      return;
    }

    const r = reservation[0];
    if (r.status !== 'draft') {
      res.status(400).json({ success: false, error: 'Only draft reservations can be confirmed' });
      return;
    }

    // Check if capacity is available
    const capacityCheck = await query(`
      SELECT * FROM check_reservation_capacity($1, $2, $3, $4, $5, $6, $7)
    `, [r.shop_code, r.start_year, r.start_month, r.end_year, r.end_month, r.reserved_slots, r.id]);

    const wouldExceed = capacityCheck.some((c: any) => c.would_exceed);
    if (wouldExceed) {
      res.status(400).json({
        success: false,
        error: 'Insufficient capacity for some months',
        data: capacityCheck
      });
      return;
    }

    await query(`
      UPDATE capacity_reservations
      SET status = 'confirmed', confirmed_at = NOW(), confirmed_by = $1, updated_at = NOW()
      WHERE id = $2
    `, [userId, req.params.id]);

    const updated = await query('SELECT * FROM v_capacity_reservations WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Reservation confirm error');
    res.status(500).json({ success: false, error: 'Failed to confirm reservation' });
  }
});

/**
 * @route   POST /api/capacity/reservations/:id/cancel
 * @desc    Cancel reservation (release capacity)
 * @access  Protected - Operator+
 */
router.post('/capacity/reservations/:id/cancel', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    await query(`
      UPDATE capacity_reservations
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
    `, [req.params.id]);

    const updated = await query('SELECT * FROM v_capacity_reservations WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Reservation cancel error');
    res.status(500).json({ success: false, error: 'Failed to cancel reservation' });
  }
});

/**
 * @route   POST /api/capacity/reservations/:id/rollover
 * @desc    Roll over unfilled slots to next month
 * @access  Protected - Operator+
 */
router.post('/capacity/reservations/:id/rollover', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const result = await query('SELECT rollover_reservation($1) AS new_id', [req.params.id]);
    const newReservation = await query('SELECT * FROM v_capacity_reservations WHERE id = $1', [result[0].new_id]);
    res.json({ success: true, data: newReservation[0] });
  } catch (err: any) {
    logger.error({ err }, 'Reservation rollover error');
    res.status(400).json({ success: false, error: err.message || 'Failed to rollover reservation' });
  }
});

/**
 * @route   POST /api/capacity/reservations/:id/allocate
 * @desc    Bulk allocate cars to fill a reservation
 * @access  Protected - Operator+
 */
router.post('/capacity/reservations/:id/allocate', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { car_numbers } = req.body;

    if (!car_numbers || !Array.isArray(car_numbers) || car_numbers.length === 0) {
      res.status(400).json({ success: false, error: 'car_numbers array required' });
      return;
    }

    // Get reservation details
    const reservation = await query('SELECT * FROM v_capacity_reservations WHERE id = $1', [req.params.id]);
    if (reservation.length === 0) {
      res.status(404).json({ success: false, error: 'Reservation not found' });
      return;
    }

    const r = reservation[0];
    if (r.status !== 'confirmed') {
      res.status(400).json({ success: false, error: 'Only confirmed reservations can have cars allocated' });
      return;
    }

    const remaining = r.reserved_slots - r.allocated_slots;
    if (car_numbers.length > remaining) {
      res.status(400).json({ success: false, error: `Cannot allocate ${car_numbers.length} cars, only ${remaining} slots remaining` });
      return;
    }

    // Create allocations for each car
    const userId = req.user?.id;
    const targetMonth = `${r.start_year}-${String(r.start_month).padStart(2, '0')}`;

    for (const carNumber of car_numbers) {
      // Verify car belongs to this lessee
      const car = await query('SELECT * FROM cars WHERE car_number = $1', [carNumber]);
      if (car.length === 0) {
        continue; // Skip unknown cars
      }
      if (car[0].lessee_code !== r.lessee_code) {
        continue; // Skip cars not belonging to this lessee
      }

      // Create allocation
      await query(`
        INSERT INTO allocations (car_number, shop_code, target_month, status, reservation_id, created_by, work_type)
        VALUES ($1, $2, $3, 'pending', $4, $5, 'Reservation')
      `, [carNumber, r.shop_code, targetMonth, req.params.id, userId]);
    }

    // Update allocated count
    const allocatedCount = await query(`
      SELECT COUNT(*) AS count FROM allocations WHERE reservation_id = $1 AND status != 'cancelled'
    `, [req.params.id]);

    await query(`
      UPDATE capacity_reservations
      SET allocated_slots = $1,
          status = CASE WHEN $1 >= reserved_slots THEN 'fulfilled' ELSE status END,
          updated_at = NOW()
      WHERE id = $2
    `, [parseInt(allocatedCount[0].count), req.params.id]);

    const updated = await query('SELECT * FROM v_capacity_reservations WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Reservation allocate error');
    res.status(500).json({ success: false, error: 'Failed to allocate cars to reservation' });
  }
});

/**
 * @route   GET /api/capacity/check
 * @desc    Check if capacity is available for a proposed reservation
 * @access  Protected
 */
router.get('/capacity/check', authenticate, async (req, res) => {
  try {
    const { shop_code, start_year, start_month, end_year, end_month, slots } = req.query;

    if (!shop_code || !start_year || !start_month || !slots) {
      res.status(400).json({ success: false, error: 'Missing required parameters' });
      return;
    }

    const result = await query(`
      SELECT * FROM check_reservation_capacity($1, $2, $3, $4, $5, $6)
    `, [
      shop_code,
      parseInt(start_year as string),
      parseInt(start_month as string),
      parseInt((end_year || start_year) as string),
      parseInt((end_month || start_month) as string),
      parseInt(slots as string)
    ]);

    res.json({
      success: true,
      data: result,
      available: !result.some((c: any) => c.would_exceed)
    });
  } catch (err) {
    logger.error({ err }, 'Capacity check error');
    res.status(500).json({ success: false, error: 'Failed to check capacity' });
  }
});

// ============================================================================
// CCM DOCUMENT MANAGEMENT
// ============================================================================

/**
 * @route   GET /api/ccm-documents
 * @desc    List CCM documents (current versions by default)
 * @access  Protected
 */
router.get('/ccm-documents', authenticate, async (req, res) => {
  try {
    const { lessee_code, include_history } = req.query;

    let sql = include_history === 'true'
      ? 'SELECT * FROM v_ccm_document_history'
      : 'SELECT * FROM v_current_ccm_documents';

    const params: any[] = [];
    if (lessee_code) {
      sql += ' WHERE lessee_code = $1';
      params.push(lessee_code);
    }

    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'CCM documents error');
    res.status(500).json({ success: false, error: 'Failed to fetch CCM documents' });
  }
});

/**
 * @route   GET /api/ccm-documents/:id
 * @desc    Get single CCM document
 * @access  Protected
 */
router.get('/ccm-documents/:id', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_current_ccm_documents WHERE id = $1', [req.params.id]);
    if (result.length === 0) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }
    res.json({ success: true, data: result[0] });
  } catch (err) {
    logger.error({ err }, 'CCM document get error');
    res.status(500).json({ success: false, error: 'Failed to fetch document' });
  }
});

/**
 * @route   POST /api/ccm-documents
 * @desc    Upload new CCM document (metadata only - file handling separate)
 * @access  Protected - Operator+
 */
router.post('/ccm-documents', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { lessee_code, lessee_name, document_name, file_path, file_size_bytes, description, effective_date, expiration_date } = req.body;

    if (!lessee_code || !document_name || !file_path) {
      res.status(400).json({ success: false, error: 'lessee_code, document_name, and file_path required' });
      return;
    }

    const userId = req.user?.id;

    // Mark previous versions as not current
    await query(`
      UPDATE ccm_documents SET is_current = FALSE, updated_at = NOW()
      WHERE lessee_code = $1 AND document_name = $2 AND is_current = TRUE
    `, [lessee_code, document_name]);

    // Get the next version number
    const versionResult = await query(`
      SELECT COALESCE(MAX(version), 0) + 1 AS next_version
      FROM ccm_documents WHERE lessee_code = $1 AND document_name = $2
    `, [lessee_code, document_name]);

    const result = await query(`
      INSERT INTO ccm_documents (lessee_code, lessee_name, document_name, file_path, file_size_bytes, description, effective_date, expiration_date, version, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [lessee_code, lessee_name, document_name, file_path, file_size_bytes, description, effective_date, expiration_date, versionResult[0].next_version, userId]);

    const created = await query('SELECT * FROM v_current_ccm_documents WHERE id = $1', [result[0].id]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    logger.error({ err }, 'CCM document create error');
    res.status(500).json({ success: false, error: 'Failed to create document' });
  }
});

/**
 * @route   DELETE /api/ccm-documents/:id
 * @desc    Delete CCM document
 * @access  Protected - Admin only
 */
router.delete('/ccm-documents/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await query('DELETE FROM ccm_documents WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    logger.error({ err }, 'CCM document delete error');
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
});

// ============================================================================
// RIDERS (Lease Amendments)
// ============================================================================

/**
 * @route   GET /api/riders
 * @desc    List riders with summary info
 * @access  Protected
 */
router.get('/riders', authenticate, async (req, res) => {
  try {
    const { lessee_code, contract_base } = req.query;

    let sql = 'SELECT * FROM v_riders_summary WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (lessee_code) {
      paramCount++;
      sql += ` AND lessee_code = $${paramCount}`;
      params.push(lessee_code);
    }
    if (contract_base) {
      paramCount++;
      sql += ` AND contract_base = $${paramCount}`;
      params.push(contract_base);
    }

    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Riders error');
    res.status(500).json({ success: false, error: 'Failed to fetch riders' });
  }
});

/**
 * @route   GET /api/riders/:id
 * @desc    Get single rider with cars
 * @access  Protected
 */
router.get('/riders/:id', authenticate, async (req, res) => {
  try {
    const rider = await query('SELECT * FROM v_riders_summary WHERE id = $1', [req.params.id]);
    if (rider.length === 0) {
      res.status(404).json({ success: false, error: 'Rider not found' });
      return;
    }

    const cars = await query(`
      SELECT car_number, car_type, commodity, tank_qual_year, current_status
      FROM cars WHERE rider_id = $1 ORDER BY car_number
    `, [req.params.id]);

    res.json({ success: true, data: { ...rider[0], cars } });
  } catch (err) {
    logger.error({ err }, 'Rider get error');
    res.status(500).json({ success: false, error: 'Failed to fetch rider' });
  }
});

/**
 * @route   POST /api/riders/populate
 * @desc    Populate riders table from car contract_number data
 * @access  Protected - Admin only
 */
router.post('/riders/populate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query('SELECT populate_riders_from_cars() AS count');
    res.json({ success: true, data: { inserted: result[0].count } });
  } catch (err) {
    logger.error({ err }, 'Riders populate error');
    res.status(500).json({ success: false, error: 'Failed to populate riders' });
  }
});

/**
 * @route   PUT /api/riders/:id
 * @desc    Update rider details
 * @access  Protected - Operator+
 */
router.put('/riders/:id', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { terms_summary, effective_date, expiration_date } = req.body;

    await query(`
      UPDATE riders SET
        terms_summary = COALESCE($1, terms_summary),
        effective_date = COALESCE($2, effective_date),
        expiration_date = COALESCE($3, expiration_date),
        updated_at = NOW()
      WHERE id = $4
    `, [terms_summary, effective_date, expiration_date, req.params.id]);

    const updated = await query('SELECT * FROM v_riders_summary WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Rider update error');
    res.status(500).json({ success: false, error: 'Failed to update rider' });
  }
});

// ============================================================================
// BILLABLE ITEMS (Lessee Responsible Matrix)
// ============================================================================

/**
 * @route   GET /api/billable-items
 * @desc    List billable items
 * @access  Protected
 */
router.get('/billable-items', authenticate, async (req, res) => {
  try {
    const { lessee_code, rider_id, customer_responsible } = req.query;

    let sql = 'SELECT * FROM v_billable_items WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (lessee_code) {
      paramCount++;
      sql += ` AND lessee_code = $${paramCount}`;
      params.push(lessee_code);
    }
    if (rider_id) {
      paramCount++;
      sql += ` AND rider_id = $${paramCount}`;
      params.push(rider_id);
    }
    if (customer_responsible !== undefined) {
      paramCount++;
      sql += ` AND is_customer_responsible = $${paramCount}`;
      params.push(customer_responsible === 'true');
    }

    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Billable items error');
    res.status(500).json({ success: false, error: 'Failed to fetch billable items' });
  }
});

/**
 * @route   GET /api/billable-items/summary
 * @desc    Get billable items summary by lessee
 * @access  Protected
 */
router.get('/billable-items/summary', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_lessee_billable_summary');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Billable summary error');
    res.status(500).json({ success: false, error: 'Failed to fetch billable summary' });
  }
});

/**
 * @route   POST /api/billable-items
 * @desc    Create billable item
 * @access  Protected - Operator+
 */
router.post('/billable-items', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { lessee_code, rider_id, commodity, car_type, item_code, item_description, is_customer_responsible, billing_notes } = req.body;

    if (!lessee_code || !item_code || !item_description) {
      res.status(400).json({ success: false, error: 'lessee_code, item_code, and item_description required' });
      return;
    }

    const userId = req.user?.id;

    const result = await query(`
      INSERT INTO billable_items (lessee_code, rider_id, commodity, car_type, item_code, item_description, is_customer_responsible, billing_notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [lessee_code, rider_id, commodity, car_type, item_code, item_description, is_customer_responsible || false, billing_notes, userId]);

    const created = await query('SELECT * FROM v_billable_items WHERE id = $1', [result[0].id]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    logger.error({ err }, 'Billable item create error');
    res.status(500).json({ success: false, error: 'Failed to create billable item' });
  }
});

/**
 * @route   PUT /api/billable-items/:id
 * @desc    Update billable item
 * @access  Protected - Operator+
 */
router.put('/billable-items/:id', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { item_description, is_customer_responsible, billing_notes } = req.body;

    await query(`
      UPDATE billable_items SET
        item_description = COALESCE($1, item_description),
        is_customer_responsible = COALESCE($2, is_customer_responsible),
        billing_notes = COALESCE($3, billing_notes),
        updated_at = NOW()
      WHERE id = $4
    `, [item_description, is_customer_responsible, billing_notes, req.params.id]);

    const updated = await query('SELECT * FROM v_billable_items WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Billable item update error');
    res.status(500).json({ success: false, error: 'Failed to update billable item' });
  }
});

/**
 * @route   DELETE /api/billable-items/:id
 * @desc    Delete billable item
 * @access  Protected - Admin only
 */
router.delete('/billable-items/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await query('DELETE FROM billable_items WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Billable item deleted' });
  } catch (err) {
    logger.error({ err }, 'Billable item delete error');
    res.status(500).json({ success: false, error: 'Failed to delete billable item' });
  }
});

/**
 * @route   GET /api/cars/:carNumber/billable-items
 * @desc    Get applicable billable items for a specific car
 * @access  Protected
 */
router.get('/cars/:carNumber/billable-items', authenticate, async (req, res) => {
  try {
    const car = await query('SELECT lessee_code, rider_id, commodity, car_type FROM cars WHERE car_number = $1', [req.params.carNumber]);
    if (car.length === 0) {
      res.status(404).json({ success: false, error: 'Car not found' });
      return;
    }

    const c = car[0];

    // Get billable items that match this car's lessee, rider, commodity, or car_type
    const items = await query(`
      SELECT * FROM v_billable_items
      WHERE lessee_code = $1
        AND (rider_id IS NULL OR rider_id = $2)
        AND (commodity IS NULL OR commodity = $3)
        AND (car_type IS NULL OR car_type = $4)
      ORDER BY
        CASE WHEN rider_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN commodity IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN car_type IS NOT NULL THEN 0 ELSE 1 END,
        item_code
    `, [c.lessee_code, c.rider_id, c.commodity, c.car_type]);

    res.json({ success: true, data: items });
  } catch (err) {
    logger.error({ err }, 'Car billable items error');
    res.status(500).json({ success: false, error: 'Failed to fetch billable items for car' });
  }
});

// ============================================================================
// SHOPPING PACKETS
// ============================================================================

/**
 * @route   GET /api/shopping-packets
 * @desc    List shopping packets
 * @access  Protected
 */
router.get('/shopping-packets', authenticate, async (req, res) => {
  try {
    const { status, car_number, allocation_id } = req.query;

    let sql = 'SELECT * FROM v_shopping_packets WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      sql += ` AND status = $${paramCount}`;
      params.push(status);
    }
    if (car_number) {
      paramCount++;
      sql += ` AND car_number = $${paramCount}`;
      params.push(car_number);
    }
    if (allocation_id) {
      paramCount++;
      sql += ` AND allocation_id = $${paramCount}`;
      params.push(allocation_id);
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Shopping packets error');
    res.status(500).json({ success: false, error: 'Failed to fetch shopping packets' });
  }
});

/**
 * @route   GET /api/shopping-packets/pending
 * @desc    Get packets pending issue
 * @access  Protected
 */
router.get('/shopping-packets/pending', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_packets_pending');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Pending packets error');
    res.status(500).json({ success: false, error: 'Failed to fetch pending packets' });
  }
});

/**
 * @route   GET /api/shopping-packets/recent
 * @desc    Get recently issued packets (last 7 days)
 * @access  Protected
 */
router.get('/shopping-packets/recent', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_packets_recent');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Recent packets error');
    res.status(500).json({ success: false, error: 'Failed to fetch recent packets' });
  }
});

/**
 * @route   GET /api/shopping-packets/:id
 * @desc    Get single packet
 * @access  Protected
 */
router.get('/shopping-packets/:id', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_shopping_packets WHERE id = $1', [req.params.id]);
    if (result.length === 0) {
      res.status(404).json({ success: false, error: 'Packet not found' });
      return;
    }
    res.json({ success: true, data: result[0] });
  } catch (err) {
    logger.error({ err }, 'Packet get error');
    res.status(500).json({ success: false, error: 'Failed to fetch packet' });
  }
});

/**
 * @route   POST /api/shopping-packets
 * @desc    Create shopping packet for an allocation
 * @access  Protected - Operator+
 */
router.post('/shopping-packets', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { allocation_id } = req.body;

    if (!allocation_id) {
      res.status(400).json({ success: false, error: 'allocation_id required' });
      return;
    }

    const userId = req.user?.id;
    const result = await query('SELECT create_shopping_packet($1, $2) AS id', [allocation_id, userId]);

    const packet = await query('SELECT * FROM v_shopping_packets WHERE id = $1', [result[0].id]);
    res.status(201).json({ success: true, data: packet[0] });
  } catch (err: any) {
    logger.error({ err }, 'Packet create error');
    res.status(400).json({ success: false, error: err.message || 'Failed to create packet' });
  }
});

/**
 * @route   PUT /api/shopping-packets/:id
 * @desc    Update packet details
 * @access  Protected - Operator+
 */
router.put('/shopping-packets/:id', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { shopping_types, shopping_reasons, scope_of_work, special_instructions } = req.body;

    await query(`
      UPDATE shopping_packets SET
        shopping_types = COALESCE($1, shopping_types),
        shopping_reasons = COALESCE($2, shopping_reasons),
        scope_of_work = COALESCE($3, scope_of_work),
        special_instructions = COALESCE($4, special_instructions),
        updated_at = NOW()
      WHERE id = $5
    `, [
      shopping_types ? JSON.stringify(shopping_types) : null,
      shopping_reasons ? JSON.stringify(shopping_reasons) : null,
      scope_of_work,
      special_instructions,
      req.params.id
    ]);

    const updated = await query('SELECT * FROM v_shopping_packets WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Packet update error');
    res.status(500).json({ success: false, error: 'Failed to update packet' });
  }
});

/**
 * @route   POST /api/shopping-packets/:id/issue
 * @desc    Issue packet (send to shop)
 * @access  Protected - Operator+
 */
router.post('/shopping-packets/:id/issue', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { email_to } = req.body;
    const userId = req.user?.id;

    await query(`
      UPDATE shopping_packets SET
        status = 'issued',
        issued_at = NOW(),
        issued_by = $1,
        issued_to = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [userId, email_to, req.params.id]);

    const updated = await query('SELECT * FROM v_shopping_packets WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Packet issue error');
    res.status(500).json({ success: false, error: 'Failed to issue packet' });
  }
});

/**
 * @route   POST /api/shopping-packets/:id/reissue
 * @desc    Reissue packet (creates new version)
 * @access  Protected - Operator+
 */
router.post('/shopping-packets/:id/reissue', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, error: 'reason required' });
      return;
    }

    const userId = req.user?.id;
    const result = await query('SELECT reissue_shopping_packet($1, $2, $3) AS id', [req.params.id, userId, reason]);

    const packet = await query('SELECT * FROM v_shopping_packets WHERE id = $1', [result[0].id]);
    res.json({ success: true, data: packet[0] });
  } catch (err: any) {
    logger.error({ err }, 'Packet reissue error');
    res.status(400).json({ success: false, error: err.message || 'Failed to reissue packet' });
  }
});

/**
 * @route   GET /api/allocations/:id/packet-history
 * @desc    Get packet history for an allocation
 * @access  Protected
 */
router.get('/allocations/:id/packet-history', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_packet_history WHERE allocation_id = $1', [req.params.id]);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Packet history error');
    res.status(500).json({ success: false, error: 'Failed to fetch packet history' });
  }
});

// ============================================================================
// PROJECTS (Car Grouping for Coordinated Work)
// ============================================================================

/**
 * @route   GET /api/projects
 * @desc    List all projects
 * @access  Protected
 */
router.get('/projects', authenticate, async (req, res) => {
  try {
    const { status, type, lessee_code, mc_user_id, active_only } = req.query;

    let sql = active_only === 'true' ? 'SELECT * FROM v_active_projects WHERE 1=1' : 'SELECT * FROM v_projects WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      sql += ` AND status = $${paramCount}`;
      params.push(status);
    }
    if (type) {
      paramCount++;
      sql += ` AND project_type = $${paramCount}`;
      params.push(type);
    }
    if (lessee_code) {
      paramCount++;
      sql += ` AND lessee_code = $${paramCount}`;
      params.push(lessee_code);
    }
    if (mc_user_id) {
      paramCount++;
      sql += ` AND mc_user_id = $${paramCount}`;
      params.push(mc_user_id);
    }

    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Projects error');
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
});

/**
 * @route   GET /api/projects/summary
 * @desc    Get projects summary by type
 * @access  Protected
 */
router.get('/projects/summary', authenticate, async (req, res) => {
  try {
    const [byType, byMc] = await Promise.all([
      query('SELECT * FROM v_projects_by_type'),
      query('SELECT * FROM v_projects_by_mc')
    ]);
    res.json({ success: true, data: { by_type: byType, by_mc: byMc } });
  } catch (err) {
    logger.error({ err }, 'Projects summary error');
    res.status(500).json({ success: false, error: 'Failed to fetch projects summary' });
  }
});

/**
 * @route   GET /api/projects/:id
 * @desc    Get single project with cars
 * @access  Protected
 */
router.get('/projects/:id', authenticate, async (req, res) => {
  try {
    const project = await query('SELECT * FROM v_projects WHERE id = $1', [req.params.id]);
    if (project.length === 0) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const cars = await query('SELECT * FROM v_project_cars WHERE project_id = $1 ORDER BY added_at', [req.params.id]);

    res.json({ success: true, data: { ...project[0], cars } });
  } catch (err) {
    logger.error({ err }, 'Project get error');
    res.status(500).json({ success: false, error: 'Failed to fetch project' });
  }
});

/**
 * @route   POST /api/projects
 * @desc    Create new project
 * @access  Protected - Operator+
 */
router.post('/projects', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const {
      project_name, project_type, shopping_reason_id, scope_of_work, special_instructions,
      customer_billable, estimated_total_cost, lessee_code, lessee_name, due_date, priority,
      mc_user_id, ec_user_id
    } = req.body;

    if (!project_name || !project_type || !scope_of_work) {
      res.status(400).json({ success: false, error: 'project_name, project_type, and scope_of_work required' });
      return;
    }

    const userId = req.user?.id;

    // Get shopping reason details if provided
    let reasonCode = null, reasonName = null;
    if (shopping_reason_id) {
      const reason = await query('SELECT code, name FROM shopping_reasons WHERE id = $1', [shopping_reason_id]);
      if (reason.length > 0) {
        reasonCode = reason[0].code;
        reasonName = reason[0].name;
      }
    }

    // Generate project number
    const projectNumber = await query('SELECT generate_project_number($1) AS num', [project_type]);

    const result = await query(`
      INSERT INTO projects (
        project_number, project_name, project_type, shopping_reason_id, shopping_reason_code, shopping_reason_name,
        scope_of_work, special_instructions, customer_billable, estimated_total_cost,
        lessee_code, lessee_name, due_date, priority, mc_user_id, ec_user_id, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'draft')
      RETURNING id
    `, [
      projectNumber[0].num, project_name, project_type, shopping_reason_id, reasonCode, reasonName,
      scope_of_work, special_instructions, customer_billable || false, estimated_total_cost || 0,
      lessee_code, lessee_name, due_date, priority || 2, mc_user_id, ec_user_id, userId
    ]);

    const created = await query('SELECT * FROM v_projects WHERE id = $1', [result[0].id]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    logger.error({ err }, 'Project create error');
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Protected - Operator+
 */
router.put('/projects/:id', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const {
      project_name, scope_of_work, special_instructions, engineer_notes,
      customer_billable, estimated_total_cost, due_date, priority, mc_user_id, ec_user_id, status
    } = req.body;

    await query(`
      UPDATE projects SET
        project_name = COALESCE($1, project_name),
        scope_of_work = COALESCE($2, scope_of_work),
        special_instructions = COALESCE($3, special_instructions),
        engineer_notes = COALESCE($4, engineer_notes),
        customer_billable = COALESCE($5, customer_billable),
        estimated_total_cost = COALESCE($6, estimated_total_cost),
        due_date = COALESCE($7, due_date),
        priority = COALESCE($8, priority),
        mc_user_id = COALESCE($9, mc_user_id),
        ec_user_id = COALESCE($10, ec_user_id),
        status = COALESCE($11, status),
        updated_at = NOW()
      WHERE id = $12
    `, [project_name, scope_of_work, special_instructions, engineer_notes, customer_billable, estimated_total_cost, due_date, priority, mc_user_id, ec_user_id, status, req.params.id]);

    const updated = await query('SELECT * FROM v_projects WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Project update error');
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

/**
 * @route   POST /api/projects/:id/activate
 * @desc    Activate project (change from draft to active)
 * @access  Protected - Operator+
 */
router.post('/projects/:id/activate', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    await query(`UPDATE projects SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'draft'`, [req.params.id]);
    const updated = await query('SELECT * FROM v_projects WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Project activate error');
    res.status(500).json({ success: false, error: 'Failed to activate project' });
  }
});

/**
 * @route   POST /api/projects/:id/complete
 * @desc    Complete project (MC designates via BRC review)
 * @access  Protected - Operator+
 */
router.post('/projects/:id/complete', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { completion_notes } = req.body;
    const userId = req.user?.id;

    await query(`
      UPDATE projects SET
        status = 'completed',
        completed_at = NOW(),
        completed_by = $1,
        completion_notes = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [userId, completion_notes, req.params.id]);

    // Mark all pending/in_progress cars as completed
    await query(`
      UPDATE project_cars SET
        status = 'completed',
        completed_at = NOW(),
        completed_by = $1
      WHERE project_id = $2 AND status IN ('pending', 'in_progress')
    `, [userId, req.params.id]);

    const updated = await query('SELECT * FROM v_projects WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Project complete error');
    res.status(500).json({ success: false, error: 'Failed to complete project' });
  }
});

/**
 * @route   POST /api/projects/:id/cars
 * @desc    Add cars to project
 * @access  Protected - Operator+
 */
router.post('/projects/:id/cars', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { car_numbers } = req.body;

    if (!car_numbers || !Array.isArray(car_numbers) || car_numbers.length === 0) {
      res.status(400).json({ success: false, error: 'car_numbers array required' });
      return;
    }

    const userId = req.user?.id;
    let added = 0;

    for (const carNumber of car_numbers) {
      try {
        await query(`
          INSERT INTO project_cars (project_id, car_number, added_by)
          VALUES ($1, $2, $3)
          ON CONFLICT (project_id, car_number) DO NOTHING
        `, [req.params.id, carNumber, userId]);
        added++;
      } catch (e) {
        // Skip invalid car numbers
      }
    }

    const cars = await query('SELECT * FROM v_project_cars WHERE project_id = $1', [req.params.id]);
    res.json({ success: true, data: { added, cars } });
  } catch (err) {
    logger.error({ err }, 'Add cars error');
    res.status(500).json({ success: false, error: 'Failed to add cars to project' });
  }
});

/**
 * @route   DELETE /api/projects/:projectId/cars/:carNumber
 * @desc    Remove car from project
 * @access  Protected - Operator+
 */
router.delete('/projects/:projectId/cars/:carNumber', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    await query('DELETE FROM project_cars WHERE project_id = $1 AND car_number = $2', [req.params.projectId, req.params.carNumber]);
    res.json({ success: true, message: 'Car removed from project' });
  } catch (err) {
    logger.error({ err }, 'Remove car error');
    res.status(500).json({ success: false, error: 'Failed to remove car from project' });
  }
});

/**
 * @route   PUT /api/projects/:projectId/cars/:carNumber/status
 * @desc    Update car status within project
 * @access  Protected - Operator+
 */
router.put('/projects/:projectId/cars/:carNumber/status', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { status, completion_notes } = req.body;
    const userId = req.user?.id;

    if (!['pending', 'in_progress', 'completed', 'excluded'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const updates = status === 'completed'
      ? `status = $1, completed_at = NOW(), completed_by = $2, completion_notes = $3`
      : `status = $1`;

    const params = status === 'completed'
      ? [status, userId, completion_notes, req.params.projectId, req.params.carNumber]
      : [status, req.params.projectId, req.params.carNumber];

    await query(`
      UPDATE project_cars SET ${updates}
      WHERE project_id = $${status === 'completed' ? 4 : 2} AND car_number = $${status === 'completed' ? 5 : 3}
    `, params);

    const updated = await query('SELECT * FROM v_project_cars WHERE project_id = $1 AND car_number = $2', [req.params.projectId, req.params.carNumber]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Update car status error');
    res.status(500).json({ success: false, error: 'Failed to update car status' });
  }
});

/**
 * @route   POST /api/projects/:projectId/cars/:carNumber/brc-review
 * @desc    Mark car as BRC reviewed (MC approval)
 * @access  Protected - Operator+
 */
router.post('/projects/:projectId/cars/:carNumber/brc-review', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const userId = req.user?.id;

    await query(`
      UPDATE project_cars SET
        brc_reviewed = TRUE,
        brc_reviewed_at = NOW(),
        brc_reviewed_by = $1,
        status = 'completed',
        completed_at = NOW(),
        completed_by = $1
      WHERE project_id = $2 AND car_number = $3
    `, [userId, req.params.projectId, req.params.carNumber]);

    const updated = await query('SELECT * FROM v_project_cars WHERE project_id = $1 AND car_number = $2', [req.params.projectId, req.params.carNumber]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    logger.error({ err }, 'BRC review error');
    res.status(500).json({ success: false, error: 'Failed to mark BRC reviewed' });
  }
});

/**
 * @route   GET /api/cars/:carNumber/project-history
 * @desc    Get all projects a car has been in
 * @access  Protected
 */
router.get('/cars/:carNumber/project-history', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_car_project_history WHERE car_number = $1', [req.params.carNumber]);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Car project history error');
    res.status(500).json({ success: false, error: 'Failed to fetch car project history' });
  }
});

// ============================================================================
// PROJECT PLANNING ROUTES
// ============================================================================

/**
 * @route   POST /api/projects/:id/plan-cars
 * @desc    Create planned assignments for project cars
 * @access  Protected - Operator+
 */
router.post('/projects/:id/plan-cars', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { cars } = req.body;

    if (!cars || !Array.isArray(cars) || cars.length === 0) {
      res.status(400).json({ success: false, error: 'cars array is required' });
      return;
    }

    const result = await projectPlanningService.planCars({
      project_id: req.params.id,
      cars,
      created_by_id: userId,
      created_by_email: userEmail,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Plan cars error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   POST /api/projects/:id/lock-cars
 * @desc    Lock selected planned assignments (creates SSOT records)
 * @access  Protected - Operator+
 */
router.post('/projects/:id/lock-cars', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { assignment_ids } = req.body;

    if (!assignment_ids || !Array.isArray(assignment_ids) || assignment_ids.length === 0) {
      res.status(400).json({ success: false, error: 'assignment_ids array is required' });
      return;
    }

    const result = await projectPlanningService.lockCars({
      project_id: req.params.id,
      assignment_ids,
      locked_by_id: userId,
      locked_by_email: userEmail,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Lock cars error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   POST /api/projects/:id/relock-car
 * @desc    Relock a car (supersede + create new locked assignment)
 * @access  Protected - Operator+
 */
router.post('/projects/:id/relock-car', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { project_assignment_id, new_shop_code, new_target_month, new_target_date, new_estimated_cost, reason } = req.body;

    if (!project_assignment_id || !new_shop_code || !new_target_month || !reason) {
      res.status(400).json({ success: false, error: 'project_assignment_id, new_shop_code, new_target_month, and reason are required' });
      return;
    }

    const result = await projectPlanningService.relockCar({
      project_id: req.params.id,
      project_assignment_id,
      new_shop_code,
      new_target_month,
      new_target_date,
      new_estimated_cost,
      reason,
      relocked_by_id: userId,
      relocked_by_email: userEmail,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Relock car error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   POST /api/projects/:id/cancel-plan
 * @desc    Cancel a car's plan
 * @access  Protected - Operator+
 */
router.post('/projects/:id/cancel-plan', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { project_assignment_id, reason } = req.body;

    if (!project_assignment_id || !reason) {
      res.status(400).json({ success: false, error: 'project_assignment_id and reason are required' });
      return;
    }

    const result = await projectPlanningService.cancelPlan({
      project_id: req.params.id,
      project_assignment_id,
      reason,
      cancelled_by_id: userId,
      cancelled_by_email: userEmail,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Cancel plan error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   POST /api/projects/:projectId/assignments/:id/unlock
 * @desc    Unlock a locked assignment (Locked -> Planned), cancels SSOT car_assignment
 * @access  Protected - Operator+
 */
router.post('/projects/:projectId/assignments/:id/unlock', authenticate, authorize('admin', 'operator'), async (req, res, next) => {
  try {
    const result = await projectPlanningService.unlockPlan(
      req.params.projectId,
      req.params.id,
      req.user.id,
      req.body.notes
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/projects/:id/create-demand
 * @desc    Create a demand linked to this project (Path 2: demand-linked planning)
 * @access  Protected - Operator+
 */
router.post('/projects/:id/create-demand', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const projectId = req.params.id;

    // Verify project exists and is active
    const project = await query('SELECT id, project_number, project_name, lessee_code FROM projects WHERE id = $1', [projectId]);
    if (!project.length) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const userId = req.user?.id;
    const demand = await demandService.createDemand(
      { ...req.body, project_id: projectId },
      userId
    );

    // Write audit event
    await projectAuditService.writeAuditEvent({
      project_id: projectId,
      actor_id: userId,
      actor_email: req.user?.email,
      action: 'demand_created',
      notes: `Demand "${demand.name}" created for allocation engine (${demand.car_count} cars, ${demand.target_month})`,
    });

    res.status(201).json({ success: true, data: demand });
  } catch (err) {
    logger.error({ err }, 'Create project demand error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   GET /api/projects/:id/plan
 * @desc    Get grouped plan summary for a project
 * @access  Protected
 */
router.get('/projects/:id/plan', authenticate, async (req, res) => {
  try {
    const result = await projectPlanningService.getPlanSummary(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Get plan error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   GET /api/projects/:id/plan-history
 * @desc    Get audit events for a project
 * @access  Protected
 */
router.get('/projects/:id/plan-history', authenticate, async (req, res) => {
  try {
    const { car_number, limit, offset } = req.query;
    const result = await projectAuditService.getProjectAuditEvents(
      req.params.id,
      car_number as string | undefined,
      limit ? parseInt(limit as string, 10) : 100,
      offset ? parseInt(offset as string, 10) : 0
    );
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Plan history error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   GET /api/projects/:id/plan-history/:carNumber
 * @desc    Get audit events for a specific car in a project
 * @access  Protected
 */
router.get('/projects/:id/plan-history/:carNumber', authenticate, async (req, res) => {
  try {
    const result = await projectAuditService.getProjectAuditEvents(
      req.params.id,
      req.params.carNumber
    );
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Car plan history error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   POST /api/projects/:id/communications
 * @desc    Log a customer communication
 * @access  Protected - Operator+
 */
router.post('/projects/:id/communications', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { communication_type, communicated_to, communication_method, subject, notes } = req.body;

    if (!communication_type) {
      res.status(400).json({ success: false, error: 'communication_type is required' });
      return;
    }

    const result = await projectPlanningService.logCommunication({
      project_id: req.params.id,
      communication_type,
      communicated_to,
      communication_method,
      subject,
      notes,
      communicated_by_id: userId,
      communicated_by_email: userEmail,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Log communication error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   GET /api/projects/:id/communications
 * @desc    List communications for a project
 * @access  Protected
 */
router.get('/projects/:id/communications', authenticate, async (req, res) => {
  try {
    const result = await projectPlanningService.getCommunications(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Get communications error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   POST /api/shopping-events/:id/bundle-project-work
 * @desc    Bundle project work onto a shopping event
 * @access  Protected - Operator+
 */
router.post('/shopping-events/:id/bundle-project-work', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { project_id, project_car_id, car_number, shop_code, target_month } = req.body;

    if (!project_id || !project_car_id || !car_number || !shop_code || !target_month) {
      res.status(400).json({ success: false, error: 'project_id, project_car_id, car_number, shop_code, target_month required' });
      return;
    }

    const result = await projectPlanningService.bundleProjectWork({
      shopping_event_id: req.params.id,
      project_id,
      project_car_id,
      car_number,
      shop_code,
      target_month,
      bundled_by_id: userId,
      bundled_by_email: userEmail,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Bundle project work error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * @route   GET /api/shopping-events/:id/project-flags
 * @desc    Check if a shopping event's car belongs to an active project
 * @access  Protected
 */
router.get('/shopping-events/:id/project-flags', authenticate, async (req, res) => {
  try {
    // Get the shopping event to find the car number
    const event = await query('SELECT car_number FROM shopping_events WHERE id = $1', [req.params.id]);
    if (event.length === 0) {
      res.status(404).json({ success: false, error: 'Shopping event not found' });
      return;
    }

    const detection = await projectPlanningService.detectProjectForCar(event[0].car_number);
    res.json({ success: true, data: detection });
  } catch (err) {
    logger.error({ err }, 'Project flags error');
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ============================================================================
// INVOICE MANAGEMENT
// ============================================================================

/**
 * @route   GET /api/invoices
 * @desc    List invoices with filters
 * @access  Protected
 */
router.get('/invoices', authenticate, invoiceController.listInvoices);

/**
 * @route   POST /api/invoices
 * @desc    Create invoice (for manual entry - upload endpoint separate)
 * @access  Protected - Operator+
 */
router.post('/invoices', authenticate, authorize('admin', 'operator'), invoiceController.createInvoice);

/**
 * @route   POST /api/invoices/upload
 * @desc    Upload and parse invoice file (PDF or EDI 500-byte)
 * @access  Protected - Operator+
 */
router.post('/invoices/upload', authenticate, authorize('admin', 'operator'), invoiceUpload.single('file'), invoiceController.uploadInvoice);

/**
 * @route   GET /api/invoices/approval-queue
 * @desc    Get approval queue statistics
 * @access  Protected
 */
router.get('/invoices/approval-queue', authenticate, invoiceController.getApprovalQueueStats);

/**
 * @route   GET /api/invoices/pending-review
 * @desc    Get invoices pending review
 * @access  Protected
 */
router.get('/invoices/pending-review', authenticate, invoiceController.getPendingReviewInvoices);

/**
 * @route   GET /api/invoices/:id
 * @desc    Get single invoice
 * @access  Protected
 */
router.get('/invoices/:id', authenticate, invoiceController.getInvoice);

/**
 * @route   PUT /api/invoices/:id/status
 * @desc    Update invoice status
 * @access  Protected - Operator+
 */
router.put('/invoices/:id/status', authenticate, authorize('admin', 'operator'), invoiceController.updateInvoiceStatus);

/**
 * @route   GET /api/invoices/:id/comparison
 * @desc    Get invoice comparison with BRC data
 * @access  Protected
 */
router.get('/invoices/:id/comparison', authenticate, invoiceController.getInvoiceComparison);

/**
 * @route   POST /api/invoices/:id/rematch
 * @desc    Re-run matching for an invoice (after manual corrections)
 * @access  Protected - Operator+
 */
router.post('/invoices/:id/rematch', authenticate, authorize('admin', 'operator'), invoiceController.rematchInvoice);

/**
 * @route   GET /api/invoices/:id/line-items
 * @desc    Get invoice line items
 * @access  Protected
 */
router.get('/invoices/:id/line-items', authenticate, invoiceController.getInvoiceLineItems);

/**
 * @route   PUT /api/invoices/:id/line-items/:lineId/match
 * @desc    Manually match a line item to an allocation
 * @access  Protected - Operator+
 */
router.put('/invoices/:id/line-items/:lineId/match', authenticate, authorize('admin', 'operator'), invoiceController.updateLineItemMatch);

/**
 * @route   POST /api/invoices/:id/line-items/:lineId/verify
 * @desc    Mark line item as manually verified
 * @access  Protected - Operator+
 */
router.post('/invoices/:id/line-items/:lineId/verify', authenticate, authorize('admin', 'operator'), invoiceController.verifyLineItem);

/**
 * @route   POST /api/invoices/:id/approve
 * @desc    Approve invoice and queue for SAP push
 * @access  Protected - Operator+
 */
router.post('/invoices/:id/approve', authenticate, authorize('admin', 'operator'), invoiceController.approveInvoice);

/**
 * @route   POST /api/invoices/:id/reject
 * @desc    Reject invoice with reason
 * @access  Protected - Operator+
 */
router.post('/invoices/:id/reject', authenticate, authorize('admin', 'operator'), invoiceController.rejectInvoice);

// ============================================================================
// USER MANAGEMENT ROUTES
// ============================================================================

// Users
router.get('/admin/users', authenticate, authorize('admin'), userManagementController.listUsers);
router.get('/admin/users/:userId', authenticate, authorize('admin'), userManagementController.getUserById);
router.post('/admin/users', authenticate, authorize('admin'), userManagementController.createUser);
router.put('/admin/users/:userId', authenticate, authorize('admin'), userManagementController.updateUser);
router.put('/admin/users/:userId/password', authenticate, authorize('admin'), userManagementController.updatePassword);
router.post('/admin/users/:userId/deactivate', authenticate, authorize('admin'), userManagementController.deactivateUser);
router.post('/admin/users/:userId/activate', authenticate, authorize('admin'), userManagementController.activateUser);

// Permissions
router.get('/admin/permissions', authenticate, authorize('admin'), userManagementController.listPermissions);
router.get('/admin/users/:userId/permissions', authenticate, authorize('admin'), userManagementController.getUserPermissions);
router.put('/admin/users/:userId/permissions', authenticate, authorize('admin'), userManagementController.updateUserPermissions);

// User Groups
router.get('/admin/groups', authenticate, authorize('admin'), userManagementController.listGroups);
router.get('/admin/groups/:groupId', authenticate, authorize('admin'), userManagementController.getGroupById);
router.post('/admin/groups', authenticate, authorize('admin'), userManagementController.createGroup);
router.put('/admin/groups/:groupId', authenticate, authorize('admin'), userManagementController.updateGroup);
router.delete('/admin/groups/:groupId', authenticate, authorize('admin'), userManagementController.deleteGroup);
router.put('/admin/groups/:groupId/members', authenticate, authorize('admin'), userManagementController.updateGroupMembers);
router.put('/admin/groups/:groupId/permissions', authenticate, authorize('admin'), userManagementController.updateGroupPermissions);

// Customer Portal Users
router.get('/admin/customers/:customerId/users', authenticate, authorize('admin'), userManagementController.getCustomerUsers);
router.put('/admin/users/:userId/customer', authenticate, authorize('admin'), userManagementController.assignUserToCustomer);

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

// Capacity Forecasting
router.get('/analytics/capacity/forecast', authenticate, analyticsController.getCapacityForecast);
router.get('/analytics/capacity/trends', authenticate, analyticsController.getCapacityTrends);
router.get('/analytics/capacity/bottlenecks', authenticate, analyticsController.getBottleneckShops);

// Cost Analytics
router.get('/analytics/cost/trends', authenticate, analyticsController.getCostTrends);
router.get('/analytics/cost/budget-comparison', authenticate, analyticsController.getBudgetComparison);
router.get('/analytics/cost/by-shop', authenticate, analyticsController.getShopCostComparison);
router.get('/analytics/cost/variance', authenticate, analyticsController.getCostVarianceReport);
router.get('/analytics/cost/by-customer', authenticate, analyticsController.getCustomerCostBreakdown);

// Operations KPIs
router.get('/analytics/operations/kpis', authenticate, analyticsController.getOperationsKPIs);
router.get('/analytics/operations/dwell-time', authenticate, analyticsController.getDwellTimeByShop);
router.get('/analytics/operations/throughput', authenticate, analyticsController.getThroughputTrends);

// Shop Performance
router.get('/analytics/shop-performance/scores', authenticate, analyticsController.getShopPerformanceScores);
router.get('/analytics/shop-performance/:shopCode/trend', authenticate, analyticsController.getShopPerformanceTrend);

// Demand Forecasting
router.get('/analytics/demand/forecast', authenticate, analyticsController.getDemandForecast);
router.get('/analytics/demand/by-region', authenticate, analyticsController.getDemandByRegion);
router.get('/analytics/demand/by-customer', authenticate, analyticsController.getDemandByCustomer);

// ============================================================================
// JOB CODES
// ============================================================================

router.get('/job-codes', optionalAuth, jobCodeController.listJobCodes);
router.get('/job-codes/:id', optionalAuth, jobCodeController.getJobCode);
router.post('/job-codes', authenticate, authorize('admin', 'operator'), jobCodeController.createJobCode);
router.put('/job-codes/:id', authenticate, authorize('admin', 'operator'), jobCodeController.updateJobCode);

// ============================================================================
// CUSTOMER CARE MANUALS (CCM)
// ============================================================================

router.get('/ccm', optionalAuth, ccmController.listCCMsByLessee);
router.get('/ccm/:id', optionalAuth, ccmController.getCCMWithSections);
router.get('/ccm/:id/sections-for-sow', optionalAuth, ccmController.getSectionsForSOW);
router.post('/ccm/:id/sections', authenticate, authorize('admin', 'operator'), ccmController.addSection);
router.put('/ccm/sections/:sectionId', authenticate, authorize('admin', 'operator'), ccmController.updateSection);
router.delete('/ccm/sections/:sectionId', authenticate, authorize('admin', 'operator'), ccmController.deleteSection);

// ============================================================================
// CCM FORMS (Structured AITX Customer Care Manual Form)
// ============================================================================

router.get('/ccm-forms', optionalAuth, ccmController.listCCMForms);
router.get('/ccm-forms/:id', optionalAuth, ccmController.getCCMForm);
router.get('/ccm-forms/:id/sow-sections', optionalAuth, ccmController.getCCMFormSOWSections);
router.post('/ccm-forms', authenticate, authorize('admin', 'operator'), ccmController.createCCMForm);
router.put('/ccm-forms/:id', authenticate, authorize('admin', 'operator'), ccmController.updateCCMForm);
// Sealing sections (per-commodity, repeatable)
router.post('/ccm-forms/:id/sealing', authenticate, authorize('admin', 'operator'), ccmController.addSealingSection);
router.put('/ccm-forms/:id/sealing/:sealingId', authenticate, authorize('admin', 'operator'), ccmController.updateSealingSection);
router.delete('/ccm-forms/:id/sealing/:sealingId', authenticate, authorize('admin', 'operator'), ccmController.removeSealingSection);
// Lining sections (per-commodity, repeatable)
router.post('/ccm-forms/:id/lining', authenticate, authorize('admin', 'operator'), ccmController.addLiningSection);
router.put('/ccm-forms/:id/lining/:liningId', authenticate, authorize('admin', 'operator'), ccmController.updateLiningSection);
router.delete('/ccm-forms/:id/lining/:liningId', authenticate, authorize('admin', 'operator'), ccmController.removeLiningSection);
// Attachments
router.post('/ccm-forms/:id/attachments', authenticate, authorize('admin', 'operator'), packetDocUpload.single('file'), ccmController.addCCMFormAttachment);
router.delete('/ccm-forms/:id/attachments/:attachmentId', authenticate, authorize('admin', 'operator'), ccmController.removeCCMFormAttachment);

// ============================================================================
// CCM INSTRUCTIONS (Hierarchy-Level CCM with Inheritance)
// ============================================================================

/**
 * @route   GET /api/ccm-instructions/hierarchy-tree
 * @desc    Get hierarchy tree for CCM scope selection
 * @access  Public (with optional auth)
 */
router.get('/ccm-instructions/hierarchy-tree', optionalAuth, async (req, res) => {
  try {
    const customerId = req.query.customer_id as string | undefined;
    const tree = await ccmInstructionsService.getHierarchyTree(customerId);
    res.json({ success: true, data: tree });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching hierarchy tree');
    res.status(500).json({ success: false, error: 'Failed to fetch hierarchy tree' });
  }
});

/**
 * @route   GET /api/ccm-instructions
 * @desc    List CCM instructions with optional scope filters
 * @access  Public (with optional auth)
 */
router.get('/ccm-instructions', optionalAuth, async (req, res) => {
  try {
    const filters: {
      scope_type?: ccmInstructionsService.ScopeLevel;
      scope_id?: string;
      customer_id?: string;
    } = {};

    if (req.query.scope_type && req.query.scope_id) {
      filters.scope_type = req.query.scope_type as ccmInstructionsService.ScopeLevel;
      filters.scope_id = req.query.scope_id as string;
    }
    if (req.query.customer_id) {
      filters.customer_id = req.query.customer_id as string;
    }

    const instructions = await ccmInstructionsService.listCCMInstructions(filters);
    res.json({ success: true, data: instructions });
  } catch (error) {
    logger.error({ err: error }, 'Error listing CCM instructions');
    res.status(500).json({ success: false, error: 'Failed to list CCM instructions' });
  }
});

/**
 * @route   GET /api/ccm-instructions/by-scope/:scopeType/:scopeId
 * @desc    Get CCM instruction by scope (customer, lease, rider, amendment)
 * @access  Public (with optional auth)
 * NOTE: Must be defined BEFORE the generic :id route to avoid wildcard capture
 */
router.get('/ccm-instructions/by-scope/:scopeType/:scopeId', optionalAuth, async (req, res) => {
  try {
    const { scopeType, scopeId } = req.params;
    const validScopes = ['customer', 'master_lease', 'rider', 'amendment'];
    if (!validScopes.includes(scopeType)) {
      return res.status(400).json({ success: false, error: 'Invalid scope type' });
    }

    const instruction = await ccmInstructionsService.getCCMInstructionByScope({
      type: scopeType as ccmInstructionsService.ScopeLevel,
      id: scopeId
    });

    res.json({ success: true, data: instruction });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching CCM instruction by scope');
    res.status(500).json({ success: false, error: 'Failed to fetch CCM instruction' });
  }
});

/**
 * @route   GET /api/ccm-instructions/parent/:scopeType/:scopeId
 * @desc    Get parent CCM for inheritance preview
 * @access  Public (with optional auth)
 * NOTE: Must be defined BEFORE the generic :id route to avoid wildcard capture
 */
router.get('/ccm-instructions/parent/:scopeType/:scopeId', optionalAuth, async (req, res) => {
  try {
    const { scopeType, scopeId } = req.params;
    const validScopes = ['master_lease', 'rider', 'amendment'];
    if (!validScopes.includes(scopeType)) {
      return res.status(400).json({ success: false, error: 'Invalid scope type (customer has no parent)' });
    }

    const parentCCM = await ccmInstructionsService.getParentCCM({
      type: scopeType as ccmInstructionsService.ScopeLevel,
      id: scopeId
    });

    res.json({ success: true, data: parentCCM });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching parent CCM');
    res.status(500).json({ success: false, error: 'Failed to fetch parent CCM' });
  }
});

/**
 * @route   GET /api/ccm-instructions/:id
 * @desc    Get a single CCM instruction by ID
 * @access  Public (with optional auth)
 */
router.get('/ccm-instructions/:id', optionalAuth, async (req, res) => {
  try {
    const instruction = await ccmInstructionsService.getCCMInstructionById(req.params.id);
    if (!instruction) {
      return res.status(404).json({ success: false, error: 'CCM instruction not found' });
    }
    res.json({ success: true, data: instruction });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching CCM instruction');
    res.status(500).json({ success: false, error: 'Failed to fetch CCM instruction' });
  }
});

/**
 * @route   POST /api/ccm-instructions
 * @desc    Create a new CCM instruction at a specific scope
 * @access  Admin/Operator
 */
router.post('/ccm-instructions', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { scope_type, scope_id, ...data } = req.body;

    if (!scope_type || !scope_id) {
      return res.status(400).json({ success: false, error: 'scope_type and scope_id are required' });
    }

    const validScopes = ['customer', 'master_lease', 'rider', 'amendment'];
    if (!validScopes.includes(scope_type)) {
      return res.status(400).json({ success: false, error: 'Invalid scope_type' });
    }

    const userId = req.user?.id;
    const instruction = await ccmInstructionsService.createCCMInstruction(
      { type: scope_type, id: scope_id },
      data,
      userId
    );

    res.status(201).json({ success: true, data: instruction });
  } catch (error) {
    logger.error({ err: error }, 'Error creating CCM instruction');
    res.status(500).json({ success: false, error: 'Failed to create CCM instruction' });
  }
});

/**
 * @route   PUT /api/ccm-instructions/:id
 * @desc    Update an existing CCM instruction
 * @access  Admin/Operator
 */
router.put('/ccm-instructions/:id', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const instruction = await ccmInstructionsService.updateCCMInstruction(req.params.id, req.body);
    if (!instruction) {
      return res.status(404).json({ success: false, error: 'CCM instruction not found' });
    }
    res.json({ success: true, data: instruction });
  } catch (error) {
    logger.error({ err: error }, 'Error updating CCM instruction');
    res.status(500).json({ success: false, error: 'Failed to update CCM instruction' });
  }
});

/**
 * @route   DELETE /api/ccm-instructions/:id
 * @desc    Delete (soft) a CCM instruction
 * @access  Admin/Operator
 */
router.delete('/ccm-instructions/:id', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const deleted = await ccmInstructionsService.deleteCCMInstruction(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'CCM instruction not found' });
    }
    res.json({ success: true, message: 'CCM instruction deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting CCM instruction');
    res.status(500).json({ success: false, error: 'Failed to delete CCM instruction' });
  }
});

// CCM Instruction Sealing Sections
router.post('/ccm-instructions/:id/sealing', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const sealing = await ccmInstructionsService.addSealingSection(req.params.id, req.body);
    res.status(201).json({ success: true, data: sealing });
  } catch (error) {
    logger.error({ err: error }, 'Error adding sealing section');
    res.status(500).json({ success: false, error: 'Failed to add sealing section' });
  }
});

router.put('/ccm-instructions/:id/sealing/:sealingId', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const sealing = await ccmInstructionsService.updateSealingSection(req.params.sealingId, req.body);
    if (!sealing) {
      return res.status(404).json({ success: false, error: 'Sealing section not found' });
    }
    res.json({ success: true, data: sealing });
  } catch (error) {
    logger.error({ err: error }, 'Error updating sealing section');
    res.status(500).json({ success: false, error: 'Failed to update sealing section' });
  }
});

router.delete('/ccm-instructions/:id/sealing/:sealingId', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const deleted = await ccmInstructionsService.removeSealingSection(req.params.sealingId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Sealing section not found' });
    }
    res.json({ success: true, message: 'Sealing section removed' });
  } catch (error) {
    logger.error({ err: error }, 'Error removing sealing section');
    res.status(500).json({ success: false, error: 'Failed to remove sealing section' });
  }
});

// CCM Instruction Lining Sections
router.post('/ccm-instructions/:id/lining', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const lining = await ccmInstructionsService.addLiningSection(req.params.id, req.body);
    res.status(201).json({ success: true, data: lining });
  } catch (error) {
    logger.error({ err: error }, 'Error adding lining section');
    res.status(500).json({ success: false, error: 'Failed to add lining section' });
  }
});

router.put('/ccm-instructions/:id/lining/:liningId', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const lining = await ccmInstructionsService.updateLiningSection(req.params.liningId, req.body);
    if (!lining) {
      return res.status(404).json({ success: false, error: 'Lining section not found' });
    }
    res.json({ success: true, data: lining });
  } catch (error) {
    logger.error({ err: error }, 'Error updating lining section');
    res.status(500).json({ success: false, error: 'Failed to update lining section' });
  }
});

router.delete('/ccm-instructions/:id/lining/:liningId', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const deleted = await ccmInstructionsService.removeLiningSection(req.params.liningId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Lining section not found' });
    }
    res.json({ success: true, message: 'Lining section removed' });
  } catch (error) {
    logger.error({ err: error }, 'Error removing lining section');
    res.status(500).json({ success: false, error: 'Failed to remove lining section' });
  }
});

/**
 * @route   GET /api/cars/:carNumber/effective-ccm
 * @desc    Get effective CCM for a car with inheritance chain
 * @access  Public (with optional auth)
 */
router.get('/cars/:carNumber/effective-ccm', optionalAuth, async (req, res) => {
  try {
    const effectiveCCM = await ccmInstructionsService.resolveEffectiveCCM(req.params.carNumber);
    if (!effectiveCCM) {
      return res.status(404).json({
        success: false,
        error: 'Car not found or not linked to any lease hierarchy'
      });
    }
    res.json({ success: true, data: effectiveCCM });
  } catch (error) {
    logger.error({ err: error }, 'Error resolving effective CCM');
    res.status(500).json({ success: false, error: 'Failed to resolve effective CCM' });
  }
});

// ============================================================================
// SCOPE LIBRARY
// ============================================================================

router.get('/scope-library', optionalAuth, scopeLibraryController.listScopeTemplatesHandler);
router.get('/scope-library/suggest', optionalAuth, scopeLibraryController.suggestScopesHandler);
router.get('/scope-library/:id', optionalAuth, scopeLibraryController.getScopeTemplateHandler);
router.post('/scope-library', authenticate, authorize('admin', 'operator'), scopeLibraryController.createScopeTemplateHandler);
router.put('/scope-library/:id', authenticate, authorize('admin', 'operator'), scopeLibraryController.updateScopeTemplateHandler);
router.post('/scope-library/:id/items', authenticate, authorize('admin', 'operator'), scopeLibraryController.addTemplateItemHandler);
router.put('/scope-library/:id/items/:itemId', authenticate, authorize('admin', 'operator'), scopeLibraryController.updateTemplateItemHandler);
router.delete('/scope-library/:id/items/:itemId', authenticate, authorize('admin', 'operator'), scopeLibraryController.removeTemplateItemHandler);
router.post('/scope-library/:id/items/:itemId/codes', authenticate, authorize('admin', 'operator'), scopeLibraryController.addItemJobCodeHandler);
router.delete('/scope-library/:id/items/:itemId/codes/:codeId', authenticate, authorize('admin', 'operator'), scopeLibraryController.removeItemJobCodeHandler);

// ============================================================================
// SCOPE OF WORK
// ============================================================================

router.post('/scope-of-work', authenticate, authorize('admin', 'operator'), sowController.createSOWHandler);
router.get('/scope-of-work/:id', optionalAuth, sowController.getSOWHandler);
router.post('/scope-of-work/:id/items', authenticate, authorize('admin', 'operator'), sowController.addSOWItemHandler);
router.put('/scope-of-work/:id/items/:itemId', authenticate, authorize('admin', 'operator'), sowController.updateSOWItemHandler);
router.delete('/scope-of-work/:id/items/:itemId', authenticate, authorize('admin', 'operator'), sowController.removeSOWItemHandler);
router.post('/scope-of-work/:id/items/:itemId/codes', authenticate, authorize('admin', 'operator'), sowController.addItemJobCodeHandler);
router.delete('/scope-of-work/:id/items/:itemId/codes/:codeId', authenticate, authorize('admin', 'operator'), sowController.removeItemJobCodeHandler);
router.post('/scope-of-work/:id/populate-library', authenticate, authorize('admin', 'operator'), sowController.populateFromLibraryHandler);
router.post('/scope-of-work/:id/populate-ccm', authenticate, authorize('admin', 'operator'), sowController.populateFromCCMHandler);
router.post('/scope-of-work/:id/finalize', authenticate, authorize('admin', 'operator'), sowController.finalizeSOWHandler);
router.post('/scope-of-work/:id/save-as-template', authenticate, authorize('admin', 'operator'), sowController.saveAsTemplateHandler);

// ============================================================================
// SHOPPING EVENTS
// ============================================================================

router.get('/shopping-events', optionalAuth, shoppingEventController.listShoppingEvents);
router.post('/shopping-events', authenticate, authorize('admin', 'operator'), shoppingEventController.createShoppingEvent);
router.post('/shopping-events/batch', authenticate, authorize('admin', 'operator'), shoppingEventController.createBatchShoppingEvents);
router.get('/shopping-events/:id', optionalAuth, shoppingEventController.getShoppingEvent);
router.patch('/shopping-events/:id', authenticate, authorize('admin', 'operator'), shoppingEventController.updateShoppingEvent);
router.put('/shopping-events/:id/state', authenticate, authorize('admin', 'operator'), shoppingEventController.transitionState);
router.get('/shopping-events/:id/state-history', optionalAuth, shoppingEventController.getStateHistory);

// Shopping Event Revert
router.post('/shopping-events/:id/revert', authenticate, async (req, res, next) => {
  try {
    const result = await shoppingEventService.revertLastTransition(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Shopping event estimates
router.post('/shopping-events/:id/estimates', authenticate, authorize('admin', 'operator'), estimateController.submitEstimate);
router.get('/shopping-events/:id/estimates', optionalAuth, estimateController.listEstimateVersions);

// Car shopping history
router.get('/cars/:carNumber/shopping-history', optionalAuth, shoppingEventController.getCarShoppingHistory);

// ============================================================================
// ESTIMATES & APPROVAL
// ============================================================================

router.get('/estimates/:id', optionalAuth, estimateController.getEstimate);
router.post('/estimates/:id/decisions', authenticate, authorize('admin', 'operator'), estimateController.recordLineDecisions);
router.get('/estimates/:id/decisions', optionalAuth, estimateController.getEstimateDecisions);
router.put('/estimates/:id/status', authenticate, authorize('admin', 'operator'), estimateController.updateEstimateStatus);
router.post('/estimates/:id/approval-packet', authenticate, authorize('admin', 'operator'), estimateController.generateApprovalPacket);

// AI Pre-Review
router.post('/estimates/:id/pre-review', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { preReviewEstimate } = await import('../services/estimate-ai.service');
    const result = await preReviewEstimate(req.params.id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
router.get('/job-codes/:code/stats', authenticate, async (req, res) => {
  try {
    const { getJobCodeStats } = await import('../services/estimate-ai.service');
    const result = await getJobCodeStats(req.params.code);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/approval-packets/:id', optionalAuth, estimateController.getApprovalPacket);
router.post('/approval-packets/:id/release', authenticate, authorize('admin', 'operator'), estimateController.releaseApprovalPacket);

// ============================================================================
// SHOPPING PACKETS
// ============================================================================

router.get('/packets', optionalAuth, shoppingPacketController.listPackets);
router.post('/packets', authenticate, authorize('admin', 'operator'), shoppingPacketController.createPacket);
router.get('/packets/:id', optionalAuth, shoppingPacketController.getPacket);
router.post('/packets/:id/documents', authenticate, authorize('admin', 'operator'), packetDocUpload.single('file'), shoppingPacketController.addDocument);
router.post('/packets/:id/documents/mfiles', authenticate, authorize('admin', 'operator'), shoppingPacketController.linkMFilesDocument);
router.put('/packets/:id/send', authenticate, authorize('admin', 'operator'), shoppingPacketController.sendPacket);
router.put('/packets/:id/acknowledge', authenticate, shoppingPacketController.acknowledgePacket);

// ============================================================================
// HEALTH CHECK
// ============================================================================

// ============================================================================
// OPERATIONAL DASHBOARD ROUTES
// ============================================================================

router.get('/dashboard/contracts-readiness', optionalAuth, dashboardController.getContractsReadiness);
router.get('/dashboard/need-shopping', authenticate, dashboardController.getNeedShoppingAlert);
router.get('/dashboard/my-contracts', authenticate, dashboardController.getMyContractsHealth);
router.get('/dashboard/manager-performance', authenticate, authorize('admin', 'operator'), dashboardController.getManagerPerformance);
router.get('/dashboard/dwell-time', optionalAuth, dashboardController.getDwellTimeHeatmap);
router.get('/dashboard/throughput', optionalAuth, dashboardController.getShopThroughput);
router.get('/dashboard/upcoming-releases', optionalAuth, dashboardController.getUpcomingReleases);
router.get('/dashboard/high-cost-exceptions', authenticate, dashboardController.getHighCostExceptions);
router.get('/dashboard/expiry-forecast', optionalAuth, dashboardController.getExpiryForecast);
router.get('/dashboard/budget-burn', authenticate, dashboardController.getBudgetBurnVelocity);

/**
 * @route   GET /api/dashboard/project-planning
 * @desc    Get project planning summary for dashboard
 * @access  Protected
 */
router.get('/dashboard/project-planning', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('active', 'in_progress')) AS active_projects,
        COALESCE(SUM(total_cars) FILTER (WHERE status IN ('active', 'in_progress')), 0) AS total_cars,
        COALESCE(SUM(active_planned) FILTER (WHERE status IN ('active', 'in_progress')), 0) AS planned_cars,
        COALESCE(SUM(active_locked) FILTER (WHERE status IN ('active', 'in_progress')), 0) AS locked_cars,
        COALESCE(SUM(completed_cars) FILTER (WHERE status IN ('active', 'in_progress')), 0) AS completed_cars,
        COALESCE(SUM(unplanned_cars) FILTER (WHERE status IN ('active', 'in_progress')), 0) AS unplanned_cars,
        COALESCE(SUM(total_estimated_cost) FILTER (WHERE status IN ('active', 'in_progress')), 0) AS total_estimated_cost
      FROM v_project_plan_summary
    `, []);
    res.json({ success: true, data: result[0] || null });
  } catch (err) {
    logger.error({ err }, 'Dashboard project planning error');
    res.status(500).json({ success: false, error: 'Failed to fetch project planning summary' });
  }
});

// ============================================================================
// INVOICE CASE WORKFLOW ROUTES (per Railsync_Invoice_Processing_Complete_Spec.md)
// ============================================================================

// Invoice Case CRUD
router.get('/invoice-cases/by-state', optionalAuth, invoiceCaseController.getCasesByState);
router.get('/invoice-cases', optionalAuth, invoiceCaseController.listInvoiceCases);
router.post('/invoice-cases', authenticate, authorize('admin', 'operator'), invoiceCaseController.createInvoiceCase);
router.get('/invoice-cases/:id', optionalAuth, invoiceCaseController.getInvoiceCase);
router.get('/invoice-cases/:id/summary', optionalAuth, invoiceCaseController.getInvoiceCaseSummary);
router.put('/invoice-cases/:id', authenticate, authorize('admin', 'operator'), invoiceCaseController.updateInvoiceCase);

// State Transitions
router.post('/invoice-cases/:id/validate', authenticate, invoiceCaseController.validateStateTransition);
router.post('/invoice-cases/:id/transition', authenticate, authorize('admin', 'operator'), invoiceCaseController.transitionState);
router.post('/invoice-cases/:id/revert', authenticate, authorize('admin', 'operator'), invoiceCaseController.revertLastTransition);

// Assignment
router.put('/invoice-cases/:id/assign', authenticate, authorize('admin'), invoiceCaseController.assignCase);
router.delete('/invoice-cases/:id/assign', authenticate, authorize('admin'), invoiceCaseController.unassignCase);

// Special Lessee Approval
router.post('/invoice-cases/:id/special-lessee-approval', authenticate, authorize('admin'), invoiceCaseController.confirmSpecialLesseeApproval);

// Attachments
router.get('/invoice-cases/:id/attachments', optionalAuth, invoiceCaseController.listAttachments);
router.get('/invoice-cases/:id/attachments/validate', optionalAuth, invoiceCaseController.validateAttachments);
router.post('/invoice-cases/:id/attachments', authenticate, authorize('admin', 'operator'), invoiceUpload.single('file'), invoiceCaseController.uploadAttachment);
router.get('/invoice-cases/:caseId/attachments/:attachmentId/download', authenticate, invoiceCaseController.downloadAttachment);
router.delete('/invoice-cases/:caseId/attachments/:attachmentId', authenticate, authorize('admin'), invoiceCaseController.deleteAttachment);
router.post('/invoice-cases/:caseId/attachments/:attachmentId/verify', authenticate, authorize('admin', 'operator'), invoiceCaseController.verifyAttachment);

// Audit Events
router.get('/invoice-cases/:id/audit-events', authenticate, invoiceCaseController.getAuditEvents);

// ============================================================================
// SHOPPING REQUESTS
// ============================================================================

router.post('/shopping-requests', authenticate, shoppingRequestController.create);
router.get('/shopping-requests', authenticate, shoppingRequestController.list);
router.get('/shopping-requests/:id', authenticate, shoppingRequestController.getById);
router.put('/shopping-requests/:id', authenticate, shoppingRequestController.update);
router.put('/shopping-requests/:id/approve', authenticate, authorize('admin', 'operator'), shoppingRequestController.approve);
router.put('/shopping-requests/:id/reject', authenticate, authorize('admin', 'operator'), shoppingRequestController.reject);
router.put('/shopping-requests/:id/cancel', authenticate, shoppingRequestController.cancel);
router.post('/shopping-requests/:id/revert', authenticate, authorize('admin', 'operator'), shoppingRequestController.revert);
router.post('/shopping-requests/:id/duplicate', authenticate, authorize('admin', 'operator'), shoppingRequestController.duplicate);
router.post('/shopping-requests/:id/attachments', authenticate, shoppingRequestUpload.single('file'), shoppingRequestController.uploadAttachment);
router.get('/shopping-requests/:id/attachments', authenticate, shoppingRequestController.listAttachments);
router.delete('/shopping-requests/:id/attachments/:attachmentId', authenticate, shoppingRequestController.deleteAttachment);

// ============================================================================
// TRANSITION REVERT ELIGIBILITY (generic)
// ============================================================================

router.get('/transitions/:processType/:entityId/revert-eligibility', authenticate, async (req, res, next) => {
  try {
    const { processType, entityId } = req.params;
    const result = await transitionLogService.canRevert(processType, entityId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ============================================================================
// QUALIFICATION ROUTES
// ============================================================================

// Static routes MUST come before parameterized routes
router.get('/qualifications/types', authenticate, qualificationController.listTypes);
router.get('/qualifications/stats', authenticate, qualificationController.getStats);
router.get('/qualifications/due-by-month', authenticate, qualificationController.getDueByMonth);
router.get('/qualifications/alerts', authenticate, qualificationController.getAlerts);
router.post('/qualifications/alerts/:id/acknowledge', authenticate, qualificationController.acknowledgeAlert);
router.post('/qualifications/recalculate', authenticate, authorize('admin', 'operator'), qualificationController.recalculate);
router.post('/qualifications/generate-alerts', authenticate, authorize('admin', 'operator'), qualificationController.generateAlerts);
router.post('/qualifications/bulk-update', authenticate, authorize('admin', 'operator'), qualificationController.bulkUpdate);

// CRUD routes
router.get('/qualifications', authenticate, qualificationController.listQualifications);
router.post('/qualifications', authenticate, authorize('admin', 'operator'), qualificationController.createQualification);
router.get('/qualifications/:id', authenticate, qualificationController.getQualification);
router.put('/qualifications/:id', authenticate, authorize('admin', 'operator'), qualificationController.updateQualification);
router.post('/qualifications/:id/complete', authenticate, authorize('admin', 'operator'), qualificationController.completeQualification);
router.get('/qualifications/:id/history', authenticate, qualificationController.getHistory);

// Per-car qualifications
router.get('/cars/:carId/qualifications', authenticate, qualificationController.getCarQualifications);

// ============================================================================
// BILLING ENGINE
// ============================================================================
import * as billingController from '../controllers/billing.controller';

// Billing Runs
router.post('/billing/runs/preflight', authenticate, authorize('admin', 'operator'), billingController.runPreflight);
router.post('/billing/runs', authenticate, authorize('admin'), billingController.createBillingRun);
router.get('/billing/runs', authenticate, billingController.listBillingRuns);
router.get('/billing/runs/:id', authenticate, billingController.getBillingRun);
router.put('/billing/runs/:id/approve', authenticate, authorize('admin'), billingController.approveBillingRun);
router.put('/billing/runs/:id/complete', authenticate, authorize('admin'), billingController.completeBillingRun);

// Outbound Invoices
router.post('/billing/invoices/generate', authenticate, authorize('admin'), billingController.generateInvoices);
router.get('/billing/invoices', authenticate, billingController.listInvoices);
router.get('/billing/invoices/:id', authenticate, billingController.getInvoice);
router.put('/billing/invoices/:id/approve', authenticate, authorize('admin'), billingController.approveInvoice);
router.put('/billing/invoices/:id/void', authenticate, authorize('admin'), billingController.voidInvoice);

// Rate Management
router.get('/billing/rates/:riderId/history', authenticate, billingController.getRateHistory);
router.put('/billing/rates/:riderId', authenticate, authorize('admin', 'operator'), billingController.updateRate);

// Mileage
router.post('/billing/mileage/files', authenticate, authorize('admin', 'operator'), billingController.registerMileageFile);
router.post('/billing/mileage/files/:fileId/import', authenticate, authorize('admin', 'operator'), billingController.importMileageRecords);
router.get('/billing/mileage/summary', authenticate, billingController.getMileageSummary);
router.put('/billing/mileage/records/:id/verify', authenticate, authorize('admin', 'operator'), billingController.verifyMileageRecord);

// Chargebacks
router.post('/billing/chargebacks', authenticate, authorize('admin', 'operator'), billingController.createChargeback);
router.get('/billing/chargebacks', authenticate, billingController.listChargebacks);
router.put('/billing/chargebacks/:id/review', authenticate, authorize('admin'), billingController.reviewChargeback);
router.post('/billing/chargebacks/generate-invoice', authenticate, authorize('admin'), billingController.generateChargebackInvoice);

// Adjustments
router.post('/billing/adjustments', authenticate, authorize('admin', 'operator'), billingController.createAdjustment);
router.get('/billing/adjustments/pending', authenticate, billingController.listPendingAdjustments);
router.put('/billing/adjustments/:id/approve', authenticate, authorize('admin'), billingController.approveAdjustment);
router.put('/billing/adjustments/:id/reject', authenticate, authorize('admin'), billingController.rejectAdjustment);

// Billing Summary
router.get('/billing/summary', authenticate, billingController.getBillingSummary);
router.get('/billing/customers/:customerId/history', authenticate, billingController.getCustomerInvoiceHistory);

// Cost Allocation
router.post('/billing/cost-allocations', authenticate, authorize('admin', 'operator'), billingController.createCostAllocation);
router.get('/billing/cost-allocations/summary', authenticate, billingController.getCostAllocationSummary);
router.get('/billing/cost-allocations', authenticate, billingController.listCostAllocations);

// Invoice Distribution
import * as distributionController from '../controllers/invoiceDistribution.controller';

router.get('/billing/distribution/configs', authenticate, distributionController.listConfigs);
router.get('/billing/distribution/configs/:customerId', authenticate, distributionController.getConfig);
router.put('/billing/distribution/configs/:customerId', authenticate, authorize('admin'), distributionController.upsertConfig);
router.delete('/billing/distribution/configs/:id', authenticate, authorize('admin'), distributionController.deleteConfig);
router.post('/billing/distribution/queue/:invoiceId', authenticate, authorize('admin'), distributionController.queueDelivery);
router.post('/billing/distribution/process', authenticate, authorize('admin'), distributionController.processDeliveries);
router.get('/billing/distribution/invoices/:invoiceId/history', authenticate, distributionController.getDeliveryHistory);
router.get('/billing/distribution/stats', authenticate, distributionController.getDeliveryStats);
router.get('/billing/distribution/pending', authenticate, distributionController.getPendingDeliveries);

// ============================================================================
// COMPONENT REGISTRY
// ============================================================================
import * as componentController from '../controllers/component.controller';

router.get('/components', authenticate, componentController.listComponents);
router.get('/components/stats', authenticate, componentController.getComponentStats);
router.get('/components/:id', authenticate, componentController.getComponent);
router.post('/components', authenticate, authorize('admin', 'operator'), componentController.createComponent);
router.put('/components/:id', authenticate, authorize('admin', 'operator'), componentController.updateComponent);
router.post('/components/:id/replace', authenticate, authorize('admin', 'operator'), componentController.replaceComponent);
router.delete('/components/:id', authenticate, authorize('admin', 'operator'), componentController.removeComponent);
router.post('/components/:id/inspect', authenticate, authorize('admin', 'operator'), componentController.recordInspection);
router.get('/components/:id/history', authenticate, componentController.getComponentHistory);
router.get('/cars/:carNumber/components', authenticate, componentController.getCarComponents);

// ============================================================================
// COMMODITY / CLEANING MATRIX
// ============================================================================
import * as commodityController from '../controllers/commodity.controller';

router.get('/commodities', authenticate, commodityController.listCommodities);
router.get('/commodities/:code', authenticate, commodityController.getCommodityByCode);
router.get('/commodities/:code/cleaning', authenticate, commodityController.getCommodityCleaningRequirements);
router.post('/commodities', authenticate, authorize('admin'), commodityController.createCommodity);
router.put('/commodities/:id', authenticate, authorize('admin'), commodityController.updateCommodity);
router.get('/cars/:carNumber/cleaning-requirements', authenticate, commodityController.getCarCleaningRequirements);

// ============================================================================
// CAR RELEASES (Release Management)
// ============================================================================
import * as releaseController from '../controllers/release.controller';

router.get('/releases', authenticate, releaseController.listReleases);
router.get('/releases/active', authenticate, releaseController.getActiveReleases);
router.get('/releases/:id', authenticate, releaseController.getRelease);
router.post('/releases', authenticate, authorize('admin', 'operator'), releaseController.initiateRelease);
router.post('/releases/:id/approve', authenticate, authorize('admin'), releaseController.approveRelease);
router.post('/releases/:id/execute', authenticate, authorize('admin', 'operator'), releaseController.executeRelease);
router.post('/releases/:id/complete', authenticate, authorize('admin', 'operator'), releaseController.completeRelease);
router.post('/releases/:id/cancel', authenticate, authorize('admin', 'operator'), releaseController.cancelRelease);

// ============================================================================
// CAR TRANSFERS (Contract Transfers)
// ============================================================================
import * as transferController from '../controllers/transfer.controller';

router.get('/transfers', authenticate, transferController.listTransfers);
router.get('/transfers/overview', authenticate, transferController.getTransferOverview);
router.get('/transfers/:id', authenticate, transferController.getTransfer);
router.post('/transfers/validate', authenticate, transferController.validatePrerequisites);
router.post('/transfers', authenticate, authorize('admin', 'operator'), transferController.initiateTransfer);
router.post('/transfers/:id/confirm', authenticate, authorize('admin', 'operator'), transferController.confirmTransfer);
router.post('/transfers/:id/complete', authenticate, authorize('admin', 'operator'), transferController.completeTransfer);
router.post('/transfers/:id/cancel', authenticate, authorize('admin', 'operator'), transferController.cancelTransfer);
router.get('/riders/:riderId/transfers', authenticate, transferController.getRiderTransfers);

// ============================================================================

// ============================================================================
// INTEGRATIONS (SAP, Salesforce, sync log)
// ============================================================================
import * as integrationController from '../controllers/integration.controller';

// Connection status
router.get('/integrations/status', authenticate, authorize('admin'), integrationController.getConnectionStatuses);
router.get('/integrations/sync-log', authenticate, authorize('admin'), integrationController.getSyncLog);
router.get('/integrations/sync-stats', authenticate, authorize('admin'), integrationController.getSyncStats);
router.post('/integrations/sync-log/:id/retry', authenticate, authorize('admin'), integrationController.retrySyncEntry);

// SAP pushes
router.post('/integrations/sap/push-costs', authenticate, authorize('admin', 'operator'), integrationController.pushApprovedCosts);
router.post('/integrations/sap/push-billing', authenticate, authorize('admin', 'operator'), integrationController.pushBillingTrigger);
router.post('/integrations/sap/push-mileage', authenticate, authorize('admin', 'operator'), integrationController.pushMileage);
router.post('/integrations/sap/push-invoice', authenticate, authorize('admin', 'operator'), integrationController.pushInvoiceToSAP);
router.post('/integrations/sap/batch-push', authenticate, authorize('admin'), integrationController.batchPushToSAP);
router.get('/integrations/sap/check', authenticate, authorize('admin'), integrationController.checkSAPConnection);

// CLM (Car Location)
import * as clmController from '../controllers/clm.controller';

router.post('/integrations/clm/sync', authenticate, authorize('admin'), clmController.syncLocations);
router.get('/integrations/clm/check', authenticate, authorize('admin'), clmController.checkConnection);
router.get('/car-locations', authenticate, clmController.listCarLocations);
router.get('/car-locations/:carNumber', authenticate, clmController.getCarLocation);
router.get('/car-locations/:carNumber/history', authenticate, clmController.getLocationHistory);

// Railinc EDI
import * as railincController from '../controllers/railinc.controller';

router.post('/integrations/railinc/import', authenticate, authorize('admin', 'operator'), railincController.importEDIFile);
router.post('/integrations/railinc/preview', authenticate, authorize('admin', 'operator'), railincController.parseEDIPreview);
router.get('/integrations/railinc/check', authenticate, authorize('admin'), railincController.checkConnection);

// Salesforce sync
router.post('/integrations/salesforce/pull-customers', authenticate, authorize('admin'), integrationController.sfPullCustomers);
router.post('/integrations/salesforce/pull-contacts', authenticate, authorize('admin'), integrationController.sfPullContacts);
router.post('/integrations/salesforce/full-sync', authenticate, authorize('admin'), integrationController.sfFullSync);
router.get('/integrations/salesforce/check', authenticate, authorize('admin'), integrationController.checkSFConnection);
router.post('/integrations/salesforce/pull-deals', authenticate, authorize('admin'), integrationController.sfPullDealStages);
router.post('/integrations/salesforce/push-billing-status', authenticate, authorize('admin'), integrationController.sfPushBillingStatus);
router.get('/integrations/salesforce/sync-map', authenticate, authorize('admin'), integrationController.getSFSyncMap);

// SAP field mappings & payload validation
router.get('/integrations/sap/field-mappings', authenticate, authorize('admin'), integrationController.getSAPFieldMappings);
router.post('/integrations/sap/validate-payload', authenticate, authorize('admin'), integrationController.validateSAPPayload);

// Retry Queue + Circuit Breaker
router.get('/integrations/retry-queue', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getRetryQueueEntries } = await import('../services/retry-queue.service');
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await getRetryQueueEntries(limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
router.post('/integrations/retry-queue/:id/dismiss', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { dismissRetryEntry } = await import('../services/retry-queue.service');
    const result = await dismissRetryEntry(req.params.id);
    res.json({ success: true, data: { dismissed: result } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
router.post('/integrations/retry-queue/process', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { processRetryQueue } = await import('../services/retry-queue.service');
    const result = await processRetryQueue();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
router.get('/integrations/retry-queue/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getRetryQueueStats } = await import('../services/retry-queue.service');
    const result = await getRetryQueueStats();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
router.get('/integrations/dead-letters', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getDeadLetterEntries } = await import('../services/retry-queue.service');
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await getDeadLetterEntries(limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Sync job schedules
router.get('/integrations/sync-schedules', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getScheduledJobs } = await import('../services/sync-scheduler.service');
    const data = await getScheduledJobs();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
router.get('/integrations/sync-schedules/due', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getJobsDueForExecution } = await import('../services/sync-scheduler.service');
    const data = await getJobsDueForExecution();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
router.post('/integrations/sync-schedules', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { createScheduledJob } = await import('../services/sync-scheduler.service');
    const data = await createScheduledJob(req.body);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
router.put('/integrations/sync-schedules/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { updateScheduledJob } = await import('../services/sync-scheduler.service');
    const data = await updateScheduledJob(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
router.put('/integrations/sync-schedules/:id/toggle', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { toggleJobEnabled } = await import('../services/sync-scheduler.service');
    const data = await toggleJobEnabled(req.params.id, req.body.enabled);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Integration monitoring
router.get('/integrations/health-dashboard', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getIntegrationHealthDashboard } = await import('../services/integration-monitor.service');
    const data = await getIntegrationHealthDashboard();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.get('/integrations/error-trends', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getErrorTrends } = await import('../services/integration-monitor.service');
    const days = parseInt(req.query.days as string) || 7;
    const data = await getErrorTrends(days);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/integrations/batch-retry', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { batchRetryByCategory } = await import('../services/integration-monitor.service');
    const { category, system_name } = req.body;
    if (!category) { res.status(400).json({ success: false, error: 'category required' }); return; }
    const data = await batchRetryByCategory(category, system_name);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// CIPROTS Migration Pipeline
router.post('/migration/import/cars', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { importCars } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await importCars(req.body.content, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/migration/import/contracts', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { importContracts } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await importContracts(req.body.content, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/migration/import/shopping', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { importShoppingEvents } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await importShoppingEvents(req.body.content, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/migration/import/qualifications', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { importQualifications } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await importQualifications(req.body.content, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.get('/migration/runs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getMigrationRuns } = await import('../services/migration-pipeline.service');
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await getMigrationRuns(limit);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.get('/migration/runs/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getMigrationRun } = await import('../services/migration-pipeline.service');
    const data = await getMigrationRun(req.params.id);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.get('/migration/runs/:id/errors', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getMigrationErrors } = await import('../services/migration-pipeline.service');
    const data = await getMigrationErrors(req.params.id);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.get('/migration/reconciliation', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getReconciliationSummary } = await import('../services/migration-pipeline.service');
    const data = await getReconciliationSummary();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/migration/import/customers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { importCustomers } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await importCustomers(req.body.content, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/migration/import/invoices', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { importInvoices } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await importInvoices(req.body.content, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/migration/import/allocations', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { importAllocations } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await importAllocations(req.body.content, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/migration/import/mileage', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { importMileageRecords } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await importMileageRecords(req.body.content, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/migration/orchestrate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { runOrchestration } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await runOrchestration(req.body.files || {}, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/migration/validate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { validateOnly } = await import('../services/migration-pipeline.service');
    const { entity_type, content } = req.body;
    if (!entity_type || !content) { res.status(400).json({ success: false, error: 'entity_type and content required' }); return; }
    const result = await validateOnly(entity_type, content);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/migration/runs/:id/rollback', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { rollbackRun } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await rollbackRun(req.params.id, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// System health dashboard
router.get('/system/health-dashboard', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getHealthDashboard } = await import('../services/system-health.service');
    const data = await getHealthDashboard();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// User feedback
router.post('/feedback', authenticate, async (req, res) => {
  try {
    const { createFeedback } = await import('../services/feedback.service');
    const userId = req.user?.id;
    const data = await createFeedback({ ...req.body, user_id: userId });
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/feedback', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { listFeedback } = await import('../services/feedback.service');
    const data = await listFeedback({
      status: req.query.status as string,
      category: req.query.category as string,
      limit: parseInt(req.query.limit as string) || 100,
    });
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/feedback/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getFeedbackStats } = await import('../services/feedback.service');
    const data = await getFeedbackStats();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.put('/feedback/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { updateFeedback } = await import('../services/feedback.service');
    const userId = req.user?.id;
    const data = await updateFeedback(req.params.id, { ...req.body, reviewed_by: userId });
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// Performance monitoring
router.get('/system/performance/tables', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getTableSizes } = await import('../services/performance-monitor.service');
    const data = await getTableSizes(parseInt(req.query.limit as string) || 30);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/system/performance/indexes', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getIndexUsage } = await import('../services/performance-monitor.service');
    const data = await getIndexUsage(parseInt(req.query.limit as string) || 50);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/system/performance/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getDatabaseStats } = await import('../services/performance-monitor.service');
    const data = await getDatabaseStats();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/system/performance/slow-queries', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getSlowQueries } = await import('../services/performance-monitor.service');
    const data = await getSlowQueries(parseInt(req.query.limit as string) || 20);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// System mode
router.get('/system/mode', authenticate, async (req, res) => {
  try {
    const { getSystemMode } = await import('../services/system-mode.service');
    const data = await getSystemMode();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.put('/system/mode', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { setSystemMode } = await import('../services/system-mode.service');
    const userId = req.user?.id;
    const { mode } = req.body;
    if (!mode) { res.status(400).json({ success: false, error: 'mode is required' }); return; }
    const data = await setSystemMode(mode, userId);
    res.json({ success: true, data });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

// Delta migration
router.post('/migration/delta/cars', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { deltaMigrateCars } = await import('../services/migration-pipeline.service');
    const userId = req.user?.id;
    const result = await deltaMigrateCars(req.body.content, userId);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/migration/delta/summary', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getDeltaSummary } = await import('../services/migration-pipeline.service');
    const data = await getDeltaSummary();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// Parallel Run Comparison
router.post('/parallel-run/compare-invoices', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { compareInvoices } = await import('../services/parallel-run.service');
    const { content, billing_period } = req.body;
    if (!content || !billing_period) { res.status(400).json({ success: false, error: 'content and billing_period required' }); return; }
    const result = await compareInvoices(content, billing_period);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/parallel-run/compare-statuses', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { compareCarStatuses } = await import('../services/parallel-run.service');
    const { content } = req.body;
    if (!content) { res.status(400).json({ success: false, error: 'content required' }); return; }
    const result = await compareCarStatuses(content);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.get('/parallel-run/results', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getParallelRunResults } = await import('../services/parallel-run.service');
    const data = await getParallelRunResults();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.get('/parallel-run/results/:id/discrepancies', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getDiscrepancies } = await import('../services/parallel-run.service');
    const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;
    const data = await getDiscrepancies(req.params.id, resolved);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/parallel-run/discrepancies/:id/resolve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { resolveDiscrepancy } = await import('../services/parallel-run.service');
    const userId = req.user?.id;
    const result = await resolveDiscrepancy(req.params.id, userId, req.body.notes || '');
    res.json({ success: true, data: { resolved: result } });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// Parallel run — daily report and health score
router.get('/parallel-run/daily-report', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { getDailyReport } = await import('../services/parallel-run.service');
    const days = parseInt(req.query.days as string) || 30;
    const data = await getDailyReport(days);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/parallel-run/health-score', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { getHealthScore } = await import('../services/parallel-run.service');
    const data = await getHealthScore();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/parallel-run/compare-billing', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { compareBillingTotals } = await import('../services/parallel-run.service');
    const { content, billing_period } = req.body;
    if (!content || !billing_period) { res.status(400).json({ success: false, error: 'content and billing_period required' }); return; }
    const result = await compareBillingTotals(content, billing_period);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/parallel-run/compare-mileage', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { compareMileage } = await import('../services/parallel-run.service');
    const { content, reporting_period } = req.body;
    if (!content || !reporting_period) { res.status(400).json({ success: false, error: 'content and reporting_period required' }); return; }
    const result = await compareMileage(content, reporting_period);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/parallel-run/compare-allocations', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { compareAllocations } = await import('../services/parallel-run.service');
    const { content, target_month } = req.body;
    if (!content || !target_month) { res.status(400).json({ success: false, error: 'content and target_month required' }); return; }
    const result = await compareAllocations(content, target_month);
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.get('/parallel-run/go-live-checklist', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getGoLiveChecklist } = await import('../services/parallel-run.service');
    const data = await getGoLiveChecklist();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// Go-live readiness check
router.get('/go-live/readiness', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getGoLiveReadiness } = await import('../services/go-live-check.service');
    const data = await getGoLiveReadiness();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// Go-live incidents
router.get('/go-live/incidents', authenticate, async (req, res) => {
  try {
    const { listIncidents } = await import('../services/go-live-incidents.service');
    const data = await listIncidents({
      status: req.query.status as string,
      severity: req.query.severity as string,
      limit: parseInt(req.query.limit as string) || 100,
    });
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/go-live/incidents/stats', authenticate, async (req, res) => {
  try {
    const { getIncidentStats } = await import('../services/go-live-incidents.service');
    const data = await getIncidentStats();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/go-live/incidents/:id', authenticate, async (req, res) => {
  try {
    const { getIncident } = await import('../services/go-live-incidents.service');
    const data = await getIncident(req.params.id);
    if (!data) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.post('/go-live/incidents', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { createIncident } = await import('../services/go-live-incidents.service');
    const userId = req.user?.id;
    const data = await createIncident({ ...req.body, reported_by: userId });
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.put('/go-live/incidents/:id', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { updateIncident } = await import('../services/go-live-incidents.service');
    const data = await updateIncident(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.post('/integrations/dead-letters/:id/reset', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { resetDeadLetter } = await import('../services/retry-queue.service');
    const result = await resetDeadLetter(req.params.id);
    res.json({ success: true, data: { reset: result } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================================================
// Alert Engine Routes
// ============================================================================

router.post('/alerts/generate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { runAlertGeneration } = await import('../services/alert-engine.service');
    const data = await runAlertGeneration();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/alerts/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getAlertStats } = await import('../services/alert-engine.service');
    const data = await getAlertStats();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/alerts', authenticate, async (req, res) => {
  try {
    const { getActiveAlerts } = await import('../services/alert-engine.service');
    const userId = req.user?.id;
    const role = req.user?.role;
    const data = await getActiveAlerts(userId, role);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.put('/alerts/:id/dismiss', authenticate, async (req, res) => {
  try {
    const { dismissAlert } = await import('../services/alert-engine.service');
    const userId = req.user?.id;
    await dismissAlert(req.params.id, userId);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// ============================================================================
// Forecast & Freight Routes
// ============================================================================

router.get('/forecast/maintenance', authenticate, async (req, res) => {
  try {
    const { getMaintenanceForecast } = await import('../services/forecast.service');
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const data = await getMaintenanceForecast(fiscalYear);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/forecast/trends', authenticate, async (req, res) => {
  try {
    const { getForecastTrends } = await import('../services/forecast.service');
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const data = await getForecastTrends(fiscalYear);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/forecast/dashboard-summary', authenticate, async (req, res) => {
  try {
    const { getDashboardSummary } = await import('../services/forecast.service');
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const data = await getDashboardSummary(fiscalYear);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/freight/rates', authenticate, async (req, res) => {
  try {
    const { getFreightRate, getDefaultFreightRate, listOriginLocations } = await import('../services/freight.service');
    const { origin, destination } = req.query as Record<string, string>;
    if (origin && destination) {
      const data = await getFreightRate(origin, destination);
      res.json({ success: true, data });
    } else {
      const defaultRate = await getDefaultFreightRate();
      res.json({ success: true, data: defaultRate });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/freight/calculate', authenticate, async (req, res) => {
  try {
    const { calculateFreightCost } = await import('../services/freight.service');
    const { origin_code, shop_code } = req.body;
    const data = await calculateFreightCost(origin_code, shop_code);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/freight/origins', authenticate, async (req, res) => {
  try {
    const { listOriginLocations } = await import('../services/freight.service');
    const data = await listOriginLocations();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================================================
// Work Hours Routes
// ============================================================================

router.get('/work-hours/factors', authenticate, async (req, res) => {
  try {
    const { getWorkHoursFactors } = await import('../services/workhours.service');
    const factorType = (req.query.factor_type as string) || 'car_type';
    const factorValue = (req.query.factor_value as string) || 'Tank';
    const data = await getWorkHoursFactors(factorType, factorValue);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/work-hours/calculate', authenticate, async (req, res) => {
  try {
    const { calculateWorkHours } = await import('../services/workhours.service');
    const { car, overrides } = req.body;
    const data = await calculateWorkHours(car, overrides || {});
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================================================
// Project Audit Routes
// ============================================================================

router.get('/projects/:id/audit', authenticate, async (req, res) => {
  try {
    const { getProjectAuditEvents } = await import('../services/project-audit.service');
    const carNumber = req.query.car_number as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const data = await getProjectAuditEvents(req.params.id, carNumber, limit, offset);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================================================
// Report Builder Routes
// ============================================================================

router.get('/report-builder/templates', authenticate, async (req, res) => {
  try {
    const { listTemplates } = await import('../services/report-builder.service');
    res.json({ success: true, data: listTemplates() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/report-builder/templates/:id', authenticate, async (req, res) => {
  try {
    const { getTemplate } = await import('../services/report-builder.service');
    const template = getTemplate(req.params.id);
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: template });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/report-builder/run', authenticate, async (req, res) => {
  try {
    const { runReport } = await import('../services/report-builder.service');
    const { template_id, columns, filters, sort_by, sort_dir, limit, offset } = req.body;
    if (!template_id) { res.status(400).json({ success: false, error: 'template_id required' }); return; }
    const result = await runReport(template_id, { columns, filters, sort_by, sort_dir, limit, offset });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/report-builder/export-csv', authenticate, async (req, res) => {
  try {
    const { runReport, toCSV } = await import('../services/report-builder.service');
    const { template_id, columns, filters, sort_by, sort_dir } = req.body;
    if (!template_id) { res.status(400).json({ success: false, error: 'template_id required' }); return; }
    const result = await runReport(template_id, { columns, filters, sort_by, sort_dir, limit: 5000 });
    const csv = toCSV(result);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/report-builder/saved', authenticate, async (req, res) => {
  try {
    const { listSavedReports } = await import('../services/report-builder.service');
    const userId = req.user.id;
    const data = await listSavedReports(userId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/report-builder/saved', authenticate, async (req, res) => {
  try {
    const { saveReport } = await import('../services/report-builder.service');
    const userId = req.user.id;
    const { template_id, name, description, columns, filters, sort_by, sort_dir } = req.body;
    if (!template_id || !name) { res.status(400).json({ success: false, error: 'template_id and name required' }); return; }
    const data = await saveReport(template_id, name, { description, columns, filters, sort_by, sort_dir }, userId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/report-builder/saved/:id', authenticate, async (req, res) => {
  try {
    const { deleteSavedReport } = await import('../services/report-builder.service');
    const userId = req.user.id;
    await deleteSavedReport(req.params.id, userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/report-builder/saved/:id/schedule', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { setSchedule } = await import('../services/report-builder.service');
    const { cron, recipients } = req.body;
    if (!cron || !recipients) { res.status(400).json({ success: false, error: 'cron and recipients required' }); return; }
    const data = await setSchedule(req.params.id, cron, recipients);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/report-builder/saved/:id/schedule', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { removeSchedule } = await import('../services/report-builder.service');
    const data = await removeSchedule(req.params.id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Report export (HTML + CSV)
router.get('/reports/templates', authenticate, async (req, res) => {
  try {
    const { listTemplates } = await import('../services/report-builder.service');
    const data = listTemplates();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.post('/reports/run', authenticate, async (req, res) => {
  try {
    const { runReport } = await import('../services/report-builder.service');
    const { templateId, filters } = req.body;
    if (!templateId) { res.status(400).json({ success: false, error: 'templateId required' }); return; }
    const data = await runReport(templateId, filters || {});
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});
router.get('/reports/export/:templateId', authenticate, async (req, res) => {
  try {
    const { runReport, getTemplate, toCSV, toHTML } = await import('../services/report-builder.service');
    const format = (req.query.format as string) || 'csv';
    const template = getTemplate(req.params.templateId);
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    const data = await runReport(req.params.templateId, req.query as any);
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      res.send(toHTML(template, data.rows));
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${template.name.replace(/\s/g, '_')}_report.csv"`);
      res.send(toCSV(data));
    }
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// CLM single car on-demand lookup
router.get('/clm/car/:carNumber', authenticate, async (req, res) => {
  try {
    const { syncSingleCar } = await import('../services/clm-integration.service');
    const data = await syncSingleCar(req.params.carNumber);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/health
 * @desc    Full health check with DB connectivity, uptime, memory
 * @access  Public
 */
router.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let dbLatencyMs: number | null = null;
  try {
    const start = Date.now();
    await query('SELECT 1');
    dbLatencyMs = Date.now() - start;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  // Circuit breaker status for SAP and Salesforce integrations
  const { getAllCircuitBreakerStatuses } = await import('../services/circuit-breaker');
  const circuitBreakers = getAllCircuitBreakerStatuses();

  const mem = process.memoryUsage();
  res.json({
    success: true,
    data: {
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      uptime_seconds: Math.floor(process.uptime()),
      database: { status: dbStatus, latency_ms: dbLatencyMs },
      memory: {
        rss_mb: Math.round(mem.rss / 1024 / 1024),
        heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      },
      circuit_breakers: circuitBreakers.map(cb => ({
        name: cb.name,
        state: cb.state,
        failure_count: cb.failureCount,
        cooldown_remaining_ms: cb.cooldownRemainingMs,
      })),
    },
  });
});

/**
 * @route   GET /api/health/live
 * @desc    Liveness probe — process is alive
 * @access  Public
 */
router.get('/health/live', (req, res) => {
  res.json({ success: true, data: { status: 'alive' } });
});

/**
 * @route   GET /api/health/ready
 * @desc    Readiness probe — DB is connected, returns 503 if not
 * @access  Public
 */
router.get('/health/ready', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ success: true, data: { status: 'ready' } });
  } catch {
    res.status(503).json({ success: false, data: { status: 'not_ready' }, error: 'Database connection failed' });
  }
});

// Data Validation (admin)
router.get('/admin/data-validation', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { runFullValidation } = await import('../services/data-validation.service');
    const data = await runFullValidation();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Data Reconciliation (admin)
router.get('/migration/reconciliation/dashboard', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getReconciliationDashboard } = await import('../services/data-reconciliation.service');
    const data = await getReconciliationDashboard();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/migration/reconciliation/discrepancies', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { listDiscrepancies } = await import('../services/data-reconciliation.service');
    const data = await listDiscrepancies(req.query as any);
    res.json({ success: true, ...data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.post('/migration/reconciliation/discrepancies/:id/resolve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { resolveDiscrepancy } = await import('../services/data-reconciliation.service');
    const data = await resolveDiscrepancy(req.params.id, req.body, req.user?.id);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.post('/migration/reconciliation/discrepancies/bulk-resolve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { bulkResolveDiscrepancies } = await import('../services/data-reconciliation.service');
    const { ids, ...resolution } = req.body;
    const data = await bulkResolveDiscrepancies(ids, resolution, req.user?.id);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/migration/reconciliation/duplicates', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { detectDuplicates } = await import('../services/data-reconciliation.service');
    const data = await detectDuplicates(req.query.entity_type as any);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// Training Progress
router.get('/training/modules', authenticate, async (req, res) => {
  try {
    const { listModules } = await import('../services/training-progress.service');
    const data = await listModules();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/training/progress', authenticate, async (req, res) => {
  try {
    const { getUserProgress } = await import('../services/training-progress.service');
    const data = await getUserProgress(req.user?.id);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.post('/training/modules/:moduleId/start', authenticate, async (req, res) => {
  try {
    const { startModule } = await import('../services/training-progress.service');
    const data = await startModule(req.user?.id, req.params.moduleId);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.post('/training/modules/:moduleId/complete', authenticate, async (req, res) => {
  try {
    const { completeModule } = await import('../services/training-progress.service');
    const data = await completeModule(req.user?.id, req.params.moduleId, req.body.score);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.put('/training/modules/:moduleId/progress', authenticate, async (req, res) => {
  try {
    const { updateProgress } = await import('../services/training-progress.service');
    const data = await updateProgress(req.user?.id, req.params.moduleId, req.body.timeSpent);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/training/certifications', authenticate, async (req, res) => {
  try {
    const { getUserCertifications } = await import('../services/training-progress.service');
    const data = await getUserCertifications(req.user?.id);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.post('/training/certifications', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { grantCertification } = await import('../services/training-progress.service');
    const data = await grantCertification(req.body.userId, req.body.certType, req.user?.id, req.body.notes);
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/training/organization', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getOrganizationProgress } = await import('../services/training-progress.service');
    const data = await getOrganizationProgress();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

router.get('/training/readiness', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { getReadinessAssessment } = await import('../services/training-progress.service');
    const data = await getReadinessAssessment();
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'Internal server error' }); }
});

export default router;
