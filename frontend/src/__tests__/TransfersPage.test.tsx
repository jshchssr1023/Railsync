import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

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

// The transfers page uses direct fetch
const originalFetch = global.fetch;
global.fetch = jest.fn();

import ContractTransfersPage from '@/app/(assets)/transfers/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTransfer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tfr_1',
    car_id: 'car_1',
    car_number: 'GATX 10001',
    from_rider_id: 'rider_1',
    from_rider_name: 'Rider A',
    to_rider_id: 'rider_2',
    to_rider_name: 'Rider B',
    transfer_type: 'permanent',
    effective_date: '2026-03-01',
    status: 'INITIATED',
    reason: 'Contract reassignment',
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

const defaultOverview = {
  pending: 3,
  confirmed: 2,
  completed_this_month: 8,
  cancelled: 1,
};

function mockFetchResponses(transfers: unknown[] = [], overview = defaultOverview) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/transfers/overview')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: overview }),
      });
    }
    if (url.includes('/transfers')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: transfers }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockFetchResponses();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterAll(() => {
  global.fetch = originalFetch;
});

describe('ContractTransfersPage', () => {
  it('renders header and subheader', async () => {
    render(<ContractTransfersPage />);
    await waitFor(() => {
      expect(screen.getByText('Contract Transfers')).toBeInTheDocument();
    });
  });

  it('renders overview stats cards', async () => {
    render(<ContractTransfersPage />);
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
    // "Confirmed" appears in both stats card and filter tab, so use getAllByText
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<ContractTransfersPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays transfers table with data', async () => {
    mockFetchResponses([
      makeTransfer({ id: 'tfr_1', car_number: 'GATX 10001', from_rider_name: 'Rider A', to_rider_name: 'Rider B' }),
    ]);

    render(<ContractTransfersPage />);
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });
  });

  it('shows empty state when no transfers', async () => {
    render(<ContractTransfersPage />);
    await waitFor(() => {
      expect(screen.getByText('No transfers found')).toBeInTheDocument();
    });
  });

  it('renders status filter tabs', async () => {
    render(<ContractTransfersPage />);
    await waitFor(() => {
      expect(screen.getByText('Contract Transfers')).toBeInTheDocument();
    });
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders refresh button', async () => {
    render(<ContractTransfersPage />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });
});
