'use client';

import DashboardWrapper from './DashboardWrapper';
import FleetDashboard from './FleetDashboard';

export default function DashboardWithWrapper() {
  return (
    <DashboardWrapper>
      <FleetDashboard />
    </DashboardWrapper>
  );
}
