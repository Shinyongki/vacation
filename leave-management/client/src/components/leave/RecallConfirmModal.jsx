import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import Modal from '../common/Modal';

const RecallConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason);
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="휴가 회수"
      size="sm"
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn--secondary" onClick={handleClose} disabled={loading}>
            닫기
          </button>
          <button className="btn btn--primary" onClick={handleConfirm} disabled={loading}>
            {loading ? '처리 중...' : '회수하기'}
          </button>
        </div>
      }
    >
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <RotateCcw size={20} color="var(--color-info)" />
          <span>
            승인대기 중인 신청을 회수합니다. 회수 후 수정하여 재기안할 수 있습니다.
          </span>
        </div>

        <div className="leave-form__field">
          <label className="form-label">회수 사유 (선택)</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="회수 사유를 입력하세요"
          />
        </div>
      </div>
    </Modal>
  );
};

export default RecallConfirmModal;
