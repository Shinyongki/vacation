const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getDatabase } = require('../database/connection');
const { calculateAnnualLeave } = require('../services/leaveCalculator');

/**
 * Ensure a leave_balances record exists for the given employee and year.
 * If not, auto-calculate using leaveCalculator and insert.
 * Returns the balance row.
 */
function ensureBalance(employeeId, year) {
  const db = getDatabase();

  let balance = db.prepare(
    'SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?'
  ).get(employeeId, year);

  if (!balance) {
    // Look up employee hire_date
    const employee = db.prepare(
      'SELECT hire_date FROM employees WHERE id = ?'
    ).get(employeeId);

    if (!employee) {
      return null;
    }

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
 * GET /api/balances/me
 * Get current user's leave balance for current year (or ?year=XXXX)
 */
router.get('/me', authenticateToken, (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const balance = ensureBalance(req.user.id, year);

    if (!balance) {
      return res.status(404).json({
        success: false,
        error: '직원 정보를 찾을 수 없습니다.'
      });
    }

    let calcDetail = null;
    try {
      calcDetail = balance.calc_detail ? JSON.parse(balance.calc_detail) : null;
    } catch (e) {
      calcDetail = balance.calc_detail;
    }

    const remainingDays = balance.total_days + balance.adjusted_days - balance.used_days;

    res.json({
      success: true,
      data: {
        balance: {
          year: balance.year,
          totalDays: balance.total_days,
          usedDays: balance.used_days,
          adjustedDays: balance.adjusted_days,
          remainingDays,
          calcDetail
        }
      }
    });
  } catch (err) {
    console.error('Error fetching balance:', err);
    res.status(500).json({
      success: false,
      error: '잔여일수 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * GET /api/balances/team
 * Get team members' balances.
 * team_lead: same department only. director/hr_admin: all departments.
 */
router.get('/team', authenticateToken, requireRole('team_lead', 'director', 'hr_admin'), (req, res) => {
  try {
    const db = getDatabase();
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    let employees;
    if (req.user.role === 'team_lead') {
      employees = db.prepare(
        `SELECT e.id, e.employee_number, e.name, e.hire_date, d.name AS department
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE e.department_id = ? AND e.status = 'active'`
      ).all(req.user.departmentId);
    } else {
      employees = db.prepare(
        `SELECT e.id, e.employee_number, e.name, e.hire_date, d.name AS department
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE e.status = 'active'`
      ).all();
    }

    const balances = employees.map(emp => {
      const balance = ensureBalance(emp.id, year);
      const remainingDays = balance
        ? balance.total_days + balance.adjusted_days - balance.used_days
        : 0;

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNumber: emp.employee_number,
        department: emp.department,
        totalDays: balance ? balance.total_days : 0,
        usedDays: balance ? balance.used_days : 0,
        adjustedDays: balance ? balance.adjusted_days : 0,
        remainingDays
      };
    });

    res.json({
      success: true,
      data: { balances }
    });
  } catch (err) {
    console.error('Error fetching team balances:', err);
    res.status(500).json({
      success: false,
      error: '팀 잔여일수 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * POST /api/balances/adjust
 * HR admin adjusts an employee's leave balance.
 * Body: { employeeId, amount, reason }
 */
router.post('/adjust', authenticateToken, requireRole('hr_admin'), (req, res) => {
  try {
    const db = getDatabase();
    const { employeeId, amount, reason } = req.body;

    // Validate inputs
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: '직원 ID가 필요합니다.'
      });
    }

    if (amount === undefined || amount === null || typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        error: '조정 일수를 입력해 주세요.'
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: '조정 사유를 입력해 주세요.'
      });
    }

    // Validate employee exists
    const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: '해당 직원을 찾을 수 없습니다.'
      });
    }

    const year = new Date().getFullYear();

    // Ensure balance record exists
    const balance = ensureBalance(employeeId, year);
    if (!balance) {
      return res.status(404).json({
        success: false,
        error: '잔여일수 레코드를 생성할 수 없습니다.'
      });
    }

    // Atomic transaction: insert adjustment + update balance
    const result = db.transaction(() => {
      const insertResult = db.prepare(
        `INSERT INTO balance_adjustments (balance_id, adjusted_by, amount, reason)
         VALUES (?, ?, ?, ?)`
      ).run(balance.id, req.user.id, amount, reason.trim());

      db.prepare(
        'UPDATE leave_balances SET adjusted_days = adjusted_days + ? WHERE id = ?'
      ).run(amount, balance.id);

      return insertResult;
    })();

    // Fetch the created adjustment
    const adjustment = db.prepare(
      'SELECT id, amount, reason, created_at FROM balance_adjustments WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.json({
      success: true,
      data: {
        adjustment: {
          id: adjustment.id,
          amount: adjustment.amount,
          reason: adjustment.reason,
          createdAt: adjustment.created_at
        }
      }
    });
  } catch (err) {
    console.error('Error adjusting balance:', err);
    res.status(500).json({
      success: false,
      error: '잔여일수 조정 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
