import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import Modal from '../common/Modal';

const RejectModal = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!comment.trim()) {
      setError('반려 사유를 입력해 주세요.');
      return;
    }
    setError('');
    onConfirm(comment.trim());
  };

  const handleClose = () => {
    setComment('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="반려"
      size="sm"
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn--secondary" onClick={handleClose} disabled={loading}>
            취소
          </button>
          <button className="btn btn--danger" onClick={handleConfirm} disabled={loading}>
            {loading ? '처리 중...' : '반려'}
          </button>
        </div>
      }
    >
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--color-danger)' }}>
          <XCircle size={20} />
          <span>이 휴가 신청을 반려합니다.</span>
        </div>

        <div className="leave-form__field">
          <label className="form-label">반려 사유 (필수)</label>
          <textarea
            className="form-textarea"
            rows={4}
            value={comment}
            onChange={(e) => { setComment(e.target.value); setError(''); }}
            placeholder="반려 사유를 입력하세요"
            style={error ? { borderColor: 'var(--color-danger)' } : {}}
          />
          {error && (
            <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
              {error}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default RejectModal;
