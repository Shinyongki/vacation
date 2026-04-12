import React, { useState, useEffect, useCallback } from 'react';
import { Save } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../common/Modal';

const DelegateManagement = () => {
  const [delegateData, setDelegateData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [form, setForm] = useState({ delegate1: '', delegate2: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [delegatesRes, empsRes] = await Promise.all([
        apiClient.get('/admin/delegates'),
        apiClient.get('/admin/employees?status=active'),
      ]);
      if (delegatesRes.success) setDelegateData(delegatesRes.data);
      if (empsRes.success) setEmployees(empsRes.data);
    } catch (err) {
      console.error('Failed to fetch delegate data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEditModal = (emp) => {
    setSelectedEmployee(emp);
    const existing = delegateData.find(d => d.employee_id === emp.id);
    const d1 = existing?.delegates?.find(d => d.priority === 1);
    const d2 = existing?.delegates?.find(d => d.priority === 2);
    setForm({
      delegate1: d1?.delegate_id || '',
      delegate2: d2?.delegate_id || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const delegates = [];
    if (form.delegate1) delegates.push({ delegate_id: Number(form.delegate1), priority: 1 });
    if (form.delegate2) delegates.push({ delegate_id: Number(form.delegate2), priority: 2 });

    setSaving(true);
    try {
      const res = await apiClient.put(`/admin/delegates/${selectedEmployee.id}`, { delegates });
      if (res.success) {
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err.error || '대결자 설정에 실패했습니다.');
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

  // Build a map of employee_id -> delegate info
  const delegateMap = {};
  delegateData.forEach(d => { delegateMap[d.employee_id] = d; });

  return (
    <div>
      <div className="card">
        <div className="card__header">
          <h2 className="card__title">대결자 관리</h2>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>사번</th>
                <th>이름</th>
                <th>부서</th>
                <th>직위</th>
                <th>1순위 대결자</th>
                <th>2순위 대결자</th>
                <th style={{ width: '80px' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const info = delegateMap[emp.id];
                const d1 = info?.delegates?.find(d => d.priority === 1);
                const d2 = info?.delegates?.find(d => d.priority === 2);

                return (
                  <tr key={emp.id}>
                    <td>{emp.employee_number}</td>
                    <td>{emp.name}</td>
                    <td>{emp.department_name}</td>
                    <td>{emp.position}</td>
                    <td>
                      {d1 ? (
                        <span>{d1.delegate_name} ({d1.delegate_position})</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>미지정</span>
                      )}
                    </td>
                    <td>
                      {d2 ? (
                        <span>{d2.delegate_name} ({d2.delegate_position})</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>미지정</span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn--ghost btn--sm" onClick={() => openEditModal(emp)}>
                        설정
                      </button>
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    재직 중인 직원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`대결자 설정 - ${selectedEmployee?.name || ''}`}
        size="md"
        footer={
          <>
            <button className="btn btn--secondary" onClick={() => setShowModal(false)}>취소</button>
            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">1순위 대결자</label>
          <select className="form-input form-select" value={form.delegate1}
            onChange={e => setForm(p => ({ ...p, delegate1: e.target.value }))}>
            <option value="">선택 안 함</option>
            {employees
              .filter(e => e.id !== selectedEmployee?.id && String(e.id) !== String(form.delegate2))
              .map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.position} / {e.department_name})
                </option>
              ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">2순위 대결자</label>
          <select className="form-input form-select" value={form.delegate2}
            onChange={e => setForm(p => ({ ...p, delegate2: e.target.value }))}>
            <option value="">선택 안 함</option>
            {employees
              .filter(e => e.id !== selectedEmployee?.id && String(e.id) !== String(form.delegate1))
              .map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.position} / {e.department_name})
                </option>
              ))}
          </select>
        </div>
        <div style={{
          padding: '10px 12px', background: 'var(--color-info-light)',
          borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-info)'
        }}>
          부재 시 1순위 대결자가 결재를 대행합니다. 1순위가 부재인 경우 2순위가 대행합니다.
        </div>
      </Modal>
    </div>
  );
};

export default DelegateManagement;
