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
export interface EvaluationRequest {
  car_number: string;
  overrides?: EvaluationOverrides;
  origin_region?: string;
}

export interface EvaluationOverrides {
  exterior_paint?: boolean;
  new_lining?: boolean;
  interior_blast?: boolean;
  kosher_cleaning?: boolean;
  primary_network?: boolean;
}

export interface EvaluationResult {
  shop: ShopSummary;
  is_eligible: boolean;
  failed_rules: FailedRule[];
  cost_breakdown: CostBreakdown;
  backlog: ShopBacklog;
  capacity: ShopCapacity[];
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
