import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAccessToken = jest.fn(() => 'mock-token');
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isLoading: false,
    getAccessToken: mockGetAccessToken,
  }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/components/Toast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirmDialog({ open, onConfirm, onCancel }: {
    open: boolean; onConfirm: () => void; onCancel: () => void;
  }) {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  };
});

jest.mock('@/components/ProjectPlanView', () => {
  return function MockProjectPlanView() {
    return <div data-testid="project-plan-view">ProjectPlanView</div>;
  };
});

jest.mock('@/components/LockConfirmationModal', () => {
  return function MockLockConfirmationModal() {
    return <div data-testid="lock-modal" />;
  };
});

jest.mock('@/components/RelockDialog', () => {
  return function MockRelockDialog() {
    return <div data-testid="relock-dialog" />;
  };
});

jest.mock('@/components/CreateDemandDialog', () => {
  return function MockCreateDemandDialog() {
    return <div data-testid="create-demand-dialog" />;
  };
});

jest.mock('@/components/CommunicationLog', () => {
  return function MockCommunicationLog() {
    return <div data-testid="communication-log">CommunicationLog</div>;
  };
});

jest.mock('@/components/PlanHistoryTimeline', () => {
  return function MockPlanHistoryTimeline() {
    return <div data-testid="plan-history">PlanHistoryTimeline</div>;
  };
});

jest.mock('@/lib/api', () => ({
  unlockProjectAssignment: jest.fn(),
}));

const mockFetch = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

import ProjectsPage from '@/app/projects/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    project_number: 'PRJ-2026-001',
    project_name: 'Q1 Tank Qualifications',
    project_type: 'qualification',
    scope_of_work: 'Annual tank qualifications',
    status: 'active',
    total_cars: '25',
    pending_cars: '10',
    in_progress_cars: '10',
    completed_cars: '5',
    deadline_status: 'Due This Month',
    created_at: '2026-01-01T00:00:00Z',
    lessee_name: 'Acme Corp',
    ...overrides,
  };
}

function mockDefaultFetch(
  projects: ReturnType<typeof makeProject>[] = [],
  summaryByType: Record<string, unknown>[] = [],
) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/projects/summary')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { by_type: summaryByType, by_mc: [] } }),
      });
    }
    if (url.includes('/projects') && !url.includes('/projects/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: projects }),
      });
    }
    // Detail endpoint — return first project with cars
    if (url.match(/\/projects\/[^/]+$/)) {
      const proj = projects[0] || makeProject();
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { ...proj, cars: [] } }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDefaultFetch();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectsPage', () => {
  it('renders header and subheader', async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });
    expect(screen.getByText(/Group cars for coordinated work/)).toBeInTheDocument();
  });

  it('renders new project button', async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText('+ New Project')).toBeInTheDocument();
    });
  });

  it('renders search filter', async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search project name, number, lessee/)).toBeInTheDocument();
    });
  });

  it('renders type and status filters', async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Type').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Active Only')).toBeInTheDocument();
  });

  it('displays project list with data', async () => {
    mockDefaultFetch([
      makeProject({ id: '1', project_number: 'PRJ-2026-001', project_name: 'Q1 Tank Quals', status: 'active' }),
      makeProject({ id: '2', project_number: 'PRJ-2026-002', project_name: 'Q2 Assignments', status: 'draft' }),
    ]);

    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText('PRJ-2026-001')).toBeInTheDocument();
    });
    expect(screen.getByText('PRJ-2026-002')).toBeInTheDocument();
    expect(screen.getByText('Q1 Tank Quals')).toBeInTheDocument();
  });

  it('shows empty state when no projects', async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText('No projects found')).toBeInTheDocument();
    });
  });

  it('displays summary cards', async () => {
    mockDefaultFetch(
      [makeProject()],
      [{ project_type: 'qualification', total: '10', active: '5', in_progress: '3', completed: '2', overdue: '1' }],
    );

    render(<ProjectsPage />);
    await waitFor(() => {
      // "qualification" appears in summary card AND table type badge
      expect(screen.getAllByText('qualification').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('opens project detail when row clicked', async () => {
    mockDefaultFetch([makeProject()]);

    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText('PRJ-2026-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('PRJ-2026-001'));
    await waitFor(() => {
      expect(screen.getByText('Scope of Work')).toBeInTheDocument();
    });
  });

  it('renders tabs in detail panel', async () => {
    mockDefaultFetch([makeProject()]);

    render(<ProjectsPage />);
    const projectRow = await screen.findByText('PRJ-2026-001');
    fireEvent.click(projectRow);

    await waitFor(() => {
      expect(screen.getByText(/Cars \(/)).toBeInTheDocument();
    });
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Communications')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('renders activate button for draft projects', async () => {
    mockDefaultFetch([makeProject({ status: 'draft' })]);

    render(<ProjectsPage />);
    const projectRow = await screen.findByText('PRJ-2026-001');
    fireEvent.click(projectRow);

    await waitFor(() => {
      expect(screen.getByText('Activate Project')).toBeInTheDocument();
    });
  });

  it('renders add cars and complete buttons for active projects', async () => {
    mockDefaultFetch([makeProject({ status: 'active' })]);

    render(<ProjectsPage />);
    const projectRow = await screen.findByText('PRJ-2026-001');
    fireEvent.click(projectRow);

    await waitFor(() => {
      expect(screen.getByText('+ Add Cars')).toBeInTheDocument();
    });
    expect(screen.getByText('Complete Project')).toBeInTheDocument();
  });

  it('shows loading state', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<ProjectsPage />);

    await waitFor(() => {
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  it('opens create project modal when button clicked', async () => {
    render(<ProjectsPage />);
    const newButton = await screen.findByText('+ New Project');
    fireEvent.click(newButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Project')).toBeInTheDocument();
    });
  });

  it('displays project progress cards', async () => {
    mockDefaultFetch([makeProject()]);

    render(<ProjectsPage />);
    const projectRow = await screen.findByText('PRJ-2026-001');
    fireEvent.click(projectRow);

    await waitFor(() => {
      expect(screen.getByText('Total Cars')).toBeInTheDocument();
    });
    expect(screen.getByText('Pending')).toBeInTheDocument();
    // "In Progress" appears in both detail progress card and status filter option
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    // "Completed" appears in both detail progress card and status filter option
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
  });
});
