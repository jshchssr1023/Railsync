'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { ThemeToggle } from '@/components/ThemeProvider';
import LoginForm from '@/components/LoginForm';
import {
  Menu, X, LogOut, PanelLeftClose, PanelLeft,
  ChevronRight, ChevronDown, Train,
} from 'lucide-react';
import {
  NAV_STANDALONE,
  NAV_PILLARS,
  NAV_SHOP,
  type NavPillar,
  type NavCategory,
} from '@/config/navigation';

// ---------------------------------------------------------------------------
// Sidebar Component
// ---------------------------------------------------------------------------
export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const { expanded, setExpanded, toggle } = useSidebar();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ---- Active-state detection ----
  const isActive = (href: string) => {
    const baseHref = href.split('?')[0];
    if (pathname === baseHref) return true;
    if (baseHref !== '/' && pathname.startsWith(baseHref + '/')) return true;
    return false;
  };

  const isCategoryActive = (cat: NavCategory): boolean => {
    if (cat.href) return isActive(cat.href);
    return cat.children?.some(c => isActive(c.href)) ?? false;
  };

  const isPillarActive = (pillar: NavPillar): boolean =>
    pillar.categories.some(cat => isCategoryActive(cat));

  // ---- Auto-expand active category on mount / route change ----
  useEffect(() => {
    const checkActive = (href: string) => {
      const baseHref = href.split('?')[0];
      if (pathname === baseHref) return true;
      if (baseHref !== '/' && pathname.startsWith(baseHref + '/')) return true;
      return false;
    };

    for (const pillar of NAV_PILLARS) {
      for (const cat of pillar.categories) {
        if (cat.href && checkActive(cat.href)) {
          setExpandedCategories(prev => {
            if (prev.has(cat.id)) return prev;
            const next = new Set(prev);
            next.add(cat.id);
            return next;
          });
          return;
        }
        if (cat.children?.some(child => checkActive(child.href))) {
          setExpandedCategories(prev => {
            if (prev.has(cat.id)) return prev;
            const next = new Set(prev);
            next.add(cat.id);
            return next;
          });
          return;
        }
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

  // ---- Toggle ----
  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
    if (!expanded) setExpanded(true);
  };

  // ---- Logout ----
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

  // ---- Role detection ----
  const isAdmin = user?.role === 'admin';
  const isShopUser = user?.role === 'shop';

  const getVisiblePillars = (): NavPillar[] =>
    NAV_PILLARS.map(pillar => ({
      ...pillar,
      categories: pillar.categories
        .filter(cat => !cat.adminOnly || isAdmin)
        .map(cat => ({
          ...cat,
          children: cat.children?.filter(item => !item.adminOnly || isAdmin),
        })),
    })).filter(pillar => pillar.categories.length > 0);

  const visiblePillars = getVisiblePillars();

  // ---- Render navigation content (shared between desktop and mobile) ----
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
        {/* ---- Shop Portal: Simplified nav for shop-role users ---- */}
        {isShopUser ? (
          <div className="space-y-1">
            {(expanded || isMobile) && (
              <div className="px-3 py-2 mb-2">
                <span className="text-[10px] font-semibold tracking-wider uppercase text-primary-500 dark:text-primary-400">
                  SHOP PORTAL
                </span>
                {user?.shop_code && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Shop: {user.shop_code}</p>
                )}
              </div>
            )}
            {NAV_SHOP.map(item => (
              (expanded || isMobile) ? (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg transition-colors px-3 py-2.5 ${
                    isActive(item.href)
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  <span className={isActive(item.href) ? 'text-primary-600 dark:text-primary-400' : ''} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center justify-center rounded-lg transition-colors px-0 py-2.5 ${
                    isActive(item.href)
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  title={item.label}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  <span className={isActive(item.href) ? 'text-primary-600 dark:text-primary-400' : ''} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="sr-only">{item.label}</span>
                </Link>
              )
            ))}
          </div>
        ) : (
        <>
        {/* ---- Dashboard (standalone) ---- */}
        {(expanded || isMobile) ? (
          <Link
            href={NAV_STANDALONE.href}
            className={`flex items-center gap-3 rounded-lg transition-colors mb-1 px-3 py-2.5 ${
              isActive(NAV_STANDALONE.href)
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            aria-current={isActive(NAV_STANDALONE.href) ? 'page' : undefined}
          >
            <span className={isActive(NAV_STANDALONE.href) ? 'text-primary-600 dark:text-primary-400' : ''} aria-hidden="true">
              {NAV_STANDALONE.icon}
            </span>
            <span className="text-sm font-medium">{NAV_STANDALONE.label}</span>
          </Link>
        ) : (
          <Link
            href={NAV_STANDALONE.href}
            className={`flex items-center justify-center rounded-lg transition-colors mb-1 px-0 py-2.5 ${
              isActive(NAV_STANDALONE.href)
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            title={NAV_STANDALONE.label}
            aria-current={isActive(NAV_STANDALONE.href) ? 'page' : undefined}
          >
            <span className={isActive(NAV_STANDALONE.href) ? 'text-primary-600 dark:text-primary-400' : ''} aria-hidden="true">
              {NAV_STANDALONE.icon}
            </span>
            <span className="sr-only">{NAV_STANDALONE.label}</span>
          </Link>
        )}

        {/* ---- Pillars ---- */}
        {visiblePillars.map(pillar => {
          const pillarActive = isPillarActive(pillar);

          return (
            <div key={pillar.id} role="group" aria-labelledby={`pillar-${pillar.id}`}>
              {/* Pillar Header */}
              {(expanded || isMobile) ? (
                <div className="mt-4 first:mt-2 mb-1 px-3" id={`pillar-${pillar.id}`}>
                  <span className={`text-[10px] font-semibold tracking-wider uppercase ${
                    pillarActive ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {pillar.label}
                  </span>
                </div>
              ) : (
                /* Collapsed: show pillar icon */
                <button
                  onClick={() => {
                    setExpanded(true);
                    // Auto-open the first category in this pillar
                    if (pillar.categories.length > 0) {
                      setExpandedCategories(prev => {
                        const next = new Set(prev);
                        next.add(pillar.categories[0].id);
                        return next;
                      });
                    }
                  }}
                  className={`w-full flex items-center justify-center rounded-lg transition-colors mt-3 first:mt-1 px-0 py-2.5 ${
                    pillarActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  title={pillar.label}
                  aria-label={pillar.label}
                  id={`pillar-${pillar.id}`}
                >
                  <span className={pillarActive ? 'text-primary-600 dark:text-primary-400' : ''} aria-hidden="true">
                    {pillar.icon}
                  </span>
                </button>
              )}

              {/* Categories within this pillar (only when expanded / mobile) */}
              {(expanded || isMobile) && pillar.categories.map(cat => {
                const catActive = isCategoryActive(cat);
                const catExpanded = expandedCategories.has(cat.id);

                return (
                  <div key={cat.id} className="mb-0.5">
                    {/* Category toggle button */}
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-full flex items-center gap-3 rounded-lg transition-colors px-3 py-2 ${
                        catActive
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                      aria-expanded={catExpanded}
                      aria-controls={`cat-${cat.id}-items`}
                    >
                      <span className={catActive ? 'text-primary-600 dark:text-primary-400' : ''} aria-hidden="true">
                        {cat.icon}
                      </span>
                      <span className="text-sm font-medium flex-1 text-left">{cat.label}</span>
                      {catExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                      )}
                    </button>

                    {/* Child items */}
                    {catExpanded && cat.children && (
                      <div
                        id={`cat-${cat.id}-items`}
                        className="ml-3 pl-4 border-l border-gray-200 dark:border-gray-700 mt-0.5 mb-1"
                        role="group"
                        aria-label={`${cat.label} submenu`}
                      >
                        {cat.children.map(child => {
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
                              {child.icon && (
                                <span className={childActive ? 'text-primary-500' : 'text-gray-400'} aria-hidden="true">
                                  {child.icon}
                                </span>
                              )}
                              <span>{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        </>
        )}
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
            <span className="w-4 h-4" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
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
          expanded ? 'w-64' : 'w-14'
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
                  operator@railsync.com / operator123<br />
                  shop@demo.railsync.com / shop123
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
