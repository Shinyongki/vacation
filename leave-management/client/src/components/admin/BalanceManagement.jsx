import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';

const BalanceManagement = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ amount: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [adjustments, setAdjustments] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/admin/balances?year=${year}`);
      if (res.success) setBalances(res.data);
    } catch (err) {
      console.error('Failed to fetch balances', err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const openAdjustModal = (balance) => {
    setSelectedBalance(balance);
    setAdjustForm({ amount: '', reason: '' });
    setShowAdjustModal(true);
  };

  const handleAdjust = async () => {
    if (!adjustForm.amount || !adjustForm.reason) {
      alert('조정일수와 사유를 모두 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.post('/admin/balances/adjust', {
        employee_id: selectedBalance.employee_id,
        year,
        amount: Number(adjustForm.amount),
        reason: adjustForm.reason,
      });
      if (res.success) {
        setShowAdjustModal(false);
        fetchBalances();
      }
    } catch (err) {
      alert(err.error || '조정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const viewHistory = async (balance) => {
    setSelectedBalance(balance);
    try {
      const res = await apiClient.get(`/admin/balances/${balance.employee_id}/adjustments?year=${year}`);
      if (res.success) setAdjustments(res.data);
    } catch (err) {
      setAdjustments([]);
    }
    setShowHistoryModal(true);
  };

  const columns = [
    { key: 'employee_number', label: '사번', width: '90px' },
    { key: 'employee_name', label: '이름', width: '80px' },
    { key: 'department_name', label: '부서', width: '110px' },
    { key: 'position', label: '직위', width: '70px' },
    { key: 'total_days', label: '총 연차', width: '80px', render: (v) => `${v}일` },
    { key: 'used_days', label: '사용', width: '70px', render: (v) => `${v}일` },
    { key: 'adjusted_days', label: '조정', width: '70px', render: (v) => {
      if (!v || v === 0) return '-';
      return <span style={{ color: v > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{v > 0 ? '+' : ''}{v}일</span>;
    }},
    {
      key: 'remaining', label: '잔여', width: '80px', sortable: false,
      render: (_, row) => {
        const remaining = row.total_days - row.used_days + row.adjusted_days;
        return (
          <span style={{ fontWeight: 'var(--font-weight-semibold)', color: remaining <= 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
            {remaining}일
          </span>
        );
      }
    },
    {
      key: 'actions', label: '관리', width: '130px', sortable: false,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); openAdjustModal(row); }}>
            <Plus size={12} /> 조정
          </button>
          <button className="btn btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); viewHistory(row); }}>
            내역
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>잔여일수 관리</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setYear(y => y - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', minWidth: '50px', textAlign: 'center' }}>
              {year}년
            </span>
            <button className="btn btn--ghost btn--sm" onClick={() => setYear(y => y + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={balances}
        loading={loading}
        emptyMessage={`${year}년 잔여일수 데이터가 없습니다.`}
        defaultSortKey="employee_number"
      />

      {/* Adjust Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title={`잔여일수 조정 - ${selectedBalance?.employee_name || ''}`}
        size="sm"
        footer={
          <>
            <button className="btn btn--secondary" onClick={() => setShowAdjustModal(false)}>취소</button>
            <button className="btn btn--primary" onClick={handleAdjust} disabled={saving}>
              {saving ? '처리 중...' : '조정'}
            </button>
          </>
        }
      >
        <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'var(--color-bg-table-header)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
            <span>현재 총 연차</span>
            <span>{selectedBalance?.total_days || 0}일</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
            <span>사용</span>
            <span>{selectedBalance?.used_days || 0}일</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
            <span>기존 조정</span>
            <span>{selectedBalance?.adjusted_days || 0}일</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', borderTop: '1px solid var(--color-border-light)', paddingTop: '4px', marginTop: '4px' }}>
            <span>잔여</span>
            <span>{(selectedBalance?.total_days || 0) - (selectedBalance?.used_days || 0) + (selectedBalance?.adjusted_days || 0)}일</span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label form-label--required">조정 일수</label>
          <input
            className="form-input"
            type="number"
            step="0.5"
            placeholder="양수: 추가, 음수: 차감"
            value={adjustForm.amount}
            onChange={e => setAdjustForm(p => ({ ...p, amount: e.target.value }))}
          />
          <div className="form-help">양수를 입력하면 추가, 음수를 입력하면 차감됩니다.</div>
        </div>
        <div className="form-group">
          <label className="form-label form-label--required">사유</label>
          <input
            className="form-input"
            placeholder="조정 사유를 입력하세요"
            value={adjustForm.reason}
            onChange={e => setAdjustForm(p => ({ ...p, reason: e.target.value }))}
          />
        </div>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`조정 내역 - ${selectedBalance?.employee_name || ''}`}
        size="md"
        footer={
          <button className="btn btn--secondary" onClick={() => setShowHistoryModal(false)}>닫기</button>
        }
      >
        {adjustments.length > 0 ? (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>조정일수</th>
                  <th>사유</th>
                  <th>처리자</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map(adj => (
                  <tr key={adj.id}>
                    <td style={{ fontSize: 'var(--font-size-sm)' }}>{adj.created_at}</td>
                    <td>
                      <span style={{ color: adj.amount > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 'var(--font-weight-medium)' }}>
                        {adj.amount > 0 ? '+' : ''}{adj.amount}일
                      </span>
                    </td>
                    <td>{adj.reason}</td>
                    <td>{adj.adjusted_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
            조정 내역이 없습니다.
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BalanceManagement;
