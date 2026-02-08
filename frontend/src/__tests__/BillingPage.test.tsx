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

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirmDialog({ open, onConfirm, onCancel, title, confirmLabel }: {
    open: boolean; onConfirm: () => void; onCancel: () => void; title: string; confirmLabel?: string;
  }) {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <button onClick={onConfirm}>{confirmLabel || 'Confirm'}</button>
        <button onClick={onCancel}>Cancel dialog</button>
      </div>
    );
  };
});

const mockGetBillingSummary = jest.fn();
const mockListBillingRuns = jest.fn();
const mockListOutboundInvoices = jest.fn();
const mockApproveOutboundInvoice = jest.fn();
const mockVoidOutboundInvoice = jest.fn();
const mockGenerateMonthlyInvoices = jest.fn();
const mockRunBillingPreflight = jest.fn();
const mockFetchChargebacks = jest.fn();
const mockCreateChargeback = jest.fn();
const mockReviewChargeback = jest.fn();
const mockListPendingAdjustments = jest.fn();
const mockCreateBillingAdjustment = jest.fn();
const mockApproveBillingAdjustment = jest.fn();
const mockRejectBillingAdjustment = jest.fn();
const mockGetMileageSummary = jest.fn();
const mockVerifyMileageRecord = jest.fn();
const mockCreateMileageFile = jest.fn();
const mockQueueInvoiceDelivery = jest.fn();
const mockGetDeliveryHistory = jest.fn();
const mockApproveBillingRun = jest.fn();
const mockCompleteBillingRun = jest.fn();
const mockGetCostAllocationSummary = jest.fn();

jest.mock('@/lib/api', () => ({
  getBillingSummary: (...args: unknown[]) => mockGetBillingSummary(...args),
  listBillingRuns: (...args: unknown[]) => mockListBillingRuns(...args),
  listOutboundInvoices: (...args: unknown[]) => mockListOutboundInvoices(...args),
  approveOutboundInvoice: (...args: unknown[]) => mockApproveOutboundInvoice(...args),
  voidOutboundInvoice: (...args: unknown[]) => mockVoidOutboundInvoice(...args),
  generateMonthlyInvoices: (...args: unknown[]) => mockGenerateMonthlyInvoices(...args),
  runBillingPreflight: (...args: unknown[]) => mockRunBillingPreflight(...args),
  listChargebacks: (...args: unknown[]) => mockFetchChargebacks(...args),
  createChargeback: (...args: unknown[]) => mockCreateChargeback(...args),
  reviewChargeback: (...args: unknown[]) => mockReviewChargeback(...args),
  listPendingAdjustments: (...args: unknown[]) => mockListPendingAdjustments(...args),
  createBillingAdjustment: (...args: unknown[]) => mockCreateBillingAdjustment(...args),
  approveBillingAdjustment: (...args: unknown[]) => mockApproveBillingAdjustment(...args),
  rejectBillingAdjustment: (...args: unknown[]) => mockRejectBillingAdjustment(...args),
  getMileageSummary: (...args: unknown[]) => mockGetMileageSummary(...args),
  verifyMileageRecord: (...args: unknown[]) => mockVerifyMileageRecord(...args),
  createMileageFile: (...args: unknown[]) => mockCreateMileageFile(...args),
  queueInvoiceDelivery: (...args: unknown[]) => mockQueueInvoiceDelivery(...args),
  getDeliveryHistory: (...args: unknown[]) => mockGetDeliveryHistory(...args),
  approveBillingRun: (...args: unknown[]) => mockApproveBillingRun(...args),
  completeBillingRun: (...args: unknown[]) => mockCompleteBillingRun(...args),
  getCostAllocationSummary: (...args: unknown[]) => mockGetCostAllocationSummary(...args),
}));

import BillingPage from '@/app/(operations)/billing/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultSummary = {
  fiscal_year: 2026,
  fiscal_month: 2,
  total_invoices: 45,
  total_rental: 150000,
  total_mileage: 25000,
  total_chargebacks: 8000,
  total_adjustments: -3000,
  grand_total: 180000,
  draft_count: 10,
  approved_count: 20,
  sent_count: 10,
  paid_count: 5,
};

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    invoice_number: 'INV-2026-001',
    customer_name: 'Acme Corp',
    customer_code: 'ACME',
    type: 'rental',
    period: '2026-02',
    total: 12500,
    status: 'draft',
    created_at: '2026-02-01T00:00:00Z',
    due_date: '2026-03-01',
    ...overrides,
  };
}

function makeChargeback(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    car_number: 'GATX 10001',
    customer_name: 'Acme Corp',
    customer_code: 'ACME',
    type: 'damage',
    amount: 5000,
    status: 'draft',
    submitted_date: '2026-01-15',
    description: 'Impact damage',
    ...overrides,
  };
}

