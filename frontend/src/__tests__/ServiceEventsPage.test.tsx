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

const mockListServiceEvents = jest.fn();
const mockCreateServiceEvent = jest.fn();
const mockUpdateServiceEventStatus = jest.fn();

jest.mock('@/lib/api', () => ({
  listServiceEvents: (...args: unknown[]) => mockListServiceEvents(...args),
  createServiceEvent: (...args: unknown[]) => mockCreateServiceEvent(...args),
  updateServiceEventStatus: (...args: unknown[]) => mockUpdateServiceEventStatus(...args),
}));

import ServiceEventsPage from '@/app/service-events/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'evt_1',
    car_number: 'GATX 10001',
    event_type: 'Qualification',
    status: 'requested',
    requested_date: '2026-02-01',
    assigned_shop: 'SHP1',
    scheduled_date: null,
    completed_date: null,
    created_at: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockListServiceEvents.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ServiceEventsPage', () => {
  it('renders header and subheader', async () => {
    render(<ServiceEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('Service Events')).toBeInTheDocument();
    });
    expect(screen.getByText('Schedule and track car service events across the fleet')).toBeInTheDocument();
  });

  it('renders New Event button', async () => {
    render(<ServiceEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('New Event')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockListServiceEvents.mockImplementation(() => new Promise(() => {}));
    render(<ServiceEventsPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays events table with data', async () => {
    mockListServiceEvents.mockResolvedValue([
      makeEvent({ event_id: 'evt_1', car_number: 'GATX 10001', status: 'requested' }),
      makeEvent({ event_id: 'evt_2', car_number: 'UTLX 20001', status: 'completed' }),
    ]);

    render(<ServiceEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });
    expect(screen.getByText('UTLX 20001')).toBeInTheDocument();
  });

  it('shows empty state when no events', async () => {
    render(<ServiceEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('No service events found')).toBeInTheDocument();
    });
  });

  it('opens create form when New Event clicked', async () => {
    render(<ServiceEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('New Event')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Event'));
    await waitFor(() => {
      expect(screen.getByText('Create Service Event')).toBeInTheDocument();
    });
  });

  it('calls listServiceEvents on mount', async () => {
    render(<ServiceEventsPage />);
    await waitFor(() => {
      expect(mockListServiceEvents).toHaveBeenCalled();
    });
  });

  it('renders status filter buttons', async () => {
    render(<ServiceEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('Service Events')).toBeInTheDocument();
    });
    // Status filter select or buttons should exist
    const allOption = screen.getByText('All');
    expect(allOption).toBeInTheDocument();
  });
});
