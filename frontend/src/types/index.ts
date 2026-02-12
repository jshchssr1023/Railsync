// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth Types
export type UserRole = 'admin' | 'operator' | 'viewer' | 'shop';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  organization?: string;
  shop_code?: string;
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
export type OperationalStatusGroup = 'in_shop' | 'idle_storage' | 'ready_to_load' | 'pending';
export type OperationalDisposition = 'IN_SHOP' | 'IDLE' | 'SCRAP_WORKFLOW';
export type RiderCarStatus = 'decided' | 'prep_required' | 'on_rent' | 'releasing' | 'off_rent' | 'cancelled';

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
  operational_status_group?: OperationalStatusGroup | null;
  operational_disposition?: OperationalDisposition | null;
  ready_to_load?: boolean;
  is_active?: boolean;
}

export interface FleetSummary {
  on_rent_count: number;
  in_shop_count: number;
  idle_storage_count: number;
  pending_count: number;
  ready_to_load_count: number;
  scrap_count: number;
  releasing_count: number;
  total_fleet: number;
}

// Scrap Types
export type ScrapStatus = 'proposed' | 'under_review' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Scrap {
  id: string;
  car_id: string;
  car_number: string;
  status: ScrapStatus;
  reason: string;
  estimated_salvage_value: number | null;
  actual_salvage_value: number | null;
  facility_code: string | null;
  target_date: string | null;
  completion_date: string | null;
  completion_notes: string | null;
  proposed_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_by: string | null;
  scheduled_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  completed_by: string | null;
  completed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

// Triage Queue Types
export type TriageReason = 'lease_expiring' | 'lease_expired' | 'scrap_cancelled'
  | 'customer_return' | 'bad_order' | 'qualification_due' | 'market_conditions' | 'manual';
export type TriageResolution = 'assigned_to_shop' | 'assigned_to_customer'
  | 'released_to_idle' | 'scrap_proposed' | 'dismissed';

export interface TriageQueueEntry {
  id: string;
  car_id: string;
  car_number: string;
  reason: TriageReason;
  priority: string;
  notes?: string;
  resolved_at?: string;
  resolution?: TriageResolution;
  resolved_by?: string;
  created_at: string;
  created_by?: string;
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
  project_id?: string;
  plan_id?: string;
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
  plan_id?: string;
  demand_id?: string;
  scenario_id?: string;
  car_id?: string;
  car_mark_number?: string;
  car_number?: string;
  shop_code: string | null;
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
  car_mark?: string;
  car_type?: string;
  lessee_name?: string;
  lessee_code?: string;
  contract_number?: string;
  shop_name?: string;
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
    planned: number;
    shop_committed: number;
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
// COMPONENT REGISTRY TYPES
// ============================================================================

export type ComponentType = 'valve' | 'bov' | 'fitting' | 'gauge' | 'relief_device' | 'lining' | 'coating' | 'heater' | 'other';
export type ComponentStatus = 'active' | 'removed' | 'failed' | 'replaced';
export type ComponentHistoryAction = 'installed' | 'inspected' | 'repaired' | 'replaced' | 'removed' | 'failed';

export interface RailcarComponent {
  id: string;
  car_number: string;
  component_type: ComponentType;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  install_date: string | null;
  last_inspection_date: string | null;
  next_inspection_due: string | null;
  status: ComponentStatus;
  specification: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComponentHistory {
  id: string;
  component_id: string;
  action: ComponentHistoryAction;
  performed_by: string | null;
  performed_at: string;
  shop_code: string | null;
  old_serial_number: string | null;
  new_serial_number: string | null;
  work_order_reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface ComponentWithHistory extends RailcarComponent {
  history: ComponentHistory[];
}

export interface ComponentStats {
  by_type: { component_type: string; count: number }[];
  by_status: { status: string; count: number }[];
  total: number;
  overdue_inspections: number;
  due_soon_inspections: number;
}

// ============================================================================
// COMMODITY CLEANING TYPES
// ============================================================================

export type CleaningClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'kosher' | 'hazmat' | 'none';

export interface CommodityCleaning {
  id: string;
  commodity_code: string;
  commodity_name: string;
  cleaning_class: CleaningClass;
  requires_interior_blast: boolean;
  requires_exterior_paint: boolean;
  requires_new_lining: boolean;
  requires_kosher_cleaning: boolean;
  special_instructions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CleaningRequirements {
  commodity_code: string;
  commodity_name: string;
  cleaning_class: CleaningClass;
  requires_interior_blast: boolean;
  requires_exterior_paint: boolean;
  requires_new_lining: boolean;
  requires_kosher_cleaning: boolean;
  special_instructions: string | null;
  cleaning_description: string;
}

// ============================================================================
// INVOICE DISTRIBUTION TYPES
// ============================================================================

export interface InvoiceDistributionConfig {
  id: string;
  customer_id: string;
  delivery_method: 'email' | 'portal' | 'mail' | 'edi';
  email_recipients: string[];
  cc_recipients: string[];
  template_name: string;
  include_line_detail: boolean;
  include_pdf: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceDelivery {
  id: string;
  invoice_id: string;
  customer_id: string;
  delivery_method: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

// ============================================================================
// QUALIFICATION TYPES
// ============================================================================

export type QualificationStatus = 'current' | 'due_soon' | 'due' | 'overdue' | 'exempt' | 'unknown';

export interface QualificationType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  regulatory_body: string;
  default_interval_months: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Qualification {
  id: string;
  car_id: string;
  qualification_type_id: string;
  status: QualificationStatus;
  last_completed_date: string | null;
  next_due_date: string | null;
  expiry_date: string | null;
  interval_months: number | null;
  completed_by: string | null;
  completion_shop_code: string | null;
  certificate_number: string | null;
  notes: string | null;
  is_exempt: boolean;
  exempt_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  type_code?: string;
  type_name?: string;
  regulatory_body?: string;
  car_number?: string;
  car_mark?: string;
  lessee_name?: string;
  lessee_code?: string;
  current_region?: string;
}

export interface QualificationHistory {
  id: string;
  qualification_id: string;
  action: string;
  performed_by: string | null;
  performed_date: string;
  old_status: string | null;
  new_status: string | null;
  old_due_date: string | null;
  new_due_date: string | null;
  notes: string | null;
}

export interface QualificationAlert {
  id: string;
  qualification_id: string;
  car_id: string;
  qualification_type_id: string;
  alert_type: string;
  alert_date: string;
  due_date: string;
  days_until_due: number | null;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  // Joined fields
  car_number?: string;
  car_mark?: string;
  type_name?: string;
  type_code?: string;
  lessee_name?: string;
}

export interface QualificationStats {
  total_cars: number;
  overdue_count: number;
  due_count: number;
  due_soon_count: number;
  current_count: number;
  exempt_count: number;
  unknown_count: number;
  overdue_cars: number;
  due_cars: number;
  unacked_alerts: number;
}

export interface DueByMonth {
  month: string;
  count: number;
  by_type: { type_code: string; type_name: string; count: number }[];
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

// ============================================================================
// SHOPPING EVENTS V2 (14-State Machine)
// ============================================================================

export type ShoppingEventV2State =
  | 'EVENT' | 'PACKET' | 'SOW' | 'SHOP_ASSIGNED' | 'DISPO_TO_SHOP'
  | 'ENROUTE' | 'ARRIVED' | 'ESTIMATE_RECEIVED' | 'ESTIMATE_APPROVED'
  | 'WORK_IN_PROGRESS' | 'FINAL_ESTIMATE_RECEIVED' | 'FINAL_APPROVED'
  | 'DISPO_TO_DESTINATION' | 'CLOSED' | 'CANCELLED';

export interface ShoppingEventV2 {
  id: string;
  event_number: string;
  car_id: string;
  car_number: string;
  state: ShoppingEventV2State;
  source: string;
  shop_code?: string;
  shop_name?: string;
  shopping_type_code?: string;
  shopping_reason_code?: string;
  estimated_cost?: number;
  approved_cost?: number;
  invoiced_cost?: number;
  disposition?: string;
  disposition_notes?: string;
  priority: number;
  is_expedited: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// IDLE PERIODS
// ============================================================================

export interface IdlePeriod {
  id: string;
  car_number: string;
  reason?: string;
  daily_rate?: number;
  start_date: string;
  end_date?: string;
}

export interface IdleCostSummary {
  total_idle_days: number;
  total_idle_cost: number;
  periods: { start_date: string; end_date?: string; days: number; cost: number; reason?: string }[];
}

// ---------------------------------------------------------------------------
// Shopping Requests
// ---------------------------------------------------------------------------

export type ShoppingRequestStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'cancelled';

export interface ShoppingRequest {
  id: string;
  request_number: string;
  status: ShoppingRequestStatus;
  customer_company: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  car_number: string;
  current_railroad: string | null;
  current_location_city: string | null;
  current_location_state: string | null;
  next_railroad: string | null;
  next_location_city: string | null;
  next_location_state: string | null;
  stcc_or_un_number: string | null;
  residue_clean: string;
  gasket: string;
  o_rings: string;
  last_known_commodity: string | null;
  lining_current: string | null;
  lining_alternative: string | null;
  preferred_shop_code: string | null;
  mobile_repair_unit: boolean;
  shopping_type_code: string | null;
  shopping_reason_code: string | null;
  clean_grade: string | null;
  is_kosher: boolean;
  is_food_grade: boolean;
  dry_grade: string | null;
  disposition_city: string | null;
  disposition_state: string | null;
  disposition_route: string | null;
  disposition_payer_of_freight: string | null;
  disposition_comment: string | null;
  one_time_movement_approval: boolean;
  comments: string | null;
  shopping_event_id: string | null;
  bad_order_report_id: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  review_notes: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  version: number;
  preferred_shop_name?: string;
  created_by_name?: string;
  created_by_email?: string;
  reviewed_by_name?: string;
  attachment_count?: number;
}

export interface ShoppingRequestAttachment {
  id: string;
  shopping_request_id: string;
  file_name: string;
  file_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  document_type: 'sds' | 'cleaning_certificate' | 'other';
  uploaded_by_id: string | null;
  created_at: string;
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

export interface AIRuleResult {
  rule: string;
  passed: boolean;
  confidence: number;
  note: string;
}

export interface AILinePreReview {
  estimate_line_id: string;
  line_number: number;
  decision: 'approve' | 'review' | 'reject';
  confidence_score: number;
  rule_results: AIRuleResult[];
  basis_type: string;
  basis_reference: string;
}

export interface AIPreReviewResult {
  submission_id: string;
  lines_reviewed: number;
  auto_approved: number;
  needs_review: number;
  auto_rejected: number;
  overall_confidence: number;
  line_reviews: AILinePreReview[];
}

export interface JobCodeHistoricalStats {
  job_code: string;
  avg_total_cost: number;
  stddev_total_cost: number;
  avg_labor_hours: number;
  stddev_labor_hours: number;
  avg_material_cost: number;
  sample_count: number;
}

export type CCMFormStatus = 'draft' | 'current' | 'archived';

export interface CCMForm {
  id: string;
  company_name: string;
  customer_code: string | null;
  lessee_code?: string;
  form_date: string | null;
  revision_date: string | null;
  status?: CCMFormStatus;
  published_at?: string | null;
  published_by_id?: string | null;
  version?: number;
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

// ============================================================================
// MASTER PLAN TYPES
// ============================================================================

export type PlanLifecycleStatus = 'draft' | 'soft_plan' | 'locked' | 'pending_commitment' | 'committed' | 'archived';

export type CapacityFitLevel = 'green' | 'yellow' | 'red';

export interface MasterPlan {
  id: string;
  name: string;
  description?: string;
  project_id?: string;
  project_name?: string;
  project_number?: string;
  fiscal_year: number;
  planning_month: string;
  status: PlanLifecycleStatus;
  version_count?: number;
  latest_version?: number;
  current_allocation_count?: number;
  current_estimated_cost?: number;
  target_shops?: string[];
  target_networks?: string[];
  est_start_date?: string;
  est_completion_date?: string;
  capacity_fit_score?: number;
  capacity_fit_level?: CapacityFitLevel;
  locked_at?: string;
  locked_by?: string;
  committed_at?: string;
  committed_by?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PlanVersion {
  id: string;
  plan_id: string;
  version_number: number;
  label?: string;
  notes?: string;
  allocation_count: number;
  total_estimated_cost: number;
  allocation_delta?: number;
  cost_delta?: number;
  created_at: string;
}

export interface CapacityFitResult {
  plan_id: string;
  overall_score: number;
  level: CapacityFitLevel;
  shops: ShopCapacityFit[];
  warnings: string[];
  conflicts: PlanConflict[];
}

export interface ShopCapacityFit {
  shop_code: string;
  shop_name: string;
  total_capacity: number;
  allocated_from_plan: number;
  allocated_from_other_plans: number;
  current_backlog: number;
  available_capacity: number;
  utilization_pct: number;
  score: number;
  level: CapacityFitLevel;
}

export interface PlanConflict {
  type: 'overlapping_window' | 'overloaded_shop' | 'competing_plan_same_project' | 'competing_plan_cross_project';
  severity: 'warning' | 'critical';
  message: string;
  plan_id?: string;
  plan_name?: string;
  shop_code?: string;
  shop_name?: string;
  overlap_start?: string;
  overlap_end?: string;
}

export interface AllocationGroup {
  key: string;
  car_type: string;
  level2_car_type?: string;
  classification?: string;
  car_count: number;
  proposed_shop?: string;
  proposed_network?: string;
  arrival_window_start?: string;
  arrival_window_end?: string;
  est_duration_days?: number;
  est_completion?: string;
  total_estimated_cost: number;
  allocations: Allocation[];
}

export interface NetworkLoadForecast {
  dates: string[];
  arrivals_per_week: number[];
  completions_per_week: number[];
  backlog_trend: number[];
  by_shop: {
    shop_code: string;
    shop_name: string;
    capacity: number;
    planned_load: number[];
  }[];
}

export interface PlanCommunication {
  id: string;
  plan_id: string;
  type: 'plan_shared' | 'commitment_notice' | 'status_update';
  recipient?: string;
  subject?: string;
  summary_snapshot: Record<string, unknown>;
  sent_at: string;
  sent_by?: string;
}

// ============================================================================
// INTEGRATION TYPES
// ============================================================================

export interface IntegrationConnectionStatus {
  system_name: string;
  is_connected: boolean;
  mode: 'mock' | 'live' | 'disabled';
  last_check_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

export interface IntegrationSyncLogEntry {
  id: string;
  system_name: string;
  operation: string;
  direction: 'push' | 'pull';
  entity_type: string | null;
  entity_id: string | null;
  entity_ref: string | null;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'retrying';
  payload: unknown;
  response: unknown;
  error_message: string | null;
  external_id: string | null;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface IntegrationSyncStats {
  total: number;
  pending: number;
  success: number;
  failed: number;
  by_system: { system_name: string; total: number; success: number; failed: number }[];
}

export interface IntegrationHealthStatus {
  overall_status: 'healthy' | 'degraded' | 'critical';
  systems: {
    system_name: string;
    status: 'healthy' | 'degraded' | 'critical';
    error_count_24h: number;
    last_error?: string;
    uptime_percentage?: number;
  }[];
  total_errors_24h: number;
  active_alerts: number;
}

export interface ErrorTrendPoint {
  date: string;
  error_count: number;
}

export interface SystemErrorTrends {
  system_name: string;
  trends: ErrorTrendPoint[];
}

export interface RetryQueueItem {
  id: string;
  system_name: string;
  operation: string;
  entity_type: string | null;
  entity_ref: string | null;
  retry_count: number;
  next_retry_at: string;
  last_error: string | null;
  created_at: string;
}

export interface ScheduledJob {
  id: string;
  name: string;
  description: string | null;
  schedule: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: 'success' | 'failed' | null;
  system_name: string | null;
}
