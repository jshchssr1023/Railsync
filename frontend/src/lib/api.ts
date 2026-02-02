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
};

export default api;
