import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/cars',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: '1', email: 'admin@test.com', first_name: 'Admin', last_name: 'User', role: 'admin' as const, is_active: true },
    isLoading: false,
  }),
}));

// Mock global fetch for apiFetch helper used in cars page
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock the UmlerSpecSection component since it is imported
jest.mock('@/components/UmlerSpecSection', () => {
  return function MockUmlerSpecSection() {
    return <div data-testid="umler-spec">UMLER Mock</div>;
  };
});

import CarsPageWrapper from '@/app/cars/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyTypesResponse = { data: [] };
const emptyFiltersResponse = { data: { statuses: ['Complete', 'Released'], regions: ['NE', 'SE'], lessees: ['Acme'] } };
const emptyCarsResponse = { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };

function makeCar(overrides: Record<string, unknown> = {}) {
  return {
    car_number: 'GATX 10001',
    car_mark: 'GATX',
    car_type: 'DOT 111',
    lessee_name: 'Acme Corp',
    commodity: 'Crude Oil',
    current_status: 'Complete',
    current_region: 'NE',
    car_age: 12,
    is_jacketed: true,
    is_lined: false,
    tank_qual_year: 2027,
    contract_number: 'C-123',
    plan_status: 'Active',
    ...overrides,
  };
}

function mockApiResponses(
  types = emptyTypesResponse,
  filters = emptyFiltersResponse,
  cars = emptyCarsResponse,
) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/contracts-browse/types')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(types) });
    }
    if (url.includes('/contracts-browse/filters')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(filters) });
    }
    if (url.includes('/contracts-browse/cars')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(cars) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Provide default empty localStorage mock
  Storage.prototype.getItem = jest.fn(() => null);
  mockApiResponses();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CarsPage', () => {
  it('renders the Cars header', async () => {
    render(<CarsPageWrapper />);
    await waitFor(() => {
      expect(screen.getByText('Cars')).toBeInTheDocument();
    });
  });

  it('shows empty state when no cars returned', async () => {
    render(<CarsPageWrapper />);
    await waitFor(() => {
      expect(screen.getByText('No cars match the current filters')).toBeInTheDocument();
    });
    expect(screen.getByText('Try adjusting your search or filter criteria.')).toBeInTheDocument();
  });

  it('renders table columns', async () => {
    mockApiResponses(
      emptyTypesResponse,
      emptyFiltersResponse,
      {
        data: [makeCar()],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      },
    );

    render(<CarsPageWrapper />);
    await waitFor(() => {
      expect(screen.getByText('Car #')).toBeInTheDocument();
    });
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Lessee')).toBeInTheDocument();
    expect(screen.getByText('Commodity')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('Tank Qual')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('renders cars from API data', async () => {
    mockApiResponses(
      emptyTypesResponse,
      emptyFiltersResponse,
      {
        data: [
          makeCar({ car_number: 'GATX 10001' }),
          makeCar({ car_number: 'GATX 20002', car_type: 'DOT 112', lessee_name: 'Beta Inc' }),
        ],
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
      },
    );

    render(<CarsPageWrapper />);
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });
    expect(screen.getByText('GATX 20002')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('shows car count in subheader', async () => {
    mockApiResponses(
      emptyTypesResponse,
      emptyFiltersResponse,
      {
        data: [makeCar()],
        pagination: { page: 1, limit: 50, total: 150, totalPages: 3 },
      },
    );

    render(<CarsPageWrapper />);
    // "150" appears in both subheader and pagination footer — use findAllByText
    const matches = await screen.findAllByText(/150/, {}, { timeout: 3000 });
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders pagination when totalPages > 1', async () => {
    mockApiResponses(
      emptyTypesResponse,
      emptyFiltersResponse,
      {
        data: Array.from({ length: 50 }, (_, i) => makeCar({ car_number: `GATX ${i}` })),
        pagination: { page: 1, limit: 50, total: 200, totalPages: 4 },
      },
    );

    render(<CarsPageWrapper />);
    // Wait for data to load (pagination buttons appear after loading completes)
    const firstBtn = await screen.findByText('First', {}, { timeout: 3000 });
    expect(firstBtn).toBeInTheDocument();
    expect(screen.getByText('Prev')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Last')).toBeInTheDocument();
  });

  it('renders type tree panel from API', async () => {
    mockApiResponses(
      {
        data: [
          { name: 'DOT 111', count: 50, children: [{ name: 'Crude', count: 30 }, { name: 'Ethanol', count: 20 }] },
          { name: 'DOT 112', count: 20, children: [] },
        ],
      },
      emptyFiltersResponse,
      emptyCarsResponse,
    );

    render(<CarsPageWrapper />);
    await waitFor(() => {
      expect(screen.getByText('Car Types')).toBeInTheDocument();
    });
    expect(screen.getByText('All Cars')).toBeInTheDocument();
    expect(screen.getByText('DOT 111')).toBeInTheDocument();
    expect(screen.getByText('DOT 112')).toBeInTheDocument();
  });

  it('shows search input and filters button', async () => {
    render(<CarsPageWrapper />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search car number...')).toBeInTheDocument();
    });
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('shows filter row when Filters clicked', async () => {
    mockApiResponses(
      emptyTypesResponse,
      { data: { statuses: ['Complete', 'Released'], regions: ['NE', 'SE'], lessees: ['Acme'] } },
      emptyCarsResponse,
    );
    render(<CarsPageWrapper />);
    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // No comboboxes before clicking Filters
    expect(screen.queryAllByRole('combobox').length).toBe(0);

    fireEvent.click(screen.getByText('Filters'));
    // Three filter dropdowns (Status, Region, Lessee) should now appear
    await waitFor(() => {
      expect(screen.getAllByRole('combobox').length).toBe(3);
    });
  });

  it('renders QualBadge with appropriate status for overdue year', async () => {
    const currentYear = new Date().getFullYear();
    mockApiResponses(
      emptyTypesResponse,
      emptyFiltersResponse,
      {
        data: [makeCar({ tank_qual_year: currentYear - 1 })],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      },
    );

    render(<CarsPageWrapper />);
    await waitFor(() => {
      expect(screen.getByText('Overdue')).toBeInTheDocument();
    });
  });

  it('renders StatusBadge for car status', async () => {
    mockApiResponses(
      emptyTypesResponse,
      emptyFiltersResponse,
      {
        data: [makeCar({ current_status: 'Released' })],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      },
    );

    render(<CarsPageWrapper />);
    await waitFor(() => {
      expect(screen.getByText('Released')).toBeInTheDocument();
    });
  });
});
