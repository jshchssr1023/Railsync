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

const mockListComponents = jest.fn();
const mockGetComponent = jest.fn();
const mockCreateComponent = jest.fn();
const mockGetComponentStats = jest.fn();
const mockRecordComponentInspection = jest.fn();
const mockGetCarComponents = jest.fn();

jest.mock('@/lib/api', () => ({
  listComponents: (...args: unknown[]) => mockListComponents(...args),
  getComponent: (...args: unknown[]) => mockGetComponent(...args),
  createComponent: (...args: unknown[]) => mockCreateComponent(...args),
  getComponentStats: (...args: unknown[]) => mockGetComponentStats(...args),
  recordComponentInspection: (...args: unknown[]) => mockRecordComponentInspection(...args),
  getCarComponents: (...args: unknown[]) => mockGetCarComponents(...args),
}));

import ComponentRegistryPage from '@/app/components-registry/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultStats = {
  total: 250,
  by_status: [
    { status: 'active', count: 200 },
    { status: 'removed', count: 30 },
    { status: 'failed', count: 10 },
    { status: 'replaced', count: 10 },
  ],
  by_type: [],
  overdue_inspections: 12,
  due_soon_inspections: 25,
};

function makeComponent(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    car_id: 'c1',
    car_number: 'GATX 10001',
    component_type: 'valve',
    serial_number: 'SN-12345',
    manufacturer: 'Fisher',
    model: 'V100',
    status: 'active',
    install_date: '2024-06-15',
    next_inspection_due: '2027-06-15',
    last_inspection_date: '2025-06-15',
    specification: null,
    notes: null,
    created_at: '2024-06-15T00:00:00Z',
    updated_at: '2025-06-15T00:00:00Z',
    ...overrides,
  };
}

function mockDefaults(overrides: {
  components?: { components: ReturnType<typeof makeComponent>[]; total: number };
  stats?: typeof defaultStats | null;
} = {}) {
  const compData = overrides.components ?? { components: [], total: 0 };
  mockListComponents.mockResolvedValue(compData);
  mockGetComponentStats.mockResolvedValue(overrides.stats ?? defaultStats);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockDefaults();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ComponentRegistryPage', () => {
  it('shows sign-in message when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<ComponentRegistryPage />);
    expect(screen.getByText('Please sign in to view components.')).toBeInTheDocument();
  });

  it('renders header and Add Component button', async () => {
    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByText('Component Registry')).toBeInTheDocument();
    });
    expect(screen.getByText('Add Component')).toBeInTheDocument();
  });

  it('renders KPI cards with stats', async () => {
    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByText('Total Components')).toBeInTheDocument();
    });
    expect(screen.getByText('250')).toBeInTheDocument();
    // "Active" appears in KPI card label
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Overdue Inspections')).toBeInTheDocument();
    expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Due Soon (30d)')).toBeInTheDocument();
  });

  it('renders filter inputs', async () => {
    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search car...')).toBeInTheDocument();
    });
    // Type and Status selects
    expect(screen.getAllByRole('combobox').length).toBe(2);
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('shows empty state when no components', async () => {
    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByText('No components found. Add one to get started.')).toBeInTheDocument();
    });
  });

  it('renders table columns', async () => {
    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByText('Car #')).toBeInTheDocument();
    });
    expect(screen.getByText('Serial #')).toBeInTheDocument();
    expect(screen.getByText('Manufacturer')).toBeInTheDocument();
    expect(screen.getByText('Installed')).toBeInTheDocument();
    expect(screen.getByText('Next Inspection')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders component data in table rows', async () => {
    mockDefaults({
      components: {
        components: [
          makeComponent({ id: '1', car_number: 'GATX 10001', serial_number: 'SN-001', manufacturer: 'Fisher' }),
          makeComponent({ id: '2', car_number: 'UTLX 20002', serial_number: 'SN-002', manufacturer: 'Dresser', component_type: 'bov' }),
        ],
        total: 2,
      },
    });

    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    });
    expect(screen.getByText('UTLX 20002')).toBeInTheDocument();
    expect(screen.getByText('SN-001')).toBeInTheDocument();
    expect(screen.getByText('SN-002')).toBeInTheDocument();
    expect(screen.getByText('Fisher')).toBeInTheDocument();
    expect(screen.getByText('Dresser')).toBeInTheDocument();
  });

  it('shows Inspect button for active components', async () => {
    mockDefaults({
      components: {
        components: [
          makeComponent({ id: '1', status: 'active' }),
          makeComponent({ id: '2', status: 'removed' }),
        ],
        total: 2,
      },
    });

    render(<ComponentRegistryPage />);
    await waitFor(() => {
      // Only 1 Inspect button (for the active component)
      expect(screen.getAllByText('Inspect').length).toBe(1);
    });
  });

  it('shows and hides create modal', async () => {
    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Component')).toBeInTheDocument();
    });

    // Modal not visible initially
    expect(screen.queryByText('Add Component', { selector: 'h2' })).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(screen.getByText('Add Component'));
    expect(screen.getByText('Car Number *')).toBeInTheDocument();
    expect(screen.getByText('Type *')).toBeInTheDocument();
    expect(screen.getByText('Serial Number')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();

    // Click Cancel to close
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Car Number *')).not.toBeInTheDocument();
  });

  it('calls createComponent on form submit', async () => {
    mockCreateComponent.mockResolvedValue({});
    // After create, reload is called
    mockListComponents.mockResolvedValue({ components: [], total: 0 });

    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Component')).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByText('Add Component'));

    // Fill car number (required field)
    const carInput = screen.getByPlaceholderText('e.g., UTLX 12345');
    fireEvent.change(carInput, { target: { value: 'GATX 55555' } });

    // Click Create
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => {
      expect(mockCreateComponent).toHaveBeenCalledWith(
        expect.objectContaining({ car_number: 'GATX 55555' })
      );
    });
    expect(mockToast.success).toHaveBeenCalledWith('Component created');
  });

  it('shows inspect modal when Inspect clicked', async () => {
    mockDefaults({
      components: {
        components: [makeComponent({ id: '1', status: 'active' })],
        total: 1,
      },
    });

    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByText('Inspect')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Inspect'));
    // "Record Inspection" appears in both modal title and submit button
    expect(screen.getAllByText('Record Inspection').length).toBe(2);
    expect(screen.getByText('Shop Code')).toBeInTheDocument();
    expect(screen.getByText('Work Order Reference')).toBeInTheDocument();
  });

  it('shows Clear button when filters are applied', async () => {
    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search car...')).toBeInTheDocument();
    });

    // No Clear button initially
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();

    // Type a car number
    fireEvent.change(screen.getByPlaceholderText('Search car...'), { target: { value: 'GATX' } });
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('renders pagination when total exceeds page size', async () => {
    mockDefaults({
      components: {
        components: Array.from({ length: 50 }, (_, i) =>
          makeComponent({ id: String(i), car_number: `GATX ${i}` })
        ),
        total: 120,
      },
    });

    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 to 50 of 120/)).toBeInTheDocument();
  });

  it('calls API when Apply filter clicked', async () => {
    render(<ComponentRegistryPage />);
    await waitFor(() => {
      expect(screen.getByText('Apply')).toBeInTheDocument();
    });

    mockListComponents.mockClear();
    mockListComponents.mockResolvedValue({ components: [], total: 0 });

    fireEvent.click(screen.getByText('Apply'));
    await waitFor(() => {
      expect(mockListComponents).toHaveBeenCalled();
    });
  });
});
