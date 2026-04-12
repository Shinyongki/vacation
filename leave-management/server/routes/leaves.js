const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getDatabase } = require('../database/connection');
const { getBusinessDaysInRange, getHolidaysInRange } = require('../utils/holidays');
const { createApprovalSteps, getApprovalStatus } = require('../services/approvalEngine');
const { calculateAnnualLeave } = require('../services/leaveCalculator');

// Notification stub
let notify;
try { notify = require('../services/notificationService').notify; }
catch { notify = () => {}; }

/**
 * Ensure a leave_balances record exists for the given employee and year.
 * Replicates logic from balances.js (which doesn't export this function).
 */
function ensureBalance(employeeId, year) {
  const db = getDatabase();

  let balance = db.prepare(
    'SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?'
  ).get(employeeId, year);

  if (!balance) {
    const employee = db.prepare(
      'SELECT hire_date FROM employees WHERE id = ?'
    ).get(employeeId);

    if (!employee) return null;

    const { totalDays, calcDetail } = calculateAnnualLeave(employee.hire_date, year);

    db.prepare(
      `INSERT INTO leave_balances (employee_id, year, total_days, used_days, adjusted_days, calc_detail)
       VALUES (?, ?, ?, 0, 0, ?)`
    ).run(employeeId, year, totalDays, JSON.stringify(calcDetail));

    balance = db.prepare(
      'SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?'
    ).get(employeeId, year);
  }

  return balance;
}

/**
 * Calculate total_days for a leave request.
 */
function calculateTotalDays(startDate, endDate, halfDayType, timeStart, timeEnd) {
  if (halfDayType === 'AM' || halfDayType === 'PM') {
    return 0.5;
  }

  if (halfDayType === 'TIME') {
    return calculateTimeLeave(timeStart, timeEnd);
  }

  // Full day(s)
  return getBusinessDaysInRange(startDate, endDate);
}

/**
 * Calculate time leave in day units.
 * Exclude lunch 12:00-13:00, 8 hours = 1 day.
 */
function calculateTimeLeave(timeStart, timeEnd) {
  if (!timeStart || !timeEnd) return 0;

  const [sh, sm] = timeStart.split(':').map(Number);
  const [eh, em] = timeEnd.split(':').map(Number);

  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;

  if (endMin <= startMin) return 0;

  // Total minutes
  let totalMinutes = endMin - startMin;

  // Subtract lunch if it overlaps (12:00-13:00 = 720-780 min)
  const lunchStart = 720;
  const lunchEnd = 780;

  if (startMin < lunchEnd && endMin > lunchStart) {
    const overlapStart = Math.max(startMin, lunchStart);
    const overlapEnd = Math.min(endMin, lunchEnd);
    if (overlapEnd > overlapStart) {
      totalMinutes -= (overlapEnd - overlapStart);
    }
  }

  const hours = totalMinutes / 60;
  // Round to 2 decimal places
  return Math.round((hours / 8) * 100) / 100;
}

