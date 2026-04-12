import React from 'react';

const ProgressBar = ({
  value = 0,
  color = 'var(--color-primary)',
  height = 8,
  label,
}) => {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div>
      {label && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
        }}>
          <span>{label}</span>
          <span>{clampedValue}%</span>
        </div>
      )}
      <div className="progress-bar" style={{ height: `${height}px` }}>
        <div
          className="progress-bar__fill"
          style={{
            width: `${clampedValue}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
