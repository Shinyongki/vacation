import React, { useState } from 'react';
import ReportVerify from './ReportVerify';
import ExportHistory from './ExportHistory';
import AdjustmentHistory from './AdjustmentHistory';

const tabs = [
  { key: 'verify', label: '보고서 검증' },
  { key: 'exports', label: '내보내기 이력' },
  { key: 'adjustments', label: '조정 이력' },
];

const VerificationView = () => {
  const [activeTab, setActiveTab] = useState('verify');

  return (
    <div style={{ padding: '20px 24px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>데이터 검증</h2>

      <div style={{ borderBottom: '1px solid var(--color-border)', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === tab.key
                ? '2px solid var(--color-primary)'
                : '2px solid transparent',
              background: 'none',
              color: activeTab === tab.key
                ? 'var(--color-primary)'
                : 'var(--color-text-secondary)',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px',
              fontFamily: 'var(--font-family)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'verify' && <ReportVerify />}
      {activeTab === 'exports' && <ExportHistory />}
      {activeTab === 'adjustments' && <AdjustmentHistory />}
    </div>
  );
};

export default VerificationView;
