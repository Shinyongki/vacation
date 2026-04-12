import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../common/Modal';

const CancelConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  isApproved = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="휴가 취소 확인"
      size="sm"
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn--secondary" onClick={onClose} disabled={loading}>
            닫기
          </button>
          <button className="btn btn--danger" onClick={onConfirm} disabled={loading}>
            {loading ? '처리 중...' : '취소하기'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '16px 0' }}>
        <AlertTriangle size={48} color="var(--color-danger)" />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: '8px' }}>
            정말 이 휴가 신청을 취소하시겠습니까?
          </p>
          {isApproved && (
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
              이미 승인된 휴가입니다. 취소 시 사용한 연차가 복원됩니다.
            </p>
          )}
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            취소된 신청은 재기안할 수 없습니다.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default CancelConfirmModal;
