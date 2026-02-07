import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock SWR
const mockSwrResponses: Record<string, unknown> = {};
jest.mock('swr', () => ({
  __esModule: true,
  default: (key: string | null) => {
    if (!key) return { data: undefined, error: undefined, isLoading: false };
    const resp = mockSwrResponses[key];
    if (resp !== undefined) {
      return { data: resp, error: undefined, isLoading: false };
    }
    return { data: [], error: undefined, isLoading: false };
  },
}));

// Mock child components
jest.mock('@/components/contracts/CustomerCard', () => {
  return function MockCustomerCard({ customer, onClick }: { customer: { id: string; customer_name: string }; onClick: (c: unknown) => void }) {
    return (
      <div data-testid={`customer-${customer.id}`} onClick={() => onClick(customer)}>
        {customer.customer_name}
      </div>
    );
  };
});

jest.mock('@/components/contracts/LeaseCard', () => {
  return function MockLeaseCard({ lease, onClick }: { lease: { id: string; lease_id: string }; onClick: (l: unknown) => void }) {
    return (
      <div data-testid={`lease-${lease.id}`} onClick={() => onClick(lease)}>
        {lease.lease_id}
      </div>
    );
  };
});

jest.mock('@/components/contracts/RiderCard', () => {
  return function MockRiderCard({ rider, onClick }: { rider: { id: string; rider_id: string }; onClick: (r: unknown) => void }) {
    return (
      <div data-testid={`rider-${rider.id}`} onClick={() => onClick(rider)}>
        {rider.rider_id}
      </div>
    );
  };
});

jest.mock('@/components/contracts/CarCard', () => {
  return function MockCarCard({ car }: { car: { car_number: string } }) {
    return <tr data-testid={`car-${car.car_number}`}><td>{car.car_number}</td></tr>;
  };
});

jest.mock('@/components/contracts/AmendmentModal', () => {
  return function MockAmendmentModal() {
    return <div data-testid="amendment-modal">Amendment Modal</div>;
  };
});

jest.mock('@/components/ContractsHealthDashboard', () => {
  return function MockHealthDashboard() {
    return <div data-testid="health-dashboard">Health Dashboard</div>;
  };
});

jest.mock('@/components/FacetedSidebar', () => {
  const MockSidebar = () => <div data-testid="faceted-sidebar">Sidebar</div>;
  MockSidebar.displayName = 'FacetedSidebar';
  return {
    __esModule: true,
    default: MockSidebar,
  };
});

import ContractsPage from '@/app/contracts/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = 'http://localhost:3001/api';

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    customer_code: 'ACME',
    customer_name: 'Acme Corp',
    is_active: true,
    active_leases: 3,
    total_riders: 5,
    total_cars: 50,
    ...overrides,
  };
}

function makeLease(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    lease_id: 'LEASE-001',
    customer_id: '1',
    customer_name: 'Acme Corp',
    lease_name: 'Main Lease',
    start_date: '2024-01-01',
    end_date: '2027-01-01',
    status: 'active',
    rider_count: 2,
    car_count: 30,
    monthly_revenue: 15000,
    ...overrides,
  };
}

function makeRider(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    rider_id: 'RIDER-001',
    master_lease_id: '1',
    lease_id: 'LEASE-001',
    customer_name: 'Acme Corp',
    rider_name: 'Rider Alpha',
    effective_date: '2024-01-01',
    expiration_date: '2027-01-01',
    status: 'active',
    car_count: 15,
    amendment_count: 1,
    has_pending_amendments: false,
    cars_with_conflicts: 0,
    ...overrides,
  };
}

function setCustomersData(customers: ReturnType<typeof makeCustomer>[]) {
  mockSwrResponses[`${API_URL}/customers`] = customers;
}

function setLeasesData(customerId: string, leases: ReturnType<typeof makeLease>[]) {
  mockSwrResponses[`${API_URL}/customers/${customerId}/leases`] = leases;
}

