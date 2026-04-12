const { getDatabase } = require('../database/connection');

// Notification stub — Track G may not be ready yet
let notify;
try { notify = require('./notificationService').notify; }
catch { notify = () => {}; }

/**
 * Create approval steps for a leave request based on the mapped approval flow.
 *
 * @param {number} requestId
 * @param {number} employeeId - the applicant
 * @returns {object[]} created approval_steps rows
 */
function createApprovalSteps(requestId, employeeId) {
  const db = getDatabase();

  // 1. Get the leave request to find leave_type_id
  const request = db.prepare(
    'SELECT id, leave_type_id FROM leave_requests WHERE id = ?'
  ).get(requestId);

  if (!request) {
    throw new Error('Leave request not found');
  }

  // 2. Get the employee info (department, position)
  const employee = db.prepare(
    `SELECT e.id, e.name, e.department_id, e.position, e.role,
            d.name AS dept_name
     FROM employees e
     LEFT JOIN departments d ON e.department_id = d.id
     WHERE e.id = ?`
  ).get(employeeId);

  if (!employee) {
    throw new Error('Employee not found');
  }

  // 3. Look up the approval flow for this leave type
  const flowMapping = db.prepare(
    'SELECT approval_flow_id FROM leave_type_flow_mapping WHERE leave_type_id = ?'
  ).get(request.leave_type_id);

  if (!flowMapping) {
    throw new Error('No approval flow configured for this leave type');
  }

  // 4. Get the flow steps
  const flowSteps = db.prepare(
    'SELECT * FROM approval_flow_steps WHERE flow_id = ? ORDER BY step_order'
  ).all(flowMapping.approval_flow_id);

  if (flowSteps.length === 0) {
    throw new Error('Approval flow has no steps');
  }

  // 5. Resolve assignee for each step and insert approval_steps
  const insertStmt = db.prepare(
    `INSERT INTO approval_steps (request_id, step_order, step_type, assigned_to, acted_by, is_delegated, status, approver_position, approver_dept_name, comment, acted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const createdSteps = [];

  for (const flowStep of flowSteps) {
    let assigneeId = null;
    let assigneePosition = null;
    let assigneeDeptName = null;
    let isDelegated = 0;

    if (flowStep.assignee_type === 'self') {
      // The applicant themselves (draft step)
      assigneeId = employeeId;
      assigneePosition = employee.position;
      assigneeDeptName = employee.dept_name;
    } else if (flowStep.assignee_type === 'role') {
      // Find employee with matching position in same department (or parent dept)
      const resolved = resolveRoleAssignee(
        flowStep.assignee_position,
        employee.department_id,
        employeeId
      );
      assigneeId = resolved.assigneeId;
      assigneePosition = resolved.position;
      assigneeDeptName = resolved.deptName;
      isDelegated = resolved.isDelegated;
    } else if (flowStep.assignee_type === 'department') {
      // Find someone in the specified department
      const resolved = resolveDepartmentAssignee(
        flowStep.assignee_department_id,
        employeeId
      );
      assigneeId = resolved.assigneeId;
      assigneePosition = resolved.position;
      assigneeDeptName = resolved.deptName;
      isDelegated = resolved.isDelegated;
    } else if (flowStep.assignee_type === 'person') {
      // Specific person
      const resolved = resolvePersonAssignee(flowStep.assignee_employee_id);
      assigneeId = resolved.assigneeId;
      assigneePosition = resolved.position;
      assigneeDeptName = resolved.deptName;
      isDelegated = resolved.isDelegated;
    }

    if (!assigneeId) {
      throw new Error(`Cannot resolve assignee for step ${flowStep.step_order} (${flowStep.step_type})`);
    }

    // Draft step is auto-approved immediately
    const isDraft = flowStep.step_type === 'draft';
    const status = isDraft ? 'approved' : 'pending';
    const actedBy = isDraft ? employeeId : null;
    const actedAt = isDraft ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null;

    const result = insertStmt.run(
      requestId,
      flowStep.step_order,
      flowStep.step_type,
      assigneeId,
      actedBy,
      isDelegated,
      status,
      assigneePosition,
      assigneeDeptName,
      null,
      actedAt
    );

    createdSteps.push({
      id: result.lastInsertRowid,
      requestId,
      stepOrder: flowStep.step_order,
      stepType: flowStep.step_type,
      assignedTo: assigneeId,
      actedBy,
      isDelegated,
      status,
      approverPosition: assigneePosition,
      approverDeptName: assigneeDeptName,
    });
  }

  return createdSteps;
}

/**
 * Resolve a role-based assignee (e.g., '팀장' or '원장').
 * Looks in the same department first, then parent department, then all departments.
 * If the resolved person is absent, checks delegates.
 */
function resolveRoleAssignee(positionName, departmentId, excludeEmployeeId) {
  const db = getDatabase();

  // Map position name to role
  const positionToRole = {
    '팀장': 'team_lead',
    '원장': 'director',
  };
  const targetRole = positionToRole[positionName];

  let assignee = null;

  if (targetRole) {
    // Try same department first
    assignee = db.prepare(
      `SELECT e.id, e.position, e.is_absent, d.name AS dept_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.role = ? AND e.department_id = ? AND e.status = 'active' AND e.id != ?
       LIMIT 1`
    ).get(targetRole, departmentId, excludeEmployeeId);

    // If not found in same dept, try parent dept
    if (!assignee) {
      const dept = db.prepare('SELECT parent_id FROM departments WHERE id = ?').get(departmentId);
      if (dept && dept.parent_id) {
        assignee = db.prepare(
          `SELECT e.id, e.position, e.is_absent, d.name AS dept_name
           FROM employees e
           LEFT JOIN departments d ON e.department_id = d.id
           WHERE e.role = ? AND e.department_id = ? AND e.status = 'active' AND e.id != ?
           LIMIT 1`
        ).get(targetRole, dept.parent_id, excludeEmployeeId);
      }
    }

    // If still not found, search all departments
    if (!assignee) {
      assignee = db.prepare(
        `SELECT e.id, e.position, e.is_absent, d.name AS dept_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE e.role = ? AND e.status = 'active' AND e.id != ?
         ORDER BY e.id
         LIMIT 1`
      ).get(targetRole, excludeEmployeeId);
    }
  } else {
    // Fall back to position text match
    assignee = db.prepare(
      `SELECT e.id, e.position, e.is_absent, d.name AS dept_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.position = ? AND e.department_id = ? AND e.status = 'active' AND e.id != ?
       LIMIT 1`
    ).get(positionName, departmentId, excludeEmployeeId);

    if (!assignee) {
      assignee = db.prepare(
        `SELECT e.id, e.position, e.is_absent, d.name AS dept_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE e.position = ? AND e.status = 'active' AND e.id != ?
         ORDER BY e.id
         LIMIT 1`
      ).get(positionName, excludeEmployeeId);
    }
  }

  if (!assignee) {
    return { assigneeId: null, position: null, deptName: null, isDelegated: 0 };
  }

  // Check if absent → use delegate
  if (assignee.is_absent) {
    const delegate = findDelegate(assignee.id);
    if (delegate) {
      return {
        assigneeId: delegate.id,
        position: delegate.position,
        deptName: delegate.dept_name,
        isDelegated: 1
      };
    }
  }

  return {
    assigneeId: assignee.id,
    position: assignee.position,
    deptName: assignee.dept_name,
    isDelegated: 0
  };
}

/**
 * Resolve a department-based assignee.
 */
function resolveDepartmentAssignee(departmentId, excludeEmployeeId) {
  const db = getDatabase();

  const assignee = db.prepare(
    `SELECT e.id, e.position, e.is_absent, d.name AS dept_name
     FROM employees e
     LEFT JOIN departments d ON e.department_id = d.id
     WHERE e.department_id = ? AND e.status = 'active' AND e.id != ?
     ORDER BY e.position_rank DESC
     LIMIT 1`
  ).get(departmentId, excludeEmployeeId);

  if (!assignee) {
    return { assigneeId: null, position: null, deptName: null, isDelegated: 0 };
  }

  if (assignee.is_absent) {
    const delegate = findDelegate(assignee.id);
    if (delegate) {
      return {
        assigneeId: delegate.id,
        position: delegate.position,
        deptName: delegate.dept_name,
        isDelegated: 1
      };
    }
  }

  return {
    assigneeId: assignee.id,
    position: assignee.position,
    deptName: assignee.dept_name,
    isDelegated: 0
  };
}

/**
 * Resolve a person-based assignee (specific employee).
 */
function resolvePersonAssignee(employeeId) {
  const db = getDatabase();

  const assignee = db.prepare(
    `SELECT e.id, e.position, e.is_absent, d.name AS dept_name
     FROM employees e
     LEFT JOIN departments d ON e.department_id = d.id
     WHERE e.id = ? AND e.status = 'active'`
  ).get(employeeId);

  if (!assignee) {
    return { assigneeId: null, position: null, deptName: null, isDelegated: 0 };
  }

  if (assignee.is_absent) {
    const delegate = findDelegate(assignee.id);
    if (delegate) {
      return {
        assigneeId: delegate.id,
        position: delegate.position,
        deptName: delegate.dept_name,
        isDelegated: 1
      };
    }
  }

  return {
    assigneeId: assignee.id,
    position: assignee.position,
    deptName: assignee.dept_name,
    isDelegated: 0
  };
}

/**
 * Find a delegate for an absent employee (priority 1 first, then 2).
 */
function findDelegate(employeeId) {
  const db = getDatabase();

  // Try priority 1
  const d1 = db.prepare(
    `SELECT e.id, e.position, e.is_absent, d.name AS dept_name
     FROM delegates del
     JOIN employees e ON del.delegate_id = e.id
     LEFT JOIN departments d ON e.department_id = d.id
     WHERE del.employee_id = ? AND del.priority = 1 AND e.status = 'active'`
  ).get(employeeId);

  if (d1 && !d1.is_absent) return d1;

  // Try priority 2
  const d2 = db.prepare(
    `SELECT e.id, e.position, e.is_absent, d.name AS dept_name
     FROM delegates del
     JOIN employees e ON del.delegate_id = e.id
     LEFT JOIN departments d ON e.department_id = d.id
     WHERE del.employee_id = ? AND del.priority = 2 AND e.status = 'active'`
  ).get(employeeId);

  if (d2 && !d2.is_absent) return d2;

  // No available delegate — return the original absent person's delegate even if absent
  return d1 || d2 || null;
}

/**
 * Process an approval action (approve or reject) on a specific step.
 *
 * @param {number} stepId
 * @param {number} actorId - the person performing the action
 * @param {'approve'|'reject'} action
 * @param {string|null} comment
 * @returns {object} result info
 */
function processApproval(stepId, actorId, action, comment) {
  const db = getDatabase();

  // 1. Get the step
  const step = db.prepare(
    `SELECT s.*, lr.employee_id AS applicant_id, lr.total_days, lr.status AS request_status,
            lr.leave_type_id, lt.code AS leave_type_code
     FROM approval_steps s
     JOIN leave_requests lr ON s.request_id = lr.id
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE s.id = ?`
  ).get(stepId);

  if (!step) {
    throw { status: 404, message: '결재 단계를 찾을 수 없습니다.' };
  }

  if (step.status !== 'pending') {
    throw { status: 400, message: '이미 처리된 결재 단계입니다.' };
  }

  if (step.request_status !== 'pending') {
    throw { status: 400, message: '이미 처리된 신청 건입니다.' };
  }

  // Validate actor: must be assigned_to or a delegate of assigned_to
  const isAssignee = step.assigned_to === actorId;
  const isDelegate = checkIsDelegate(step.assigned_to, actorId);

  if (!isAssignee && !isDelegate) {
    throw { status: 403, message: '결재 권한이 없습니다.' };
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  if (action === 'approve') {
    return handleApprove(db, step, actorId, comment, now, isDelegate);
  } else if (action === 'reject') {
    return handleReject(db, step, actorId, comment, now, isDelegate);
  } else {
    throw { status: 400, message: '유효하지 않은 결재 액션입니다.' };
  }
}

function handleApprove(db, step, actorId, comment, now, isDelegate) {
  // Check if there's a next step
  const nextStep = db.prepare(
    `SELECT id FROM approval_steps
     WHERE request_id = ? AND step_order > ? AND status = 'pending'
     ORDER BY step_order
     LIMIT 1`
  ).get(step.request_id, step.step_order);

  if (nextStep) {
    // Not the final step — just approve this step
    db.prepare(
      `UPDATE approval_steps
       SET status = 'approved', acted_by = ?, is_delegated = ?, comment = ?,
           read_at = COALESCE(read_at, ?), acted_at = ?
       WHERE id = ?`
    ).run(actorId, isDelegate ? 1 : 0, comment || null, now, now, step.id);

    // Notify next approver
    try {
      notify(getAssignedTo(nextStep.id), 'approval_request', { requestId: step.request_id });
    } catch (e) { /* ignore */ }

    return { finalApproval: false, requestId: step.request_id };
  }

  // Final step — approve the step AND the request, deduct balance
  const result = db.transaction(() => {
    // Approve the step
    db.prepare(
      `UPDATE approval_steps
       SET status = 'approved', acted_by = ?, is_delegated = ?, comment = ?,
           read_at = COALESCE(read_at, ?), acted_at = ?
       WHERE id = ?`
    ).run(actorId, isDelegate ? 1 : 0, comment || null, now, now, step.id);

    // Approve the request
    db.prepare(
      `UPDATE leave_requests SET status = 'approved' WHERE id = ?`
    ).run(step.request_id);

    // Deduct balance for leave types that consume annual leave (ANNUAL type)
    if (step.leave_type_code === 'ANNUAL' || step.leave_type_code === 'REWARD') {
      const year = getRequestYear(step.request_id);
      db.prepare(
        `UPDATE leave_balances SET used_days = used_days + ?
         WHERE employee_id = ? AND year = ?`
      ).run(step.total_days, step.applicant_id, year);
    }

    return { finalApproval: true, requestId: step.request_id };
  })();

  // Notify the applicant
  try {
    notify(step.applicant_id, 'approved', { requestId: step.request_id });
  } catch (e) { /* ignore */ }

  return result;
}

function handleReject(db, step, actorId, comment, now, isDelegate) {
  const result = db.transaction(() => {
    // Reject the step
    db.prepare(
      `UPDATE approval_steps
       SET status = 'rejected', acted_by = ?, is_delegated = ?, comment = ?,
           read_at = COALESCE(read_at, ?), acted_at = ?
       WHERE id = ?`
    ).run(actorId, isDelegate ? 1 : 0, comment || null, now, now, step.id);

    // Reject the request
    db.prepare(
      `UPDATE leave_requests SET status = 'rejected' WHERE id = ?`
    ).run(step.request_id);

    return { rejected: true, requestId: step.request_id };
  })();

  // Notify the applicant
  try {
    notify(step.applicant_id, 'rejected', { requestId: step.request_id });
  } catch (e) { /* ignore */ }

  return result;
}

/**
 * Get the year of the leave request start_date.
 */
function getRequestYear(requestId) {
  const db = getDatabase();
  const req = db.prepare('SELECT start_date FROM leave_requests WHERE id = ?').get(requestId);
  return req ? parseInt(req.start_date.substring(0, 4), 10) : new Date().getFullYear();
}

/**
 * Check if actorId is a delegate for employeeId.
 */
function checkIsDelegate(employeeId, actorId) {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT id FROM delegates WHERE employee_id = ? AND delegate_id = ?'
  ).get(employeeId, actorId);
  return !!row;
}

/**
 * Get the assigned_to for a step.
 */
function getAssignedTo(stepId) {
  const db = getDatabase();
  const step = db.prepare('SELECT assigned_to FROM approval_steps WHERE id = ?').get(stepId);
  return step ? step.assigned_to : null;
}

/**
 * Get full approval status for a request.
 *
 * @param {number} requestId
 * @returns {object[]} steps with assignee details
 */
function getApprovalStatus(requestId) {
  const db = getDatabase();

  const steps = db.prepare(
    `SELECT s.id, s.step_order, s.step_type, s.assigned_to, s.acted_by,
            s.is_delegated, s.status, s.approver_position, s.approver_dept_name,
            s.comment, s.read_at, s.acted_at, s.created_at,
            e_assigned.name AS assigned_name,
            e_acted.name AS acted_by_name
     FROM approval_steps s
     LEFT JOIN employees e_assigned ON s.assigned_to = e_assigned.id
     LEFT JOIN employees e_acted ON s.acted_by = e_acted.id
     WHERE s.request_id = ?
     ORDER BY s.step_order`
  ).all(requestId);

  return steps;
}

module.exports = {
  createApprovalSteps,
  processApproval,
  getApprovalStatus
};
