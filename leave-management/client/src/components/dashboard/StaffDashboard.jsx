import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import apiClient from '../../api/client';
import useAuth from '../../hooks/useAuth';
import DataTable from '../common/DataTable';
import StatusBadge from '../common/StatusBadge';
import ProgressBar from '../common/ProgressBar';
import GuideCard from '../common/GuideCard';

const StaffDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await apiClient.get('/dashboard/staff');
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error('Failed to load staff dashboard:', err);
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

  const { balance, calcDetail, recentRequests, pendingCount, guideCards } = data;
  const usagePercent = balance.totalDays > 0
    ? Math.round((balance.usedDays / balance.totalDays) * 100)
    : 0;

  const recentColumns = [
    { key: 'leave_type_name', label: '휴가 유형', sortable: false },
    {
      key: 'start_date', label: '기간', sortable: false,
      render: (_, row) => `${row.start_date} ~ ${row.end_date}`
    },
    { key: 'total_days', label: '일수', width: '80px', sortable: false },
    {
      key: 'status', label: '상태', width: '100px', sortable: false,
      render: (val) => <StatusBadge status={val} size="sm" />
    },
  ];

  // 시간연차 일수를 사용자 친화적으로 표시
  const formatDays = (days) => {
    if (days === null || days === undefined) return '-';
    if (days < 0.125) return `${Math.round(days * 8 * 60)}분`;
    if (days < 1 && days !== 0.5) {
      const hours = days * 8;
      return hours % 1 === 0 ? `${hours}시간` : `${hours.toFixed(1)}시간`;
    }
    return Number.isInteger(days) ? `${days}일` : `${days}일`;
  };

  const recentColumnsWithFormat = recentColumns.map(col =>
    col.key === 'total_days'
      ? { ...col, render: (val) => formatDays(val) }
      : col
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page title — v1.1: 17px 600 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1B3A5C' }}>
          대시보드
        </h2>
        <button className="btn btn--primary" onClick={() => navigate('/leaves/new')}>
          휴가 신청
        </button>
      </div>

      {/* Guide cards */}
      {guideCards && guideCards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {guideCards.map((card, idx) => (
            <GuideCard
              key={idx}
              title={card.type === 'password' ? '비밀번호 변경 안내' : '신청 현황'}
              onAction={card.type === 'password' ? () => navigate('/settings/password') : undefined}
              actionLabel={card.type === 'password' ? '비밀번호 변경' : undefined}
            >
              {card.message}
            </GuideCard>
          ))}
        </div>
      )}

      {/* Balance card — v1.1: hero 40px 600, 배경 #EFF6FF */}
      <div className="card card--hero">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '40px', fontWeight: 600, color: '#1B5E9E', lineHeight: 1.1 }}>
            {balance.remainingDays}
          </span>
          <span style={{ fontSize: '16px', fontWeight: 400, color: '#8A95A3' }}>
            일 남음
          </span>
        </div>
        <p style={{ fontSize: '14px', color: '#8A95A3', marginBottom: '12px' }}>
          총 {balance.totalDays}일 중 {balance.usedDays}일 사용, {balance.adjustedDays}일 조정
        </p>
        <ProgressBar
          value={usagePercent}
          color={usagePercent > 80 ? '#DC3545' : '#1B5E9E'}
          height={6}
        />
      </div>

      {/* Calc detail card */}
      {calcDetail && (
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">연차 산정 내역</h3>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <tbody>
                <tr>
                  <td style={{ fontWeight: 500, color: '#8A95A3', width: '100px', fontSize: '13px' }}>입사일</td>
                  <td style={{ fontSize: '13px' }}>{calcDetail.hireDate}</td>
                </tr>
                {calcDetail.fullYears !== undefined && (
                  <tr>
                    <td style={{ fontWeight: 500, color: '#8A95A3', fontSize: '13px' }}>근속연수</td>
                    <td style={{ fontSize: '13px' }}>{calcDetail.fullYears}년</td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontWeight: 500, color: '#8A95A3', fontSize: '13px' }}>산정 기준</td>
                  <td style={{ fontSize: '13px' }}>{calcDetail.formula}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500, color: '#8A95A3', fontSize: '13px' }}>총 연차일수</td>
                  <td style={{ fontSize: '14px', fontWeight: 600 }}>{calcDetail.totalDays || balance.totalDays}일</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent requests */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">최근 신청 내역</h3>
          <a
            onClick={() => navigate('/leaves')}
            style={{ fontSize: '13px', color: '#1B5E9E', cursor: 'pointer' }}
          >
            전체 보기
          </a>
        </div>
        <DataTable
          columns={recentColumnsWithFormat}
          data={recentRequests}
          emptyMessage="신청 내역이 없습니다."
          onRowClick={(row) => navigate(`/leaves/${row.id}`)}
        />
      </div>
    </div>
  );
};

export default StaffDashboard;
