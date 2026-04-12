import React, { useState } from 'react';
import { Users, Calendar, GitBranch, UserCheck, CalendarDays, Settings, BarChart3 } from 'lucide-react';
import EmployeeManagement from './EmployeeManagement';
import LeaveTypeSettings from './LeaveTypeSettings';
import ApprovalFlowSettings from './ApprovalFlowSettings';
import DelegateManagement from './DelegateManagement';
import HolidayManagement from './HolidayManagement';
import SystemSettings from './SystemSettings';
import BalanceManagement from './BalanceManagement';

const TABS = [
  { key: 'employees', label: '직원 관리', icon: Users },
  { key: 'leaveTypes', label: '휴가 유형', icon: Calendar },
  { key: 'approvalFlows', label: '결재 라인', icon: GitBranch },
  { key: 'delegates', label: '대결자 관리', icon: UserCheck },
  { key: 'holidays', label: '휴일 관리', icon: CalendarDays },
  { key: 'settings', label: '시스템 설정', icon: Settings },
  { key: 'balances', label: '잔여일수 관리', icon: BarChart3 },
];

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('employees');

  const renderContent = () => {
    switch (activeTab) {
      case 'employees': return <EmployeeManagement />;
      case 'leaveTypes': return <LeaveTypeSettings />;
      case 'approvalFlows': return <ApprovalFlowSettings />;
      case 'delegates': return <DelegateManagement />;
      case 'holidays': return <HolidayManagement />;
      case 'settings': return <SystemSettings />;
      case 'balances': return <BalanceManagement />;
      default: return null;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
          관리자 설정
        </h1>
      </div>

      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid var(--color-border)',
        marginBottom: '20px',
        overflowX: 'auto',
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                fontSize: 'var(--font-size-base)',
                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color var(--transition-fast), border-color var(--transition-fast)',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {renderContent()}
    </div>
  );
};

export default AdminSettings;
