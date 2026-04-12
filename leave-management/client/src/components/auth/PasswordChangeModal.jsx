import React, { useState } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

export default function PasswordChangeModal({ isInitial, onClose }) {
  const { updateUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canClose = !isInitial;

  const validate = () => {
    if (!currentPassword) {
      setError('현재 비밀번호를 입력해 주세요.');
      return false;
    }
    if (!newPassword) {
      setError('새 비밀번호를 입력해 주세요.');
      return false;
    }
    if (newPassword.length < 4) {
      setError('새 비밀번호는 4자 이상이어야 합니다.');
      return false;
    }
    if (currentPassword === newPassword) {
      setError('새 비밀번호가 현재 비밀번호와 같습니다.');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setSubmitting(true);
    try {
      await apiClient.put('/auth/password', { currentPassword, newPassword });
      updateUser({ isInitialPassword: false });
      onClose();
    } catch (err) {
      setError(err.error || '비밀번호 변경에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={canClose ? onClose : undefined}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.headerTitle}>비밀번호 변경</span>
          {canClose && (
            <button style={styles.closeButton} onClick={onClose}>&times;</button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={styles.body}>
          {isInitial && (
            <div style={styles.notice}>
              초기 비밀번호를 변경해야 시스템을 이용할 수 있습니다.
            </div>
          )}

          {error && (
            <div style={styles.error}>{error}</div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>현재 비밀번호</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={styles.input}
              placeholder="현재 비밀번호"
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={styles.input}
              placeholder="4자 이상"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>새 비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              placeholder="새 비밀번호 다시 입력"
            />
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            {canClose && (
              <button type="button" onClick={onClose} style={styles.cancelButton}>
                취소
              </button>
            )}
            <button type="submit" disabled={submitting} style={{
              ...styles.submitButton,
              opacity: submitting ? 0.5 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}>
              {submitting ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '420px',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif'
  },
  header: {
    backgroundColor: '#1B3A5C',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: 500
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#7A9AB8',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0',
    lineHeight: 1
  },
  body: {
    padding: '20px'
  },
  notice: {
    backgroundColor: '#FFFBEB',
    border: '0.5px solid #FDE68A',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#92400E',
    marginBottom: '16px'
  },
  error: {
    backgroundColor: '#FEF2F2',
    border: '0.5px solid #FECACA',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#991B1B',
    marginBottom: '12px'
  },
  field: {
    marginBottom: '14px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 400,
    color: '#8A95A3',
    marginBottom: '4px'
  },
  input: {
    width: '100%',
    height: '36px',
    padding: '0 10px',
    fontSize: '13px',
    border: '1px solid #CDD1D7',
    borderRadius: '6px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    color: '#333333'
  },
  footer: {
    borderTop: '0.5px solid #EEF0F2',
    paddingTop: '12px',
    marginTop: '4px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
  },
  cancelButton: {
    height: '36px',
    padding: '6px 16px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: '#F3F5F7',
    color: '#5A6E82',
    border: '0.5px solid #DDE1E7',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  submitButton: {
    height: '36px',
    padding: '6px 16px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: '#1B5E9E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'inherit'
  }
};
