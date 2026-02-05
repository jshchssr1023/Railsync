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

// Dashboard Types
export interface DashboardWidget {
  id: string;
  name: string;
  description?: string;
  category: string;
  default_width: number;
  default_height: number;
  data_endpoint?: string;
  is_active: boolean;
}

export interface WidgetPlacement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  settings?: Record<string, unknown>;
}

export interface DashboardLayout {
  columns: number;
  widgets: WidgetPlacement[];
}

export interface DashboardConfig {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  layout: DashboardLayout;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SHOPPING WORKFLOW TYPES
// ============================================================================

export type ShoppingEventState =
  | 'REQUESTED'
  | 'ASSIGNED_TO_SHOP'
  | 'INBOUND'
  | 'INSPECTION'
  | 'ESTIMATE_SUBMITTED'
  | 'ESTIMATE_UNDER_REVIEW'
  | 'ESTIMATE_APPROVED'
  | 'CHANGES_REQUIRED'
  | 'WORK_AUTHORIZED'
  | 'IN_REPAIR'
  | 'QA_COMPLETE'
  | 'FINAL_ESTIMATE_SUBMITTED'
  | 'FINAL_ESTIMATE_APPROVED'
  | 'READY_FOR_RELEASE'
  | 'RELEASED'
  | 'CANCELLED';

export interface ShoppingEvent {
  id: string;
  event_number: string;
  car_id: string | null;
  car_number: string;
  shop_code: string;
  batch_id: string | null;
  car_assignment_id: string | null;
  state: ShoppingEventState;
  shopping_type_code: string | null;
  shopping_reason_code: string | null;
  scope_of_work_id: string | null;
  cancelled_at: string | null;
  cancelled_by_id: string | null;
  cancellation_reason: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  version: number;
  shop_name?: string;
  batch_number?: string;
}

export interface ShoppingBatch {
  id: string;
  batch_number: string;
  shop_code: string;
  shopping_type_code: string | null;
  shopping_reason_code: string | null;
  scope_of_work_id: string | null;
  notes: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface StateHistoryEntry {
  id: string;
  shopping_event_id: string;
  from_state: string | null;
  to_state: string;
  changed_by_id: string | null;
  changed_by_email?: string;
  changed_at: string;
  notes: string | null;
}

export interface JobCode {
  id: string;
  code: string;
  code_type: 'aar' | 'internal';
  description: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScopeLibraryTemplate {
  id: string;
  name: string;
  car_type: string | null;
  shopping_type: string | null;
  shopping_reason: string | null;
  description: string | null;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  items?: ScopeLibraryItem[];
}

export interface ScopeLibraryItem {
  id: string;
  scope_library_id: string;
  line_number: number;
  instruction_text: string;
  source: string;
  ccm_section_id: string | null;
  created_at: string;
  updated_at: string;
  job_codes?: JobCodeRef[];
}

export interface JobCodeRef {
  id: string;
  code: string;
  code_type: string;
  description: string;
  is_expected: boolean;
  notes: string | null;
}

export interface ScopeOfWork {
  id: string;
  scope_library_id: string | null;
  status: 'draft' | 'finalized' | 'sent';
  finalized_at: string | null;
  finalized_by_id: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  items?: SOWItem[];
}

export interface SOWItem {
  id: string;
  scope_of_work_id: string;
  line_number: number;
  instruction_text: string;
  source: string;
  ccm_section_id: string | null;
  scope_library_item_id: string | null;
  created_at: string;
  updated_at: string;
  job_codes?: JobCodeRef[];
}

export interface EstimateSubmission {
  id: string;
  shopping_event_id: string;
  version_number: number;
  submitted_by: string | null;
  submitted_at: string | null;
  status: 'submitted' | 'under_review' | 'approved' | 'changes_required' | 'rejected';
  total_labor_hours: number | null;
  total_material_cost: number | null;
  total_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines?: EstimateLine[];
}

export interface EstimateLine {
  id: string;
  estimate_submission_id: string;
  line_number: number;
  aar_code: string | null;
  job_code: string | null;
  description: string | null;
  labor_hours: number | null;
  material_cost: number | null;
  total_cost: number | null;
  sow_item_id: string | null;
  created_at: string;
}

export interface EstimateLineDecision {
  id: string;
  estimate_line_id: string;
  decision_source: 'ai' | 'human';
  decision: 'approve' | 'review' | 'reject';
  confidence_score: number | null;
  responsibility: 'lessor' | 'customer' | 'unknown';
  basis_type: string | null;
  basis_reference: string | null;
  decision_notes: string | null;
  decided_by_id: string | null;
  decided_at: string;
}

export interface CCMForm {
  id: string;
  company_name: string;
  customer_code: string | null;
  form_date: string | null;
  revision_date: string | null;
  created_at: string;
  updated_at: string;
  sealing_count?: number;
  lining_count?: number;
  attachment_count?: number;
}

export interface CCMFormSOWSection {
  category: string;
  label: string;
  content: string;
  ccm_form_id: string;
}

// ============================================================================
// CCM Instructions (Hierarchy-Level with Inheritance)
// ============================================================================

export type CCMScopeLevel = 'customer' | 'master_lease' | 'rider' | 'amendment';

export interface CCMInstructionScope {
  type: CCMScopeLevel;
  id: string;
}

export interface CCMInstructionFields {
  // Cleaning Requirements
  food_grade?: boolean | null;
  mineral_wipe?: boolean | null;
  kosher_wash?: boolean | null;
  kosher_wipe?: boolean | null;
  shop_oil_material?: boolean | null;
  oil_provider_contact?: string | null;
  rinse_water_test_procedure?: string | null;

