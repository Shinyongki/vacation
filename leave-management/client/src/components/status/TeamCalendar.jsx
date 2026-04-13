import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../common/Badge';

/* ── 유형별 태그 색상 ── */
const TAG_COLORS = {
  ANNUAL:    { bg: '#DBEAFE', color: '#1E40AF', label: '연차' },
  SICK:      { bg: '#FEE2E2', color: '#991B1B', label: '병가' },
  CONDOLENCE:{ bg: '#FFF7ED', color: '#C2410C', label: '경조사' },
  PUBLIC:    { bg: '#ECFDF5', color: '#047857', label: '공가' },
  MATERNITY: { bg: '#F3E8FF', color: '#6B21A8', label: '출산' },
  MENSTRUAL: { bg: '#FCE7F3', color: '#9D174D', label: '생리' },
  REWARD:    { bg: '#FEF3C7', color: '#92400E', label: '포상' },
};

const DAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토'];

/* ── 날짜 유틸 ── */
function pad(n) { return String(n).padStart(2, '0'); }
function toStr(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

function getCalendarCells(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevDays = new Date(year, month - 1, 0).getDate();
  const cells = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevDays - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    cells.push({ day: d, month: m, year: y, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, outside: false });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month === 12 ? 1 : month + 1;
      const y = month === 12 ? year + 1 : year;
      cells.push({ day: d, month: m, year: y, outside: true });
    }
  }
  return cells;
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
}

/* ── 공휴일 연휴 묶기 ── */
function groupHolidays(holidays) {
  if (!holidays || holidays.length === 0) return [];
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const groups = [];
  let current = { name: sorted[0].name, startDate: sorted[0].date, endDate: sorted[0].date, baseName: sorted[0].name.replace(/ (전날|다음날)$/, '') };

  for (let i = 1; i < sorted.length; i++) {
    const h = sorted[i];
    const base = h.name.replace(/ (전날|다음날)$/, '');
    const prevEnd = new Date(current.endDate + 'T00:00:00');
    const curDate = new Date(h.date + 'T00:00:00');
    const diffDays = (curDate - prevEnd) / 86400000;

    if (base === current.baseName && diffDays <= 1) {
      current.endDate = h.date;
      current.name = base + ' 연휴';
    } else {
      groups.push(current);
      current = { name: h.name, startDate: h.date, endDate: h.date, baseName: base };
    }
  }
  groups.push(current);
  return groups;
}

