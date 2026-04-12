const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/connection');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// ============================================================
// POST /api/auth/login
// ============================================================
router.post('/login', (req, res) => {
  try {
    const { employee_number, password } = req.body;

    if (!employee_number || !password) {
      return res.status(400).json({
        success: false,
        error: '사번과 비밀번호를 입력해 주세요.'
      });
    }

    const db = getDatabase();

    const employee = db.prepare(`
      SELECT e.*, d.name AS department_name
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      WHERE e.employee_number = ?
    `).get(employee_number);

    if (!employee) {
      return res.status(401).json({
        success: false,
        error: '사번 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    if (employee.status === 'inactive') {
      return res.status(403).json({
        success: false,
        error: '퇴사 처리된 계정입니다.'
      });
    }

    const passwordValid = bcrypt.compareSync(password, employee.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: '사번 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    const tokenPayload = {
      id: employee.id,
      employeeNumber: employee.employee_number,
      name: employee.name,
      role: employee.role,
      departmentId: employee.department_id,
      position: employee.position
    };

    const token = generateToken(tokenPayload);

    console.log(`[AUTH] Login success: ${employee.employee_number} (${employee.name})`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: employee.id,
          employeeNumber: employee.employee_number,
          name: employee.name,
          role: employee.role,
          department: employee.department_name,
          position: employee.position,
          isInitialPassword: employee.is_initial_password === 1,
          isAbsent: employee.is_absent === 1
        }
      }
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({
      success: false,
      error: '로그인 처리 중 오류가 발생했습니다.'
    });
  }
});

// ============================================================
// POST /api/auth/logout
// ============================================================
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    data: { message: '로그아웃되었습니다.' }
  });
});

// ============================================================
// PUT /api/auth/password
// ============================================================
router.put('/password', authenticateToken, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: '현재 비밀번호와 새 비밀번호를 입력해 주세요.'
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        error: '새 비밀번호는 4자 이상이어야 합니다.'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: '새 비밀번호가 현재 비밀번호와 같습니다.'
      });
    }

    const db = getDatabase();

    const employee = db.prepare('SELECT password_hash FROM employees WHERE id = ?').get(req.user.id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      });
    }

    const passwordValid = bcrypt.compareSync(currentPassword, employee.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: '현재 비밀번호가 올바르지 않습니다.'
      });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);

    db.prepare(`
      UPDATE employees
      SET password_hash = ?, is_initial_password = 0, updated_at = datetime('now')
      WHERE id = ?
    `).run(newHash, req.user.id);

    console.log(`[AUTH] Password changed: ${req.user.employeeNumber}`);

    res.json({
      success: true,
      data: { message: '비밀번호가 변경되었습니다.' }
    });
  } catch (err) {
    console.error('[AUTH] Password change error:', err.message);
    res.status(500).json({
      success: false,
      error: '비밀번호 변경 중 오류가 발생했습니다.'
    });
  }
});

// ============================================================
// GET /api/auth/me
// ============================================================
router.get('/me', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();

    const employee = db.prepare(`
      SELECT e.id, e.employee_number, e.name, e.role, e.department_id,
             e.position, e.is_initial_password, e.is_absent, e.absent_return_date,
             e.hire_date, e.birth_date, e.gender, e.phone, e.employment_type,
             e.status, d.name AS department_name
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      WHERE e.id = ?
    `).get(req.user.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      });
    }

    if (employee.status === 'inactive') {
      return res.status(403).json({
        success: false,
        error: '퇴사 처리된 계정입니다.'
      });
    }

    res.json({
      success: true,
      data: {
        id: employee.id,
        employeeNumber: employee.employee_number,
        name: employee.name,
        role: employee.role,
        department: employee.department_name,
        departmentId: employee.department_id,
        position: employee.position,
        isInitialPassword: employee.is_initial_password === 1,
        isAbsent: employee.is_absent === 1,
        absentReturnDate: employee.absent_return_date,
        hireDate: employee.hire_date,
        birthDate: employee.birth_date,
        gender: employee.gender,
        phone: employee.phone,
        employmentType: employee.employment_type
      }
    });
  } catch (err) {
    console.error('[AUTH] Get me error:', err.message);
    res.status(500).json({
      success: false,
      error: '사용자 정보 조회 중 오류가 발생했습니다.'
    });
  }
});

// ============================================================
// PUT /api/auth/absence
// ============================================================
router.put('/absence', authenticateToken, requireRole('team_lead', 'director'), (req, res) => {
  try {
    const { isAbsent, returnDate } = req.body;

    if (typeof isAbsent !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: '부재 상태 값이 올바르지 않습니다.'
      });
    }

    const db = getDatabase();

    const absentReturnDate = isAbsent && returnDate ? returnDate : null;

    db.prepare(`
      UPDATE employees
      SET is_absent = ?, absent_return_date = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(isAbsent ? 1 : 0, absentReturnDate, req.user.id);

    console.log(`[AUTH] Absence updated: ${req.user.employeeNumber}, absent=${isAbsent}`);

    res.json({
      success: true,
      data: {
        isAbsent,
        returnDate: absentReturnDate,
        message: isAbsent ? '부재 상태로 설정되었습니다.' : '부재 상태가 해제되었습니다.'
      }
    });
  } catch (err) {
    console.error('[AUTH] Absence update error:', err.message);
    res.status(500).json({
      success: false,
      error: '부재 상태 변경 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
