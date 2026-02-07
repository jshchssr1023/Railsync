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

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/components/Toast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirmDialog({ open, onConfirm, onCancel, title, confirmLabel }: {
    open: boolean; onConfirm: () => void; onCancel: () => void; title: string; confirmLabel?: string;
  }) {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <button onClick={onConfirm}>{confirmLabel || 'Confirm'}</button>
        <button onClick={onCancel}>Cancel dialog</button>
      </div>
    );
  };
});

const mockListBadOrders = jest.fn();
const mockCreateBadOrder = jest.fn();
const mockResolveBadOrder = jest.fn();
const mockRevertBadOrder = jest.fn();

jest.mock('@/lib/api', () => ({
  listBadOrders: (...args: unknown[]) => mockListBadOrders(...args),
  createBadOrder: (...args: unknown[]) => mockCreateBadOrder(...args),
  resolveBadOrder: (...args: unknown[]) => mockResolveBadOrder(...args),
  revertBadOrder: (...args: unknown[]) => mockRevertBadOrder(...args),
}));

jest.mock('@/hooks/useTransitionConfirm', () => ({
  useTransitionConfirm: () => ({
    confirmDialogProps: { open: false, onConfirm: jest.fn(), onCancel: jest.fn() },
    requestTransition: jest.fn(),
  }),
}));

jest.mock('@/components/ErrorBoundary', () => ({
  FetchError: ({ error, onRetry }: { error: string; onRetry: () => void }) => (
    <div>
      <p>Error: {error}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

import BadOrdersPage from '@/app/bad-orders/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBadOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    car_number: 'GATX 10001',
    issue_type: 'valve_leak',
    issue_description: 'Valve leaking',
    severity: 'critical',
    status: 'open',
    location: 'Houston Yard',
    reported_date: '2026-02-01T00:00:00Z',
    had_existing_plan: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockListBadOrders.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BadOrdersPage', () => {
  it('renders header and subheader', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('Bad Order Reports')).toBeInTheDocument();
    });
    expect(screen.getByText('Track and resolve unplanned repair needs')).toBeInTheDocument();
  });

  it('renders report bad order button', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('+ Report Bad Order')).toBeInTheDocument();
    });
  });

  it('renders filter buttons', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('pending_decision')).toBeInTheDocument();
    expect(screen.getByText('assigned')).toBeInTheDocument();
    expect(screen.getByText('resolved')).toBeInTheDocument();
  });

  it('shows loading state', async () => {
    mockListBadOrders.mockImplementation(() => new Promise(() => {}));
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  it('displays bad order list with data', async () => {
    mockListBadOrders.mockResolvedValue([
      makeBadOrder({ id: '1', car_number: 'GATX 10001', severity: 'critical', status: 'open' }),
      makeBadOrder({ id: '2', car_number: 'GATX 10002', severity: 'high', status: 'pending_decision' }),
    ]);

    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });
    expect(screen.getByText('GATX 10002')).toBeInTheDocument();
    expect(screen.getByText('Valve leaking')).toBeInTheDocument();
  });

  it('shows empty state when no reports', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('No bad order reports found')).toBeInTheDocument();
    });
  });

  it('shows form when report button clicked', async () => {
    render(<BadOrdersPage />);
    const reportButton = await screen.findByText('+ Report Bad Order');
    fireEvent.click(reportButton);

    await waitFor(() => {
      expect(screen.getByText('Submit Bad Order Report')).toBeInTheDocument();
    });
  });

  it('renders resolve button for open reports', async () => {
    mockListBadOrders.mockResolvedValue([
      makeBadOrder({ id: '1', status: 'open', had_existing_plan: false }),
    ]);

    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('Create Assignment')).toBeInTheDocument();
    });
  });

  it('renders expedite and planning review buttons for reports with existing plan', async () => {
    mockListBadOrders.mockResolvedValue([
      makeBadOrder({
        id: '1',
        status: 'open',
        had_existing_plan: true,
        existing_shop_code: 'SHP1',
        existing_target_month: '2026-03',
      }),
    ]);

    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('Expedite Existing')).toBeInTheDocument();
    });
    expect(screen.getByText('Planning Review')).toBeInTheDocument();
  });

  it('renders shopping request button', async () => {
    mockListBadOrders.mockResolvedValue([
      makeBadOrder({ id: '1', status: 'open' }),
    ]);

    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('Shopping Request')).toBeInTheDocument();
    });
  });

  it('shows error message when API fails', async () => {
    mockListBadOrders.mockRejectedValue(new Error('Network error'));

    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('Error: Network error')).toBeInTheDocument();
    });
  });

  it('filters reports when filter button clicked', async () => {
    mockListBadOrders.mockResolvedValue([]);
    render(<BadOrdersPage />);

    const openButton = await screen.findByText('open');
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(mockListBadOrders).toHaveBeenCalledWith({ status: 'open' });
    });
  });
});
