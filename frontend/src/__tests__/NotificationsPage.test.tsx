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

// Notifications page uses direct fetch
global.fetch = jest.fn();

import NotificationsPage from '@/app/notifications/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess() {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/notifications/preferences')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            email_enabled: true,
            shopping_events: true,
            estimate_updates: true,
            invoice_alerts: true,
            system_alerts: true,
          },
        }),
      });
    }
    if (url.includes('/notifications/queue/status')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: { pending: 5, processing: 0, sent: 100, failed: 2, oldest_pending: null },
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

describe('NotificationsPage', () => {
  it('renders header', async () => {
    render(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<NotificationsPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('fetches notification data on mount', async () => {
    render(<NotificationsPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
