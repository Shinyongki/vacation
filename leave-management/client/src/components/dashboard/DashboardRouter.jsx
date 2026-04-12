import React from 'react';
import useAuth from '../../hooks/useAuth';
import StaffDashboard from './StaffDashboard';
import TeamLeadDashboard from './TeamLeadDashboard';
import DirectorDashboard from './DirectorDashboard';
import HRDashboard from './HRDashboard';
import FoundationDashboard from './FoundationDashboard';

const DashboardRouter = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="placeholder-page">
        <div className="loading-spinner" />
      </div>
    );
  }

  switch (user.role) {
    case 'staff':
      return <StaffDashboard />;
    case 'team_lead':
      return <TeamLeadDashboard />;
    case 'director':
      return <DirectorDashboard />;
    case 'hr_admin':
      return <HRDashboard />;
    case 'foundation':
      return <FoundationDashboard />;
    default:
      return <StaffDashboard />;
  }
};

export default DashboardRouter;
