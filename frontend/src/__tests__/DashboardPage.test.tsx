import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = { id: '1', email: 'admin@test.com', first_name: 'Admin', last_name: 'User', role: 'admin' as const, is_active: true };

let mockIsAuthenticated = true;
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? mockUser : null,
    isLoading: false,
  }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import DashboardPage from '@/app/dashboard/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const contractsReadiness = {
  total_cars: 1000,
  in_pipeline: 150,
  available: 850,
  availability_pct: 85,
  need_shopping: 25,
  to_be_routed: 10,
  planned_shopping: 30,
  enroute: 20,
  arrived: 15,
  complete: 40,
  released: 35,
};

function mockDashboardEndpoints(overrides: Record<string, unknown> = {}) {
  mockFetch.mockImplementation((url: string) => {
    const endpoint = url.replace(/.*\/api/, '');
    const responses: Record<string, unknown> = {
      '/dashboard/contracts-readiness': contractsReadiness,
      '/dashboard/need-shopping': [],
      '/dashboard/my-contracts': [],
      '/dashboard/manager-performance': [],
      '/dashboard/dwell-time': [],
      '/dashboard/throughput?days=30': { entered_pipeline: 40, completed: 45 },
      '/dashboard/upcoming-releases?days=7': [],
      '/dashboard/high-cost-exceptions?threshold=10': [],
      '/dashboard/expiry-forecast': [],
      ...overrides,
    };

    // Match endpoint by prefix
    for (const key of Object.keys(responses)) {
      if (endpoint.startsWith(key) || endpoint.includes(key.replace('?', ''))) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: responses[key] }) });
      }
    }

    // Fallback for budget-burn and project-planning
    if (endpoint.includes('budget-burn')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: overrides['budget-burn'] || null }) });
    }
    if (endpoint.includes('project-planning')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: overrides['project-planning'] || null }) });
    }

    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: null }) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  Storage.prototype.getItem = jest.fn(() => 'fake-token');
  mockDashboardEndpoints();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardPage', () => {
  it('renders title and Refresh button when authenticated', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('shows sign-in message when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<DashboardPage />);
    expect(screen.getByText('Please sign in to view the dashboard')).toBeInTheDocument();
  });

  it('renders contracts readiness summary cards', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Total Cars')).toBeInTheDocument();
    });
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('In Pipeline')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    // "Need Shopping" appears in both summary card and pipeline legend
    expect(screen.getAllByText('Need Shopping').length).toBeGreaterThanOrEqual(1);
    // "25" appears in both the card value and pipeline legend count
    expect(screen.getAllByText('25').length).toBeGreaterThanOrEqual(1);
  });

  it('renders pipeline status breakdown', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Pipeline Status Breakdown')).toBeInTheDocument();
    });
  });

  it('renders My Contracts Health section', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('My Contracts Health')).toBeInTheDocument();
    });
  });

  it('shows "No active allocations" when myContracts is empty', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('No active allocations')).toBeInTheDocument();
    });
  });

  it('renders throughput section with data', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('30-Day Throughput')).toBeInTheDocument();
    });
    expect(screen.getByText('Entered Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders dwell time section', async () => {
    mockDashboardEndpoints({
      '/dashboard/dwell-time': [
        { status: 'Enroute', car_count: 10, avg_days: 5, min_days: 1, max_days: 12 },
        { status: 'Arrived', car_count: 8, avg_days: 35, min_days: 20, max_days: 50 },
      ],
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Dwell Time by Status')).toBeInTheDocument();
    });
  });

  it('renders Recent Completions section', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Recent Completions')).toBeInTheDocument();
    });
  });

  it('renders High-Cost Exceptions section', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('High-Cost Exceptions')).toBeInTheDocument();
    });
    expect(screen.getByText('No cost exceptions')).toBeInTheDocument();
  });

  it('renders Qualification Expiry Forecast section', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Qualification Expiry Forecast')).toBeInTheDocument();
    });
  });

  it('renders Need Shopping Queue section', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Need Shopping Queue')).toBeInTheDocument();
    });
    expect(screen.getByText('All cars assigned')).toBeInTheDocument();
  });

  it('shows need-shopping items with waiting days', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    mockDashboardEndpoints({
      '/dashboard/need-shopping': [
        { id: '1', car_id: 'c1', car_number: 'GATX 5555', shop_code: 'S1', target_month: '2025-07', estimated_cost: 15000, created_at: twoDaysAgo },
      ],
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('GATX 5555')).toBeInTheDocument();
    });
    expect(screen.getByText('2d')).toBeInTheDocument();
  });

  it('renders manager performance for admin users', async () => {
    mockDashboardEndpoints({
      '/dashboard/manager-performance': [
        {
          manager_id: 'm1', manager_name: 'Jane Doe', organization: 'Ops',
          total_allocations: 20, completed: 15, active: 5,
          total_estimated: 500000, total_actual: 480000,
          budget_variance_pct: -4, avg_days_in_shop: 18,
        },
      ],
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Manager Performance')).toBeInTheDocument();
    });
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('calls loadDashboard on Refresh click', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    mockFetch.mockClear();
    mockDashboardEndpoints();
    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      // All 11 endpoints should be called again
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('renders budget burn velocity section', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Budget Burn Velocity')).toBeInTheDocument();
    });
  });

  it('renders expiry forecast items', async () => {
    mockDashboardEndpoints({
      '/dashboard/expiry-forecast': [
        { car_number: 'GATX 9999', car_mark: 'GATX', car_type: 'DOT 111', lessee_name: 'Acme', tank_qual_year: 2025, current_status: 'Complete', portfolio_status: 'Active' },
      ],
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('GATX 9999')).toBeInTheDocument();
    });
  });

  it('shows project planning when active projects exist', async () => {
    mockDashboardEndpoints({
      'project-planning': {
        active_projects: 3, total_cars: 100, planned_cars: 40, locked_cars: 20,
        completed_cars: 30, unplanned_cars: 10, total_estimated_cost: 2000000,
      },
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Project Planning')).toBeInTheDocument();
    });
    expect(screen.getByText('View Projects')).toBeInTheDocument();
  });
});
