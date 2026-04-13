const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../database/connection');

/**
 * Ensure leave_balances row exists for employee+year, auto-creating if missing.
 */
function ensureBalance(employeeId, year) {
  const db = getDatabase();
  let balance = db.prepare('SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?').get(employeeId, year);
  if (!balance) {
    let calculateAnnualLeave;
    try {
      calculateAnnualLeave = require('../services/leaveCalculator').calculateAnnualLeave;
    } catch {
      // leaveCalculator not available yet — return default
      return { total_days: 15, used_days: 0, adjusted_days: 0, calc_detail: null };
    }
    const emp = db.prepare('SELECT hire_date FROM employees WHERE id = ?').get(employeeId);
    if (!emp) return null;
    const { totalDays, calcDetail } = calculateAnnualLeave(emp.hire_date, year);
    db.prepare(
      'INSERT INTO leave_balances (employee_id, year, total_days, used_days, adjusted_days, calc_detail) VALUES (?, ?, ?, 0, 0, ?)'
    ).run(employeeId, year, totalDays, JSON.stringify(calcDetail));
    balance = db.prepare('SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?').get(employeeId, year);
  }
  return balance;
}

// ──────────────────────────────────────────────
// GET /api/dashboard/staff
// ──────────────────────────────────────────────
router.get('/staff', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const currentYear = new Date().getFullYear();

    // 1. Balance
    const balance = ensureBalance(userId, currentYear);
    const totalDays = balance ? balance.total_days : 0;
    const usedDays = balance ? balance.used_days : 0;
    const adjustedDays = balance ? balance.adjusted_days : 0;
    const remainingDays = totalDays - usedDays + adjustedDays;

    // 2. Calculation detail
    let calcDetail = null;
    if (balance && balance.calc_detail) {
      try {
        calcDetail = JSON.parse(balance.calc_detail);
      } catch {
        calcDetail = null;
      }
    }

    // 3. Recent requests (last 5)
    const recentRequests = db.prepare(`
      SELECT lr.id, lr.start_date, lr.end_date, lr.total_days, lr.status, lr.created_at,
             lt.name AS leave_type_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.employee_id = ?
      ORDER BY lr.created_at DESC
      LIMIT 5
    `).all(userId);

    // 4. Pending count
    const pendingRow = db.prepare(
      "SELECT COUNT(*) AS cnt FROM leave_requests WHERE employee_id = ? AND status = 'pending'"
    ).get(userId);
    const pendingCount = pendingRow ? pendingRow.cnt : 0;

    // 5. Guide card
    const emp = db.prepare('SELECT is_initial_password FROM employees WHERE id = ?').get(userId);
    const guideCards = [];
    if (emp && emp.is_initial_password) {
      guideCards.push({ show: true, message: '초기 비밀번호를 변경해 주세요.', type: 'password' });
    }
    if (pendingCount > 0) {
      guideCards.push({ show: true, message: `승인 대기 중인 신청이 ${pendingCount}건 있습니다.`, type: 'pending' });
    }

    res.json({
      success: true,
      data: {
        balance: { totalDays, usedDays, adjustedDays, remainingDays },
        calcDetail,
        recentRequests,
        pendingCount,
        guideCards
      }
    });
  } catch (err) {
    console.error('Dashboard staff error:', err);
    res.status(500).json({ success: false, error: '대시보드 데이터를 불러오는 중 오류가 발생했습니다.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/dashboard/team-lead
// ──────────────────────────────────────────────
router.get('/team-lead', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const departmentId = req.user.departmentId;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // 1. Team attendance
    const totalRow = db.prepare(
      "SELECT COUNT(*) AS cnt FROM employees WHERE department_id = ? AND status = 'active'"
    ).get(departmentId);
    const total = totalRow ? totalRow.cnt : 0;

    const absentRow = db.prepare(
      "SELECT COUNT(*) AS cnt FROM employees WHERE department_id = ? AND status = 'active' AND is_absent = 1"
    ).get(departmentId);
    const absent = absentRow ? absentRow.cnt : 0;

    const onLeaveRow = db.prepare(`
      SELECT COUNT(DISTINCT lr.employee_id) AS cnt
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.department_id = ? AND lr.status = 'approved'
        AND lr.start_date <= ? AND lr.end_date >= ?
    `).get(departmentId, todayStr, todayStr);
    const onLeave = onLeaveRow ? onLeaveRow.cnt : 0;

    const present = total - absent - onLeave;

    // 2. Pending approvals count
    const pendingRow = db.prepare(
      "SELECT COUNT(*) AS cnt FROM approval_steps WHERE assigned_to = ? AND status = 'pending'"
    ).get(userId);
    const pendingApprovals = pendingRow ? pendingRow.cnt : 0;

    // 3. Recent team requests
    const recentRequests = db.prepare(`
      SELECT lr.id, lr.start_date, lr.end_date, lr.total_days, lr.status, lr.created_at,
             lt.name AS leave_type_name, e.name AS employee_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.department_id = ?
      ORDER BY lr.created_at DESC
      LIMIT 10
    `).all(departmentId);

    // 4. Upcoming leaves (next 7 days)
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysStr = sevenDaysLater.toISOString().slice(0, 10);

    const upcomingLeaves = db.prepare(`
      SELECT lr.id, lr.start_date, lr.end_date, lr.total_days,
             lt.name AS leave_type_name, e.name AS employee_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.department_id = ? AND lr.status = 'approved'
        AND lr.start_date <= ? AND lr.end_date >= ?
      ORDER BY lr.start_date ASC
    `).all(departmentId, sevenDaysStr, todayStr);

    // 5. Calendar events for this month
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;

    const calendarEvents = db.prepare(`
      SELECT lr.id, lr.start_date, lr.end_date,
             lt.name AS leave_type_name, lt.code AS leave_type_code,
             e.name AS employee_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.department_id = ? AND lr.status = 'approved'
        AND lr.start_date <= ? AND lr.end_date >= ?
      ORDER BY lr.start_date ASC
    `).all(departmentId, monthEnd, monthStart);

    res.json({
      success: true,
      data: {
        teamAttendance: { total, present: Math.max(0, present), absent, onLeave },
        pendingApprovals,
        recentRequests,
        upcomingLeaves,
        calendarEvents
      }
    });
  } catch (err) {
    console.error('Dashboard team-lead error:', err);
    res.status(500).json({ success: false, error: '대시보드 데이터를 불러오는 중 오류가 발생했습니다.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/dashboard/director
// ──────────────────────────────────────────────
router.get('/director', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // 1. Pending approvals assigned to me
    const pendingApprovals = db.prepare(`
      SELECT ast.id AS step_id, ast.request_id, ast.created_at AS step_created_at,
             lr.start_date, lr.end_date, lr.total_days, lr.is_urgent,
             lt.name AS leave_type_name,
             e.name AS applicant_name, e.position AS applicant_position
      FROM approval_steps ast
      JOIN leave_requests lr ON ast.request_id = lr.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      WHERE ast.assigned_to = ? AND ast.status = 'pending'
      ORDER BY ast.created_at ASC
    `).all(userId);

    // Calculate days waiting for each
    const pendingWithDays = pendingApprovals.map(item => {
      const createdDate = new Date(item.step_created_at);
      const diffMs = today - createdDate;
      const daysWaiting = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return { ...item, daysWaiting };
    });

    const pendingCount = pendingWithDays.length;
    const overdueCount = pendingWithDays.filter(p => p.daysWaiting >= 7).length;

    // 2. Attendance rate (organization-wide)
    const totalActiveRow = db.prepare(
      "SELECT COUNT(*) AS cnt FROM employees WHERE status = 'active'"
    ).get();
    const totalActive = totalActiveRow ? totalActiveRow.cnt : 0;

    const onLeaveRow = db.prepare(`
      SELECT COUNT(DISTINCT lr.employee_id) AS cnt
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.status = 'active' AND lr.status = 'approved'
        AND lr.start_date <= ? AND lr.end_date >= ?
    `).get(todayStr, todayStr);
    const onLeaveCount = onLeaveRow ? onLeaveRow.cnt : 0;

    const absentRow = db.prepare(
      "SELECT COUNT(*) AS cnt FROM employees WHERE status = 'active' AND is_absent = 1"
    ).get();
    const absentCount = absentRow ? absentRow.cnt : 0;

    const attendingCount = Math.max(0, totalActive - onLeaveCount - absentCount);
    const attendanceRate = totalActive > 0 ? Math.round((attendingCount / totalActive) * 100) : 0;

    // 3. Recent decisions (my last 5 approval actions)
    const recentDecisions = db.prepare(`
      SELECT ast.id AS step_id, ast.request_id, ast.status AS decision, ast.acted_at, ast.comment,
             lr.start_date, lr.end_date, lr.total_days,
             lt.name AS leave_type_name,
             e.name AS applicant_name
      FROM approval_steps ast
      JOIN leave_requests lr ON ast.request_id = lr.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      WHERE ast.acted_by = ? AND ast.status IN ('approved', 'rejected')
      ORDER BY ast.acted_at DESC
      LIMIT 5
    `).all(userId);

    res.json({
      success: true,
      data: {
        todoSummary: { pendingCount, overdueCount },
        pendingApprovals: pendingWithDays,
        attendanceRate,
        totalActive,
        attendingCount,
        recentDecisions
      }
    });
  } catch (err) {
    console.error('Dashboard director error:', err);
    res.status(500).json({ success: false, error: '대시보드 데이터를 불러오는 중 오류가 발생했습니다.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/dashboard/hr
// ──────────────────────────────────────────────
router.get('/hr', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const currentYear = new Date().getFullYear();

    // 1. System summary
    const totalEmpRow = db.prepare("SELECT COUNT(*) AS cnt FROM employees").get();
    const activeEmpRow = db.prepare("SELECT COUNT(*) AS cnt FROM employees WHERE status = 'active'").get();
    const deptRow = db.prepare("SELECT COUNT(*) AS cnt FROM departments").get();
    const leaveTypeRow = db.prepare("SELECT COUNT(*) AS cnt FROM leave_types").get();

    // 2. Recent employee changes (last 10)
    const recentChanges = db.prepare(`
      SELECT id, name, employee_number, status, hire_date, resignation_date, created_at, updated_at
      FROM employees
      ORDER BY updated_at DESC
      LIMIT 10
    `).all();

    // 3. Balance alerts: employees with remaining < 3 days
    const balanceAlerts = db.prepare(`
      SELECT lb.employee_id, lb.total_days, lb.used_days, lb.adjusted_days,
             (lb.total_days - lb.used_days + lb.adjusted_days) AS remaining_days,
             e.name AS employee_name, e.employee_number, d.name AS department_name
      FROM leave_balances lb
      JOIN employees e ON lb.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE lb.year = ? AND e.status = 'active'
        AND (lb.total_days - lb.used_days + lb.adjusted_days) < 3
        AND (lb.total_days - lb.used_days + lb.adjusted_days) >= 0
      ORDER BY remaining_days ASC
    `).all(currentYear);

    // 4. Settings quick links
    const settingsQuickLinks = [
      { label: '직원 관리', path: '/admin?tab=employees', icon: 'Users' },
      { label: '휴가 유형', path: '/admin?tab=leaveTypes', icon: 'Calendar' },
      { label: '결재 라인', path: '/admin?tab=approvalFlows', icon: 'GitBranch' },
      { label: '대결자 관리', path: '/admin?tab=delegates', icon: 'UserCheck' },
      { label: '휴일 관리', path: '/admin?tab=holidays', icon: 'CalendarDays' },
      { label: '시스템 설정', path: '/admin?tab=settings', icon: 'Settings' },
      { label: '잔여일수 관리', path: '/admin?tab=balances', icon: 'Building2' },
    ];

    res.json({
      success: true,
      data: {
        systemSummary: {
          totalEmployees: totalEmpRow ? totalEmpRow.cnt : 0,
          activeEmployees: activeEmpRow ? activeEmpRow.cnt : 0,
          departmentCount: deptRow ? deptRow.cnt : 0,
          leaveTypesCount: leaveTypeRow ? leaveTypeRow.cnt : 0
        },
        recentChanges,
        balanceAlerts,
        settingsQuickLinks
      }
    });
  } catch (err) {
    console.error('Dashboard HR error:', err);
    res.status(500).json({ success: false, error: '대시보드 데이터를 불러오는 중 오류가 발생했습니다.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/dashboard/foundation
// ──────────────────────────────────────────────
router.get('/foundation', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const currentYear = today.getFullYear();

    // 1. Facility overview
    const totalStaffRow = db.prepare("SELECT COUNT(*) AS cnt FROM employees WHERE status = 'active'").get();
    const totalStaff = totalStaffRow ? totalStaffRow.cnt : 0;

    const currentAbsentRow = db.prepare(
      "SELECT COUNT(*) AS cnt FROM employees WHERE status = 'active' AND is_absent = 1"
    ).get();
    const currentAbsent = currentAbsentRow ? currentAbsentRow.cnt : 0;

    const onLeaveRow = db.prepare(`
      SELECT COUNT(DISTINCT lr.employee_id) AS cnt
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.status = 'active' AND lr.status = 'approved'
        AND lr.start_date <= ? AND lr.end_date >= ?
    `).get(todayStr, todayStr);
    const onLeave = onLeaveRow ? onLeaveRow.cnt : 0;

    const attending = Math.max(0, totalStaff - currentAbsent - onLeave);
    const attendanceRate = totalStaff > 0 ? Math.round((attending / totalStaff) * 100) : 0;

    // 2. Department usage
    const departmentUsage = db.prepare(`
      SELECT d.id AS department_id, d.name AS department_name,
             COALESCE(SUM(lb.total_days), 0) AS total_days,
             COALESCE(SUM(lb.used_days), 0) AS used_days,
             CASE WHEN COALESCE(SUM(lb.total_days), 0) > 0
               THEN ROUND(COALESCE(SUM(lb.used_days), 0) * 100.0 / SUM(lb.total_days), 1)
               ELSE 0 END AS usage_rate
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
      LEFT JOIN leave_balances lb ON e.id = lb.employee_id AND lb.year = ?
      GROUP BY d.id, d.name
      ORDER BY d.name
    `).all(currentYear);

    // 3. Access banner
    const accessBanner = {
      message: '열람 권한으로 접근하고 있습니다. 데이터 수정 권한이 없습니다.'
    };

    // 4. Recent exports
    const recentExports = db.prepare(`
      SELECT el.id, el.export_type, el.date_from, el.date_to, el.verification_code, el.created_at,
             e.name AS exported_by_name
      FROM export_logs el
      JOIN employees e ON el.exported_by = e.id
      ORDER BY el.created_at DESC
      LIMIT 10
    `).all();

    res.json({
      success: true,
      data: {
        facilityOverview: { totalStaff, currentAbsent, onLeave, attendanceRate },
        departmentUsage,
        accessBanner,
        recentExports
      }
    });
  } catch (err) {
    console.error('Dashboard foundation error:', err);
    res.status(500).json({ success: false, error: '대시보드 데이터를 불러오는 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
