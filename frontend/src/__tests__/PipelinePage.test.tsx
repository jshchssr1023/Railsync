import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isLoading: false }),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock SWR
let mockSwrData: unknown = undefined;
let mockSwrError: unknown = undefined;
let mockSwrLoading = false;
const mockMutate = jest.fn();

jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({
    data: mockSwrData,
    error: mockSwrError,
    isLoading: mockSwrLoading,
    mutate: mockMutate,
  }),
}));

import PipelinePage from '@/app/(network)/pipeline/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePipelineCar(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    car_id: 'c1',
    car_number: '10001',
    car_mark: 'GATX',
    product_code: 'TANK-A',
    current_status: 'planned',
    needs_shopping_reason: 'Qualification due',
    shop_code: null,
    shop_name: null,
    target_month: '2026-03',
    estimated_cost: 5000,
    actual_cost: 0,
    last_shopping_date: null,
    plan_status_year: 2026,
    enroute_date: null,
    ...overrides,
  };
}

function setData(overrides: {
  backlog?: ReturnType<typeof makePipelineCar>[];
  pipeline?: ReturnType<typeof makePipelineCar>[];
  active?: ReturnType<typeof makePipelineCar>[];
  healthy?: ReturnType<typeof makePipelineCar>[];
  summary?: Record<string, number>;
} = {}) {
  mockSwrData = {
    summary: {
      backlog: overrides.backlog?.length ?? 0,
      pipeline: overrides.pipeline?.length ?? 0,
      active: overrides.active?.length ?? 0,
      healthy: overrides.healthy?.length ?? 0,
      complete: 0,
      ...overrides.summary,
    },
    backlog: overrides.backlog ?? [],
    pipeline: overrides.pipeline ?? [],
    active: overrides.active ?? [],
    healthy: overrides.healthy ?? [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSwrData = undefined;
  mockSwrError = undefined;
  mockSwrLoading = false;
  setData();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PipelinePage', () => {
  it('renders header and subheader', () => {
    render(<PipelinePage />);
    expect(screen.getByText('Pipeline View')).toBeInTheDocument();
    expect(screen.getByText('Track cars through the shopping lifecycle')).toBeInTheDocument();
  });

  it('renders Refresh button', () => {
    render(<PipelinePage />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('renders 4 summary tab cards', () => {
    setData({
      backlog: [makePipelineCar()],
      pipeline: [makePipelineCar({ id: '2' })],
      active: [],
      healthy: [],
      summary: { backlog: 10, pipeline: 5, active: 3, healthy: 20, complete: 8 },
    });

    render(<PipelinePage />);
    // Each label appears twice: once in the card text and once in the badge
    expect(screen.getAllByText('Backlog').length).toBe(2);
    expect(screen.getAllByText('Pipeline').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Active').length).toBe(2);
    expect(screen.getAllByText('Healthy').length).toBe(2);
    // Counts
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<PipelinePage />);
    expect(screen.getByPlaceholderText('Search cars...')).toBeInTheDocument();
  });

  it('renders page size selector', () => {
    render(<PipelinePage />);
    expect(screen.getByText('25 per page')).toBeInTheDocument();
  });

  it('shows empty state when no cars in tab', () => {
    render(<PipelinePage />);
    expect(screen.getByText('No cars in backlog')).toBeInTheDocument();
  });

  it('renders car data in backlog tab', () => {
    setData({
      backlog: [
        makePipelineCar({ id: '1', car_mark: 'GATX', car_number: '10001', product_code: 'TANK-A', needs_shopping_reason: 'Qualification due' }),
        makePipelineCar({ id: '2', car_mark: 'UTLX', car_number: '20002', product_code: 'TANK-B', needs_shopping_reason: 'Damage' }),
      ],
    });

    render(<PipelinePage />);
    expect(screen.getByText('GATX 10001')).toBeInTheDocument();
    expect(screen.getByText('UTLX 20002')).toBeInTheDocument();
    expect(screen.getByText('TANK-A')).toBeInTheDocument();
    expect(screen.getByText('TANK-B')).toBeInTheDocument();
    expect(screen.getByText('Qualification due')).toBeInTheDocument();
    expect(screen.getByText('Damage')).toBeInTheDocument();
  });

  it('shows Shop Now button in backlog tab', () => {
    setData({ backlog: [makePipelineCar()] });

    render(<PipelinePage />);
    expect(screen.getByText('Shop Now')).toBeInTheDocument();
  });

  it('navigates to planning on Shop Now click', () => {
    setData({ backlog: [makePipelineCar({ car_number: '10001', needs_shopping_reason: 'Qual due' })] });

    render(<PipelinePage />);
    fireEvent.click(screen.getByText('Shop Now'));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/planning?'));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('car=10001'));
  });

  it('renders table columns for backlog tab', () => {
    setData({ backlog: [makePipelineCar()] });

    render(<PipelinePage />);
    expect(screen.getByText('Car')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
    // "Status" appears in column header
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('Target Month')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('switches to pipeline tab and shows View Details', () => {
    setData({
      pipeline: [makePipelineCar({ id: '1', shop_name: 'West Repair' })],
    });

    render(<PipelinePage />);

    // Click Pipeline tab
    fireEvent.click(screen.getAllByText('Pipeline')[0]);

    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Report Issue')).toBeInTheDocument();
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.getByText('West Repair')).toBeInTheDocument();
  });

  it('switches to healthy tab and shows Last Shopped column', () => {
    setData({
      healthy: [makePipelineCar({ id: '1', last_shopping_date: '2025-12-01' })],
    });

    render(<PipelinePage />);
    fireEvent.click(screen.getAllByText('Healthy')[0]);

    expect(screen.getByText('Last Shopped')).toBeInTheDocument();
    expect(screen.getByText('2025-12-01')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockSwrError = new Error('Network failure');

    render(<PipelinePage />);
    expect(screen.getByText('Error loading pipeline data')).toBeInTheDocument();
    expect(screen.getByText('Network failure')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('calls mutate on Refresh click', () => {
    render(<PipelinePage />);
    fireEvent.click(screen.getByText('Refresh'));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('renders Backlog Cars title by default', () => {
    render(<PipelinePage />);
    expect(screen.getByText('Backlog Cars')).toBeInTheDocument();
  });
});
