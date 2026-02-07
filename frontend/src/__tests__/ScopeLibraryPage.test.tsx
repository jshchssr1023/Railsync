import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListScopeTemplates = jest.fn();
const mockGetScopeTemplate = jest.fn();

jest.mock('@/lib/api', () => ({
  listScopeTemplates: (...args: unknown[]) => mockListScopeTemplates(...args),
  getScopeTemplate: (...args: unknown[]) => mockGetScopeTemplate(...args),
}));

// Mock next/navigation for useSearchParams
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import ScopeLibraryPage from '@/app/scope-library/page';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockListScopeTemplates.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScopeLibraryPage', () => {
  it('renders header', async () => {
    render(<ScopeLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText('Scope of Work Library')).toBeInTheDocument();
    });
  });

  it('renders subheader', async () => {
    render(<ScopeLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText('Reusable SOW templates that build organically from operations')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton initially', () => {
    mockListScopeTemplates.mockImplementation(() => new Promise(() => {}));
    render(<ScopeLibraryPage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows empty state when no templates', async () => {
    render(<ScopeLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText('No scope templates found')).toBeInTheDocument();
    });
  });

  it('calls listScopeTemplates on mount', async () => {
    render(<ScopeLibraryPage />);
    await waitFor(() => {
      expect(mockListScopeTemplates).toHaveBeenCalled();
    });
  });
});