function setRidersData(leaseId: string, riders: ReturnType<typeof makeRider>[]) {
  mockSwrResponses[`${API_URL}/leases/${leaseId}/riders`] = riders;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Clear all SWR mock responses
  Object.keys(mockSwrResponses).forEach(key => delete mockSwrResponses[key]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContractsPage', () => {
  it('renders header and subheader', () => {
    render(<ContractsPage />);
    expect(screen.getByText('Contracts Overview')).toBeInTheDocument();
    expect(screen.getByText('Navigate through customers, leases, riders, and cars')).toBeInTheDocument();
  });

  it('renders breadcrumb starting with Customers', () => {
    render(<ContractsPage />);
    expect(screen.getByText('Customers')).toBeInTheDocument();
  });

  it('renders health dashboard at customers level', () => {
    render(<ContractsPage />);
    expect(screen.getByTestId('health-dashboard')).toBeInTheDocument();
  });

  it('renders search bar with correct placeholder', () => {
    render(<ContractsPage />);
    expect(screen.getByPlaceholderText('Search customers...')).toBeInTheDocument();
  });

  it('renders stats card showing Total Customers', () => {
    setCustomersData([makeCustomer(), makeCustomer({ id: '2', customer_name: 'Beta Inc', total_cars: 30 })]);

    render(<ContractsPage />);
    expect(screen.getByText('Total Customers')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders Total Cars stat card at customers level', () => {
    setCustomersData([makeCustomer({ total_cars: 50 }), makeCustomer({ id: '2', total_cars: 30 })]);

    render(<ContractsPage />);
    expect(screen.getByText('Total Cars')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('renders customer cards when data loaded', () => {
    setCustomersData([
      makeCustomer({ id: '1', customer_name: 'Acme Corp' }),
      makeCustomer({ id: '2', customer_name: 'Beta Inc' }),
    ]);

    render(<ContractsPage />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('shows empty state when no customers', () => {
    setCustomersData([]);

    render(<ContractsPage />);
    expect(screen.getByText('No customers found')).toBeInTheDocument();
  });

  it('navigates to leases when customer is clicked', () => {
    const customer = makeCustomer({ id: '1', customer_name: 'Acme Corp' });
    setCustomersData([customer]);
    setLeasesData('1', [makeLease()]);

    render(<ContractsPage />);

    // Click the customer card
    fireEvent.click(screen.getByTestId('customer-1'));

    // Should show leases level
    expect(screen.getByText('Total Leases')).toBeInTheDocument();
    // Breadcrumb should include customer name
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    // Back button should appear
    expect(screen.getByText('Back')).toBeInTheDocument();
    // Search placeholder updates
    expect(screen.getByPlaceholderText('Search leases...')).toBeInTheDocument();
  });

  it('renders lease cards at leases level', () => {
    const customer = makeCustomer({ id: '1' });
    setCustomersData([customer]);
    setLeasesData('1', [
      makeLease({ id: '1', lease_id: 'LEASE-001' }),
      makeLease({ id: '2', lease_id: 'LEASE-002' }),
    ]);

    render(<ContractsPage />);
    fireEvent.click(screen.getByTestId('customer-1'));

    expect(screen.getByText('LEASE-001')).toBeInTheDocument();
    expect(screen.getByText('LEASE-002')).toBeInTheDocument();
  });

  it('navigates back from leases to customers', () => {
    const customer = makeCustomer({ id: '1', customer_name: 'Acme Corp' });
    setCustomersData([customer]);
    setLeasesData('1', []);

    render(<ContractsPage />);
    fireEvent.click(screen.getByTestId('customer-1'));

    // At leases level
    expect(screen.getByText('Back')).toBeInTheDocument();

    // Click back
    fireEvent.click(screen.getByText('Back'));

    // Should be back at customers level
    expect(screen.getByText('Total Customers')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search customers...')).toBeInTheDocument();
  });

  it('does not show Back button at customers level', () => {
    render(<ContractsPage />);
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('navigates from leases to riders when lease clicked', () => {
    const customer = makeCustomer({ id: '1' });
    setCustomersData([customer]);
    setLeasesData('1', [makeLease({ id: 'L1', lease_id: 'LEASE-001' })]);
    setRidersData('L1', [makeRider({ id: '1', rider_id: 'RIDER-001' })]);

    render(<ContractsPage />);
    // Navigate to leases
    fireEvent.click(screen.getByTestId('customer-1'));
    // Navigate to riders
    fireEvent.click(screen.getByTestId('lease-L1'));

    expect(screen.getByText('Total Riders')).toBeInTheDocument();
    expect(screen.getByText('RIDER-001')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search riders...')).toBeInTheDocument();
  });

  it('does not show health dashboard below customers level', () => {
    const customer = makeCustomer({ id: '1' });
    setCustomersData([customer]);
    setLeasesData('1', []);

    render(<ContractsPage />);
    expect(screen.getByTestId('health-dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('customer-1'));
    expect(screen.queryByTestId('health-dashboard')).not.toBeInTheDocument();
  });
});
