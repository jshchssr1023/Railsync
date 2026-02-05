'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SidebarContextValue {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded(prev => !prev), []);

  return (
    <SidebarContext.Provider value={{ expanded, setExpanded, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}
