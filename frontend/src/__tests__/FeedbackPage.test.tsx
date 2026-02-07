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

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/feedback',
}));

// Feedback page uses direct fetch
global.fetch = jest.fn();

import FeedbackPage from '@/app/feedback/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess() {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/feedback/stats')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: { total: 10, new_count: 3, reviewed: 4, planned: 2, resolved: 1, bugs: 3, features: 5, usability: 2 },
        }),
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
  mockFetchSuccess();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeedbackPage', () => {
  it('renders header', async () => {
    render(<FeedbackPage />);
    await waitFor(() => {
      expect(screen.getByText('Feedback')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<FeedbackPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('fetches feedback data on mount', async () => {
    render(<FeedbackPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
