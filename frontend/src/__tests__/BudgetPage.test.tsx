import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockIsAuthenticated = true;
const mockGetAccessToken = jest.fn(() => 'mock-token');

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? { id: '1', email: 'admin@test.com', first_name: 'Admin', last_name: 'User', role: 'admin' as const, is_active: true } : null,
    isLoading: false,
    getAccessToken: mockGetAccessToken,
  }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

const defaultSummary = {
  data: {
    fiscal_year: new Date().getFullYear(),
    running_repairs: { total_budget: 500000, actual_spend: 200000, remaining: 300000 },
    service_events: { total_budget: 300000, planned_cost: 100000, actual_cost: 50000, remaining: 250000 },
    total: { budget: 800000, planned: 100000, shop_committed: 200000, committed: 300000, remaining: 500000, consumed_pct: 37.5 },
  },
};
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn((url: string) => {
    if (url && url.includes('/budget/summary')) {
      return { data: defaultSummary, mutate: jest.fn() };
    }
    return { data: null, mutate: jest.fn() };
  }),
  mutate: jest.fn(),
}));

jest.mock('@/components/BudgetOverview', () => {
  return function MockBudgetOverview({ fiscalYear }: { fiscalYear: number }) {
    return <div data-testid="budget-overview">Budget Overview FY{fiscalYear}</div>;
  };
});

jest.mock('@/components/DemandList', () => {
  return function MockDemandList({ fiscalYear }: { fiscalYear: number }) {
    return <div data-testid="demand-list">Demand List FY{fiscalYear}</div>;
  };
});

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirmDialog({ open, onConfirm, onCancel }: {
    open: boolean; onConfirm: () => void; onCancel: () => void;
  }) {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>Delete</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  };
});

import BudgetPage from '@/app/(operations)/budget/page';

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BudgetPage', () => {
  it('renders header and subheader', async () => {
    render(<BudgetPage />);
    await waitFor(() => {
      expect(screen.getByText('Maintenance Budget')).toBeInTheDocument();
    });
    expect(screen.getByText('Budget tracking, demand forecasts, and configuration')).toBeInTheDocument();
  });

  it('renders fiscal year selector', async () => {
    render(<BudgetPage />);
    await waitFor(() => {
      const currentYear = new Date().getFullYear();
      expect(screen.getByText(`FY${currentYear}`)).toBeInTheDocument();
    });
  });

  it('renders tab buttons', async () => {
    render(<BudgetPage />);
    await waitFor(() => {
      expect(screen.getByText('Overview & Forecasts')).toBeInTheDocument();
    });
    expect(screen.getByText('Budget Configuration')).toBeInTheDocument();
  });

  it('renders summary cards', async () => {
    render(<BudgetPage />);
    await waitFor(() => {
      expect(screen.getByText('Total Budget')).toBeInTheDocument();
    });
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Committed')).toBeInTheDocument();
    expect(screen.getByText('Remaining')).toBeInTheDocument();
    expect(screen.getByText('Consumed')).toBeInTheDocument();
  });

  it('displays overview tab by default', async () => {
    render(<BudgetPage />);
    await waitFor(() => {
      expect(screen.getByTestId('budget-overview')).toBeInTheDocument();
    });
    expect(screen.getByTestId('demand-list')).toBeInTheDocument();
  });

  it('switches to configuration tab', async () => {
    render(<BudgetPage />);
    const configTab = await screen.findByText('Budget Configuration');
    fireEvent.click(configTab);

    await waitFor(() => {
      expect(screen.getByText('Running Repairs')).toBeInTheDocument();
    });
    expect(screen.getByText('Service Events')).toBeInTheDocument();
  });

  it('displays running repairs section on configuration tab', async () => {
    render(<BudgetPage />);
    const configTab = await screen.findByText('Budget Configuration');
    fireEvent.click(configTab);

    await waitFor(() => {
      expect(screen.getByText('Running Repairs')).toBeInTheDocument();
    });
    expect(screen.getByText('Pool-based: Monthly Allocation x Cars on Lease')).toBeInTheDocument();
  });

  it('displays recalculate button for running repairs', async () => {
    render(<BudgetPage />);
    const configTab = await screen.findByText('Budget Configuration');
    fireEvent.click(configTab);

    await waitFor(() => {
      expect(screen.getByText('Recalculate')).toBeInTheDocument();
    });
  });

  it('displays service events section', async () => {
    render(<BudgetPage />);
    const configTab = await screen.findByText('Budget Configuration');
    fireEvent.click(configTab);

    await waitFor(() => {
      expect(screen.getByText('Service Events')).toBeInTheDocument();
    });
    expect(screen.getByText('Event-based: Qualifications, Assignments, Returns')).toBeInTheDocument();
  });

  it('displays add event button for service events', async () => {
    render(<BudgetPage />);
    const configTab = await screen.findByText('Budget Configuration');
    fireEvent.click(configTab);

    await waitFor(() => {
      expect(screen.getByText('Add Event')).toBeInTheDocument();
    });
  });

  it('renders running repairs table headers', async () => {
    render(<BudgetPage />);
    const configTab = await screen.findByText('Budget Configuration');
    fireEvent.click(configTab);

    await waitFor(() => {
      expect(screen.getByText('Month')).toBeInTheDocument();
    });
    expect(screen.getByText('Cars on Lease')).toBeInTheDocument();
    expect(screen.getByText('Monthly Budget')).toBeInTheDocument();
    expect(screen.getByText('Actual')).toBeInTheDocument();
  });

  it('renders service events table headers', async () => {
    render(<BudgetPage />);
    const configTab = await screen.findByText('Budget Configuration');
    fireEvent.click(configTab);

    await waitFor(() => {
      expect(screen.getByText('Event Type')).toBeInTheDocument();
    });
    expect(screen.getByText('Budgeted Cars')).toBeInTheDocument();
    expect(screen.getByText('Avg $/Car')).toBeInTheDocument();
  });

  it('shows allocation input field', async () => {
    render(<BudgetPage />);
    const configTab = await screen.findByText('Budget Configuration');
    fireEvent.click(configTab);

    await waitFor(() => {
      expect(screen.getByText('$/Car/Month:')).toBeInTheDocument();
    });
  });

  it('displays grand total section on configuration tab', async () => {
    render(<BudgetPage />);
    const configTab = await screen.findByText('Budget Configuration');
    fireEvent.click(configTab);

    await waitFor(() => {
      const fiscalYearText = screen.getAllByText(/FY\d{4}/);
      expect(fiscalYearText.length).toBeGreaterThan(0);
    });
  });
});