  // Primary Contact
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;

  // Estimate Approval Contact
  estimate_approval_contact_name?: string | null;
  estimate_approval_contact_email?: string | null;
  estimate_approval_contact_phone?: string | null;

  // Dispo Contact
  dispo_contact_name?: string | null;
  dispo_contact_email?: string | null;
  dispo_contact_phone?: string | null;

  // Outbound Dispo
  decal_requirements?: string | null;
  nitrogen_applied?: boolean | null;
  nitrogen_psi?: string | null;
  outbound_dispo_contact_email?: string | null;
  outbound_dispo_contact_phone?: string | null;
  documentation_required_prior_to_release?: string | null;

  // Special Fittings & Notes
  special_fittings_vendor_requirements?: string | null;
  additional_notes?: string | null;
}

export interface CCMInstructionSealing {
  id?: string;
  ccm_instruction_id?: string;
  commodity: string;
  gasket_sealing_material?: string | null;
  alternate_material?: string | null;
  preferred_gasket_vendor?: string | null;
  alternate_vendor?: string | null;
  vsp_ride_tight?: boolean | null;
  sealing_requirements?: string | null;
  inherit_from_parent?: boolean;
  sort_order?: number;
}

export interface CCMInstructionLining {
  id?: string;
  ccm_instruction_id?: string;
  commodity: string;
  lining_required?: boolean | null;
  lining_inspection_interval?: string | null;
  lining_type?: string | null;
  lining_plan_on_file?: boolean | null;
  lining_requirements?: string | null;
  inherit_from_parent?: boolean;
  sort_order?: number;
}

export interface CCMInstruction extends CCMInstructionFields {
  id: string;
  scope_level: CCMScopeLevel;
  scope_name?: string;
  customer_id?: string | null;
  master_lease_id?: string | null;
  rider_id?: string | null;
  amendment_id?: string | null;
  version: number;
  is_current: boolean;
  created_by_id?: string;
  created_at: string;
  updated_at: string;
  // Related data
  sealing_sections?: CCMInstructionSealing[];
  lining_sections?: CCMInstructionLining[];
  // View fields (from v_ccm_instructions)
  customer_name?: string;
  customer_code?: string;
  lease_code?: string;
  lease_name?: string;
  rider_code?: string;
  rider_name?: string;
  amendment_code?: string;
  amendment_summary?: string;
  sealing_count?: number;
  lining_count?: number;
  created_by_email?: string;
  created_by_name?: string;
}

export interface CCMHierarchyNode {
  id: string;
  type: CCMScopeLevel;
  name: string;
  code?: string;
  hasCCM: boolean;
  isActive: boolean;
  children?: CCMHierarchyNode[];
}

export interface CCMInheritanceChainItem {
  level: CCMScopeLevel;
  id: string | null;
  name: string | null;
  fields_defined: string[];
}

export interface EffectiveCCM {
  effective: CCMInstructionFields;
  field_sources: Record<string, CCMScopeLevel | null>;
  inheritance_chain: CCMInheritanceChainItem[];
  sealing_by_commodity: Record<string, { data: CCMInstructionSealing; source: CCMScopeLevel }>;
  lining_by_commodity: Record<string, { data: CCMInstructionLining; source: CCMScopeLevel }>;
  hierarchy: {
    customer_id: string | null;
    customer_name: string | null;
    master_lease_id: string | null;
    lease_name: string | null;
    rider_id: string | null;
    rider_name: string | null;
    amendment_id: string | null;
    amendment_name: string | null;
  };
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
  locked_at?: string;
  locked_by?: string;
  lock_version: number;
  superseded_by_id?: string;
  superseded_at?: string;
  supersede_reason?: string;
  is_opportunistic: boolean;
  opportunistic_source?: string;
  original_shopping_event_id?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
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
  event_timestamp: string;
  actor_id?: string;
  actor_email?: string;
  actor_name?: string;
  action: string;
  before_state?: string;
  after_state?: string;
  plan_snapshot?: Record<string, unknown>;
  reason?: string;
  notes?: string;
}

export interface ProjectCommunication {
  id: string;
  project_id: string;
  communication_type: CommunicationType;
  plan_version_snapshot: Record<string, unknown>;
  communicated_at: string;
  communicated_by: string;
  communicated_to?: string;
  communication_method?: CommunicationMethod;
  subject?: string;
  notes?: string;
  email_queue_id?: string;
  created_at: string;
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
  last_plan_locked_at?: string;
  last_communicated_at?: string;
  assignments: ProjectAssignment[];
  assignments_by_shop: Record<string, ProjectAssignment[]>;
}
