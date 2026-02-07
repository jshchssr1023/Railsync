'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type DensityMode = 'compact' | 'comfortable' | 'spacious';

interface DensityContextValue {
  density: DensityMode;
  setDensity: (density: DensityMode) => void;
}

const STORAGE_KEY = 'railsync_density';

const DensityContext = createContext<DensityContextValue | null>(null);

const DENSITY_CONFIG: Record<DensityMode, { padding: string; text: string; rowHeight: string }> = {
  compact:     { padding: '2',  text: 'sm',   rowHeight: '32px' },
  comfortable: { padding: '4',  text: 'base', rowHeight: '40px' },
  spacious:    { padding: '6',  text: 'lg',   rowHeight: '52px' },
};

function applyDensityProperties(density: DensityMode) {
  const root = document.documentElement;
  const config = DENSITY_CONFIG[density];
  root.style.setProperty('--density-padding', config.padding);
  root.style.setProperty('--density-text', config.text);
  root.style.setProperty('--density-row-height', config.rowHeight);
  root.setAttribute('data-density', density);
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<DensityMode>('comfortable');

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as DensityMode | null;
      if (saved && ['compact', 'comfortable', 'spacious'].includes(saved)) {
        setDensityState(saved);
        applyDensityProperties(saved);
      } else {
        applyDensityProperties('comfortable');
      }
    } catch {
      applyDensityProperties('comfortable');
    }
  }, []);

  const setDensity = useCallback((newDensity: DensityMode) => {
    setDensityState(newDensity);
    applyDensityProperties(newDensity);
    try {
      localStorage.setItem(STORAGE_KEY, newDensity);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  return (
    <DensityContext.Provider value={{ density, setDensity }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  const context = useContext(DensityContext);
  if (!context) {
    throw new Error('useDensity must be used within a DensityProvider');
  }
  return context;
}
