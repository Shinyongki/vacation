import React, { useState, useEffect, useCallback } from 'react';
import { Save } from 'lucide-react';
import apiClient from '../../api/client';

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
        {settings.map(s => (
          <div key={s.key} style={{
            padding: '12px 16px',
            background: 'var(--color-bg-table-header)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '2px' }}>{s.key}</label>
                {s.description && (
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    {s.description}
                  </div>
                )}
              </div>
            </div>
            {s.value && s.value.startsWith('[') ? (
              <textarea
                className="form-input form-textarea"
                value={editedValues[s.key] || ''}
                onChange={e => setEditedValues(p => ({ ...p, [s.key]: e.target.value }))}
                style={{ minHeight: '60px', fontSize: 'var(--font-size-sm)' }}
              />
            ) : (
              <input
                className="form-input"
                value={editedValues[s.key] || ''}
                onChange={e => setEditedValues(p => ({ ...p, [s.key]: e.target.value }))}
              />
            )}
          </div>
        ))}

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
