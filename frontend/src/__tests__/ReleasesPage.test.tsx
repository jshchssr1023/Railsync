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

// The releases page uses direct fetch, not @/lib/api functions
const originalFetch = global.fetch;
global.fetch = jest.fn();

import ReleasesPage from '@/app/(assets)/releases/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRelease(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rel_1',
    shopping_event_id: 'se_1',
    car_id: 'car_1',
    car_number: 'GATX 10001',
    shop_code: 'SHP1',
    release_type: 'standard',
    status: 'initiated',
    notes: null,
    initiated_at: '2026-02-01T00:00:00Z',
    approved_at: null,
    executed_at: null,
    completed_at: null,
    cancelled_at: null,
    initiated_by: 'admin',
    approved_by: null,
    ...overrides,
  };
}

const defaultStats = {
  initiated: 5,
  awaiting_approval: 3,
  in_progress: 2,
  completed_this_month: 10,
};

function mockFetchResponses(releases: unknown[] = [], stats = defaultStats) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/releases/active')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: stats }),
      });
    }
    if (url.includes('/releases')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: releases }),
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

describe('ReleasesPage', () => {
  it('renders header and subheader', async () => {
    render(<ReleasesPage />);
    await waitFor(() => {
      expect(screen.getByText('Release Management')).toBeInTheDocument();
    });
    expect(screen.getByText('Track and manage car releases from maintenance shops')).toBeInTheDocument();
  });

  it('renders stats cards', async () => {
    render(<ReleasesPage />);
    await waitFor(() => {
      expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
    });
    // "In Progress" and "Initiated" appear in both stats cards and filter tabs, so use getAllByText
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Initiated').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<ReleasesPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays releases table with data', async () => {
    mockFetchResponses([
      makeRelease({ id: 'rel_1', car_number: 'GATX 10001', status: 'initiated' }),
      makeRelease({ id: 'rel_2', car_number: 'UTLX 20001', status: 'approved' }),
    ]);

    render(<ReleasesPage />);
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });
    expect(screen.getByText('UTLX 20001')).toBeInTheDocument();
  });

  it('shows empty state when no releases', async () => {
    render(<ReleasesPage />);
    await waitFor(() => {
      expect(screen.getByText('No releases found')).toBeInTheDocument();
    });
  });

  it('renders filter tabs', async () => {
    render(<ReleasesPage />);
    await waitFor(() => {
      expect(screen.getByText('Release Management')).toBeInTheDocument();
    });
    // Filter tab for "All" should be present
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders Initiate Release button', async () => {
    render(<ReleasesPage />);
    await waitFor(() => {
      expect(screen.getByText('Initiate Release')).toBeInTheDocument();
    });
  });
});
