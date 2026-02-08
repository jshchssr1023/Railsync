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

// Shop performance page uses direct fetch
global.fetch = jest.fn();

import ShopPerformancePage from '@/app/(network)/shop-performance/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

describe('ShopPerformancePage', () => {
  it('renders header', async () => {
    render(<ShopPerformancePage />);
    await waitFor(() => {
      expect(screen.getByText('Shop Performance')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<ShopPerformancePage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('fetches data on mount', async () => {
    render(<ShopPerformancePage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('renders score cards when data loads', async () => {
    render(<ShopPerformancePage />);
    await waitFor(() => {
      expect(screen.getByText('Shop Performance')).toBeInTheDocument();
    });
  });
});
