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

const mockListRiders = jest.fn();
const mockGetRider = jest.fn();
const mockUpdateRider = jest.fn();

jest.mock('@/lib/api', () => ({
  listRiders: (...args: unknown[]) => mockListRiders(...args),
  getRider: (...args: unknown[]) => mockGetRider(...args),
  updateRider: (...args: unknown[]) => mockUpdateRider(...args),
}));

// Also mock global fetch since page uses fetchWithAuth for populate
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, data: [] }),
});

import RidersPage from '@/app/riders/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRider(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rider_1',
    contract_base: 'ML-001',
    rider_number: 'R-001',
    lessee_code: 'ACME',
    lessee_name: 'Acme Corp',
    car_count: 25,
    effective_date: '2025-01-01',
    expiration_date: '2027-12-31',
    terms_summary: 'Standard terms',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockListRiders.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RidersPage', () => {
  it('renders header', async () => {
    render(<RidersPage />);
    await waitFor(() => {
      expect(screen.getByText('Contract Riders')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockListRiders.mockImplementation(() => new Promise(() => {}));
    render(<RidersPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays rider list with data', async () => {
    mockListRiders.mockResolvedValue([
      makeRider({ id: 'rider_1', lessee_name: 'Acme Corp', rider_number: 'R-001' }),
      makeRider({ id: 'rider_2', lessee_name: 'Beta Inc', rider_number: 'R-002' }),
    ]);

    render(<RidersPage />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('shows empty state when no riders', async () => {
    render(<RidersPage />);
    await waitFor(() => {
      expect(screen.getByText('No riders found')).toBeInTheDocument();
    });
  });

  it('calls listRiders on mount', async () => {
    render(<RidersPage />);
    await waitFor(() => {
      expect(mockListRiders).toHaveBeenCalled();
    });
  });

  it('renders Populate button for admin', async () => {
    render(<RidersPage />);
    await waitFor(() => {
      expect(screen.getByText('Contract Riders')).toBeInTheDocument();
    });
    // Populate button exists for admin users
    expect(screen.getByText('Populate from Cars')).toBeInTheDocument();
  });
});
