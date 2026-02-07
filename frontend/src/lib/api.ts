import {
  ApiResponse,
  Car,
  ServiceEvent,
  EvaluationResult,
  EvaluationOverrides,
  ShopSummary,
  ShopBacklog,
  ShopCapacity,
  EligibilityRule,
  // Phase 9 types
  RunningRepairsBudget,
  ServiceEventBudget,
  BudgetSummary,
  Demand,
  ShopMonthlyCapacity,
  Scenario,
  Allocation,
  ForecastResult,
  BRCImportHistory,
  BRCImportResult,
  DashboardWidget,
  DashboardConfig,
  DashboardLayout,
  // Shopping workflow types
  ShoppingEvent,
  ShoppingBatch,
  StateHistoryEntry,
  JobCode,
  ScopeLibraryTemplate,
  ScopeOfWork,
  SOWItem,
  EstimateSubmission,
  EstimateLineDecision,
  AIPreReviewResult,
  JobCodeHistoricalStats,
  CCMForm,
  CCMFormSOWSection,
  // CCM Instructions (Hierarchy)
  CCMScopeLevel,
  CCMInstructionScope,
  CCMInstructionFields,
  CCMInstruction,
  CCMInstructionSealing,
  CCMInstructionLining,
  CCMHierarchyNode,
  EffectiveCCM,
  // Shopping Requests
  ShoppingRequest,
  ShoppingRequestAttachment,
  // Qualification types
  QualificationType,
  Qualification,
  QualificationAlert,
  QualificationStats,
  QualificationHistory,
  DueByMonth,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('railsync_access_token');
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

// Car API
export async function getCarByNumber(carNumber: string): Promise<{
  car: Car;
  active_service_event: ServiceEvent | null;
}> {
  const response = await fetchApi<{
    car: Car;
    active_service_event: ServiceEvent | null;
  }>(`/cars/${encodeURIComponent(carNumber)}`);

  if (!response.data) {
    throw new Error('Car not found');
  }

  return response.data;
}

// Shop API
export async function listShops(): Promise<ShopSummary[]> {
  const response = await fetchApi<ShopSummary[]>('/shops');
  return response.data || [];
}

export async function evaluateShops(
  carNumber: string,
  overrides?: EvaluationOverrides,
  originRegion?: string
): Promise<EvaluationResult[]> {
  const response = await fetchApi<EvaluationResult[]>('/shops/evaluate', {
    method: 'POST',
    body: JSON.stringify({
      car_number: carNumber,
      overrides,
      origin_region: originRegion,
    }),
  });

  return response.data || [];
}

export async function evaluateShopsDirect(
  carInput: Partial<Car>,
  overrides?: EvaluationOverrides,
  originRegion?: string
): Promise<EvaluationResult[]> {
  const response = await fetchApi<EvaluationResult[]>('/shops/evaluate', {
    method: 'POST',
    body: JSON.stringify({
      car_input: carInput,
      overrides,
      origin_region: originRegion,
    }),
  });

  return response.data || [];
}

export async function getShopBacklog(shopCode: string): Promise<{
  shop: ShopSummary;
  backlog: ShopBacklog;
  capacity: ShopCapacity[];
  capabilities: Record<string, string[]>;
}> {
  const response = await fetchApi<{
    shop: ShopSummary;
    backlog: ShopBacklog;
    capacity: ShopCapacity[];
    capabilities: Record<string, string[]>;
  }>(`/shops/${encodeURIComponent(shopCode)}/backlog`);

  if (!response.data) {
    throw new Error('Shop not found');
  }

  return response.data;
}

// Rules API
export async function listRules(activeOnly: boolean = true): Promise<EligibilityRule[]> {
  const response = await fetchApi<EligibilityRule[]>(
    `/rules?active=${activeOnly}`
  );
  return response.data || [];
}

export async function getRuleById(ruleId: string): Promise<EligibilityRule> {
  const response = await fetchApi<EligibilityRule>(
    `/rules/${encodeURIComponent(ruleId)}`
  );

  if (!response.data) {
    throw new Error('Rule not found');
  }

  return response.data;
}

export async function updateRule(
  ruleId: string,
  updates: Partial<EligibilityRule>
): Promise<EligibilityRule> {
  const response = await fetchApi<EligibilityRule>(
    `/rules/${encodeURIComponent(ruleId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    }
  );

  if (!response.data) {
    throw new Error('Failed to update rule');
  }

  return response.data;
}

// Health Check
export async function healthCheck(): Promise<{
  status: string;
  timestamp: string;
  version: string;
}> {
  const response = await fetchApi<{
    status: string;
    timestamp: string;
    version: string;
  }>('/health');

  return response.data || { status: 'unknown', timestamp: '', version: '' };
}

// ============================================================================
// PHASE 9 - BUDGET API
// ============================================================================

export async function getRunningRepairsBudget(
  fiscalYear: number
): Promise<RunningRepairsBudget[]> {
  const response = await fetchApi<RunningRepairsBudget[]>(
    `/budget/running-repairs?fiscal_year=${fiscalYear}`
  );
  return response.data || [];
}

export async function getServiceEventBudgets(
  fiscalYear: number
): Promise<ServiceEventBudget[]> {
  const response = await fetchApi<ServiceEventBudget[]>(
    `/budget/service-events?fiscal_year=${fiscalYear}`
  );
  return response.data || [];
}

export async function getBudgetSummary(
  fiscalYear: number
): Promise<BudgetSummary> {
  const response = await fetchApi<BudgetSummary>(
    `/budget/summary?fiscal_year=${fiscalYear}`
  );
  if (!response.data) {
    throw new Error('Failed to fetch budget summary');
  }
  return response.data;
}

// ============================================================================
// PHASE 9 - DEMAND API
// ============================================================================

export async function listDemands(filters?: {
  fiscal_year?: number;
  target_month?: string;
  status?: string;
}): Promise<Demand[]> {
  const params = new URLSearchParams();
  if (filters?.fiscal_year) params.append('fiscal_year', String(filters.fiscal_year));
  if (filters?.target_month) params.append('target_month', filters.target_month);
  if (filters?.status) params.append('status', filters.status);

  const response = await fetchApi<Demand[]>(`/demands?${params.toString()}`);
  return response.data || [];
}

export async function getDemand(id: string): Promise<Demand> {
  const response = await fetchApi<Demand>(`/demands/${encodeURIComponent(id)}`);
  if (!response.data) {
    throw new Error('Demand not found');
  }
  return response.data;
}

export async function createDemand(
  demand: Omit<Demand, 'id' | 'created_at' | 'updated_at'>
): Promise<Demand> {
  const response = await fetchApi<Demand>('/demands', {
    method: 'POST',
    body: JSON.stringify(demand),
  });
  if (!response.data) {
    throw new Error('Failed to create demand');
  }
  return response.data;
}

export async function createDemandFromProject(
  projectId: string,
  demand: Omit<Demand, 'id' | 'created_at' | 'updated_at' | 'project_id' | 'status'>
): Promise<Demand> {
  const response = await fetchApi<Demand>(`/projects/${projectId}/create-demand`, {
    method: 'POST',
    body: JSON.stringify(demand),
  });
  if (!response.data) {
    throw new Error('Failed to create demand from project');
  }
  return response.data;
}

export async function updateDemand(
  id: string,
  updates: Partial<Demand>
): Promise<Demand> {
  const response = await fetchApi<Demand>(`/demands/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (!response.data) {
    throw new Error('Failed to update demand');
  }
  return response.data;
}

export async function deleteDemand(id: string): Promise<void> {
  await fetchApi(`/demands/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// PHASE 9 - CAPACITY API
// ============================================================================

export async function getCapacity(
  startMonth: string,
  endMonth: string,
  network?: string
): Promise<ShopMonthlyCapacity[]> {
  const params = new URLSearchParams({
    start_month: startMonth,
    end_month: endMonth,
  });
  if (network) params.append('network', network);

  const response = await fetchApi<ShopMonthlyCapacity[]>(`/capacity?${params.toString()}`);
  return response.data || [];
}

export async function initializeCapacity(defaultCapacity?: number): Promise<{ count: number }> {
  const response = await fetchApi<{ count: number }>('/capacity/initialize', {
    method: 'POST',
    body: JSON.stringify({ default_capacity: defaultCapacity }),
  });
  return response.data || { count: 0 };
}

export interface CapacityCar {
  car_number: string;
  status: string;
  estimated_cost: number | null;
}

export async function getCapacityCars(
  shopCode: string,
  month: string
): Promise<CapacityCar[]> {
  const response = await fetchApi<CapacityCar[]>(`/capacity/${encodeURIComponent(shopCode)}/${encodeURIComponent(month)}/cars`);
  return response.data || [];
}

// ============================================================================
// PHASE 9 - SCENARIO API
// ============================================================================

export async function listScenarios(): Promise<Scenario[]> {
  const response = await fetchApi<Scenario[]>('/scenarios');
  return response.data || [];
}

export async function createScenario(
  scenario: Omit<Scenario, 'id' | 'created_at' | 'updated_at' | 'is_system'>
): Promise<Scenario> {
  const response = await fetchApi<Scenario>('/scenarios', {
    method: 'POST',
    body: JSON.stringify(scenario),
  });
  if (!response.data) {
    throw new Error('Failed to create scenario');
  }
  return response.data;
}

// ============================================================================
// PHASE 9 - ALLOCATION API
// ============================================================================

export async function listAllocations(filters?: {
  demand_id?: string;
  shop_code?: string;
  target_month?: string;
  status?: string;
}): Promise<{ allocations: Allocation[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.demand_id) params.append('demand_id', filters.demand_id);
  if (filters?.shop_code) params.append('shop_code', filters.shop_code);
  if (filters?.target_month) params.append('target_month', filters.target_month);
  if (filters?.status) params.append('status', filters.status);

  // Backend returns { success, data: Allocation[], total }
  const response = await fetchApi<Allocation[]>(`/allocations?${params.toString()}`) as unknown as {
    success: boolean;
    data: Allocation[];
    total: number
  };
  return { allocations: response.data || [], total: response.total || 0 };
}

export async function generateAllocations(
  demandIds: string[],
  scenarioId?: string,
  previewOnly?: boolean
): Promise<{
  allocations: Allocation[];
  summary: {
    total_cars: number;
    total_cost: number;
    avg_cost_per_car: number;
    unallocated_cars: number;
  };
  warnings: string[];
}> {
  const response = await fetchApi<{
    allocations: Allocation[];
    summary: {
      total_cars: number;
      total_cost: number;
      avg_cost_per_car: number;
      unallocated_cars: number;
    };
    warnings: string[];
  }>('/allocations/generate', {
    method: 'POST',
    body: JSON.stringify({
      demand_ids: demandIds,
      scenario_id: scenarioId,
      preview_only: previewOnly,
    }),
  });
  if (!response.data) {
    throw new Error('Failed to generate allocations');
  }
  return response.data;
}

// ============================================================================
// PHASE 9 - FORECAST API
// ============================================================================

export async function getForecast(fiscalYear: number): Promise<ForecastResult> {
  const response = await fetchApi<ForecastResult>(
    `/forecast?fiscal_year=${fiscalYear}`
  );
  if (!response.data) {
    throw new Error('Failed to fetch forecast');
  }
  return response.data;
}

// ============================================================================
// BUDGET SCENARIOS & PIPELINE
// ============================================================================

export interface BudgetScenario {
  id: string;
  name: string;
  is_system: boolean;
  slider_assignment: number;
  slider_qualification: number;
  slider_commodity_conversion: number;
  slider_bad_orders: number;
  created_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface BudgetCategory {
  name: string;
  base: number;
  slider: number;
  impacted: number;
}

export interface ScenarioImpact {
  fiscal_year: number;
  scenario: {
    id: string;
    name: string;
    sliders: {
      assignment: number;
      qualification: number;
      commodity_conversion: number;
      bad_orders: number;
    };
  };
  running_repairs: { base: number };
  categories: BudgetCategory[];
  total: { base: number; impacted: number; delta: number };
}

export interface PipelineMetrics {
  fiscal_year: number;
  in_shop: number;
  enroute: number;
  completed: number;
  completed_qualifications: number;
  completed_assignments: number;
  completed_bad_orders: number;
}

export async function listBudgetScenarios(): Promise<BudgetScenario[]> {
  const response = await fetchApi<BudgetScenario[]>('/budget-scenarios');
  return response.data || [];
}

export async function getBudgetScenario(id: string): Promise<BudgetScenario> {
  const response = await fetchApi<BudgetScenario>(`/budget-scenarios/${id}`);
  if (!response.data) throw new Error('Budget scenario not found');
  return response.data;
}

export async function createBudgetScenario(
  name: string,
  sliders: { assignment: number; qualification: number; commodity_conversion: number; bad_orders: number }
): Promise<BudgetScenario> {
  const response = await fetchApi<BudgetScenario>('/budget-scenarios', {
    method: 'POST',
    body: JSON.stringify({ name, sliders }),
  });
  if (!response.data) throw new Error('Failed to create budget scenario');
  return response.data;
}

export async function updateBudgetScenario(
  id: string,
  data: { name?: string; sliders?: { assignment: number; qualification: number; commodity_conversion: number; bad_orders: number } }
): Promise<BudgetScenario> {
  const response = await fetchApi<BudgetScenario>(`/budget-scenarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error('Failed to update budget scenario');
  return response.data;
}

export async function deleteBudgetScenario(id: string): Promise<void> {
  await fetchApi(`/budget-scenarios/${id}`, { method: 'DELETE' });
}

export async function getBudgetScenarioImpact(id: string, fiscalYear: number): Promise<ScenarioImpact> {
  const response = await fetchApi<ScenarioImpact>(
    `/budget-scenarios/${id}/impact?fiscal_year=${fiscalYear}`
  );
  if (!response.data) throw new Error('Failed to calculate scenario impact');
  return response.data;
}

export async function getPipelineMetrics(fiscalYear: number): Promise<PipelineMetrics> {
  const response = await fetchApi<PipelineMetrics>(
    `/forecast/pipeline?fiscal_year=${fiscalYear}`
  );
  if (!response.data) throw new Error('Failed to fetch pipeline metrics');
  return response.data;
}

// ============================================================================
// PHASE 9 - BRC API
// ============================================================================

export async function getBRCHistory(
  startDate?: string,
  endDate?: string
): Promise<BRCImportHistory[]> {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const response = await fetchApi<BRCImportHistory[]>(`/brc/history?${params.toString()}`);
  return response.data || [];
}

export async function importBRC(file: File): Promise<BRCImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/brc/import`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to import BRC file');
  }

  return data.data;
}

// PHASE 9 - DASHBOARD API
// ============================================================================

export async function listDashboardWidgets(): Promise<DashboardWidget[]> {
  const response = await fetchApi<DashboardWidget[]>('/dashboard/widgets');
  return response.data || [];
}

export async function listDashboardConfigs(): Promise<DashboardConfig[]> {
  const response = await fetchApi<DashboardConfig[]>('/dashboard/configs');
  return response.data || [];
}

export async function getDashboardConfig(id: string): Promise<DashboardConfig | null> {
  const response = await fetchApi<DashboardConfig>(`/dashboard/configs/${id}`);
  return response.data || null;
}

export async function createDashboardConfig(
  name: string,
  layout: DashboardLayout,
  isDefault: boolean = false
): Promise<DashboardConfig> {
  const response = await fetchApi<DashboardConfig>('/dashboard/configs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, layout, is_default: isDefault }),
  });
  if (!response.data) throw new Error('Failed to create dashboard config');
  return response.data;
}

export async function updateDashboardConfig(
  id: string,
  updates: { name?: string; layout?: DashboardLayout; is_default?: boolean }
): Promise<DashboardConfig> {
  const response = await fetchApi<DashboardConfig>(`/dashboard/configs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.data) throw new Error('Failed to update dashboard config');
  return response.data;
}

export async function deleteDashboardConfig(id: string): Promise<void> {
  await fetchApi(`/dashboard/configs/${id}`, { method: 'DELETE' });
}

// ============================================================================
// BAD ORDER API
// ============================================================================

export interface BadOrderReport {
  id: string;
  car_number: string;
  reported_date: string;
  issue_type: string;
  issue_description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location?: string;
  reported_by?: string;
  status: 'open' | 'pending_decision' | 'assigned' | 'resolved';
  resolution_action?: string;
  had_existing_plan: boolean;
  existing_shop_code?: string;
  existing_target_month?: string;
  created_at: string;
}

export async function listBadOrders(filters?: {
  car_number?: string;
  status?: string;
  severity?: string;
}): Promise<BadOrderReport[]> {
  const params = new URLSearchParams();
  if (filters?.car_number) params.append('car_number', filters.car_number);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.severity) params.append('severity', filters.severity);
  const response = await fetchApi<BadOrderReport[]>(`/bad-orders?${params.toString()}`);
  return response.data || [];
}

