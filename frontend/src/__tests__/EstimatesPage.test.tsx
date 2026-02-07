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

const mockGetEstimate = jest.fn();
const mockGetEstimateDecisions = jest.fn();
const mockUpdateEstimateStatus = jest.fn();
const mockGenerateApprovalPacket = jest.fn();
const mockRunEstimatePreReview = jest.fn();

jest.mock('@/lib/api', () => ({
  getEstimate: (...args: unknown[]) => mockGetEstimate(...args),
  getEstimateDecisions: (...args: unknown[]) => mockGetEstimateDecisions(...args),
  updateEstimateStatus: (...args: unknown[]) => mockUpdateEstimateStatus(...args),
  generateApprovalPacket: (...args: unknown[]) => mockGenerateApprovalPacket(...args),
  runEstimatePreReview: (...args: unknown[]) => mockRunEstimatePreReview(...args),
}));

// Also mock global fetch since the page uses direct fetch for shopping-events
global.fetch = jest.fn();

import EstimatesPage from '@/app/estimates/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess(data: any = []) {
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

describe('EstimatesPage', () => {
  it('renders header', async () => {
    render(<EstimatesPage />);
    await waitFor(() => {
      expect(screen.getByText('Estimate Review')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<EstimatesPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows empty state when no estimates', async () => {
    render(<EstimatesPage />);
    await waitFor(() => {
      expect(screen.getByText(/No estimates found/)).toBeInTheDocument();
    });
  });

  it('displays estimates when shopping events have estimates', async () => {
    // Mock shopping-events endpoint to return events with estimate statuses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/shopping-events') && !url.includes('/estimates')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'se_1', car_number: 'GATX 10001', shop_code: 'SHP1', status: 'estimate_received' },
            ],
          }),
        });
      }
      if (url.includes('/estimates')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'est_1',
                version_number: 1,
                total_labor_hours: 12,
                total_material_cost: 5000,
                total_cost: 15000,
                status: 'submitted',
                submitted_at: '2026-02-01T00:00:00Z',
                line_items: [],
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });
    });

    render(<EstimatesPage />);
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });
  });

  it('fetches shopping events on mount', async () => {
    render(<EstimatesPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
