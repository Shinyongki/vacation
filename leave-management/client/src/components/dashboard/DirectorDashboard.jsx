import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import Badge from '../common/Badge';
import ProgressBar from '../common/ProgressBar';

const DirectorDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await apiClient.get('/dashboard/director');
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error('Failed to load director dashboard:', err);
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

  const { todoSummary, pendingApprovals, attendanceRate, recentDecisions } = data;

  const pendingColumns = [
    { key: 'applicant_name', label: '신청자', sortable: false },
    { key: 'applicant_position', label: '직위', sortable: false, width: '80px' },
    { key: 'leave_type_name', label: '유형', sortable: false },
    {
      key: 'start_date', label: '기간', sortable: false,
      render: (_, row) => `${row.start_date} ~ ${row.end_date}`
    },
    { key: 'total_days', label: '일수', width: '70px', sortable: false },
    {
      key: 'daysWaiting', label: '대기일', width: '90px', sortable: false,
      render: (val) => (
        <span style={{
          color: val >= 7 ? 'var(--color-danger)' : 'var(--color-text-primary)',
          fontWeight: val >= 7 ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
        }}>
          {val}일
          {val >= 7 && (
            <Badge variant="danger" size="sm" style={{ marginLeft: '4px' }}>지연</Badge>
          )}
        </span>
      )
    },
    {
      key: 'is_urgent', label: '긴급', width: '60px', sortable: false,
      render: (val) => val ? <Badge variant="danger" size="sm">긴급</Badge> : null
    },
  ];

  const decisionColumns = [
    { key: 'applicant_name', label: '신청자', sortable: false },
    { key: 'leave_type_name', label: '유형', sortable: false },
    {
      key: 'start_date', label: '기간', sortable: false,
      render: (_, row) => `${row.start_date} ~ ${row.end_date}`
    },
    {
      key: 'decision', label: '결과', width: '90px', sortable: false,
      render: (val) => (
        <Badge variant={val === 'approved' ? 'success' : 'danger'} size="sm">
          {val === 'approved' ? '승인' : '반려'}
        </Badge>
      )
    },
    {
      key: 'acted_at', label: '처리일', sortable: false, width: '110px',
      render: (val) => val ? val.slice(0, 10) : '-'
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1B3A5C' }}>
        대시보드
      </h2>

      {/* Top row: Todo summary + Attendance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Todo summary */}
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/approvals')}>
          <div className="card__header">
            <h3 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={18} />
              결재 현황
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)' }}>대기 </span>
              <span style={{ fontSize: '28px', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
                {todoSummary.pendingCount}
              </span>
              <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)' }}>건</span>
            </div>
            {todoSummary.overdueCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
                <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)' }}>7일 초과 </span>
                <Badge variant="danger" size="md">{todoSummary.overdueCount}건</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Attendance rate */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">전체 출근율</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
            <span style={{
              fontSize: '40px',
              fontWeight: 'var(--font-weight-bold)',
              color: attendanceRate >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
              lineHeight: 1.2,
            }}>
              {attendanceRate}
            </span>
            <span style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)' }}>%</span>
          </div>
          <ProgressBar
            value={attendanceRate}
            color={attendanceRate >= 80 ? 'var(--color-success)' : 'var(--color-warning)'}
            height={8}
          />
        </div>
      </div>

      {/* Pending approvals table */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">승인 대기 목록</h3>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/approvals')}>
            전체 보기
          </button>
        </div>
        <DataTable
          columns={pendingColumns}
          data={pendingApprovals}
          emptyMessage="대기 중인 결재가 없습니다."
          onRowClick={(row) => navigate(`/leaves/${row.request_id}`)}
        />
      </div>

      {/* Recent decisions */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">최근 결재 처리</h3>
        </div>
        <DataTable
          columns={decisionColumns}
          data={recentDecisions}
          emptyMessage="처리 내역이 없습니다."
        />
      </div>
    </div>
  );
};

export default DirectorDashboard;
