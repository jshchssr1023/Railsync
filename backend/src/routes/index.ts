import { Router } from 'express';
import carController from '../controllers/car.controller';
import shopController from '../controllers/shop.controller';
import ruleController from '../controllers/rule.controller';
import { validateEvaluationRequest } from '../middleware/validation';

const router = Router();

// ============================================================================
// CAR ROUTES
// ============================================================================

/**
 * @route   GET /api/cars/:carNumber
 * @desc    Retrieve car attributes and active service event
 * @access  Public
 */
router.get('/cars/:carNumber', carController.getCarByNumber);

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
 * @access  Public
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
router.post('/shops/evaluate', validateEvaluationRequest, shopController.evaluateShops);

/**
 * @route   GET /api/shops/:shopCode/backlog
 * @desc    Get current backlog and capacity metrics
 * @access  Public
 */
router.get('/shops/:shopCode/backlog', shopController.getShopBacklog);

// ============================================================================
// RULE ROUTES
// ============================================================================

/**
 * @route   GET /api/rules
 * @desc    List all eligibility rules with status
 * @access  Public
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
 * @access  Public
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
router.put('/rules/:ruleId', ruleController.updateRule);

/**
 * @route   POST /api/rules
 * @desc    Create a new rule
 * @access  Public
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
router.post('/rules', ruleController.createRule);

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
