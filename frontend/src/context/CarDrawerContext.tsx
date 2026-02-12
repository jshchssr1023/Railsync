'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import dynamic from 'next/dynamic';

const CarDrawer = dynamic(() => import('@/components/cars/CarDrawer'), { ssr: false });

interface CarDrawerContextValue {
  openCarDrawer: (carNumber: string) => void;
  closeCarDrawer: () => void;
  activeCarNumber: string | null;
}

const CarDrawerContext = createContext<CarDrawerContextValue | null>(null);

export function useCarDrawer() {
  const context = useContext(CarDrawerContext);
  if (!context) throw new Error('useCarDrawer must be used within CarDrawerProvider');
  return context;
}

export function CarDrawerProvider({ children }: { children: ReactNode }) {
  const [activeCarNumber, setActiveCarNumber] = useState<string | null>(null);
  const openCarDrawer = useCallback((carNumber: string) => setActiveCarNumber(carNumber), []);
  const closeCarDrawer = useCallback(() => setActiveCarNumber(null), []);

  return (
    <CarDrawerContext.Provider value={{ openCarDrawer, closeCarDrawer, activeCarNumber }}>
      {children}
      {activeCarNumber && <CarDrawer carNumber={activeCarNumber} onClose={closeCarDrawer} />}
    </CarDrawerContext.Provider>
  );
}
