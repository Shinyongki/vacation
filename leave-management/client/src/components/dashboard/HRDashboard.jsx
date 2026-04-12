import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, Calendar, GitBranch, CalendarDays, Settings } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import Badge from '../common/Badge';

const ICON_MAP = {
  Users,
  Building2,
  Calendar,
  GitBranch,
  CalendarDays,
  Settings,
};

const HRDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await apiClient.get('/dashboard/hr');
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error('Failed to load HR dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="placeholder-page">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="placeholder-page">
        <div className="placeholder-page__title">데이터를 불러올 수 없습니다</div>
      </div>
    );
  }

  const { systemSummary, recentChanges, balanceAlerts, settingsQuickLinks } = data;

  const summaryCards = [
    { label: '전체 직원', value: systemSummary.totalEmployees, suffix: '명', color: 'var(--color-text-primary)' },
    { label: '재직 직원', value: systemSummary.activeEmployees, suffix: '명', color: 'var(--color-success)' },
    { label: '부서', value: systemSummary.departmentCount, suffix: '개', color: 'var(--color-primary)' },
    { label: '휴가 유형', value: systemSummary.leaveTypesCount, suffix: '개', color: 'var(--color-info)' },
  ];

  const changeColumns = [
    { key: 'name', label: '이름', sortable: false },
    { key: 'employee_number', label: '사번', sortable: false },
    {
      key: 'status', label: '상태', sortable: false, width: '90px',
      render: (val) => (
        <Badge variant={val === 'active' ? 'success' : 'neutral'} size="sm">
          {val === 'active' ? '재직' : '퇴직'}
        </Badge>
      )
    },
    {
      key: 'updated_at', label: '변경일', sortable: false, width: '110px',
      render: (val) => val ? val.slice(0, 10) : '-'
    },
  ];

  const alertColumns = [
    { key: 'employee_name', label: '직원', sortable: false },
    { key: 'department_name', label: '부서', sortable: false },
    { key: 'total_days', label: '총 일수', sortable: false, width: '80px' },
    { key: 'used_days', label: '사용', sortable: false, width: '70px' },
    {
      key: 'remaining_days', label: '잔여', sortable: false, width: '80px',
      render: (val) => (
        <span style={{ color: 'var(--color-danger)', fontWeight: 'var(--font-weight-bold)' }}>
          {val}일
        </span>
      )
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1B3A5C' }}>
        대시보드
      </h2>

      {/* System summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {summaryCards.map((card) => (
          <div key={card.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              {card.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
              <span style={{ fontSize: '40px', fontWeight: 'var(--font-weight-bold)', color: card.color, lineHeight: 1.2 }}>
                {card.value}
              </span>
              <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)' }}>
                {card.suffix}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent changes + Balance alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">최근 직원 변동</h3>
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/admin/employees')}>
              전체 보기
            </button>
          </div>
          <DataTable
            columns={changeColumns}
            data={recentChanges}
            emptyMessage="변동 내역이 없습니다."
          />
        </div>

        <div className="card">
          <div className="card__header">
            <h3 className="card__title">잔여 연차 부족 알림</h3>
          </div>
          <DataTable
            columns={alertColumns}
            data={balanceAlerts}
            emptyMessage="잔여 일수 부족 직원이 없습니다."
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">관리 메뉴 바로가기</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {settingsQuickLinks.map((link) => {
            const IconComp = ICON_MAP[link.icon] || Settings;
            return (
              <div
                key={link.path}
                className="card"
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                }}
                onClick={() => navigate(link.path)}
              >
                <IconComp size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)' }}>
                  {link.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;
