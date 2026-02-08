'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search, X, User, FileText, Train, Building2,
  ShoppingCart, FolderKanban, Clock,
  Upload, BarChart3, LayoutDashboard, DollarSign,
  Hash, ArrowRight,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Route label mapping (mirrors Breadcrumbs.tsx for recently-visited titles)
// ---------------------------------------------------------------------------
const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  shopping: 'Shopping Events',
  shops: 'Shop Finder',
  cars: 'Cars',
  planning: 'Quick Shop',
  pipeline: 'Pipeline',
  plans: 'Master Plans',
  contracts: 'Contracts',
  projects: 'Projects',
  invoices: 'Invoices',
  'invoice-cases': 'Case Queue',
  budget: 'Budget & Forecasts',
  analytics: 'Analytics',
  'cost-analytics': 'Cost Analytics',
  'shop-performance': 'Shop Performance',
  reports: 'Report Builder',
  audit: 'Audit Log',
  settings: 'Settings',
  rules: 'Rules',
  ccm: 'Care Manuals',
  'scope-library': 'SOW Library',
  'bad-orders': 'Bad Orders',
  qualifications: 'Qualifications',
  billing: 'Billing',
  integrations: 'Integrations',
  'fleet-location': 'Fleet Location',
  releases: 'Release Management',
  transfers: 'Contract Transfers',
  estimates: 'Estimate Review',
  commodities: 'Commodities',
  'billable-items': 'Billable Items',
  notifications: 'Notifications',
  customers: 'Customers',
  freight: 'Freight Calculator',
  'service-events': 'Service Events',
  'components-registry': 'Components',
  riders: 'Contract Riders',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ResultType = 'customer' | 'car' | 'shop' | 'invoice' | 'shopping_event' | 'contract' | 'project';

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcutHint: string;
}

interface RecentPage {
  path: string;
  title: string;
  timestamp: number;
}

interface SlashFilter {
  command: string;
  label: string;
  type: ResultType | 'customer'; // type filter to apply
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const RECENT_PAGES_KEY = 'railsync_recent_pages';
const MAX_RECENT_PAGES = 5;

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'create-shopping',
    label: 'Create Shopping Event',
    href: '/shopping?action=create',
    icon: <ShoppingCart className="w-4 h-4" />,
    shortcutHint: 'Ctrl+Shift+S',
  },
  {
    id: 'upload-invoice',
    label: 'Upload Invoice',
    href: '/invoices?action=upload',
    icon: <Upload className="w-4 h-4" />,
    shortcutHint: 'Ctrl+Shift+I',
  },
  {
    id: 'view-pipeline',
    label: 'View Pipeline',
    href: '/pipeline',
    icon: <BarChart3 className="w-4 h-4" />,
    shortcutHint: 'Ctrl+Shift+P',
  },
  {
    id: 'view-dashboard',
    label: 'View Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    shortcutHint: 'Ctrl+Shift+D',
  },
  {
    id: 'open-budget',
    label: 'Open Budget',
    href: '/budget',
    icon: <DollarSign className="w-4 h-4" />,
    shortcutHint: 'Ctrl+Shift+B',
  },
];

const SLASH_FILTERS: SlashFilter[] = [
  { command: '/cars', label: 'Filter to Cars', type: 'car', icon: <Train className="w-4 h-4" /> },
  { command: '/shops', label: 'Filter to Shops', type: 'shop', icon: <Building2 className="w-4 h-4" /> },
  { command: '/invoices', label: 'Filter to Invoices', type: 'invoice', icon: <FileText className="w-4 h-4" /> },
  { command: '/shopping', label: 'Filter to Shopping Events', type: 'shopping_event', icon: <ShoppingCart className="w-4 h-4" /> },
  { command: '/customers', label: 'Filter to Customers', type: 'customer', icon: <User className="w-4 h-4" /> },
  { command: '/contracts', label: 'Filter to Contracts', type: 'contract', icon: <FolderKanban className="w-4 h-4" /> },
  { command: '/projects', label: 'Filter to Projects', type: 'project', icon: <FolderKanban className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getRecentPages(): RecentPage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_PAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentPage[];
  } catch {
    return [];
  }
}

