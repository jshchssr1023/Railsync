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

global.fetch = jest.fn();

import ReportsPage from '@/app/reports/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl_1',
    name: 'Fleet Status Report',
    description: 'Current status of all cars',
    category: 'fleet',
    available_columns: [
      { key: 'car_number', label: 'Car Number', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'cost', label: 'Cost', type: 'currency' },
    ],
    available_filters: [
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
    ],
    default_columns: ['car_number', 'status'],
    ...overrides,
  };
}

function makeSavedReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'saved_1',
    template_id: 'tpl_1',
    name: 'Monthly Fleet Report',
    description: 'Standard monthly report',
    columns: ['car_number', 'status'],
    filters: {},
    sort_by: null,
    sort_dir: 'ASC',
    is_scheduled: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockFetchSuccess(endpoint: string, data: any) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes(endpoint)) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data }),
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
  mockFetchSuccess('templates', []);
  mockFetchSuccess('saved', []);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReportsPage', () => {
  it('renders header and subheader', async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('Report Builder')).toBeInTheDocument();
    });
    expect(screen.getByText('Build, run, and export custom reports from your data')).toBeInTheDocument();
  });

  it('renders tab buttons', async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('Build Report')).toBeInTheDocument();
    });
    expect(screen.getByText(/Saved \(\d+\)/)).toBeInTheDocument();
  });

  it('displays templates section', async () => {
    mockFetchSuccess('templates', [makeTemplate()]);

    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('Templates')).toBeInTheDocument();
    });
  });

  it('displays template list', async () => {
    mockFetchSuccess('templates', [
      makeTemplate({ id: 'tpl_1', name: 'Fleet Status Report', category: 'fleet' }),
      makeTemplate({ id: 'tpl_2', name: 'Billing Summary', category: 'billing' }),
    ]);

    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('Fleet Status Report')).toBeInTheDocument();
    });
    expect(screen.getByText('Billing Summary')).toBeInTheDocument();
  });

  it('shows empty state when no template selected', async () => {
    mockFetchSuccess('templates', [makeTemplate()]);

    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('Select a template to start building a report')).toBeInTheDocument();
    });
  });

  it('displays column selector when template selected', async () => {
    mockFetchSuccess('templates', [makeTemplate()]);

    render(<ReportsPage />);
    const template = await screen.findByText('Fleet Status Report');
    fireEvent.click(template);

    await waitFor(() => {
      expect(screen.getByText('Columns')).toBeInTheDocument();
    });
    expect(screen.getByText('Car Number')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
  });

  it('displays filters section when template has filters', async () => {
    mockFetchSuccess('templates', [makeTemplate()]);

    render(<ReportsPage />);
    const template = await screen.findByText('Fleet Status Report');
    fireEvent.click(template);

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });
  });

  it('displays sort section when template selected', async () => {
    mockFetchSuccess('templates', [makeTemplate()]);

    render(<ReportsPage />);
    const template = await screen.findByText('Fleet Status Report');
    fireEvent.click(template);

    await waitFor(() => {
      expect(screen.getByText('Sort')).toBeInTheDocument();
    });
  });

  it('displays run report button when template selected', async () => {
    mockFetchSuccess('templates', [makeTemplate()]);

    render(<ReportsPage />);
    const template = await screen.findByText('Fleet Status Report');
    fireEvent.click(template);

    await waitFor(() => {
      expect(screen.getByText('Run Report')).toBeInTheDocument();
    });
  });

  it('switches to saved reports tab', async () => {
    mockFetchSuccess('saved', [makeSavedReport()]);

    render(<ReportsPage />);
    const savedTab = await screen.findByText(/Saved \(\d+\)/);
    fireEvent.click(savedTab);

    await waitFor(() => {
      expect(screen.getByText('Monthly Fleet Report')).toBeInTheDocument();
    });
  });

  it('shows empty state on saved tab when no reports', async () => {
    render(<ReportsPage />);
    const savedTab = await screen.findByText(/Saved \(\d+\)/);
    fireEvent.click(savedTab);

    await waitFor(() => {
      expect(screen.getByText('No saved reports yet')).toBeInTheDocument();
    });
  });

  it('displays export and save buttons after running report', async () => {
    mockFetchSuccess('templates', [makeTemplate()]);
    mockFetchSuccess('run', {
      columns: [{ key: 'car_number', label: 'Car Number', type: 'text' }],
      rows: [{ car_number: 'GATX 10001' }],
      total: 1,
      generated_at: '2026-02-06T12:00:00Z',
    });

    render(<ReportsPage />);
    const template = await screen.findByText('Fleet Status Report');
    fireEvent.click(template);

    const runButton = await screen.findByText('Run Report');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });
    expect(screen.getByText('Save Report')).toBeInTheDocument();
  });

  it('toggles column checkbox when clicked', async () => {
    mockFetchSuccess('templates', [makeTemplate()]);

    render(<ReportsPage />);
    const template = await screen.findByText('Fleet Status Report');
    fireEvent.click(template);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(firstCheckbox);
  });

  it('shows running state when report is generating', async () => {
    mockFetchSuccess('templates', [makeTemplate()]);
    (global.fetch as jest.Mock).mockImplementationOnce((url: string) => {
      if (url.includes('run')) {
        return new Promise(() => {});
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [makeTemplate()] }),
      });
    });

    render(<ReportsPage />);
    const template = await screen.findByText('Fleet Status Report');
    fireEvent.click(template);

    const runButton = await screen.findByText('Run Report');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('Generating report...')).toBeInTheDocument();
    });
  });

  it('displays result table after running report', async () => {
    mockFetchSuccess('templates', [makeTemplate()]);

    const mockResult = {
      columns: [
        { key: 'car_number', label: 'Car Number', type: 'text' },
        { key: 'status', label: 'Status', type: 'text' },
      ],
      rows: [
        { car_number: 'GATX 10001', status: 'Active' },
        { car_number: 'GATX 10002', status: 'Inactive' },
      ],
      total: 2,
      generated_at: '2026-02-06T12:00:00Z',
    };

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('run')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockResult }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [makeTemplate()] }),
      });
    });

    render(<ReportsPage />);
    const template = await screen.findByText('Fleet Status Report');
    fireEvent.click(template);

    const runButton = await screen.findByText('Run Report');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });
    expect(screen.getByText('GATX 10002')).toBeInTheDocument();
  });
});