/* ── 메인 컴포넌트 ── */
const TeamCalendar = () => {
  const today = new Date();
  const todayStr = toStr(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState({ events: [], holidays: [] });
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr);

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

  /* 날짜별 이벤트 맵 (기간 → 개별 날짜 펼침) */
  const eventsByDate = useMemo(() => {
    const map = {};
    (data.events || []).forEach(ev => {
      const start = new Date(ev.startDate + 'T00:00:00');
      const end = new Date(ev.endDate + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue;
        const ds = toStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
        if (!map[ds]) map[ds] = [];
        map[ds].push(ev);
      }
    });
    return map;
  }, [data.events]);

  const holidaySet = useMemo(() => new Set((data.holidays || []).map(h => h.date)), [data.holidays]);

  /* 선택 날짜의 이벤트 */
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return (data.events || []).filter(ev => ev.startDate <= selectedDate && ev.endDate >= selectedDate);
  }, [selectedDate, data.events]);

  /* 이번 달 휴가 요약 */
  const monthlySummary = useMemo(() => {
    const summary = [];
    (data.events || []).forEach(ev => {
      summary.push({
        id: ev.id,
        name: ev.employeeName,
        type: ev.leaveType,
        typeCode: ev.leaveTypeCode,
        startDate: ev.startDate,
        endDate: ev.endDate,
        totalDays: ev.totalDays,
      });
    });
    return summary;
  }, [data.events]);

  /* 공휴일 그룹 */
  const holidayGroups = useMemo(() => groupHolidays(data.holidays), [data.holidays]);

  const cells = useMemo(() => getCalendarCells(year, month), [year, month]);

  const handlePrev = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const handleNext = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header__title">팀 캘린더</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        {/* ━━━ 좌측: 캘린더 ━━━ */}
        <div className="card" style={{ padding: '20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div className="loading-spinner" />
            </div>
          ) : (
            <>
              {/* 월 네비게이션 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <button onClick={handlePrev} style={navBtnStyle}><ChevronLeft size={18} /></button>
                <span style={{ fontSize: '18px', fontWeight: 500, color: '#1B3A5C' }}>{year}년 {month}월</span>
                <button onClick={handleNext} style={navBtnStyle}><ChevronRight size={18} /></button>
              </div>

              {/* 캘린더 테이블 */}
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {DAY_HEADERS.map((d, i) => (
                      <th key={d} style={{
                        fontSize: '14px', fontWeight: 500, textAlign: 'center', padding: '10px 0',
                        color: i === 0 ? '#DC2626' : i === 6 ? '#1B5E9E' : '#333',
                        borderBottom: '1px solid #EEF0F2',
                      }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) => (
                    <tr key={week}>
                      {cells.slice(week * 7, week * 7 + 7).map((cell, di) => {
                        const dateStr = toStr(cell.year, cell.month, cell.day);
                        const dow = di;
                        const isToday = dateStr === todayStr;
                        const isHoliday = holidaySet.has(dateStr);
                        const isSelected = dateStr === selectedDate;
                        const evts = eventsByDate[dateStr] || [];

                        let numColor = '#333';
                        if (cell.outside) numColor = '#C0C6CE';
                        else if (dow === 0 || isHoliday) numColor = '#DC2626';
                        else if (dow === 6) numColor = '#1B5E9E';

                        return (
                          <td
                            key={di}
                            onClick={() => setSelectedDate(dateStr)}
                            style={{
                              minHeight: '72px', height: '72px', verticalAlign: 'top',
                              padding: '4px', textAlign: 'center', cursor: 'pointer',
                              borderBottom: '1px solid #F3F5F7',
                              background: isSelected ? '#EFF6FF' : 'transparent',
                              transition: 'background 150ms ease',
                            }}
                          >
                            {/* 날짜 숫자 */}
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: isToday ? '34px' : 'auto', height: isToday ? '34px' : 'auto',
                              borderRadius: isToday ? '50%' : '0',
                              background: isToday ? '#1B5E9E' : 'transparent',
                              color: isToday ? '#fff' : numColor,
                              fontSize: '15px', fontWeight: isToday ? 500 : 400,
                              marginBottom: '2px',
                            }}>
                              {cell.day}
                            </div>

                            {/* 휴가 태그 */}
                            {!cell.outside && evts.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                {evts.slice(0, 2).map((ev, i) => {
                                  const tc = TAG_COLORS[ev.leaveTypeCode] || { bg: '#F3F5F7', color: '#5A6E82' };
                                  return (
                                    <div key={i} style={{
                                      fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                                      maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap', background: tc.bg, color: tc.color,
                                    }}>
                                      {ev.employeeName} {TAG_COLORS[ev.leaveTypeCode]?.label || ev.leaveType}
                                    </div>
                                  );
                                })}
                                {evts.length > 2 && (
                                  <div style={{ fontSize: '10px', color: '#8A95A3' }}>+{evts.length - 2}건 더보기</div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 범례 */}
              <div style={{
                borderTop: '1px solid #EEF0F2', marginTop: '12px', paddingTop: '14px',
                display: 'flex', gap: '16px', flexWrap: 'wrap',
              }}>
                {Object.entries(TAG_COLORS).map(([code, c]) => (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#5A6E82' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: c.bg, border: `1px solid ${c.color}33` }} />
                    {c.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ━━━ 우측: 3개 카드 ━━━ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 카드 1: 선택 날짜 휴가 현황 */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#1B3A5C', marginBottom: '12px' }}>
              {selectedDate ? `${formatDateLabel(selectedDate)} 휴가 현황` : '날짜를 선택하세요'}
            </h3>
            {selectedEvents.length === 0 ? (
              <p style={{ color: '#8A95A3', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
                해당 날짜에 휴가가 없습니다.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedEvents.map(ev => {
                  const tc = TAG_COLORS[ev.leaveTypeCode] || { bg: '#F3F5F7', color: '#5A6E82' };
                  return (
                    <div key={ev.id} style={{
                      padding: '10px 12px', borderRadius: '6px',
                      border: '1px solid #EEF0F2', background: '#FAFBFC',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 500, fontSize: '14px', color: '#333' }}>{ev.employeeName}</span>
                        <span style={{
                          fontSize: '12px', padding: '2px 8px', borderRadius: '999px',
                          background: tc.bg, color: tc.color, fontWeight: 500,
                        }}>{ev.leaveType}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#8A95A3', marginTop: '4px' }}>
                        {ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} ~ ${ev.endDate}`} ({ev.totalDays}일)
                        {ev.halfDayType && (
                          <Badge variant="info" size="sm" style={{ marginLeft: '4px' }}>
                            {ev.halfDayType === 'AM' ? '오전' : ev.halfDayType === 'PM' ? '오후' : '시간'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 카드 2: 이번 달 휴가 요약 */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#1B3A5C', margin: 0 }}>이번 달 휴가 요약</h3>
              <span style={{ fontSize: '13px', color: '#8A95A3' }}>총 {monthlySummary.length}건</span>
            </div>
            {monthlySummary.length === 0 ? (
              <p style={{ color: '#8A95A3', fontSize: '14px', textAlign: 'center', padding: '12px 0' }}>
                이번 달 휴가가 없습니다.
              </p>
            ) : (
              <div>
                {monthlySummary.map((item, idx) => (
                  <div key={item.id || idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: idx < monthlySummary.length - 1 ? '1px solid #EEF0F2' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>{item.name}</div>
                      <div style={{ fontSize: '13px', color: '#8A95A3', marginTop: '1px' }}>
                        {item.type} · {item.startDate === item.endDate ? item.startDate.slice(5) : `${item.startDate.slice(5)} ~ ${item.endDate.slice(5)}`}
                      </div>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#1B5E9E' }}>{item.totalDays}일</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 카드 3: 공휴일 목록 */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#1B3A5C', margin: 0 }}>공휴일</h3>
              <span style={{ fontSize: '13px', color: '#8A95A3' }}>{year}년</span>
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {holidayGroups.length === 0 ? (
                <p style={{ color: '#8A95A3', fontSize: '13px', textAlign: 'center', padding: '8px 0' }}>
                  공휴일 정보가 없습니다.
                </p>
              ) : (
                holidayGroups.map((g, idx) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 0',
                    borderBottom: idx < holidayGroups.length - 1 ? '1px solid #EEF0F2' : 'none',
                  }}>
                    <span style={{ fontSize: '13px', color: '#DC2626' }}>{g.name}</span>
                    <span style={{ fontSize: '13px', color: '#8A95A3' }}>
                      {g.startDate === g.endDate
                        ? g.startDate.slice(5).replace('-', '.')
                        : `${g.startDate.slice(5).replace('-', '.')}~${g.endDate.slice(8).replace('-', '.')}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── 네비게이션 버튼 스타일 ── */
const navBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '36px', height: '36px',
  border: '1px solid #DDE1E7', borderRadius: '6px',
  background: '#fff', cursor: 'pointer', color: '#5A6E82',
};

export default TeamCalendar;
