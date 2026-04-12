import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

const generateTimeOptions = (min = '09:00', max = '18:00', step = 30) => {
  const options = [];
  const [minH, minM] = min.split(':').map(Number);
  const [maxH, maxM] = max.split(':').map(Number);
  const startMinutes = minH * 60 + minM;
  const endMinutes = maxH * 60 + maxM;

  for (let m = startMinutes; m <= endMinutes; m += step) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    options.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return options;
};

const TimePicker = ({
  value = '',
  onChange,
  min = '09:00',
  max = '18:00',
  step = 30,
  disabled = false,
  placeholder = 'HH:mm',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const options = generateTimeOptions(min, max, step);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (time) => {
    onChange && onChange(time);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          readOnly
          onFocus={() => !disabled && setOpen(true)}
        />
        <button
          type="button"
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onClick={() => !disabled && setOpen(!open)}
          tabIndex={-1}
        >
          <Clock size={16} />
        </button>
      </div>
      {open && (
        <div className="time-picker__options">
          {options.map((time) => (
            <div
              key={time}
              className={`time-picker__option ${time === value ? 'time-picker__option--selected' : ''}`}
              onClick={() => handleSelect(time)}
            >
              {time}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimePicker;
