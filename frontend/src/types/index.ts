// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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
