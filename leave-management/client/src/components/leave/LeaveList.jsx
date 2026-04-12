import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import StatusBadge from '../common/StatusBadge';
import ApprovalDots from '../common/ApprovalDots';
import Badge from '../common/Badge';

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'pending', label: '승인대기' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '반려' },
  { value: 'recalled', label: '회수' },
  { value: 'cancelled', label: '취소' },
];

const LeaveList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const pageSize = 10;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (yearFilter) params.set('year', String(yearFilter));

      const result = await apiClient.get(`/leaves?${params}`);
      if (result.success) {
        setData(result.data.requests);
        setTotal(result.data.pagination.total);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, yearFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, yearFilter]);

  const columns = [
    {
      key: 'id',
      label: 'No',
      width: '60px',
      sortable: false,
    },
    {
      key: 'leaveTypeName',
      label: '유형',
      width: '100px',
      render: (val, row) => (
        <span>
          {val}
          {row.isUrgent ? (
            <Badge variant="danger" size="sm" style={{ marginLeft: '4px' }}>긴급</Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: 'startDate',
      label: '기간',
      width: '180px',
      render: (val, row) => {
        if (row.startDate === row.endDate) {
          return (
            <span>
              {row.startDate}
              {row.halfDayType === 'AM' && ' (오전)'}
              {row.halfDayType === 'PM' && ' (오후)'}
              {row.halfDayType === 'TIME' && ' (시간)'}
            </span>
          );
        }
        return `${row.startDate} ~ ${row.endDate}`;
      },
    },
    {
      key: 'totalDays',
      label: '일수',
      width: '60px',
      render: (val) => `${val}일`,
    },
    {
      key: 'status',
      label: '상태',
      width: '80px',
      render: (val) => <StatusBadge status={val} size="sm" />,
    },
    {
      key: 'approvalSteps',
      label: '결재현황',
      width: '160px',
      sortable: false,
      render: (val, row) => (
        <ApprovalDots
          steps={row.approvalSteps}
          currentStep={row.currentStep}
        />
      ),
    },
    {
      key: 'createdAt',
      label: '신청일',
      width: '100px',
      render: (val) => val ? val.slice(0, 10) : '',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header__title">내 휴가 목록</h2>
        <button className="btn btn--primary" onClick={() => navigate('/leaves/new')}>
          <Plus size={16} />
          휴가 신청
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-bar__item">
          <label className="form-label">상태</label>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-bar__item">
          <label className="form-label">연도</label>
          <select
            className="form-select"
            value={yearFilter}
            onChange={(e) => setYearFilter(parseInt(e.target.value, 10))}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="휴가 신청 내역이 없습니다."
        onRowClick={(row) => navigate(`/leaves/${row.id}`)}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
        }}
      />
    </div>
  );
};

export default LeaveList;
