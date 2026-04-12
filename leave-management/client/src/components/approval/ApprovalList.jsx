import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import apiClient from '../../api/client';
import useAuth from '../../hooks/useAuth';
import DataTable from '../common/DataTable';
import StatusBadge from '../common/StatusBadge';
import ApprovalDots from '../common/ApprovalDots';
import Badge from '../common/Badge';
import RejectModal from './RejectModal';
import BatchApproveModal from './BatchApproveModal';

const ApprovalList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const [selectedStepId, setSelectedStepId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiClient.get(`/approvals/pending?page=${page}&limit=${pageSize}`);
      if (result.success) {
        setData(result.data.approvals);
        setTotal(result.data.pagination.total);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (stepId) => {
    try {
      setActionLoading(true);
      const result = await apiClient.post(`/approvals/${stepId}/approve`);
      if (result.success) {
        fetchData();
      }
    } catch (err) {
      alert(err?.error || '승인 처리 중 오���가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (comment) => {
    if (!selectedStepId) return;
    try {
      setActionLoading(true);
      const result = await apiClient.post(`/approvals/${selectedStepId}/reject`, { comment });
      if (result.success) {
        setShowRejectModal(false);
        setSelectedStepId(null);
        fetchData();
      }
    } catch (err) {
      alert(err?.error || '반려 처�� 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchApprove = async (comment) => {
    try {
      setActionLoading(true);
      const result = await apiClient.post('/approvals/batch', {
        stepIds: selectedIds,
        comment,
      });
      if (result.success) {
        setShowBatchModal(false);
        setSelectedIds([]);
        fetchData();
      }
    } catch (err) {
      alert(err?.error || '일괄 승인 처��� 중 오���가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelect = (stepId) => {
    setSelectedIds(prev =>
      prev.includes(stepId)
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.map(d => d.stepId));
    }
  };

  const columns = [
    ...(user?.role === 'director' ? [{
      key: '_select',
      label: (
        <input
          type="checkbox"
          checked={data.length > 0 && selectedIds.length === data.length}
          onChange={toggleSelectAll}
        />
      ),
      width: '40px',
      sortable: false,
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.stepId)}
          onChange={(e) => {
            e.stopPropagation();
            toggleSelect(row.stepId);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    }] : []),
    {
      key: 'applicantName',
      label: '신청���',
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
        if (row.startDate === row.endDate) {
          return row.startDate + (row.halfDayType ? ` (${row.halfDayType === 'AM' ? '오전' : row.halfDayType === 'PM' ? '오후' : '시간'})` : '');
        }
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
      key: 'isUrgent',
      label: '긴급',
      width: '60px',
      sortable: false,
      render: (val) => val ? <Badge variant="danger" size="sm">긴급</Badge> : null,
    },
    {
      key: 'approvalSteps',
      label: '결재현���',
      width: '140px',
      sortable: false,
      render: (val, row) => (
        <ApprovalDots steps={row.approvalSteps} currentStep={row.currentStep} />
      ),
    },
    {
      key: 'requestCreatedAt',
      label: '신청일',
      width: '90px',
      render: (val, row) => {
        const dateStr = val ? val.slice(0, 10) : '';
        const isOverdue = row.daysSinceCreated >= 7;
        return (
          <span style={isOverdue ? { color: 'var(--color-danger)', fontWeight: 'var(--font-weight-semibold)' } : {}}>
            {dateStr}
            {isOverdue && <AlertTriangle size={12} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />}
          </span>
        );
      },
    },
    {
      key: '_actions',
      label: '처리',
      width: '120px',
      sortable: false,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => handleApprove(row.stepId)}
            disabled={actionLoading}
            title="승인"
          >
            <CheckCircle size={14} />
          </button>
          <button
            className="btn btn--danger btn--sm"
            onClick={() => {
              setSelectedStepId(row.stepId);
              setShowRejectModal(true);
            }}
            disabled={actionLoading}
            title="반려"
          >
            <XCircle size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header__title">승인 대기</h2>
        {user?.role === 'director' && selectedIds.length > 0 && (
          <button
            className="btn btn--primary"
            onClick={() => setShowBatchModal(true)}
          >
            <CheckCircle size={16} />
            일괄 승인 ({selectedIds.length}건)
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="승인 대기 항목이 없습니다."
        onRowClick={(row) => navigate(`/leaves/${row.requestId}`)}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
        }}
      />

      <RejectModal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setSelectedStepId(null); }}
        onConfirm={handleReject}
        loading={actionLoading}
      />

      <BatchApproveModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onConfirm={handleBatchApprove}
        loading={actionLoading}
        count={selectedIds.length}
      />
    </div>
  );
};

export default ApprovalList;