export async function createBadOrder(data: {
  car_number: string;
  issue_type: string;
  issue_description: string;
  severity: string;
  location?: string;
  reported_by?: string;
}): Promise<BadOrderReport> {
  const response = await fetchApi<BadOrderReport>('/bad-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error('Failed to create bad order');
  return response.data;
}

export async function resolveBadOrder(id: string, action: string, notes?: string): Promise<BadOrderReport> {
  const response = await fetchApi<BadOrderReport>(`/bad-orders/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, resolution_notes: notes }),
  });
  if (!response.data) throw new Error('Failed to resolve bad order');
  return response.data;
}

// ============================================================================
// ASSIGNMENT CONFLICT CHECK
// ============================================================================

export interface AssignmentConflict {
  type: string;
  existing_assignment: {
    id: string;
    car_number: string;
    shop_code: string;
    shop_name?: string;
    target_month: string;
    status: string;
    source: string;
  };
  message: string;
}

export async function checkAssignmentConflicts(carNumber: string): Promise<AssignmentConflict | null> {
  const response = await fetchApi<AssignmentConflict | null>(`/assignments/check-conflicts?car_number=${encodeURIComponent(carNumber)}`);
  return response.data || null;
}

// ============================================================================
// SHOP FILTERING API (Phase B - Proximity & Capability Filtering)
// ============================================================================

export interface ShopWithDistance {
  shop_code: string;
  shop_name: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  distance_miles: number | null;
  tier: number;
  is_preferred_network: boolean;
  shop_designation: string;
  capacity: number | null;
}

export interface CapabilityType {
  capability_type: string;
  display_name: string;
  description: string | null;
  sort_order: number;
}

export interface ShopFilterOptions {
  regions: string[];
  tiers: number[];
  capabilityTypes: CapabilityType[];
  designations: string[];
}

export interface ShopFilterParams {
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  capabilityTypes?: string[];
  tier?: number;
  preferredNetworkOnly?: boolean;
  region?: string;
  designation?: 'repair' | 'storage' | 'scrap';
}

/**
 * Get filter options for dropdowns (regions, tiers, capability types)
 */
export async function getShopFilterOptions(): Promise<ShopFilterOptions> {
  const response = await fetchApi<ShopFilterOptions>('/shops/filter-options');
  if (!response.data) throw new Error('Failed to fetch filter options');
  return response.data;
}

/**
 * Filter shops by proximity, capabilities, tier, region, and preferred network
 */
export async function filterShops(params: ShopFilterParams): Promise<ShopWithDistance[]> {
  const queryParams = new URLSearchParams();

  if (params.latitude !== undefined) queryParams.append('latitude', params.latitude.toString());
  if (params.longitude !== undefined) queryParams.append('longitude', params.longitude.toString());
  if (params.radiusMiles !== undefined) queryParams.append('radiusMiles', params.radiusMiles.toString());
  if (params.capabilityTypes && params.capabilityTypes.length > 0) {
    queryParams.append('capabilityTypes', params.capabilityTypes.join(','));
  }
  if (params.tier !== undefined) queryParams.append('tier', params.tier.toString());
  if (params.preferredNetworkOnly) queryParams.append('preferredNetworkOnly', 'true');
  if (params.region) queryParams.append('region', params.region);
  if (params.designation) queryParams.append('designation', params.designation);

  const response = await fetchApi<ShopWithDistance[]>(`/shops/filter?${queryParams.toString()}`);
  return response.data || [];
}

/**
 * Find shops within a radius of a given point
 */
export async function findNearbyShops(
  latitude: number,
  longitude: number,
  radiusMiles: number = 500
): Promise<ShopWithDistance[]> {
  const response = await fetchApi<ShopWithDistance[]>(
    `/shops/nearby?latitude=${latitude}&longitude=${longitude}&radiusMiles=${radiusMiles}`
  );
  return response.data || [];
}

/**
 * Get list of all regions
 */
export async function getShopRegions(): Promise<string[]> {
  const response = await fetchApi<string[]>('/shops/regions');
  return response.data || [];
}

/**
 * Get list of all capability types
 */
export async function getCapabilityTypes(): Promise<CapabilityType[]> {
  const response = await fetchApi<CapabilityType[]>('/shops/capability-types');
  return response.data || [];
}

// ============================================================================
// SHOPPING WORKFLOW API
// ============================================================================

export async function listShoppingEvents(filters?: {
  state?: string;
  shop_code?: string;
  car_number?: string;
  batch_id?: string;
  shopping_type_code?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: ShoppingEvent[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.state) params.append('state', filters.state);
  if (filters?.shop_code) params.append('shop_code', filters.shop_code);
  if (filters?.car_number) params.append('car_number', filters.car_number);
  if (filters?.batch_id) params.append('batch_id', filters.batch_id);
  if (filters?.shopping_type_code) params.append('shopping_type_code', filters.shopping_type_code);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.offset) params.append('offset', String(filters.offset));

  const response = await fetchApi<{ events: ShoppingEvent[]; total: number }>(
    `/shopping-events?${params.toString()}`
  );
  return response.data || (response as any) || { events: [], total: 0 };
}

export async function getShoppingEvent(id: string): Promise<ShoppingEvent> {
  const response = await fetchApi<ShoppingEvent>(
    `/shopping-events/${encodeURIComponent(id)}`
  );
  if (!response.data) {
    // Backend may return directly without wrapping
    return response as unknown as ShoppingEvent;
  }
  return response.data;
}

export async function createShoppingEvent(input: {
  car_number: string;
  shop_code: string;
  shopping_type_code?: string;
  shopping_reason_code?: string;
  scope_of_work_id?: string;
}): Promise<ShoppingEvent> {
  const response = await fetchApi<ShoppingEvent>('/shopping-events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.data) return response as unknown as ShoppingEvent;
  return response.data;
}

export async function createBatchShoppingEvents(input: {
  shop_code: string;
  shopping_type_code?: string;
  shopping_reason_code?: string;
  car_numbers: string[];
  notes?: string;
}): Promise<{ batch: ShoppingBatch; events: ShoppingEvent[] }> {
  const response = await fetchApi<{ batch: ShoppingBatch; events: ShoppingEvent[] }>(
    '/shopping-events/batch',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  if (!response.data) return response as unknown as { batch: ShoppingBatch; events: ShoppingEvent[] };
  return response.data;
}

export async function transitionShoppingEventState(
  id: string,
  toState: string,
  notes?: string
): Promise<ShoppingEvent> {
  const response = await fetchApi<ShoppingEvent>(
    `/shopping-events/${encodeURIComponent(id)}/state`,
    {
      method: 'PUT',
      body: JSON.stringify({ to_state: toState, notes }),
    }
  );
  if (!response.data) return response as unknown as ShoppingEvent;
  return response.data;
}

export async function getShoppingEventStateHistory(
  id: string
): Promise<StateHistoryEntry[]> {
  const response = await fetchApi<StateHistoryEntry[]>(
    `/shopping-events/${encodeURIComponent(id)}/state-history`
  );
  return response.data || (response as unknown as StateHistoryEntry[]) || [];
}

export async function getCarShoppingHistory(
  carNumber: string
): Promise<ShoppingEvent[]> {
  const response = await fetchApi<ShoppingEvent[]>(
    `/cars/${encodeURIComponent(carNumber)}/shopping-history`
  );
  return response.data || (response as unknown as ShoppingEvent[]) || [];
}

// ---------------------------------------------------------------------------
// Shopping Requests
// ---------------------------------------------------------------------------

export async function createShoppingRequest(
  data: Record<string, unknown>
): Promise<ShoppingRequest> {
  const response = await fetchApi<ShoppingRequest>('/shopping-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error('Failed to create shopping request');
  return response.data;
}

export async function getShoppingRequest(id: string): Promise<ShoppingRequest> {
  const response = await fetchApi<ShoppingRequest>(`/shopping-requests/${id}`);
  if (!response.data) throw new Error('Shopping request not found');
  return response.data;
}

export async function listShoppingRequests(filters?: {
  status?: string;
  car_number?: string;
  limit?: number;
  offset?: number;
}): Promise<{ requests: ShoppingRequest[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.car_number) params.append('car_number', filters.car_number);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.offset) params.append('offset', String(filters.offset));
  const qs = params.toString();
  const response = await fetchApi<ShoppingRequest[]>(`/shopping-requests${qs ? `?${qs}` : ''}`);
  return {
    requests: response.data || [],
    total: (response as any).total || 0,
  };
}

export async function approveShoppingRequest(
  id: string,
  data: { shop_code: string; notes?: string }
): Promise<ShoppingRequest> {
  const response = await fetchApi<ShoppingRequest>(`/shopping-requests/${id}/approve`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error('Failed to approve shopping request');
  return response.data;
}

export async function rejectShoppingRequest(
  id: string,
  notes: string
): Promise<ShoppingRequest> {
  const response = await fetchApi<ShoppingRequest>(`/shopping-requests/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  });
  if (!response.data) throw new Error('Failed to reject shopping request');
  return response.data;
}

