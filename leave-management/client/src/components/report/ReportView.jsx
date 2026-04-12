import React, { useState, useEffect, useCallback } from 'react';
import { Download, FileSpreadsheet, File, Archive } from 'lucide-react';
import apiClient from '../../api/client';
import useAuth from '../../hooks/useAuth';
import DataTable from '../common/DataTable';
import DatePicker from '../common/DatePicker';
import Badge from '../common/Badge';

const STATUS_LABELS = {
  draft: '임시저장',
  pending: '결재중',
  approved: '승인',
  rejected: '반려',
  recalled: '회수',
  cancelled: '취소'
};

const FORMAT_OPTIONS = [
  { value: 'zip', label: 'ZIP (Excel+PDF)', icon: Archive },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', icon: File },
];

const ReportView = () => {
  const [activeTab, setActiveTab] = useState('usage');

  return (
    <div>
      <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#1B3A5C', marginBottom: '16px' }}>보고서</h2>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', marginBottom: '20px' }}>
        {[
          { key: 'usage', label: '사용 현황' },
          { key: 'summary', label: '요약 보고서' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #1B5E9E' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab.key ? '#1B5E9E' : '#5A6E82',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'var(--font-family)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'usage' ? <UsageTab /> : <SummaryTab />}
    </div>
  );
};

// ─────────── 부서 목록 조회 (모든 역할에서 접근 가능한 방법) ───────────
function useDepartments() {
  const [departments, setDepartments] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    // hr_admin은 admin API 사용, 다른 역할은 dashboard에서 추출하거나 빈 목록
    const fetchDepts = async () => {
      try {
        if (user?.role === 'hr_admin') {
          const res = await apiClient.get('/admin/departments');
          if (res.success && res.data) {
            const depts = Array.isArray(res.data) ? res.data : (res.data.departments || []);
            setDepartments(depts);
          }
        } else {
          // director/foundation: dashboard API에서 부서 정보 추출 시도
          // 또는 leaves/team-status에서 추출
          try {
            const res = await apiClient.get('/leaves/team-status');
            if (res.success && res.data) {
              const leaves = res.data.leaves || res.data.teamStatus || [];
              const deptMap = new Map();
              leaves.forEach(l => {
                const name = l.department_name || l.departmentName;
                const id = l.department_id || l.departmentId;
                if (id && name) deptMap.set(id, name);
              });
              setDepartments(Array.from(deptMap, ([id, name]) => ({ id, name })));
            }
          } catch {
            setDepartments([]);
          }
        }
      } catch {
        setDepartments([]);
      }
    };
    fetchDepts();
  }, [user?.role]);

  return departments;
}

// ─────────── Usage Tab (R-01) ───────────

const UsageTab = () => {
  const { user } = useAuth();
  const departments = useDepartments();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [format, setFormat] = useState('zip');
  const [previewData, setPreviewData] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    setDateFrom(`${y}-01-01`);
    setDateTo(`${y}-12-31`);
  }, []);

  // 미리보기: team-status 또는 leaves API 사용
  const loadPreview = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setPreviewLoading(true);
    try {
      // team-status를 사용하여 전체 휴가 데이터 조회
      const res = await apiClient.get('/leaves/team-status');
      if (res.success && res.data) {
        let leaves = res.data.leaves || res.data.teamStatus || [];
        // 날짜 필터
        leaves = leaves.filter(l => {
          const start = l.start_date || l.startDate;
          const end = l.end_date || l.endDate;
          return start && end && start <= dateTo && end >= dateFrom;
        });
        // 부서 필터
        if (departmentId) {
          leaves = leaves.filter(l =>
            String(l.department_id || l.departmentId) === String(departmentId)
          );
        }
        setPreviewData(leaves);
      }
    } catch {
      // 폴백: 자신의 휴가 목록
      try {
        const res = await apiClient.get('/leaves');
        if (res.success && res.data) {
          setPreviewData(res.data.requests || []);
        }
      } catch {
        setPreviewData([]);
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [dateFrom, dateTo, departmentId]);

  useEffect(() => {
    if (dateFrom && dateTo) loadPreview();
  }, [dateFrom, dateTo, departmentId, loadPreview]);

  const handleDownload = async () => {
    if (!dateFrom || !dateTo) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, format });
      if (departmentId) params.append('department_id', departmentId);

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/usage?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errText = await response.text();
        try {
          const errJson = JSON.parse(errText);
          throw new Error(errJson.error || 'Download failed');
        } catch {
          throw new Error('보고서 생성에 실패했습니다.');
        }
      }

      const blob = await response.blob();
      let filename = `휴가사용현황_${dateFrom}_${dateTo}`;
      if (format === 'excel') filename += '.xlsx';
      else if (format === 'pdf') filename += '.pdf';
      else filename += '.zip';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || '보고서 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  const columns = [
    { key: 'employee_name', label: '이름', width: '80px',
      render: (val, row) => val || row.employeeName || row.name },
    { key: 'department_name', label: '부서', width: '100px',
      render: (val, row) => val || row.departmentName },
    { key: 'leave_type_name', label: '유형', width: '100px',
      render: (val, row) => val || row.leaveTypeName || row.leaveType },
    { key: 'start_date', label: '시작일', width: '100px',
      render: (val, row) => val || row.startDate },
    { key: 'end_date', label: '종료일', width: '100px',
      render: (val, row) => val || row.endDate },
    { key: 'total_days', label: '일수', width: '60px',
      render: (val, row) => val || row.totalDays },
    { key: 'status', label: '상태', width: '80px',
      render: (val) => (
        <Badge variant={val === 'approved' ? 'success' : val === 'pending' ? 'warning' : 'neutral'} size="sm">
          {STATUS_LABELS[val] || val}
        </Badge>
      )
    },
  ];

  return (
    <div>
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>시작일</label>
            <DatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>종료일</label>
            <DatePicker value={dateTo} onChange={setDateTo} min={dateFrom} />
          </div>
          {departments.length > 0 && (
            <div style={filterGroupStyle}>
              <label style={labelStyle}>부서</label>
              <select
                className="form-input form-select"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                style={{ height: '36px', minWidth: '140px' }}
              >
                <option value="">전체</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={filterGroupStyle}>
            <label style={labelStyle}>형식</label>
            <select
              className="form-input form-select"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              style={{ height: '36px', minWidth: '160px' }}
            >
              {FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn--primary"
            onClick={handleDownload}
            disabled={downloading || !dateFrom || !dateTo}
          >
            <Download size={14} />
            {downloading ? '생성 중...' : '보고서 생성'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px', marginTop: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 500, color: '#1B3A5C', marginBottom: '12px' }}>
          미리보기
        </h3>
        <DataTable
          columns={columns}
          data={previewData}
          loading={previewLoading}
          emptyMessage="해당 기간의 휴가 데이터가 없습니다."
        />
      </div>
    </div>
  );
};

// ─────────── Summary Tab (R-02) ───────────

const SummaryTab = () => {
  const { user } = useAuth();
  const departments = useDepartments();
  const [year, setYear] = useState(new Date().getFullYear());
  const [departmentId, setDepartmentId] = useState('');
  const [format, setFormat] = useState('zip');
  const [previewData, setPreviewData] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 4; y--) {
    yearOptions.push(y);
  }

  // 미리보기: balances/team API 사용 (team_lead, director, hr_admin)
  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      const res = await apiClient.get(`/balances/team?${params.toString()}`);
      if (res.success && res.data) {
        let balances = res.data.balances || [];
        if (departmentId) {
          balances = balances.filter(b =>
            String(b.departmentId) === String(departmentId) ||
            String(b.department_id) === String(departmentId)
          );
        }
        setPreviewData(balances);
      }
    } catch {
      // foundation 역할은 balances/team 접근 불가 → 빈 미리보기
      setPreviewData([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [year, departmentId]);

  useEffect(() => {
    loadPreview();
  }, [year, departmentId, loadPreview]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ year: String(year), format });
      if (departmentId) params.append('department_id', departmentId);

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/summary?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      let filename = `휴가요약보고서_${year}`;
      if (format === 'excel') filename += '.xlsx';
      else if (format === 'pdf') filename += '.pdf';
      else filename += '.zip';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('요약 보고서 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  const columns = [
    { key: 'employeeName', label: '이름', width: '80px',
      render: (val, row) => val || row.employee_name || row.name },
    { key: 'employeeNumber', label: '사번', width: '80px',
      render: (val, row) => val || row.employee_number },
    { key: 'department', label: '부서', width: '120px',
      render: (val, row) => val || row.department_name },
    { key: 'totalDays', label: '총 일수', width: '80px',
      render: (val, row) => val ?? row.total_days ?? 0 },
    { key: 'usedDays', label: '사용', width: '70px',
      render: (val, row) => val ?? row.used_days ?? 0 },
    { key: 'adjustedDays', label: '조정', width: '70px',
      render: (val, row) => val ?? row.adjusted_days ?? 0 },
    { key: 'remainingDays', label: '잔여', width: '70px',
      render: (val, row) => {
        const t = val ?? ((row.totalDays || 0) + (row.adjustedDays || 0) - (row.usedDays || 0));
        return <span style={{ fontWeight: 600, color: t <= 3 ? '#DC3545' : '#333' }}>{t}</span>;
      }
    },
  ];

  return (
    <div>
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>연도</label>
            <select
              className="form-input form-select"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              style={{ height: '36px', minWidth: '100px' }}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
          {departments.length > 0 && (
            <div style={filterGroupStyle}>
              <label style={labelStyle}>부서</label>
              <select
                className="form-input form-select"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                style={{ height: '36px', minWidth: '140px' }}
              >
                <option value="">전체</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={filterGroupStyle}>
            <label style={labelStyle}>형식</label>
            <select
              className="form-input form-select"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              style={{ height: '36px', minWidth: '160px' }}
            >
              {FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn--primary"
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download size={14} />
            {downloading ? '생성 중...' : '보고서 생성'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px', marginTop: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 500, color: '#1B3A5C', marginBottom: '12px' }}>
          잔여일수 현황
        </h3>
        <DataTable
          columns={columns}
          data={previewData}
          loading={previewLoading}
          emptyMessage="해당 연도의 잔여일수 데이터가 없습니다."
        />
      </div>
    </div>
  );
};

const filterGroupStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const labelStyle = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#8A95A3',
};

export default ReportView;
