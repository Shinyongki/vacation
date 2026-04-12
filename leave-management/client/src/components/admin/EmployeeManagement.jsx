import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RotateCcw, UserMinus, Upload } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import ExcelUploadModal from './ExcelUploadModal';

const ROLE_LABELS = {
  staff: '직원',
  team_lead: '팀장',
  director: '원장',
  hr_admin: '인사관리자',
  foundation: '재단',
};

const POSITION_OPTIONS = ['사원', '주임', '팀장', '부장', '원장'];
const ROLE_OPTIONS = ['staff', 'team_lead', 'director', 'hr_admin', 'foundation'];
const EMPLOYMENT_TYPES = { regular: '정규직', contract: '계약직' };
const GENDER_OPTIONS = { M: '남성', F: '여성' };

const INITIAL_FORM = {
  employee_number: '',
  name: '',
  department_id: '',
  position: '사원',
  role: 'staff',
  hire_date: '',
  birth_date: '',
  gender: 'M',
  phone: '',
  employment_type: 'regular',
};

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: 'active', department_id: '', search: '' });
  const [searchInput, setSearchInput] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.department_id) params.append('department_id', filters.department_id);
      if (filters.search) params.append('search', filters.search);
      const res = await apiClient.get(`/admin/employees?${params.toString()}`);
      if (res.success) setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/departments');
      if (res.success) setDepartments(res.data);
    } catch (err) {
      console.error('Failed to fetch departments', err);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchInput }));
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleRowClick = (row) => {
    setSelectedEmployee(row);
    setForm({
      employee_number: row.employee_number,
      name: row.name,
      department_id: row.department_id,
      position: row.position,
      role: row.role,
      hire_date: row.hire_date,
      birth_date: row.birth_date,
      gender: row.gender,
      phone: row.phone || '',
      employment_type: row.employment_type,
    });
    setError('');
    setShowEditModal(true);
  };

  const handleCreate = async () => {
    setError('');
    if (!form.employee_number || !form.name || !form.department_id || !form.hire_date || !form.birth_date) {
      setError('필수 항목을 모두 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.post('/admin/employees', form);
      if (res.success) {
        setShowCreateModal(false);
        setForm({ ...INITIAL_FORM });
        fetchEmployees();
      }
    } catch (err) {
      setError(err.error || '직원 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await apiClient.put(`/admin/employees/${selectedEmployee.id}`, form);
      if (res.success) {
        setShowEditModal(false);
        setSelectedEmployee(null);
        fetchEmployees();
      }
    } catch (err) {
      setError(err.error || '직원 정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleResign = async () => {
    setSaving(true);
    try {
      const res = await apiClient.put(`/admin/employees/${selectedEmployee.id}/resign`);
      if (res.success) {
        setShowResignConfirm(false);
        setShowEditModal(false);
        setSelectedEmployee(null);
        fetchEmployees();
      }
    } catch (err) {
      setError(err.error || '퇴사 처리에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!window.confirm('비밀번호를 생년월일 6자리로 초기화하시겠습니까?')) return;
    try {
      const res = await apiClient.put(`/admin/employees/${selectedEmployee.id}/reset-password`);
      if (res.success) {
        alert('비밀번호가 초기화되었습니다.');
      }
    } catch (err) {
      alert(err.error || '비밀번호 초기화에 실패했습니다.');
    }
  };

  const columns = [
    { key: 'employee_number', label: '사번', width: '90px' },
    { key: 'name', label: '이름', width: '80px' },
    { key: 'department_name', label: '부서', width: '110px' },
    { key: 'position', label: '직위', width: '70px' },
    { key: 'role', label: '역할', width: '100px', render: (v) => ROLE_LABELS[v] || v },
    { key: 'employment_type', label: '고용형태', width: '80px', render: (v) => EMPLOYMENT_TYPES[v] || v },
    {
      key: 'status', label: '상태', width: '70px',
      render: (v) => (
        <Badge variant={v === 'active' ? 'success' : 'neutral'} size="sm">
          {v === 'active' ? '재직' : '퇴사'}
        </Badge>
      )
    },
    { key: 'hire_date', label: '입사일', width: '100px' },
  ];

  const renderFormFields = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label form-label--required">사번</label>
        <input className="form-input" value={form.employee_number}
          onChange={e => setForm(p => ({ ...p, employee_number: e.target.value }))}
          disabled={!!selectedEmployee} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label form-label--required">이름</label>
        <input className="form-input" value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label form-label--required">부서</label>
        <select className="form-input form-select" value={form.department_id}
          onChange={e => setForm(p => ({ ...p, department_id: Number(e.target.value) }))}>
          <option value="">선택</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label form-label--required">직위</label>
        <select className="form-input form-select" value={form.position}
          onChange={e => setForm(p => ({ ...p, position: e.target.value }))}>
          {POSITION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label form-label--required">역할</label>
        <select className="form-input form-select" value={form.role}
          onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label form-label--required">고용형태</label>
        <select className="form-input form-select" value={form.employment_type}
          onChange={e => setForm(p => ({ ...p, employment_type: e.target.value }))}>
          <option value="regular">정규직</option>
          <option value="contract">계약직</option>
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label form-label--required">입사일</label>
        <input className="form-input" type="date" value={form.hire_date}
          onChange={e => setForm(p => ({ ...p, hire_date: e.target.value }))} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label form-label--required">생년월일</label>
        <input className="form-input" type="date" value={form.birth_date}
          onChange={e => setForm(p => ({ ...p, birth_date: e.target.value }))} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label form-label--required">성별</label>
        <div style={{ display: 'flex', gap: '16px', height: '36px', alignItems: 'center' }}>
          {Object.entries(GENDER_OPTIONS).map(([val, label]) => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="radio" name="gender" value={val} checked={form.gender === val}
                onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">연락처</label>
        <input className="form-input" value={form.phone} placeholder="010-0000-0000"
          onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '200px' }}>
            <Search size={16} style={{ color: 'var(--color-text-muted)' }} />
            <input
              className="form-input"
              placeholder="이름 또는 사번으로 검색"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              style={{ flex: 1 }}
            />
            <button className="btn btn--secondary btn--sm" onClick={handleSearch}>검색</button>
          </div>

          <select className="form-input form-select" value={filters.status}
            onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
            style={{ width: '100px' }}>
            <option value="">전체 상태</option>
            <option value="active">재직</option>
            <option value="inactive">퇴사</option>
          </select>

          <select className="form-input form-select" value={filters.department_id}
            onChange={e => setFilters(p => ({ ...p, department_id: e.target.value }))}
            style={{ width: '120px' }}>
            <option value="">전체 부서</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn--secondary btn--sm" onClick={() => setShowExcelModal(true)}>
              <Upload size={14} /> 엑셀 업로드
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => {
              setForm({ ...INITIAL_FORM });
              setError('');
              setSelectedEmployee(null);
              setShowCreateModal(true);
            }}>
              <Plus size={14} /> 직원 등록
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={employees}
        loading={loading}
        onRowClick={handleRowClick}
        emptyMessage="등록된 직원이 없습니다."
        defaultSortKey="employee_number"
      />

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="직원 등록" size="lg"
        footer={
          <>
            <button className="btn btn--secondary" onClick={() => setShowCreateModal(false)}>취소</button>
            <button className="btn btn--primary" onClick={handleCreate} disabled={saving}>
              {saving ? '등록 중...' : '등록'}
            </button>
          </>
        }>
        {renderFormFields()}
        <div style={{
          marginTop: '16px', padding: '10px 12px', background: 'var(--color-info-light)',
          borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-info)'
        }}>
          초기 비밀번호는 생년월일 6자리입니다. (예: 1990년 3월 10일 → 900310)
        </div>
        {error && <div className="form-error" style={{ marginTop: '12px' }}>{error}</div>}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="직원 정보 수정" size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedEmployee && selectedEmployee.status === 'active' && (
                <>
                  <button className="btn btn--danger btn--sm" onClick={() => setShowResignConfirm(true)}>
                    <UserMinus size={14} /> 퇴사 처리
                  </button>
                  <button className="btn btn--secondary btn--sm" onClick={handleResetPassword}>
                    <RotateCcw size={14} /> 비밀번호 초기화
                  </button>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn--secondary" onClick={() => setShowEditModal(false)}>취소</button>
              <button className="btn btn--primary" onClick={handleUpdate} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        }>
        {renderFormFields()}
        {error && <div className="form-error" style={{ marginTop: '12px' }}>{error}</div>}
      </Modal>

      {/* Resign Confirmation */}
      <Modal isOpen={showResignConfirm} onClose={() => setShowResignConfirm(false)} title="퇴사 처리 확인" size="sm"
        footer={
          <>
            <button className="btn btn--secondary" onClick={() => setShowResignConfirm(false)}>취소</button>
            <button className="btn btn--danger" onClick={handleResign} disabled={saving}>
              {saving ? '처리 중...' : '퇴사 처리'}
            </button>
          </>
        }>
        <p>
          <strong>{selectedEmployee?.name}</strong>({selectedEmployee?.employee_number}) 님을 퇴사 처리하시겠습니까?
        </p>
        <p style={{ marginTop: '8px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          퇴사 처리 후에는 로그인이 차단되며, 결재 라인에서 제외됩니다. 기존 데이터는 보존됩니다.
        </p>
      </Modal>

      {/* Excel Upload Modal */}
      <ExcelUploadModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onComplete={() => { setShowExcelModal(false); fetchEmployees(); }}
        departments={departments}
      />
    </div>
  );
};

export default EmployeeManagement;
