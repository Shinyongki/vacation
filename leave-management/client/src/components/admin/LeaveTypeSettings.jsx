import React, { useState, useEffect, useCallback } from 'react';
import { Save, ChevronDown, ChevronRight } from 'lucide-react';
import apiClient from '../../api/client';

const LeaveTypeSettings = () => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [mappings, setMappings] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedCondolence, setExpandedCondolence] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [editingSubtype, setEditingSubtype] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [typesRes, mappingsRes] = await Promise.all([
        apiClient.get('/admin/leave-types'),
        apiClient.get('/admin/employment-type-mappings'),
      ]);
      if (typesRes.success) setLeaveTypes(typesRes.data);
      if (mappingsRes.success) setMappings(mappingsRes.data);
    } catch (err) {
      console.error('Failed to fetch leave type data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdateLeaveType = async (id, updates) => {
    try {
      const res = await apiClient.put(`/admin/leave-types/${id}`, updates);
      if (res.success) {
        setLeaveTypes(prev => prev.map(lt => lt.id === id ? { ...lt, ...res.data } : lt));
        setEditingType(null);
      }
    } catch (err) {
      alert(err.error || '휴가 유형 수정에 실패했습니다.');
    }
  };

  const handleUpdateSubtype = async (id, updates) => {
    try {
      const res = await apiClient.put(`/admin/condolence-subtypes/${id}`, updates);
      if (res.success) {
        setLeaveTypes(prev => prev.map(lt => ({
          ...lt,
          condolence_subtypes: lt.condolence_subtypes.map(cs =>
            cs.id === id ? { ...cs, ...res.data } : cs
          )
        })));
        setEditingSubtype(null);
      }
    } catch (err) {
      alert(err.error || '경조사 유형 수정에 실패했습니다.');
    }
  };

  const handleSaveMappings = async () => {
    setSaving(true);
    try {
      const allMappings = [];
      Object.entries(mappings).forEach(([empType, items]) => {
        items.forEach(m => {
          allMappings.push({
            employment_type: empType,
            leave_type_id: m.leave_type_id,
            is_allowed: m.is_allowed,
          });
        });
      });
      const res = await apiClient.put('/admin/employment-type-mappings', { mappings: allMappings });
      if (res.success) alert('저장되었습니다.');
    } catch (err) {
      alert(err.error || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const toggleMapping = (empType, leaveTypeId) => {
    setMappings(prev => {
      const updated = { ...prev };
      if (updated[empType]) {
        updated[empType] = updated[empType].map(m =>
          m.leave_type_id === leaveTypeId ? { ...m, is_allowed: m.is_allowed ? 0 : 1 } : m
        );
      }
      return updated;
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  const condolenceType = leaveTypes.find(lt => lt.code === 'CONDOLENCE');

  return (
    <div>
      {/* Leave Types Table */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card__header">
          <h2 className="card__title">휴가 유형 설정</h2>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>유형명</th>
                <th>코드</th>
                <th style={{ width: '100px' }}>기본일수</th>
                <th style={{ width: '100px' }}>첨부 필수</th>
                <th style={{ width: '100px' }}>사후신청</th>
                <th style={{ width: '100px' }}>성별 제한</th>
                <th style={{ width: '80px' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {leaveTypes.map(lt => (
                <React.Fragment key={lt.id}>
                  <tr>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {lt.code === 'CONDOLENCE' && (
                          <button
                            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            onClick={() => setExpandedCondolence(!expandedCondolence)}
                          >
                            {expandedCondolence ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        )}
                        {lt.name}
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{lt.code}</td>
                    <td>
                      {editingType === lt.id ? (
                        <input
                          className="form-input"
                          type="number"
                          defaultValue={lt.default_days || ''}
                          style={{ width: '70px', height: '28px', fontSize: 'var(--font-size-sm)' }}
                          onBlur={e => handleUpdateLeaveType(lt.id, { default_days: e.target.value ? Number(e.target.value) : null })}
                          autoFocus
                        />
                      ) : (
                        <span>{lt.default_days ?? '-'}</span>
                      )}
                    </td>
                    <td>{lt.requires_attachment ? 'Y' : 'N'}</td>
                    <td>{lt.allows_retroactive ? 'Y' : 'N'}</td>
                    <td>{lt.gender_restriction === 'F' ? '여성만' : '-'}</td>
                    <td>
                      <button className="btn btn--ghost btn--sm" onClick={() => setEditingType(lt.id)}>
                        수정
                      </button>
                    </td>
                  </tr>
                  {/* Condolence subtypes */}
                  {lt.code === 'CONDOLENCE' && expandedCondolence && lt.condolence_subtypes?.map(cs => (
                    <tr key={`sub-${cs.id}`} style={{ background: 'var(--color-bg-table-header)' }}>
                      <td style={{ paddingLeft: '40px' }}>{cs.name}</td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>-</td>
                      <td>
                        {editingSubtype === cs.id ? (
                          <input
                            className="form-input"
                            type="number"
                            defaultValue={cs.days}
                            style={{ width: '70px', height: '28px', fontSize: 'var(--font-size-sm)' }}
                            onBlur={e => handleUpdateSubtype(cs.id, { days: Number(e.target.value) })}
                            autoFocus
                          />
                        ) : (
                          <span>{cs.days}일</span>
                        )}
                      </td>
                      <td colSpan={2}>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          {cs.description || '-'}
                        </span>
                      </td>
                      <td></td>
                      <td>
                        <button className="btn btn--ghost btn--sm" onClick={() => setEditingSubtype(cs.id)}>
                          수정
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employment Type Mapping */}
      <div className="card">
        <div className="card__header">
          <h2 className="card__title">고용형태별 휴가 허용 설정</h2>
          <button className="btn btn--primary btn--sm" onClick={handleSaveMappings} disabled={saving}>
            <Save size={14} /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>고용형태</th>
                {leaveTypes.map(lt => (
                  <th key={lt.id} style={{ textAlign: 'center' }}>{lt.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(mappings).map(([empType, items]) => (
                <tr key={empType}>
                  <td style={{ fontWeight: 'var(--font-weight-medium)' }}>
                    {empType === 'regular' ? '정규직' : '계약직'}
                  </td>
                  {leaveTypes.map(lt => {
                    const mapping = items.find(m => m.leave_type_id === lt.id);
                    return (
                      <td key={lt.id} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={mapping?.is_allowed === 1}
                          onChange={() => toggleMapping(empType, lt.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaveTypeSettings;