// ============================================================
// GET /api/leaves/types — Available leave types for the current user
// ============================================================
router.get('/types', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();

    const employee = db.prepare(
      'SELECT id, gender, employment_type FROM employees WHERE id = ?'
    ).get(req.user.id);

    if (!employee) {
      return res.status(404).json({ success: false, error: '직원 정보를 찾을 수 없습니다.' });
    }

    const leaveTypes = db.prepare('SELECT * FROM leave_types ORDER BY id').all();

    // Get employment type restrictions
    const mappings = db.prepare(
      'SELECT leave_type_id, is_allowed FROM employment_type_leave_mapping WHERE employment_type = ?'
    ).all(employee.employment_type);

    const mappingMap = {};
    for (const m of mappings) {
      mappingMap[m.leave_type_id] = m.is_allowed;
    }

    const result = leaveTypes.map(lt => {
      const genderAllowed = !lt.gender_restriction || lt.gender_restriction === employee.gender;
      const employmentAllowed = mappingMap[lt.id] !== 0; // If no mapping, default allow

      return {
        id: lt.id,
        name: lt.name,
        code: lt.code,
        defaultDays: lt.default_days,
        requiresAttachment: lt.requires_attachment,
        allowsRetroactive: lt.allows_retroactive,
        genderRestriction: lt.gender_restriction,
        isAvailable: genderAllowed && employmentAllowed,
        disableReason: !genderAllowed
          ? '성별 제한으로 신청할 수 없습니다.'
          : !employmentAllowed
          ? '고용 형태에 따라 신청할 수 없습니다.'
          : null,
      };
    });

    // Get condolence subtypes
    const subtypes = db.prepare(
      'SELECT * FROM condolence_subtypes ORDER BY id'
    ).all();

    res.json({
      success: true,
      data: {
        leaveTypes: result,
        condolenceSubtypes: subtypes.map(s => ({
          id: s.id,
          leaveTypeId: s.leave_type_id,
          name: s.name,
          days: s.days,
          description: s.description
        }))
      }
    });
  } catch (err) {
    console.error('Error fetching leave types:', err);
    res.status(500).json({ success: false, error: '휴가 유형 조회 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// GET /api/leaves/calc-days — Calculate business days between dates
// ============================================================
router.get('/calc-days', authenticateToken, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: '시작일과 종료일이 필요합니다.' });
    }
    const businessDays = getBusinessDaysInRange(startDate, endDate);
    res.json({ success: true, data: { businessDays } });
  } catch (err) {
    console.error('Error calculating days:', err);
    res.status(500).json({ success: false, error: '일수 계산 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// GET /api/leaves — List my leave requests
// ============================================================
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const { status, year, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE lr.employee_id = ?';
    const params = [req.user.id];

    if (status) {
      where += ' AND lr.status = ?';
      params.push(status);
    }

    if (year) {
      where += ' AND strftime(\'%Y\', lr.start_date) = ?';
      params.push(String(year));
    }

    // Count total
    const countRow = db.prepare(
      `SELECT COUNT(*) AS cnt FROM leave_requests lr ${where}`
    ).get(...params);

    // Fetch requests
    const requests = db.prepare(
      `SELECT lr.*, lt.name AS leave_type_name, lt.code AS leave_type_code
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       ${where}
       ORDER BY lr.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset);

    // Attach approval steps summary for each
    const stepsStmt = db.prepare(
      `SELECT s.step_order, s.step_type, s.status, e.name AS assignee_name
       FROM approval_steps s
       LEFT JOIN employees e ON s.assigned_to = e.id
       WHERE s.request_id = ?
       ORDER BY s.step_order`
    );

    const data = requests.map(r => {
      const steps = stepsStmt.all(r.id);
      const currentStepIdx = steps.findIndex(s => s.status === 'pending');

      return {
        id: r.id,
        leaveTypeName: r.leave_type_name,
        leaveTypeCode: r.leave_type_code,
        startDate: r.start_date,
        endDate: r.end_date,
        halfDayType: r.half_day_type,
        totalDays: r.total_days,
        status: r.status,
        isUrgent: r.is_urgent,
        isRetroactive: r.is_retroactive,
        parentRequestId: r.parent_request_id,
        createdAt: r.created_at,
        approvalSteps: steps.map(s => ({
          stepType: s.step_type,
          status: s.status,
          assigneeName: s.assignee_name
        })),
        currentStep: currentStepIdx >= 0 ? currentStepIdx : steps.length - 1
      };
    });

    res.json({
      success: true,
      data: {
        requests: data,
        pagination: {
          page: pageNum,
          pageSize: limitNum,
          total: countRow.cnt,
          totalPages: Math.ceil(countRow.cnt / limitNum)
        }
      }
    });
  } catch (err) {
    console.error('Error fetching leaves:', err);
    res.status(500).json({ success: false, error: '휴가 목록 조회 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// GET /api/leaves/team-status — Team leave status
// (Must be before /:id to avoid route conflict)
// ============================================================
router.get('/team-status', authenticateToken, requireRole('team_lead', 'director', 'hr_admin'), (req, res) => {
  try {
    const db = getDatabase();
    const today = new Date().toISOString().slice(0, 10);

    let deptFilter = '';
    const params = [today, today];

    if (req.user.role === 'team_lead') {
      deptFilter = 'AND e.department_id = ?';
      params.push(req.user.departmentId);
    }

    const leaves = db.prepare(
      `SELECT lr.id, lr.start_date, lr.end_date, lr.total_days, lr.half_day_type,
              lr.status, lt.name AS leave_type_name,
              e.name AS employee_name, e.employee_number,
              d.name AS department_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE lr.status = 'approved'
         AND lr.start_date <= ? AND lr.end_date >= ?
         ${deptFilter}
       ORDER BY lr.start_date`
    ).all(...params);

    res.json({
      success: true,
      data: {
        leaves: leaves.map(l => ({
          id: l.id,
          employeeName: l.employee_name,
          employeeNumber: l.employee_number,
          departmentName: l.department_name,
          leaveTypeName: l.leave_type_name,
          startDate: l.start_date,
          endDate: l.end_date,
          totalDays: l.total_days,
          halfDayType: l.half_day_type,
          status: l.status,
        }))
      }
    });
  } catch (err) {
    console.error('Error fetching team status:', err);
    res.status(500).json({ success: false, error: '팀 현황 조회 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// GET /api/leaves/:id — Get leave request detail
// ============================================================
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const requestId = parseInt(req.params.id, 10);

    const request = db.prepare(
      `SELECT lr.*, lt.name AS leave_type_name, lt.code AS leave_type_code,
              lt.requires_attachment,
              cs.name AS condolence_subtype_name, cs.days AS condolence_days,
              e.name AS employee_name, e.employee_number, e.department_id,
              d.name AS department_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN condolence_subtypes cs ON lr.condolence_subtype_id = cs.id
       WHERE lr.id = ?`
    ).get(requestId);

    if (!request) {
      return res.status(404).json({ success: false, error: '휴가 신청 건을 찾을 수 없습니다.' });
    }

    // Access control: own request, or approver, or team_lead/director/hr_admin
    const isOwn = request.employee_id === req.user.id;
    const isManager = ['team_lead', 'director', 'hr_admin'].includes(req.user.role);

    if (!isOwn && !isManager) {
      // Check if the user is an approver for this request
      const isApprover = db.prepare(
        'SELECT id FROM approval_steps WHERE request_id = ? AND assigned_to = ?'
      ).get(requestId, req.user.id);

      if (!isApprover) {
        return res.status(403).json({ success: false, error: '열람 권한이 없습니다.' });
      }
    }

    // Get approval steps
    const steps = getApprovalStatus(requestId);

    // Get visibility departments
    const visibility = db.prepare(
      `SELECT v.department_id, d.name AS department_name
       FROM leave_request_visibility v
       JOIN departments d ON v.department_id = d.id
       WHERE v.request_id = ?`
    ).all(requestId);

    // Get parent request info if exists
    let parentRequest = null;
    if (request.parent_request_id) {
      parentRequest = db.prepare(
        `SELECT id, status, created_at FROM leave_requests WHERE id = ?`
      ).get(request.parent_request_id);
    }

    // Get child requests (redrafts/resubmits)
    const childRequests = db.prepare(
      `SELECT id, status, created_at FROM leave_requests WHERE parent_request_id = ? ORDER BY created_at DESC`
    ).all(requestId);

    res.json({
      success: true,
      data: {
        request: {
          id: request.id,
          employeeId: request.employee_id,
          employeeName: request.employee_name,
          employeeNumber: request.employee_number,
          departmentName: request.department_name,
          leaveTypeId: request.leave_type_id,
          leaveTypeName: request.leave_type_name,
          leaveTypeCode: request.leave_type_code,
          requiresAttachment: request.requires_attachment,
          condolenceSubtypeId: request.condolence_subtype_id,
          condolenceSubtypeName: request.condolence_subtype_name,
          condolenceDays: request.condolence_days,
          startDate: request.start_date,
          endDate: request.end_date,
          halfDayType: request.half_day_type,
          timeStart: request.time_start,
          timeEnd: request.time_end,
          totalDays: request.total_days,
          reason: request.reason,
          isUrgent: request.is_urgent,
          urgentReason: request.urgent_reason,
          isRetroactive: request.is_retroactive,
          retroactiveCategory: request.retroactive_category,
          retroactiveDetail: request.retroactive_detail,
          status: request.status,
          parentRequestId: request.parent_request_id,
          recallReason: request.recall_reason,
          createdAt: request.created_at,
        },
        approvalSteps: steps.map(s => ({
          id: s.id,
          stepOrder: s.step_order,
          stepType: s.step_type,
          assignedTo: s.assigned_to,
          assignedName: s.assigned_name,
          actedBy: s.acted_by,
          actedByName: s.acted_by_name,
          isDelegated: s.is_delegated,
          status: s.status,
          approverPosition: s.approver_position,
          approverDeptName: s.approver_dept_name,
          comment: s.comment,
          readAt: s.read_at,
          actedAt: s.acted_at,
          createdAt: s.created_at,
        })),
        visibility: visibility.map(v => ({
          departmentId: v.department_id,
          departmentName: v.department_name,
        })),
        parentRequest,
        childRequests,
      }
    });
  } catch (err) {
    console.error('Error fetching leave detail:', err);
    res.status(500).json({ success: false, error: '휴가 상세 조회 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// POST /api/leaves — Create new leave request
// ============================================================
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const {
      leaveTypeId,
      condolenceSubtypeId,
      startDate,
      endDate,
      halfDayType,
      timeStart,
      timeEnd,
      reason,
      isUrgent,
      urgentReason,
      isRetroactive,
      retroactiveCategory,
      retroactiveDetail,
      visibilityDepartmentIds,
      parentRequestId,
    } = req.body;

    // Foundation cannot apply for leave
    if (req.user.role === 'foundation') {
      return res.status(403).json({ success: false, error: '재단 담당자는 휴가 신청이 불가합니다.' });
    }

    // Basic validation
    if (!leaveTypeId || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: '휴가 유형, 시작일, 종료일은 필수입니다.' });
    }

    // Get employee info
    const employee = db.prepare(
      'SELECT * FROM employees WHERE id = ? AND status = ?'
    ).get(req.user.id, 'active');

    if (!employee) {
      return res.status(404).json({ success: false, error: '직원 정보를 찾을 수 없습니다.' });
    }

    // Get leave type
    const leaveType = db.prepare(
      'SELECT * FROM leave_types WHERE id = ?'
    ).get(leaveTypeId);

    if (!leaveType) {
      return res.status(400).json({ success: false, error: '유효하지 않은 휴가 유형입니다.' });
    }

    // 1. Gender check
    if (leaveType.gender_restriction && leaveType.gender_restriction !== employee.gender) {
      return res.status(400).json({ success: false, error: '성별 제한으로 해당 휴가를 신청할 수 없습니다.' });
    }

    // 2. Employment type check
    const empMapping = db.prepare(
      'SELECT is_allowed FROM employment_type_leave_mapping WHERE employment_type = ? AND leave_type_id = ?'
    ).get(employee.employment_type, leaveTypeId);

    if (empMapping && !empMapping.is_allowed) {
      return res.status(400).json({ success: false, error: '고용 형태에 따라 해당 휴가를 신청할 수 없습니다.' });
    }

    // 3. Condolence subtype check
    let condolenceDays = null;
    if (leaveType.code === 'CONDOLENCE') {
      if (!condolenceSubtypeId) {
        return res.status(400).json({ success: false, error: '경조사 세부 유형을 선택해 주세요.' });
      }
      const subtype = db.prepare(
        'SELECT * FROM condolence_subtypes WHERE id = ? AND leave_type_id = ?'
      ).get(condolenceSubtypeId, leaveTypeId);

      if (!subtype) {
        return res.status(400).json({ success: false, error: '유효하지 않은 경조사 세부 유형입니다.' });
      }
      condolenceDays = subtype.days;
    }

    // 4. Calculate total_days
    let totalDays;
    if (leaveType.code === 'CONDOLENCE' && condolenceDays != null) {
      totalDays = condolenceDays;
    } else {
      totalDays = calculateTotalDays(startDate, endDate, halfDayType || null, timeStart, timeEnd);
    }

    if (totalDays <= 0) {
      return res.status(400).json({ success: false, error: '신청 일수가 0일 이하입니다. 날짜를 확인해 주세요.' });
    }

    // 5. Retroactive check
    const today = new Date().toISOString().slice(0, 10);
    const isRetro = startDate < today;

    if (isRetro) {
      // Check if leave type allows retroactive
      if (!leaveType.allows_retroactive) {
        return res.status(400).json({
          success: false,
          error: `${leaveType.name}은(는) 사후 신청이 불가능합니다.`
        });
      }

      if (!retroactiveCategory) {
        return res.status(400).json({ success: false, error: '사후 신청 사유를 선택해 주세요.' });
      }
    }

    // 6. Balance check for ANNUAL leave
    if (leaveType.code === 'ANNUAL') {
      const year = parseInt(startDate.substring(0, 4), 10);
      const balance = ensureBalance(req.user.id, year);
      if (balance) {
        const remaining = balance.total_days + balance.adjusted_days - balance.used_days;
        if (remaining < totalDays) {
          return res.status(400).json({
            success: false,
            error: `연차 잔여일수가 부족합니다. (잔여: ${remaining}일, 신청: ${totalDays}일)`
          });
        }
      }
    }

    // 7. Urgent check
    if (isUrgent && !urgentReason) {
      // Allow empty urgent reason (but it's recommended)
    }

    // Create the request in a transaction
    const result = db.transaction(() => {
      const insertResult = db.prepare(
        `INSERT INTO leave_requests (
          employee_id, leave_type_id, condolence_subtype_id,
          start_date, end_date, half_day_type, time_start, time_end,
          total_days, reason, is_urgent, urgent_reason,
          is_retroactive, retroactive_category, retroactive_detail,
          status, parent_request_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).run(
        req.user.id,
        leaveTypeId,
        condolenceSubtypeId || null,
        startDate,
        endDate,
        halfDayType || null,
        timeStart || null,
        timeEnd || null,
        totalDays,
        reason || null,
        isUrgent ? 1 : 0,
        urgentReason || null,
        isRetro ? 1 : 0,
        isRetro ? retroactiveCategory : null,
        isRetro ? retroactiveDetail || null : null,
        parentRequestId || null
      );

      const requestId = insertResult.lastInsertRowid;

      // Insert visibility
      const deptIds = visibilityDepartmentIds || [employee.department_id];
      const visInsert = db.prepare(
        'INSERT OR IGNORE INTO leave_request_visibility (request_id, department_id) VALUES (?, ?)'
      );
      for (const deptId of deptIds) {
        visInsert.run(requestId, deptId);
      }

      // Create approval steps
      const steps = createApprovalSteps(requestId, req.user.id);

      return { requestId, steps };
    })();

    // If urgent, notify all approvers
    if (isUrgent) {
      try {
        const approverSteps = db.prepare(
          `SELECT assigned_to FROM approval_steps
           WHERE request_id = ? AND step_type != 'draft' AND status = 'pending'`
        ).all(result.requestId);

        for (const s of approverSteps) {
          notify(s.assigned_to, 'urgent', { requestId: result.requestId });
        }
      } catch (e) { /* ignore */ }
    }

    res.status(201).json({
      success: true,
      data: {
        requestId: result.requestId,
        message: '휴가 신청이 완료되었습니다.'
      }
    });
  } catch (err) {
    console.error('Error creating leave request:', err);
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: '휴가 신청 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// POST /api/leaves/:id/cancel — Cancel leave request
// ============================================================
router.post('/:id/cancel', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const requestId = parseInt(req.params.id, 10);

    const request = db.prepare(
      `SELECT lr.*, lt.code AS leave_type_code
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.id = ?`
    ).get(requestId);

    if (!request) {
      return res.status(404).json({ success: false, error: '휴가 신청 건을 찾을 수 없습니다.' });
    }

    if (request.employee_id !== req.user.id) {
      return res.status(403).json({ success: false, error: '본인의 신청만 취소할 수 있습니다.' });
    }

    if (['recalled', 'rejected', 'cancelled'].includes(request.status)) {
      return res.status(400).json({ success: false, error: '이미 처리된 신청은 취소할 수 없습니다.' });
    }

    const result = db.transaction(() => {
      // If approved, restore balance
      if (request.status === 'approved' &&
          (request.leave_type_code === 'ANNUAL' || request.leave_type_code === 'REWARD')) {
        const year = parseInt(request.start_date.substring(0, 4), 10);
        db.prepare(
          `UPDATE leave_balances SET used_days = MAX(0, used_days - ?)
           WHERE employee_id = ? AND year = ?`
        ).run(request.total_days, request.employee_id, year);
      }

      db.prepare(
        `UPDATE leave_requests SET status = 'cancelled' WHERE id = ?`
      ).run(requestId);

      return true;
    })();

    // Notify related approvers
    try {
      const approvers = db.prepare(
        `SELECT DISTINCT assigned_to FROM approval_steps
         WHERE request_id = ? AND step_type != 'draft'`
      ).all(requestId);
      for (const a of approvers) {
        notify(a.assigned_to, 'cancelled', { requestId });
      }
    } catch (e) { /* ignore */ }

    res.json({ success: true, data: { message: '휴가 신청이 취소되었습니다.' } });
  } catch (err) {
    console.error('Error cancelling leave:', err);
    res.status(500).json({ success: false, error: '휴가 취소 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// POST /api/leaves/:id/recall — Recall pending request
// ============================================================
router.post('/:id/recall', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const requestId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    const request = db.prepare(
      'SELECT * FROM leave_requests WHERE id = ?'
    ).get(requestId);

    if (!request) {
      return res.status(404).json({ success: false, error: '휴가 신청 건을 찾을 수 없습니다.' });
    }

    if (request.employee_id !== req.user.id) {
      return res.status(403).json({ success: false, error: '본인의 신청만 회수할 수 있습니다.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, error: '승인대기 상태의 신청만 회수할 수 있습니다.' });
    }

    db.transaction(() => {
      // Update request status
      db.prepare(
        `UPDATE leave_requests SET status = 'recalled', recall_reason = ? WHERE id = ?`
      ).run(reason || null, requestId);

      // Mark pending approval steps — update pending steps (they haven't been acted on yet)
      db.prepare(
        `UPDATE approval_steps SET status = 'rejected', comment = '신청자 회수'
         WHERE request_id = ? AND status = 'pending'`
      ).run(requestId);
    })();

    // Notify approvers
    try {
      const approvers = db.prepare(
        `SELECT DISTINCT assigned_to FROM approval_steps
         WHERE request_id = ? AND step_type != 'draft'`
      ).all(requestId);
      for (const a of approvers) {
        notify(a.assigned_to, 'recalled', { requestId });
      }
    } catch (e) { /* ignore */ }

    res.json({ success: true, data: { message: '휴가 신청이 회수되었습니다.' } });
  } catch (err) {
    console.error('Error recalling leave:', err);
    res.status(500).json({ success: false, error: '휴가 회수 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// POST /api/leaves/:id/redraft — Redraft from recalled/rejected
// ============================================================
router.post('/:id/redraft', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const requestId = parseInt(req.params.id, 10);

    const original = db.prepare(
      `SELECT lr.*, lt.code AS leave_type_code
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.id = ?`
    ).get(requestId);

    if (!original) {
      return res.status(404).json({ success: false, error: '원본 신청 건을 찾을 수 없습니다.' });
    }

    if (original.employee_id !== req.user.id) {
      return res.status(403).json({ success: false, error: '본인의 신청만 재기안할 수 있습니다.' });
    }

    if (!['recalled', 'rejected'].includes(original.status)) {
      return res.status(400).json({ success: false, error: '회수 또는 반려된 신청만 재기안할 수 있습니다.' });
    }

    // Get overrides from body (if any)
    const overrides = req.body || {};

    const leaveTypeId = overrides.leaveTypeId || original.leave_type_id;
    const condolenceSubtypeId = overrides.condolenceSubtypeId || original.condolence_subtype_id;
    const startDate = overrides.startDate || original.start_date;
    const endDate = overrides.endDate || original.end_date;
    const halfDayType = overrides.halfDayType !== undefined ? overrides.halfDayType : original.half_day_type;
    const timeStart = overrides.timeStart !== undefined ? overrides.timeStart : original.time_start;
    const timeEnd = overrides.timeEnd !== undefined ? overrides.timeEnd : original.time_end;
    const reason = overrides.reason !== undefined ? overrides.reason : original.reason;
    const isUrgent = overrides.isUrgent !== undefined ? overrides.isUrgent : original.is_urgent;
    const urgentReason = overrides.urgentReason !== undefined ? overrides.urgentReason : original.urgent_reason;
    const isRetroactive = overrides.isRetroactive !== undefined ? overrides.isRetroactive : original.is_retroactive;
    const retroactiveCategory = overrides.retroactiveCategory !== undefined ? overrides.retroactiveCategory : original.retroactive_category;
    const retroactiveDetail = overrides.retroactiveDetail !== undefined ? overrides.retroactiveDetail : original.retroactive_detail;
    const visibilityDepartmentIds = overrides.visibilityDepartmentIds;

    // Get leave type for condolence days
    const leaveType = db.prepare('SELECT * FROM leave_types WHERE id = ?').get(leaveTypeId);
    let totalDays;

    if (leaveType && leaveType.code === 'CONDOLENCE' && condolenceSubtypeId) {
      const subtype = db.prepare('SELECT days FROM condolence_subtypes WHERE id = ?').get(condolenceSubtypeId);
      totalDays = subtype ? subtype.days : calculateTotalDays(startDate, endDate, halfDayType, timeStart, timeEnd);
    } else {
      totalDays = calculateTotalDays(startDate, endDate, halfDayType, timeStart, timeEnd);
    }

    // Balance check for ANNUAL
    if (leaveType && leaveType.code === 'ANNUAL') {
      const year = parseInt(startDate.substring(0, 4), 10);
      const balance = ensureBalance(req.user.id, year);
      if (balance) {
        const remaining = balance.total_days + balance.adjusted_days - balance.used_days;
        if (remaining < totalDays) {
          return res.status(400).json({
            success: false,
            error: `연차 잔여일수가 부족합니다. (잔여: ${remaining}일, 신청: ${totalDays}일)`
          });
        }
      }
    }

    const result = db.transaction(() => {
      const insertResult = db.prepare(
        `INSERT INTO leave_requests (
          employee_id, leave_type_id, condolence_subtype_id,
          start_date, end_date, half_day_type, time_start, time_end,
          total_days, reason, is_urgent, urgent_reason,
          is_retroactive, retroactive_category, retroactive_detail,
          status, parent_request_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).run(
        req.user.id,
        leaveTypeId,
        condolenceSubtypeId || null,
        startDate,
        endDate,
        halfDayType || null,
        timeStart || null,
        timeEnd || null,
        totalDays,
        reason || null,
        isUrgent ? 1 : 0,
        urgentReason || null,
        isRetroactive ? 1 : 0,
        retroactiveCategory || null,
        retroactiveDetail || null,
        requestId // parent_request_id = original request
      );

      const newId = insertResult.lastInsertRowid;

      // Insert visibility
      if (visibilityDepartmentIds && visibilityDepartmentIds.length > 0) {
        const visInsert = db.prepare(
          'INSERT OR IGNORE INTO leave_request_visibility (request_id, department_id) VALUES (?, ?)'
        );
        for (const deptId of visibilityDepartmentIds) {
          visInsert.run(newId, deptId);
        }
      } else {
        // Copy visibility from original
        const origVis = db.prepare(
          'SELECT department_id FROM leave_request_visibility WHERE request_id = ?'
        ).all(requestId);
        const visInsert = db.prepare(
          'INSERT OR IGNORE INTO leave_request_visibility (request_id, department_id) VALUES (?, ?)'
        );
        for (const v of origVis) {
          visInsert.run(newId, v.department_id);
        }
        // If no original visibility, use own department
        if (origVis.length === 0) {
          visInsert.run(newId, req.user.departmentId);
        }
      }

      // Create approval steps
      const steps = createApprovalSteps(newId, req.user.id);

      return { requestId: newId, steps };
    })();

    res.status(201).json({
      success: true,
      data: {
        requestId: result.requestId,
        message: '재기안이 완료되었습니다.'
      }
    });
  } catch (err) {
    console.error('Error redrafting leave:', err);
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: '재기안 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
