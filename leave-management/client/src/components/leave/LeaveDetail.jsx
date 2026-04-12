import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import apiClient from '../../api/client';
import useAuth from '../../hooks/useAuth';
import StatusBadge from '../common/StatusBadge';
import Badge from '../common/Badge';
import CancelConfirmModal from './CancelConfirmModal';
import RecallConfirmModal from './RecallConfirmModal';

const STEP_TYPE_LABELS = {
  draft: '기안',
  cooperation: '협조',
  review: '검토',
  approval: '결재',
};

const LeaveDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [request, setRequest] = useState(null);
  const [approvalSteps, setApprovalSteps] = useState([]);
  const [visibility, setVisibility] = useState([]);
  const [parentRequest, setParentRequest] = useState(null);
  const [childRequests, setChildRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const result = await apiClient.get(`/leaves/${id}`);
      if (result.success) {
        setRequest(result.data.request);
        setApprovalSteps(result.data.approvalSteps);
        setVisibility(result.data.visibility);
        setParentRequest(result.data.parentRequest);
        setChildRequests(result.data.childRequests || []);
      }
    } catch (err) {
      setError(err?.error || '휴가 상세 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const isOwn = request?.employeeId === user?.id;

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      const result = await apiClient.post(`/leaves/${id}/cancel`);
      if (result.success) {
        setShowCancelModal(false);
        fetchDetail();
      }
    } catch (err) {
      alert(err?.error || '취소 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecall = async (reason) => {
    try {
      setActionLoading(true);
      const result = await apiClient.post(`/leaves/${id}/recall`, { reason });
      if (result.success) {
        setShowRecallModal(false);
        fetchDetail();
      }
    } catch (err) {
      alert(err?.error || '회수 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRedraft = async () => {
    try {
      setActionLoading(true);
      const result = await apiClient.post(`/leaves/${id}/redraft`);
      if (result.success) {
        navigate(`/leaves/${result.data.requestId}`);
      }
    } catch (err) {
      alert(err?.error || '재기안 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-danger)' }}>
        {error || '데이터를 찾을 수 없습니다.'}
      </div>
    );
  }

  return (
    <div className="leave-detail">
      {/* Back button */}
      <button className="btn btn--ghost" onClick={() => navigate('/leaves')} style={{ marginBottom: '16px' }}>
        <ArrowLeft size={16} />
        목록으로
      </button>

      {/* Header */}
      <div className="leave-detail__header">
        <div className="leave-detail__header-left">
          <h2 className="leave-detail__title">
            <FileText size={20} />
            휴가 신청 상세
          </h2>
          <StatusBadge status={request.status} />
          {request.isUrgent ? <Badge variant="danger" size="sm">긴급</Badge> : null}
          {request.isRetroactive ? <Badge variant="warning" size="sm">사후 신청</Badge> : null}
        </div>
        <div className="leave-detail__header-right">
          <span className="leave-detail__id">#{request.id}</span>
        </div>
      </div>

      {/* Info card */}
      <div className="card">
        <div className="card__body">
          <div className="leave-detail__info-grid">
            <div className="leave-detail__info-item">
              <span className="leave-detail__info-label">신청자</span>
              <span className="leave-detail__info-value">{request.employeeName} ({request.employeeNumber})</span>
            </div>
            <div className="leave-detail__info-item">
              <span className="leave-detail__info-label">소속</span>
              <span className="leave-detail__info-value">{request.departmentName}</span>
            </div>
            <div className="leave-detail__info-item">
              <span className="leave-detail__info-label">휴가 유형</span>
              <span className="leave-detail__info-value">
                {request.leaveTypeName}
                {request.condolenceSubtypeName && ` - ${request.condolenceSubtypeName}`}
              </span>
            </div>
            <div className="leave-detail__info-item">
              <span className="leave-detail__info-label">기간</span>
              <span className="leave-detail__info-value">
                {request.startDate === request.endDate
                  ? request.startDate
                  : `${request.startDate} ~ ${request.endDate}`}
                {request.halfDayType === 'AM' && ' (오전 반차)'}
                {request.halfDayType === 'PM' && ' (오후 반차)'}
                {request.halfDayType === 'TIME' && ` (${request.timeStart} ~ ${request.timeEnd})`}
              </span>
            </div>
            <div className="leave-detail__info-item">
              <span className="leave-detail__info-label">신청 일수</span>
              <span className="leave-detail__info-value"><strong>{request.totalDays}일</strong></span>
            </div>
            <div className="leave-detail__info-item">
              <span className="leave-detail__info-label">신청일</span>
              <span className="leave-detail__info-value">{request.createdAt}</span>
            </div>
            {request.reason && (
              <div className="leave-detail__info-item leave-detail__info-item--full">
                <span className="leave-detail__info-label">사유</span>
                <span className="leave-detail__info-value">{request.reason}</span>
              </div>
            )}
            {request.isUrgent && request.urgentReason && (
              <div className="leave-detail__info-item leave-detail__info-item--full">
                <span className="leave-detail__info-label">긴급 사유</span>
                <span className="leave-detail__info-value">{request.urgentReason}</span>
              </div>
            )}
            {request.isRetroactive && (
              <div className="leave-detail__info-item leave-detail__info-item--full">
                <span className="leave-detail__info-label">사후 신청 사유</span>
                <span className="leave-detail__info-value">
                  {request.retroactiveCategory}
                  {request.retroactiveDetail && ` - ${request.retroactiveDetail}`}
                </span>
              </div>
            )}
            {request.recallReason && (
              <div className="leave-detail__info-item leave-detail__info-item--full">
                <span className="leave-detail__info-label">회수 사유</span>
                <span className="leave-detail__info-value">{request.recallReason}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Timeline */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card__header">
          <h3 className="card__title">결재 현황</h3>
        </div>
        <div className="card__body">
          <div className="approval-timeline">
            {approvalSteps.map((s, idx) => (
              <div key={s.id} className="approval-timeline__item">
                <div className="approval-timeline__connector">
                  <div className={`approval-timeline__dot approval-timeline__dot--${s.status}`}>
                    {s.status === 'approved' && '\u2713'}
                    {s.status === 'rejected' && '\u2717'}
                    {s.status === 'pending' && (idx + 1)}
                  </div>
                  {idx < approvalSteps.length - 1 && (
                    <div className={`approval-timeline__line ${s.status === 'approved' ? 'approval-timeline__line--done' : ''}`} />
                  )}
                </div>
                <div className="approval-timeline__content">
                  <div className="approval-timeline__header">
                    <span className="approval-timeline__type">
                      {STEP_TYPE_LABELS[s.stepType] || s.stepType}
                    </span>
                    <StatusBadge status={s.status} size="sm" />
                    {s.isDelegated ? <Badge variant="info" size="sm">대결</Badge> : null}
                  </div>
                  <div className="approval-timeline__assignee">
                    {s.assignedName}
                    {s.approverPosition && ` (${s.approverPosition})`}
                    {s.approverDeptName && ` / ${s.approverDeptName}`}
                  </div>
                  <div className="approval-timeline__times">
                    {s.readAt && (
                      <span className="approval-timeline__time">
                        {'\uD83D\uDC41'} 열람: {s.readAt}
                      </span>
                    )}
                    {s.actedAt && (
                      <span className="approval-timeline__time">
                        {'\u270D'} 처리: {s.actedAt}
                      </span>
                    )}
                  </div>
                  {s.comment && (
                    <div className="approval-timeline__comment">
                      {s.comment}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visibility */}
      {visibility.length > 0 && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div className="card__header">
            <h3 className="card__title">열람 범위</h3>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {visibility.map(v => (
                <Badge key={v.departmentId} variant="neutral" size="sm">{v.departmentName}</Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Parent/Child request links */}
      {parentRequest && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div className="card__body">
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              원본 신청:{' '}
              <Link to={`/leaves/${parentRequest.id}`} style={{ color: 'var(--color-primary)' }}>
                #{parentRequest.id} <ExternalLink size={12} style={{ verticalAlign: 'middle' }} />
              </Link>
              {' '}({parentRequest.status})
            </span>
          </div>
        </div>
      )}

      {childRequests.length > 0 && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div className="card__body">
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              재기안 내역:{' '}
              {childRequests.map((c, idx) => (
                <React.Fragment key={c.id}>
                  {idx > 0 && ', '}
                  <Link to={`/leaves/${c.id}`} style={{ color: 'var(--color-primary)' }}>
                    #{c.id} <ExternalLink size={12} style={{ verticalAlign: 'middle' }} />
                  </Link>
                  {' '}({c.status})
                </React.Fragment>
              ))}
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {isOwn && (
        <div className="leave-detail__actions" style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
          {request.status === 'pending' && (
            <>
              <button
                className="btn btn--danger"
                onClick={() => setShowCancelModal(true)}
              >
                취소
              </button>
              <button
                className="btn btn--secondary"
                onClick={() => setShowRecallModal(true)}
              >
                회수
              </button>
            </>
          )}
          {request.status === 'approved' && (
            <button
              className="btn btn--danger"
              onClick={() => setShowCancelModal(true)}
            >
              취소
            </button>
          )}
          {(request.status === 'recalled' || request.status === 'rejected') && (
            <button
              className="btn btn--primary"
              onClick={handleRedraft}
              disabled={actionLoading}
            >
              {actionLoading ? '처리 중...' : '재기안'}
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <CancelConfirmModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        loading={actionLoading}
        isApproved={request.status === 'approved'}
      />
      <RecallConfirmModal
        isOpen={showRecallModal}
        onClose={() => setShowRecallModal(false)}
        onConfirm={handleRecall}
        loading={actionLoading}
      />
    </div>
  );
};

export default LeaveDetail;