export async function cancelShoppingRequest(id: string): Promise<ShoppingRequest> {
  const response = await fetchApi<ShoppingRequest>(`/shopping-requests/${id}/cancel`, {
    method: 'PUT',
  });
  if (!response.data) throw new Error('Failed to cancel shopping request');
  return response.data;
}

export async function uploadShoppingRequestAttachment(
  requestId: string,
  file: File,
  documentType: string
): Promise<ShoppingRequestAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);
  const token = typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const res = await fetch(`${API_URL}/shopping-requests/${requestId}/attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Upload failed');
  return json.data;
}

export async function listShoppingRequestAttachments(
  requestId: string
): Promise<ShoppingRequestAttachment[]> {
  const response = await fetchApi<ShoppingRequestAttachment[]>(`/shopping-requests/${requestId}/attachments`);
  return response.data || [];
}

export async function deleteShoppingRequestAttachment(
  requestId: string,
  attachmentId: string
): Promise<void> {
  await fetchApi(`/shopping-requests/${requestId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
}

// Scope Library
export async function listScopeTemplates(filters?: {
  car_type?: string;
  shopping_type?: string;
  shopping_reason?: string;
  search?: string;
}): Promise<ScopeLibraryTemplate[]> {
  const params = new URLSearchParams();
  if (filters?.car_type) params.append('car_type', filters.car_type);
  if (filters?.shopping_type) params.append('shopping_type', filters.shopping_type);
  if (filters?.shopping_reason) params.append('shopping_reason', filters.shopping_reason);
  if (filters?.search) params.append('search', filters.search);

  const response = await fetchApi<ScopeLibraryTemplate[]>(
    `/scope-library?${params.toString()}`
  );
  return response.data || (response as unknown as ScopeLibraryTemplate[]) || [];
}

export async function getScopeTemplate(id: string): Promise<ScopeLibraryTemplate> {
  const response = await fetchApi<ScopeLibraryTemplate>(
    `/scope-library/${encodeURIComponent(id)}`
  );
  if (!response.data) return response as unknown as ScopeLibraryTemplate;
  return response.data;
}

export async function suggestScopeTemplates(
  carType?: string,
  shoppingType?: string,
  shoppingReason?: string
): Promise<ScopeLibraryTemplate[]> {
  const params = new URLSearchParams();
  if (carType) params.append('car_type', carType);
  if (shoppingType) params.append('shopping_type', shoppingType);
  if (shoppingReason) params.append('shopping_reason', shoppingReason);

  const response = await fetchApi<ScopeLibraryTemplate[]>(
    `/scope-library/suggest?${params.toString()}`
  );
  return response.data || (response as unknown as ScopeLibraryTemplate[]) || [];
}

// Scope of Work
export async function createSOW(input: {
  scope_library_id?: string;
}): Promise<ScopeOfWork> {
  const response = await fetchApi<ScopeOfWork>('/scope-of-work', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.data) return response as unknown as ScopeOfWork;
  return response.data;
}

export async function getSOW(id: string): Promise<ScopeOfWork> {
  const response = await fetchApi<ScopeOfWork>(
    `/scope-of-work/${encodeURIComponent(id)}`
  );
  if (!response.data) return response as unknown as ScopeOfWork;
  return response.data;
}

export async function addSOWItem(
  sowId: string,
  item: { line_number: number; instruction_text: string; source?: string }
): Promise<SOWItem> {
  const response = await fetchApi<SOWItem>(
    `/scope-of-work/${encodeURIComponent(sowId)}/items`,
    {
      method: 'POST',
      body: JSON.stringify(item),
    }
  );
  if (!response.data) return response as unknown as SOWItem;
  return response.data;
}

export async function finalizeSOW(id: string): Promise<ScopeOfWork> {
  const response = await fetchApi<ScopeOfWork>(
    `/scope-of-work/${encodeURIComponent(id)}/finalize`,
    { method: 'POST' }
  );
  if (!response.data) return response as unknown as ScopeOfWork;
  return response.data;
}

export async function populateSOWFromLibrary(
  sowId: string,
  templateId: string
): Promise<{ inserted_count: number }> {
  const response = await fetchApi<{ inserted_count: number }>(
    `/scope-of-work/${encodeURIComponent(sowId)}/populate-library`,
    {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId }),
    }
  );
  if (!response.data) return response as unknown as { inserted_count: number };
  return response.data;
}

// Job Codes
export async function listJobCodes(filters?: {
  code_type?: string;
  category?: string;
  search?: string;
}): Promise<JobCode[]> {
  const params = new URLSearchParams();
  if (filters?.code_type) params.append('code_type', filters.code_type);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.search) params.append('search', filters.search);

  const response = await fetchApi<JobCode[]>(
    `/job-codes?${params.toString()}`
  );
  return response.data || (response as unknown as JobCode[]) || [];
}

// Estimates
export async function listEstimateVersions(
  shoppingEventId: string
): Promise<EstimateSubmission[]> {
  const response = await fetchApi<EstimateSubmission[]>(
    `/shopping-events/${encodeURIComponent(shoppingEventId)}/estimates`
  );
  return response.data || (response as unknown as EstimateSubmission[]) || [];
}

