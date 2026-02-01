'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ThemeProvider';
import LoginForm from '@/components/LoginForm';

function MobileMenu({ isAdmin }: { isAdmin?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

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
              <a href="/planning" className="px-4 py-3 text-sm font-medium hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">
                Quick Shop
              </a>
              <a href="/planning?tab=monthly-load" className="px-4 py-3 text-sm font-medium hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">
                Monthly Load
              </a>
              <a href="/planning?tab=network-view" className="px-4 py-3 text-sm font-medium hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">
                Network View
              </a>
              <a href="/pipeline" className="px-4 py-3 text-sm font-medium hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">
                Pipeline
              </a>
              <a href="/rules" className="px-4 py-3 text-sm font-medium hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">
                Rules
              </a>
              {isAdmin && (
                <a href="/admin" className="px-4 py-3 text-sm font-medium hover:bg-primary-700 dark:hover:bg-gray-700 rounded-md">
                  Admin
                </a>
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
              <nav className="hidden md:flex space-x-1">
                <a
                  href="/planning"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 dark:hover:bg-gray-700 transition-colors"
                >
                  Quick Shop
                </a>
                <a
                  href="/planning?tab=monthly-load"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 dark:hover:bg-gray-700 transition-colors"
                >
                  Monthly Load
                </a>
                <a
                  href="/planning?tab=network-view"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 dark:hover:bg-gray-700 transition-colors"
                >
                  Network
                </a>
                <a
                  href="/pipeline"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 dark:hover:bg-gray-700 transition-colors"
                >
                  Pipeline
                </a>
                <a
                  href="/rules"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 dark:hover:bg-gray-700 transition-colors"
                >
                  Rules
                </a>
                {user?.role === 'admin' && (
                  <a
                    href="/admin"
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 dark:hover:bg-gray-700 transition-colors"
                  >
                    Admin
                  </a>
                )}
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
                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50">
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
                          {user?.role === 'admin' && (
                            <a
                              href="/admin"
                              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => setShowUserMenu(false)}
                            >
                              Admin Dashboard
                            </a>
                          )}
                          <a
                            href="/service-events"
                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => setShowUserMenu(false)}
                          >
                            My Service Events
                          </a>
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
