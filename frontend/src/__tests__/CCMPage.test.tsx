import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCCMHierarchyTree = jest.fn();
const mockListCCMInstructions = jest.fn();
const mockGetCCMInstruction = jest.fn();
const mockGetCCMInstructionByScope = jest.fn();
const mockGetParentCCM = jest.fn();
const mockCreateCCMInstruction = jest.fn();
const mockUpdateCCMInstruction = jest.fn();

jest.mock('@/lib/api', () => ({
  getCCMHierarchyTree: (...args: unknown[]) => mockGetCCMHierarchyTree(...args),
  listCCMInstructions: (...args: unknown[]) => mockListCCMInstructions(...args),
  getCCMInstruction: (...args: unknown[]) => mockGetCCMInstruction(...args),
  getCCMInstructionByScope: (...args: unknown[]) => mockGetCCMInstructionByScope(...args),
  getParentCCM: (...args: unknown[]) => mockGetParentCCM(...args),
  createCCMInstruction: (...args: unknown[]) => mockCreateCCMInstruction(...args),
  updateCCMInstruction: (...args: unknown[]) => mockUpdateCCMInstruction(...args),
}));

// Mock next/navigation for useSearchParams
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// Mock CCM sub-components
jest.mock('@/components/ccm', () => ({
  HierarchyTreePicker: () => <div data-testid="hierarchy-picker" />,
  InheritanceChainDisplay: () => <div data-testid="inheritance-chain" />,
  CCMInstructionEditor: () => <div data-testid="ccm-editor" />,
}));

import CCMPage from '@/app/ccm/page';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCCMHierarchyTree.mockResolvedValue([]);
  mockListCCMInstructions.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CCMPage', () => {
  it('renders header', async () => {
    render(<CCMPage />);
    await waitFor(() => {
      expect(screen.getByText('Customer Care Manuals')).toBeInTheDocument();
    });
  });

  it('renders subheader', async () => {
    render(<CCMPage />);
    await waitFor(() => {
      expect(screen.getByText('Manage CCM instructions at customer, lease, rider, or amendment level')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton initially', () => {
    mockListCCMInstructions.mockImplementation(() => new Promise(() => {}));
    mockGetCCMHierarchyTree.mockImplementation(() => new Promise(() => {}));
    render(<CCMPage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows empty state when no instructions', async () => {
    render(<CCMPage />);
    await waitFor(() => {
      expect(screen.getByText('No CCM instructions found')).toBeInTheDocument();
    });
  });

  it('renders Browse tab', async () => {
    render(<CCMPage />);
    await waitFor(() => {
      expect(screen.getByText('Browse')).toBeInTheDocument();
    });
  });

  it('calls listCCMInstructions on mount', async () => {
    render(<CCMPage />);
    await waitFor(() => {
      expect(mockListCCMInstructions).toHaveBeenCalled();
    });
  });
});
