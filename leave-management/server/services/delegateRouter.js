const { getDatabase } = require('../database/connection');
const { notify } = require('./notificationService');
const { formatDate } = require('../utils/dateUtils');

const MAX_DELEGATION_DEPTH = 2;

/**
 * Route a pending approval step to a delegate if the current assignee is absent.
 * Limits delegation chain to MAX_DELEGATION_DEPTH to prevent infinite loops.
 *
 * @param {number} stepId - approval_steps.id
 * @returns {{ routed: boolean, reason?: string, from?: number, to?: number }}
 */
function routeToDelegate(stepId) {
  const db = getDatabase();

  const step = db.prepare('SELECT * FROM approval_steps WHERE id = ?').get(stepId);
  if (!step) {
    return { routed: false, reason: 'step_not_found' };
  }

  if (step.status !== 'pending') {
    return { routed: false, reason: 'not_pending' };
  }

  const assignee = db.prepare('SELECT * FROM employees WHERE id = ?').get(step.assigned_to);
  if (!assignee) {
    return { routed: false, reason: 'assignee_not_found' };
  }

  if (!assignee.is_absent) {
    return { routed: false, reason: 'not_absent' };
  }

  // Count how many times this step has already been delegated by tracing the chain.
  // We use a simple heuristic: if is_delegated is already 1 and we are about to delegate again,
  // that counts as depth 2. We track depth by counting consecutive delegations on this step.
  // Since we only have is_delegated as a flag (not a counter), we check the notification history
  // to estimate depth. Simpler approach: count auto_delegate notifications for this request+step.
  const delegationCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM notifications
    WHERE type = 'auto_delegate'
      AND target_url = '/approvals'
      AND message LIKE '%대결자에게 전환%'
      AND id IN (
        SELECT id FROM notifications
        WHERE employee_id = ?
           OR employee_id IN (
             SELECT delegate_id FROM delegates WHERE employee_id = ?
           )
      )
  `).get(step.assigned_to, step.assigned_to);

  // Simpler depth check: if is_delegated is already 1, this would be a re-delegation (depth 2).
  // Allow up to MAX_DELEGATION_DEPTH total delegations.
  // We'll track depth by counting auto_delegate notifications specifically for this step's request.
  const existingDelegations = db.prepare(`
    SELECT COUNT(*) as cnt FROM notifications
    WHERE type = 'auto_delegate'
      AND target_url = '/approvals'
      AND message LIKE '%대결자에게 전환%'
  `).get();

  // Better approach: just check if current assignee was already a delegate (is_delegated=1)
  // and if the delegate we'd route to is also absent, we'd try their delegate.
  // For simplicity, allow re-delegation if depth < MAX_DELEGATION_DEPTH.
  // Track depth by: if is_delegated is 0, this is first delegation. If 1, this is second.
  // Beyond that, stop.
  // Actually, the step's is_delegated is just a boolean. Let's use a practical approach:
  // try to find a non-absent delegate in priority order, but limit total attempts.

  let currentEmployeeId = step.assigned_to;
  let delegateFound = null;
  let originalAssignedTo = step.assigned_to;
  let depth = step.is_delegated ? 1 : 0;

  if (depth >= MAX_DELEGATION_DEPTH) {
    return { routed: false, reason: 'max_delegation_depth' };
  }

  // Try priority 1 delegate first, then priority 2
  const delegates = db.prepare(`
    SELECT d.delegate_id, d.priority, e.name, e.position, e.status, e.is_absent, e.department_id
    FROM delegates d
    JOIN employees e ON e.id = d.delegate_id
    WHERE d.employee_id = ?
    ORDER BY d.priority ASC
  `).all(currentEmployeeId);

  for (const del of delegates) {
    if (del.status === 'active' && !del.is_absent) {
      delegateFound = del;
      break;
    }
  }

  if (!delegateFound) {
    return { routed: false, reason: 'no_delegate' };
  }

  // Get delegate's department name for snapshot
  const delegateDept = db.prepare('SELECT name FROM departments WHERE id = ?').get(delegateFound.department_id);
  const deptName = delegateDept ? delegateDept.name : '';

  // Update the approval step
  db.prepare(`
    UPDATE approval_steps
    SET assigned_to = ?, is_delegated = 1, approver_position = ?, approver_dept_name = ?
    WHERE id = ?
  `).run(delegateFound.delegate_id, delegateFound.position, deptName, stepId);

  // Get the original assignee name for notifications
  const originalName = assignee.name;

  // Notify the delegate
  try {
    notify(delegateFound.delegate_id, 'delegate_request', {
      originalApproverName: originalName,
      requestId: step.request_id
    });
  } catch (err) {
    console.error('Failed to notify delegate:', err.message);
  }

  // Notify the original assignee about auto-delegation
  try {
    notify(originalAssignedTo, 'auto_delegate', {
      originalApproverName: originalName,
      requestId: step.request_id
    });
  } catch (err) {
    console.error('Failed to notify original assignee:', err.message);
  }

  console.log(`Delegate routed: step ${stepId}, from employee ${originalAssignedTo} to ${delegateFound.delegate_id}`);

  return {
    routed: true,
    from: originalAssignedTo,
    to: delegateFound.delegate_id
  };
}

/**
 * Check urgency of a leave request and route pending steps to delegates
 * if enough time has elapsed based on urgency thresholds.
 *
 * @param {number} requestId - leave_requests.id
 * @returns {{ requestId: number, urgency: string, thresholdHours: number, actions: Array }}
 */
function checkUrgencyAndRoute(requestId) {
  const db = getDatabase();

  const request = db.prepare(`
    SELECT lr.*, lt.name as leave_type_name
    FROM leave_requests lr
    LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.id = ?
  `).get(requestId);

  if (!request) {
    return { requestId, urgency: 'unknown', thresholdHours: 0, actions: [] };
  }

  if (request.status !== 'pending') {
    return { requestId, urgency: 'n/a', thresholdHours: 0, actions: [] };
  }

  // Get system settings for delegate timing
  const getSetting = (key, defaultVal) => {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
    return row ? parseFloat(row.value) : defaultVal;
  };

  const urgentHours = getSetting('delegate_urgent_hours', 0);
  const shortHours = getSetting('delegate_short_hours', 8);
  const normalHours = getSetting('delegate_normal_hours', 24);

  // Determine urgency
  const today = formatDate(new Date());
  const startDate = request.start_date;
  const daysDiff = Math.floor((new Date(startDate) - new Date(today)) / (1000 * 60 * 60 * 24));

  let urgency;
  let thresholdHours;

  if (request.is_urgent || daysDiff <= 1) {
    urgency = 'URGENT';
    thresholdHours = urgentHours;
  } else if (daysDiff <= 3) {
    urgency = 'SHORT';
    thresholdHours = shortHours;
  } else {
    urgency = 'NORMAL';
    thresholdHours = normalHours;
  }

  // Find all pending approval steps for this request
  const pendingSteps = db.prepare(`
    SELECT * FROM approval_steps
    WHERE request_id = ? AND status = 'pending'
    ORDER BY step_order ASC
  `).all(requestId);

  const actions = [];

  for (const step of pendingSteps) {
    // Calculate hours elapsed since step creation
    const createdAt = new Date(step.created_at);
    const now = new Date();
    const elapsedHours = (now - createdAt) / (1000 * 60 * 60);

    if (elapsedHours >= thresholdHours) {
      const result = routeToDelegate(step.id);
      actions.push({
        stepId: step.id,
        action: 'route_attempted',
        elapsedHours: Math.round(elapsedHours * 10) / 10,
        result
      });
    }
  }

  return { requestId, urgency, thresholdHours, actions };
}

/**
 * Get the current delegate routing status for all steps of a request.
 *
 * @param {number} requestId - leave_requests.id
 * @returns {Array<{ stepId, stepOrder, stepType, assignedTo, assigneeName, isDelegated, status }>}
 */
function getRoutingStatus(requestId) {
  const db = getDatabase();

  const steps = db.prepare(`
    SELECT
      s.id as step_id,
      s.step_order,
      s.step_type,
      s.assigned_to,
      e.name as assignee_name,
      s.is_delegated,
      s.status,
      s.approver_position,
      s.approver_dept_name,
      s.created_at
    FROM approval_steps s
    LEFT JOIN employees e ON e.id = s.assigned_to
    WHERE s.request_id = ?
    ORDER BY s.step_order ASC
  `).all(requestId);

  return steps.map(s => ({
    stepId: s.step_id,
    stepOrder: s.step_order,
    stepType: s.step_type,
    assignedTo: s.assigned_to,
    assigneeName: s.assignee_name,
    isDelegated: !!s.is_delegated,
    status: s.status,
    approverPosition: s.approver_position,
    approverDeptName: s.approver_dept_name,
    createdAt: s.created_at
  }));
}

module.exports = { routeToDelegate, checkUrgencyAndRoute, getRoutingStatus };
