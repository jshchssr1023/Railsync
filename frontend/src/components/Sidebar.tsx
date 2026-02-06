'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { ThemeToggle } from '@/components/ThemeProvider';
import LoginForm from '@/components/LoginForm';
import {
  LayoutDashboard, ShoppingCart, Truck, FileText, Train, Wrench,
  Settings, ChevronRight, ChevronDown, Menu, X, LogOut, User,
  AlertTriangle, BarChart3, BookOpen, Shield, ClipboardList,
  Factory, Calendar, Network, Zap, Package, Clock, AlertCircle,
  History, Building2, ScrollText, Layers, PanelLeftClose, PanelLeft, DollarSign
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SubItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface NavCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: SubItem[];
  adminOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Navigation Config
// ---------------------------------------------------------------------------
const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    href: '/dashboard',
  },
  {
    id: 'shopping',
    label: 'Shopping',
    icon: <ShoppingCart className="w-5 h-5" />,
    children: [
      { label: 'Shopping Events', href: '/shopping', icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Quick Shop', href: '/planning', icon: <Zap className="w-4 h-4" /> },
      { label: 'Bad Orders', href: '/bad-orders', icon: <AlertTriangle className="w-4 h-4" /> },
      { label: 'Shop Finder', href: '/shops', icon: <Factory className="w-4 h-4" /> },
    ],
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: <Truck className="w-5 h-5" />,
    children: [
      { label: 'Pipeline', href: '/pipeline', icon: <Truck className="w-4 h-4" /> },
      { label: 'Monthly Load', href: '/planning?tab=monthly-load', icon: <Calendar className="w-4 h-4" /> },
      { label: 'Network View', href: '/planning?tab=network-view', icon: <Network className="w-4 h-4" /> },
      { label: 'Master Plans', href: '/plans', icon: <ScrollText className="w-4 h-4" /> },
    ],
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: <FileText className="w-5 h-5" />,
    children: [
      { label: 'Contracts', href: '/contracts', icon: <Building2 className="w-4 h-4" /> },
      { label: 'Projects', href: '/projects', icon: <Package className="w-4 h-4" /> },
    ],
  },
  {
    id: 'cars',
    label: 'Cars',
    icon: <Train className="w-5 h-5" />,
    children: [
      { label: 'All Cars', href: '/cars', icon: <Train className="w-4 h-4" /> },
      { label: 'Qualifications', href: '/qualifications', icon: <Shield className="w-4 h-4" /> },
      { label: 'In Shop', href: '/cars?status=Arrived', icon: <Wrench className="w-4 h-4" /> },
      { label: 'Enroute', href: '/cars?status=Enroute', icon: <Truck className="w-4 h-4" /> },
      { label: 'Overdue', href: '/cars?status=Overdue', icon: <AlertCircle className="w-4 h-4" /> },
      { label: 'Service Due', href: '/cars?status=To+Be+Routed', icon: <Clock className="w-4 h-4" /> },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: <BarChart3 className="w-5 h-5" />,
    children: [
      { label: 'Case Queue', href: '/invoice-cases', icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Invoices', href: '/invoices', icon: <FileText className="w-4 h-4" /> },
      { label: 'Billing', href: '/billing', icon: <DollarSign className="w-4 h-4" /> },
      { label: 'Budget & Forecasts', href: '/budget', icon: <BarChart3 className="w-4 h-4" /> },
      { label: 'Analytics', href: '/analytics', icon: <Layers className="w-4 h-4" /> },
      { label: 'Reports', href: '/reports', icon: <ClipboardList className="w-4 h-4" /> },
    ],
  },
  {
    id: 'standards',
    label: 'Standards',
    icon: <BookOpen className="w-5 h-5" />,
    children: [
      { label: 'SOW Library', href: '/scope-library', icon: <BookOpen className="w-4 h-4" /> },
      { label: 'Care Manuals', href: '/ccm', icon: <ScrollText className="w-4 h-4" /> },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: <Settings className="w-5 h-5" />,
    adminOnly: true,
    children: [
      { label: 'Rules', href: '/rules', icon: <Shield className="w-4 h-4" /> },
      { label: 'Audit Log', href: '/audit', icon: <History className="w-4 h-4" /> },
      { label: 'Users', href: '/admin', icon: <User className="w-4 h-4" /> },
      { label: 'Settings', href: '/settings', icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar Component
// ---------------------------------------------------------------------------
export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const { expanded, setExpanded, toggle } = useSidebar();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Auto-expand the active category on mount
  useEffect(() => {
    for (const cat of NAV_CATEGORIES) {
      if (cat.href && pathname === cat.href) {
        setExpandedCategory(cat.id);
        break;
      }
      if (cat.children?.some(child => {
        const baseHref = child.href.split('?')[0];
        return pathname === baseHref || pathname.startsWith(baseHref + '/');
      })) {
        setExpandedCategory(cat.id);
        break;
      }
    }
  }, [pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isActive = (href: string) => {
    const baseHref = href.split('?')[0];
    if (pathname === baseHref) return true;
    if (baseHref !== '/' && pathname.startsWith(baseHref + '/')) return true;
    return false;
  };

  const isCategoryActive = (cat: NavCategory) => {
    if (cat.href) return isActive(cat.href);
    return cat.children?.some(c => isActive(c.href)) ?? false;
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategory(prev => prev === catId ? null : catId);
    if (!expanded) setExpanded(true);
  };

  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setShowUserMenu(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const visibleCategories = NAV_CATEGORIES.filter(cat => !cat.adminOnly || isAdmin);

  const renderNavContent = (isMobile = false) => (
    <div className="flex flex-col h-full">
      {/* Logo Area */}
      <div className={`flex items-center h-14 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 ${expanded || isMobile ? 'px-4 justify-between' : 'justify-center px-2'}`}>
        {(expanded || isMobile) ? (
          <>
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <Train className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">Railsync</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 block leading-tight">Shop Loading Tool</span>
              </div>
            </Link>
            {isMobile && (
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </>
        ) : (
          <Link href="/dashboard" className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center" title="Railsync">
            <Train className="w-5 h-5 text-white" />
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" role="navigation" aria-label="Main navigation">
        {visibleCategories.map(cat => {
          const catActive = isCategoryActive(cat);
          const isExpanded = expandedCategory === cat.id;

          if (cat.href) {
            return (
              <Link
                key={cat.id}
                href={cat.href}
                className={`flex items-center gap-3 rounded-lg transition-colors mb-0.5 ${
                  expanded || isMobile ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'
                } ${
                  catActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title={!expanded && !isMobile ? cat.label : undefined}
                aria-current={catActive ? 'page' : undefined}
              >
                <span className={catActive ? 'text-primary-600 dark:text-primary-400' : ''} aria-hidden="true">{cat.icon}</span>
                {(expanded || isMobile) && <span className="text-sm font-medium">{cat.label}</span>}
                {!expanded && !isMobile && <span className="sr-only">{cat.label}</span>}
              </Link>
            );
          }

          return (
            <div key={cat.id} className="mb-0.5">
              <button
                onClick={() => toggleCategory(cat.id)}
                className={`w-full flex items-center gap-3 rounded-lg transition-colors ${
                  expanded || isMobile ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'
                } ${
                  catActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title={!expanded && !isMobile ? cat.label : undefined}
                aria-expanded={isExpanded}
                aria-label={!expanded && !isMobile ? cat.label : undefined}
              >
                <span className={catActive ? 'text-primary-600 dark:text-primary-400' : ''} aria-hidden="true">{cat.icon}</span>
                {(expanded || isMobile) && (
                  <>
                    <span className="text-sm font-medium flex-1 text-left">{cat.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                    )}
                  </>
                )}
                {!expanded && !isMobile && <span className="sr-only">{cat.label}</span>}
              </button>

              {isExpanded && (expanded || isMobile) && (
                <div className="ml-3 pl-4 border-l border-gray-200 dark:border-gray-700 mt-0.5 mb-1" role="group" aria-label={`${cat.label} submenu`}>
                  {cat.children!.map(child => {
                    const childActive = isActive(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                          childActive
                            ? 'text-primary-700 dark:text-primary-300 font-medium bg-primary-50/50 dark:bg-primary-900/10'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                        aria-current={childActive ? 'page' : undefined}
                      >
                        {child.icon && <span className={childActive ? 'text-primary-500' : 'text-gray-400'} aria-hidden="true">{child.icon}</span>}
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom section: theme toggle + user */}
      <div className={`border-t border-gray-200 dark:border-gray-700 flex-shrink-0 ${expanded || isMobile ? 'p-3' : 'p-2'}`}>
        {/* Theme toggle */}
        <div className={`flex items-center mb-2 ${expanded || isMobile ? 'justify-between px-1' : 'justify-center'}`}>
          {(expanded || isMobile) && <span className="text-xs text-gray-400 dark:text-gray-500">Theme</span>}
          <ThemeToggle />
        </div>

        {/* Expand/collapse button (desktop only) */}
        {!isMobile && (
          <button
            onClick={toggle}
            className="w-full flex items-center justify-center py-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-2"
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {expanded ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </button>
        )}

        {/* User section */}
        {isLoading ? (
          <div className={`flex items-center ${expanded || isMobile ? 'justify-start gap-2 px-1' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        ) : isAuthenticated ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`w-full flex items-center gap-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                expanded || isMobile ? 'px-2 py-2' : 'justify-center py-2'
              }`}
              aria-label="User menu"
              aria-expanded={showUserMenu}
            >
              <div className="w-8 h-8 rounded-full bg-primary-500 dark:bg-primary-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {user?.first_name?.[0] || user?.last_name?.[0] || 'U'}{user?.last_name?.[0] || ''}
              </div>
              {(expanded || isMobile) && (
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.first_name}</div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{user?.role}</div>
                </div>
              )}
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div
                  className={`absolute z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 w-48 ${
                    expanded || isMobile ? 'bottom-full mb-1 left-0' : 'left-full ml-2 bottom-0'
                  }`}
                  role="menu"
                  aria-label="User actions"
                >
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setShowUserMenu(false)}
                    role="menuitem"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                    role="menuitem"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    {loggingOut ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowLoginModal(true)}
            className={`w-full flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors ${
              expanded || isMobile ? 'px-3 py-2 text-sm justify-center' : 'justify-center py-2'
            }`}
          >
            <User className="w-4 h-4" aria-hidden="true" />
            {(expanded || isMobile) && <span>Sign in</span>}
            {!expanded && !isMobile && <span className="sr-only">Sign in</span>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        ref={sidebarRef}
        className={`hidden md:flex flex-col fixed top-0 left-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-30 transition-all duration-200 ${
          expanded ? 'w-56' : 'w-14'
        }`}
        aria-label="Sidebar navigation"
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile Header Bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 h-14 flex items-center px-4 justify-between">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
        >
          <Menu className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary-600 flex items-center justify-center">
            <Train className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">Railsync</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside
            className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-50 md:hidden animate-slide-in-left"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {renderNavContent(true)}
          </aside>
        </>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Sign in">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowLoginModal(false)} aria-hidden="true" />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sign in to Railsync</h2>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  aria-label="Close sign in dialog"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <LoginForm onSuccess={() => setShowLoginModal(false)} />
              <details className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">Show demo credentials</summary>
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs font-mono">
                  admin@railsync.com / admin123<br />
                  operator@railsync.com / operator123
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
