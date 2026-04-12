import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, AlertCircle } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import StatusBadge from '../common/StatusBadge';
import Calendar from '../common/Calendar';
import Badge from '../common/Badge';

const TeamLeadDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await apiClient.get('/dashboard/team-lead');
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error('Failed to load team-lead dashboard:', err);
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

  const { teamAttendance, pendingApprovals, recentRequests, upcomingLeaves, calendarEvents } = data;

  // Convert calendar events to the format Calendar component expects
  const calEvents = [];
  if (calendarEvents) {
    calendarEvents.forEach(ev => {
      const start = new Date(ev.start_date);
      const end = new Date(ev.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        calEvents.push({
          date: dateStr,
          label: `${ev.employee_name} - ${ev.leave_type_name}`,
          type: ev.leave_type_code === 'annual' ? 'annual' : 'default',
        });
      }
    });
  }

  const recentColumns = [
    { key: 'employee_name', label: '신청자', sortable: false },
    { key: 'leave_type_name', label: '유형', sortable: false },
    {
      key: 'start_date', label: '기간', sortable: false,
      render: (_, row) => `${row.start_date} ~ ${row.end_date}`
    },
    { key: 'total_days', label: '일수', width: '70px', sortable: false },
    {
      key: 'status', label: '상태', width: '100px', sortable: false,
      render: (val) => <StatusBadge status={val} size="sm" />
    },
  ];

  const upcomingColumns = [
    { key: 'employee_name', label: '직원', sortable: false },
    { key: 'leave_type_name', label: '유형', sortable: false },
    {
      key: 'start_date', label: '기간', sortable: false,
      render: (_, row) => `${row.start_date} ~ ${row.end_date}`
    },
    { key: 'total_days', label: '일수', width: '70px', sortable: false },
  ];

  const statCards = [
    { label: '전체', value: teamAttendance.total, color: 'var(--color-text-primary)' },
    { label: '출근', value: teamAttendance.present, color: 'var(--color-success)' },
    { label: '부재', value: teamAttendance.absent, color: 'var(--color-warning)' },
    { label: '휴가', value: teamAttendance.onLeave, color: 'var(--color-primary)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1B3A5C' }}>
        대시보드
      </h2>

      {/* Top row: Attendance + Pending */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Team attendance card */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} />
              팀 출근 현황
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', textAlign: 'center' }}>
            {statCards.map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: '28px', fontWeight: 'var(--font-weight-bold)', color: s.color, lineHeight: 1.2 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending approvals card */}
        <div
          className="card"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/approvals')}
        >
          <div className="card__header">
            <h3 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} />
              승인 대기
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '40px', fontWeight: 600, color: pendingApprovals > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)', lineHeight: 1.2 }}>
              {pendingApprovals}
            </span>
            <span style={{ fontSize: '16px', color: '#8A95A3' }}>건</span>
            {pendingApprovals > 0 && (
              <Badge variant="warning" size="sm">처리 필요</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Recent team requests */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">팀 최근 신청</h3>
        </div>
        <DataTable
          columns={recentColumns}
          data={recentRequests}
          emptyMessage="신청 내역이 없습니다."
          onRowClick={(row) => navigate(`/leaves/${row.id}`)}
        />
      </div>

      {/* Calendar + Upcoming leaves */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">팀 휴가 캘린더</h3>
          </div>
          <Calendar
            year={calYear}
            month={calMonth}
            events={calEvents}
            onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
          />
        </div>

        <div className="card">
          <div className="card__header">
            <h3 className="card__title">향후 7일 휴가</h3>
          </div>
          <DataTable
            columns={upcomingColumns}
            data={upcomingLeaves}
            emptyMessage="예정된 휴가가 없습니다."
          />
        </div>
      </div>
    </div>
  );
};

export default TeamLeadDashboard;