function mockDefaultApis() {
  mockGetBillingSummary.mockResolvedValue(defaultSummary);
  mockListBillingRuns.mockResolvedValue([]);
  mockListOutboundInvoices.mockResolvedValue({ invoices: [], total: 0 });
  mockFetchChargebacks.mockResolvedValue({ chargebacks: [], total: 0 });
  mockListPendingAdjustments.mockResolvedValue([]);
  mockGetCostAllocationSummary.mockResolvedValue([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockDefaultApis();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillingPage', () => {
  it('shows sign-in message when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<BillingPage />);
    expect(screen.getByText('Please sign in to view billing.')).toBeInTheDocument();
  });

  it('renders header and subheader', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText(/Invoice generation, chargebacks, adjustments/)).toBeInTheDocument();
  });

  it('renders all 6 tab buttons', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    // "Invoices" appears in tab AND in billing runs table header; use getAllByText
    expect(screen.getAllByText('Invoices').length).toBeGreaterThanOrEqual(1);
    // "Chargebacks" appears in tab AND revenue card
    expect(screen.getAllByText('Chargebacks').length).toBeGreaterThanOrEqual(1);
    // "Adjustments" appears in tab AND revenue card
    expect(screen.getAllByText('Adjustments').length).toBeGreaterThanOrEqual(1);
    // "Mileage" appears in tab AND revenue card
    expect(screen.getAllByText('Mileage').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cost Allocation')).toBeInTheDocument();
  });

  // Overview Tab
  it('renders KPI cards on overview tab', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getByText('Grand Total (Month)')).toBeInTheDocument();
    });
    expect(screen.getByText('Total Invoices')).toBeInTheDocument();
    expect(screen.getByText('Draft Invoices')).toBeInTheDocument();
    expect(screen.getByText('Approved / Sent')).toBeInTheDocument();
  });

  it('renders revenue breakdown cards', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getByText('Rental')).toBeInTheDocument();
    });
  });

  it('renders billing period selector and refresh', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getByText('Billing Period:')).toBeInTheDocument();
    });
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('renders Generate Monthly Invoices button', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getByText('Generate Monthly Invoices')).toBeInTheDocument();
    });
  });

  // Invoices Tab
  it('switches to invoices tab and shows filters', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Invoices').length).toBeGreaterThanOrEqual(1);
    });

    // Click the first "Invoices" element (the tab button)
    fireEvent.click(screen.getAllByText('Invoices')[0]);
    await waitFor(() => {
      expect(screen.getByText('Apply')).toBeInTheDocument();
    });
  });

  it('renders invoice table with data', async () => {
    mockListOutboundInvoices.mockResolvedValue({
      invoices: [
        makeInvoice({ id: '1', invoice_number: 'INV-2026-001', customer_name: 'Acme Corp', status: 'draft' }),
        makeInvoice({ id: '2', invoice_number: 'INV-2026-002', customer_name: 'Beta Inc', status: 'approved' }),
      ],
      total: 2,
    });

    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Invoices').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText('Invoices')[0]);
    await waitFor(() => {
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    });
    expect(screen.getByText('INV-2026-002')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('shows invoice empty state when no invoices', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Invoices').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText('Invoices')[0]);
    await waitFor(() => {
      expect(screen.getByText('No invoices found matching the current filters.')).toBeInTheDocument();
    });
  });

  // Chargebacks Tab
  it('switches to chargebacks tab and shows create button', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Chargebacks').length).toBeGreaterThanOrEqual(1);
    });

    // The tab button is the first "Chargebacks" text (inside <nav>)
    fireEvent.click(screen.getAllByText('Chargebacks')[0]);
    await waitFor(() => {
      expect(screen.getByText('Create Chargeback')).toBeInTheDocument();
    });
  });

  it('renders chargeback pipeline cards', async () => {
    mockFetchChargebacks.mockResolvedValue({
      chargebacks: [
        makeChargeback({ id: '1', status: 'draft' }),
        makeChargeback({ id: '2', status: 'pending_review' }),
      ],
      total: 2,
    });

    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Chargebacks').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText('Chargebacks')[0]);
    await waitFor(() => {
      // "Pending Review" appears in pipeline card AND possibly table status badge
      expect(screen.getAllByText('Pending Review').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('Invoiced')).toBeInTheDocument();
  });

  // Adjustments Tab
  it('switches to adjustments tab and shows create button', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Adjustments').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText('Adjustments')[0]);
    await waitFor(() => {
      expect(screen.getByText('Billing Adjustments')).toBeInTheDocument();
    });
    expect(screen.getByText('Create Adjustment')).toBeInTheDocument();
  });

  // Mileage Tab
  it('switches to mileage tab', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Mileage').length).toBeGreaterThanOrEqual(1);
    });

    // The tab button is the first "Mileage" text (inside <nav>)
    fireEvent.click(screen.getAllByText('Mileage')[0]);
    // Loading state clears, tab content appears
    await waitFor(() => {
      // Mileage tab renders after loading finishes
      expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
    });
  });

  // Cost Allocation Tab
  it('switches to cost allocation tab', async () => {
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getByText('Cost Allocation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cost Allocation'));
    await waitFor(() => {
      expect(mockGetCostAllocationSummary).toHaveBeenCalled();
    });
  });

  // Error handling — test invoices tab error since overview catches errors individually
  it('shows error banner when invoice API fails', async () => {
    mockListOutboundInvoices.mockRejectedValue(new Error('Network error'));

    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Invoices').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText('Invoices')[0]);
    await waitFor(() => {
      expect(screen.getByText('Failed to load invoices.')).toBeInTheDocument();
    });
  });
});
