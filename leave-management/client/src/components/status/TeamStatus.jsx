import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import Badge from '../common/Badge';
import StatusBadge from '../common/StatusBadge';

const TeamStatus = () => {
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState({ total: 0, present: 0, absent: 0, onLeave: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 팀원 현황 (leaves/team-status API 활용)
        const res = await apiClient.get('/leaves/team-status');
        if (res.success && res.data) {
          setMembers(res.data.leaves || res.data.teamStatus || []);
        }

        // 대시보드에서 출근 현황 가져오기
        try {
          const dashRes = await apiClient.get('/dashboard/team-lead');
          if (dashRes.success && dashRes.data?.teamAttendance) {
            setAttendance(dashRes.data.teamAttendance);
          }
        } catch (e) { /* non-team-lead may fail, that's ok */ }
      } catch (e) { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, []);

  const statCards = [
    { label: '전체', value: attendance.total, icon: Users, color: '#1B5E9E' },
    { label: '출근', value: attendance.present, icon: UserCheck, color: '#0F8A4F' },
    { label: '부재', value: attendance.absent, icon: UserX, color: '#DC3545' },
    { label: '휴가', value: attendance.onLeave, icon: Clock, color: '#F59E0B' },
  ];

  const columns = [
    { key: 'employeeName', label: '이름', width: '120px', sortable: true,
      render: (val, row) => val || row.employee_name || row.name },
    { key: 'departmentName', label: '부서', width: '120px',
      render: (val, row) => val || row.department_name || row.department },
    { key: 'leaveTypeName', label: '휴가 유형', width: '120px',
      render: (val, row) => val || row.leave_type_name || row.leaveType || '-' },
    { key: 'startDate', label: '시작일', width: '110px',
      render: (val, row) => val || row.start_date || '-' },
    { key: 'endDate', label: '종료일', width: '110px',
      render: (val, row) => val || row.end_date || '-' },
    { key: 'totalDays', label: '일수', width: '80px',
      render: (val, row) => val || row.total_days || '-' },
    { key: 'status', label: '상태', width: '100px',
      render: (val) => val ? <StatusBadge status={val} /> : '-' },
  ];

  return (
    <div>
      <div className="page-header">
        <h2>팀원 현황</h2>
      </div>

      {/* 출근 현황 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {statCards.map(card => (
          <div key={card.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <card.icon size={24} style={{ color: card.color, marginBottom: '8px' }} />
            <div style={{ fontSize: '28px', fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: '13px', color: '#6B7280' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* 팀원 휴가 목록 */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>현재/예정 휴가</h3>
        <DataTable
          columns={columns}
          data={members}
          loading={loading}
          emptyMessage="현재 팀원의 휴가 현황이 없습니다."
        />
      </div>
    </div>
  );
};

export default TeamStatus;
