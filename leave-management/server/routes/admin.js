const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// All admin routes require hr_admin role
router.use(authenticateToken, requireRole('hr_admin'));

// Multer config for Excel upload (stored in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.'));
    }
  }
});

// position_rank mapping
const POSITION_RANK_MAP = {
  '사원': 1,
  '주임': 2,
  '팀장': 3,
  '부장': 4,
  '원장': 5
};

// ============================================================
// EMPLOYEE MANAGEMENT (6 endpoints)
// ============================================================

// GET /api/admin/employees — list all employees
router.get('/employees', (req, res) => {
  try {
    const db = getDatabase();
    const { status, department_id, search } = req.query;

    let sql = `
      SELECT e.*, d.name AS department_name
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }
    if (department_id) {
      sql += ' AND e.department_id = ?';
      params.push(Number(department_id));
    }
    if (search) {
      sql += ' AND (e.name LIKE ? OR e.employee_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY e.employee_number ASC';

    const employees = db.prepare(sql).all(...params);

    // Remove password_hash from response
    const sanitized = employees.map(({ password_hash, ...rest }) => rest);

    res.json({ success: true, data: sanitized });
  } catch (err) {
    console.error('Error fetching employees:', err.message);
    res.status(500).json({ success: false, error: '직원 목록을 불러오는 데 실패했습니다.' });
  }
});

// GET /api/admin/employees/:id — get single employee
router.get('/employees/:id', (req, res) => {
  try {
    const db = getDatabase();
    const employee = db.prepare(`
      SELECT e.*, d.name AS department_name
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      WHERE e.id = ?
    `).get(req.params.id);

    if (!employee) {
      return res.status(404).json({ success: false, error: '직원을 찾을 수 없습니다.' });
    }

    const { password_hash, ...sanitized } = employee;
    res.json({ success: true, data: sanitized });
  } catch (err) {
    console.error('Error fetching employee:', err.message);
    res.status(500).json({ success: false, error: '직원 정보를 불러오는 데 실패했습니다.' });
  }
});

// POST /api/admin/employees — create employee
router.post('/employees', (req, res) => {
  try {
    const db = getDatabase();
    const {
      employee_number, name, department_id, position, role,
      hire_date, birth_date, gender, phone, employment_type
    } = req.body;

    // Validation
    if (!employee_number || !name || !department_id || !position || !role ||
        !hire_date || !birth_date || !gender) {
      return res.status(400).json({ success: false, error: '필수 항목을 모두 입력해 주세요.' });
    }

    // Check duplicate employee_number
    const existing = db.prepare('SELECT id FROM employees WHERE employee_number = ?').get(employee_number);
    if (existing) {
      return res.status(409).json({ success: false, error: '이미 등록된 사번입니다.' });
    }

    // Check department exists
    const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(department_id);
    if (!dept) {
      return res.status(400).json({ success: false, error: '존재하지 않는 부서입니다.' });
    }

    // Generate initial password from birth_date YYMMDD
    const birthParts = birth_date.replace(/-/g, '');
    const initialPassword = birthParts.substring(2, 8); // YYMMDD
    const passwordHash = bcrypt.hashSync(initialPassword, 10);

    const positionRank = POSITION_RANK_MAP[position] || 0;

    const insertEmployee = db.prepare(`
      INSERT INTO employees (
        employee_number, name, password_hash, role, department_id,
        hire_date, birth_date, gender, position, position_rank,
        phone, employment_type, status, is_initial_password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)
    `);

    const createBalance = db.prepare(`
      INSERT OR IGNORE INTO leave_balances (employee_id, year, total_days, used_days, adjusted_days)
      VALUES (?, ?, 0, 0, 0)
    `);

    const result = db.transaction(() => {
      const info = insertEmployee.run(
        employee_number, name, passwordHash, role, department_id,
        hire_date, birth_date, gender, position, positionRank,
        phone || null, employment_type || 'regular'
      );
      const employeeId = info.lastInsertRowid;

      // Create leave balance for current year
      const currentYear = new Date().getFullYear();
      createBalance.run(employeeId, currentYear);

      return employeeId;
    })();

    const newEmployee = db.prepare(`
      SELECT e.*, d.name AS department_name
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      WHERE e.id = ?
    `).get(result);

    const { password_hash, ...sanitized } = newEmployee;
    res.status(201).json({ success: true, data: sanitized });
  } catch (err) {
    console.error('Error creating employee:', err.message);
    res.status(500).json({ success: false, error: '직원 등록에 실패했습니다.' });
  }
});

// PUT /api/admin/employees/:id — update employee
router.put('/employees/:id', (req, res) => {
  try {
    const db = getDatabase();
    const employeeId = req.params.id;

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, error: '직원을 찾을 수 없습니다.' });
    }

    const {
      employee_number, name, department_id, position, role,
      hire_date, birth_date, gender, phone, employment_type
    } = req.body;

    // Check duplicate employee_number if changed
    if (employee_number && employee_number !== employee.employee_number) {
      const existing = db.prepare('SELECT id FROM employees WHERE employee_number = ? AND id != ?').get(employee_number, employeeId);
      if (existing) {
        return res.status(409).json({ success: false, error: '이미 등록된 사번입니다.' });
      }
    }

    const positionRank = position ? (POSITION_RANK_MAP[position] || 0) : employee.position_rank;

    db.prepare(`
      UPDATE employees SET
        employee_number = COALESCE(?, employee_number),
        name = COALESCE(?, name),
        department_id = COALESCE(?, department_id),
        position = COALESCE(?, position),
        position_rank = ?,
        role = COALESCE(?, role),
        hire_date = COALESCE(?, hire_date),
        birth_date = COALESCE(?, birth_date),
        gender = COALESCE(?, gender),
        phone = COALESCE(?, phone),
        employment_type = COALESCE(?, employment_type),
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      employee_number || null, name || null, department_id || null,
      position || null, positionRank, role || null,
      hire_date || null, birth_date || null, gender || null,
      phone || null, employment_type || null, employeeId
    );

    const updated = db.prepare(`
      SELECT e.*, d.name AS department_name
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      WHERE e.id = ?
    `).get(employeeId);

    const { password_hash, ...sanitized } = updated;
    res.json({ success: true, data: sanitized });
  } catch (err) {
    console.error('Error updating employee:', err.message);
    res.status(500).json({ success: false, error: '직원 정보 수정에 실패했습니다.' });
  }
});

