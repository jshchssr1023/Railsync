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

const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/components/Toast', () => ({
  useToast: () => mockToast,
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
// Track current search params so that URL-driven filter state works in tests.
// When router.replace is called, we extract the query string and update the
// params that useSearchParams returns.
let currentSearchParams = new URLSearchParams();
mockReplace.mockImplementation((url: string) => {
  const qsIndex = url.indexOf('?');
  currentSearchParams = qsIndex >= 0
    ? new URLSearchParams(url.slice(qsIndex))
    : new URLSearchParams();
});
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => currentSearchParams,
  usePathname: () => '/invoices',
}));

// Mock global fetch
const mockFetch = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

import InvoicesPage from '@/app/invoices/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    invoice_number: 'INV-001',
    vendor_code: 'V001',
    shop_code: 'SH01',
    shop_name: 'Main Shop',
    invoice_date: '2026-01-15',
    received_date: '2026-01-16',
    invoice_total: 12500,
    brc_total: 12000,
    variance_amount: 500,
    variance_pct: 4.17,
    status: 'pending',
    match_count: 3,
    exact_match_count: 2,
    close_match_count: 1,
    unmatched_count: 0,
    ...overrides,
  };
}

function mockDefaultFetch(invoices: ReturnType<typeof makeInvoice>[] = [], total = 0, queueStats: unknown[] = []) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/invoices/approval-queue')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(queueStats),
      });
    }
    if (url.includes('/invoices')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ invoices, total }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  currentSearchParams = new URLSearchParams();
  // Re-attach the implementation after clearAllMocks resets it
  mockReplace.mockImplementation((url: string) => {
    const qsIndex = url.indexOf('?');
    currentSearchParams = qsIndex >= 0
      ? new URLSearchParams(url.slice(qsIndex))
      : new URLSearchParams();
  });
  mockDefaultFetch();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvoicesPage', () => {
  it('shows sign-in message when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<InvoicesPage />);
    expect(screen.getByText('Please log in to view invoices.')).toBeInTheDocument();
  });

  it('renders header and subheader', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Invoice Management')).toBeInTheDocument();
    });
    expect(screen.getByText('Upload, compare, and approve shop invoices')).toBeInTheDocument();
  });

  it('renders Upload Invoice button', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Upload Invoice')).toBeInTheDocument();
    });
  });

  it('renders search bar', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search invoices, vendors, shops...')).toBeInTheDocument();
    });
  });

  it('renders filter inputs', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.getByText('From Date')).toBeInTheDocument();
    expect(screen.getByText('To Date')).toBeInTheDocument();
  });

  it('renders empty state when no invoices', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('No invoices found')).toBeInTheDocument();
    });
    expect(screen.getByText('Upload an invoice to get started.')).toBeInTheDocument();
  });

  it('renders invoice table with data', async () => {
    mockDefaultFetch([
      makeInvoice({ id: '1', invoice_number: 'INV-001', shop_name: 'Main Shop' }),
      makeInvoice({ id: '2', invoice_number: 'INV-002', shop_name: 'West Shop', status: 'approved' }),
    ], 2);

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeInTheDocument();
    });
    expect(screen.getByText('INV-002')).toBeInTheDocument();
    expect(screen.getByText('Main Shop')).toBeInTheDocument();
    expect(screen.getByText('West Shop')).toBeInTheDocument();
  });

  it('renders table column headers', async () => {
    mockDefaultFetch([makeInvoice()], 1);

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Invoice #')).toBeInTheDocument();
    });
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Invoice Total')).toBeInTheDocument();
    expect(screen.getByText('BRC Total')).toBeInTheDocument();
    expect(screen.getByText('Variance')).toBeInTheDocument();
    expect(screen.getByText('Match')).toBeInTheDocument();
  });

  it('renders queue stats cards', async () => {
    mockDefaultFetch([], 0, [
      { status: 'pending', count: 5, total_amount: 25000 },
      { status: 'manual_review', count: 3, total_amount: 15000 },
    ]);

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Manual Review').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Clear All Filters when filters are active', async () => {
    // Pre-populate URL search params so the component renders with an active filter.
    // useURLFilters reads from useSearchParams(), so setting the params before
    // render is equivalent to having a filter-populated URL.
    currentSearchParams = new URLSearchParams('search=test');

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search invoices, vendors, shops...')).toBeInTheDocument();
    });

    // The "search" filter is active via URL params, so Clear All Filters should be visible
    expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
  });

  it('navigates to invoice detail on row click', async () => {
    mockDefaultFetch([makeInvoice({ id: 'inv-42' })], 1);

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('INV-001'));
    expect(mockPush).toHaveBeenCalledWith('/invoices/inv-42');
  });

  it('renders pagination when total exceeds page size', async () => {
    mockDefaultFetch(
      Array.from({ length: 25 }, (_, i) => makeInvoice({ id: String(i), invoice_number: `INV-${i}` })),
      60,
    );

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 to 25 of 60/)).toBeInTheDocument();
  });

  it('does not render pagination when total is within page size', async () => {
    mockDefaultFetch([makeInvoice()], 1);

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeInTheDocument();
    });
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('renders status badge with correct label', async () => {
    mockDefaultFetch([
      makeInvoice({ id: '1', status: 'auto_approved' }),
    ], 1);

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Auto-Approved')).toBeInTheDocument();
    });
  });

  it('renders match counts (exact/close/unmatched)', async () => {
    mockDefaultFetch([
      makeInvoice({ id: '1', exact_match_count: 5, close_match_count: 2, unmatched_count: 1 }),
    ], 1);

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
    // close_match_count = 2, unmatched = 1
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders vendor code under invoice number', async () => {
    mockDefaultFetch([makeInvoice({ id: '1', vendor_code: 'VEND-XYZ' })], 1);

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('VEND-XYZ')).toBeInTheDocument();
    });
  });
});
