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
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
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

export default {
  getCarByNumber,
  listShops,
  evaluateShops,
  evaluateShopsDirect,
  getShopBacklog,
  listRules,
  getRuleById,
  updateRule,
  healthCheck,
};
