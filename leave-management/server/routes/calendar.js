const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================================
// GET /api/calendar/team — 팀 캘린더 (열람 범위 기반 필터링)
// ============================================================
router.get('/team', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const { year, month } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userDeptId = req.user.departmentId;

    // 날짜 범위 결정
    const y = parseInt(year, 10) || new Date().getFullYear();
    const m = parseInt(month, 10) || (new Date().getMonth() + 1);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let leaves;

    if (['team_lead', 'director', 'hr_admin'].includes(userRole)) {
      // 팀장/원장/HR: 권한으로 전체 열람 가능
      let query = `
        SELECT lr.id, lr.employee_id, lr.start_date, lr.end_date, lr.total_days,
               lr.half_day_type, lr.status,
               e.name AS employee_name, e.department_id,
               d.name AS department_name,
               lt.name AS leave_type_name, lt.code AS leave_type_code
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN departments d ON e.department_id = d.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.status = 'approved'
          AND lr.start_date <= ? AND lr.end_date >= ?
      `;
      const params = [endDate, startDate];

      // 팀장: 자기 팀만 (team_lead_view_scope 설정에 따라)
      if (userRole === 'team_lead') {
        const scope = db.prepare("SELECT value FROM system_settings WHERE key = 'team_lead_view_scope'").get();
        if (!scope || scope.value === 'own_team') {
          query += ' AND e.department_id = ?';
          params.push(userDeptId);
        }
      }

      query += ' ORDER BY lr.start_date';
      leaves = db.prepare(query).all(...params);
    } else {
      // 일반 직원: 열람 범위 기반 필터링 (leave_request_visibility)
      leaves = db.prepare(`
        SELECT lr.id, lr.employee_id, lr.start_date, lr.end_date, lr.total_days,
               lr.half_day_type, lr.status,
               e.name AS employee_name, e.department_id,
               d.name AS department_name,
               lt.name AS leave_type_name, lt.code AS leave_type_code
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN departments d ON e.department_id = d.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        JOIN leave_request_visibility v ON lr.id = v.request_id
        WHERE lr.status = 'approved'
          AND lr.start_date <= ? AND lr.end_date >= ?
          AND v.department_id = ?
        ORDER BY lr.start_date
      `).all(endDate, startDate, userDeptId);
    }

    // 공휴일 조회
    const holidays = db.prepare(
      'SELECT date, name FROM holidays WHERE year = ? ORDER BY date'
    ).all(y);

    // 캘린더 이벤트 변환 (이름 + 유형 + 기간만, 사유 비공개)
    const events = leaves.map(l => ({
      id: l.id,
      employeeName: l.employee_name,
      departmentName: l.department_name,
      leaveType: l.leave_type_name,
      leaveTypeCode: l.leave_type_code,
      startDate: l.start_date,
      endDate: l.end_date,
      totalDays: l.total_days,
      halfDayType: l.half_day_type
    }));

    res.json({
      success: true,
      data: {
        year: y,
        month: m,
        events,
        holidays: holidays.map(h => ({ date: h.date, name: h.name }))
      }
    });
  } catch (err) {
    console.error('Error fetching team calendar:', err);
    res.status(500).json({ success: false, error: '팀 캘린더 조회 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// GET /api/calendar/me — 내 캘린더
// ============================================================
router.get('/me', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const { year, month } = req.query;
    const userId = req.user.id;

    const y = parseInt(year, 10) || new Date().getFullYear();
    const m = parseInt(month, 10) || (new Date().getMonth() + 1);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const leaves = db.prepare(`
      SELECT lr.id, lr.start_date, lr.end_date, lr.total_days,
             lr.half_day_type, lr.status,
             lt.name AS leave_type_name, lt.code AS leave_type_code
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.employee_id = ?
        AND lr.status IN ('approved', 'pending')
        AND lr.start_date <= ? AND lr.end_date >= ?
      ORDER BY lr.start_date
    `).all(userId, endDate, startDate);

    const holidays = db.prepare(
      'SELECT date, name FROM holidays WHERE year = ? ORDER BY date'
    ).all(y);

    const events = leaves.map(l => ({
      id: l.id,
      leaveType: l.leave_type_name,
      leaveTypeCode: l.leave_type_code,
      startDate: l.start_date,
      endDate: l.end_date,
      totalDays: l.total_days,
      halfDayType: l.half_day_type,
      status: l.status
    }));

    res.json({
      success: true,
      data: {
        year: y,
        month: m,
        events,
        holidays: holidays.map(h => ({ date: h.date, name: h.name }))
      }
    });
  } catch (err) {
    console.error('Error fetching my calendar:', err);
    res.status(500).json({ success: false, error: '내 캘린더 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
