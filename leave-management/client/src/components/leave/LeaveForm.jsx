import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Clock, Calendar as CalendarIcon } from 'lucide-react';
import apiClient from '../../api/client';
import useAuth from '../../hooks/useAuth';
import useApi from '../../hooks/useApi';
import DatePicker from '../common/DatePicker';
import TimePicker from '../common/TimePicker';
import Badge from '../common/Badge';

const RETROACTIVE_REASONS = [
  '긴급 업무',
  '출장 중',
  '시스템 장애',
  '건강 사유',
  '천재지변',
  '기타 불가피한 사유',
];

const STEPS = [
  { num: 1, label: '휴가 유형 선택' },
  { num: 2, label: '날짜/시간 설정' },
  { num: 3, label: '확인 및 제출' },
];

const LeaveForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading: submitting, execute } = useApi();

  const [step, setStep] = useState(1);

  // Step 1 state
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [condolenceSubtypes, setCondolenceSubtypes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [selectedCondolenceId, setSelectedCondolenceId] = useState(null);
  const [balance, setBalance] = useState(null);

  // Step 2 state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfDayType, setHalfDayType] = useState(null);
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [isRetroactive, setIsRetroactive] = useState(false);
  const [retroactiveCategory, setRetroactiveCategory] = useState('');
  const [retroactiveDetail, setRetroactiveDetail] = useState('');
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [calculatedHours, setCalculatedHours] = useState(0);

  // Step 3 state
  const [reason, setReason] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgentReason, setUrgentReason] = useState('');
  const [departments, setDepartments] = useState([]);
  const [visibilityDeptIds, setVisibilityDeptIds] = useState([]);

  const [loadingTypes, setLoadingTypes] = useState(true);
  const [error, setError] = useState(null);

  const selectedType = useMemo(
    () => leaveTypes.find(t => t.id === selectedTypeId),
    [leaveTypes, selectedTypeId]
  );

  const selectedCondolence = useMemo(
    () => condolenceSubtypes.find(s => s.id === selectedCondolenceId),
    [condolenceSubtypes, selectedCondolenceId]
  );

  // Fetch leave types on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingTypes(true);
        const result = await apiClient.get('/leaves/types');
        if (result.success) {
          setLeaveTypes(result.data.leaveTypes);
          setCondolenceSubtypes(result.data.condolenceSubtypes);
        }
      } catch (err) {
        setError('휴가 유형을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoadingTypes(false);
      }
    };

    const fetchDepts = async () => {
      try {
        const result = await apiClient.get('/admin/departments');
        if (result.success) {
          setDepartments(result.data.departments || result.data || []);
          if (user?.departmentId) {
            setVisibilityDeptIds([user.departmentId]);
          }
        }
      } catch {
        // Departments might not be available — use fallback
        if (user?.departmentId) {
          setVisibilityDeptIds([user.departmentId]);
        }
      }
    };

    fetchData();
    fetchDepts();
  }, [user]);

  // Fetch balance when ANNUAL is selected
  useEffect(() => {
    if (selectedType?.code === 'ANNUAL') {
      const fetchBalance = async () => {
        try {
          const result = await apiClient.get('/balances/me');
          if (result.success) {
            setBalance(result.data.balance);
          }
        } catch {
          setBalance(null);
        }
      };
      fetchBalance();
    }
  }, [selectedTypeId, selectedType?.code]);

  // Calculate days when dates change
  useEffect(() => {
    if (!startDate || !endDate) {
      setCalculatedDays(0);
      return;
    }

    if (selectedType?.code === 'CONDOLENCE' && selectedCondolence) {
      setCalculatedDays(selectedCondolence.days);
      return;
    }

    if (halfDayType === 'AM' || halfDayType === 'PM') {
      setCalculatedDays(0.5);
      return;
    }

    if (halfDayType === 'TIME') {
      if (timeStart && timeEnd) {
        const result = calculateTimeHours(timeStart, timeEnd);
        setCalculatedHours(result.hours);
        setCalculatedDays(result.days);
      } else {
        setCalculatedDays(0);
        setCalculatedHours(0);
      }
      return;
    }

    // Full day: calculate via API or locally
    const calcDays = async () => {
      try {
        const result = await apiClient.get(`/leaves/calc-days?startDate=${startDate}&endDate=${endDate}`);
        if (result.success) {
          setCalculatedDays(result.data.businessDays);
        }
      } catch {
        // Fallback: simple calculation
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        setCalculatedDays(Math.max(0, diff));
      }
    };
    calcDays();
  }, [startDate, endDate, halfDayType, timeStart, timeEnd, selectedType, selectedCondolence]);

  // Retroactive detection
  useEffect(() => {
    if (startDate) {
      const today = new Date().toISOString().slice(0, 10);
      setIsRetroactive(startDate < today);
    } else {
      setIsRetroactive(false);
    }
  }, [startDate]);

  function calculateTimeHours(start, end) {
    if (!start || !end) return { hours: 0, days: 0 };
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin <= startMin) return { hours: 0, days: 0 };
    let totalMin = endMin - startMin;
    // Exclude lunch 12:00-13:00
    const lunchStart = 720, lunchEnd = 780;
    if (startMin < lunchEnd && endMin > lunchStart) {
      const overlapStart = Math.max(startMin, lunchStart);
      const overlapEnd = Math.min(endMin, lunchEnd);
      if (overlapEnd > overlapStart) totalMin -= (overlapEnd - overlapStart);
    }
    const hours = Math.round((totalMin / 60) * 100) / 100;
    const days = Math.round((hours / 8) * 100) / 100;
    return { hours, days };
  }

  const isSingleDay = startDate && endDate && startDate === endDate;

  function canGoNext() {
    if (step === 1) {
      if (!selectedTypeId) return false;
      if (selectedType?.code === 'CONDOLENCE' && !selectedCondolenceId) return false;
      if (!selectedType?.isAvailable) return false;
      return true;
    }
    if (step === 2) {
      if (!startDate || !endDate) return false;
      if (startDate > endDate) return false;
      if (halfDayType === 'TIME' && (!timeStart || !timeEnd)) return false;
      if (isRetroactive && !selectedType?.allowsRetroactive) return false;
      if (isRetroactive && !retroactiveCategory) return false;
      if (calculatedDays <= 0) return false;
      return true;
    }
    return true;
  }

  async function handleSubmit() {
    setError(null);
    try {
      const body = {
        leaveTypeId: selectedTypeId,
        condolenceSubtypeId: selectedCondolenceId || undefined,
        startDate,
        endDate,
        halfDayType: halfDayType || undefined,
        timeStart: halfDayType === 'TIME' ? timeStart : undefined,
        timeEnd: halfDayType === 'TIME' ? timeEnd : undefined,
        reason: reason || undefined,
        isUrgent,
        urgentReason: isUrgent ? urgentReason : undefined,
        isRetroactive,
        retroactiveCategory: isRetroactive ? retroactiveCategory : undefined,
        retroactiveDetail: isRetroactive ? retroactiveDetail : undefined,
        visibilityDepartmentIds: visibilityDeptIds,
      };

      const result = await execute(() => apiClient.post('/leaves', body));
      if (result.success) {
        navigate('/leaves');
      }
    } catch (err) {
      setError(err?.error || '휴가 신청 중 오류가 발생했습니다.');
    }
  }

  // ---- Render ----
  return (
    <div className="leave-form">
      <div className="leave-form__header">
        <h2>휴가 신청</h2>
      </div>

      {/* Step indicator */}
      <div className="leave-form__steps">
        {STEPS.map((s, idx) => (
          <React.Fragment key={s.num}>
            {idx > 0 && (
              <div className={`leave-form__step-line ${step > s.num - 1 ? 'leave-form__step-line--active' : ''}`} />
            )}
            <div
              className={`leave-form__step-circle ${
                step === s.num ? 'leave-form__step-circle--current' :
                step > s.num ? 'leave-form__step-circle--done' : ''
              }`}
            >
              {step > s.num ? <Check size={14} /> : s.num}
            </div>
            <span className={`leave-form__step-label ${step === s.num ? 'leave-form__step-label--current' : ''}`}>
              {s.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="leave-form__error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Leave Type Selection */}
      {step === 1 && (
        <div className="leave-form__section">
          <h3 className="leave-form__section-title">휴가 유형을 선택하세요</h3>

          {loadingTypes ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="loading-spinner" />
            </div>
          ) : (
            <div className="leave-form__type-grid">
              {leaveTypes.map(lt => (
                <div
                  key={lt.id}
                  className={`leave-form__type-card ${
                    selectedTypeId === lt.id ? 'leave-form__type-card--selected' : ''
                  } ${!lt.isAvailable ? 'leave-form__type-card--disabled' : ''}`}
                  onClick={() => {
                    if (lt.isAvailable) {
                      setSelectedTypeId(lt.id);
                      setSelectedCondolenceId(null);
                    }
                  }}
                >
                  <div className="leave-form__type-name">{lt.name}</div>
                  {lt.defaultDays && (
                    <div className="leave-form__type-days">{lt.defaultDays}일</div>
                  )}
                  {!lt.isAvailable && (
                    <div className="leave-form__type-disabled-reason">{lt.disableReason}</div>
                  )}
                  {lt.code === 'ANNUAL' && balance && (
                    <div className="leave-form__type-balance">
                      잔여: {balance.remainingDays}일 / {balance.totalDays}일
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Condolence subtypes */}
          {selectedType?.code === 'CONDOLENCE' && (
            <div className="leave-form__condolence">
              <h4 className="leave-form__section-title">경조사 유형 선택</h4>
              <div className="leave-form__condolence-list">
                {condolenceSubtypes.map(sub => (
                  <label
                    key={sub.id}
                    className={`leave-form__condolence-item ${
                      selectedCondolenceId === sub.id ? 'leave-form__condolence-item--selected' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="condolence"
                      checked={selectedCondolenceId === sub.id}
                      onChange={() => setSelectedCondolenceId(sub.id)}
                    />
                    <span className="leave-form__condolence-name">{sub.name}</span>
                    <span className="leave-form__condolence-days">{sub.days}일</span>
                    {sub.description && (
                      <span className="leave-form__condolence-desc">{sub.description}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Date/Time */}
      {step === 2 && (
        <div className="leave-form__section">
          <h3 className="leave-form__section-title">날짜 및 시간 설정</h3>

          <div className="leave-form__date-row">
            <div className="leave-form__field">
              <label className="form-label">시작일</label>
              <DatePicker value={startDate} onChange={(v) => { setStartDate(v); if (!endDate || v > endDate) setEndDate(v); }} />
            </div>
            <div className="leave-form__field">
              <label className="form-label">종료일</label>
              <DatePicker value={endDate} onChange={setEndDate} min={startDate} />
            </div>
          </div>

          {/* Half-day / Time options (only for single day) */}
          {isSingleDay && (
            <div className="leave-form__halfday">
              <label className="form-label">근무시간 구분</label>
              <div className="leave-form__halfday-options">
                <label className={`leave-form__halfday-option ${!halfDayType ? 'leave-form__halfday-option--selected' : ''}`}>
                  <input type="radio" name="halfDay" checked={!halfDayType} onChange={() => setHalfDayType(null)} />
                  <span>종일</span>
                </label>
                <label className={`leave-form__halfday-option ${halfDayType === 'AM' ? 'leave-form__halfday-option--selected' : ''}`}>
                  <input type="radio" name="halfDay" checked={halfDayType === 'AM'} onChange={() => setHalfDayType('AM')} />
                  <span>오전 반차</span>
                </label>
                <label className={`leave-form__halfday-option ${halfDayType === 'PM' ? 'leave-form__halfday-option--selected' : ''}`}>
                  <input type="radio" name="halfDay" checked={halfDayType === 'PM'} onChange={() => setHalfDayType('PM')} />
                  <span>오후 반차</span>
                </label>
                <label className={`leave-form__halfday-option ${halfDayType === 'TIME' ? 'leave-form__halfday-option--selected' : ''}`}>
                  <input type="radio" name="halfDay" checked={halfDayType === 'TIME'} onChange={() => setHalfDayType('TIME')} />
                  <span>시간 연차</span>
                </label>
              </div>
            </div>
          )}

          {/* Time range picker for TIME type */}
          {halfDayType === 'TIME' && (
            <div className="leave-form__time-row">
              <div className="leave-form__field">
                <label className="form-label">시작 시간</label>
                <TimePicker value={timeStart} onChange={setTimeStart} min="09:00" max="17:30" step={30} />
              </div>
              <div className="leave-form__field">
                <label className="form-label">종료 시간</label>
                <TimePicker value={timeEnd} onChange={setTimeEnd} min={timeStart || '09:30'} max="18:00" step={30} />
              </div>
              {calculatedHours > 0 && (
                <div className="leave-form__time-info">
                  <Clock size={14} />
                  <span>{calculatedHours}시간 = {calculatedDays}일 (점심시간 12:00~13:00 제외)</span>
                </div>
              )}
            </div>
          )}

          {/* Calculated days summary */}
          <div className="leave-form__calc-summary">
            <CalendarIcon size={16} />
            <span>신청 일수: <strong>{calculatedDays}일</strong></span>
            {selectedType?.code === 'ANNUAL' && balance && (
              <span style={{ marginLeft: '16px', color: 'var(--color-text-secondary)' }}>
                (잔여: {balance.remainingDays}일)
              </span>
            )}
          </div>

          {/* Retroactive section */}
          {isRetroactive && (
            <div className="leave-form__retroactive">
              <div className="leave-form__retroactive-header">
                <AlertTriangle size={16} />
                <span>사후 신청</span>
              </div>

              {!selectedType?.allowsRetroactive ? (
                <div className="leave-form__retroactive-blocked">
                  {selectedType?.name}은(는) 사후 신청이 불가능합니다.
                </div>
              ) : (
                <>
                  <label className="form-label">사후 신청 사유 (필수)</label>
                  <div className="leave-form__retroactive-reasons">
                    {RETROACTIVE_REASONS.map(r => (
                      <label key={r} className={`leave-form__retroactive-reason ${retroactiveCategory === r ? 'leave-form__retroactive-reason--selected' : ''}`}>
                        <input
                          type="radio"
                          name="retroReason"
                          checked={retroactiveCategory === r}
                          onChange={() => setRetroactiveCategory(r)}
                        />
                        <span>{r}</span>
                      </label>
                    ))}
                  </div>
                  <div className="leave-form__field" style={{ marginTop: '12px' }}>
                    <label className="form-label">상세 사유</label>
                    <input
                      type="text"
                      className="form-input"
                      value={retroactiveDetail}
                      onChange={(e) => setRetroactiveDetail(e.target.value)}
                      placeholder="사후 신청 상세 사유를 입력하세요"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Confirm & Submit */}
      {step === 3 && (
        <div className="leave-form__section">
          <h3 className="leave-form__section-title">신청 내용 확인</h3>

          <div className="leave-form__summary">
            <div className="leave-form__summary-row">
              <span className="leave-form__summary-label">휴가 유형</span>
              <span className="leave-form__summary-value">
                {selectedType?.name}
                {selectedCondolence && ` - ${selectedCondolence.name}`}
              </span>
            </div>
            <div className="leave-form__summary-row">
              <span className="leave-form__summary-label">기간</span>
              <span className="leave-form__summary-value">
                {startDate} ~ {endDate}
                {halfDayType === 'AM' && ' (오전 반차)'}
                {halfDayType === 'PM' && ' (오후 반차)'}
                {halfDayType === 'TIME' && ` (${timeStart} ~ ${timeEnd})`}
              </span>
            </div>
            <div className="leave-form__summary-row">
              <span className="leave-form__summary-label">신청 일수</span>
              <span className="leave-form__summary-value"><strong>{calculatedDays}일</strong></span>
            </div>
            {isRetroactive && (
              <div className="leave-form__summary-row">
                <span className="leave-form__summary-label">사후 신청</span>
                <span className="leave-form__summary-value">
                  <Badge variant="warning" size="sm">사후 신청</Badge>
                  {' '}{retroactiveCategory}
                </span>
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="leave-form__field">
            <label className="form-label">신청 사유</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="휴가 사유를 입력하세요"
            />
          </div>

          {/* Urgent */}
          <div className="leave-form__urgent">
            <label className="leave-form__checkbox-label">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
              />
              <span>긴급 신청</span>
            </label>
            {isUrgent && (
              <div className="leave-form__field" style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  value={urgentReason}
                  onChange={(e) => setUrgentReason(e.target.value)}
                  placeholder="긴급 사유를 입력하세요"
                />
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="leave-form__visibility">
            <label className="form-label">열람 범위 (캘린더에 표시할 부서)</label>
            <div className="leave-form__dept-list">
              {departments.map(dept => (
                <label key={dept.id} className="leave-form__checkbox-label">
                  <input
                    type="checkbox"
                    checked={visibilityDeptIds.includes(dept.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setVisibilityDeptIds([...visibilityDeptIds, dept.id]);
                      } else {
                        setVisibilityDeptIds(visibilityDeptIds.filter(id => id !== dept.id));
                      }
                    }}
                  />
                  <span>{dept.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="leave-form__actions">
        {step > 1 && (
          <button className="btn btn--secondary" onClick={() => setStep(step - 1)}>
            <ChevronLeft size={16} />
            이전
          </button>
        )}
        <div style={{ flex: 1 }} />
        {step < 3 && (
          <button
            className="btn btn--primary"
            onClick={() => setStep(step + 1)}
            disabled={!canGoNext()}
          >
            다음
            <ChevronRight size={16} />
          </button>
        )}
        {step === 3 && (
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '제출 중...' : '휴가 신청'}
          </button>
        )}
      </div>
    </div>
  );
};

export default LeaveForm;
