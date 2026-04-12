import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import Modal from '../common/Modal';

const BatchApproveModal = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  count = 0,
}) => {
  const [comment, setComment] = useState('');

  const handleConfirm = () => {
    onConfirm(comment.trim() || null);
  };

  const handleClose = () => {
    setComment('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="일괄 승인"
      size="sm"
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn--secondary" onClick={handleClose} disabled={loading}>
            취소
          </button>
          <button className="btn btn--primary" onClick={handleConfirm} disabled={loading}>
            {loading ? '처리 중...' : `${count}건 일괄 승인`}
          </button>
        </div>
      }
    >
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--color-primary)' }}>
          <CheckCircle size={20} />
          <span>선택한 <strong>{count}건</strong>을 일괄 승인합니다.</span>
        </div>

        <div className="leave-form__field">
          <label className="form-label">승인 의견 (선택)</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="일괄 승인 시 공통 의견을 입력하세요"
          />
        </div>
      </div>
    </Modal>
  );
};

export default BatchApproveModal;
