import React, { useState, useEffect, useCallback } from 'react';
import { Save } from 'lucide-react';
import apiClient from '../../api/client';

const SETTING_META = {
  approval_line_structure: {
    label: '결재 라인 구조',
    desc: '휴가 신청 시 거치는 결재 단계를 설정합니다.',
    placeholder: '예: 기안→검토→결재',
  },
  retroactive_reasons: {
    label: '사후 신청 허용 사유',
    desc: '과거 날짜로 휴가를 신청할 때 선택할 수 있는 사유 목록입니다.',
    placeholder: '예: ["긴급 업무","출장 중","시스템 장애"]',
  },
  half_day_am_time: {
    label: '오전 반차 시간',
    desc: '오전 반차 사용 시 적용되는 근무 시간 범위입니다.',
    placeholder: '예: 09:00-14:00',
  },
  half_day_pm_time: {
    label: '오후 반차 시간',
    desc: '오후 반차 사용 시 적용되는 근무 시간 범위입니다.',
    placeholder: '예: 14:00-18:00',
  },
  concurrent_leave_limit: {
    label: '동시 휴가 인원 제한',
    desc: '같은 날 휴가를 사용할 수 있는 최대 인원입니다. 0이면 제한 없음.',
    placeholder: '0 = 제한 없음',
  },
  auto_annual_calc: {
    label: '연차 자동 계산',
    desc: '입사일 기준으로 연차를 자동 계산할지 여부입니다.',
    type: 'select',
    options: [
      { value: 'true', label: '사용' },
      { value: 'false', label: '사용 안 함' },
    ],
  },
  team_lead_view_scope: {
    label: '팀장 열람 범위',
    desc: '팀장이 볼 수 있는 휴가 정보의 범위를 설정합니다.',
    type: 'select',
    options: [
      { value: 'own_team', label: '소속 팀만' },
      { value: 'all', label: '전체' },
    ],
  },
  delegate_urgent_hours: {
    label: '긴급 대결 전환 시간',
    desc: '긴급 건에서 대결자에게 넘어가기까지의 시간(시간 단위)입니다. 0이면 즉시 전환.',
    placeholder: '0 = 즉시 전환',
  },
  delegate_short_hours: {
    label: '단기 부재 대결 전환 시간',
    desc: '단기 부재 시 대결자에게 넘어가기까지의 대기 시간(시간 단위)입니다.',
    placeholder: '시간 단위 (예: 8)',
  },
  delegate_normal_hours: {
    label: '일반 부재 대결 전환 시간',
    desc: '일반 부재 시 대결자에게 넘어가기까지의 대기 시간(시간 단위)입니다.',
    placeholder: '시간 단위 (예: 24)',
  },
  work_start_time: {
    label: '근무 시작 시간',
    desc: '일일 근무 시작 시간입니다.',
    placeholder: '예: 09:00',
  },
  work_end_time: {
    label: '근무 종료 시간',
    desc: '일일 근무 종료 시간입니다.',
    placeholder: '예: 18:00',
  },
};

const getSettingMeta = (key) => SETTING_META[key] || { label: key, desc: '', placeholder: '' };

const SystemSettings = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/settings');
      if (res.success) {
        setSettings(res.data);
        const vals = {};
        res.data.forEach(s => { vals[s.key] = s.value; });
        setEditedValues(vals);
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsArr = Object.entries(editedValues).map(([key, value]) => ({ key, value }));
      const res = await apiClient.put('/admin/settings', { settings: settingsArr });
      if (res.success) {
        setSettings(res.data);
        alert('설정이 저장되었습니다.');
      }
    } catch (err) {
      alert(err.error || '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">시스템 설정</h2>
        <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {settings.map(s => {
          const meta = getSettingMeta(s.key);
          return (
            <div key={s.key} style={{
              padding: '12px 16px',
              background: 'var(--color-bg-table-header)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ marginBottom: '2px', fontSize: 'var(--font-size-base)' }}>
                  {meta.label}
                </label>
                {meta.desc && (
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {meta.desc}
                  </div>
                )}
              </div>
              {meta.type === 'select' ? (
                <select
                  className="form-select"
                  value={editedValues[s.key] || ''}
                  onChange={e => setEditedValues(p => ({ ...p, [s.key]: e.target.value }))}
                >
                  {meta.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : s.value && s.value.startsWith('[') ? (
                <textarea
                  className="form-input form-textarea"
                  value={editedValues[s.key] || ''}
                  onChange={e => setEditedValues(p => ({ ...p, [s.key]: e.target.value }))}
                  placeholder={meta.placeholder}
                  style={{ minHeight: '60px', fontSize: 'var(--font-size-sm)' }}
                />
              ) : (
                <input
                  className="form-input"
                  value={editedValues[s.key] || ''}
                  onChange={e => setEditedValues(p => ({ ...p, [s.key]: e.target.value }))}
                  placeholder={meta.placeholder}
                />
              )}
            </div>
          );
        })}

        {settings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
            등록된 설정이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemSettings;
