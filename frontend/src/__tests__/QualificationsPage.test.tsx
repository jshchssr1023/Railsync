import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/qualifications',
  useSearchParams: () => new URLSearchParams(),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/components/Toast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirmDialog({ open, onConfirm, onCancel, title, confirmLabel }: {
    open: boolean; onConfirm: () => void; onCancel: () => void; title: string; confirmLabel?: string;
  }) {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <button onClick={onConfirm}>{confirmLabel || 'Confirm'}</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  };
});

const mockGetQualificationStats = jest.fn();
const mockGetQualificationsDueByMonth = jest.fn();
const mockListQualifications = jest.fn();
const mockListQualificationAlerts = jest.fn();
const mockListQualificationTypes = jest.fn();
const mockRecalculateQualificationStatuses = jest.fn();
const mockGenerateQualificationAlerts = jest.fn();
const mockAcknowledgeQualificationAlert = jest.fn();

jest.mock('@/lib/api', () => ({
  getQualificationStats: (...args: unknown[]) => mockGetQualificationStats(...args),
  getQualificationsDueByMonth: (...args: unknown[]) => mockGetQualificationsDueByMonth(...args),
  listQualifications: (...args: unknown[]) => mockListQualifications(...args),
  listQualificationAlerts: (...args: unknown[]) => mockListQualificationAlerts(...args),
  listQualificationTypes: (...args: unknown[]) => mockListQualificationTypes(...args),
  recalculateQualificationStatuses: (...args: unknown[]) => mockRecalculateQualificationStatuses(...args),
  generateQualificationAlerts: (...args: unknown[]) => mockGenerateQualificationAlerts(...args),
  acknowledgeQualificationAlert: (...args: unknown[]) => mockAcknowledgeQualificationAlert(...args),
}));

import QualificationsPage from '@/app/qualifications/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultStats = {
  total_cars: 500,
  overdue_count: 15,
  due_count: 30,
  due_soon_count: 60,
  current_count: 350,
  exempt_count: 20,
  unknown_count: 25,
  overdue_cars: 15,
  due_cars: 30,
  unacked_alerts: 8,
};

const defaultDueByMonth = [
  { month: '2026-03', count: 12, by_type: [{ type_code: 'TANK_REQUALIFICATION', type_name: 'Tank Requalification', count: 12 }] },
  { month: '2026-04', count: 8, by_type: [{ type_code: 'AIR_BRAKE', type_name: 'Air Brake', count: 8 }] },
];

const defaultTypes = [
  { id: '1', code: 'TANK_REQUALIFICATION', name: 'Tank Requalification', description: '10-year tank requalification', regulatory_body: 'DOT', default_interval_months: 120, is_active: true },
  { id: '2', code: 'AIR_BRAKE', name: 'Air Brake Test', description: 'Annual air brake test', regulatory_body: 'AAR', default_interval_months: 12, is_active: true },
];

function makeQualification(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    car_id: 'c1',
    qualification_type_id: 't1',
    status: 'current',
    last_completed_date: '2025-01-15',
    next_due_date: '2035-01-15',
    expiry_date: null,
    interval_months: 120,
    completed_by: null,
    completion_shop_code: null,
    certificate_number: null,
    notes: null,
    is_exempt: false,
    exempt_reason: null,
    type_code: 'TANK_REQUALIFICATION',
    type_name: 'Tank Requalification',
    regulatory_body: 'DOT',
    car_number: 'GATX 10001',
    car_mark: 'GATX',
    lessee_name: 'Acme Corp',
    lessee_code: 'ACME',
    current_region: 'NE',
    ...overrides,
  };
}

function makeAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    qualification_id: 'q1',
    car_id: 'c1',
    qualification_type_id: 't1',
    alert_type: 'warning_30',
    alert_date: '2026-02-01',
    due_date: '2026-03-01',
    days_until_due: 23,
    is_acknowledged: false,
    acknowledged_by: null,
    acknowledged_at: null,
    created_at: '2026-02-01T00:00:00Z',
    car_number: 'GATX 10001',
    car_mark: 'GATX',
    type_name: 'Tank Requalification',
    type_code: 'TANK_REQUALIFICATION',
    lessee_name: 'Acme Corp',
    ...overrides,
  };
}

