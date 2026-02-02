'use client';

import DashboardWrapper from './DashboardWrapper';
import ConfigurableDashboard from './dashboard/ConfigurableDashboard';

export default function DashboardWithWrapper() {
  return (
    <DashboardWrapper>
      <ConfigurableDashboard />
    </DashboardWrapper>
  );
}
