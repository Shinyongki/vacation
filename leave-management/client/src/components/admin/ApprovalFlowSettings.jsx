import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ArrowRight, Save } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../common/Modal';
import Badge from '../common/Badge';

const STEP_TYPE_LABELS = {
  draft: '기안',
  cooperation: '협조',
  review: '검토',
  approval: '결재',
};

const ASSIGNEE_TYPE_LABELS = {
  self: '본인',
  role: '직위',
  department: '부서',
  person: '지정인',
};

const ApprovalFlowSettings = () => {
  const [flows, setFlows] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    steps: [{ step_order: 1, step_type: 'draft', assignee_type: 'self', assignee_position: '', assignee_department_id: '', assignee_employee_id: '' }],
    leave_type_ids: [],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [flowsRes, typesRes, deptsRes, empsRes] = await Promise.all([
        apiClient.get('/admin/approval-flows'),
        apiClient.get('/admin/leave-types'),
        apiClient.get('/admin/departments'),
        apiClient.get('/admin/employees?status=active'),
      ]);
      if (flowsRes.success) setFlows(flowsRes.data);
      if (typesRes.success) setLeaveTypes(typesRes.data);
      if (deptsRes.success) setDepartments(deptsRes.data);
      if (empsRes.success) setEmployees(empsRes.data);
    } catch (err) {
      console.error('Failed to fetch approval flow data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreateModal = () => {
    setEditingFlow(null);
    setForm({
      name: '',
      description: '',
      steps: [{ step_order: 1, step_type: 'draft', assignee_type: 'self', assignee_position: '', assignee_department_id: '', assignee_employee_id: '' }],
      leave_type_ids: [],
    });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (flow) => {
    setEditingFlow(flow);
    setForm({
      name: flow.name,
      description: flow.description || '',
      steps: flow.steps.map(s => ({
        step_order: s.step_order,
        step_type: s.step_type,
        assignee_type: s.assignee_type,
        assignee_position: s.assignee_position || '',
        assignee_department_id: s.assignee_department_id || '',
        assignee_employee_id: s.assignee_employee_id || '',
      })),
      leave_type_ids: flow.leave_type_mappings.map(m => m.leave_type_id),
    });
    setError('');
    setShowModal(true);
  };

  const addStep = () => {
    setForm(prev => ({
      ...prev,
      steps: [...prev.steps, {
        step_order: prev.steps.length + 1,
        step_type: 'approval',
        assignee_type: 'role',
        assignee_position: '',
        assignee_department_id: '',
        assignee_employee_id: '',
      }],
    }));
  };

  const removeStep = (index) => {
    if (form.steps.length <= 1) return;
    setForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 })),
    }));
  };

  const updateStep = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  };

  const toggleLeaveType = (ltId) => {
    setForm(prev => ({
      ...prev,
      leave_type_ids: prev.leave_type_ids.includes(ltId)
        ? prev.leave_type_ids.filter(id => id !== ltId)
        : [...prev.leave_type_ids, ltId],
    }));
  };

  const handleSave = async () => {
    setError('');
    if (!form.name) {
      setError('결재 라인 이름을 입력해 주세요.');
      return;
    }
    if (form.steps.length === 0) {
      setError('결재 단계를 1개 이상 추가해 주세요.');
      return;
    }

    setSaving(true);
    try {
      let res;
      if (editingFlow) {
        res = await apiClient.put(`/admin/approval-flows/${editingFlow.id}`, form);
      } else {
        res = await apiClient.post('/admin/approval-flows', form);
      }
      if (res.success) {
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      setError(err.error || '저장에 실패했습니다.');
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>결재 라인 목록</h2>
        <button className="btn btn--primary btn--sm" onClick={openCreateModal}>
          <Plus size={14} /> 결재 라인 추가
        </button>
      </div>

      {flows.map(flow => (
        <div key={flow.id} className="card" style={{ marginBottom: '12px', cursor: 'pointer' }} onClick={() => openEditModal(flow)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: '4px' }}>{flow.name}</div>
              {flow.description && (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  {flow.description}
                </div>
              )}
              {/* Steps visualization */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                {flow.steps.map((step, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ArrowRight size={14} style={{ color: 'var(--color-text-muted)' }} />}
                    <Badge variant={step.step_type === 'approval' ? 'primary' : step.step_type === 'review' ? 'info' : 'neutral'} size="sm">
                      {STEP_TYPE_LABELS[step.step_type]}
                      {step.assignee_position ? `(${step.assignee_position})` : ''}
                      {step.assignee_type === 'self' ? '(본인)' : ''}
                      {step.employee_name ? `(${step.employee_name})` : ''}
                    </Badge>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {flow.leave_type_mappings.map(m => (
                <Badge key={m.leave_type_id} variant="neutral" size="sm">{m.leave_type_name}</Badge>
              ))}
            </div>
          </div>
        </div>
      ))}

      {flows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          등록된 결재 라인이 없습니다.
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingFlow ? '결재 라인 수정' : '결재 라인 추가'}
        size="lg"
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
          <label className="form-label form-label--required">이름</label>
          <input className="form-input" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">설명</label>
          <input className="form-input" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>

        {/* Steps */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>결재 단계</label>
            <button className="btn btn--ghost btn--sm" onClick={addStep}>
              <Plus size={14} /> 단계 추가
            </button>
          </div>

          {form.steps.map((step, idx) => (
            <div key={idx} style={{
              display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px',
              padding: '8px', background: 'var(--color-bg-table-header)', borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', minWidth: '24px' }}>
                {step.step_order}
              </span>
              <select className="form-input form-select" value={step.step_type}
                onChange={e => updateStep(idx, 'step_type', e.target.value)}
                style={{ width: '100px', height: '28px', fontSize: 'var(--font-size-sm)' }}>
                <option value="draft">기안</option>
                <option value="cooperation">협조</option>
                <option value="review">검토</option>
                <option value="approval">결재</option>
              </select>
              <select className="form-input form-select" value={step.assignee_type}
                onChange={e => updateStep(idx, 'assignee_type', e.target.value)}
                style={{ width: '100px', height: '28px', fontSize: 'var(--font-size-sm)' }}>
                <option value="self">본인</option>
                <option value="role">직위</option>
                <option value="department">부서</option>
                <option value="person">지정인</option>
              </select>
              {step.assignee_type === 'role' && (
                <input className="form-input" placeholder="직위 (예: 팀장)"
                  value={step.assignee_position}
                  onChange={e => updateStep(idx, 'assignee_position', e.target.value)}
                  style={{ width: '120px', height: '28px', fontSize: 'var(--font-size-sm)' }} />
              )}
              {step.assignee_type === 'department' && (
                <select className="form-input form-select" value={step.assignee_department_id}
                  onChange={e => updateStep(idx, 'assignee_department_id', Number(e.target.value))}
                  style={{ width: '140px', height: '28px', fontSize: 'var(--font-size-sm)' }}>
                  <option value="">부서 선택</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
              {step.assignee_type === 'person' && (
                <select className="form-input form-select" value={step.assignee_employee_id}
                  onChange={e => updateStep(idx, 'assignee_employee_id', Number(e.target.value))}
                  style={{ width: '160px', height: '28px', fontSize: 'var(--font-size-sm)' }}>
                  <option value="">직원 선택</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
                  ))}
                </select>
              )}
              <button className="btn btn--ghost btn--sm" onClick={() => removeStep(idx)}
                style={{ marginLeft: 'auto' }} disabled={form.steps.length <= 1}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Leave Type Mapping */}
        <div className="form-group">
          <label className="form-label">적용 휴가 유형</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {leaveTypes.map(lt => (
              <label key={lt.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.leave_type_ids.includes(lt.id)}
                  onChange={() => toggleLeaveType(lt.id)}
                  style={{ width: '14px', height: '14px' }} />
                <span style={{ fontSize: 'var(--font-size-sm)' }}>{lt.name}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}
      </Modal>
    </div>
  );
};

export default ApprovalFlowSettings;