export async function submitEstimate(
  shoppingEventId: string,
  input: {
    submitted_by?: string;
    total_labor_hours?: number;
    total_material_cost?: number;
    total_cost?: number;
    notes?: string;
    lines?: {
      line_number: number;
      aar_code?: string;
      job_code?: string;
      description?: string;
      labor_hours?: number;
      material_cost?: number;
      total_cost?: number;
      sow_item_id?: string;
    }[];
  }
): Promise<EstimateSubmission> {
  const response = await fetchApi<EstimateSubmission>(
    `/shopping-events/${encodeURIComponent(shoppingEventId)}/estimates`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  if (!response.data) return response as unknown as EstimateSubmission;
  return response.data;
}

export async function getEstimate(id: string): Promise<EstimateSubmission> {
  const response = await fetchApi<EstimateSubmission>(
    `/estimates/${encodeURIComponent(id)}`
  );
  if (!response.data) return response as unknown as EstimateSubmission;
  return response.data;
}

// Estimate Decisions
export async function getEstimateDecisions(
  estimateId: string
): Promise<(EstimateLineDecision & { line_number: number })[]> {
  const response = await fetchApi<(EstimateLineDecision & { line_number: number })[]>(
    `/estimates/${encodeURIComponent(estimateId)}/decisions`
  );
  return response.data || (response as unknown as (EstimateLineDecision & { line_number: number })[]) || [];
}

export async function recordLineDecisions(
  estimateId: string,
  decisions: {
    estimate_line_id: string;
    decision_source: 'ai' | 'human';
    decision: 'approve' | 'review' | 'reject';
    confidence_score?: number;
    responsibility?: 'lessor' | 'customer' | 'unknown';
    basis_type?: string;
    basis_reference?: string;
    decision_notes?: string;
  }[]
): Promise<(EstimateLineDecision & { is_override?: boolean })[]> {
  const response = await fetchApi<(EstimateLineDecision & { is_override?: boolean })[]>(
    `/estimates/${encodeURIComponent(estimateId)}/decisions`,
    {
      method: 'POST',
      body: JSON.stringify({ decisions }),
    }
  );
  return response.data || (response as unknown as (EstimateLineDecision & { is_override?: boolean })[]) || [];
}

// Approval Packets
export async function generateApprovalPacket(
  estimateId: string,
  input: {
    overall_decision: 'approved' | 'changes_required' | 'rejected';
    line_decisions: { line_id: string; decision: 'approve' | 'review' | 'reject' }[];
    notes?: string;
  }
): Promise<{ id: string; overall_decision: string; estimate_submission_id: string }> {
  const response = await fetchApi<{ id: string; overall_decision: string; estimate_submission_id: string }>(
    `/estimates/${encodeURIComponent(estimateId)}/approval-packet`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  if (!response.data) return response as unknown as { id: string; overall_decision: string; estimate_submission_id: string };
  return response.data;
}

// AI Pre-Review
export async function runEstimatePreReview(estimateId: string): Promise<AIPreReviewResult> {
  const response = await fetchApi<AIPreReviewResult>(
    `/estimates/${encodeURIComponent(estimateId)}/pre-review`,
    {
      method: 'POST',
    }
  );
  if (!response.data) return response as unknown as AIPreReviewResult;
  return response.data;
}

export async function getJobCodeHistoricalStats(jobCode: string): Promise<JobCodeHistoricalStats | null> {
  const response = await fetchApi<JobCodeHistoricalStats | null>(
    `/job-codes/${encodeURIComponent(jobCode)}/stats`
  );
  return response.data || null;
}

// CCM Forms
export async function listCCMForms(customerCode?: string): Promise<CCMForm[]> {
  const params = new URLSearchParams();
  if (customerCode) params.append('customer_code', customerCode);
  const response = await fetchApi<CCMForm[]>(`/ccm-forms?${params.toString()}`);
  return response.data || (response as unknown as CCMForm[]) || [];
}

export async function getCCMForm(id: string): Promise<CCMForm> {
  const response = await fetchApi<CCMForm>(`/ccm-forms/${encodeURIComponent(id)}`);
  if (!response.data) return response as unknown as CCMForm;
  return response.data;
}

export async function getCCMFormSOWSections(id: string): Promise<CCMFormSOWSection[]> {
  const response = await fetchApi<CCMFormSOWSection[]>(
    `/ccm-forms/${encodeURIComponent(id)}/sow-sections`
  );
  return response.data || (response as unknown as CCMFormSOWSection[]) || [];
}

// ============================================================================
// CCM Instructions (Hierarchy-Level with Inheritance)
// ============================================================================

/**
 * Get hierarchy tree for CCM scope selection
 */
export async function getCCMHierarchyTree(customerId?: string): Promise<CCMHierarchyNode[]> {
  const params = new URLSearchParams();
  if (customerId) params.append('customer_id', customerId);
  const response = await fetchApi<CCMHierarchyNode[]>(`/ccm-instructions/hierarchy-tree?${params.toString()}`);
  return response.data || [];
}

/**
 * List CCM instructions with optional filters
 */
export async function listCCMInstructions(filters?: {
  scope_type?: CCMScopeLevel;
  scope_id?: string;
  customer_id?: string;
}): Promise<CCMInstruction[]> {
  const params = new URLSearchParams();
  if (filters?.scope_type) params.append('scope_type', filters.scope_type);
  if (filters?.scope_id) params.append('scope_id', filters.scope_id);
  if (filters?.customer_id) params.append('customer_id', filters.customer_id);
  const response = await fetchApi<CCMInstruction[]>(`/ccm-instructions?${params.toString()}`);
  return response.data || [];
}

/**
 * Get a single CCM instruction by ID
 */
export async function getCCMInstruction(id: string): Promise<CCMInstruction | null> {
  const response = await fetchApi<CCMInstruction>(`/ccm-instructions/${encodeURIComponent(id)}`);
  return response.data || null;
}

/**
 * Get CCM instruction by scope (customer, lease, rider, amendment)
 */
export async function getCCMInstructionByScope(
  scopeType: CCMScopeLevel,
  scopeId: string
): Promise<CCMInstruction | null> {
  const response = await fetchApi<CCMInstruction>(
    `/ccm-instructions/by-scope/${scopeType}/${encodeURIComponent(scopeId)}`
  );
  return response.data || null;
}

/**
 * Get parent CCM for inheritance preview
 */
export async function getParentCCM(
  scopeType: CCMScopeLevel,
  scopeId: string
): Promise<CCMInstructionFields | null> {
  const response = await fetchApi<CCMInstructionFields>(
    `/ccm-instructions/parent/${scopeType}/${encodeURIComponent(scopeId)}`
  );
  return response.data || null;
}

/**
 * Create a new CCM instruction at a specific scope
 */
export async function createCCMInstruction(
  scope: CCMInstructionScope,
  data: Partial<CCMInstructionFields>
): Promise<CCMInstruction> {
  const response = await fetchApi<CCMInstruction>('/ccm-instructions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope_type: scope.type, scope_id: scope.id, ...data }),
  });
  if (!response.data) throw new Error(response.error || 'Failed to create CCM instruction');
  return response.data;
}

/**
 * Update an existing CCM instruction
 */
export async function updateCCMInstruction(
  id: string,
  data: Partial<CCMInstructionFields>
): Promise<CCMInstruction> {
  const response = await fetchApi<CCMInstruction>(`/ccm-instructions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error(response.error || 'Failed to update CCM instruction');
  return response.data;
}

/**
 * Delete a CCM instruction (soft delete)
 */
export async function deleteCCMInstruction(id: string): Promise<void> {
  const response = await fetchApi(`/ccm-instructions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.success) throw new Error(response.error || 'Failed to delete CCM instruction');
}

/**
 * Add a sealing section to a CCM instruction
 */
export async function addCCMInstructionSealing(
  instructionId: string,
  data: Omit<CCMInstructionSealing, 'id' | 'ccm_instruction_id'>
): Promise<CCMInstructionSealing> {
  const response = await fetchApi<CCMInstructionSealing>(
    `/ccm-instructions/${encodeURIComponent(instructionId)}/sealing`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.data) throw new Error(response.error || 'Failed to add sealing section');
  return response.data;
}

/**
 * Update a sealing section
 */
export async function updateCCMInstructionSealing(
  instructionId: string,
  sealingId: string,
  data: Partial<CCMInstructionSealing>
): Promise<CCMInstructionSealing> {
  const response = await fetchApi<CCMInstructionSealing>(
    `/ccm-instructions/${encodeURIComponent(instructionId)}/sealing/${encodeURIComponent(sealingId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.data) throw new Error(response.error || 'Failed to update sealing section');
  return response.data;
}

/**
 * Remove a sealing section
 */
export async function removeCCMInstructionSealing(instructionId: string, sealingId: string): Promise<void> {
  const response = await fetchApi(
    `/ccm-instructions/${encodeURIComponent(instructionId)}/sealing/${encodeURIComponent(sealingId)}`,
    { method: 'DELETE' }
  );
  if (!response.success) throw new Error(response.error || 'Failed to remove sealing section');
}

/**
 * Add a lining section to a CCM instruction
 */
export async function addCCMInstructionLining(
  instructionId: string,
  data: Omit<CCMInstructionLining, 'id' | 'ccm_instruction_id'>
): Promise<CCMInstructionLining> {
  const response = await fetchApi<CCMInstructionLining>(
    `/ccm-instructions/${encodeURIComponent(instructionId)}/lining`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.data) throw new Error(response.error || 'Failed to add lining section');
  return response.data;
}

/**
 * Update a lining section
 */
export async function updateCCMInstructionLining(
  instructionId: string,
  liningId: string,
  data: Partial<CCMInstructionLining>
): Promise<CCMInstructionLining> {
  const response = await fetchApi<CCMInstructionLining>(
    `/ccm-instructions/${encodeURIComponent(instructionId)}/lining/${encodeURIComponent(liningId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.data) throw new Error(response.error || 'Failed to update lining section');
  return response.data;
}

/**
 * Remove a lining section
 */
export async function removeCCMInstructionLining(instructionId: string, liningId: string): Promise<void> {
  const response = await fetchApi(
    `/ccm-instructions/${encodeURIComponent(instructionId)}/lining/${encodeURIComponent(liningId)}`,
    { method: 'DELETE' }
  );
  if (!response.success) throw new Error(response.error || 'Failed to remove lining section');
}

/**
 * Get effective CCM for a car with inheritance chain
 */
export async function getCarEffectiveCCM(carNumber: string): Promise<EffectiveCCM | null> {
  const response = await fetchApi<EffectiveCCM>(`/cars/${encodeURIComponent(carNumber)}/effective-ccm`);
  return response.data || null;
}

// Project Planning - Shopping Event Integration
export async function getShoppingEventProjectFlags(id: string): Promise<{
  project_id: string;
  project_car_id: string;
  project_number: string;
  project_name: string;
  scope_of_work: string;
  assignment_id?: string;
  shop_code?: string;
  target_month?: string;
  plan_state?: string;
} | null> {
  const response = await fetchApi<{
    project_id: string;
    project_car_id: string;
    project_number: string;
    project_name: string;
    scope_of_work: string;
    assignment_id?: string;
    shop_code?: string;
    target_month?: string;
    plan_state?: string;
  }>(`/shopping-events/${encodeURIComponent(id)}/project-flags`);
  return response.data || null;
}

export async function bundleProjectWork(shoppingEventId: string, input: {
  project_id: string;
  project_car_id: string;
  car_number: string;
  shop_code: string;
  target_month: string;
}): Promise<unknown> {
  const response = await fetchApi(`/shopping-events/${encodeURIComponent(shoppingEventId)}/bundle-project-work`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.data;
}

// ============================================================================
// MASTER PLAN — ALLOCATION MANAGEMENT
// ============================================================================

export async function searchCars(q: string, limit: number = 20): Promise<
  { car_number: string; car_mark: string; car_type: string; lessee_name: string }[]
> {
  const response = await fetchApi<{ car_number: string; car_mark: string; car_type: string; lessee_name: string }[]>(
    `/cars-search?q=${encodeURIComponent(q)}&limit=${limit}`
  );
  return response.data || [];
}

export interface AssetEvent {
  id: string;
  car_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  previous_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  source_table?: string;
  source_id?: string;
  performed_by?: string;
  performed_at: string;
  notes?: string;
}

export async function getCarHistory(carNumber: string, limit: number = 100): Promise<AssetEvent[]> {
  const response = await fetchApi<AssetEvent[]>(
    `/cars/${encodeURIComponent(carNumber)}/history?limit=${limit}`
  );
  return response.data || [];
}

export async function getCarUmler(carNumber: string): Promise<Record<string, unknown> | null> {
  const response = await fetchApi<Record<string, unknown> | null>(
    `/cars/${encodeURIComponent(carNumber)}/umler`
  );
  return response.data || null;
}

interface PlanStats {
  total_allocations: number;
  assigned: number;
  unassigned: number;
  total_estimated_cost: number;
  planned_cost: number;
  committed_cost: number;
  by_status: { status: string; count: number; cost: number }[];
  by_shop: { shop_code: string; shop_name: string; count: number; cost: number }[];
}

export async function getPlanStats(planId: string): Promise<PlanStats> {
  const response = await fetchApi<PlanStats>(`/master-plans/${encodeURIComponent(planId)}/stats`);
  return response.data as PlanStats;
}

export async function listPlanAllocations(planId: string, filters?: {
  status?: string;
  shop_code?: string;
  unassigned?: boolean;
}): Promise<Allocation[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.shop_code) params.set('shop_code', filters.shop_code);
  if (filters?.unassigned) params.set('unassigned', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchApi<Allocation[]>(
    `/master-plans/${encodeURIComponent(planId)}/allocations${qs}`
  );
  return response.data || [];
}

interface AddCarsResult { added: number; skipped: number; errors: string[]; }

export async function addCarsToPlan(planId: string, carNumbers: string[], targetMonth?: string): Promise<AddCarsResult> {
  const response = await fetchApi<AddCarsResult>(`/master-plans/${encodeURIComponent(planId)}/allocations/add-cars`, {
    method: 'POST',
    body: JSON.stringify({ car_numbers: carNumbers, target_month: targetMonth }),
  });
  return response.data as AddCarsResult;
}

interface ImportDemandsResult { imported: number; warnings: string[]; }

export async function importDemandsIntoPlan(planId: string, demandIds: string[], scenarioId?: string): Promise<ImportDemandsResult> {
  const response = await fetchApi<ImportDemandsResult>(`/master-plans/${encodeURIComponent(planId)}/allocations/import-demands`, {
    method: 'POST',
    body: JSON.stringify({ demand_ids: demandIds, scenario_id: scenarioId }),
  });
  return response.data as ImportDemandsResult;
}

export async function removeAllocationFromPlan(planId: string, allocationId: string): Promise<void> {
  await fetchApi(`/master-plans/${encodeURIComponent(planId)}/allocations/${encodeURIComponent(allocationId)}`, {
    method: 'DELETE',
  });
}

export async function assignShopToPlanAllocation(
  planId: string,
  allocationId: string,
  shopCode: string,
  targetMonth?: string
): Promise<Allocation> {
  const response = await fetchApi<Allocation>(
    `/master-plans/${encodeURIComponent(planId)}/allocations/${encodeURIComponent(allocationId)}/assign-shop`,
    {
      method: 'PUT',
      body: JSON.stringify({ shop_code: shopCode, target_month: targetMonth }),
    }
  );
  return response.data as Allocation;
}

export async function listPlanDemands(planId: string): Promise<Demand[]> {
  const response = await fetchApi<Demand[]>(`/master-plans/${encodeURIComponent(planId)}/demands`);
  return response.data || [];
}

export interface CreatePlanDemandInput {
  name: string;
  event_type: string;
  car_count: number;
  target_month?: string;
  priority?: string;
  description?: string;
  car_type?: string;
  default_lessee_code?: string;
  required_network?: string;
  required_region?: string;
  max_cost_per_car?: number;
}

export async function createDemandForPlan(planId: string, data: CreatePlanDemandInput): Promise<Demand> {
  const response = await fetchApi<Demand>(`/master-plans/${encodeURIComponent(planId)}/demands`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data as Demand;
}

const api = {
  // Core
  getCarByNumber,
  listShops,
  evaluateShops,
  evaluateShopsDirect,
  getShopBacklog,
  listRules,
  getRuleById,
  updateRule,
  healthCheck,
  // Phase 9
  getRunningRepairsBudget,
  getServiceEventBudgets,
  getBudgetSummary,
  listDemands,
  getDemand,
  createDemand,
  updateDemand,
  deleteDemand,
  getCapacity,
  initializeCapacity,
  listScenarios,
  createScenario,
  listAllocations,
  generateAllocations,
  getForecast,
  listBudgetScenarios,
  getBudgetScenario,
  createBudgetScenario,
  updateBudgetScenario,
  deleteBudgetScenario,
  getBudgetScenarioImpact,
  getPipelineMetrics,
  getBRCHistory,
  importBRC,
  // Dashboard
  listDashboardWidgets,
  listDashboardConfigs,
  getDashboardConfig,
  createDashboardConfig,
  updateDashboardConfig,
  deleteDashboardConfig,
  // Bad Orders
  listBadOrders,
  createBadOrder,
  resolveBadOrder,
  // Assignments
  checkAssignmentConflicts,
  // Shop Filtering
  getShopFilterOptions,
  filterShops,
  findNearbyShops,
  getShopRegions,
  getCapabilityTypes,
  // Shopping Workflow
  listShoppingEvents,
  getShoppingEvent,
  createShoppingEvent,
  createBatchShoppingEvents,
  transitionShoppingEventState,
  getShoppingEventStateHistory,
  getCarShoppingHistory,
  listScopeTemplates,
  getScopeTemplate,
  suggestScopeTemplates,
  createSOW,
  getSOW,
  addSOWItem,
  finalizeSOW,
  populateSOWFromLibrary,
  listJobCodes,
  listEstimateVersions,
  submitEstimate,
  getEstimate,
  getEstimateDecisions,
  recordLineDecisions,
  generateApprovalPacket,
  listCCMForms,
  getCCMForm,
  getCCMFormSOWSections,
  // CCM Instructions (Hierarchy)
  getCCMHierarchyTree,
  listCCMInstructions,
  getCCMInstruction,
  getCCMInstructionByScope,
  getParentCCM,
  createCCMInstruction,
  updateCCMInstruction,
  deleteCCMInstruction,
  addCCMInstructionSealing,
  updateCCMInstructionSealing,
  removeCCMInstructionSealing,
  addCCMInstructionLining,
  updateCCMInstructionLining,
  removeCCMInstructionLining,
  getCarEffectiveCCM,
  // Project Planning Integration
  getShoppingEventProjectFlags,
  bundleProjectWork,
  // Master Plan Allocations
  searchCars,
  getPlanStats,
  listPlanAllocations,
  addCarsToPlan,
  importDemandsIntoPlan,
  removeAllocationFromPlan,
  assignShopToPlanAllocation,
  // Master Plan Demands
  listPlanDemands,
  createDemandForPlan,
  // State Transition Revert
  revertShoppingEvent,
  revertInvoiceCase,
  revertBadOrder,
  revertShoppingRequest,
  revertAllocation,
  revertDemand,
  unlockProjectAssignment,
  checkRevertEligibility,
  // Go-Live Readiness & Incidents
  getGoLiveReadiness,
  listIncidents,
  getIncidentStats,
  createIncident,
  updateIncident,
  // System Mode & Health
  getSystemMode,
  setSystemMode,
  getHealthDashboard,
  // Performance Monitoring
  getTableSizes,
  getIndexUsage,
  getDatabaseStats,
  getSlowQueries,
  // User Feedback
  submitFeedback,
  listFeedback,
  getFeedbackStats,
  updateFeedbackStatus,
  // Migration
  getMigrationRuns,
  getMigrationReconciliation,
  importMigrationEntity,
  validateMigration,
  rollbackMigrationRun,
  getMigrationRunErrors,
  // Parallel Run
  runParallelComparison,
  getParallelRunResults,
  getParallelRunDiscrepancies,
  resolveDiscrepancy,
  getParallelRunDailyReport,
  getParallelRunHealthScore,
  getGoLiveChecklist,
};

export default api;

// =============================================================================
// State Transition Revert API
// =============================================================================

export interface RevertEligibility {
  allowed: boolean;
  previousState?: string;
  blockers: string[];
}

export async function revertShoppingEvent(id: string, notes?: string): Promise<ShoppingEvent> {
  const response = await fetchApi<ShoppingEvent>(`/shopping-events/${id}/revert`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  if (!response.data) throw new Error('Failed to revert shopping event');
  return response.data;
}

export async function revertInvoiceCase(id: string, notes?: string) {
  const response = await fetchApi(`/invoice-cases/${id}/revert`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  if (!response.data) throw new Error('Failed to revert invoice case');
  return response.data;
}

export async function revertBadOrder(id: string, notes?: string) {
  const response = await fetchApi(`/bad-orders/${id}/revert`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  if (!response.data) throw new Error('Failed to revert bad order');
  return response.data;
}

export async function duplicateShoppingRequest(
  sourceId: string,
  carNumber: string,
  overrides?: Record<string, unknown>
) {
  const response = await fetchApi(`/shopping-requests/${sourceId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({ car_number: carNumber, overrides }),
  });
  if (!response.data) throw new Error('Failed to duplicate shopping request');
  return response.data;
}

export async function revertShoppingRequest(id: string, notes?: string) {
  const response = await fetchApi(`/shopping-requests/${id}/revert`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  if (!response.data) throw new Error('Failed to revert shopping request');
  return response.data;
}

export async function revertAllocation(id: string, notes?: string) {
  const response = await fetchApi(`/allocations/${id}/revert`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  if (!response.data) throw new Error('Failed to revert allocation');
  return response.data;
}

export async function revertDemand(id: string, notes?: string) {
  const response = await fetchApi(`/demands/${id}/revert`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  if (!response.data) throw new Error('Failed to revert demand');
  return response.data;
}

export async function unlockProjectAssignment(
  projectId: string,
  assignmentId: string,
  notes?: string
) {
  const response = await fetchApi(
    `/projects/${projectId}/assignments/${assignmentId}/unlock`,
    {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }
  );
  if (!response.data) throw new Error('Failed to unlock project assignment');
  return response.data;
}

export async function checkRevertEligibility(
  processType: string,
  entityId: string
): Promise<RevertEligibility> {
  const response = await fetchApi<RevertEligibility>(
    `/transitions/${processType}/${entityId}/revert-eligibility`
  );
  return response.data || { allowed: false, blockers: ['Unknown error'] };
}

// ============================================================================
// QUALIFICATION API
// ============================================================================

export async function listQualificationTypes(): Promise<QualificationType[]> {
  const response = await fetchApi<QualificationType[]>('/qualifications/types');
  return response.data || [];
}

export async function getQualificationStats(): Promise<QualificationStats> {
  const response = await fetchApi<QualificationStats>('/qualifications/stats');
  return response.data || {
    total_cars: 0, overdue_count: 0, due_count: 0, due_soon_count: 0,
    current_count: 0, exempt_count: 0, unknown_count: 0, overdue_cars: 0,
    due_cars: 0, unacked_alerts: 0,
  };
}

export async function getQualificationsDueByMonth(): Promise<DueByMonth[]> {
  const response = await fetchApi<DueByMonth[]>('/qualifications/due-by-month');
  return response.data || [];
}

export async function listQualificationAlerts(filters?: {
  alert_type?: string;
  is_acknowledged?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ alerts: QualificationAlert[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.alert_type) params.set('alert_type', filters.alert_type);
  if (filters?.is_acknowledged !== undefined) params.set('is_acknowledged', String(filters.is_acknowledged));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  const response = await fetchApi<QualificationAlert[]>(`/qualifications/alerts${qs ? `?${qs}` : ''}`);
  return { alerts: response.data || [], total: (response as any).total || 0 };
}

export async function acknowledgeQualificationAlert(alertId: string): Promise<void> {
  await fetchApi(`/qualifications/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST' });
}

export async function listQualifications(filters?: {
  car_id?: string;
  type_code?: string;
  status?: string;
  lessee_code?: string;
  current_region?: string;
  limit?: number;
  offset?: number;
}): Promise<{ qualifications: Qualification[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.car_id) params.set('car_id', filters.car_id);
  if (filters?.type_code) params.set('type_code', filters.type_code);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.lessee_code) params.set('lessee_code', filters.lessee_code);
  if (filters?.current_region) params.set('current_region', filters.current_region);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  const response = await fetchApi<Qualification[]>(`/qualifications${qs ? `?${qs}` : ''}`);
  return { qualifications: response.data || [], total: (response as any).total || 0 };
}

export async function getQualification(id: string): Promise<Qualification> {
  const response = await fetchApi<Qualification>(`/qualifications/${encodeURIComponent(id)}`);
  if (!response.data) throw new Error('Qualification not found');
  return response.data;
}

export async function createQualification(data: {
  car_id: string;
  qualification_type_id: string;
  status?: string;
  last_completed_date?: string;
  next_due_date?: string;
  notes?: string;
}): Promise<Qualification> {
  const response = await fetchApi<Qualification>('/qualifications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error('Failed to create qualification');
  return response.data;
}

export async function updateQualification(id: string, data: Partial<{
  status: string;
  next_due_date: string;
  notes: string;
}>): Promise<Qualification> {
  const response = await fetchApi<Qualification>(`/qualifications/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error('Failed to update qualification');
  return response.data;
}

export async function completeQualification(id: string, data: {
  completed_date: string;
  completed_by?: string;
  completion_shop_code?: string;
  certificate_number?: string;
  notes?: string;
}): Promise<Qualification> {
  const response = await fetchApi<Qualification>(`/qualifications/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error('Failed to complete qualification');
  return response.data;
}

export async function bulkUpdateQualifications(ids: string[], data: {
  status?: string;
  next_due_date?: string;
  notes?: string;
}): Promise<{ updated: number }> {
  const response = await fetchApi<{ updated: number }>('/qualifications/bulk-update', {
    method: 'POST',
    body: JSON.stringify({ ids, ...data }),
  });
  return response.data || { updated: 0 };
}

export async function getCarQualifications(carId: string): Promise<Qualification[]> {
  const response = await fetchApi<Qualification[]>(`/cars/${encodeURIComponent(carId)}/qualifications`);
  return response.data || [];
}

export async function getQualificationHistory(qualificationId: string): Promise<QualificationHistory[]> {
  const response = await fetchApi<QualificationHistory[]>(`/qualifications/${encodeURIComponent(qualificationId)}/history`);
  return response.data || [];
}

export async function recalculateQualificationStatuses(): Promise<{ updated: number }> {
  const response = await fetchApi<{ updated: number }>('/qualifications/recalculate', { method: 'POST' });
  return response.data || { updated: 0 };
}

export async function generateQualificationAlerts(): Promise<{ created: number }> {
  const response = await fetchApi<{ created: number }>('/qualifications/generate-alerts', { method: 'POST' });
  return response.data || { created: 0 };
}

// ============================================================================
// BILLING ENGINE
// ============================================================================

// Billing Runs
export async function runBillingPreflight(fiscalYear: number, fiscalMonth: number) {
  const response = await fetchApi('/billing/runs/preflight', {
    method: 'POST',
    body: JSON.stringify({ fiscalYear, fiscalMonth }),
  });
  return response.data;
}

export async function createBillingRun(fiscalYear: number, fiscalMonth: number, runType: string) {
  const response = await fetchApi('/billing/runs', {
    method: 'POST',
    body: JSON.stringify({ fiscalYear, fiscalMonth, runType }),
  });
  return response.data;
}

export async function listBillingRuns(limit = 20, offset = 0) {
  const response = await fetchApi(`/billing/runs?limit=${limit}&offset=${offset}`);
  return response.data;
}

export async function getBillingRun(id: string) {
  const response = await fetchApi(`/billing/runs/${encodeURIComponent(id)}`);
  return response.data;
}

// Outbound Invoices
export async function generateMonthlyInvoices(fiscalYear: number, fiscalMonth: number) {
  const response = await fetchApi('/billing/invoices/generate', {
    method: 'POST',
    body: JSON.stringify({ fiscalYear, fiscalMonth }),
  });
  return response.data;
}

export async function listOutboundInvoices(filters: {
  status?: string; customerId?: string; fiscalYear?: number; fiscalMonth?: number;
  limit?: number; offset?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.customerId) params.set('customerId', filters.customerId);
  if (filters.fiscalYear) params.set('fiscalYear', String(filters.fiscalYear));
  if (filters.fiscalMonth) params.set('fiscalMonth', String(filters.fiscalMonth));
  params.set('limit', String(filters.limit || 50));
  params.set('offset', String(filters.offset || 0));
  const response = await fetchApi(`/billing/invoices?${params}`);
  return response.data;
}

export async function getOutboundInvoice(id: string) {
  const response = await fetchApi(`/billing/invoices/${encodeURIComponent(id)}`);
  return response.data;
}

export async function approveOutboundInvoice(id: string) {
  const response = await fetchApi(`/billing/invoices/${encodeURIComponent(id)}/approve`, { method: 'PUT' });
  return response.data;
}

export async function voidOutboundInvoice(id: string, reason: string) {
  const response = await fetchApi(`/billing/invoices/${encodeURIComponent(id)}/void`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });
  return response.data;
}

// Rate Management
export async function getRateHistory(riderId: string) {
  const response = await fetchApi(`/billing/rates/${encodeURIComponent(riderId)}/history`);
  return response.data;
}

export async function updateRate(riderId: string, data: {
  newRate: number; effectiveDate: string; changeType: string; reason: string;
}) {
  const response = await fetchApi(`/billing/rates/${encodeURIComponent(riderId)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.data;
}

// Mileage
export async function createMileageFile(data: { filename: string; fileType: string; reportingPeriod: string }) {
  const response = await fetchApi('/billing/mileage/files', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function getMileageSummary(customerId?: string, period?: string) {
  const params = new URLSearchParams();
  if (customerId) params.set('customerId', customerId);
  if (period) params.set('period', period);
  const response = await fetchApi(`/billing/mileage/summary?${params}`);
  return response.data;
}

export async function verifyMileageRecord(id: string) {
  const response = await fetchApi(`/billing/mileage/records/${encodeURIComponent(id)}/verify`, { method: 'PUT' });
  return response.data;
}

// Chargebacks
export async function createChargeback(data: {
  customerId: string; carNumber: string; chargebackType: string;
  amount: number; description: string; riderId?: string;
}) {
  const response = await fetchApi('/billing/chargebacks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function listChargebacks(filters: {
  status?: string; customerId?: string; limit?: number; offset?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.customerId) params.set('customerId', filters.customerId);
  params.set('limit', String(filters.limit || 50));
  params.set('offset', String(filters.offset || 0));
  const response = await fetchApi(`/billing/chargebacks?${params}`);
  return response.data;
}

export async function reviewChargeback(id: string, approved: boolean, notes?: string) {
  const response = await fetchApi(`/billing/chargebacks/${encodeURIComponent(id)}/review`, {
    method: 'PUT',
    body: JSON.stringify({ approved, notes }),
  });
  return response.data;
}

export async function generateChargebackInvoice(customerId: string, fiscalYear: number, fiscalMonth: number) {
  const response = await fetchApi('/billing/chargebacks/generate-invoice', {
    method: 'POST',
    body: JSON.stringify({ customerId, fiscalYear, fiscalMonth }),
  });
  return response.data;
}

// Adjustments
export async function createBillingAdjustment(data: {
  customerId: string; adjustmentType: string; amount: number;
  description: string; riderId?: string; carNumber?: string;
  sourceEvent?: string; sourceEventId?: string;
}) {
  const response = await fetchApi('/billing/adjustments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function listPendingAdjustments(customerId?: string) {
  const params = customerId ? `?customerId=${customerId}` : '';
  const response = await fetchApi(`/billing/adjustments/pending${params}`);
  return response.data;
}

export async function approveBillingAdjustment(id: string) {
  const response = await fetchApi(`/billing/adjustments/${encodeURIComponent(id)}/approve`, { method: 'PUT' });
  return response.data;
}

export async function rejectBillingAdjustment(id: string, reason: string) {
  const response = await fetchApi(`/billing/adjustments/${encodeURIComponent(id)}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });
  return response.data;
}

// Billing Summary
export async function getBillingSummary(fiscalYear: number, fiscalMonth: number) {
  const response = await fetchApi(`/billing/summary?fiscalYear=${fiscalYear}&fiscalMonth=${fiscalMonth}`);
  return response.data;
}

export async function getCustomerBillingHistory(customerId: string, limit = 20, offset = 0) {
  const response = await fetchApi(
    `/billing/customers/${encodeURIComponent(customerId)}/history?limit=${limit}&offset=${offset}`
  );
  return response.data;
}

// ============================================================================
// COMPONENT REGISTRY
// ============================================================================

export async function listComponents(filters: {
  car_number?: string; component_type?: string; status?: string; limit?: number; offset?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.car_number) params.set('car_number', filters.car_number);
  if (filters.component_type) params.set('component_type', filters.component_type);
  if (filters.status) params.set('status', filters.status);
  params.set('limit', String(filters.limit || 50));
  params.set('offset', String(filters.offset || 0));
  const response = await fetchApi(`/components?${params}`);
  return response.data;
}

export async function getComponentStats(carNumber?: string) {
  const params = carNumber ? `?car_number=${encodeURIComponent(carNumber)}` : '';
  const response = await fetchApi(`/components/stats${params}`);
  return response.data;
}

export async function getComponent(id: string) {
  const response = await fetchApi(`/components/${encodeURIComponent(id)}`);
  return response.data;
}

export async function createComponent(data: {
  car_number: string; component_type: string; serial_number?: string;
  manufacturer?: string; model?: string; install_date?: string;
  next_inspection_due?: string; specification?: string; notes?: string;
}) {
  const response = await fetchApi('/components', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function updateComponent(id: string, data: Record<string, unknown>) {
  const response = await fetchApi(`/components/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function replaceComponent(id: string, data: {
  newSerialNumber: string; newManufacturer?: string; shopCode?: string; notes?: string;
}) {
  const response = await fetchApi(`/components/${encodeURIComponent(id)}/replace`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function removeComponent(id: string) {
  const response = await fetchApi(`/components/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return response.data;
}

export async function recordComponentInspection(id: string, data: {
  shopCode?: string; notes?: string; nextInspectionDue?: string; workOrderReference?: string;
}) {
  const response = await fetchApi(`/components/${encodeURIComponent(id)}/inspect`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function getComponentHistory(id: string) {
  const response = await fetchApi(`/components/${encodeURIComponent(id)}/history`);
  return response.data;
}

export async function getCarComponents(carNumber: string) {
  const response = await fetchApi(`/cars/${encodeURIComponent(carNumber)}/components`);
  return response.data;
}

// ============================================================================
// COMMODITY / CLEANING MATRIX
// ============================================================================

export async function listCommodities(includeInactive = false) {
  const params = includeInactive ? '?includeInactive=true' : '';
  const response = await fetchApi(`/commodities${params}`);
  return response.data;
}

export async function getCommodityByCode(code: string) {
  const response = await fetchApi(`/commodities/${encodeURIComponent(code)}`);
  return response.data;
}

export async function getCommodityCleaningRequirements(code: string) {
  const response = await fetchApi(`/commodities/${encodeURIComponent(code)}/cleaning`);
  return response.data;
}

export async function getCarCleaningRequirements(carNumber: string) {
  const response = await fetchApi(`/cars/${encodeURIComponent(carNumber)}/cleaning-requirements`);
  return response.data;
}

// ============================================================================
// INVOICE DISTRIBUTION
// ============================================================================

export async function listDistributionConfigs() {
  const response = await fetchApi('/billing/distribution/configs');
  return response.data;
}

export async function getDistributionConfig(customerId: string) {
  const response = await fetchApi(`/billing/distribution/configs/${encodeURIComponent(customerId)}`);
  return response.data;
}

export async function upsertDistributionConfig(customerId: string, data: {
  delivery_method: string; email_recipients: string[]; cc_recipients?: string[];
  template_name?: string; include_line_detail?: boolean; include_pdf?: boolean;
}) {
  const response = await fetchApi(`/billing/distribution/configs/${encodeURIComponent(customerId)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function queueInvoiceDelivery(invoiceId: string) {
  const response = await fetchApi(`/billing/distribution/queue/${encodeURIComponent(invoiceId)}`, {
    method: 'POST',
  });
  return response.data;
}

export async function processDeliveries() {
  const response = await fetchApi('/billing/distribution/process', { method: 'POST' });
  return response.data;
}

export async function getDeliveryHistory(invoiceId: string) {
  const response = await fetchApi(`/billing/distribution/invoices/${encodeURIComponent(invoiceId)}/history`);
  return response.data;
}

export async function getDeliveryStats(fiscalYear: number, fiscalMonth: number) {
  const response = await fetchApi(`/billing/distribution/stats?fiscalYear=${fiscalYear}&fiscalMonth=${fiscalMonth}`);
  return response.data;
}

export async function getPendingDeliveries(limit = 50) {
  const response = await fetchApi(`/billing/distribution/pending?limit=${limit}`);
  return response.data;
}

// ============================================================================
// BILLING RUN APPROVAL
// ============================================================================

export async function approveBillingRun(runId: string, notes?: string) {
  const response = await fetchApi(`/billing/runs/${encodeURIComponent(runId)}/approve`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  });
  return response.data;
}

export async function completeBillingRun(runId: string) {
  const response = await fetchApi(`/billing/runs/${encodeURIComponent(runId)}/complete`, {
    method: 'PUT',
  });
  return response.data;
}

// ============================================================================
// COST ALLOCATION
// ============================================================================

export async function createCostAllocation(data: {
  allocation_id: string;
  customer_id: string;
  car_number: string;
  labor_cost?: number;
  material_cost?: number;
  freight_cost?: number;
  total_cost: number;
  billing_entity?: string;
  lessee_share_pct?: number;
  brc_number?: string;
  shopping_event_id?: string;
  notes?: string;
}) {
  const response = await fetchApi('/billing/cost-allocations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function getCostAllocationSummary(fiscalYear: number, fiscalMonth: number) {
  const response = await fetchApi(
    `/billing/cost-allocations/summary?fiscalYear=${fiscalYear}&fiscalMonth=${fiscalMonth}`
  );
  return response.data;
}

export async function listCostAllocations(filters: {
  customerId?: string;
  allocationId?: string;
  status?: string;
  billingMonth?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.customerId) params.set('customerId', filters.customerId);
  if (filters.allocationId) params.set('allocationId', filters.allocationId);
  if (filters.status) params.set('status', filters.status);
  if (filters.billingMonth) params.set('billingMonth', filters.billingMonth);
  params.set('limit', String(filters.limit || 50));
  params.set('offset', String(filters.offset || 0));
  const response = await fetchApi(`/billing/cost-allocations?${params}`);
  return response.data;
}

// ============================================================================
// RELEASE MANAGEMENT
// ============================================================================

export async function listReleases(filters: {
  car_number?: string; rider_id?: string; status?: string; release_type?: string;
  limit?: number; offset?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.car_number) params.set('car_number', filters.car_number);
  if (filters.rider_id) params.set('rider_id', filters.rider_id);
  if (filters.status) params.set('status', filters.status);
  if (filters.release_type) params.set('release_type', filters.release_type);
  params.set('limit', String(filters.limit || 50));
  params.set('offset', String(filters.offset || 0));
  const response = await fetchApi(`/releases?${params}`);
  return response.data;
}

export async function getActiveReleases() {
  const response = await fetchApi('/releases/active');
  return response.data;
}

export async function getRelease(id: string) {
  const response = await fetchApi(`/releases/${encodeURIComponent(id)}`);
  return response.data;
}

export async function initiateRelease(data: {
  car_number: string; rider_id: string; release_type: string;
  assignment_id?: string; shopping_event_id?: string; notes?: string;
}) {
  const response = await fetchApi('/releases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function approveRelease(id: string, notes?: string) {
  const response = await fetchApi(`/releases/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  return response.data;
}

export async function executeRelease(id: string) {
  const response = await fetchApi(`/releases/${encodeURIComponent(id)}/execute`, { method: 'POST' });
  return response.data;
}

export async function completeRelease(id: string, notes?: string) {
  const response = await fetchApi(`/releases/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  return response.data;
}

export async function cancelRelease(id: string, reason: string) {
  const response = await fetchApi(`/releases/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return response.data;
}

// ============================================================================
// CONTRACT TRANSFERS
// ============================================================================

export async function validateTransferPrerequisites(data: {
  car_number: string; from_rider_id: string; to_rider_id: string;
}) {
  const response = await fetchApi('/transfers/validate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function initiateTransfer(data: {
  car_number: string; from_rider_id: string; to_rider_id: string;
  transition_type: string; target_completion_date?: string;
  requires_shop_visit?: boolean; notes?: string;
}) {
  const response = await fetchApi('/transfers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function listTransfers(filters: {
  car_number?: string; from_rider_id?: string; to_rider_id?: string;
  status?: string; transition_type?: string; limit?: number; offset?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.car_number) params.set('car_number', filters.car_number);
  if (filters.from_rider_id) params.set('from_rider_id', filters.from_rider_id);
  if (filters.to_rider_id) params.set('to_rider_id', filters.to_rider_id);
  if (filters.status) params.set('status', filters.status);
  if (filters.transition_type) params.set('transition_type', filters.transition_type);
  params.set('limit', String(filters.limit || 50));
  params.set('offset', String(filters.offset || 0));
  const response = await fetchApi(`/transfers?${params}`);
  return response.data;
}

export async function getTransferOverview() {
  const response = await fetchApi('/transfers/overview');
  return response.data;
}

export async function getTransfer(id: string) {
  const response = await fetchApi(`/transfers/${encodeURIComponent(id)}`);
  return response.data;
}

export async function confirmTransfer(id: string, notes?: string) {
  const response = await fetchApi(`/transfers/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  return response.data;
}

export async function completeTransfer(id: string, notes?: string) {
  const response = await fetchApi(`/transfers/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  return response.data;
}

export async function cancelTransfer(id: string, reason: string) {
  const response = await fetchApi(`/transfers/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return response.data;
}

export async function getRiderTransfers(riderId: string) {
  const response = await fetchApi(`/riders/${encodeURIComponent(riderId)}/transfers`);
  return response.data;
}

// ============================================================================
// APPROVAL PACKETS (extended)
// ============================================================================

export async function getApprovalPacket(packetId: string) {
  const response = await fetchApi(`/approval-packets/${encodeURIComponent(packetId)}`);
  return response.data;
}

export async function releaseApprovalPacket(packetId: string) {
  const response = await fetchApi(`/approval-packets/${encodeURIComponent(packetId)}/release`, {
    method: 'POST',
  });
  return response.data;
}

// ============================================================================
// INTEGRATION APIs
// ============================================================================

export async function getIntegrationStatuses() {
  const response = await fetchApi('/integrations/status');
  return response.data;
}

export async function getIntegrationSyncLog(filters?: {
  system?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.system) params.set('system', filters.system);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  const response = await fetchApi<unknown>(`/integrations/sync-log${qs ? `?${qs}` : ''}`);
  return { entries: response.data, total: (response as any).total };
}

export async function getIntegrationSyncStats() {
  const response = await fetchApi('/integrations/sync-stats');
  return response.data;
}

export async function retryIntegrationSync(entryId: string) {
  const response = await fetchApi(`/integrations/sync-log/${entryId}/retry`, { method: 'POST' });
  return response.data;
}

export async function sapPushApprovedCosts(allocationId: string) {
  const response = await fetchApi('/integrations/sap/push-costs', {
    method: 'POST',
    body: JSON.stringify({ allocationId }),
  });
  return response.data;
}

export async function sapPushBillingTrigger(invoiceId: string) {
  const response = await fetchApi('/integrations/sap/push-billing', {
    method: 'POST',
    body: JSON.stringify({ invoiceId }),
  });
  return response.data;
}

export async function sapBatchPush(limit?: number) {
  const response = await fetchApi('/integrations/sap/batch-push', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
  return response.data;
}

export async function checkSAPConnection() {
  const response = await fetchApi('/integrations/sap/check');
  return response.data;
}

export async function sfFullSync() {
  const response = await fetchApi('/integrations/salesforce/full-sync', { method: 'POST' });
  return response.data;
}

export async function checkSFConnection() {
  const response = await fetchApi('/integrations/salesforce/check');
  return response.data;
}

export async function sfPullDealStages() {
  const response = await fetchApi('/integrations/salesforce/pull-deals', { method: 'POST' });
  return response.data;
}

export async function sfPushBillingStatus(customerId: string, billingData: {
  total_billed: number;
  outstanding_balance: number;
  last_invoice_date: string;
  active_car_count: number;
}) {
  const response = await fetchApi('/integrations/salesforce/push-billing-status', {
    method: 'POST',
    body: JSON.stringify({ customerId, billingData }),
  });
  return response.data;
}

export async function getSFSyncMap(entityType?: string, limit?: number) {
  const params = new URLSearchParams();
  if (entityType) params.set('entity_type', entityType);
  if (limit) params.set('limit', String(limit));
  const response = await fetchApi(`/integrations/salesforce/sync-map?${params}`);
  return response;
}

export async function getSAPFieldMappings(documentType: string) {
  const response = await fetchApi(`/integrations/sap/field-mappings?document_type=${encodeURIComponent(documentType)}`);
  return response.data;
}

export async function validateSAPPayload(documentType: string, sourceData: Record<string, unknown>) {
  const response = await fetchApi('/integrations/sap/validate-payload', {
    method: 'POST',
    body: JSON.stringify({ documentType, sourceData }),
  });
  return response.data;
}

// Sync schedules
export async function getSyncSchedules() {
  const response = await fetchApi('/integrations/sync-schedules');
  return response.data;
}

export async function createSyncSchedule(data: { job_name: string; system_name: string; operation: string; cron_expression: string; config?: Record<string, unknown> }) {
  const response = await fetchApi('/integrations/sync-schedules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function updateSyncSchedule(id: string, data: Partial<{ job_name: string; cron_expression: string; config: Record<string, unknown> }>) {
  const response = await fetchApi(`/integrations/sync-schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function toggleSyncSchedule(id: string, enabled: boolean) {
  const response = await fetchApi(`/integrations/sync-schedules/${id}/toggle`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
  return response.data;
}

// Integration monitoring
export async function getIntegrationHealthDashboard() {
  const response = await fetchApi('/integrations/health-dashboard');
  return response.data;
}

export async function getIntegrationErrorTrends(days?: number) {
  const params = days ? `?days=${days}` : '';
  const response = await fetchApi(`/integrations/error-trends${params}`);
  return response.data;
}

export async function batchRetryIntegration(category: string, systemName?: string) {
  const response = await fetchApi('/integrations/batch-retry', {
    method: 'POST',
    body: JSON.stringify({ category, system_name: systemName }),
  });
  return response.data;
}

export async function getRetryQueue() {
  const response = await fetchApi('/integrations/retry-queue');
  return response.data;
}

export async function dismissRetryItem(id: string) {
  const response = await fetchApi(`/integrations/retry-queue/${encodeURIComponent(id)}/dismiss`, {
    method: 'POST',
  });
  return response.data;
}

export async function getScheduledJobs() {
  const response = await fetchApi('/admin/scheduled-jobs');
  return response.data;
}

export async function toggleScheduledJob(id: string, enabled: boolean) {
  const response = await fetchApi(`/admin/scheduled-jobs/${encodeURIComponent(id)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
  return response.data;
}

// ============================================================================
// GO-LIVE READINESS & INCIDENTS
// ============================================================================

export async function getGoLiveReadiness(): Promise<any> {
  const response = await fetchApi<any>('/go-live/readiness');
  return response.data;
}

export async function listIncidents(filters?: { status?: string; severity?: string }): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.severity) params.set('severity', filters.severity);
  const qs = params.toString();
  const response = await fetchApi<any[]>(`/go-live/incidents${qs ? `?${qs}` : ''}`);
  return response.data || [];
}

export async function getIncidentStats(): Promise<any> {
  const response = await fetchApi<any>('/go-live/incidents/stats');
  return response.data;
}

export async function createIncident(data: {
  title: string;
  description?: string;
  severity: string;
  category?: string;
}): Promise<any> {
  const response = await fetchApi<any>('/go-live/incidents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function updateIncident(id: string, data: {
  status?: string;
  severity?: string;
  resolution_notes?: string;
  assigned_to?: string;
}): Promise<any> {
  const response = await fetchApi<any>(`/go-live/incidents/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.data;
}

// ============================================================================
// SYSTEM MODE & HEALTH
// ============================================================================

export async function getSystemMode(): Promise<any> {
  const response = await fetchApi<any>('/system/mode');
  return response.data;
}

export async function setSystemMode(mode: string): Promise<any> {
  const response = await fetchApi<any>('/system/mode', {
    method: 'PUT',
    body: JSON.stringify({ mode }),
  });
  return response.data;
}

export async function getHealthDashboard(): Promise<any> {
  const response = await fetchApi<any>('/system/health-dashboard');
  return response.data;
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

export async function getTableSizes(): Promise<any[]> {
  const response = await fetchApi<any[]>('/system/performance/tables');
  return response.data || [];
}

export async function getIndexUsage(): Promise<any[]> {
  const response = await fetchApi<any[]>('/system/performance/indexes');
  return response.data || [];
}

export async function getDatabaseStats(): Promise<any> {
  const response = await fetchApi<any>('/system/performance/stats');
  return response.data;
}

export async function getSlowQueries(): Promise<any[]> {
  const response = await fetchApi<any[]>('/system/performance/slow-queries');
  return response.data || [];
}

// ============================================================================
// USER FEEDBACK
// ============================================================================

export async function submitFeedback(data: {
  page?: string;
  category: string;
  severity?: string;
  title: string;
  description?: string;
}): Promise<any> {
  const response = await fetchApi<any>('/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function listFeedback(filters?: { status?: string; category?: string }): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.category) params.set('category', filters.category);
  const qs = params.toString();
  const response = await fetchApi<any[]>(`/feedback${qs ? `?${qs}` : ''}`);
  return response.data || [];
}

export async function getFeedbackStats(): Promise<any> {
  const response = await fetchApi<any>('/feedback/stats');
  return response.data;
}

export async function updateFeedbackStatus(id: string, data: {
  status?: string;
  admin_notes?: string;
}): Promise<any> {
  const response = await fetchApi<any>(`/feedback/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.data;
}

// ============================================================================
// MIGRATION
// ============================================================================

export async function getMigrationRuns(): Promise<any[]> {
  const response = await fetchApi<any[]>('/migration/runs');
  return response.data || [];
}

export async function getMigrationReconciliation(): Promise<any[]> {
  const response = await fetchApi<any[]>('/migration/reconciliation');
  return response.data || [];
}

export async function importMigrationEntity(entity: string, content: string): Promise<any> {
  const response = await fetchApi<any>(`/migration/import/${encodeURIComponent(entity)}`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  return response.data;
}

export async function validateMigration(entity_type: string, content: string): Promise<any> {
  const response = await fetchApi<any>('/migration/validate', {
    method: 'POST',
    body: JSON.stringify({ entity_type, content }),
  });
  return response.data;
}

export async function rollbackMigrationRun(runId: string): Promise<any> {
  const response = await fetchApi<any>(`/migration/runs/${encodeURIComponent(runId)}/rollback`, {
    method: 'POST',
  });
  return response.data;
}

export async function getMigrationRunErrors(runId: string): Promise<any[]> {
  const response = await fetchApi<any[]>(`/migration/runs/${encodeURIComponent(runId)}/errors`);
  return response.data || [];
}

// ============================================================================
// PARALLEL RUN
// ============================================================================

export async function runParallelComparison(type: string, data: any): Promise<any> {
  const response = await fetchApi<any>(`/parallel-run/${encodeURIComponent(type)}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function getParallelRunResults(filters?: { comparison_type?: string }): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters?.comparison_type) params.set('comparison_type', filters.comparison_type);
  const qs = params.toString();
  const response = await fetchApi<any[]>(`/parallel-run/results${qs ? `?${qs}` : ''}`);
  return response.data || [];
}

export async function getParallelRunDiscrepancies(runId: string): Promise<any[]> {
  const response = await fetchApi<any[]>(`/parallel-run/discrepancies/${encodeURIComponent(runId)}`);
  return response.data || [];
}

export async function resolveDiscrepancy(id: string, resolution: string, notes?: string): Promise<any> {
  const response = await fetchApi<any>(`/parallel-run/discrepancies/${encodeURIComponent(id)}/resolve`, {
    method: 'PUT',
    body: JSON.stringify({ resolution, notes }),
  });
  return response.data;
}

export async function getParallelRunDailyReport(date: string): Promise<any> {
  const params = new URLSearchParams();
  params.set('date', date);
  const response = await fetchApi<any>(`/parallel-run/daily-report?${params}`);
  return response.data;
}

export async function getParallelRunHealthScore(): Promise<any> {
  const response = await fetchApi<any>('/parallel-run/health-score');
  return response.data;
}

export async function getGoLiveChecklist(): Promise<any> {
  const response = await fetchApi<any>('/parallel-run/go-live-checklist');
  return response.data;
}

// ============================================================================
// Forecast & Freight
// ============================================================================

export async function getMaintenanceForecast(fiscalYear?: number): Promise<any> {
  const year = fiscalYear || new Date().getFullYear();
  const response = await fetchApi<any>(`/forecast/maintenance?fiscal_year=${year}`);
  return response.data;
}

export async function getForecastTrends(fiscalYear?: number): Promise<any> {
  const year = fiscalYear || new Date().getFullYear();
  const response = await fetchApi<any>(`/forecast/trends?fiscal_year=${year}`);
  return response.data;
}

export async function getForecastDashboardSummary(fiscalYear?: number): Promise<any> {
  const year = fiscalYear || new Date().getFullYear();
  const response = await fetchApi<any>(`/forecast/dashboard-summary?fiscal_year=${year}`);
  return response.data;
}

export async function getFreightRate(origin: string, destination: string): Promise<any> {
  const response = await fetchApi<any>(`/freight/rates?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
  return response.data;
}

export async function calculateFreightCost(originCode: string, shopCode: string): Promise<any> {
  const response = await fetchApi<any>('/freight/calculate', { method: 'POST', body: JSON.stringify({ origin_code: originCode, shop_code: shopCode }) });
  return response.data;
}

export async function listOriginLocations(): Promise<any[]> {
  const response = await fetchApi<any>('/freight/origins');
  return response.data;
}

// ============================================================================
// Work Hours
// ============================================================================

export async function getWorkHoursFactors(factorType: string, factorValue: string): Promise<any[]> {
  const response = await fetchApi<any>(`/work-hours/factors?factor_type=${encodeURIComponent(factorType)}&factor_value=${encodeURIComponent(factorValue)}`);
  return response.data;
}

export async function calculateWorkHours(car: any, overrides: any): Promise<any> {
  const response = await fetchApi<any>('/work-hours/calculate', { method: 'POST', body: JSON.stringify({ car, overrides }) });
  return response.data;
}

// ============================================================================
// Project Audit
// ============================================================================

export async function getProjectAuditEvents(projectId: string, carNumber?: string, limit?: number, offset?: number): Promise<any> {
  const params = new URLSearchParams();
  if (carNumber) params.set('car_number', carNumber);
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  const qs = params.toString();
  const response = await fetchApi<any>(`/projects/${encodeURIComponent(projectId)}/audit${qs ? `?${qs}` : ''}`);
  return response.data;
}

// ============================================================================
// Report Builder
// ============================================================================

export async function getReportTemplates() {
  const response = await fetchApi('/reports/templates');
  return response.data;
}

export async function runReport(templateId: string, filters?: Record<string, string>) {
  const response = await fetchApi('/reports/run', {
    method: 'POST',
    body: JSON.stringify({ templateId, filters }),
  });
  return response.data;
}

export function getReportExportUrl(templateId: string, format: 'csv' | 'html', filters?: Record<string, string>) {
  const params = new URLSearchParams({ format, ...filters });
  return `/api/reports/export/${templateId}?${params}`;
}

// ============================================================================
// FLEET LOCATION (CLM Integration)
// ============================================================================

// Fleet location
export async function getCarLocations(filters?: { location_type?: string; railroad?: string; state?: string }) {
  const params = new URLSearchParams();
  if (filters?.location_type) params.set('location_type', filters.location_type);
  if (filters?.railroad) params.set('railroad', filters.railroad);
  if (filters?.state) params.set('state', filters.state);
  const qs = params.toString();
  const response = await fetchApi<unknown>(`/car-locations${qs ? `?${qs}` : ''}`);
  return response.data;
}

export async function getCarLocationByNumber(carNumber: string) {
  const response = await fetchApi(`/car-locations/${encodeURIComponent(carNumber)}`);
  return response.data;
}

export async function getCarLocationHistory(carNumber: string) {
  const response = await fetchApi(`/car-locations/${encodeURIComponent(carNumber)}/history`);
  return response.data;
}

export async function syncCLMLocations() {
  const response = await fetchApi('/integrations/clm/sync', { method: 'POST' });
  return response.data;
}

// ============================================================================
// Alerts
// ============================================================================

export async function generateAlerts() {
  const response = await fetchApi('/alerts/generate', { method: 'POST' });
  return response.data;
}

export async function getActiveAlerts() {
  const response = await fetchApi('/alerts');
  return response.data;
}

export async function dismissAlert(alertId: string) {
  const response = await fetchApi(`/alerts/${alertId}/dismiss`, { method: 'PUT' });
  return response;
}

export async function getAlertStats() {
  const response = await fetchApi('/alerts/stats');
  return response.data;
}
