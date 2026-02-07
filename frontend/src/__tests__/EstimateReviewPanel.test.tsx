import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EstimateReviewPanel from '@/components/EstimateReviewPanel';

// Mock the API
jest.mock('@/lib/api', () => ({
  getEstimate: jest.fn(),
  getEstimateDecisions: jest.fn(),
  recordLineDecisions: jest.fn(),
  generateApprovalPacket: jest.fn(),
}));

// Mock ConfirmDialog
jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirmDialog({ open, onConfirm, onCancel, title }: any) {
    if (!open) return null;
    return (
      <div role="dialog" data-testid="confirm-dialog">
        <p>{title}</p>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel Dialog</button>
      </div>
    );
  };
});

import { getEstimate, getEstimateDecisions } from '@/lib/api';
const mockGetEstimate = getEstimate as jest.MockedFunction<typeof getEstimate>;
const mockGetEstimateDecisions = getEstimateDecisions as jest.MockedFunction<typeof getEstimateDecisions>;

function createMockEstimate(overrides: Record<string, any> = {}) {
  return {
    id: 'est-1',
    shopping_event_id: 'se-1',
    version_number: 1,
    status: 'submitted' as const,
    total_cost: 15000,
    total_labor_hours: 40,
    total_material_cost: 8000,
    submitted_by: 'user-1',
    submitted_at: '2026-01-15T00:00:00Z',
    notes: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    lines: [],
    ...overrides,
  };
}

function createMockLine(overrides: Record<string, any> = {}) {
  return {
    id: 'line-1',
    estimate_id: 'est-1',
    job_code: 'JC001',
    description: 'Valve Replacement',
    quantity: 2,
    unit_cost: 500,
    total_cost: 1000,
    labor_hours: 4,
    material_cost: 600,
    category: 'mechanical',
    ...overrides,
  };
}

describe('EstimateReviewPanel', () => {
  const defaultProps = {
    shoppingEventId: 'se-1',
    estimates: [createMockEstimate()],
    onEstimatesChange: jest.fn(),
    onApprovalComplete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEstimate.mockResolvedValue({
      ...createMockEstimate(),
      lines: [createMockLine()],
    } as any);
    mockGetEstimateDecisions.mockResolvedValue([] as any);
  });

  it('renders with no estimates message when empty', () => {
    render(<EstimateReviewPanel {...defaultProps} estimates={[]} />);
    expect(screen.getByText(/No estimates submitted/i)).toBeInTheDocument();
  });

  it('renders estimate version card with v prefix', () => {
    render(<EstimateReviewPanel {...defaultProps} />);
    expect(screen.getByText('v1')).toBeInTheDocument();
  });

  it('shows estimate status badge', () => {
    render(<EstimateReviewPanel {...defaultProps} />);
    const badges = screen.getAllByText('submitted');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows Estimate Cost Summary heading', () => {
    render(<EstimateReviewPanel {...defaultProps} />);
    const headings = screen.getAllByText('Estimate Cost Summary');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('shows total cost formatted as currency', () => {
    render(<EstimateReviewPanel {...defaultProps} />);
    const costElements = screen.getAllByText('$15,000.00');
    expect(costElements.length).toBeGreaterThan(0);
  });

  it('expands estimate on click to load details', async () => {
    render(<EstimateReviewPanel {...defaultProps} />);
    const versionBtn = screen.getByText('v1').closest('button')!;
    fireEvent.click(versionBtn);

    await waitFor(() => {
      expect(mockGetEstimate).toHaveBeenCalledWith('est-1');
    });
  });

  it('shows multiple estimate versions', () => {
    const estimates = [
      createMockEstimate({ id: 'est-1', version_number: 1, total_cost: 10000 }),
      createMockEstimate({ id: 'est-2', version_number: 2, total_cost: 12000 }),
    ];

    render(<EstimateReviewPanel {...defaultProps} estimates={estimates} />);
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
  });

  it('shows Compare versions button when multiple versions exist', () => {
    const estimates = [
      createMockEstimate({ id: 'est-1', version_number: 1 }),
      createMockEstimate({ id: 'est-2', version_number: 2 }),
    ];

    render(<EstimateReviewPanel {...defaultProps} estimates={estimates} />);
    expect(screen.getByText('Compare versions')).toBeInTheDocument();
  });

  it('does not show Compare button for single version', () => {
    render(<EstimateReviewPanel {...defaultProps} />);
    expect(screen.queryByText('Compare versions')).not.toBeInTheDocument();
  });

  it('shows approved status for approved estimates', () => {
    const estimates = [createMockEstimate({ status: 'approved' })];
    render(<EstimateReviewPanel {...defaultProps} estimates={estimates} />);
    const approvedBadges = screen.getAllByText('approved');
    expect(approvedBadges.length).toBeGreaterThan(0);
  });

  it('handles API error gracefully when loading estimate', async () => {
    mockGetEstimate.mockRejectedValue(new Error('Network error'));

    render(<EstimateReviewPanel {...defaultProps} />);
    const versionBtn = screen.getByText('v1').closest('button')!;
    fireEvent.click(versionBtn);

    // Should not crash, just fail silently
    await waitFor(() => {
      expect(mockGetEstimate).toHaveBeenCalled();
    });
  });

  it('toggles compare mode on button click', () => {
    const estimates = [
      createMockEstimate({ id: 'est-1', version_number: 1 }),
      createMockEstimate({ id: 'est-2', version_number: 2 }),
    ];

    render(<EstimateReviewPanel {...defaultProps} estimates={estimates} />);
    const compareBtn = screen.getByText('Compare versions');
    fireEvent.click(compareBtn);
    expect(screen.getByText('Hide comparison')).toBeInTheDocument();
  });
});
