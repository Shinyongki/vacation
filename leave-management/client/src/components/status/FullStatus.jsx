import React, { useState, useEffect } from 'react';
import { Building2, Users, UserX, TrendingUp } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import ProgressBar from '../common/ProgressBar';
import Badge from '../common/Badge';

const FullStatus = () => {
  const [departments, setDepartments] = useState([]);
  const [overall, setOverall] = useState({ totalStaff: 0, currentAbsent: 0, onLeave: 0, attendanceRate: 0 });
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 재단/HR/원장 대시보드에서 전체 현황 가져오기
        const endpoints = ['/dashboard/foundation', '/dashboard/hr', '/dashboard/director'];
        for (const ep of endpoints) {
          try {
            const res = await apiClient.get(ep);
            if (res.success && res.data) {
              if (res.data.facilityOverview) {
                setOverall(res.data.facilityOverview);
              }
              if (res.data.departmentUsage) {
                setDepartments(res.data.departmentUsage);
              }
              if (res.data.systemSummary) {
                setOverall(prev => ({
                  ...prev,
                  totalStaff: res.data.systemSummary.activeEmployees || res.data.systemSummary.totalEmployees || prev.totalStaff
                }));
              }
              break;
            }
          } catch (e) { continue; }
        }

        // 최근 승인된 휴가
        try {
          const teamRes = await apiClient.get('/leaves/team-status');
          if (teamRes.success && teamRes.data) {
            setRecentLeaves(teamRes.data.leaves || teamRes.data.teamStatus || []);
          }
        } catch (e) { /* ignore */ }
      } catch (e) { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, []);

  const overviewCards = [
    { label: '전체 직원', value: overall.totalStaff, icon: Users, color: '#1B5E9E' },
    { label: '현재 부재', value: overall.currentAbsent, icon: UserX, color: '#DC3545' },
    { label: '휴가 중', value: overall.onLeave, icon: Building2, color: '#F59E0B' },
    { label: '출근률', value: `${overall.attendanceRate || 0}%`, icon: TrendingUp, color: '#0F8A4F' },
  ];

  const deptColumns = [
    { key: 'departmentName', label: '부서', width: '150px',
      render: (val, row) => val || row.department_name || row.name },
    { key: 'totalEmployees', label: '인원', width: '80px',
      render: (val, row) => val || row.total_employees || row.employeeCount || 0 },
    { key: 'totalUsed', label: '사용일수', width: '100px',
      render: (val, row) => val || row.total_used || row.usedDays || 0 },
    { key: 'usageRate', label: '사용률', width: '200px',
      render: (val, row) => {
        const rate = val || row.usage_rate || row.usageRate || 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ProgressBar value={rate} height={8} color={rate > 80 ? '#DC3545' : rate > 50 ? '#F59E0B' : '#0F8A4F'} />
            <span style={{ fontSize: '13px', minWidth: '40px' }}>{Math.round(rate)}%</span>
          </div>
        );
      }
    },
  ];

  const leaveColumns = [
    { key: 'employeeName', label: '이름', width: '100px',
      render: (val, row) => val || row.employee_name || row.name },
    { key: 'departmentName', label: '부서', width: '100px',
      render: (val, row) => val || row.department_name || row.department },
    { key: 'leaveTypeName', label: '유형', width: '100px',
      render: (val, row) => val || row.leave_type_name || row.leaveType },
    { key: 'startDate', label: '시작', width: '110px',
      render: (val, row) => val || row.start_date },
    { key: 'endDate', label: '종료', width: '110px',
      render: (val, row) => val || row.end_date },
    { key: 'totalDays', label: '일수', width: '70px',
      render: (val, row) => val || row.total_days },
  ];

  return (
    <div>
      <div className="page-header">
        <h2>전체 현황</h2>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <>
          {/* 전체 통계 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {overviewCards.map(card => (
              <div key={card.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
                <card.icon size={24} style={{ color: card.color, marginBottom: '8px' }} />
                <div style={{ fontSize: '28px', fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: '13px', color: '#6B7280' }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* 부서별 현황 */}
          {departments.length > 0 && (
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>부서별 휴가 사용 현황</h3>
              <DataTable
                columns={deptColumns}
                data={departments}
                emptyMessage="부서별 데이터가 없습니다."
              />
            </div>
          )}

          {/* 최근 휴가 */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>현재/예정 휴가</h3>
            <DataTable
              columns={leaveColumns}
              data={recentLeaves}
              emptyMessage="현재 진행 중인 휴가가 없습니다."
            />
          </div>
        </>
      )}
    </div>
  );
};

export default FullStatus;
