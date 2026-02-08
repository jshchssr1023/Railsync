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

const mockGetUserTrainingProgress = jest.fn();
const mockStartTrainingModule = jest.fn();
const mockCompleteTrainingModule = jest.fn();
const mockGetUserCertifications = jest.fn();

jest.mock('@/lib/api', () => ({
  getUserTrainingProgress: (...args: unknown[]) => mockGetUserTrainingProgress(...args),
  startTrainingModule: (...args: unknown[]) => mockStartTrainingModule(...args),
  completeTrainingModule: (...args: unknown[]) => mockCompleteTrainingModule(...args),
  getUserCertifications: (...args: unknown[]) => mockGetUserCertifications(...args),
}));

import TrainingPage from '@/app/(documentation)/training/page';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockGetUserTrainingProgress.mockResolvedValue({});
  mockGetUserCertifications.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrainingPage', () => {
  it('renders header', async () => {
    render(<TrainingPage />);
    await waitFor(() => {
      expect(screen.getByText('Training Center')).toBeInTheDocument();
    });
  });
});
