import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/components/Toast', () => ({
  useToast: () => mockToast,
}));

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

jest.mock('@/components/ErrorBoundary', () => ({
  FetchError: ({ error, onRetry }: { error: string; onRetry: () => void }) => (
    <div>
      <span>Error: {error}</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirmDialog() {
    return <div data-testid="confirm-dialog" />;
  };
});

jest.mock('@/hooks/useTransitionConfirm', () => ({
  useTransitionConfirm: () => ({
    confirmDialogProps: {},
    requestTransition: jest.fn(),
  }),
}));

import BadOrdersPage from '@/app/(assets)/bad-orders/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    car_number: 'GATX 12345',
    reported_date: '2026-01-15T00:00:00Z',
    issue_type: 'valve_leak',
    issue_description: 'Leaking valve on tank bottom',
    severity: 'high' as const,
    location: 'Houston Yard',
    reported_by: 'John Smith',
    status: 'open' as const,
    resolution_action: undefined,
    had_existing_plan: false,
    existing_shop_code: undefined,
    existing_target_month: undefined,
    created_at: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReturnValue(null);
  mockListBadOrders.mockResolvedValue([]);
  mockCreateBadOrder.mockResolvedValue(makeReport());
  mockResolveBadOrder.mockResolvedValue(makeReport({ status: 'assigned' }));
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

  it('renders Report Bad Order button', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('+ Report Bad Order')).toBeInTheDocument();
    });
  });

  it('renders status filter buttons', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('pending_decision')).toBeInTheDocument();
    expect(screen.getByText('assigned')).toBeInTheDocument();
    expect(screen.getByText('resolved')).toBeInTheDocument();
  });

  it('shows empty state when no reports', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('No bad order reports found')).toBeInTheDocument();
    });
  });

  it('renders report data', async () => {
    mockListBadOrders.mockResolvedValue([
      makeReport({ id: '1', car_number: 'GATX 12345', severity: 'high', issue_type: 'valve_leak', issue_description: 'Leaking valve', location: 'Houston Yard' }),
    ]);

    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('GATX 12345')).toBeInTheDocument();
    });
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('Location: Houston Yard')).toBeInTheDocument();
  });

  it('shows form when Report Bad Order button clicked', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('+ Report Bad Order')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ Report Bad Order'));

    expect(screen.getByText('Car Number *')).toBeInTheDocument();
    expect(screen.getByText('Severity *')).toBeInTheDocument();
    expect(screen.getByText('Issue Type *')).toBeInTheDocument();
    expect(screen.getByText('Description *')).toBeInTheDocument();
    expect(screen.getByText('Reported By')).toBeInTheDocument();
    expect(screen.getByText('Submit Bad Order Report')).toBeInTheDocument();
  });

  it('toggles form button text to Cancel when form is open', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('+ Report Bad Order')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ Report Bad Order'));
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders severity options in form', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('+ Report Bad Order')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ Report Bad Order'));

    expect(screen.getByText('Critical - Safety issue')).toBeInTheDocument();
    expect(screen.getByText('High - Needs prompt attention')).toBeInTheDocument();
    expect(screen.getByText('Medium - Found during inspection')).toBeInTheDocument();
    expect(screen.getByText('Low - Minor issue')).toBeInTheDocument();
  });

  it('renders issue type options in form', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('+ Report Bad Order')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ Report Bad Order'));

    expect(screen.getByText('Valve Leak')).toBeInTheDocument();
    expect(screen.getByText('Structural Damage')).toBeInTheDocument();
    expect(screen.getByText('Tank Integrity')).toBeInTheDocument();
  });

  it('shows Shopping Request and Create Assignment for open reports without existing plan', async () => {
    mockListBadOrders.mockResolvedValue([
      makeReport({ status: 'open', had_existing_plan: false }),
    ]);

    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('Shopping Request')).toBeInTheDocument();
    });
    expect(screen.getByText('Create Assignment')).toBeInTheDocument();
  });

  it('shows Expedite Existing and Planning Review for open reports with existing plan', async () => {
    mockListBadOrders.mockResolvedValue([
      makeReport({ status: 'open', had_existing_plan: true, existing_shop_code: 'SH01', existing_target_month: '2026-03' }),
    ]);

    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('Expedite Existing')).toBeInTheDocument();
    });
    expect(screen.getByText('Planning Review')).toBeInTheDocument();
    expect(screen.getByText(/Has existing plan: SH01/)).toBeInTheDocument();
  });

  it('does not show action buttons for resolved reports', async () => {
    mockListBadOrders.mockResolvedValue([
      makeReport({ status: 'resolved' }),
    ]);

    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('GATX 12345')).toBeInTheDocument();
    });
    expect(screen.queryByText('Shopping Request')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Assignment')).not.toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    mockListBadOrders.mockRejectedValue(new Error('Server error'));

    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('Error: Server error')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('calls listBadOrders with status filter when filter clicked', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('open'));
    await waitFor(() => {
      expect(mockListBadOrders).toHaveBeenCalledWith({ status: 'open' });
    });
  });

  it('renders confirm dialog component', async () => {
    render(<BadOrdersPage />);
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });
  });
});
