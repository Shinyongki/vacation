import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';

// Common
import Sidebar from './components/common/Sidebar';
import NotificationBell from './components/common/NotificationBell';
import NotificationPanel from './components/common/NotificationPanel';
import AbsenceToggle from './components/common/AbsenceToggle';

// API
import apiClient from './api/client';

// Auth
import LoginPage from './components/auth/LoginPage';

// Dashboard
import DashboardRouter from './components/dashboard/DashboardRouter';

// Leave
import LeaveForm from './components/leave/LeaveForm';
import LeaveList from './components/leave/LeaveList';
import LeaveDetail from './components/leave/LeaveDetail';

// Approval
import ApprovalList from './components/approval/ApprovalList';

// Status
import TeamCalendar from './components/status/TeamCalendar';
import TeamStatus from './components/status/TeamStatus';
import FullStatus from './components/status/FullStatus';
import RegulationView from './components/status/RegulationView';

// Report
import ReportView from './components/report/ReportView';

// Admin
import AdminSettings from './components/admin/AdminSettings';

// Verification
import VerificationView from './components/verification/VerificationView';

// --- Breadcrumb path map ---
const BREADCRUMBS = {
  '/dashboard': [{ label: '홈' }, { label: '대시보드' }],
  '/leaves/new': [{ label: '홈' }, { label: '휴가 관리' }, { label: '휴가 신청' }],
  '/leaves': [{ label: '홈' }, { label: '휴가 관리' }, { label: '내 휴가 목록' }],
  '/approvals': [{ label: '홈' }, { label: '승인 관리' }, { label: '승인 대기' }],
  '/calendar': [{ label: '홈' }, { label: '현황' }, { label: '팀 캘린더' }],
  '/team-status': [{ label: '홈' }, { label: '현황' }, { label: '팀원 현황' }],
  '/full-status': [{ label: '홈' }, { label: '현황' }, { label: '전체 현황' }],
  '/reports': [{ label: '홈' }, { label: '보고서' }],
  '/admin': [{ label: '홈' }, { label: '관리자 설정' }],
  '/verification': [{ label: '홈' }, { label: '데이터 검증' }],
  '/regulations': [{ label: '홈' }, { label: '정보' }, { label: '휴가 규정' }],
};

// --- BreadcrumbBar ---
const BreadcrumbBar = () => {
  const location = useLocation();
  let crumbs = BREADCRUMBS[location.pathname];
  if (!crumbs) {
    if (location.pathname.match(/^\/leaves\/[^/]+$/) && location.pathname !== '/leaves/new') {
      crumbs = [{ label: '홈' }, { label: '휴가 관리' }, { label: '휴가 상세' }];
    } else {
      crumbs = [{ label: '홈' }];
    }
  }

  return (
    <div className="app-breadcrumb">
      {crumbs.map((crumb, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="app-breadcrumb__separator" />}
          {idx === crumbs.length - 1 ? (
            <span className="app-breadcrumb__current">{crumb.label}</span>
          ) : (
            <span>{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// --- App Shell (Header + Breadcrumb + Sidebar + Content) ---
const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const { unreadCount, togglePanel, showPanel } = useNotification();
  const showAbsenceToggle = user && (user.role === 'team_lead' || user.role === 'director');

  const handleAbsenceToggle = async (isAbsent, returnDate) => {
    try {
      await apiClient.put('/auth/absence', { isAbsent, returnDate });
    } catch (e) {
      console.error('Absence toggle failed:', e);
    }
  };

  return (
    <div className="app-shell">
      {/* Header — 44px, #1B3A5C */}
      <header className="app-header">
        <div className="app-header__left">
          <div className="app-header__logo">HM</div>
          <span className="app-header__title">휴가관리 시스템</span>
        </div>
        <div className="app-header__right">
          {showAbsenceToggle && (
            <AbsenceToggle
              isAbsent={user?.isAbsent || false}
              returnDate={user?.absentReturnDate}
              onToggle={handleAbsenceToggle}
            />
          )}
          <NotificationBell unreadCount={unreadCount} onClick={togglePanel} />
          <span className="app-header__user-name">
            {user?.name || ''}{user?.position ? ' · ' + user.position : ''}
          </span>
          <button className="app-header__logout" onClick={logout}>
            로그아웃
          </button>
        </div>
      </header>

      {/* Breadcrumb */}
      <BreadcrumbBar />

      {/* Body */}
      <div className="app-body">
        <Sidebar user={user} />
        <main className="app-content">{children}</main>
      </div>

      {/* Notification Panel */}
      {showPanel && <NotificationPanel />}
    </div>
  );
};

// --- Protected Route wrapper ---
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <AppShell>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2 style={{ color: '#DC3545', marginBottom: '8px' }}>접근 권한이 없습니다</h2>
          <p style={{ color: '#6B7280' }}>이 페이지에 접근할 권한이 없습니다.</p>
        </div>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
};

// --- App ---
const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected — 모든 역할 */}
            <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
            <Route path="/regulations" element={<ProtectedRoute><RegulationView /></ProtectedRoute>} />

            {/* 휴가 관리 (foundation 제외) */}
            <Route path="/leaves/new" element={<ProtectedRoute roles={['staff','team_lead','director','hr_admin']}><LeaveForm /></ProtectedRoute>} />
            <Route path="/leaves" element={<ProtectedRoute roles={['staff','team_lead','director','hr_admin']}><LeaveList /></ProtectedRoute>} />
            <Route path="/leaves/:id" element={<ProtectedRoute roles={['staff','team_lead','director','hr_admin']}><LeaveDetail /></ProtectedRoute>} />

            {/* 승인 관리 */}
            <Route path="/approvals" element={<ProtectedRoute roles={['team_lead','director']}><ApprovalList /></ProtectedRoute>} />

            {/* 현황 */}
            <Route path="/calendar" element={<ProtectedRoute roles={['staff','team_lead','director','hr_admin']}><TeamCalendar /></ProtectedRoute>} />
            <Route path="/team-status" element={<ProtectedRoute roles={['team_lead','director','hr_admin']}><TeamStatus /></ProtectedRoute>} />
            <Route path="/full-status" element={<ProtectedRoute roles={['director','hr_admin','foundation']}><FullStatus /></ProtectedRoute>} />

            {/* 보고서 */}
            <Route path="/reports" element={<ProtectedRoute roles={['director','hr_admin','foundation']}><ReportView /></ProtectedRoute>} />

            {/* 관리자 설정 */}
            <Route path="/admin" element={<ProtectedRoute roles={['hr_admin']}><AdminSettings /></ProtectedRoute>} />

            {/* 데이터 검증 */}
            <Route path="/verification" element={<ProtectedRoute roles={['foundation']}><VerificationView /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
