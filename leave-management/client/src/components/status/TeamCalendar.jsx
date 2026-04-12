import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../api/client';
import Calendar from '../common/Calendar';
import Badge from '../common/Badge';

const LEAVE_TYPE_COLORS = {
  ANNUAL: 'var(--color-primary)',
  SICK: '#DC3545',
  CONDOLENCE: '#6B7280',
  PUBLIC: '#0F8A4F',
  MATERNITY: '#8B5CF6',
  MENSTRUAL: '#EC4899',
  REWARD: '#F59E0B'
};

const TeamCalendar = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState({ events: [], holidays: [] });
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/calendar/team?year=${year}&month=${month}`);
        if (res.success) setData(res.data);
      } catch (e) { /* ignore */ }
      setLoading(false);
    };
    fetchCalendar();
  }, [year, month]);

  // 날짜별 이벤트 펼치기 (기간 → 개별 날짜)
  const calendarEvents = useMemo(() => {
    const events = [];
    (data.events || []).forEach(ev => {
      const start = new Date(ev.startDate);
      const end = new Date(ev.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue;
        const dateStr = d.toISOString().slice(0, 10);
        events.push({
          date: dateStr,
          type: (ev.leaveTypeCode || '').toLowerCase(),
          label: `${ev.employeeName} - ${ev.leaveType}`
        });
      }
    });
    return events;
  }, [data.events]);

  const holidayDates = useMemo(() =>
    (data.holidays || []).map(h => h.date),
    [data.holidays]
  );

  // 선택 날짜의 이벤트
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return (data.events || []).filter(ev =>
      ev.startDate <= selectedDate && ev.endDate >= selectedDate
    );
  }, [selectedDate, data.events]);

  const handleMonthChange = (y, m) => { setYear(y); setMonth(m); };

  return (
    <div>
      <div className="page-header">
        <h2>팀 캘린더</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
        {/* 캘린더 */}
        <div className="card" style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div className="loading-spinner" />
            </div>
          ) : (
            <Calendar
              year={year}
              month={month}
              events={calendarEvents}
              holidays={holidayDates}
              selectedDate={selectedDate}
              onDateClick={setSelectedDate}
              onMonthChange={handleMonthChange}
            />
          )}
          {/* 범례 */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px', padding: '12px', background: '#F9FAFB', borderRadius: '6px' }}>
            {Object.entries({ '연차': 'ANNUAL', '병가': 'SICK', '경조사': 'CONDOLENCE', '공가': 'PUBLIC', '출산': 'MATERNITY', '생리': 'MENSTRUAL', '포상': 'REWARD' }).map(([label, code]) => (
              <div key={code} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6B7280' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: LEAVE_TYPE_COLORS[code] }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* 사이드 패널 */}
        <div>
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
              {selectedDate ? `${selectedDate} 휴가 현황` : '날짜를 선택하세요'}
            </h3>
            {selectedEvents.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                {selectedDate ? '해당 날짜에 휴가가 없습니다.' : '캘린더에서 날짜를 클릭하면 상세 정보가 표시됩니다.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedEvents.map(ev => (
                  <div key={ev.id} style={{
                    padding: '10px 12px', borderRadius: '6px',
                    border: '0.5px solid #DDE1E7', background: '#FAFBFC'
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{ev.employeeName}</div>
                    <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
                      {ev.departmentName && <span>{ev.departmentName} · </span>}
                      <span style={{ color: LEAVE_TYPE_COLORS[ev.leaveTypeCode] || '#6B7280' }}>
                        {ev.leaveType}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                      {ev.startDate} ~ {ev.endDate} ({ev.totalDays}일)
                      {ev.halfDayType && <Badge variant="info" size="sm" style={{ marginLeft: '4px' }}>
                        {ev.halfDayType === 'AM' ? '오전' : ev.halfDayType === 'PM' ? '오후' : '시간'}
                      </Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 이번 달 공휴일 */}
          {data.holidays?.length > 0 && (
            <div className="card" style={{ padding: '16px', marginTop: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>공휴일</h3>
              {data.holidays.map(h => (
                <div key={h.date} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: '#DC3545' }}>
                  <span>{h.name}</span>
                  <span>{h.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamCalendar;
