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
    getAccessToken: () => 'test-token',
  }),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/components/Toast', () => ({
  useToast: () => mockToast,
}));

const mockPush = jest.fn();
const mockGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

// Mock global fetch
const mockFetch = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

import InvoiceCasesPage from '@/app/(operations)/invoice-cases/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCase(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    case_number: 'CASE-001',
    invoice_type: 'SHOP',
    workflow_state: 'RECEIVED',
    vendor_name: 'ABC Railcar',
    shop_code: 'SH01',
    invoice_number: 'INV-001',
    invoice_date: '2026-01-15',
    total_amount: 5000,
    currency: 'USD',
    assigned_admin_id: null,
    assigned_admin_name: null,
    assigned_admin_email: null,
    received_at: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

function mockDefaultFetch(
  cases: ReturnType<typeof makeCase>[] = [],
  total = 0,
  stateStats: unknown[] = [],
) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/invoice-cases/by-state')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: stateStats }),
      });
    }
    if (url.includes('/invoice-cases')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: cases, pagination: { total } }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockDefaultFetch();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvoiceCasesPage', () => {
  it('shows sign-in message when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<InvoiceCasesPage />);
    expect(screen.getByText('Please log in to view the case queue.')).toBeInTheDocument();
  });

  it('renders header and subheader', async () => {
    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('Case Queue')).toBeInTheDocument();
    });
    expect(screen.getByText('Invoice case workflow management')).toBeInTheDocument();
  });

  it('renders New Case button', async () => {
    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('New Case')).toBeInTheDocument();
    });
  });

  it('renders stat cards', async () => {
    mockDefaultFetch([], 0, [
      { state: 'RECEIVED', count: 5, total_amount: 10000 },
      { state: 'ASSIGNED', count: 3, total_amount: 8000 },
      { state: 'BLOCKED', count: 2, total_amount: 4000 },
    ]);

    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('Total Open')).toBeInTheDocument();
    });
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getAllByText('Blocked').length).toBeGreaterThanOrEqual(1);
    // "My Cases" appears in both stat card and filter button
    expect(screen.getAllByText('My Cases').length).toBeGreaterThanOrEqual(1);
  });

  it('renders search bar', async () => {
    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search case #, invoice #, vendor...')).toBeInTheDocument();
    });
  });

  it('renders filter inputs', async () => {
    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('Workflow State')).toBeInTheDocument();
    });
    expect(screen.getByText('Invoice Type')).toBeInTheDocument();
    expect(screen.getByText('From Date')).toBeInTheDocument();
    expect(screen.getByText('To Date')).toBeInTheDocument();
  });

  it('renders empty state when no cases (no filters)', async () => {
    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('No invoice cases yet')).toBeInTheDocument();
    });
    expect(screen.getByText('Create one to get started.')).toBeInTheDocument();
  });

  it('renders table columns when cases exist', async () => {
    mockDefaultFetch([makeCase()], 1);

    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('Case #')).toBeInTheDocument();
    });
    expect(screen.getByText('State')).toBeInTheDocument();
    // "Type" appears in column header AND filter label
    expect(screen.getAllByText(/^Type$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Vendor')).toBeInTheDocument();
    expect(screen.getByText('Invoice #')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Assigned To')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('renders case data in table rows', async () => {
    mockDefaultFetch([
      makeCase({ id: '1', case_number: 'CASE-001', vendor_name: 'ABC Railcar', workflow_state: 'RECEIVED' }),
      makeCase({ id: '2', case_number: 'CASE-002', vendor_name: 'XYZ Repair', workflow_state: 'ASSIGNED', invoice_type: 'MRU' }),
    ], 2);

    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('CASE-001')).toBeInTheDocument();
    });
    expect(screen.getByText('CASE-002')).toBeInTheDocument();
    expect(screen.getByText('ABC Railcar')).toBeInTheDocument();
    expect(screen.getByText('XYZ Repair')).toBeInTheDocument();
    expect(screen.getAllByText('Received').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Assigned').length).toBeGreaterThanOrEqual(1);
  });

  it('shows unassigned label for cases without assigned admin', async () => {
    mockDefaultFetch([makeCase({ id: '1', assigned_admin_name: null })], 1);

    render(<InvoiceCasesPage />);
    await waitFor(() => {
      // "Unassigned" appears in stat card AND table cell
      expect(screen.getAllByText('Unassigned').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to case detail on row click', async () => {
    mockDefaultFetch([makeCase({ id: 'case-42' })], 1);

    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('CASE-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('CASE-001'));
    expect(mockPush).toHaveBeenCalledWith('/invoice-cases/case-42');
  });

  it('shows Clear All Filters when filters are active', async () => {
    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search case #, invoice #, vendor...')).toBeInTheDocument();
    });

    expect(screen.queryByText('Clear All Filters')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search case #, invoice #, vendor...'), { target: { value: 'test' } });
    expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
  });

  it('shows and hides create modal', async () => {
    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('New Case')).toBeInTheDocument();
    });

    // Modal not visible initially
    expect(screen.queryByText('Create Invoice Case')).not.toBeInTheDocument();

    // Open modal
    fireEvent.click(screen.getByText('New Case'));
    expect(screen.getByText('Create Invoice Case')).toBeInTheDocument();
    expect(screen.getByText('Invoice Type *')).toBeInTheDocument();
    expect(screen.getByText('Vendor Name')).toBeInTheDocument();
    // "Create Case" appears in both EmptyState button and modal button
    expect(screen.getAllByText('Create Case').length).toBeGreaterThanOrEqual(1);

    // Close modal
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Create Invoice Case')).not.toBeInTheDocument();
  });

  it('shows SHOP and MRU type options in create modal', async () => {
    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('New Case')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Case'));
    expect(screen.getByText('Shop Invoice')).toBeInTheDocument();
    expect(screen.getByText('Mobile Repair Unit')).toBeInTheDocument();
  });

  it('shows special lessee warning for EXXON', async () => {
    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('New Case')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Case'));
    const lesseeInput = screen.getByPlaceholderText('e.g. GATX');
    fireEvent.change(lesseeInput, { target: { value: 'EXXON' } });
    expect(screen.getByText(/Special lessee detected/)).toBeInTheDocument();
  });

  it('renders pagination when total exceeds page size', async () => {
    mockDefaultFetch(
      Array.from({ length: 25 }, (_, i) => makeCase({ id: String(i), case_number: `CASE-${i}` })),
      60,
    );

    render(<InvoiceCasesPage />);
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 to 25 of 60/)).toBeInTheDocument();
  });
});
