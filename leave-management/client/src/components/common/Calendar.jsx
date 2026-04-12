import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토'];

const Calendar = ({
  year,
  month,
  events = [],
  onDateClick,
  onMonthChange,
  holidays = [],
  selectedDate,
}) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    const result = [];

    // Previous month fill
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month - 1 < 1 ? 12 : month - 1;
      const y = month - 1 < 1 ? year - 1 : year;
      result.push({ day: d, month: m, year: y, outside: true });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, month, year, outside: false });
    }

    // Next month fill
    const remaining = 7 - (result.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const m = month + 1 > 12 ? 1 : month + 1;
        const y = month + 1 > 12 ? year + 1 : year;
        result.push({ day: d, month: m, year: y, outside: true });
      }
    }

    return result;
  }, [year, month]);

  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  const eventMap = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [events]);

  const handlePrev = () => {
    const newMonth = month === 1 ? 12 : month - 1;
    const newYear = month === 1 ? year - 1 : year;
    onMonthChange && onMonthChange(newYear, newMonth);
  };

  const handleNext = () => {
    const newMonth = month === 12 ? 1 : month + 1;
    const newYear = month === 12 ? year + 1 : year;
    onMonthChange && onMonthChange(newYear, newMonth);
  };

  const getDateStr = (cell) => {
    return `${cell.year}-${String(cell.month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
  };

  const EVENT_COLORS = {
    annual: 'var(--color-primary)',
    sick: 'var(--color-danger)',
    special: 'var(--color-success)',
    default: 'var(--color-warning)',
  };

  return (
    <div className="calendar">
      <div className="calendar__header">
        <button className="calendar__nav-btn" onClick={handlePrev}>
          <ChevronLeft size={18} />
        </button>
        <span className="calendar__title">{year}년 {month}월</span>
        <button className="calendar__nav-btn" onClick={handleNext}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar__grid">
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={`calendar__day-header ${i === 0 ? 'calendar__day-header--sun' : ''} ${i === 6 ? 'calendar__day-header--sat' : ''}`}
          >
            {d}
          </div>
        ))}
        {cells.map((cell, idx) => {
          const dateStr = getDateStr(cell);
          const dow = idx % 7;
          const isToday = dateStr === todayStr;
          const isHoliday = holidaySet.has(dateStr);
          const isSelected = dateStr === selectedDate;
          const cellEvents = eventMap[dateStr] || [];

          const classNames = [
            'calendar__cell',
            cell.outside && 'calendar__cell--outside',
            isToday && 'calendar__cell--today',
            isSelected && 'calendar__cell--selected',
            dow === 0 && !cell.outside && 'calendar__cell--sunday',
            (dow === 0 || dow === 6) && !cell.outside && 'calendar__cell--weekend',
            isHoliday && !cell.outside && 'calendar__cell--holiday',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={idx}
              className={classNames}
              onClick={() => onDateClick && onDateClick(dateStr)}
            >
              {cell.day}
              {cellEvents.length > 0 && (
                <div className="calendar__events">
                  {cellEvents.slice(0, 3).map((ev, i) => (
                    <div
                      key={i}
                      className="calendar__event-dot"
                      style={{ background: EVENT_COLORS[ev.type] || EVENT_COLORS.default }}
                      title={ev.label}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