function mockDefaultResponses(overrides: {
  stats?: typeof defaultStats | null;
  dueByMonth?: typeof defaultDueByMonth;
  types?: typeof defaultTypes;
  qualifications?: { qualifications: ReturnType<typeof makeQualification>[]; total: number };
  alerts?: { alerts: ReturnType<typeof makeAlert>[]; total: number };
} = {}) {
  mockGetQualificationStats.mockResolvedValue(overrides.stats ?? defaultStats);
  mockGetQualificationsDueByMonth.mockResolvedValue(overrides.dueByMonth ?? defaultDueByMonth);
  mockListQualificationTypes.mockResolvedValue(overrides.types ?? defaultTypes);
  mockListQualifications.mockResolvedValue(overrides.qualifications ?? { qualifications: [], total: 0 });
  mockListQualificationAlerts.mockResolvedValue(overrides.alerts ?? { alerts: [], total: 0 });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDefaultResponses();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QualificationsPage', () => {
  it('renders the header and subheader', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Qualifications')).toBeInTheDocument();
    });
    expect(screen.getByText('Fleet-wide qualification tracking and compliance')).toBeInTheDocument();
  });

  it('renders admin action buttons', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Recalculate')).toBeInTheDocument();
    });
    expect(screen.getByText('Generate Alerts')).toBeInTheDocument();
  });

  it('renders KPI cards with stats data', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      // "Overdue" appears in both KPI card and status distribution
      expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1);
    });
    // "15" appears in both KPI card and status distribution
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Due (<30d)')).toBeInTheDocument();
    // "30" appears in KPI card; distribution shows "Due (<30 days)"
    expect(screen.getAllByText('30').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Due Soon (90d)')).toBeInTheDocument();
    // "60" appears in KPI card
    expect(screen.getAllByText('60').length).toBeGreaterThanOrEqual(1);
    // "Current" appears in both KPI card and status distribution
    expect(screen.getAllByText('Current').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('350').length).toBeGreaterThanOrEqual(1);
    // "Exempt" appears in both KPI card and distribution
    expect(screen.getAllByText('Exempt').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Open Alerts')).toBeInTheDocument();
  });

  it('renders tab bar with three tabs', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    // Qualification list tab includes count like "All Qualifications (0)"
    expect(screen.getByText(/All Qualifications \(/)).toBeInTheDocument();
    // Alerts tab includes count like "Alerts (0)"
    expect(screen.getByText(/^Alerts \(/)).toBeInTheDocument();
  });

  // Overview Tab Tests
  it('renders due-by-month chart on overview tab', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Due By Month (Next 12 Months)')).toBeInTheDocument();
    });
    expect(screen.getByText('2026-03')).toBeInTheDocument();
    expect(screen.getByText('2026-04')).toBeInTheDocument();
  });

  it('shows empty chart message when no due-by-month data', async () => {
    mockDefaultResponses({ dueByMonth: [] });
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('No qualifications due in the next 12 months')).toBeInTheDocument();
    });
  });

  it('renders status distribution section', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Status Distribution')).toBeInTheDocument();
    });
    // Distribution labels
    expect(screen.getByText('Due (<30 days)')).toBeInTheDocument();
    expect(screen.getByText('Due Soon (90 days)')).toBeInTheDocument();
  });

  it('renders qualification types table', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Qualification Types')).toBeInTheDocument();
    });
    expect(screen.getByText('Tank Requalification')).toBeInTheDocument();
    expect(screen.getByText('Air Brake Test')).toBeInTheDocument();
    expect(screen.getByText('DOT')).toBeInTheDocument();
    expect(screen.getByText('AAR')).toBeInTheDocument();
    expect(screen.getByText('120 months')).toBeInTheDocument();
    expect(screen.getByText('12 months')).toBeInTheDocument();
  });

  // List Tab Tests
  it('shows list tab when clicked', async () => {
    mockDefaultResponses({
      qualifications: {
        qualifications: [makeQualification()],
        total: 1,
      },
    });

    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/All Qualifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/All Qualifications/));
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });
  });

  it('renders list table columns', async () => {
    mockDefaultResponses({
      qualifications: {
        qualifications: [makeQualification()],
        total: 1,
      },
    });

    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/All Qualifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/All Qualifications/));
    await waitFor(() => {
      expect(screen.getByText('Car')).toBeInTheDocument();
    });
    expect(screen.getByText('Next Due')).toBeInTheDocument();
    expect(screen.getByText('Last Completed')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('Regulatory')).toBeInTheDocument();
  });

  it('shows empty state when no qualifications', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/All Qualifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/All Qualifications/));
    await waitFor(() => {
      expect(screen.getByText('No qualifications found')).toBeInTheDocument();
    });
  });

  it('shows filter-specific empty state when filters active', async () => {
    mockDefaultResponses({
      qualifications: { qualifications: [], total: 0 },
    });

    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/All Qualifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/All Qualifications/));
    await waitFor(() => {
      expect(screen.getByText('No qualifications found')).toBeInTheDocument();
    });

    // Select a status filter
    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'overdue' } });

    await waitFor(() => {
      expect(screen.getByText('No qualifications match the current filters')).toBeInTheDocument();
    });
  });

  it('renders qualification data in list rows', async () => {
    mockDefaultResponses({
      qualifications: {
        qualifications: [
          makeQualification({ id: '1', car_number: 'GATX 10001', lessee_name: 'Acme Corp', current_region: 'NE', status: 'overdue' }),
          makeQualification({ id: '2', car_number: 'GATX 20002', lessee_name: 'Beta Inc', current_region: 'SE', status: 'current', type_name: 'Air Brake Test', regulatory_body: 'AAR' }),
        ],
        total: 2,
      },
    });

    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/All Qualifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/All Qualifications/));
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });
    expect(screen.getByText('GATX 20002')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('navigates to car search on row click', async () => {
    mockDefaultResponses({
      qualifications: {
        qualifications: [makeQualification({ car_number: 'GATX 10001' })],
        total: 1,
      },
    });

    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/All Qualifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/All Qualifications/));
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('GATX 10001'));
    expect(mockPush).toHaveBeenCalledWith('/cars?search=GATX 10001');
  });

  it('shows list filters with status, type, and region', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/All Qualifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/All Qualifications/));
    await waitFor(() => {
      expect(screen.getByText('Filters:')).toBeInTheDocument();
    });
    // Two comboboxes (status + type) and one text input (region)
    expect(screen.getAllByRole('combobox').length).toBe(2);
    expect(screen.getByPlaceholderText('Region...')).toBeInTheDocument();
  });

  it('calls API with status filter when changed', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/All Qualifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/All Qualifications/));
    await waitFor(() => {
      expect(screen.getAllByRole('combobox').length).toBe(2);
    });

    mockListQualifications.mockClear();
    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'overdue' } });

    await waitFor(() => {
      expect(mockListQualifications).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'overdue' })
      );
    });
  });

  it('shows and hides Clear filters button', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/All Qualifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/All Qualifications/));
    await waitFor(() => {
      expect(screen.getAllByRole('combobox').length).toBe(2);
    });

    // No clear button initially
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();

    // Select a filter
    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'overdue' } });

    await waitFor(() => {
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });
  });

  // Alerts Tab Tests
  it('shows alerts tab with alert data', async () => {
    mockDefaultResponses({
      alerts: {
        alerts: [
          makeAlert({ id: 'a1', alert_type: 'warning_30', car_number: 'GATX 10001', type_name: 'Tank Requalification', days_until_due: 23 }),
        ],
        total: 1,
      },
    });

    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/^Alerts \(/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/^Alerts \(/));
    await waitFor(() => {
      expect(screen.getByText('30-Day')).toBeInTheDocument();
    });
    expect(screen.getByText('23d')).toBeInTheDocument();
    expect(screen.getByText('Acknowledge')).toBeInTheDocument();
  });

  it('shows overdue badge for overdue alerts', async () => {
    mockDefaultResponses({
      alerts: {
        alerts: [
          makeAlert({ id: 'a1', alert_type: 'overdue', days_until_due: -10 }),
        ],
        total: 1,
      },
    });

    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/^Alerts \(/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/^Alerts \(/));
    await waitFor(() => {
      expect(screen.getByText('OVERDUE')).toBeInTheDocument();
    });
    expect(screen.getByText('10d overdue')).toBeInTheDocument();
  });

  it('shows empty alert state when no unacknowledged alerts', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/^Alerts \(/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/^Alerts \(/));
    await waitFor(() => {
      expect(screen.getByText('No unacknowledged alerts')).toBeInTheDocument();
    });
  });

  it('optimistically removes alert on acknowledge click', async () => {
    mockAcknowledgeQualificationAlert.mockResolvedValue({});
    mockDefaultResponses({
      alerts: {
        alerts: [
          makeAlert({ id: 'a1', car_number: 'GATX 10001' }),
          makeAlert({ id: 'a2', car_number: 'GATX 20002' }),
        ],
        total: 2,
      },
    });

    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/^Alerts \(/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/^Alerts \(/));
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });

    // Click acknowledge on first alert
    const ackButtons = screen.getAllByText('Acknowledge');
    fireEvent.click(ackButtons[0]);

    // The alert should be optimistically removed
    await waitFor(() => {
      expect(mockAcknowledgeQualificationAlert).toHaveBeenCalledWith('a1');
    });
    expect(mockToast.success).toHaveBeenCalledWith('Alert acknowledged');
  });

  // Admin Actions Tests
  it('opens recalculate confirmation dialog', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Recalculate')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Recalculate'));
    await waitFor(() => {
      expect(screen.getByText('Recalculate All Qualification Statuses')).toBeInTheDocument();
    });
    expect(screen.getByText('Recalculate Fleet')).toBeInTheDocument();
  });

  it('executes recalculate on confirm', async () => {
    mockRecalculateQualificationStatuses.mockResolvedValue({ updated: 42 });
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Recalculate')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Recalculate'));
    await waitFor(() => {
      expect(screen.getByText('Recalculate Fleet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Recalculate Fleet'));
    await waitFor(() => {
      expect(mockRecalculateQualificationStatuses).toHaveBeenCalled();
    });
    expect(mockToast.success).toHaveBeenCalledWith('Recalculated statuses: 42 updated');
  });

  it('opens generate alerts confirmation dialog', async () => {
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Generate Alerts')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Generate Alerts'));
    await waitFor(() => {
      expect(screen.getByText('Generate Qualification Alerts')).toBeInTheDocument();
    });
  });

  it('executes generate alerts on confirm', async () => {
    mockGenerateQualificationAlerts.mockResolvedValue({ created: 17 });
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Generate Alerts')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Generate Alerts'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    // Use within to scope to the confirm dialog (avoids ambiguity with header button)
    const dialog = screen.getByTestId('confirm-dialog');
    fireEvent.click(within(dialog).getByText('Generate Alerts'));
    await waitFor(() => {
      expect(mockGenerateQualificationAlerts).toHaveBeenCalled();
    });
    expect(mockToast.success).toHaveBeenCalledWith('Generated 17 new alerts');
  });

  // Error handling
  it('shows error banner when overview load fails', async () => {
    mockGetQualificationStats.mockRejectedValue(new Error('Server error'));
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load qualification overview data')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows error banner when list load fails', async () => {
    mockListQualifications.mockRejectedValue(new Error('Network error'));
    render(<QualificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/All Qualifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/All Qualifications/));
    await waitFor(() => {
      expect(screen.getByText('Failed to load qualifications')).toBeInTheDocument();
    });
  });
});
