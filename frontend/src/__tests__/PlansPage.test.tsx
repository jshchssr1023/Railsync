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

const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/components/Toast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirmDialog({ open, onConfirm, onCancel }: {
    open: boolean; onConfirm: () => void; onCancel: () => void;
  }) {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  };
});

jest.mock('@/components/TypeaheadSearch', () => {
  return function MockTypeaheadSearch() {
    return <div data-testid="typeahead-search" />;
  };
});

const mockGetPlanStats = jest.fn();
const mockListPlanAllocations = jest.fn();
const mockListPlanDemands = jest.fn();

jest.mock('@/lib/api', () => ({
  searchCars: jest.fn().mockResolvedValue([]),
  getPlanStats: (...args: unknown[]) => mockGetPlanStats(...args),
  listPlanAllocations: (...args: unknown[]) => mockListPlanAllocations(...args),
  addCarsToPlan: jest.fn(),
  importDemandsIntoPlan: jest.fn(),
  removeAllocationFromPlan: jest.fn(),
  assignShopToPlanAllocation: jest.fn(),
  evaluateShops: jest.fn().mockResolvedValue([]),
  listDemands: jest.fn().mockResolvedValue([]),
  listScenarios: jest.fn().mockResolvedValue([]),
  listPlanDemands: (...args: unknown[]) => mockListPlanDemands(...args),
  createDemandForPlan: jest.fn(),
}));

global.fetch = jest.fn();

import MasterPlansPage from '@/app/(network)/plans/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    name: 'March 2026 S&OP',
    description: 'Monthly planning cycle',
    fiscal_year: 2026,
    planning_month: '2026-03',
    status: 'active',
    version_count: 3,
    latest_version: 3,
    current_allocation_count: 150,
    current_estimated_cost: 500000,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

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
  mockGetPlanStats.mockResolvedValue({
    total_allocations: 150,
    assigned: 100,
    unassigned: 50,
    total_estimated_cost: 500000,
    planned_cost: 200000,
    committed_cost: 300000,
    by_status: [],
    by_shop: [],
  });
  mockListPlanAllocations.mockResolvedValue([]);
  mockListPlanDemands.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MasterPlansPage', () => {
  it('shows sign-in message when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<MasterPlansPage />);
    expect(screen.getByText('Please sign in to view master plans.')).toBeInTheDocument();
  });

  it('renders header and subheader', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Master Plans')).toBeInTheDocument();
    });
    expect(screen.getByText('Build and version monthly planning cycles')).toBeInTheDocument();
  });

  it('renders new plan button', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('New Plan')).toBeInTheDocument();
    });
  });

  it('displays plan list with data', async () => {
    mockFetchSuccess([
      makePlan({ id: '1', name: 'March 2026 S&OP', status: 'active' }),
      makePlan({ id: '2', name: 'April 2026 S&OP', status: 'draft' }),
    ]);

    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('March 2026 S&OP')).toBeInTheDocument();
    });
    expect(screen.getByText('April 2026 S&OP')).toBeInTheDocument();
  });

  it('shows empty state when no plans', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('No plans yet')).toBeInTheDocument();
    });
    expect(screen.getByText('Create your first plan')).toBeInTheDocument();
  });

  it('displays planning cycles header', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Planning Cycles')).toBeInTheDocument();
    });
  });

  it('renders tabs when plan selected', async () => {
    mockFetchSuccess([makePlan()]);

    render(<MasterPlansPage />);
    const planButton = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planButton);

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    expect(screen.getByText('Demands')).toBeInTheDocument();
    expect(screen.getByText('Cars & Allocations')).toBeInTheDocument();
    expect(screen.getByText('Versions')).toBeInTheDocument();
  });

  it('displays overview tab with stats', async () => {
    mockFetchSuccess([makePlan()]);

    render(<MasterPlansPage />);
    const planButton = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planButton);

    await waitFor(() => {
      expect(screen.getByText('Total Cars')).toBeInTheDocument();
    });
  });

  it('shows add cars button on allocations tab', async () => {
    mockFetchSuccess([makePlan()]);

    render(<MasterPlansPage />);
    const planButton = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planButton);

    const allocationsTab = await screen.findByText('Cars & Allocations');
    fireEvent.click(allocationsTab);

    await waitFor(() => {
      expect(screen.getByText('Add Cars')).toBeInTheDocument();
    });
  });

  it('shows import from demands button', async () => {
    mockFetchSuccess([makePlan()]);

    render(<MasterPlansPage />);
    const planButton = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planButton);

    const allocationsTab = await screen.findByText('Cars & Allocations');
    fireEvent.click(allocationsTab);

    await waitFor(() => {
      expect(screen.getByText('Import from Demands')).toBeInTheDocument();
    });
  });

  it('shows create snapshot button on versions tab', async () => {
    mockFetchSuccess([makePlan()]);

    render(<MasterPlansPage />);
    const planButton = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planButton);

    const versionsTab = await screen.findByText('Versions');
    fireEvent.click(versionsTab);

    await waitFor(() => {
      expect(screen.getByText('Snapshot')).toBeInTheDocument();
    });
  });

  it('shows new demand button on demands tab', async () => {
    mockFetchSuccess([makePlan()]);

    render(<MasterPlansPage />);
    const planButton = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planButton);

    const demandsTab = await screen.findByText('Demands');
    fireEvent.click(demandsTab);

    await waitFor(() => {
      expect(screen.getByText('New Demand')).toBeInTheDocument();
    });
  });

  it('opens create plan modal when button clicked', async () => {
    render(<MasterPlansPage />);
    const newButton = await screen.findByText('New Plan');
    fireEvent.click(newButton);

    await waitFor(() => {
      expect(screen.getByText('Create Master Plan')).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<MasterPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  it('displays status dropdown for selected plan', async () => {
    mockFetchSuccess([makePlan()]);

    render(<MasterPlansPage />);
    const planButton = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planButton);

    await waitFor(() => {
      const selectElement = screen.getByRole('combobox');
      expect(selectElement).toBeInTheDocument();
    });
  });
});
