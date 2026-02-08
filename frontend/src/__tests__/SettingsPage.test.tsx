import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockIsAuthenticated = true;
let mockUserRole = 'admin';

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? {
      id: '1',
      email: 'admin@test.com',
      first_name: 'Admin',
      last_name: 'User',
      role: mockUserRole,
      is_active: true
    } : null,
    isLoading: false,
  }),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/components/Toast', () => ({
  useToast: () => mockToast,
}));

global.fetch = jest.fn();

import SettingsPage from '@/app/(operations)/settings/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess(data: any) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data }),
  });
}

const defaultPreferences = {
  user_id: '1',
  email_bad_orders: true,
  email_capacity_warnings: true,
  email_allocation_updates: false,
  email_daily_digest: true,
  email_project_lock_changes: true,
  email_project_bundling_alerts: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockUserRole = 'admin';
  mockFetchSuccess(defaultPreferences);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsPage', () => {
  it('shows sign-in message when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<SettingsPage />);
    expect(screen.getByText('Please sign in to access settings.')).toBeInTheDocument();
  });

  it('renders header and subheader', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    expect(screen.getByText('Manage your account and notification preferences')).toBeInTheDocument();
  });

  it('displays account section with user info', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument();
    });
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('displays email notifications section', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });
    expect(screen.getByText('Choose which email notifications you would like to receive.')).toBeInTheDocument();
  });

  it('renders all notification preference options', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Bad Order Alerts')).toBeInTheDocument();
    });
    expect(screen.getByText('Capacity Warnings')).toBeInTheDocument();
    expect(screen.getByText('Allocation Updates')).toBeInTheDocument();
    expect(screen.getByText('Daily Digest')).toBeInTheDocument();
    expect(screen.getByText('Project Lock Changes')).toBeInTheDocument();
    expect(screen.getByText('Project Bundling Alerts')).toBeInTheDocument();
  });

  it('displays checkbox states based on preferences', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(6);
    });
  });

  it('renders save preferences button', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Loading preferences...')).toBeInTheDocument();
    });
  });

  it('toggles checkbox when clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Bad Order Alerts')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    const badOrderCheckbox = checkboxes[0];

    expect(badOrderCheckbox).toBeChecked();
    fireEvent.click(badOrderCheckbox);
    expect(badOrderCheckbox).not.toBeChecked();
  });

  it('saves preferences when save button clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/preferences'),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  it('shows success message after saving', async () => {
    render(<SettingsPage />);
    const saveButton = await screen.findByText('Save Preferences');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Preferences saved successfully')).toBeInTheDocument();
    });
  });

  it('displays email queue section for admin users', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Email Queue (Admin)')).toBeInTheDocument();
    });
  });

  it('does not show email queue for non-admin users', async () => {
    mockUserRole = 'viewer';
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.queryByText('Email Queue (Admin)')).not.toBeInTheDocument();
    });
  });

  it('displays queue status cards for admin', async () => {
    mockFetchSuccess({ pending: 5, sent_today: 20, failed_today: 1 });
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
    expect(screen.getByText('Sent Today')).toBeInTheDocument();
    expect(screen.getByText('Failed Today')).toBeInTheDocument();
  });

  it('renders refresh and process queue buttons for admin', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
    expect(screen.getByText('Process Queue')).toBeInTheDocument();
  });
});
