import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetIntegrationStatuses = jest.fn();
const mockGetIntegrationSyncLog = jest.fn();
const mockGetIntegrationSyncStats = jest.fn();
const mockRetryIntegrationSync = jest.fn();
const mockSapBatchPush = jest.fn();
const mockSfFullSync = jest.fn();
const mockCheckSAPConnection = jest.fn();
const mockCheckSFConnection = jest.fn();
const mockGetIntegrationHealthDashboard = jest.fn();
const mockGetIntegrationErrorTrends = jest.fn();
const mockGetRetryQueue = jest.fn();
const mockDismissRetryItem = jest.fn();
const mockGetScheduledJobs = jest.fn();
const mockToggleScheduledJob = jest.fn();

jest.mock('@/lib/api', () => ({
  getIntegrationStatuses: (...args: unknown[]) => mockGetIntegrationStatuses(...args),
  getIntegrationSyncLog: (...args: unknown[]) => mockGetIntegrationSyncLog(...args),
  getIntegrationSyncStats: (...args: unknown[]) => mockGetIntegrationSyncStats(...args),
  retryIntegrationSync: (...args: unknown[]) => mockRetryIntegrationSync(...args),
  sapBatchPush: (...args: unknown[]) => mockSapBatchPush(...args),
  sfFullSync: (...args: unknown[]) => mockSfFullSync(...args),
  checkSAPConnection: (...args: unknown[]) => mockCheckSAPConnection(...args),
  checkSFConnection: (...args: unknown[]) => mockCheckSFConnection(...args),
  getIntegrationHealthDashboard: (...args: unknown[]) => mockGetIntegrationHealthDashboard(...args),
  getIntegrationErrorTrends: (...args: unknown[]) => mockGetIntegrationErrorTrends(...args),
  getRetryQueue: (...args: unknown[]) => mockGetRetryQueue(...args),
  dismissRetryItem: (...args: unknown[]) => mockDismissRetryItem(...args),
  getScheduledJobs: (...args: unknown[]) => mockGetScheduledJobs(...args),
  toggleScheduledJob: (...args: unknown[]) => mockToggleScheduledJob(...args),
}));

// Mock Toast context
jest.mock('@/components/Toast', () => ({
  useToast: () => ({
    addToast: jest.fn(),
  }),
}));

import IntegrationsPage from '@/app/(operations)/integrations/page';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockGetIntegrationStatuses.mockResolvedValue([]);
  mockGetIntegrationSyncLog.mockResolvedValue([]);
  mockGetIntegrationSyncStats.mockResolvedValue([]);
  mockGetIntegrationHealthDashboard.mockResolvedValue(null);
  mockGetIntegrationErrorTrends.mockResolvedValue([]);
  mockGetRetryQueue.mockResolvedValue([]);
  mockGetScheduledJobs.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IntegrationsPage', () => {
  it('renders header', async () => {
    render(<IntegrationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Integrations')).toBeInTheDocument();
    });
  });

  it('calls integration APIs on mount', async () => {
    render(<IntegrationsPage />);
    await waitFor(() => {
      expect(mockGetIntegrationStatuses).toHaveBeenCalled();
    });
  });
});