// PUT /api/admin/employees/:id/resign — retire employee
router.put('/employees/:id/resign', (req, res) => {
  try {
    const db = getDatabase();
    const employeeId = req.params.id;

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, error: '직원을 찾을 수 없습니다.' });
    }

    if (employee.status === 'inactive') {
      return res.status(400).json({ success: false, error: '이미 퇴사 처리된 직원입니다.' });
    }

    const today = new Date().toISOString().slice(0, 10);

    db.prepare(`
      UPDATE employees SET
        status = 'inactive',
        resignation_date = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(today, employeeId);

    res.json({ success: true, data: { message: '퇴사 처리가 완료되었습니다.' } });
  } catch (err) {
    console.error('Error resigning employee:', err.message);
    res.status(500).json({ success: false, error: '퇴사 처리에 실패했습니다.' });
  }
});

// PUT /api/admin/employees/:id/reset-password — reset to birth_date YYMMDD
router.put('/employees/:id/reset-password', (req, res) => {
  try {
    const db = getDatabase();
    const employeeId = req.params.id;

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, error: '직원을 찾을 수 없습니다.' });
    }

    const birthParts = employee.birth_date.replace(/-/g, '');
    const initialPassword = birthParts.substring(2, 8);
    const passwordHash = bcrypt.hashSync(initialPassword, 10);

    db.prepare(`
      UPDATE employees SET
        password_hash = ?,
        is_initial_password = 1,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(passwordHash, employeeId);

    res.json({ success: true, data: { message: '비밀번호가 초기화되었습니다.' } });
  } catch (err) {
    console.error('Error resetting password:', err.message);
    res.status(500).json({ success: false, error: '비밀번호 초기화에 실패했습니다.' });
  }
});

// ============================================================
// DEPARTMENT MANAGEMENT (3 endpoints)
// ============================================================

// GET /api/admin/departments — list all
router.get('/departments', (req, res) => {
  try {
    const db = getDatabase();
    const departments = db.prepare(`
      SELECT d.*, p.name AS parent_name,
        (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id AND e.status = 'active') AS employee_count
      FROM departments d
      LEFT JOIN departments p ON d.parent_id = p.id
      ORDER BY d.id ASC
    `).all();

    res.json({ success: true, data: departments });
  } catch (err) {
    console.error('Error fetching departments:', err.message);
    res.status(500).json({ success: false, error: '부서 목록을 불러오는 데 실패했습니다.' });
  }
});

