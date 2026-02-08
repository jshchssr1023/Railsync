import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockReplace = jest.fn();
let currentSearchParams = new URLSearchParams();
mockReplace.mockImplementation((url: string) => {
  const qsIndex = url.indexOf('?');
  currentSearchParams = qsIndex >= 0
    ? new URLSearchParams(url.slice(qsIndex))
    : new URLSearchParams();
});
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/shopping',
  useSearchParams: () => currentSearchParams,
}));

const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/components/Toast', () => ({
  useToast: () => mockToast,
}));

const mockListShoppingEvents = jest.fn();
const mockCreateShoppingEvent = jest.fn();
const mockCreateBatchShoppingEvents = jest.fn();
jest.mock('@/lib/api', () => ({
  listShoppingEvents: (...args: unknown[]) => mockListShoppingEvents(...args),
  createShoppingEvent: (...args: unknown[]) => mockCreateShoppingEvent(...args),
  createBatchShoppingEvents: (...args: unknown[]) => mockCreateBatchShoppingEvents(...args),
}));

// Mock ShoppingDetailPanel — the detail panel opens on row click instead of
// navigating. Rendering the real component would require additional API mocks.
jest.mock('@/components/ShoppingDetailPanel', () => {
  return function MockShoppingDetailPanel({ eventId }: { eventId: string }) {
    return <div data-testid="detail-panel">Detail Panel: {eventId}</div>;
  };
});

import ShoppingPage from '@/app/(assets)/shopping/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<{
  id: string; event_number: string; car_number: string; shop_code: string; state: string;
  shopping_type_code: string | null; shopping_reason_code: string | null;
  batch_number: string | null; shop_name: string | null; created_at: string;
}> = {}) {
  return {
    id: '1',
    event_number: 'SE-0001',
    car_number: 'GATX 12345',
    shop_code: 'SHOP-A',
    state: 'REQUESTED',
    shopping_type_code: null,
    shopping_reason_code: null,
    batch_number: null,
    shop_name: null,
    created_at: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  currentSearchParams = new URLSearchParams();
  mockReplace.mockImplementation((url: string) => {
    const qsIndex = url.indexOf('?');
    currentSearchParams = qsIndex >= 0
      ? new URLSearchParams(url.slice(qsIndex))
      : new URLSearchParams();
  });
  mockListShoppingEvents.mockResolvedValue({ events: [], total: 0 });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShoppingPage', () => {
  it('renders header and action buttons', async () => {
    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('Shopping Events')).toBeInTheDocument();
    });
    expect(screen.getByText('+ New Shopping Request')).toBeInTheDocument();
    expect(screen.getByText('Quick Event')).toBeInTheDocument();
    expect(screen.getByText('Batch Shop')).toBeInTheDocument();
  });

  it('renders filter pills', async () => {
    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });
    // Some labels like "Requested" also appear in stats, so use getAllByText
    expect(screen.getAllByText('Requested').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Inbound').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('In Repair').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('QA Complete').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Released').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('shows empty state when no events', async () => {
    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('No shopping events found')).toBeInTheDocument();
    });
  });

  it('renders event list from API', async () => {
    mockListShoppingEvents.mockResolvedValue({
      events: [
        makeEvent({ id: '1', event_number: 'SE-0001', car_number: 'GATX 100', state: 'IN_REPAIR', shop_code: 'SHOP-A' }),
        makeEvent({ id: '2', event_number: 'SE-0002', car_number: 'GATX 200', state: 'RELEASED', shop_code: 'SHOP-B' }),
      ],
      total: 2,
    });

    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('SE-0001')).toBeInTheDocument();
    });
    expect(screen.getByText('SE-0002')).toBeInTheDocument();
    // "In Repair" appears in both filter pills and event badge
    expect(screen.getAllByText('In Repair').length).toBeGreaterThanOrEqual(1);
  });

  it('opens detail panel on row click', async () => {
    mockListShoppingEvents.mockResolvedValue({
      events: [makeEvent({ id: '42', event_number: 'SE-0042' })],
      total: 1,
    });

    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('SE-0042')).toBeInTheDocument();
    });

    // Detail panel should not be visible before click
    expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('SE-0042'));

    // The page now opens a detail panel instead of navigating
    expect(screen.getByTestId('detail-panel')).toBeInTheDocument();
    expect(screen.getByText('Detail Panel: 42')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates to new shopping on button click', async () => {
    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('+ New Shopping Request')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('+ New Shopping Request'));
    expect(mockPush).toHaveBeenCalledWith('/shopping/new');
  });

  it('shows and hides quick create form', async () => {
    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('Quick Event')).toBeInTheDocument();
    });

    // Form should not be visible initially
    expect(screen.queryByText('New Shopping Event')).not.toBeInTheDocument();

    // Click to show
    fireEvent.click(screen.getByText('Quick Event'));
    expect(screen.getByText('New Shopping Event')).toBeInTheDocument();
    expect(screen.getByText('Create Shopping Event')).toBeInTheDocument();

    // Click Cancel to hide
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('New Shopping Event')).not.toBeInTheDocument();
  });

  it('shows and hides batch form', async () => {
    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('Batch Shop')).toBeInTheDocument();
    });

    expect(screen.queryByText('Batch Shopping Events')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Batch Shop'));
    expect(screen.getByText('Batch Shopping Events')).toBeInTheDocument();
    expect(screen.getByText('Create Batch')).toBeInTheDocument();
  });

  it('shows error state and retry button', async () => {
    mockListShoppingEvents.mockRejectedValueOnce(new Error('Network error'));
    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();

    // Retry should re-fetch
    mockListShoppingEvents.mockResolvedValueOnce({ events: [], total: 0 });
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => {
      expect(mockListShoppingEvents).toHaveBeenCalledTimes(2);
    });
  });

  it('shows pagination when total exceeds page size', async () => {
    mockListShoppingEvents.mockResolvedValue({
      events: Array.from({ length: 25 }, (_, i) =>
        makeEvent({ id: String(i), event_number: `SE-${String(i).padStart(4, '0')}` })
      ),
      total: 75,
    });

    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText(/Showing 1 to 25 of 75 events/)).toBeInTheDocument();
    });
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('calls API with correct filter params', async () => {
    // Pre-populate URL with the CANCELLED state filter so the component reads
    // it from search params on mount (useURLFilters is URL-driven).
    currentSearchParams = new URLSearchParams('state=CANCELLED');

    render(<ShoppingPage />);
    await waitFor(() => {
      expect(mockListShoppingEvents).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'CANCELLED' })
      );
    });
  });

  it('displays stats summary cards', async () => {
    mockListShoppingEvents.mockResolvedValue({
      events: [
        makeEvent({ state: 'REQUESTED' }),
        makeEvent({ id: '2', state: 'IN_REPAIR' }),
        makeEvent({ id: '3', state: 'RELEASED' }),
      ],
      total: 3,
    });

    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
    });
    // Stats cards render labels
    expect(screen.getAllByText('In Repair').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Released').length).toBeGreaterThanOrEqual(1);
  });

  it('shows type/reason code badges on events', async () => {
    mockListShoppingEvents.mockResolvedValue({
      events: [
        makeEvent({ shopping_type_code: 'MAINT', shopping_reason_code: 'QUAL' }),
      ],
      total: 1,
    });

    render(<ShoppingPage />);
    await waitFor(() => {
      expect(screen.getByText('Type: MAINT')).toBeInTheDocument();
    });
    expect(screen.getByText('Reason: QUAL')).toBeInTheDocument();
  });
});
