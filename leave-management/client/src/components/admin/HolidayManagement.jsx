import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../common/Badge';

const HolidayManagement = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/admin/holidays?year=${year}`);
      if (res.success) setHolidays(res.data);
    } catch (err) {
      console.error('Failed to fetch holidays', err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  const handleAddCustomHoliday = () => {
    if (!newHoliday.date || !newHoliday.name) {
      alert('날짜와 명칭을 모두 입력해 주세요.');
      return;
    }

    // Check duplicate
    if (holidays.some(h => h.date === newHoliday.date)) {
      alert('이미 등록된 날짜입니다.');
      return;
    }

    setHolidays(prev => [...prev, {
      id: `new-${Date.now()}`,
      date: newHoliday.date,
      name: newHoliday.name,
      is_custom: 1,
      year: year,
    }].sort((a, b) => a.date.localeCompare(b.date)));

    setNewHoliday({ date: '', name: '' });
    setShowAddForm(false);
  };

  const handleRemoveCustomHoliday = (holidayDate) => {
    setHolidays(prev => prev.filter(h => !(h.date === holidayDate && h.is_custom)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const customHolidays = holidays.filter(h => h.is_custom);
      const res = await apiClient.post('/admin/holidays', {
        year,
        holidays: customHolidays.map(h => ({ date: h.date, name: h.name, is_custom: 1 })),
      });
      if (res.success) {
        setHolidays(res.data);
        alert('저장되었습니다.');
      }
    } catch (err) {
      alert(err.error || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getDayOfWeek = (dateStr) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  return (
    <div>
      <div className="card">
        <div className="card__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="card__title">휴일 관리</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setYear(y => y - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', minWidth: '50px', textAlign: 'center' }}>
                {year}
              </span>
              <button className="btn btn--ghost btn--sm" onClick={() => setYear(y => y + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn--secondary btn--sm" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus size={14} /> 자체 휴일 추가
            </button>
            <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {showAddForm && (
          <div style={{
            display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '16px',
            padding: '12px', background: 'var(--color-bg-table-header)', borderRadius: 'var(--radius-md)',
          }}>
            <div>
              <label className="form-label">날짜</label>
              <input className="form-input" type="date" value={newHoliday.date}
                onChange={e => setNewHoliday(p => ({ ...p, date: e.target.value }))}
                style={{ width: '160px' }} />
            </div>
            <div>
              <label className="form-label">명칭</label>
              <input className="form-input" value={newHoliday.name} placeholder="휴일 명칭"
                onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))}
                style={{ width: '200px' }} />
            </div>
            <button className="btn btn--primary btn--sm" onClick={handleAddCustomHoliday}>추가</button>
            <button className="btn btn--secondary btn--sm" onClick={() => setShowAddForm(false)}>취소</button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="loading-spinner" />
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>날짜</th>
                  <th style={{ width: '60px' }}>요일</th>
                  <th>명칭</th>
                  <th style={{ width: '80px' }}>구분</th>
                  <th style={{ width: '80px' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h, idx) => {
                  const dayName = getDayOfWeek(h.date);
                  const isWeekend = dayName === '토' || dayName === '일';
                  return (
                    <tr key={h.id || idx}>
                      <td>{h.date}</td>
                      <td style={{ color: isWeekend ? 'var(--color-danger)' : undefined }}>{dayName}</td>
                      <td>{h.name}</td>
                      <td>
                        <Badge variant={h.is_custom ? 'warning' : 'neutral'} size="sm">
                          {h.is_custom ? '자체 휴일' : '법정 공휴일'}
                        </Badge>
                      </td>
                      <td>
                        {h.is_custom ? (
                          <button className="btn btn--ghost btn--sm" onClick={() => handleRemoveCustomHoliday(h.date)}>
                            <Trash2 size={14} style={{ color: 'var(--color-danger)' }} />
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {holidays.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                      {year}년 등록된 공휴일이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HolidayManagement;
