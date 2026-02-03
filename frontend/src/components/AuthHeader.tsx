'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ThemeProvider';
import LoginForm from '@/components/LoginForm';
import GlobalCommandBar from '@/components/GlobalCommandBar';

interface NavDropdownProps {
  label: string;
  subtitle: string;
  items: { href: string; label: string }[];
}

function NavDropdown({ label, subtitle, items }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 dark:hover:bg-gray-700 transition-colors"
      >
        <span>{label}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
          <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            {subtitle}
          </div>
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileMenu({ isAdmin }: { isAdmin?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-primary-600 dark:hover:bg-gray-700"
        aria-label="Menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-16 left-0 right-0 bg-primary-800 dark:bg-gray-800 shadow-lg z-50 border-t border-primary-600 dark:border-gray-700">
            <nav className="flex flex-col p-2">
              {/* Operations */}
              <button
                onClick={() => toggleSection('operations')}
                className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md"
              >
                <span>Operations</span>
                <span className="text-xs text-primary-300 dark:text-gray-400">The Now</span>
              </button>
              {expandedSection === 'operations' && (
                <div className="pl-6 pb-2">
                  <a href="/pipeline" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Pipeline</a>
                  <a href="/pipeline?status=active" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Active</a>
                  <a href="/bad-orders" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Bad Orders</a>
                  <a href="/invoices" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Invoices</a>
                </div>
              )}

              {/* Planning */}
              <button
                onClick={() => toggleSection('planning')}
                className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md"
              >
                <span>Planning</span>
                <span className="text-xs text-primary-300 dark:text-gray-400">The Next</span>
              </button>
              {expandedSection === 'planning' && (
                <div className="pl-6 pb-2">
                  <a href="/planning?tab=monthly-load" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Monthly Load</a>
                  <a href="/planning" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Quick Shop</a>
                  <a href="/planning?tab=network-view" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Network</a>
                  <a href="/shops" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Shop Finder</a>
                  <a href="/plans" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Master Plans</a>
                  <a href="/budget" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Budget & Forecasts</a>
                  <a href="/budget?tab=configuration" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Budget Config</a>
                </div>
              )}

              {/* Assets & Logic */}
              <button
                onClick={() => toggleSection('assets')}
                className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md"
              >
                <span>Assets & Logic</span>
                <span className="text-xs text-primary-300 dark:text-gray-400">Infrastructure</span>
              </button>
              {expandedSection === 'assets' && (
                <div className="pl-6 pb-2">
                  <a href="/fleet" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Fleet</a>
                  <a href="/cars" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Cars</a>
                  <a href="/projects" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Projects</a>
                  <a href="/rules" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Rules</a>
                  <a href="/reports" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Reports</a>
                  {isAdmin && (
                    <>
                      <a href="/audit" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Audit Log</a>
                      <a href="/admin" className="block px-4 py-2 text-sm hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">Admin</a>
                    </>
                  )}
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}

export default function AuthHeader() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  return (
    <>
      <header className="bg-primary-700 dark:bg-gray-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <a href="/" className="flex items-center">
                <h1 className="text-xl font-bold">Railsync</h1>
                <span className="ml-3 text-primary-200 dark:text-gray-400 text-sm hidden sm:inline">
                  Shop Loading Tool
                </span>
              </a>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Global Search */}
              <div className="hidden sm:block">
                <GlobalCommandBar />
              </div>

              {/* Desktop Navigation with Dropdowns */}
              <nav className="hidden md:flex items-center space-x-1">
                {/* Operations - The Now */}
                <NavDropdown
                  label="Operations"
                  subtitle="The Now"
                  items={[
                    { href: '/pipeline', label: 'Pipeline' },
                    { href: '/pipeline?status=active', label: 'Active' },
                    { href: '/bad-orders', label: 'Bad Orders' },
                    { href: '/invoices', label: 'Invoices' },
                  ]}
                />

                {/* Planning - The Next */}
                <NavDropdown
                  label="Planning"
                  subtitle="The Next"
                  items={[
                    { href: '/planning?tab=monthly-load', label: 'Monthly Load' },
                    { href: '/planning', label: 'Quick Shop' },
                    { href: '/planning?tab=network-view', label: 'Network' },
                    { href: '/shops', label: 'Shop Finder' },
                    { href: '/plans', label: 'Master Plans' },
                    { href: '/budget', label: 'Budget & Forecasts' },
                    { href: '/budget?tab=configuration', label: 'Budget Config' },
                  ]}
                />

                {/* Assets & Logic - Infrastructure */}
                <NavDropdown
                  label="Assets"
                  subtitle="Infrastructure"
                  items={[
                    { href: '/fleet', label: 'Fleet' },
                    { href: '/cars', label: 'Cars' },
                    { href: '/projects', label: 'Projects' },
                    { href: '/rules', label: 'Rules' },
                    { href: '/reports', label: 'Reports' },
                    ...(user?.role === 'admin' ? [
                      { href: '/audit', label: 'Audit Log' },
                      { href: '/admin', label: 'Admin' },
                    ] : []),
                  ]}
                />
              </nav>

              {/* Mobile menu button */}
              <div className="md:hidden">
                <MobileMenu isAdmin={user?.role === 'admin'} />
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle />

                {isLoading ? (
                  <div className="w-8 h-8 rounded-full bg-primary-600 animate-pulse" />
                ) : isAuthenticated ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-primary-600 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-500 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                        {user?.first_name?.[0]}
                        {user?.last_name?.[0]}
                      </div>
                      <span className="hidden sm:inline text-sm">{user?.first_name}</span>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {showUserMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowUserMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {user?.first_name} {user?.last_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {user?.email}
                            </p>
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 rounded">
                              {user?.role}
                            </span>
                          </div>
                          <a
                              href="/settings"
                              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => setShowUserMenu(false)}
                            >
                              Settings
                            </a>
                          {user?.role === 'admin' && (
                            <a
                              href="/admin"
                              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => setShowUserMenu(false)}
                            >
                              Admin Dashboard
                            </a>
                          )}
                          <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Sign out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="px-4 py-1.5 text-sm font-medium bg-white text-primary-700 rounded-lg hover:bg-primary-50 transition-colors"
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowLoginModal(false)}
          />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Sign in to Railsync
                </h2>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <svg
                    className="w-5 h-5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <LoginForm
                onSuccess={() => setShowLoginModal(false)}
              />
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
                Demo accounts:
                <br />
                admin@railsync.com / admin123
                <br />
                operator@railsync.com / operator123
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
