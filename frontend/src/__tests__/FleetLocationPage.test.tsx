import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCarLocations = jest.fn();
const mockSyncCLMLocations = jest.fn();

jest.mock('@/lib/api', () => ({
  getCarLocations: (...args: unknown[]) => mockGetCarLocations(...args),
  syncCLMLocations: (...args: unknown[]) => mockSyncCLMLocations(...args),
}));

// Mock Toast context
jest.mock('@/components/Toast', () => ({
  useToast: () => ({
    addToast: jest.fn(),
  }),
}));

import FleetLocationPage from '@/app/fleet-location/page';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCarLocations.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FleetLocationPage', () => {
  it('renders header', async () => {
    render(<FleetLocationPage />);
    await waitFor(() => {
      expect(screen.getByText('Fleet Location')).toBeInTheDocument();
    });
  });

  it('shows empty state when no locations', async () => {
    render(<FleetLocationPage />);
    await waitFor(() => {
      expect(screen.getByText('No car locations found')).toBeInTheDocument();
    });
  });

  it('calls getCarLocations on mount', async () => {
    render(<FleetLocationPage />);
    await waitFor(() => {
      expect(mockGetCarLocations).toHaveBeenCalled();
    });
  });
});