function addRecentPage(path: string): void {
  if (typeof window === 'undefined') return;
  // Skip root and empty paths
  if (!path || path === '/') return;
  // Derive title from the first meaningful segment
  const segments = path.split('/').filter(Boolean);
  const firstSegment = segments[0] || '';
  const title = ROUTE_LABELS[firstSegment] || firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1).replace(/-/g, ' ');

  try {
    const existing = getRecentPages();
    // Remove duplicate path if it exists
    const filtered = existing.filter((p) => p.path !== path);
    // Add to front
    const updated = [{ path, title, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_PAGES);
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be full or unavailable; silently ignore
  }
}

function getResultTypeColor(type: ResultType): string {
  switch (type) {
    case 'customer':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400';
    case 'car':
      return 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400';
    case 'shop':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400';
    case 'invoice':
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400';
    case 'shopping_event':
      return 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400';
    case 'contract':
      return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400';
    case 'project':
      return 'bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-900/50 dark:text-gray-400';
  }
}

function getResultTypeLabel(type: ResultType): string {
  switch (type) {
    case 'customer': return 'Customer';
    case 'car': return 'Car';
    case 'shop': return 'Shop';
    case 'invoice': return 'Invoice';
    case 'shopping_event': return 'Shopping';
    case 'contract': return 'Contract';
    case 'project': return 'Project';
    default: return type;
  }
}

