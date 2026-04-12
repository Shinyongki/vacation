import React, { useState } from 'react';

const AbsenceToggle = ({ isAbsent = false, returnDate = '', onToggle }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(returnDate);

  const handleToggle = () => {
    if (!isAbsent) {
      setShowDatePicker(true);
    } else {
      onToggle && onToggle(false, null);
    }
  };

  const handleDateConfirm = () => {
    if (tempDate) {
      onToggle && onToggle(true, tempDate);
      setShowDatePicker(false);
    }
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
    setTempDate('');
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="toggle" onClick={handleToggle}>
        <div className={`toggle__track ${isAbsent ? 'toggle__track--active' : 'toggle__track--present'}`}>
          <div className="toggle__thumb" />
        </div>
        <span className="toggle__label" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {isAbsent ? '부재중' : '재석'}
        </span>
      </div>
      {isAbsent && returnDate && (
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
          복귀: {returnDate}
        </span>
      )}
      {showDatePicker && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '4px',
          background: 'var(--color-bg-card)',
          border: '0.5px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          padding: '12px',
          zIndex: 600,
          minWidth: '220px',
        }}>
          <div style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
            복귀 예정일
          </div>
          <input
            type="date"
            className="form-input"
            value={tempDate}
            onChange={(e) => setTempDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn--secondary btn--sm" onClick={handleDateCancel}>취소</button>
            <button className="btn btn--primary btn--sm" onClick={handleDateConfirm} disabled={!tempDate}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbsenceToggle;
