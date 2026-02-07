import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockIsAuthenticated = true;
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? { id: '1', email: 'admin@test.com', first_name: 'Admin', last_name: 'User', role: 'admin' as const, is_active: true } : null,
    isLoading: false,
  }),
}));

global.fetch = jest.fn();

import AnalyticsPage from '@/app/analytics/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess(data: any) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockFetchSuccess([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalyticsPage', () => {
  it('shows sign-in message when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<AnalyticsPage />);
    expect(screen.getByText('Please sign in to view analytics.')).toBeInTheDocument();
  });

  it('renders header and subheader', async () => {
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Analytics & BI')).toBeInTheDocument();
    });
    expect(screen.getByText(/Advanced analytics, forecasting, and performance insights/)).toBeInTheDocument();
  });

  it('renders all 4 tab buttons', async () => {
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Capacity Forecasting')).toBeInTheDocument();
    });
    expect(screen.getByText('Cost Analytics')).toBeInTheDocument();
    expect(screen.getByText('Operations KPIs')).toBeInTheDocument();
    expect(screen.getByText('Demand Forecasting')).toBeInTheDocument();
  });

  it('displays capacity bottlenecks section on capacity tab', async () => {
    mockFetchSuccess([
      {
        shop_code: 'SHP1',
        shop_name: 'Test Shop',
        region: 'US-East',
        capacity: 100,
        current_load: 85,
        utilization_pct: 85,
        hours_backlog: 120,
      },
    ]);

    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Capacity Bottlenecks')).toBeInTheDocument();
    });
    expect(screen.getByText('Shops with highest utilization')).toBeInTheDocument();
  });

  it('displays capacity forecast summary cards', async () => {
    mockFetchSuccess([
      { shop_code: 'SHP1', status: 'optimal', utilization_pct: 75 },
      { shop_code: 'SHP2', status: 'at-risk', utilization_pct: 95 },
    ]);

    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('6-Month Capacity Forecast')).toBeInTheDocument();
    });
    expect(screen.getByText('Projected utilization by shop')).toBeInTheDocument();
  });

  it('switches to cost analytics tab', async () => {
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Cost Analytics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cost Analytics'));
    await waitFor(() => {
      expect(screen.getByText('Budget vs Actual')).toBeInTheDocument();
    });
  });

  it('displays cost trends chart on cost tab', async () => {
    mockFetchSuccess([
      { month: '2026-01', total_cost: 150000, car_count: 50 },
      { month: '2026-02', total_cost: 175000, car_count: 60 },
    ]);

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Cost Analytics'));

    await waitFor(() => {
      expect(screen.getByText('Cost Trends (12 Months)')).toBeInTheDocument();
    });
  });

  it('displays shop cost comparison table', async () => {
    mockFetchSuccess([
      {
        shop_code: 'SHP1',
        shop_name: 'Test Shop 1',
        total_cost: 50000,
        car_count: 20,
        avg_cost_per_car: 2500,
        labor_rate: 85,
      },
    ]);

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Cost Analytics'));

    await waitFor(() => {
      expect(screen.getByText('Cost by Shop')).toBeInTheDocument();
    });
  });

  it('switches to operations KPIs tab', async () => {
    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Operations KPIs'));

    await waitFor(() => {
      expect(screen.getByText('Throughput Trends')).toBeInTheDocument();
    });
  });

  it('displays dwell time by shop table on operations tab', async () => {
    mockFetchSuccess([
      {
        shop_code: 'SHP1',
        shop_name: 'Test Shop',
        avg_dwell_days: 18,
        min_dwell_days: 5,
        max_dwell_days: 35,
        car_count: 25,
      },
    ]);

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Operations KPIs'));

    await waitFor(() => {
      expect(screen.getByText('Dwell Time by Shop')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Average days in shop (last 90 days)')).toBeInTheDocument();
    });
  });

  it('switches to demand forecasting tab', async () => {
    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Demand Forecasting'));

    await waitFor(() => {
      expect(screen.getByText('6-Month Demand Forecast')).toBeInTheDocument();
    });
  });

  it('displays demand by region table on demand tab', async () => {
    mockFetchSuccess([
      {
        region: 'US-East',
        current_demand: 100,
        projected_demand: 120,
        growth_pct: 20,
      },
    ]);

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Demand Forecasting'));

    await waitFor(() => {
      expect(screen.getByText('Demand by Region')).toBeInTheDocument();
    });
  });

  it('displays demand by customer table on demand tab', async () => {
    mockFetchSuccess([
      {
        customer_name: 'Acme Corp',
        current_demand: 50,
        historical_avg: 45,
        trend: 'increasing',
      },
    ]);

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Demand Forecasting'));

    await waitFor(() => {
      expect(screen.getByText('Demand by Customer')).toBeInTheDocument();
    });
  });
});