// POST /api/admin/departments — create department
router.post('/departments', (req, res) => {
  try {
    const db = getDatabase();
    const { name, parent_id } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '부서명을 입력해 주세요.' });
    }

    const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name);
    if (existing) {
      return res.status(409).json({ success: false, error: '이미 존재하는 부서명입니다.' });
    }

    const info = db.prepare('INSERT INTO departments (name, parent_id) VALUES (?, ?)').run(name, parent_id || null);

    const department = db.prepare('SELECT * FROM departments WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: department });
  } catch (err) {
    console.error('Error creating department:', err.message);
    res.status(500).json({ success: false, error: '부서 등록에 실패했습니다.' });
  }
});

// PUT /api/admin/departments/:id — update department
router.put('/departments/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, parent_id } = req.body;

    const department = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, error: '부서를 찾을 수 없습니다.' });
    }

    if (name) {
      const existing = db.prepare('SELECT id FROM departments WHERE name = ? AND id != ?').get(name, req.params.id);
      if (existing) {
        return res.status(409).json({ success: false, error: '이미 존재하는 부서명입니다.' });
      }
    }

    db.prepare('UPDATE departments SET name = COALESCE(?, name), parent_id = ? WHERE id = ?')
      .run(name || null, parent_id !== undefined ? parent_id : department.parent_id, req.params.id);

    const updated = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating department:', err.message);
    res.status(500).json({ success: false, error: '부서 수정에 실패했습니다.' });
  }
});

// ============================================================
// LEAVE TYPE SETTINGS (3 endpoints)
// ============================================================

