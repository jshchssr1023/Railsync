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

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/plans',
  useSearchParams: () => new URLSearchParams(),
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

const mockListMasterPlans = jest.fn();
const mockGetPlanStats = jest.fn();
const mockListPlanAllocations = jest.fn();
const mockListPlanDemands = jest.fn();
const mockCreateMasterPlan = jest.fn();
const mockGetCapacityFit = jest.fn();
const mockTransitionPlanStatus = jest.fn();
const mockDuplicatePlan = jest.fn();

jest.mock('@/lib/api', () => ({
  listMasterPlans: (...args: unknown[]) => mockListMasterPlans(...args),
  createMasterPlan: (...args: unknown[]) => mockCreateMasterPlan(...args),
  duplicatePlan: (...args: unknown[]) => mockDuplicatePlan(...args),
  transitionPlanStatus: (...args: unknown[]) => mockTransitionPlanStatus(...args),
  getCapacityFit: (...args: unknown[]) => mockGetCapacityFit(...args),
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
  listPlanVersions: jest.fn().mockResolvedValue([]),
}));

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
    status: 'draft',
    version_count: 3,
    latest_version: 3,
    current_allocation_count: 150,
    current_estimated_cost: 500000,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

function mockPlansData(plans: any[]) {
  mockListMasterPlans.mockResolvedValue(plans);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockPlansData([]);
  mockGetCapacityFit.mockResolvedValue({
    overall_level: 'good',
    overall_score: 85,
    level: 'good',
    shops: [],
    conflicts: [],
  });
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
  mockCreateMasterPlan.mockResolvedValue(makePlan());
  mockTransitionPlanStatus.mockResolvedValue(makePlan());
  mockDuplicatePlan.mockResolvedValue(makePlan());
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

  it('renders header', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Master Plans')).toBeInTheDocument();
    });
  });

  it('renders new plan button', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('New Plan')).toBeInTheDocument();
    });
  });

  it('displays plan list with data', async () => {
    mockPlansData([
      makePlan({ id: '1', name: 'March 2026 S&OP', status: 'draft' }),
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
      expect(screen.getByText('No open plans')).toBeInTheDocument();
    });
    expect(screen.getByText('Create your first plan')).toBeInTheDocument();
  });

  it('displays status bucket tabs', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Open Plans')).toBeInTheDocument();
    });
    expect(screen.getByText('Pending Commitment')).toBeInTheDocument();
    expect(screen.getByText('Committed Plans')).toBeInTheDocument();
    expect(screen.getByText('Archived Plans')).toBeInTheDocument();
  });

  it('opens drawer when plan row clicked', async () => {
    mockPlansData([makePlan()]);

    render(<MasterPlansPage />);
    const planRow = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planRow);

    await waitFor(() => {
      expect(screen.getByText('Plan Summary')).toBeInTheDocument();
    });
    expect(screen.getByText('Open Workspace')).toBeInTheDocument();
  });

  it('shows plan summary stats in drawer', async () => {
    mockPlansData([makePlan()]);

    render(<MasterPlansPage />);
    const planRow = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planRow);

    await waitFor(() => {
      expect(screen.getByText('Plan Summary')).toBeInTheDocument();
    });
    expect(screen.getByText('Period')).toBeInTheDocument();
    expect(screen.getByText('Est. Cost')).toBeInTheDocument();
  });

  it('shows transition buttons for draft plan', async () => {
    mockPlansData([makePlan({ status: 'draft' })]);

    render(<MasterPlansPage />);
    const planRow = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planRow);

    await waitFor(() => {
      expect(screen.getByText('Promote to')).toBeInTheDocument();
    });
  });

  it('shows duplicate button in drawer', async () => {
    mockPlansData([makePlan()]);

    render(<MasterPlansPage />);
    const planRow = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planRow);

    await waitFor(() => {
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
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
    mockListMasterPlans.mockImplementation(() => new Promise(() => {}));
    render(<MasterPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Loading plans...')).toBeInTheDocument();
    });
  });

  it('calls listMasterPlans on mount', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(mockListMasterPlans).toHaveBeenCalled();
    });
  });

  it('shows plans in committed bucket', async () => {
    mockPlansData([
      makePlan({ id: '1', name: 'Committed Plan', status: 'committed' }),
    ]);

    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Committed Plans')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Committed Plans'));
    await waitFor(() => {
      expect(screen.getByText('Committed Plan')).toBeInTheDocument();
    });
  });

  it('shows table column headers with plan data', async () => {
    mockPlansData([makePlan()]);

    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan')).toBeInTheDocument();
    });
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('displays Draft status badge for draft plans', async () => {
    mockPlansData([makePlan({ status: 'draft' })]);

    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });
  });
});