function getIcon(type: ResultType): React.ReactNode {
  switch (type) {
    case 'customer': return <User className="w-4 h-4" />;
    case 'car': return <Train className="w-4 h-4" />;
    case 'shop': return <Building2 className="w-4 h-4" />;
    case 'invoice': return <FileText className="w-4 h-4" />;
    case 'shopping_event': return <ShoppingCart className="w-4 h-4" />;
    case 'contract': return <FolderKanban className="w-4 h-4" />;
    case 'project': return <FolderKanban className="w-4 h-4" />;
    default: return <Search className="w-4 h-4" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GlobalCommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<ResultType | null>(null);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // -------------------------------------------------------------------------
  // Track page visits for "Recently Visited"
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (pathname) {
      addRecentPage(pathname);
    }
  }, [pathname]);

  // Load recent pages when command bar opens
  useEffect(() => {
    if (open) {
      setRecentPages(getRecentPages());
    }
  }, [open]);

  // -------------------------------------------------------------------------
  // Keyboard shortcut to open (Ctrl+K)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened; reset state
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults([]);
      setActiveFilter(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // -------------------------------------------------------------------------
  // Determine what mode we are in based on query
  // -------------------------------------------------------------------------
  const isSlashMode = query.startsWith('/') && !activeFilter;
  const matchingSlashFilters = useMemo(() => {
    if (!isSlashMode) return [];
    const q = query.toLowerCase();
    return SLASH_FILTERS.filter((f) => f.command.startsWith(q));
  }, [isSlashMode, query]);

  // Extract the actual search term (after slash filter is applied)
  const effectiveSearchQuery = useMemo(() => {
    if (activeFilter) {
      // When a filter is active, the full query is the search term
      return query;
    }
    return query;
  }, [activeFilter, query]);

  // -------------------------------------------------------------------------
  // Search debounce
  // -------------------------------------------------------------------------
  const search = useCallback(
    async (q: string, typeFilter: ResultType | null) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const searchResults: SearchResult[] = [];

        // Determine which entity types to search based on filter
        const shouldSearch = (type: ResultType) => !typeFilter || typeFilter === type;

        const fetches: Promise<void>[] = [];

        // Customers
        if (shouldSearch('customer')) {
          fetches.push(
            fetch(`${API_URL}/customers?search=${encodeURIComponent(q)}&limit=5`)
              .then((r) => r.json())
              .then((data) => {
                (data.data || []).forEach((c: any) => {
                  searchResults.push({
                    type: 'customer',
                    id: c.id,
                    title: c.name,
                    subtitle: `${c.total_cars || 0} cars`,
                    href: `/contracts?customer=${c.id}`,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Cars
        if (shouldSearch('car')) {
          fetches.push(
            fetch(`${API_URL}/cars?search=${encodeURIComponent(q)}&limit=5`)
              .then((r) => r.json())
              .then((data) => {
                (data.data || []).forEach((c: any) => {
                  searchResults.push({
                    type: 'car',
                    id: c.id,
                    title: c.car_number,
                    subtitle: `${c.product_code} • ${c.material_type || 'Unknown'}`,
                    href: `/planning?tab=quick-shop&car=${c.car_number}`,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Shops
        if (shouldSearch('shop')) {
          fetches.push(
            fetch(`${API_URL}/shops?search=${encodeURIComponent(q)}&limit=5`)
              .then((r) => r.json())
              .then((data) => {
                (data.data || []).forEach((s: any) => {
                  searchResults.push({
                    type: 'shop',
                    id: s.id,
                    title: s.name || s.shop_code,
                    subtitle: s.city ? `${s.city}, ${s.state}` : s.region,
                    href: `/shops?shop=${s.shop_code}`,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Invoices (search by invoice number via search param)
        if (shouldSearch('invoice')) {
          fetches.push(
            fetch(`${API_URL}/invoices?search=${encodeURIComponent(q)}&limit=5`)
              .then((r) => r.json())
              .then((data) => {
                (data.invoices || []).forEach((inv: any) => {
                  searchResults.push({
                    type: 'invoice',
                    id: inv.id,
                    title: inv.invoice_number || `INV-${inv.id?.slice(0, 8)}`,
                    subtitle: [inv.shop_name || inv.shop_code, inv.status].filter(Boolean).join(' • '),
                    href: `/invoices?invoice=${inv.id}`,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Shopping Events (search by car_number; the API does not have a general search param)
        if (shouldSearch('shopping_event')) {
          fetches.push(
            fetch(`${API_URL}/shopping-events?car_number=${encodeURIComponent(q)}&limit=5`)
              .then((r) => r.json())
              .then((data) => {
                (data.events || []).forEach((evt: any) => {
                  searchResults.push({
                    type: 'shopping_event',
                    id: evt.id,
                    title: evt.event_number || `SE-${evt.id?.slice(0, 8)}`,
                    subtitle: [evt.car_number, evt.state, evt.shop_code].filter(Boolean).join(' • '),
                    href: `/shopping?event=${evt.id}`,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Contracts (search via contracts-browse/cars using car number, or use customer filter)
        if (shouldSearch('contract')) {
          fetches.push(
            fetch(`${API_URL}/contracts-browse/cars?search=${encodeURIComponent(q)}&limit=5`)
              .then((r) => r.json())
              .then((data) => {
                const cars = data.data || data.cars || [];
                // Deduplicate by lease/contract info
                const seen = new Set<string>();
                cars.forEach((c: any) => {
                  const key = c.lease_number || c.contract_number || c.id;
                  if (key && !seen.has(key)) {
                    seen.add(key);
                    searchResults.push({
                      type: 'contract',
                      id: key,
                      title: c.lease_number || c.contract_number || `Contract ${key.slice(0, 8)}`,
                      subtitle: [c.lessee_name || c.customer_name, c.car_number].filter(Boolean).join(' • '),
                      href: `/contracts?contract=${key}`,
                    });
                  }
                });
              })
              .catch(() => {})
          );
        }

        // Projects (search by project number or lessee_code)
        if (shouldSearch('project')) {
          fetches.push(
            fetch(`${API_URL}/projects`)
              .then((r) => r.json())
              .then((data) => {
                const projects = data.data || [];
                const qLower = q.toLowerCase();
                const matched = projects
                  .filter((p: any) => {
                    const num = (p.project_number || '').toLowerCase();
                    const name = (p.project_name || p.name || '').toLowerCase();
                    const lessee = (p.lessee_code || '').toLowerCase();
                    return num.includes(qLower) || name.includes(qLower) || lessee.includes(qLower);
                  })
                  .slice(0, 5);
                matched.forEach((p: any) => {
                  searchResults.push({
                    type: 'project',
                    id: p.id,
                    title: p.project_number || p.name || `Project ${p.id?.slice(0, 8)}`,
                    subtitle: [p.project_type, p.status, p.lessee_code].filter(Boolean).join(' • '),
                    href: `/projects?project=${p.id}`,
                  });
                });
              })
              .catch(() => {})
          );
        }

        await Promise.all(fetches);

        setResults(searchResults);
        setSelectedIndex(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // Do not trigger search in slash-command mode (before filter is selected)
    if (isSlashMode) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => search(effectiveSearchQuery, activeFilter), 200);
    return () => clearTimeout(timer);
  }, [effectiveSearchQuery, activeFilter, isSlashMode, search]);

  // -------------------------------------------------------------------------
  // Compute a flat list of all selectable items for keyboard navigation
  // -------------------------------------------------------------------------
  const selectableItems = useMemo(() => {
    // In slash mode, the slash filters are the selectable items
    if (isSlashMode) {
      return matchingSlashFilters.map((f) => ({
        kind: 'slash' as const,
        data: f,
      }));
    }

    // If there is a search query and results, show results
    if (effectiveSearchQuery.length >= 2 && (results.length > 0 || loading)) {
      return results.map((r) => ({
        kind: 'result' as const,
        data: r,
      }));
    }

    // Otherwise show recent + quick actions
    const items: { kind: 'recent' | 'action'; data: RecentPage | QuickAction }[] = [];
    recentPages.forEach((p) => items.push({ kind: 'recent', data: p }));
    QUICK_ACTIONS.forEach((a) => items.push({ kind: 'action', data: a }));
    return items;
  }, [isSlashMode, matchingSlashFilters, effectiveSearchQuery, results, loading, recentPages]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleSelect = useCallback(
    (item: (typeof selectableItems)[number]) => {
      if (item.kind === 'slash') {
        const filter = item.data as SlashFilter;
        setActiveFilter(filter.type as ResultType);
        setQuery('');
        setSelectedIndex(0);
        inputRef.current?.focus();
        return;
      }
      if (item.kind === 'result') {
        const result = item.data as SearchResult;
        setOpen(false);
        setQuery('');
        setActiveFilter(null);
        router.push(result.href);
        return;
      }
      if (item.kind === 'recent') {
        const page = item.data as RecentPage;
        setOpen(false);
        setQuery('');
        setActiveFilter(null);
        router.push(page.path);
        return;
      }
      if (item.kind === 'action') {
        const action = item.data as QuickAction;
        setOpen(false);
        setQuery('');
        setActiveFilter(null);
        router.push(action.href);
        return;
      }
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, selectableItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectableItems[selectedIndex]) {
        handleSelect(selectableItems[selectedIndex]);
      }
    } else if (e.key === 'Backspace' && query === '' && activeFilter) {
      // Remove the active filter when backspacing with empty query
      setActiveFilter(null);
      setResults([]);
      setSelectedIndex(0);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsContainerRef.current) {
      const selected = resultsContainerRef.current.querySelector('[data-selected="true"]');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // -------------------------------------------------------------------------
  // Determine placeholder text
  // -------------------------------------------------------------------------
  const placeholderText = activeFilter
    ? `Search ${getResultTypeLabel(activeFilter).toLowerCase()}s...`
    : 'Search customers, cars, shops, invoices... or type / for filters';

  // -------------------------------------------------------------------------
  // Should we show the idle state (recent + quick actions)?
  // -------------------------------------------------------------------------
  const showIdleState = !isSlashMode && effectiveSearchQuery.length < 2 && !loading;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors min-w-[200px]"
      >
        <Search className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-mono text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
          Ctrl+K
        </kbd>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Command bar">
          <div className="min-h-screen px-4 pt-20 text-center">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/* Dialog */}
            <div className="inline-block w-full max-w-xl text-left align-middle transition-all transform bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
                <Search className="w-5 h-5 ml-4 text-gray-400 flex-shrink-0" />

                {/* Active filter badge */}
                {activeFilter && (
                  <button
                    onClick={() => {
                      setActiveFilter(null);
                      setResults([]);
                      setSelectedIndex(0);
                    }}
                    className={`ml-2 flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${getResultTypeColor(activeFilter)}`}
                    title="Click to remove filter"
                  >
                    {getIcon(activeFilter)}
                    <span>{getResultTypeLabel(activeFilter)}</span>
                    <X className="w-3 h-3 ml-0.5" />
                  </button>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholderText}
                  className="flex-1 px-4 py-4 text-gray-900 dark:text-gray-100 bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-500"
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery('');
                      setSelectedIndex(0);
                    }}
                    className="p-2 mr-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Results / Idle / Slash Command Area */}
              <div ref={resultsContainerRef} className="max-h-96 overflow-y-auto" aria-busy={loading}>

                {/* -- Slash command mode -- */}
                {isSlashMode && (
                  <div className="py-2">
                    <div className="px-4 py-1.5">
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Filter by type
                      </span>
                    </div>
                    {matchingSlashFilters.length > 0 ? (
                      <ul>
                        {matchingSlashFilters.map((filter, index) => (
                          <li key={filter.command}>
                            <button
                              data-selected={index === selectedIndex}
                              onClick={() => handleSelect({ kind: 'slash', data: filter })}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                                index === selectedIndex
                                  ? 'bg-primary-50 dark:bg-primary-900/20'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              <span className="p-1.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                {filter.icon}
                              </span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {filter.label}
                                </p>
                                <p className="text-xs text-gray-400 font-mono">{filter.command}</p>
                              </div>
                              <Hash className="w-3.5 h-3.5 text-gray-300" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">
                        No matching filters
                      </div>
                    )}
                  </div>
                )}

                {/* -- Loading -- */}
                {!isSlashMode && loading && (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
                      Searching...
                    </div>
                  </div>
                )}

                {/* -- Search results -- */}
                {!isSlashMode && !loading && results.length > 0 && effectiveSearchQuery.length >= 2 && (
                  <ul className="py-2">
                    {results.map((result, index) => (
                      <li key={`${result.type}-${result.id}`}>
                        <button
                          data-selected={index === selectedIndex}
                          onClick={() => handleSelect({ kind: 'result', data: result })}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                            index === selectedIndex
                              ? 'bg-primary-50 dark:bg-primary-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <span className={`p-1.5 rounded ${getResultTypeColor(result.type)}`}>
                            {getIcon(result.type)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {result.title}
                            </p>
                            {result.subtitle && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {getResultTypeLabel(result.type)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* -- No results -- */}
                {!isSlashMode && !loading && results.length === 0 && effectiveSearchQuery.length >= 2 && (
                  <div className="px-4 py-8 text-center text-gray-500">
                    No results found for &ldquo;{effectiveSearchQuery}&rdquo;
                    {activeFilter && (
                      <p className="text-xs mt-1 text-gray-400">
                        Filtered to {getResultTypeLabel(activeFilter).toLowerCase()}s.{' '}
                        <button
                          onClick={() => {
                            setActiveFilter(null);
                            setSelectedIndex(0);
                          }}
                          className="text-primary-500 hover:underline"
                        >
                          Remove filter
                        </button>
                      </p>
                    )}
                  </div>
                )}

                {/* -- Idle state: Recent + Quick Actions -- */}
                {showIdleState && !activeFilter && (
                  <div className="py-2">
                    {/* Recent Pages */}
                    {recentPages.length > 0 && (
                      <>
                        <div className="px-4 py-1.5">
                          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Recent
                          </span>
                        </div>
                        <ul>
                          {recentPages.map((page, index) => (
                            <li key={page.path}>
                              <button
                                data-selected={index === selectedIndex}
                                onClick={() => handleSelect({ kind: 'recent', data: page })}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                                  index === selectedIndex
                                    ? 'bg-primary-50 dark:bg-primary-900/20'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                              >
                                <span className="p-1.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                  <Clock className="w-4 h-4" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {page.title}
                                  </p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate font-mono">
                                    {page.path}
                                  </p>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {/* Quick Actions */}
                    <div className="px-4 py-1.5 mt-1">
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Quick Actions
                      </span>
                    </div>
                    <ul>
                      {QUICK_ACTIONS.map((action, idx) => {
                        const globalIndex = recentPages.length + idx;
                        return (
                          <li key={action.id}>
                            <button
                              data-selected={globalIndex === selectedIndex}
                              onClick={() => handleSelect({ kind: 'action', data: action })}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                                globalIndex === selectedIndex
                                  ? 'bg-primary-50 dark:bg-primary-900/20'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              <span className="p-1.5 rounded bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                                {action.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {action.label}
                                </p>
                              </div>
                              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded flex-shrink-0">
                                {action.shortcutHint}
                              </kbd>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* -- Idle state with active filter but no query yet -- */}
                {showIdleState && activeFilter && (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">
                    Type at least 2 characters to search {getResultTypeLabel(activeFilter).toLowerCase()}s
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">↑↓</kbd> Navigate
                  <kbd className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">↵</kbd> Select
                  {activeFilter && (
                    <>
                      <kbd className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">⌫</kbd> Clear filter
                    </>
                  )}
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">/</kbd> Filters
                  <kbd className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">Esc</kbd> Close
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
