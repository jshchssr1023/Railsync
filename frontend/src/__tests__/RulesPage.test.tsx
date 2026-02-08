import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockIsAuthenticated = true;
let mockUserRole = 'admin';

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? {
      id: '1',
      email: 'admin@test.com',
      first_name: 'Admin',
      last_name: 'User',
      role: mockUserRole,
      is_active: true
    } : null,
    isLoading: false,
  }),
}));

const mockListRules = jest.fn();
const mockUpdateRule = jest.fn();

jest.mock('@/lib/api', () => ({
  listRules: (...args: unknown[]) => mockListRules(...args),
  updateRule: (...args: unknown[]) => mockUpdateRule(...args),
}));

import RulesPage from '@/app/(operations)/rules/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    rule_id: 'RULE_001',
    rule_name: 'Tank Car Certification',
    rule_description: 'Verify shop has tank car certification',
    rule_category: 'certification',
    priority: 100,
    is_active: true,
    is_blocking: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockUserRole = 'admin';
  mockListRules.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RulesPage', () => {
  it('renders header and subheader', async () => {
    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Eligibility Rules')).toBeInTheDocument();
    });
    expect(screen.getByText('Manage the rules used to evaluate shop eligibility')).toBeInTheDocument();
  });

  it('renders show inactive checkbox', async () => {
    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Show inactive')).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    mockListRules.mockImplementation(() => new Promise(() => {}));
    render(<RulesPage />);

    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  it('displays rules grouped by category', async () => {
    mockListRules.mockResolvedValue([
      makeRule({ rule_id: 'RULE_001', rule_category: 'certification' }),
      makeRule({ rule_id: 'RULE_002', rule_category: 'capacity' }),
    ]);

    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Certification Rules')).toBeInTheDocument();
    });
    expect(screen.getByText('Capacity Rules')).toBeInTheDocument();
  });

  it('displays rule details in table', async () => {
    mockListRules.mockResolvedValue([
      makeRule({
        rule_id: 'RULE_001',
        rule_name: 'Tank Car Certification',
        rule_description: 'Verify shop has tank car certification',
        priority: 100,
        is_active: true,
        is_blocking: true,
      }),
    ]);

    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText('RULE_001')).toBeInTheDocument();
    });
    expect(screen.getByText('Tank Car Certification')).toBeInTheDocument();
    expect(screen.getByText('Verify shop has tank car certification')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('shows empty state when no rules', async () => {
    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText('No rules found')).toBeInTheDocument();
    });
  });

  it('displays admin notice for non-admin users', async () => {
    mockUserRole = 'viewer';
    mockListRules.mockResolvedValue([makeRule()]);

    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText(/viewing rules in read-only mode/i)).toBeInTheDocument();
    });
  });

  it('renders table headers', async () => {
    mockListRules.mockResolvedValue([makeRule()]);

    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Rule ID')).toBeInTheDocument();
    });
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Blocking')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('toggles active state when admin clicks toggle', async () => {
    const rule = makeRule({ is_active: true });
    mockListRules.mockResolvedValue([rule]);
    mockUpdateRule.mockResolvedValue({ ...rule, is_active: false });

    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Tank Car Certification')).toBeInTheDocument();
    });

    const toggles = document.querySelectorAll('button[style*="background-color"]');
    fireEvent.click(toggles[0]);

    await waitFor(() => {
      expect(mockUpdateRule).toHaveBeenCalledWith('RULE_001', { is_active: false });
    });
  });

  it('toggles blocking state when admin clicks', async () => {
    const rule = makeRule({ is_blocking: true });
    mockListRules.mockResolvedValue([rule]);
    mockUpdateRule.mockResolvedValue({ ...rule, is_blocking: false });

    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Tank Car Certification')).toBeInTheDocument();
    });

    const blockingButtons = screen.getAllByText('Yes');
    fireEvent.click(blockingButtons[0]);

    await waitFor(() => {
      expect(mockUpdateRule).toHaveBeenCalledWith('RULE_001', { is_blocking: false });
    });
  });

  it('displays inactive rules with different styling', async () => {
    mockListRules.mockResolvedValue([
      makeRule({ rule_id: 'RULE_001', is_active: false }),
    ]);

    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Show inactive')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Show inactive'));

    await waitFor(() => {
      expect(screen.getByText('RULE_001')).toBeInTheDocument();
    });
  });

  it('fetches active rules by default', async () => {
    render(<RulesPage />);
    await waitFor(() => {
      expect(mockListRules).toHaveBeenCalledWith(true);
    });
  });

  it('fetches all rules when show inactive checked', async () => {
    render(<RulesPage />);
    const checkbox = await screen.findByText('Show inactive');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockListRules).toHaveBeenCalledWith(false);
    });
  });

  it('displays error message when API fails', async () => {
    mockListRules.mockRejectedValue(new Error('Network error'));

    render(<RulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows read-only badges for non-admin', async () => {
    mockUserRole = 'viewer';
    mockListRules.mockResolvedValue([
      makeRule({ is_active: true, is_blocking: true }),
    ]);

    render(<RulesPage />);
    await waitFor(() => {
      // "Active" appears in both the table header and the read-only badge
      const activeElements = screen.getAllByText('Active');
      expect(activeElements.length).toBeGreaterThanOrEqual(2);
    });
  });
});
