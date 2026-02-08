import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: '1', email: 'admin@test.com', first_name: 'Admin', last_name: 'User', role: 'admin' as const, is_active: true },
    isLoading: false,
  }),
}));

const mockFetch = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

import ShopsPage from '@/app/(network)/shops/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShop(overrides: Record<string, unknown> = {}) {
  return {
    shop_code: 'SH01',
    shop_name: 'Central Repair',
    region: 'Midwest',
    tier: 1,
    capacity: 50,
    cars_in_shop: 30,
    cars_enroute: 5,
    labor_rate: 85,
    material_markup: 15,
    is_preferred_network: true,
    load_pct: 60,
    load_status: 'green',
    latitude: 41.5,
    longitude: -87.6,
    ...overrides,
  };
}

function makeDesignationGroup(designation: string, shops: ReturnType<typeof makeShop>[] = []) {
  return {
    designation,
    networks: shops.length > 0 ? [{
      network: 'BNSF',
      tier: 1,
      shops,
    }] : [],
    metrics: {
      total_shops: shops.length,
      total_capacity: shops.reduce((s, sh) => s + (sh.capacity as number), 0),
      cars_in_shop: shops.reduce((s, sh) => s + (sh.cars_in_shop as number), 0),
      cars_enroute: shops.reduce((s, sh) => s + (sh.cars_enroute as number), 0),
      preferred_count: shops.filter(sh => sh.is_preferred_network).length,
      non_preferred_count: shops.filter(sh => !sh.is_preferred_network).length,
      avg_labor_rate: 85,
      avg_material_markup: 15,
    },
  };
}

function mockDefaultFetch(groups: ReturnType<typeof makeDesignationGroup>[] = []) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/shops/browse/hierarchy')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: groups }),
      });
    }
    if (url.includes('/shops/browse/detail/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            shop: { shop_code: 'SH01', shop_name: 'Central Repair', primary_railroad: 'BNSF', region: 'Midwest', city: 'Chicago', state: 'IL', tier: 1, shop_designation: 'repair', capacity: 50, labor_rate: 85, material_markup: 15, is_preferred_network: true, latitude: 41.5, longitude: -87.6 },
            backlog: { hours_backlog: '120', cars_backlog: 8, cars_en_route_0_6: 3, cars_en_route_7_14: 2, cars_en_route_15_plus: 0 },
            capacity: [],
            capabilities: {},
            active_events: 5,
            in_progress: 3,
          },
        }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDefaultFetch();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShopsPage', () => {
  it('renders header and subheader', async () => {
    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByText('Shop Directory')).toBeInTheDocument();
    });
    expect(screen.getByText(/Browse repair shops, storage facilities, and scrap yards/)).toBeInTheDocument();
  });

  it('renders search bar', async () => {
    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search shop name or code...')).toBeInTheDocument();
    });
  });

  it('renders Filters button', async () => {
    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });
  });

  it('renders designation cards with shop data', async () => {
    mockDefaultFetch([
      makeDesignationGroup('repair', [makeShop({ shop_code: 'SH01', shop_name: 'Central Repair' })]),
      makeDesignationGroup('storage', [makeShop({ shop_code: 'SH02', shop_name: 'East Storage' })]),
    ]);

    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByText('Repair Shops')).toBeInTheDocument();
    });
    expect(screen.getByText('Storage Facilities')).toBeInTheDocument();
  });

  it('renders network group with tier badge', async () => {
    mockDefaultFetch([
      makeDesignationGroup('repair', [makeShop()]),
    ]);

    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByText('BNSF')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Tier 1').length).toBeGreaterThanOrEqual(1);
  });

  it('renders metric banner for repair designation', async () => {
    mockDefaultFetch([
      makeDesignationGroup('repair', [makeShop({ cars_in_shop: 30, cars_enroute: 5 })]),
    ]);

    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByText('Cars in Shop')).toBeInTheDocument();
    });
    expect(screen.getByText('Avg Labor Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Material Markup')).toBeInTheDocument();
    expect(screen.getByText('Preferred / Non-Preferred')).toBeInTheDocument();
  });

  it('shows shop rows when network is expanded', async () => {
    mockDefaultFetch([
      makeDesignationGroup('repair', [
        makeShop({ shop_code: 'SH01', shop_name: 'Central Repair' }),
        makeShop({ shop_code: 'SH02', shop_name: 'West Repair' }),
      ]),
    ]);

    render(<ShopsPage />);
    await waitFor(() => {
      // First network is auto-expanded
      expect(screen.getByText('Central Repair')).toBeInTheDocument();
    });
    expect(screen.getByText('West Repair')).toBeInTheDocument();
    expect(screen.getByText('SH01')).toBeInTheDocument();
    expect(screen.getByText('SH02')).toBeInTheDocument();
  });

  it('shows filter panel when Filters button clicked', async () => {
    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // No filter panel initially
    expect(screen.queryByText('All Tiers')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Filters'));
    expect(screen.getByText('All Tiers')).toBeInTheDocument();
    expect(screen.getByText('All Regions')).toBeInTheDocument();
    expect(screen.getByText('Preferred Only')).toBeInTheDocument();
  });

  it('shows Clear filters when search has value', async () => {
    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search shop name or code...')).toBeInTheDocument();
    });

    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search shop name or code...'), { target: { value: 'test' } });
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('renders 1 shops text for single shop', async () => {
    mockDefaultFetch([
      makeDesignationGroup('repair', [makeShop()]),
    ]);

    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByText(/1 shop$/)).toBeInTheDocument();
    });
  });

  it('renders multiple shops count text', async () => {
    mockDefaultFetch([
      makeDesignationGroup('repair', [makeShop({ shop_code: 'SH01' }), makeShop({ shop_code: 'SH02' })]),
    ]);

    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByText(/2 shops$/)).toBeInTheDocument();
    });
  });

  it('shows locations count in network row', async () => {
    mockDefaultFetch([
      makeDesignationGroup('repair', [makeShop({ shop_code: 'SH01' }), makeShop({ shop_code: 'SH02' })]),
    ]);

    render(<ShopsPage />);
    await waitFor(() => {
      expect(screen.getByText('2 locations')).toBeInTheDocument();
    });
  });
});
