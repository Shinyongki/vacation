import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import DatePicker from '../common/DatePicker';

const AdjustmentHistory = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [adjustedBy, setAdjustedBy] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [employees, setEmployees] = useState([]);
  const pageSize = 20;

  // Load employee list for filters
  useEffect(() => {
    apiClient.get('/admin/employees?limit=500')
      .then(res => {
        if (res.success) {
          setEmployees(res.data?.items || res.data || []);
        }
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (employeeId) params.append('employee_id', employeeId);
      if (adjustedBy) params.append('adjusted_by', adjustedBy);

      const res = await apiClient.get(`/verification/adjustment-logs?${params.toString()}`);
      if (res.success) {
        setData(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, employeeId, adjustedBy, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, employeeId, adjustedBy]);

  const columns = [
    {
      key: 'target_name',
      label: '대상 직원',
      width: '130px',
      render: (val, row) => `${val} (${row.target_number})`,
    },
    {
      key: 'adjuster_name',
      label: '조정자',
      width: '130px',
      render: (val, row) => `${val} (${row.adjuster_number})`,
    },
    {
      key: 'amount',
      label: '조정량',
      width: '80px',
      render: (val) => {
        const num = Number(val);
        const color = num > 0 ? 'var(--color-success)' : num < 0 ? 'var(--color-danger)' : 'var(--color-text-primary)';
        return (
          <span style={{ color, fontWeight: 600 }}>
            {num > 0 ? '+' : ''}{num}
          </span>
        );
      },
    },
    {
      key: 'reason',
      label: '사유',
      width: '200px',
      render: (val) => (
        <span style={{ fontSize: '12px' }} title={val}>
          {val && val.length > 30 ? val.substring(0, 30) + '...' : val}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: '일시',
      width: '160px',
    },
    {
      key: 'isBulk',
      label: '경고',
      width: '100px',
      sortable: false,
      render: (val) => val ? (
        <span style={bulkBadgeStyle}>
          <AlertTriangle size={12} style={{ marginRight: '4px' }} />
          대량
        </span>
      ) : null,
    },
  ];

  return (
    <div>
      {/* Filters */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>시작일</label>
            <DatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>종료일</label>
            <DatePicker value={dateTo} onChange={setDateTo} min={dateFrom} />
          </div>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>대상 직원</label>
            <select
              className="form-input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              style={{ height: '36px', minWidth: '150px' }}
            >
              <option value="">전체</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employee_number})
                </option>
              ))}
            </select>
          </div>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>조정자</label>
            <select
              className="form-input"
              value={adjustedBy}
              onChange={(e) => setAdjustedBy(e.target.value)}
              style={{ height: '36px', minWidth: '150px' }}
            >
              <option value="">전체</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employee_number})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, marginTop: '16px' }}>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage="조정 이력이 없습니다."
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: setPage,
          }}
        />
      </div>
    </div>
  );
};

const cardStyle = {
  background: 'var(--color-bg-card)',
  border: '0.5px solid var(--color-border)',
  borderRadius: '8px',
  padding: '16px 20px',
};

const filterGroupStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const labelStyle = {
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
};

const bulkBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: '999px',
  backgroundColor: '#FFF3E0',
  color: '#E67E22',
  fontSize: '11px',
  fontWeight: 600,
};

export default AdjustmentHistory;