// GET /api/admin/leave-types — list all leave types with condolence subtypes
router.get('/leave-types', (req, res) => {
  try {
    const db = getDatabase();
    const leaveTypes = db.prepare('SELECT * FROM leave_types ORDER BY id ASC').all();
    const condolenceSubtypes = db.prepare('SELECT * FROM condolence_subtypes ORDER BY id ASC').all();

    const data = leaveTypes.map(lt => ({
      ...lt,
      condolence_subtypes: condolenceSubtypes.filter(cs => cs.leave_type_id === lt.id)
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching leave types:', err.message);
    res.status(500).json({ success: false, error: '휴가 유형을 불러오는 데 실패했습니다.' });
  }
});

// PUT /api/admin/leave-types/:id — update leave type settings
router.put('/leave-types/:id', (req, res) => {
  try {
    const db = getDatabase();
    const leaveType = db.prepare('SELECT * FROM leave_types WHERE id = ?').get(req.params.id);
    if (!leaveType) {
      return res.status(404).json({ success: false, error: '휴가 유형을 찾을 수 없습니다.' });
    }

    const { default_days, requires_attachment, allows_retroactive, gender_restriction } = req.body;

    db.prepare(`
      UPDATE leave_types SET
        default_days = COALESCE(?, default_days),
        requires_attachment = COALESCE(?, requires_attachment),
        allows_retroactive = COALESCE(?, allows_retroactive),
        gender_restriction = ?
      WHERE id = ?
    `).run(
      default_days !== undefined ? default_days : null,
      requires_attachment !== undefined ? requires_attachment : null,
      allows_retroactive !== undefined ? allows_retroactive : null,
      gender_restriction !== undefined ? gender_restriction : leaveType.gender_restriction,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM leave_types WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating leave type:', err.message);
    res.status(500).json({ success: false, error: '휴가 유형 수정에 실패했습니다.' });
  }
});

// PUT /api/admin/condolence-subtypes/:id — update condolence subtype
router.put('/condolence-subtypes/:id', (req, res) => {
  try {
    const db = getDatabase();
    const subtype = db.prepare('SELECT * FROM condolence_subtypes WHERE id = ?').get(req.params.id);
    if (!subtype) {
      return res.status(404).json({ success: false, error: '경조사 유형을 찾을 수 없습니다.' });
    }

    const { days, description } = req.body;

    db.prepare(`
      UPDATE condolence_subtypes SET
        days = COALESCE(?, days),
        description = COALESCE(?, description)
      WHERE id = ?
    `).run(
      days !== undefined ? days : null,
      description !== undefined ? description : null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM condolence_subtypes WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating condolence subtype:', err.message);
    res.status(500).json({ success: false, error: '경조사 유형 수정에 실패했습니다.' });
  }
});

// ============================================================
// EMPLOYMENT TYPE LEAVE MAPPING (2 endpoints)
// ============================================================

// GET /api/admin/employment-type-mappings
router.get('/employment-type-mappings', (req, res) => {
  try {
    const db = getDatabase();
    const mappings = db.prepare(`
      SELECT etlm.*, lt.name AS leave_type_name, lt.code AS leave_type_code
      FROM employment_type_leave_mapping etlm
      JOIN leave_types lt ON etlm.leave_type_id = lt.id
      ORDER BY etlm.employment_type, etlm.leave_type_id
    `).all();

    // Group by employment_type
    const grouped = {};
    mappings.forEach(m => {
      if (!grouped[m.employment_type]) {
        grouped[m.employment_type] = [];
      }
      grouped[m.employment_type].push(m);
    });

    res.json({ success: true, data: grouped });
  } catch (err) {
    console.error('Error fetching employment type mappings:', err.message);
    res.status(500).json({ success: false, error: '고용형태별 휴가 매핑을 불러오는 데 실패했습니다.' });
  }
});

// PUT /api/admin/employment-type-mappings — bulk update
router.put('/employment-type-mappings', (req, res) => {
  try {
    const db = getDatabase();
    const { mappings } = req.body;

    if (!Array.isArray(mappings)) {
      return res.status(400).json({ success: false, error: '매핑 데이터가 올바르지 않습니다.' });
    }

    const upsert = db.prepare(`
      INSERT INTO employment_type_leave_mapping (employment_type, leave_type_id, is_allowed)
      VALUES (?, ?, ?)
      ON CONFLICT(employment_type, leave_type_id)
      DO UPDATE SET is_allowed = excluded.is_allowed
    `);

    db.transaction(() => {
      for (const m of mappings) {
        upsert.run(m.employment_type, m.leave_type_id, m.is_allowed ? 1 : 0);
      }
    })();

    res.json({ success: true, data: { message: '고용형태별 휴가 매핑이 저장되었습니다.' } });
  } catch (err) {
    console.error('Error updating employment type mappings:', err.message);
    res.status(500).json({ success: false, error: '고용형태별 휴가 매핑 저장에 실패했습니다.' });
  }
});

// ============================================================
// APPROVAL FLOW MANAGEMENT (3 endpoints)
// ============================================================

// GET /api/admin/approval-flows — list all with steps and mappings
router.get('/approval-flows', (req, res) => {
  try {
    const db = getDatabase();
    const flows = db.prepare('SELECT * FROM approval_flows ORDER BY id ASC').all();
    const steps = db.prepare(`
      SELECT afs.*, d.name AS department_name, e.name AS employee_name
      FROM approval_flow_steps afs
      LEFT JOIN departments d ON afs.assignee_department_id = d.id
      LEFT JOIN employees e ON afs.assignee_employee_id = e.id
      ORDER BY afs.flow_id, afs.step_order
    `).all();
    const mappings = db.prepare(`
      SELECT ltfm.*, lt.name AS leave_type_name
      FROM leave_type_flow_mapping ltfm
      JOIN leave_types lt ON ltfm.leave_type_id = lt.id
    `).all();

    const data = flows.map(f => ({
      ...f,
      steps: steps.filter(s => s.flow_id === f.id),
      leave_type_mappings: mappings.filter(m => m.approval_flow_id === f.id)
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching approval flows:', err.message);
    res.status(500).json({ success: false, error: '결재 라인을 불러오는 데 실패했습니다.' });
  }
});

// POST /api/admin/approval-flows — create new flow with steps
router.post('/approval-flows', (req, res) => {
  try {
    const db = getDatabase();
    const { name, description, steps, leave_type_ids } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '결재 라인 이름을 입력해 주세요.' });
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ success: false, error: '결재 단계를 1개 이상 추가해 주세요.' });
    }

    const insertFlow = db.prepare('INSERT INTO approval_flows (name, description) VALUES (?, ?)');
    const insertStep = db.prepare(`
      INSERT INTO approval_flow_steps (
        flow_id, step_order, step_type, assignee_type,
        assignee_position, assignee_department_id, assignee_employee_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMapping = db.prepare(`
      INSERT OR REPLACE INTO leave_type_flow_mapping (leave_type_id, approval_flow_id)
      VALUES (?, ?)
    `);

    const flowId = db.transaction(() => {
      const info = insertFlow.run(name, description || null);
      const fId = info.lastInsertRowid;

      for (const step of steps) {
        insertStep.run(
          fId,
          step.step_order || step.stepOrder,
          step.step_type || step.stepType,
          step.assignee_type || step.assigneeType,
          step.assignee_position || step.assigneePosition || null,
          step.assignee_department_id || step.assigneeDepartmentId || null,
          step.assignee_employee_id || step.assigneeEmployeeId || null
        );
      }

      // Map leave types to this flow
      if (Array.isArray(leave_type_ids)) {
        for (const ltId of leave_type_ids) {
          insertMapping.run(ltId, fId);
        }
      }

      return fId;
    })();

    // Return the created flow with steps
    const flow = db.prepare('SELECT * FROM approval_flows WHERE id = ?').get(flowId);
    const flowSteps = db.prepare('SELECT * FROM approval_flow_steps WHERE flow_id = ? ORDER BY step_order').all(flowId);
    const flowMappings = db.prepare(`
      SELECT ltfm.*, lt.name AS leave_type_name
      FROM leave_type_flow_mapping ltfm
      JOIN leave_types lt ON ltfm.leave_type_id = lt.id
      WHERE ltfm.approval_flow_id = ?
    `).all(flowId);

    res.status(201).json({
      success: true,
      data: { ...flow, steps: flowSteps, leave_type_mappings: flowMappings }
    });
  } catch (err) {
    console.error('Error creating approval flow:', err.message);
    res.status(500).json({ success: false, error: '결재 라인 등록에 실패했습니다.' });
  }
});

// PUT /api/admin/approval-flows/:id — update flow (replace steps)
router.put('/approval-flows/:id', (req, res) => {
  try {
    const db = getDatabase();
    const flowId = req.params.id;

    const flow = db.prepare('SELECT * FROM approval_flows WHERE id = ?').get(flowId);
    if (!flow) {
      return res.status(404).json({ success: false, error: '결재 라인을 찾을 수 없습니다.' });
    }

    const { name, description, steps, leave_type_ids } = req.body;

    const updateFlow = db.prepare('UPDATE approval_flows SET name = COALESCE(?, name), description = ? WHERE id = ?');
    const deleteSteps = db.prepare('DELETE FROM approval_flow_steps WHERE flow_id = ?');
    const insertStep = db.prepare(`
      INSERT INTO approval_flow_steps (
        flow_id, step_order, step_type, assignee_type,
        assignee_position, assignee_department_id, assignee_employee_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const deleteMappings = db.prepare('DELETE FROM leave_type_flow_mapping WHERE approval_flow_id = ?');
    const insertMapping = db.prepare(`
      INSERT OR REPLACE INTO leave_type_flow_mapping (leave_type_id, approval_flow_id)
      VALUES (?, ?)
    `);

    db.transaction(() => {
      updateFlow.run(name || null, description !== undefined ? description : flow.description, flowId);

      if (Array.isArray(steps)) {
        deleteSteps.run(flowId);
        for (const step of steps) {
          insertStep.run(
            flowId,
            step.step_order || step.stepOrder,
            step.step_type || step.stepType,
            step.assignee_type || step.assigneeType,
            step.assignee_position || step.assigneePosition || null,
            step.assignee_department_id || step.assigneeDepartmentId || null,
            step.assignee_employee_id || step.assigneeEmployeeId || null
          );
        }
      }

      if (Array.isArray(leave_type_ids)) {
        deleteMappings.run(flowId);
        for (const ltId of leave_type_ids) {
          insertMapping.run(ltId, flowId);
        }
      }
    })();

    // Return updated flow
    const updatedFlow = db.prepare('SELECT * FROM approval_flows WHERE id = ?').get(flowId);
    const updatedSteps = db.prepare('SELECT * FROM approval_flow_steps WHERE flow_id = ? ORDER BY step_order').all(flowId);
    const updatedMappings = db.prepare(`
      SELECT ltfm.*, lt.name AS leave_type_name
      FROM leave_type_flow_mapping ltfm
      JOIN leave_types lt ON ltfm.leave_type_id = lt.id
      WHERE ltfm.approval_flow_id = ?
    `).all(flowId);

    res.json({
      success: true,
      data: { ...updatedFlow, steps: updatedSteps, leave_type_mappings: updatedMappings }
    });
  } catch (err) {
    console.error('Error updating approval flow:', err.message);
    res.status(500).json({ success: false, error: '결재 라인 수정에 실패했습니다.' });
  }
});

// ============================================================
// DELEGATE MANAGEMENT (2 endpoints)
// ============================================================

// GET /api/admin/delegates — list all delegate assignments
router.get('/delegates', (req, res) => {
  try {
    const db = getDatabase();
    const delegates = db.prepare(`
      SELECT d.id, d.employee_id, d.delegate_id, d.priority,
        e.name AS employee_name, e.employee_number AS employee_number,
        e.department_id AS employee_department_id,
        dep.name AS employee_department_name,
        e.position AS employee_position,
        del.name AS delegate_name, del.employee_number AS delegate_number,
        del.position AS delegate_position,
        deldep.name AS delegate_department_name
      FROM delegates d
      JOIN employees e ON d.employee_id = e.id
      JOIN employees del ON d.delegate_id = del.id
      JOIN departments dep ON e.department_id = dep.id
      JOIN departments deldep ON del.department_id = deldep.id
      WHERE e.status = 'active'
      ORDER BY e.employee_number, d.priority
    `).all();

    // Group by employee
    const grouped = {};
    delegates.forEach(d => {
      if (!grouped[d.employee_id]) {
        grouped[d.employee_id] = {
          employee_id: d.employee_id,
          employee_name: d.employee_name,
          employee_number: d.employee_number,
          employee_department_name: d.employee_department_name,
          employee_position: d.employee_position,
          delegates: []
        };
      }
      grouped[d.employee_id].delegates.push({
        id: d.id,
        delegate_id: d.delegate_id,
        delegate_name: d.delegate_name,
        delegate_number: d.delegate_number,
        delegate_position: d.delegate_position,
        delegate_department_name: d.delegate_department_name,
        priority: d.priority
      });
    });

    res.json({ success: true, data: Object.values(grouped) });
  } catch (err) {
    console.error('Error fetching delegates:', err.message);
    res.status(500).json({ success: false, error: '대결자 목록을 불러오는 데 실패했습니다.' });
  }
});

// PUT /api/admin/delegates/:employeeId — set delegates for an employee
router.put('/delegates/:employeeId', (req, res) => {
  try {
    const db = getDatabase();
    const employeeId = req.params.employeeId;

    const employee = db.prepare('SELECT * FROM employees WHERE id = ? AND status = ?').get(employeeId, 'active');
    if (!employee) {
      return res.status(404).json({ success: false, error: '직원을 찾을 수 없습니다.' });
    }

    const { delegates } = req.body;

    if (!Array.isArray(delegates)) {
      return res.status(400).json({ success: false, error: '대결자 데이터가 올바르지 않습니다.' });
    }

    // Validate: delegate cannot be self
    for (const d of delegates) {
      if (Number(d.delegateId || d.delegate_id) === Number(employeeId)) {
        return res.status(400).json({ success: false, error: '본인을 대결자로 지정할 수 없습니다.' });
      }
    }

    const deleteDelegates = db.prepare('DELETE FROM delegates WHERE employee_id = ?');
    const insertDelegate = db.prepare(
      'INSERT INTO delegates (employee_id, delegate_id, priority) VALUES (?, ?, ?)'
    );

    db.transaction(() => {
      deleteDelegates.run(employeeId);
      for (const d of delegates) {
        insertDelegate.run(employeeId, d.delegateId || d.delegate_id, d.priority);
      }
    })();

    res.json({ success: true, data: { message: '대결자가 설정되었습니다.' } });
  } catch (err) {
    console.error('Error updating delegates:', err.message);
    res.status(500).json({ success: false, error: '대결자 설정에 실패했습니다.' });
  }
});

// ============================================================
// HOLIDAY MANAGEMENT (2 endpoints)
// ============================================================

// GET /api/admin/holidays — list holidays for a year
router.get('/holidays', (req, res) => {
  try {
    const db = getDatabase();
    const year = req.query.year || new Date().getFullYear();

    const holidays = db.prepare(
      'SELECT * FROM holidays WHERE year = ? ORDER BY date ASC'
    ).all(year);

    res.json({ success: true, data: holidays });
  } catch (err) {
    console.error('Error fetching holidays:', err.message);
    res.status(500).json({ success: false, error: '공휴일 목록을 불러오는 데 실패했습니다.' });
  }
});

// POST /api/admin/holidays — bulk add/update/delete holidays
router.post('/holidays', (req, res) => {
  try {
    const db = getDatabase();
    const { year, holidays } = req.body;

    if (!year || !Array.isArray(holidays)) {
      return res.status(400).json({ success: false, error: '연도와 공휴일 데이터를 입력해 주세요.' });
    }

    const deleteCustom = db.prepare('DELETE FROM holidays WHERE year = ? AND is_custom = 1');
    const insertHoliday = db.prepare(
      'INSERT INTO holidays (date, name, is_custom, year) VALUES (?, ?, ?, ?)'
    );

    db.transaction(() => {
      // Delete existing custom holidays for the year, then re-insert
      deleteCustom.run(year);

      for (const h of holidays) {
        if (h.is_custom) {
          insertHoliday.run(h.date, h.name, 1, year);
        }
      }
    })();

    const updated = db.prepare('SELECT * FROM holidays WHERE year = ? ORDER BY date ASC').all(year);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating holidays:', err.message);
    res.status(500).json({ success: false, error: '공휴일 저장에 실패했습니다.' });
  }
});

// ============================================================
// SYSTEM SETTINGS (1 endpoint)
// ============================================================

// PUT /api/admin/settings — bulk update
router.put('/settings', (req, res) => {
  try {
    const db = getDatabase();
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      return res.status(400).json({ success: false, error: '설정 데이터가 올바르지 않습니다.' });
    }

    const upsert = db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now','localtime'))
      ON CONFLICT(key)
      DO UPDATE SET value = excluded.value, updated_at = datetime('now','localtime')
    `);

    db.transaction(() => {
      for (const s of settings) {
        upsert.run(s.key, s.value);
      }
    })();

    const allSettings = db.prepare('SELECT * FROM system_settings ORDER BY key ASC').all();
    res.json({ success: true, data: allSettings });
  } catch (err) {
    console.error('Error updating settings:', err.message);
    res.status(500).json({ success: false, error: '시스템 설정 저장에 실패했습니다.' });
  }
});

// GET /api/admin/settings — get all settings
router.get('/settings', (req, res) => {
  try {
    const db = getDatabase();
    const settings = db.prepare('SELECT * FROM system_settings ORDER BY key ASC').all();
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('Error fetching settings:', err.message);
    res.status(500).json({ success: false, error: '시스템 설정을 불러오는 데 실패했습니다.' });
  }
});

// ============================================================
// BALANCE MANAGEMENT (additional endpoints for S-07)
// ============================================================

// GET /api/admin/balances — list all balances for a year
router.get('/balances', (req, res) => {
  try {
    const db = getDatabase();
    const year = req.query.year || new Date().getFullYear();

    const balances = db.prepare(`
      SELECT lb.*, e.employee_number, e.name AS employee_name,
        d.name AS department_name, e.position, e.hire_date, e.status
      FROM leave_balances lb
      JOIN employees e ON lb.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      WHERE lb.year = ?
      ORDER BY e.employee_number ASC
    `).all(year);

    res.json({ success: true, data: balances });
  } catch (err) {
    console.error('Error fetching balances:', err.message);
    res.status(500).json({ success: false, error: '잔여일수 목록을 불러오는 데 실패했습니다.' });
  }
});

// POST /api/admin/balances/adjust — manual adjustment
router.post('/balances/adjust', (req, res) => {
  try {
    const db = getDatabase();
    const { employee_id, year, amount, reason } = req.body;

    if (!employee_id || !year || amount === undefined || !reason) {
      return res.status(400).json({ success: false, error: '필수 항목을 모두 입력해 주세요.' });
    }

    // Get or create balance record
    let balance = db.prepare(
      'SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?'
    ).get(employee_id, year);

    if (!balance) {
      db.prepare(
        'INSERT INTO leave_balances (employee_id, year, total_days, used_days, adjusted_days) VALUES (?, ?, 0, 0, 0)'
      ).run(employee_id, year);
      balance = db.prepare(
        'SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?'
      ).get(employee_id, year);
    }

    db.transaction(() => {
      // Insert adjustment record (INSERT only table)
      db.prepare(
        'INSERT INTO balance_adjustments (balance_id, adjusted_by, amount, reason) VALUES (?, ?, ?, ?)'
      ).run(balance.id, req.user.id, amount, reason);

      // Update adjusted_days on leave_balances
      db.prepare(
        'UPDATE leave_balances SET adjusted_days = adjusted_days + ? WHERE id = ?'
      ).run(amount, balance.id);
    })();

    const updated = db.prepare(`
      SELECT lb.*, e.employee_number, e.name AS employee_name
      FROM leave_balances lb
      JOIN employees e ON lb.employee_id = e.id
      WHERE lb.id = ?
    `).get(balance.id);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error adjusting balance:', err.message);
    res.status(500).json({ success: false, error: '잔여일수 조정에 실패했습니다.' });
  }
});

// GET /api/admin/balances/:employeeId/adjustments — get adjustment history
router.get('/balances/:employeeId/adjustments', (req, res) => {
  try {
    const db = getDatabase();
    const { employeeId } = req.params;
    const year = req.query.year || new Date().getFullYear();

    const balance = db.prepare(
      'SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?'
    ).get(employeeId, year);

    if (!balance) {
      return res.json({ success: true, data: [] });
    }

    const adjustments = db.prepare(`
      SELECT ba.*, e.name AS adjusted_by_name
      FROM balance_adjustments ba
      JOIN employees e ON ba.adjusted_by = e.id
      WHERE ba.balance_id = ?
      ORDER BY ba.created_at DESC
    `).all(balance.id);

    res.json({ success: true, data: adjustments });
  } catch (err) {
    console.error('Error fetching adjustments:', err.message);
    res.status(500).json({ success: false, error: '조정 내역을 불러오는 데 실패했습니다.' });
  }
});

// ============================================================
// EXCEL UPLOAD (for bulk employee import)
// ============================================================
router.post('/employees/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '파일을 선택해 주세요.' });
    }

    // Excel parsing will be handled by exceljs
    let ExcelJS;
    try {
      ExcelJS = require('exceljs');
    } catch {
      return res.status(500).json({ success: false, error: '엑셀 처리 모듈을 불러올 수 없습니다.' });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.xlsx.load(req.file.buffer).then(() => {
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        return res.status(400).json({ success: false, error: '워크시트를 찾을 수 없습니다.' });
      }

      const rows = [];
      const errors = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const employeeData = {
          employee_number: String(row.getCell(1).value || '').trim(),
          name: String(row.getCell(2).value || '').trim(),
          department_name: String(row.getCell(3).value || '').trim(),
          position: String(row.getCell(4).value || '').trim(),
          role: String(row.getCell(5).value || '').trim(),
          hire_date: String(row.getCell(6).value || '').trim(),
          birth_date: String(row.getCell(7).value || '').trim(),
          gender: String(row.getCell(8).value || '').trim(),
          phone: String(row.getCell(9).value || '').trim(),
          employment_type: String(row.getCell(10).value || 'regular').trim(),
          row_number: rowNumber
        };

        // Basic validation
        if (!employeeData.employee_number || !employeeData.name) {
          errors.push({ row: rowNumber, error: '사번 또는 이름이 누락되었습니다.' });
        }

        rows.push(employeeData);
      });

      res.json({
        success: true,
        data: {
          rows,
          errors,
          total: rows.length
        }
      });
    }).catch(err => {
      console.error('Error parsing Excel:', err.message);
      res.status(400).json({ success: false, error: '엑셀 파일을 읽을 수 없습니다.' });
    });
  } catch (err) {
    console.error('Error uploading Excel:', err.message);
    res.status(500).json({ success: false, error: '파일 업로드에 실패했습니다.' });
  }
});

// POST /api/admin/employees/bulk — bulk create from parsed Excel data
router.post('/employees/bulk', (req, res) => {
  try {
    const db = getDatabase();
    const { employees } = req.body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ success: false, error: '등록할 직원 데이터가 없습니다.' });
    }

    const results = { success: 0, failed: 0, errors: [] };

    const insertEmployee = db.prepare(`
      INSERT INTO employees (
        employee_number, name, password_hash, role, department_id,
        hire_date, birth_date, gender, position, position_rank,
        phone, employment_type, status, is_initial_password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)
    `);

    const createBalance = db.prepare(`
      INSERT OR IGNORE INTO leave_balances (employee_id, year, total_days, used_days, adjusted_days)
      VALUES (?, ?, 0, 0, 0)
    `);

    const currentYear = new Date().getFullYear();

    db.transaction(() => {
      for (const emp of employees) {
        try {
          // Look up department by name
          let deptId = emp.department_id;
          if (!deptId && emp.department_name) {
            const dept = db.prepare('SELECT id FROM departments WHERE name = ?').get(emp.department_name);
            if (dept) deptId = dept.id;
          }

          if (!deptId) {
            results.failed++;
            results.errors.push({ employee_number: emp.employee_number, error: '부서를 찾을 수 없습니다.' });
            continue;
          }

          // Check duplicate
          const existing = db.prepare('SELECT id FROM employees WHERE employee_number = ?').get(emp.employee_number);
          if (existing) {
            results.failed++;
            results.errors.push({ employee_number: emp.employee_number, error: '이미 등록된 사번입니다.' });
            continue;
          }

          const birthParts = emp.birth_date.replace(/-/g, '');
          const initialPassword = birthParts.substring(2, 8);
          const passwordHash = bcrypt.hashSync(initialPassword, 10);
          const positionRank = POSITION_RANK_MAP[emp.position] || 0;

          const info = insertEmployee.run(
            emp.employee_number, emp.name, passwordHash,
            emp.role || 'staff', deptId,
            emp.hire_date, emp.birth_date, emp.gender,
            emp.position, positionRank,
            emp.phone || null, emp.employment_type || 'regular'
          );

          createBalance.run(info.lastInsertRowid, currentYear);
          results.success++;
        } catch (e) {
          results.failed++;
          results.errors.push({ employee_number: emp.employee_number, error: e.message });
        }
      }
    })();

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Error bulk creating employees:', err.message);
    res.status(500).json({ success: false, error: '일괄 등록에 실패했습니다.' });
  }
});

module.exports = router;
