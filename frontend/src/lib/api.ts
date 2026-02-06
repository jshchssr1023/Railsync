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
};

export default api;
