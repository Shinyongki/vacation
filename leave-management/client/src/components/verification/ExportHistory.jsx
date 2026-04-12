import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import DatePicker from '../common/DatePicker';
import Badge from '../common/Badge';

const EXPORT_TYPE_LABELS = {
  usage: '사용 현황',
  summary: '요약 보고서',
};

const ExportHistory = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const res = await apiClient.get(`/verification/export-logs?${params.toString()}`);
      if (res.success) {
        setData(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo]);

  const columns = [
    {
      key: 'export_type',
      label: '유형',
      width: '120px',
      render: (val) => EXPORT_TYPE_LABELS[val] || val,
    },
    {
      key: 'date_from',
      label: '기간',
      width: '180px',
      render: (val, row) => `${row.date_from} ~ ${row.date_to}`,
    },
    {
      key: 'verification_code',
      label: '검증코드',
      width: '200px',
      render: (val) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{val}</span>
      ),
    },
    {
      key: 'exported_by_name',
      label: '생성자',
      width: '120px',
      render: (val, row) => `${val} (${row.exported_by_number})`,
    },
    {
      key: 'created_at',
      label: '생성일',
      width: '160px',
    },
    {
      key: 'isRepeated',
      label: '경고',
      width: '100px',
      sortable: false,
      render: (val) => val ? (
        <span style={warningBadgeStyle}>
          <AlertTriangle size={12} style={{ marginRight: '4px' }} />
          중복
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
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, marginTop: '16px' }}>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage="내보내기 이력이 없습니다."
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

const warningBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: '999px',
  backgroundColor: '#FFF3E0',
  color: '#E67E22',
  fontSize: '11px',
  fontWeight: 600,
};

export default ExportHistory;
