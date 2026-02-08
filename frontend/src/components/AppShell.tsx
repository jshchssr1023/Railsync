'use client';

import { ReactNode } from 'react';
import { useSidebar } from '@/context/SidebarContext';
import GlobalCommandBar from '@/components/GlobalCommandBar';
import DensityToggle from '@/components/DensityToggle';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import KeyboardShortcutsHelp from '@/components/KeyboardShortcutsHelp';

interface AppShellProps {
  children: ReactNode;
  dashboardWrapper: ReactNode;
}

export default function AppShell({ children, dashboardWrapper }: AppShellProps) {
  const { expanded } = useSidebar();

  return (
    <div className="min-h-screen flex">
      {/* Skip to main content - accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${
        expanded ? 'md:ml-64' : 'md:ml-14'
      }`}>
        {/* Mobile top spacer */}
        <div className="h-14 md:hidden flex-shrink-0" />

        {/* Top bar with search trigger and density toggle */}
        <div className="hidden md:flex items-center justify-end gap-3 h-12 px-4 sm:px-6 lg:px-8 w-full mx-auto flex-shrink-0">
          <DensityToggle />
          <GlobalCommandBar />
        </div>

        <main id="main-content" className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Breadcrumbs />
          {children}
        </main>

        {/* Minimal footer - hidden on mobile */}
        <footer className="hidden md:flex items-center justify-center h-6 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Railsync v2.1.0</p>
        </footer>
      </div>

      {/* Contracts Dashboard Floating Button */}
      {dashboardWrapper}

      {/* Keyboard Shortcuts Help (Shift+?) */}
      <KeyboardShortcutsHelp />
    </div>
  );
}
