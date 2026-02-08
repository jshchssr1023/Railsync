'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Circle,
  Keyboard,
  Palette,
  ListChecks,
  GraduationCap,
  ShoppingCart,
  Receipt,
  CalendarRange,
  Train,
  BarChart3,
  Shield,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getUserTrainingProgress,
  startTrainingModule,
  completeTrainingModule,
  getUserCertifications,
} from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrainingStep {
  label: string;
  detail: string;
}

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  steps: TrainingStep[];
}

// ---------------------------------------------------------------------------
// Module definitions
// ---------------------------------------------------------------------------

const MODULES: TrainingModule[] = [
  {
    id: 'getting-started',
    title: 'Module 1: Getting Started',
    description: 'System navigation, dashboard overview, and personalizing your workspace.',
    icon: <BookOpen className="w-5 h-5" />,
    steps: [
      {
        label: 'System Navigation',
        detail:
          'Use the collapsible sidebar to move between sections. Groups expand to reveal child pages. The breadcrumb bar at the top shows your current location and lets you jump back to parent pages.',
      },
      {
        label: 'Keyboard Shortcuts',
        detail:
          'Press Cmd+K (Mac) or Ctrl+K (Windows) to open the global command bar. Type any page name, car initial, or shop code to jump directly. Press "?" to view all available shortcuts.',
      },
      {
        label: 'Dashboard Overview',
        detail:
          'The configurable dashboard shows widgets for shopping events, invoice queues, plan status, and more. Drag widgets to rearrange, or click the gear icon to add/remove widgets.',
      },
      {
        label: 'User Settings & Preferences',
        detail:
          'Navigate to Settings to configure your default views, notification preferences, dark/light theme, and table density. Changes persist across sessions.',
      },
    ],
  },
  {
    id: 'shopping-workflow',
    title: 'Module 2: Shopping Workflow',
    description: 'Creating requests, managing the 15-state lifecycle, estimates, and releases.',
    icon: <ShoppingCart className="w-5 h-5" />,
    steps: [
      {
        label: 'Creating Shopping Requests',
        detail:
          'Go to Shopping > New Request. Select the car by initial/number, choose the repair scope from the SOW Library, and assign a target shop. The system validates qualification and capacity before allowing submission.',
      },
      {
        label: 'Shopping Event Lifecycle (15 States)',
        detail:
          'Events progress through: Draft -> Submitted -> Pending Review -> Quoted -> Estimate Review -> Approved -> Released -> In Transit -> Arrived -> In Progress -> Completed -> Invoiced -> Closed. Events may also enter Cancelled or On Hold states. Each transition is logged with user and timestamp.',
      },
      {
        label: 'Estimate Review and Approval',
        detail:
          'When a shop submits an estimate, it appears in your Estimate Review queue. Compare the quoted price against the scope library benchmark. Approve, reject with comments, or request revision. Approved estimates unlock the Release action.',
      },
      {
        label: 'Release Management',
        detail:
          'Releasing a shopping event sends a formal authorization to the shop. Releases are batched per shop and can be exported as PDFs. Once released, the event cannot be edited without creating a change order.',
      },
    ],
  },
  {
    id: 'invoice-processing',
    title: 'Module 3: Invoice Processing',
    description: 'Invoice case queue, BRC comparison, validation, approval, and SAP posting.',
    icon: <Receipt className="w-5 h-5" />,
    steps: [
      {
        label: 'Invoice Case Queue',
        detail:
          'The Invoice Cases page shows all incoming invoices organized by status: New, In Review, Pending Approval, Approved, Posted, and Disputed. Use filters to narrow by shop, date range, or amount threshold.',
      },
      {
        label: 'BRC Comparison',
        detail:
          'Each invoice case compares the shop\'s billed amount against the Billing Reference Cost (BRC). The system highlights line-item variances. Red flags indicate amounts exceeding the configured tolerance (default 5%). Review each flagged line before approving.',
      },
      {
        label: 'Validation Rules',
        detail:
          'The system runs automated validation checks: duplicate detection, rate verification against contracts, scope-of-work alignment, and tax calculations. Failed validations block approval until resolved or overridden by an authorized user.',
      },
      {
        label: 'Approval Workflow',
        detail:
          'Invoices within the auto-approval threshold are approved automatically. Invoices exceeding the threshold require manual review. Multi-tier approval is enforced for high-value invoices based on configurable dollar thresholds.',
      },
      {
        label: 'SAP Posting',
        detail:
          'Approved invoices are queued for SAP posting. The system generates the posting payload, submits to SAP via RFC, and records the SAP document number. Failed postings are retried automatically up to 3 times before requiring manual intervention.',
      },
    ],
  },
  {
    id: 'planning-allocation',
    title: 'Module 4: Planning & Allocation',
    description: 'Master plans, monthly load planning, capacity, and demand forecasting.',
    icon: <CalendarRange className="w-5 h-5" />,
    steps: [
      {
        label: 'Master Plans',
        detail:
          'Master Plans define annual repair targets by car type and scope. Navigate to Planning > Plans to create, edit, or lock a master plan. Locking a plan makes it the system-of-record baseline for allocation and variance tracking.',
      },
      {
        label: 'Monthly Load Planning',
        detail:
          'The monthly planner allocates repair volume across shops for each month. Drag-and-drop cards between shops or use the bulk allocation tool. The system enforces capacity limits and qualification requirements.',
      },
      {
        label: 'Capacity Management',
        detail:
          'Each shop has a defined monthly capacity (slots) by repair type. View capacity utilization on the Planning dashboard. Overallocation triggers a warning. Capacity can be adjusted by shop managers with approval.',
      },
      {
        label: 'Demand Forecasting',
        detail:
          'The system projects future repair demand based on fleet age, mileage, and historical failure rates. Review forecasts on the Budget & Forecasts page. Adjust assumptions to run what-if scenarios.',
      },
    ],
  },
  {
    id: 'contracts-cars',
    title: 'Module 5: Contracts & Cars',
    description: 'Contract hierarchy, car browse/detail, qualifications, and UMLER specs.',
    icon: <Train className="w-5 h-5" />,
    steps: [
      {
        label: 'Contract Hierarchy Navigation',
        detail:
          'Contracts are organized as: Master Agreement -> Contract -> Rate Schedule -> Line Item. Use the tree view on the Contracts page to drill into any level. Each node shows effective dates, status, and linked shops.',
      },
      {
        label: 'Car Browse and Detail Views',
        detail:
          'The Cars page supports filtering by initial, number, type, and status. Click any car to see its full detail view: current location, repair history, active shopping events, and UMLER specifications.',
      },
      {
        label: 'Qualification Tracking',
        detail:
          'Qualifications define which shops are certified to perform which repair types. View the qualification matrix on the Qualifications page. Expired or pending qualifications are flagged. Shopping events validate qualifications at submission time.',
      },
      {
        label: 'UMLER Specifications',
        detail:
          'Car detail views include UMLER data: car type, load limit, dimensions, and component registry. This data is synced nightly from the industry UMLER database and cannot be edited in RailSync.',
      },
    ],
  },
  {
    id: 'billing-reporting',
    title: 'Module 6: Billing & Reporting',
    description: 'Monthly billing runs, cost allocation, analytics, and custom reports.',
    icon: <BarChart3 className="w-5 h-5" />,
    steps: [
      {
        label: 'Monthly Billing Runs',
        detail:
          'Navigate to Billing to initiate a monthly billing run. The system aggregates approved invoices, applies contractual adjustments (rebates, penalties), and generates a billing summary per shop. Review and confirm before finalizing.',
      },
      {
        label: 'Cost Allocation',
        detail:
          'Costs are allocated to car owners based on the repair scope and contract terms. The Cost Analytics page breaks down spend by owner, car type, shop, and repair category. Export to CSV or PDF for finance reporting.',
      },
      {
        label: 'Analytics Dashboard',
        detail:
          'The Analytics page provides visual dashboards: spend trends, shop utilization, turnaround time distributions, and variance analysis. Use date range filters and grouping controls to customize views.',
      },
      {
        label: 'Custom Reports',
        detail:
          'The Reports page offers pre-built report templates (e.g., Monthly Spend Summary, Shop Scorecard, Overdue Invoices). Select a template, configure parameters, and generate on demand. Reports can be scheduled for recurring email delivery.',
      },
    ],
  },
  {
    id: 'admin-operations',
    title: 'Module 7: Admin Operations',
    description: 'User management, rules, integration monitoring, and system health.',
    icon: <Shield className="w-5 h-5" />,
    steps: [
      {
        label: 'User Management',
        detail:
          'Admins can add, edit, and deactivate users from the Admin > Users page. Assign roles (Admin, Planner, Reviewer, Viewer) that control page access and action permissions. Role changes take effect on next login.',
      },
      {
        label: 'Rules Configuration',
        detail:
          'Business rules (approval thresholds, auto-routing, validation tolerances) are managed on the Rules page. Each rule has a name, condition, action, and priority. Changes are versioned and auditable.',
      },
      {
        label: 'Integration Monitoring',
        detail:
          'The Integrations page shows the health of all external connections: SAP, UMLER, shop portals, and email services. Each integration displays last sync time, success rate, and recent errors. Failed syncs can be retried manually.',
      },
      {
        label: 'System Health',
        detail:
          'The Admin Monitoring page tracks API response times, queue depths, database performance, and error rates. Alerts are configured for threshold breaches. Use this page during go-live to verify system stability.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Keyboard shortcuts reference data
// ---------------------------------------------------------------------------

const KEYBOARD_SHORTCUTS = [
  { keys: 'Cmd/Ctrl + K', description: 'Open global command bar (search pages, cars, shops)' },
  { keys: '?', description: 'Show keyboard shortcuts help overlay' },
  { keys: 'Cmd/Ctrl + /', description: 'Toggle sidebar collapsed/expanded' },
  { keys: 'Esc', description: 'Close modal, drawer, or command bar' },
  { keys: 'Cmd/Ctrl + S', description: 'Save current form (where applicable)' },
  { keys: 'Cmd/Ctrl + Enter', description: 'Submit / confirm action' },
  { keys: 'J / K', description: 'Navigate up/down in lists and tables' },
  { keys: 'Enter', description: 'Open selected row detail' },
];

// ---------------------------------------------------------------------------
// Status color legend
// ---------------------------------------------------------------------------

const STATUS_COLORS = [
  { color: 'bg-green-500', label: 'Green', meaning: 'Active, Approved, Passed, Healthy, Completed' },
  { color: 'bg-yellow-500', label: 'Yellow', meaning: 'Warning, Pending Review, In Progress, Investigating' },
  { color: 'bg-red-500', label: 'Red', meaning: 'Failed, Rejected, Overdue, Critical, Blocked' },
  { color: 'bg-blue-500', label: 'Blue', meaning: 'Informational, Draft, New, In Transit' },
  { color: 'bg-gray-400', label: 'Gray', meaning: 'Inactive, Closed, Cancelled, Archived' },
  { color: 'bg-purple-500', label: 'Purple', meaning: 'On Hold, Deferred, Escalated' },
];

// ---------------------------------------------------------------------------
// Common workflows checklist
// ---------------------------------------------------------------------------

const COMMON_WORKFLOWS = [
  'Create a shopping request, get estimate, approve, and release',
  'Review incoming invoice, validate BRC, approve, and post to SAP',
  'Build monthly load plan and assign cars to shops',
  'Run a monthly billing cycle and export the summary',
  'Add a new user and assign the appropriate role',
  'Check integration health before end-of-day processing',
  'Generate a Shop Scorecard report for the current quarter',
  'Lock a master plan to establish the annual baseline',
];

// ---------------------------------------------------------------------------
// localStorage fallback key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'railsync_training_progress';

type ProgressMap = Record<string, boolean>;

function loadLocalProgress(): ProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalProgress(map: ProgressMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

// Module ID mapping (frontend static IDs → backend module titles for matching)
const MODULE_ID_MAP: Record<string, string> = {
  'getting-started': 'System Navigation',
  'shopping-workflow': 'Shopping Workflow',
  'invoice-processing': 'Invoice Processing',
  'planning-allocation': 'Planning & Allocations',
  'contracts-cars': 'Car & Fleet Management',
  'billing-reporting': 'Contracts & Billing',
  'admin-operations': 'Admin & Configuration',
};

// ===========================================================================
// Page Component
// ===========================================================================

export default function TrainingPage() {
  const { isAuthenticated } = useAuth();

  // Completion progress — synced with backend, localStorage fallback
  const [progress, setProgress] = useState<ProgressMap>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [certifications, setCertifications] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Load progress from backend on mount, fall back to localStorage
  useEffect(() => {
    if (!isAuthenticated) {
      setProgress(loadLocalProgress());
      return;
    }
    setSyncing(true);
    getUserTrainingProgress()
      .then(data => {
        if (data?.modules?.length > 0) {
          const map: ProgressMap = {};
          data.modules.forEach((m: any) => {
            // Match backend module to frontend module by title
            const frontendId = Object.entries(MODULE_ID_MAP).find(
              ([, title]) => m.title?.includes(title.split(' ')[0])
            )?.[0];
            if (frontendId && m.status === 'completed') {
              map[frontendId] = true;
            }
          });
          setProgress(map);
          saveLocalProgress(map);
        } else {
          setProgress(loadLocalProgress());
        }
      })
      .catch(() => setProgress(loadLocalProgress()))
      .finally(() => setSyncing(false));

    getUserCertifications()
      .then(setCertifications)
      .catch(() => {});
  }, [isAuthenticated]);

  // Toggle module expansion
  const toggleModule = useCallback((id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Toggle module completion — sync with backend
  const toggleComplete = useCallback(async (id: string) => {
    const wasComplete = !!progress[id];
    const next = { ...progress, [id]: !wasComplete };
    setProgress(next);
    saveLocalProgress(next);

    if (isAuthenticated) {
      try {
        const title = MODULE_ID_MAP[id];
        if (title && !wasComplete) {
          // Find backend module ID by searching
          const backendProgress = await getUserTrainingProgress();
          const backendModule = backendProgress?.modules?.find(
            (m: any) => m.title?.includes(title.split(' ')[0])
          );
          if (backendModule?.module_id) {
            await startTrainingModule(backendModule.module_id);
            await completeTrainingModule(backendModule.module_id);
          }
        }
      } catch {
        // Backend sync failed, localStorage still saved
      }
    }
  }, [progress, isAuthenticated]);

  // Reset all progress
  const resetProgress = useCallback(() => {
    if (!confirm('Are you sure you want to reset all training progress? This cannot be undone.')) return;
    const empty: ProgressMap = {};
    saveLocalProgress(empty);
    setProgress(empty);
  }, []);

  // Derived stats
  const totalModules = MODULES.length;
  const completedModules = MODULES.filter(m => progress[m.id]).length;
  const pct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ============ Header ============ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Training Center</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Learn how to use RailSync for your daily operations
          </p>
        </div>
        <button
          onClick={resetProgress}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Progress
        </button>
      </div>

      {/* ============ Progress Tracker ============ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-4 mb-3">
          <GraduationCap className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Overall Progress
              </h2>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {completedModules} / {totalModules} modules completed ({pct}%)
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
        {pct === 100 && (
          <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-2">
            All modules complete -- you are ready to go!
          </p>
        )}
      </div>

      {/* ============ Certifications ============ */}
      {certifications.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary-500" />
            Earned Certifications
          </h3>
          <div className="flex flex-wrap gap-2">
            {certifications.map((cert: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                <CheckCircle className="w-3.5 h-3.5" />
                {cert.certification_type?.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ============ Training Modules ============ */}
      <div className="space-y-3">
        {MODULES.map(mod => {
          const isExpanded = !!expandedModules[mod.id];
          const isComplete = !!progress[mod.id];

          return (
            <div
              key={mod.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Module header -- clickable to expand */}
              <button
                type="button"
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                {/* Completion badge */}
                {isComplete ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                )}

                {/* Icon */}
                <span className="text-primary-600 dark:text-primary-400 flex-shrink-0">
                  {mod.icon}
                </span>

                {/* Title & description */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {mod.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {mod.description}
                  </div>
                </div>

                {/* Status badge */}
                {isComplete && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 flex-shrink-0">
                    Completed
                  </span>
                )}

                {/* Chevron */}
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
              </button>

              {/* Expandable content */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-4 space-y-4">
                    {/* Step-by-step instructions */}
                    <ul className="space-y-3">
                      {mod.steps.map((step, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-semibold flex items-center justify-center mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {step.label}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                              {step.detail}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>

                    {/* Mark as Complete toggle */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() => toggleComplete(mod.id)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                          isComplete
                            ? 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        {isComplete ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Completed -- Click to Undo
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4" />
                            Mark as Complete
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ============ Quick Reference ============ */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Quick Reference</h2>

        {/* ---- Keyboard Shortcuts Table ---- */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Keyboard Shortcuts
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {KEYBOARD_SHORTCUTS.map((sc, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-4">
                <kbd className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded whitespace-nowrap">
                  {sc.keys}
                </kbd>
                <span className="text-sm text-gray-600 dark:text-gray-400">{sc.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Status Color Legend ---- */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 flex items-center gap-2">
            <Palette className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Status Color Legend
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {STATUS_COLORS.map((sc, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${sc.color} flex-shrink-0`} />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-16">
                  {sc.label}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{sc.meaning}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Common Workflows Checklist ---- */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Common Workflows Checklist
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {COMMON_WORKFLOWS.map((wf, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{wf}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
