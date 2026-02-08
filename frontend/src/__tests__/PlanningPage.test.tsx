import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isLoading: false }),
}));

const mockGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGet }),
}));

jest.mock('@/components/ForecastSummary', () => {
  return function MockForecastSummary(props: { fiscalYear: number; compact?: boolean }) {
    return <div data-testid="forecast-summary">ForecastSummary FY{props.fiscalYear}{props.compact ? ' compact' : ''}</div>;
  };
});

jest.mock('@/components/CapacityGrid', () => {
  return function MockCapacityGrid(props: { months: number }) {
    return <div data-testid="capacity-grid">CapacityGrid {props.months}mo</div>;
  };
});

jest.mock('@/components/AllocationList', () => {
  return function MockAllocationList() {
    return <div data-testid="allocation-list">AllocationList</div>;
  };
});

jest.mock('@/components/AllocationTimeline', () => {
  return function MockAllocationTimeline() {
    return <div data-testid="allocation-timeline">AllocationTimeline</div>;
  };
});

jest.mock('@/components/ShopLoadingTool', () => {
  return function MockShopLoadingTool(props: { months: number }) {
    return <div data-testid="shop-loading-tool">ShopLoadingTool {props.months}mo</div>;
  };
});

jest.mock('@/components/PipelineSummaryCards', () => {
  return function MockPipelineSummaryCards(props: { fiscalYear: number }) {
    return <div data-testid="pipeline-summary-cards">PipelineSummaryCards FY{props.fiscalYear}</div>;
  };
});

jest.mock('@/components/BudgetScenarioPanel', () => {
  return function MockBudgetScenarioPanel(props: { fiscalYear: number }) {
    return <div data-testid="budget-scenario-panel">BudgetScenarioPanel FY{props.fiscalYear}</div>;
  };
});

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import PlanningPage from '@/app/(assets)/planning/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear();

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReturnValue(null);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanningPage', () => {
  it('renders header and subheader', () => {
    render(<PlanningPage />);
    expect(screen.getByText('Network Planning')).toBeInTheDocument();
    expect(screen.getByText('Capacity management and maintenance forecasting')).toBeInTheDocument();
  });

  it('renders both tab labels', () => {
    render(<PlanningPage />);
    expect(screen.getByText('Monthly Load')).toBeInTheDocument();
    expect(screen.getByText('Maintenance Forecast')).toBeInTheDocument();
  });

  it('renders fiscal year selector with three years', () => {
    render(<PlanningPage />);
    expect(screen.getByText('Fiscal Year:')).toBeInTheDocument();
    expect(screen.getByText(`FY${CURRENT_YEAR - 1}`)).toBeInTheDocument();
    expect(screen.getByText(`FY${CURRENT_YEAR}`)).toBeInTheDocument();
    expect(screen.getByText(`FY${CURRENT_YEAR + 1}`)).toBeInTheDocument();
  });

  it('defaults to Monthly Load tab showing load components', () => {
    render(<PlanningPage />);
    expect(screen.getByTestId('shop-loading-tool')).toBeInTheDocument();
    expect(screen.getByTestId('allocation-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('allocation-list')).toBeInTheDocument();
    expect(screen.getByTestId('capacity-grid')).toBeInTheDocument();
  });

  it('does not show forecast components on monthly-load tab', () => {
    render(<PlanningPage />);
    expect(screen.queryByTestId('pipeline-summary-cards')).not.toBeInTheDocument();
    expect(screen.queryByTestId('budget-scenario-panel')).not.toBeInTheDocument();
  });

  it('shows budget link card on monthly-load tab', () => {
    render(<PlanningPage />);
    expect(screen.getByText('Budget & Demand Forecasts')).toBeInTheDocument();
    expect(screen.getByText('View Budget')).toBeInTheDocument();
  });

  it('switches to Maintenance Forecast tab and shows forecast components', () => {
    render(<PlanningPage />);
    fireEvent.click(screen.getByText('Maintenance Forecast'));

    expect(screen.getByTestId('pipeline-summary-cards')).toBeInTheDocument();
    expect(screen.getByTestId('budget-scenario-panel')).toBeInTheDocument();
    expect(screen.getByTestId('forecast-summary')).toBeInTheDocument();
  });

  it('hides monthly-load components after switching to forecast tab', () => {
    render(<PlanningPage />);
    fireEvent.click(screen.getByText('Maintenance Forecast'));

    expect(screen.queryByTestId('shop-loading-tool')).not.toBeInTheDocument();
    expect(screen.queryByTestId('allocation-timeline')).not.toBeInTheDocument();
    expect(screen.queryByTestId('allocation-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('capacity-grid')).not.toBeInTheDocument();
  });

  it('passes fiscalYear to forecast child components', () => {
    render(<PlanningPage />);
    fireEvent.click(screen.getByText('Maintenance Forecast'));

    expect(screen.getByText(`PipelineSummaryCards FY${CURRENT_YEAR}`)).toBeInTheDocument();
    expect(screen.getByText(`BudgetScenarioPanel FY${CURRENT_YEAR}`)).toBeInTheDocument();
  });

  it('shows Pipeline and Budget Breakdown headers on forecast tab', () => {
    render(<PlanningPage />);
    fireEvent.click(screen.getByText('Maintenance Forecast'));

    expect(screen.getByText(`Pipeline — FY${CURRENT_YEAR}`)).toBeInTheDocument();
    expect(screen.getByText(`Budget Breakdown — FY${CURRENT_YEAR}`)).toBeInTheDocument();
  });

  it('expands Budget Breakdown on click', () => {
    render(<PlanningPage />);
    fireEvent.click(screen.getByText('Maintenance Forecast'));

    // Initially shows compact forecast summary
    expect(screen.getByText(`ForecastSummary FY${CURRENT_YEAR} compact`)).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText(`Budget Breakdown — FY${CURRENT_YEAR}`));

    // Now shows non-compact forecast summary
    expect(screen.getByText(`ForecastSummary FY${CURRENT_YEAR}`)).toBeInTheDocument();
  });

  it('changes fiscal year via selector', () => {
    render(<PlanningPage />);
    fireEvent.click(screen.getByText('Maintenance Forecast'));

    const select = screen.getByDisplayValue(`FY${CURRENT_YEAR}`);
    fireEvent.change(select, { target: { value: String(CURRENT_YEAR + 1) } });

    expect(screen.getByText(`Pipeline — FY${CURRENT_YEAR + 1}`)).toBeInTheDocument();
    expect(screen.getByText(`PipelineSummaryCards FY${CURRENT_YEAR + 1}`)).toBeInTheDocument();
  });

  it('reads tab from searchParams', () => {
    mockGet.mockReturnValue('forecast');
    render(<PlanningPage />);

    // Should be on forecast tab
    expect(screen.getByTestId('pipeline-summary-cards')).toBeInTheDocument();
    expect(screen.queryByTestId('shop-loading-tool')).not.toBeInTheDocument();
  });

  it('passes months=6 to ShopLoadingTool and months=18 to CapacityGrid', () => {
    render(<PlanningPage />);
    expect(screen.getByText('ShopLoadingTool 6mo')).toBeInTheDocument();
    expect(screen.getByText('CapacityGrid 18mo')).toBeInTheDocument();
  });
});
