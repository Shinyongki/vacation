import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import Calendar from './Calendar';

const DatePicker = ({
  value = '',
  onChange,
  min,
  max,
  placeholder = 'YYYY-MM-DD',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const today = new Date();
  const parsed = value ? new Date(value) : today;
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth() + 1);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDateClick = (dateStr) => {
    if (min && dateStr < min) return;
    if (max && dateStr > max) return;
    onChange && onChange(dateStr);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange && onChange(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth() + 1);
      }
    }
  };

  return (
    <div className="date-picker" ref={ref}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => !disabled && setOpen(true)}
          readOnly
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
          <CalendarIcon size={16} />
        </button>
      </div>
      {open && (
        <div className="date-picker__dropdown">
          <Calendar
            year={viewYear}
            month={viewMonth}
            selectedDate={value}
            onDateClick={handleDateClick}
            onMonthChange={(y, m) => {
              setViewYear(y);
              setViewMonth(m);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DatePicker;
