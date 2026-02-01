// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth Types
export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  organization?: string;
  is_active: boolean;
  last_login?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  created_at: string;
}

// Car Types
export interface Car {
  car_number: string;
  product_code: string;
  material_type: string;
  stencil_class?: string;
  lining_type?: string;
  commodity_cin?: string;
  has_asbestos: boolean;
  asbestos_abatement_required: boolean;
  nitrogen_pad_stage?: number;
  owner_code?: string;
  lessee_code?: string;
  commodity?: Commodity;
}

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

export interface ServiceEvent {
  event_id: string;
  car_number: string;
  event_type: string;
  status: string;
  requested_date: string;
  assigned_shop?: string;
  override_exterior_paint?: boolean;
  override_new_lining?: boolean;
  override_interior_blast?: boolean;
  override_kosher_cleaning?: boolean;
  override_primary_network?: boolean;
}

// Shop Types
export interface ShopSummary {
  shop_code: string;
  shop_name: string;
  primary_railroad: string;
  region: string;
  labor_rate: number;
  is_preferred_network: boolean;
}

export interface ShopBacklog {
  shop_code: string;
  date: string;
  hours_backlog: number;
  cars_backlog: number;
  cars_en_route_0_6: number;
  cars_en_route_7_14: number;
  cars_en_route_15_plus: number;
  weekly_inbound: number;
  weekly_outbound: number;
  updated_at?: string;
}

export interface ShopCapacity {
  shop_code: string;
  work_type: string;
  weekly_hours_capacity: number;
  current_utilization_pct: number;
  available_hours: number;
}

// Evaluation Types
export interface EvaluationOverrides {
  exterior_paint?: boolean;
  new_lining?: boolean;
  interior_blast?: boolean;
  kosher_cleaning?: boolean;
  primary_network?: boolean;
}

export interface CostBreakdown {
  labor_cost: number;
  material_cost: number;
  abatement_cost: number;
  freight_cost: number;
  total_cost: number;
}

export interface FailedRule {
  rule_id: string;
  rule_name: string;
  rule_category: string;
  reason: string;
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

export type RestrictionCode = 'Y' | 'N' | 'RC1' | 'RC2' | 'RC3' | 'RC4' | null;

export interface EvaluationResult {
  shop: ShopSummary;
  is_eligible: boolean;
  failed_rules: FailedRule[];
  cost_breakdown: CostBreakdown;
  backlog: ShopBacklog;
  capacity: ShopCapacity[];
  // Phase 3 additions
  hours_by_type?: HoursByType;
  restriction_code?: RestrictionCode;
  rules?: RuleEvaluation[];
}

// Rule Types
export interface EligibilityRule {
  rule_id: string;
  rule_name: string;
  rule_category: string;
  rule_description?: string;
  priority: number;
  is_active: boolean;
  is_blocking: boolean;
  condition_json: any;
}

// ============================================================================
// PHASE 9 - PLANNING, BUDGETING & FORECASTING TYPES
// ============================================================================

// Budget Types
export interface RunningRepairsBudget {
  id: string;
  fiscal_year: number;
  month: string;
  cars_on_lease: number;
  allocation_per_car: number;
  monthly_budget: number;
  actual_spend: number;
  actual_car_count: number;
  remaining_budget: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type EventType = 'Qualification' | 'Assignment' | 'Return' | 'Running Repair';

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
  created_at: string;
  updated_at: string;
}

// Demand Types
export type DemandPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type DemandStatus = 'Forecast' | 'Confirmed' | 'Allocating' | 'Allocated' | 'Complete';

export interface Demand {
  id: string;
  name: string;
  description?: string;
  fiscal_year: number;
  target_month: string;
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
  status: DemandStatus;
  created_at: string;
  updated_at: string;
}

// Capacity Types
export interface ShopMonthlyCapacity {
  id: string;
  shop_code: string;
  month: string;
  total_capacity: number;
  allocated_count: number;
  completed_count: number;
  available_capacity: number;
  utilization_pct: number;
  updated_at: string;
}

// Scenario Types
export interface ScenarioWeights {
  cost: number;
  cycle_time: number;
  aitx_preference: number;
  capacity_balance: number;
  quality_score: number;
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  weights: ScenarioWeights;
  constraints?: Record<string, unknown>;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// Allocation Types
export type AllocationStatus =
  | 'Need Shopping'
  | 'To Be Routed'
  | 'Planned Shopping'
  | 'Enroute'
  | 'Arrived'
  | 'Complete'
  | 'Released';

export interface Allocation {
  id: string;
  demand_id?: string;
  scenario_id?: string;
  car_id: string;
  car_number?: string;
  shop_code: string;
  target_month: string;
  status: AllocationStatus;
  estimated_cost?: number;
  estimated_cost_breakdown?: CostBreakdown;
  actual_cost?: number;
  brc_number?: string;
  brc_received_at?: string;
  planned_arrival_date?: string;
  actual_arrival_date?: string;
  actual_completion_date?: string;
  created_at: string;
  updated_at: string;
}

// BRC Types
export interface BRCImportResult {
  id: string;
  filename: string;
  total: number;
  matched_to_allocation: number;
  created_running_repair: number;
  errors: string[];
}

export interface BRCImportHistory {
  id: string;
  filename: string;
  record_count: number;
  matched_count: number;
  running_repair_count: number;
  error_count: number;
  imported_at: string;
}

// Forecast Types
export interface ForecastSummary {
  total_budget: number;
  total_planned: number;
  total_actual: number;
  remaining_budget: number;
  budget_consumed_pct: number;
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

export interface ForecastResult {
  fiscal_year: number;
  summary: ForecastSummary;
  by_type: ForecastLine[];
  by_month: MonthlyForecast[];
}

// Budget Summary
export interface BudgetSummary {
  fiscal_year: number;
  running_repairs: {
    total_budget: number;
    actual_spend: number;
    remaining: number;
  };
  service_events: {
    total_budget: number;
    planned_cost: number;
    actual_cost: number;
    remaining: number;
  };
  total: {
    budget: number;
    committed: number;
    remaining: number;
    consumed_pct: number;
  };
}
