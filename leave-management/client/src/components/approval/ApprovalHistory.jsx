import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import StatusBadge from '../common/StatusBadge';
import Badge from '../common/Badge';
import DatePicker from '../common/DatePicker';

const ApprovalHistory = () => {
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const result = await apiClient.get(`/approvals/history?${params}`);
      if (result.success) {
        setData(result.data.history);
        setTotal(result.data.pagination.total);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  const columns = [
    {
      key: 'applicantName',
      label: '신청자',
      width: '100px',
      render: (val, row) => (
        <span>
          {val}
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginLeft: '4px' }}>
            {row.applicantDept}
          </span>
        </span>
      ),
    },
    {
      key: 'leaveTypeName',
      label: '유형',
      width: '80px',
    },
    {
      key: 'startDate',
      label: '기간',
      width: '170px',
      render: (val, row) => {
        if (row.startDate === row.endDate) return row.startDate;
        return `${row.startDate} ~ ${row.endDate}`;
      },
    },
    {
      key: 'totalDays',
      label: '일수',
      width: '50px',
      render: (val) => `${val}일`,
    },
    {
      key: 'stepStatus',
      label: '처리결과',
      width: '80px',
      render: (val) => <StatusBadge status={val} size="sm" />,
    },
    {
      key: 'isDelegated',
      label: '대결',
      width: '50px',
      sortable: false,
      render: (val) => val ? <Badge variant="info" size="sm">대결</Badge> : null,
    },
    {
      key: 'actedAt',
      label: '처리일',
      width: '140px',
    },
    {
      key: 'comment',
      label: '의견',
      render: (val) => val ? (
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {val.length > 30 ? val.slice(0, 30) + '...' : val}
        </span>
      ) : null,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header__title">결재 이력</h2>
      </div>

      <div className="filter-bar">
        <div className="filter-bar__item">
          <label className="form-label">시작일</label>
          <DatePicker value={startDate} onChange={setStartDate} />
        </div>
        <div className="filter-bar__item">
          <label className="form-label">종료일</label>
          <DatePicker value={endDate} onChange={setEndDate} min={startDate} />
        </div>
        {(startDate || endDate) && (
          <div className="filter-bar__item" style={{ alignSelf: 'flex-end' }}>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { setStartDate(''); setEndDate(''); }}
            >
              초기화
            </button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="결재 이력이 없습니다."
        onRowClick={(row) => navigate(`/leaves/${row.requestId}`, { state: { from: '/approvals/history' } })}
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

export default ApprovalHistory;
