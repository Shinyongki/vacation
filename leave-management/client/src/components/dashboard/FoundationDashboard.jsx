import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import ProgressBar from '../common/ProgressBar';

const FoundationDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await apiClient.get('/dashboard/foundation');
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error('Failed to load foundation dashboard:', err);
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

  const { facilityOverview, departmentUsage, accessBanner, recentExports } = data;

  const overviewCards = [
    { label: '전체 직원', value: facilityOverview.totalStaff, suffix: '명', color: 'var(--color-text-primary)' },
    { label: '부재', value: facilityOverview.currentAbsent, suffix: '명', color: 'var(--color-warning)' },
    { label: '휴가', value: facilityOverview.onLeave, suffix: '명', color: 'var(--color-primary)' },
    { label: '출근율', value: facilityOverview.attendanceRate, suffix: '%', color: 'var(--color-success)' },
  ];

  const deptColumns = [
    { key: 'department_name', label: '부서', sortable: false },
    { key: 'total_days', label: '총 연차', sortable: false, width: '90px' },
    { key: 'used_days', label: '사용', sortable: false, width: '80px' },
    {
      key: 'usage_rate', label: '사용률', sortable: false, width: '160px',
      render: (val) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ProgressBar
            value={val}
            color={val > 80 ? 'var(--color-danger)' : 'var(--color-primary)'}
            height={6}
          />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', minWidth: '36px' }}>
            {val}%
          </span>
        </div>
      )
    },
  ];

  const exportColumns = [
    {
      key: 'export_type', label: '유형', sortable: false, width: '100px',
      render: (val) => val === 'usage' ? '사용 현황' : '요약 보고서'
    },
    {
      key: 'date_from', label: '기간', sortable: false,
      render: (_, row) => `${row.date_from} ~ ${row.date_to}`
    },
    { key: 'exported_by_name', label: '내보낸 사람', sortable: false },
    {
      key: 'created_at', label: '일시', sortable: false, width: '110px',
      render: (val) => val ? val.slice(0, 10) : '-'
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1B3A5C' }}>
        대시보드
      </h2>

      {/* Access banner */}
      {accessBanner && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          background: 'var(--color-warning-light)',
          border: '0.5px solid var(--color-warning)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--color-warning)',
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-medium)',
        }}>
          <AlertCircle size={18} />
          {accessBanner.message}
        </div>
      )}

      {/* Facility overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {overviewCards.map((card) => (
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

      {/* Department usage */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">부서별 연차 사용 현황</h3>
        </div>
        <DataTable
          columns={deptColumns}
          data={departmentUsage}
          emptyMessage="부서 데이터가 없습니다."
        />
      </div>

      {/* Recent exports */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">최근 내보내기 이력</h3>
        </div>
        <DataTable
          columns={exportColumns}
          data={recentExports}
          emptyMessage="내보내기 이력이 없습니다."
        />
      </div>
    </div>
  );
};

export default FoundationDashboard;
