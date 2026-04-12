import React, { useState } from 'react';
import { ShieldCheck, ShieldX, Search } from 'lucide-react';
import apiClient from '../../api/client';

const EXPORT_TYPE_LABELS = {
  usage: '사용 현황 보고서',
  summary: '요약 보고서',
};

const ReportVerify = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { verified, exportLog? }
  const [error, setError] = useState('');

  // Auto-format verification code input: XXXX-XXXX-XXXX-XXXX
  const handleCodeChange = (e) => {
    let val = e.target.value.toUpperCase().replace(/[^A-F0-9-]/g, '');

    // Remove existing hyphens for re-formatting
    const raw = val.replace(/-/g, '');
    const parts = [];
    for (let i = 0; i < raw.length && i < 16; i += 4) {
      parts.push(raw.substring(i, Math.min(i + 4, 16)));
    }
    setCode(parts.join('-'));
    setResult(null);
    setError('');
  };

  const handleVerify = async () => {
    if (!code || code.replace(/-/g, '').length !== 16) {
      setError('검증코드 형식이 올바르지 않습니다. (XXXX-XXXX-XXXX-XXXX)');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await apiClient.post('/verification/verify', { verificationCode: code });
      if (res.success) {
        setResult(res.data);
      } else {
        setError(res.error || '검증에 실패했습니다.');
      }
    } catch (err) {
      setError(err?.error || '검증 요청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleVerify();
  };

  return (
    <div>
      {/* Input card */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
          보고서 검증코드 입력
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          보고서에 포함된 검증코드를 입력하여 원본 여부를 확인합니다.
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            style={{
              height: '40px',
              fontSize: '16px',
              fontFamily: 'monospace',
              letterSpacing: '1px',
              width: '300px',
              textAlign: 'center',
            }}
            maxLength={19}
          />
          <button
            onClick={handleVerify}
            disabled={loading || !code}
            style={{
              height: '40px',
              padding: '0 20px',
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-family)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              opacity: loading || !code ? 0.6 : 1,
            }}
          >
            <Search size={16} />
            {loading ? '검증 중...' : '검증'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '12px', color: 'var(--color-danger)', fontSize: '13px' }}>
            {error}
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div style={{ marginTop: '16px' }}>
          {result.verified ? (
            <div style={successCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <ShieldCheck size={24} color="#0F8A4F" />
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#0F8A4F' }}>
                  검증 성공 - 유효한 보고서입니다
                </span>
              </div>
              <div style={detailGridStyle}>
                <DetailRow label="내보내기 유형" value={EXPORT_TYPE_LABELS[result.exportLog.exportType] || result.exportLog.exportType} />
                <DetailRow label="기간" value={`${result.exportLog.dateFrom} ~ ${result.exportLog.dateTo}`} />
                <DetailRow label="생성자" value={`${result.exportLog.exportedBy} (${result.exportLog.exportedByNumber})`} />
                <DetailRow label="생성일시" value={result.exportLog.createdAt} />
                <DetailRow label="검증코드" value={result.exportLog.verificationCode} mono />
                {result.exportLog.fileHash && (
                  <DetailRow label="파일 해시" value={result.exportLog.fileHash.substring(0, 32) + '...'} mono />
                )}
              </div>
            </div>
          ) : (
            <div style={failureCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <ShieldX size={24} color="#DC3545" />
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#DC3545' }}>
                  검증 실패 - 유효하지 않은 검증코드
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                입력한 검증코드와 일치하는 내보내기 이력이 없습니다.
                코드를 다시 확인하거나 보고서의 원본 여부를 점검해 주세요.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ label, value, mono }) => (
  <div style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid #E8F5E9' }}>
    <span style={{ width: '120px', fontSize: '13px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
      {label}
    </span>
    <span style={{
      fontSize: '13px',
      color: 'var(--color-text-primary)',
      fontFamily: mono ? 'monospace' : 'var(--font-family)',
      wordBreak: 'break-all',
    }}>
      {value}
    </span>
  </div>
);

const cardStyle = {
  background: 'var(--color-bg-card)',
  border: '0.5px solid var(--color-border)',
  borderRadius: '8px',
  padding: '20px 24px',
};

const successCardStyle = {
  background: '#F0FFF4',
  borderLeft: '3px solid #0F8A4F',
  borderRadius: '8px',
  padding: '20px 24px',
};

const failureCardStyle = {
  background: '#FFF5F5',
  borderLeft: '3px solid #DC3545',
  borderRadius: '8px',
  padding: '20px 24px',
};

const detailGridStyle = {
  display: 'flex',
  flexDirection: 'column',
};

export default ReportVerify;
