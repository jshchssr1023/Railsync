// ============================================================================
// AUTH TYPES
// ============================================================================
export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  organization?: string;
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface UserPublic {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  organization?: string;
  is_active: boolean;
  last_login?: Date;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked_at?: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================
export interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  action: AuditAction;
  entity_type: string;
  entity_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  created_at: Date;
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_change'
  | 'evaluate'
  | 'shop_select'
  | 'import'
  | 'deactivate'
  | 'activate'
  | 'update_permissions'
  | 'update_members'
  | 'assign_customer';

// ============================================================================
// SHOP TYPES
// ============================================================================
export interface Shop {
  shop_code: string;
  shop_name: string;
  primary_railroad: string;
  region: string;
  city?: string;
  state?: string;
  labor_rate: number;
  material_multiplier: number;
  is_preferred_network: boolean;
  is_active: boolean;
  latitude?: number;
  longitude?: number;
}

export interface ShopCapability {
  id: string;
  shop_code: string;
  capability_type: CapabilityType;
  capability_value: string;
  certified_date?: Date;
  expiration_date?: Date;
  is_active: boolean;
}

export type CapabilityType =
  | 'car_type'
  | 'material'
  | 'lining'
  | 'certification'
  | 'nitrogen_stage'
  | 'service'
  | 'special';

export interface ShopBacklog {
  shop_code: string;
  date: Date;
  hours_backlog: number;
  cars_backlog: number;
  cars_en_route_0_6: number;
  cars_en_route_7_14: number;
  cars_en_route_15_plus: number;
  weekly_inbound: number;
  weekly_outbound: number;
  updated_at?: Date;
}

export interface ShopCapacity {
  shop_code: string;
  work_type: WorkType;
  weekly_hours_capacity: number;
  current_utilization_pct: number;
  available_hours: number;
}

export type WorkType = 'cleaning' | 'flare' | 'mechanical' | 'blast' | 'lining' | 'paint';

// ============================================================================
// CAR TYPES
// ============================================================================
export interface Car {
  car_number: string;
  product_code: string;
  material_type: MaterialType;
  stencil_class?: string;
  lining_type?: string;
  commodity_cin?: string;
  has_asbestos: boolean;
  asbestos_abatement_required: boolean;
  nitrogen_pad_stage?: number;
  last_repair_date?: Date;
  last_repair_shop?: string;
  owner_code?: string;
  lessee_code?: string;
}

export type MaterialType = 'Carbon Steel' | 'Stainless' | 'Aluminum';

export interface CarWithCommodity extends Car {
  commodity?: Commodity;
  // Additional display fields from cars table
  lessee_name?: string;
  car_type?: string;
  is_jacketed?: boolean;
  is_lined?: boolean;
  current_status?: string;
  qual_exp_date?: Date;
  commodity_description?: string;
}

// ============================================================================
// COMMODITY TYPES
// ============================================================================
export interface Commodity {
  cin_code: string;
  description: string;
  cleaning_class?: string;
  recommended_price?: number;
  hazmat_class?: string;
  requires_kosher: boolean;
  requires_nitrogen: boolean;
  nitrogen_stage?: number;
}

export interface CommodityRestriction {
  cin_code: string;
  shop_code: string;
  restriction_code: RestrictionCode;
  restriction_reason?: string;
}

export type RestrictionCode = 'Y' | 'N' | 'RC1' | 'RC2' | 'RC3' | 'RC4';

// ============================================================================
// SERVICE EVENT TYPES
// ============================================================================
export interface ServiceEvent {
  event_id: string;
  car_number: string;
  event_type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  requested_date: Date;
  assigned_shop?: string;
  estimated_cost?: number;
  actual_cost?: number;
  override_exterior_paint?: boolean;
  override_new_lining?: boolean;
  override_interior_blast?: boolean;
  override_kosher_cleaning?: boolean;
  override_primary_network?: boolean;
  notes?: string;
}

// ============================================================================
// RULE TYPES
// ============================================================================
export interface EligibilityRule {
  rule_id: string;
  rule_name: string;
  rule_category: RuleCategory;
  rule_description?: string;
  condition_json: RuleCondition;
  priority: number;
  is_active: boolean;
  is_blocking: boolean;
}

export type RuleCategory =
  | 'car_type'
  | 'material'
  | 'lining'
  | 'certification'
  | 'commodity'
  | 'capacity'
  | 'network'
  | 'special'
  | 'service';

export interface RuleCondition {
  type?: string;
  field?: string;
  operator?: string;
  value?: any;
  threshold?: number;
  condition?: string;
  conditions?: RuleCondition[];
  check_field?: string;
  check_value?: any;
  check_not_null?: boolean;
  require?: {
    capability_type?: string;
    capability_value?: string;
    field?: string;
    value?: any;
  };
  capability_type?: string;
  match_field?: string;
  restriction_codes_block?: string[];
}

// ============================================================================
// EVALUATION TYPES
// ============================================================================

/**
 * Direct car input for evaluation without database lookup
 */
export interface DirectCarInput {
  // Car Identity
  product_code: string;
  stencil_class?: string;

  // Car Attributes
  material_type?: MaterialType;
  lease_rate?: number;

  // Commodity
  commodity_cin?: string;
  car_cleaned_flag?: boolean;

  // Lining
  lining_type?: string;
  current_lining?: string;

  // Compliance
  hm201_due?: boolean;
  non_hm201_due?: boolean;
  railroad_damage?: boolean;

  // Special
  nitrogen_pad_stage?: number;
  has_asbestos?: boolean;
  asbestos_abatement_required?: boolean;
}

export interface EvaluationRequest {
  // Option 1: Lookup car by number (existing behavior)
  car_number?: string;

  // Option 2: Direct car input (new in Phase 3)
  car_input?: DirectCarInput;

  // Evaluation parameters
  overrides?: EvaluationOverrides;
  origin_region?: string;
}

export interface EvaluationOverrides {
  exterior_paint?: boolean;
  new_lining?: boolean;
  interior_blast?: boolean;
  kosher_cleaning?: boolean;
  primary_network?: boolean;
  // Extended overrides for Phase 3
  blast_type?: 'Brush' | 'Commercial' | 'WhiteMetal' | 'None';
  lining_type?: string;
}

/**
 * Derived fields calculated from product code
 */
export interface DerivedCarFields {
  product_code_group: string;
  is_tank: boolean;
  is_hopper: boolean;
  is_covered_hopper: boolean;
  is_boxcar: boolean;
  is_gondola: boolean;
  is_flatcar: boolean;
  is_autorack: boolean;
  requires_hm201: boolean;
}

export interface EvaluationResult {
  shop: ShopSummary;
  is_eligible: boolean;
  failed_rules: FailedRule[];
  cost_breakdown: CostBreakdown;
  backlog: ShopBacklog;
  capacity: ShopCapacity[];
  // New fields for Phase 3 Excel parity
  hours_by_type: HoursByType;
  restriction_code: RestrictionCode | null;
  rules: RuleEvaluation[];
}

export interface ShopSummary {
  shop_code: string;
  shop_name: string;
  primary_railroad: string;
  region: string;
  labor_rate: number;
  is_preferred_network: boolean;
}

export interface FailedRule {
  rule_id: string;
  rule_name: string;
  rule_category: string;
  reason: string;
}

export interface CostBreakdown {
  labor_cost: number;
  material_cost: number;
  abatement_cost: number;
  freight_cost: number;
  total_cost: number;
}

export interface HoursByType {
  cleaning: number;
  flare: number;
  mechanical: number;
  blast: number;
  lining: number;
  paint: number;
  other: number;
}

export type RuleResult = 1 | 0 | 'NA';

export interface RuleEvaluation {
  rule: string;
  result: RuleResult;
  reason: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

// ============================================================================
// PHASE 9 - PLANNING, BUDGETING & FORECASTING TYPES
// ============================================================================

// Extended Car type for planning (from Qual_Planner_Master.csv)
export interface CarMaster extends Car {
  car_id: string;           // Full car ID "SHQX006002"
  car_mark: string;         // Mark only "SHQX"
  car_type?: string;        // "General Service Tank"
  lessee_name?: string;
  contract_number?: string;
  contract_expiration?: Date;
  portfolio_status?: string; // "On Lease", "2025", etc.
  commodity?: string;
  is_jacketed?: boolean;
  is_lined?: boolean;
  car_age?: number;
  // Compliance dates (year of next due)
  min_no_lining_year?: number;
  min_lining_year?: number;
  interior_lining_year?: number;
  rule_88b_year?: number;
  safety_relief_year?: number;
  service_equipment_year?: number;
  stub_sill_year?: number;
  tank_thickness_year?: number;
  tank_qual_year?: number;
  // Planning status
  current_status?: string;
  adjusted_status?: string;
  plan_status?: string;
  assigned_shop_code?: string;
  assigned_date?: Date;
}

// Running Repairs Budget
export interface RunningRepairsBudget {
  id: string;
  fiscal_year: number;
  month: string;              // "2026-01"
  cars_on_lease: number;
  allocation_per_car: number;
  monthly_budget: number;
  actual_spend: number;
  actual_car_count: number;
  remaining_budget: number;
  notes?: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

// Service Event Budget
export interface ServiceEventBudget {
  id: string;
  fiscal_year: number;
  event_type: EventType;
  budgeted_car_count: number;
  avg_cost_per_car: number;
  total_budget: number;
  customer_code?: string;
  fleet_segment?: string;
  car_type?: string;
  notes?: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export type EventType = 'Qualification' | 'Assignment' | 'Return' | 'Running Repair';

// Demand
export interface Demand {
  id: string;
  name: string;
  description?: string;
  fiscal_year: number;
  target_month: string;       // "2026-04"
  car_count: number;
  event_type: EventType;
  car_type?: string;
  default_lessee_code?: string;
  default_material_type?: string;
  default_lining_type?: string;
  default_commodity?: string;
  priority: DemandPriority;
  required_network?: string;
  required_region?: string;
  max_cost_per_car?: number;
  excluded_shops?: string[];
  project_id?: string;
  status: DemandStatus;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export type DemandPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type DemandStatus = 'Forecast' | 'Confirmed' | 'Allocating' | 'Allocated' | 'Complete';

// Shop Monthly Capacity
export interface ShopMonthlyCapacity {
  id: string;
  shop_code: string;
  month: string;              // "2026-04"
  total_capacity: number;
  allocated_count: number;
  completed_count: number;
  available_capacity: number;
  utilization_pct: number;
  updated_at: Date;
}

// Scenario
export interface Scenario {
  id: string;
  name: string;
  description?: string;
  weights: ScenarioWeights;
  constraints?: ScenarioConstraints;
  is_default: boolean;
  is_system: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ScenarioWeights {
  cost: number;
  cycle_time: number;
  aitx_preference: number;
  capacity_balance: number;
  quality_score: number;
}

export interface ScenarioConstraints {
  max_utilization_pct?: number;
  min_quality_score?: number;
  required_network?: string;
  excluded_shops?: string[];
}

// Allocation
export interface Allocation {
  id: string;
  demand_id?: string;
  scenario_id?: string;
  plan_id?: string;
  car_id?: string;
  car_mark_number?: string;
  car_number?: string;
  shop_code: string | null;
  target_month: string;
  status: AllocationStatus;
  estimated_cost?: number;
  estimated_cost_breakdown?: CostBreakdown;
  actual_cost?: number;
  actual_cost_breakdown?: BRCCostBreakdown;
  brc_number?: string;
  brc_received_at?: Date;
  planned_arrival_date?: Date;
  actual_arrival_date?: Date;
  planned_completion_date?: Date;
  actual_completion_date?: Date;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export type AllocationStatus =
  | 'Need Shopping'
  | 'To Be Routed'
  | 'Planned Shopping'
  | 'Enroute'
  | 'Arrived'
  | 'Complete'
  | 'Released';

export interface BRCCostBreakdown {
  labor: number;
  material: number;
  labor_hours: number;
  job_codes: { code: string; amount: number }[];
}

// BRC Record (AAR 500-byte format)
export interface BRCRecord {
  car_mark: string;
  car_number: string;
  car_id: string;
  billing_date: Date;
  completion_date: Date;
  shop_code: string;
  card_type: string;
  why_made_code: string;
  labor_amount: number;
  material_amount: number;
  total_amount: number;
  labor_hours: number;
  job_codes: { code: string; amount: number }[];
  raw_record: string;
}

export interface BRCImportResult {
  id: string;
  filename: string;
  total: number;
  matched_to_allocation: number;
  created_running_repair: number;
  errors: string[];
}

// Forecast
export interface ForecastResult {
  fiscal_year: number;
  summary: {
    total_budget: number;
    total_planned: number;
    total_actual: number;
    remaining_budget: number;
    budget_consumed_pct: number;
  };
  by_type: ForecastLine[];
  by_month?: MonthlyForecast[];
}

export interface ForecastLine {
  budget_type: string;
  event_type?: string;
  total_budget: number;
  planned_cost: number;
  planned_car_count: number;
  actual_cost: number;
  actual_car_count: number;
  remaining_budget: number;
}

export interface MonthlyForecast {
  target_month: string;
  planned_cost: number;
  actual_cost: number;
  cumulative_planned: number;
  cumulative_actual: number;
}

// Dashboard
export interface DashboardWidget {
  id: string;
  name: string;
  description?: string;
  category: 'Budget' | 'Capacity' | 'Operations' | 'Performance';
  default_width: number;
  default_height: number;
  config_schema?: Record<string, unknown>;
  data_endpoint?: string;
  is_active: boolean;
}

export interface DashboardConfig {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  layout: DashboardLayout;
  created_at: Date;
  updated_at: Date;
}

export interface DashboardLayout {
  columns: number;
  widgets: WidgetPlacement[];
}

export interface WidgetPlacement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  settings?: Record<string, unknown>;
}

// ============================================================================
// PROJECT PLANNING TYPES
// ============================================================================

export type ProjectAssignmentState = 'Planned' | 'Locked' | 'Superseded' | 'Cancelled';
export type CommunicationType = 'plan_shared' | 'lock_notification' | 'relock_notification' | 'status_update' | 'completion_notice' | 'other';
export type CommunicationMethod = 'email' | 'phone' | 'meeting' | 'portal' | 'other';

export interface ProjectAssignment {
  id: string;
  project_id: string;
  project_car_id: string;
  car_number: string;
  car_assignment_id?: string;
  shop_code: string;
  shop_name?: string;
  target_month: string;
  target_date?: string;
  estimated_cost?: number;
  plan_state: ProjectAssignmentState;
  locked_at?: Date;
  locked_by?: string;
  lock_version: number;
  superseded_by_id?: string;
  superseded_at?: Date;
  supersede_reason?: string;
  is_opportunistic: boolean;
  opportunistic_source?: string;
  original_shopping_event_id?: string;
  created_at: Date;
  created_by?: string;
  updated_at: Date;
  version: number;
  // View fields
  project_number?: string;
  project_name?: string;
  project_type?: string;
  project_status?: string;
  car_status?: string;
  assignment_status?: string;
  locked_by_name?: string;
  created_by_name?: string;
}

export interface ProjectPlanAuditEvent {
  id: string;
  project_id: string;
  project_assignment_id?: string;
  car_number?: string;
  event_timestamp: Date;
  actor_id?: string;
  actor_email?: string;
  actor_name?: string;
  action: string;
  before_state?: string;
  after_state?: string;
  plan_snapshot?: Record<string, unknown>;
  reason?: string;
  notes?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface ProjectCommunication {
  id: string;
  project_id: string;
  communication_type: CommunicationType;
  plan_version_snapshot: Record<string, unknown>;
  communicated_at: Date;
  communicated_by: string;
  communicated_to?: string;
  communication_method?: CommunicationMethod;
  subject?: string;
  notes?: string;
  email_queue_id?: string;
  created_at: Date;
  // View fields
  communicated_by_name?: string;
}

export interface ProjectPlanSummary {
  project_id: string;
  project_number: string;
  project_name: string;
  total_cars: number;
  unplanned_cars: number;
  planned_cars: number;
  locked_cars: number;
  completed_cars: number;
  total_estimated_cost: number;
  plan_version: number;
  last_plan_locked_at?: Date;
  last_communicated_at?: Date;
  assignments: ProjectAssignment[];
  assignments_by_shop: Record<string, ProjectAssignment[]>;
}
