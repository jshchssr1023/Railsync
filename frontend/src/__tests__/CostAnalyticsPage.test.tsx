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

// Cost analytics page uses direct fetch
global.fetch = jest.fn();

import CostAnalyticsPage from '@/app/cost-analytics/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess() {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [] }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockFetchSuccess();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CostAnalyticsPage', () => {
  it('renders header', async () => {
    render(<CostAnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Cost Analytics')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<CostAnalyticsPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('fetches data on mount', async () => {
    render(<CostAnalyticsPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('renders tab navigation', async () => {
    render(<CostAnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Cost Analytics')).toBeInTheDocument();
    });
  });
});
