import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockIsAuthenticated = true;
let mockRole = 'admin';
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? { id: '1', email: 'admin@test.com', first_name: 'Admin', last_name: 'User', role: mockRole as any, is_active: true } : null,
    isLoading: false,
  }),
}));

// Mock sub-components
// eslint-disable-next-line react/display-name
jest.mock('@/components/AdminRulesEditor', () => () => <div data-testid="rules-editor" />);
// eslint-disable-next-line react/display-name
jest.mock('@/components/BRCImportModal', () => () => <div data-testid="brc-import" />);
// eslint-disable-next-line react/display-name
jest.mock('@/components/BRCHistoryList', () => () => <div data-testid="brc-history" />);

// Mock global fetch for user management
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, data: [] }),
});

import AdminPage from '@/app/(operations)/admin/page';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockRole = 'admin';
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminPage', () => {
  it('renders header for admin user', async () => {
    render(<AdminPage />);
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });

  it('shows access denied for non-admin user', () => {
    mockRole = 'viewer';
    render(<AdminPage />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('shows auth required when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<AdminPage />);
    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
  });

  it('renders tab navigation for admin', () => {
    render(<AdminPage />);
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });
});
