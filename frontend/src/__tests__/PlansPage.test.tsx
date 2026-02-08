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

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const mockListMasterPlans = jest.fn();
const mockGetCapacityFit = jest.fn();
const mockGetPlanStats = jest.fn();
const mockListPlanAllocations = jest.fn();

jest.mock('@/lib/api', () => ({
  listMasterPlans: (...args: unknown[]) => mockListMasterPlans(...args),
  createMasterPlan: jest.fn(),
  duplicatePlan: jest.fn(),
  transitionPlanStatus: jest.fn(),
  getCapacityFit: (...args: unknown[]) => mockGetCapacityFit(...args),
  getPlanStats: (...args: unknown[]) => mockGetPlanStats(...args),
  listPlanAllocations: (...args: unknown[]) => mockListPlanAllocations(...args),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockListMasterPlans.mockResolvedValue([]);
  mockGetCapacityFit.mockRejectedValue(new Error('not loaded'));
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
  });

  it('renders new plan button', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('New Plan')).toBeInTheDocument();
    });
  });

  it('renders status bucket filters', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Open Plans')).toBeInTheDocument();
    });
    expect(screen.getByText('Pending Commitment')).toBeInTheDocument();
    expect(screen.getByText('Committed Plans')).toBeInTheDocument();
    expect(screen.getByText('Archived Plans')).toBeInTheDocument();
  });

  it('displays plan list with data', async () => {
    mockListMasterPlans.mockResolvedValue([
      makePlan({ id: '1', name: 'March 2026 S&OP', status: 'draft' }),
      makePlan({ id: '2', name: 'April 2026 S&OP', status: 'soft_plan' }),
    ]);

    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('March 2026 S&OP')).toBeInTheDocument();
    });
    expect(screen.getByText('April 2026 S&OP')).toBeInTheDocument();
  });

  it('shows empty state when no open plans', async () => {
    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText(/No open plans/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Create your first plan')).toBeInTheDocument();
  });

  it('renders table columns', async () => {
    mockListMasterPlans.mockResolvedValue([makePlan()]);

    render(<MasterPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan')).toBeInTheDocument();
    });
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Cars')).toBeInTheDocument();
    expect(screen.getByText('Target Shops')).toBeInTheDocument();
    expect(screen.getByText('Est. Start')).toBeInTheDocument();
    expect(screen.getByText('Est. Completion')).toBeInTheDocument();
    expect(screen.getByText('Capacity Fit')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('opens drawer when clicking a plan row', async () => {
    mockListMasterPlans.mockResolvedValue([makePlan()]);

    render(<MasterPlansPage />);
    const planRow = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planRow);

    await waitFor(() => {
      expect(screen.getByText('Plan Summary')).toBeInTheDocument();
    });
    expect(screen.getByText('Open Workspace')).toBeInTheDocument();
  });

  it('shows lifecycle status badge in drawer', async () => {
    mockListMasterPlans.mockResolvedValue([makePlan({ status: 'draft' })]);

    render(<MasterPlansPage />);
    const planRow = await screen.findByText('March 2026 S&OP');
    fireEvent.click(planRow);

    await waitFor(() => {
      // Draft status should appear multiple times (table + drawer)
      const draftBadges = screen.getAllByText('Draft');
      expect(draftBadges.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('filters plans by search query', async () => {
    mockListMasterPlans.mockResolvedValue([
      makePlan({ id: '1', name: 'March 2026 S&OP' }),
      makePlan({ id: '2', name: 'April 2026 S&OP' }),
    ]);

    render(<MasterPlansPage />);
    await screen.findByText('March 2026 S&OP');

    const searchInput = screen.getByPlaceholderText('Search plans by name or project...');
    fireEvent.change(searchInput, { target: { value: 'April' } });

    await waitFor(() => {
      expect(screen.queryByText('March 2026 S&OP')).not.toBeInTheDocument();
    });
    expect(screen.getByText('April 2026 S&OP')).toBeInTheDocument();
  });
});
