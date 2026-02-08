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

// Commodities page uses direct fetch
global.fetch = jest.fn();

import CommoditiesPage from '@/app/(documentation)/commodities/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommodity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'com_1',
    commodity_code: 'CHEM-01',
    commodity_name: 'Hydrochloric Acid',
    hazmat_class: '8',
    requires_interior_cleaning: true,
    requires_exterior_cleaning: false,
    requires_kosher_cleaning: false,
    special_handling_notes: null,
    is_active: true,
    ...overrides,
  };
}

function mockFetchSuccess(data: unknown[] = []) {
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

describe('CommoditiesPage', () => {
  it('renders header', async () => {
    render(<CommoditiesPage />);
    await waitFor(() => {
      expect(screen.getByText('Commodity Codes')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<CommoditiesPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays commodities table with data', async () => {
    mockFetchSuccess([
      makeCommodity({ id: 'com_1', commodity_name: 'Hydrochloric Acid', commodity_code: 'CHEM-01' }),
    ]);

    render(<CommoditiesPage />);
    await waitFor(() => {
      expect(screen.getByText('Hydrochloric Acid')).toBeInTheDocument();
    });
  });

  it('shows empty state when no commodities', async () => {
    render(<CommoditiesPage />);
    await waitFor(() => {
      expect(screen.getByText('No commodities found')).toBeInTheDocument();
    });
  });

  it('fetches commodities on mount', async () => {
    render(<CommoditiesPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
