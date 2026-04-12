const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getDatabase } = require('../database/connection');
const { processApproval } = require('../services/approvalEngine');

// ============================================================
// GET /api/approvals/pending — My pending approvals
// ============================================================
router.get('/pending', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Count
    const countRow = db.prepare(
      `SELECT COUNT(*) AS cnt
       FROM approval_steps s
       JOIN leave_requests lr ON s.request_id = lr.id
       WHERE s.assigned_to = ? AND s.status = 'pending' AND lr.status = 'pending'`
    ).get(req.user.id);

    // Fetch pending steps with request details
    const rows = db.prepare(
      `SELECT s.id AS step_id, s.step_order, s.step_type, s.created_at AS step_created_at,
              s.read_at,
              lr.id AS request_id, lr.start_date, lr.end_date, lr.total_days,
              lr.half_day_type, lr.reason, lr.is_urgent, lr.urgent_reason,
              lr.is_retroactive, lr.created_at AS request_created_at,
              lr.status AS request_status,
              lt.name AS leave_type_name, lt.code AS leave_type_code,
              e.name AS applicant_name, e.employee_number AS applicant_number,
              d.name AS applicant_dept
       FROM approval_steps s
       JOIN leave_requests lr ON s.request_id = lr.id
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE s.assigned_to = ? AND s.status = 'pending' AND lr.status = 'pending'
       ORDER BY lr.is_urgent DESC, lr.created_at ASC
       LIMIT ? OFFSET ?`
    ).all(req.user.id, limitNum, offset);

    // Mark read_at for fetched steps
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const updateRead = db.prepare(
      `UPDATE approval_steps SET read_at = ? WHERE id = ? AND read_at IS NULL`
    );
    for (const row of rows) {
      updateRead.run(now, row.step_id);
    }

    // Get full approval chain for each request
    const stepsStmt = db.prepare(
      `SELECT s.step_order, s.step_type, s.status, e.name AS assignee_name
       FROM approval_steps s
       LEFT JOIN employees e ON s.assigned_to = e.id
       WHERE s.request_id = ?
       ORDER BY s.step_order`
    );

    const data = rows.map(row => {
      const allSteps = stepsStmt.all(row.request_id);
      const currentStepIdx = allSteps.findIndex(s => s.status === 'pending');

      // Calculate days since request was created
      const createdDate = new Date(row.request_created_at);
      const daysSinceCreated = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        stepId: row.step_id,
        stepOrder: row.step_order,
        stepType: row.step_type,
        readAt: row.read_at || now,
        requestId: row.request_id,
        applicantName: row.applicant_name,
        applicantNumber: row.applicant_number,
        applicantDept: row.applicant_dept,
        leaveTypeName: row.leave_type_name,
        leaveTypeCode: row.leave_type_code,
        startDate: row.start_date,
        endDate: row.end_date,
        totalDays: row.total_days,
        halfDayType: row.half_day_type,
        reason: row.reason,
        isUrgent: row.is_urgent,
        urgentReason: row.urgent_reason,
        isRetroactive: row.is_retroactive,
        requestCreatedAt: row.request_created_at,
        daysSinceCreated,
        approvalSteps: allSteps.map(s => ({
          stepType: s.step_type,
          status: s.status,
          assigneeName: s.assignee_name,
        })),
        currentStep: currentStepIdx >= 0 ? currentStepIdx : allSteps.length - 1,
      };
    });

    res.json({
      success: true,
      data: {
        approvals: data,
        pagination: {
          page: pageNum,
          pageSize: limitNum,
          total: countRow.cnt,
          totalPages: Math.ceil(countRow.cnt / limitNum)
        }
      }
    });
  } catch (err) {
    console.error('Error fetching pending approvals:', err);
    res.status(500).json({ success: false, error: '승인 대기 목록 조회 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// POST /api/approvals/:stepId/approve — Approve a step
// ============================================================
router.post('/:stepId/approve', authenticateToken, (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId, 10);
    const { comment } = req.body;

    const result = processApproval(stepId, req.user.id, 'approve', comment || null);

    res.json({
      success: true,
      data: {
        message: result.finalApproval ? '최종 승인되었습니다.' : '승인되었습니다.',
        finalApproval: result.finalApproval || false,
        requestId: result.requestId,
      }
    });
  } catch (err) {
    console.error('Error approving step:', err);
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: '승인 처리 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// POST /api/approvals/:stepId/reject — Reject a step
// ============================================================
router.post('/:stepId/reject', authenticateToken, (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId, 10);
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, error: '반려 사유를 입력해 주세요.' });
    }

    const result = processApproval(stepId, req.user.id, 'reject', comment.trim());

    res.json({
      success: true,
      data: {
        message: '반려되었습니다.',
        requestId: result.requestId,
      }
    });
  } catch (err) {
    console.error('Error rejecting step:', err);
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: '반려 처리 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// POST /api/approvals/batch — Batch approve (director only)
// ============================================================
router.post('/batch', authenticateToken, requireRole('director'), (req, res) => {
  try {
    const { stepIds, comment } = req.body;

    if (!stepIds || !Array.isArray(stepIds) || stepIds.length === 0) {
      return res.status(400).json({ success: false, error: '승인할 항목을 선택해 주세요.' });
    }

    const results = [];
    const errors = [];

    for (const stepId of stepIds) {
      try {
        const result = processApproval(stepId, req.user.id, 'approve', comment || null);
        results.push({ stepId, success: true, ...result });
      } catch (err) {
        errors.push({ stepId, success: false, error: err.message || '처리 실패' });
      }
    }

    res.json({
      success: true,
      data: {
        message: `${results.length}건 승인, ${errors.length}건 실패`,
        results,
        errors,
      }
    });
  } catch (err) {
    console.error('Error batch approving:', err);
    res.status(500).json({ success: false, error: '일괄 승인 처리 중 오류가 발생했습니다.' });
  }
});

// ============================================================
// GET /api/approvals/history — My approval history
// ============================================================
router.get('/history', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let dateFilter = '';
    const params = [req.user.id];

    if (startDate) {
      dateFilter += ' AND s.acted_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND s.acted_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    const countRow = db.prepare(
      `SELECT COUNT(*) AS cnt
       FROM approval_steps s
       WHERE s.assigned_to = ? AND s.status IN ('approved','rejected')
         AND s.step_type != 'draft'
         ${dateFilter}`
    ).get(...params);

    const rows = db.prepare(
      `SELECT s.id AS step_id, s.step_order, s.step_type, s.status AS step_status,
              s.comment, s.acted_at, s.is_delegated,
              lr.id AS request_id, lr.start_date, lr.end_date, lr.total_days,
              lr.status AS request_status,
              lt.name AS leave_type_name,
              e.name AS applicant_name, e.employee_number AS applicant_number,
              d.name AS applicant_dept
       FROM approval_steps s
       JOIN leave_requests lr ON s.request_id = lr.id
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE s.assigned_to = ? AND s.status IN ('approved','rejected')
         AND s.step_type != 'draft'
         ${dateFilter}
       ORDER BY s.acted_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset);

    const data = rows.map(row => ({
      stepId: row.step_id,
      stepType: row.step_type,
      stepStatus: row.step_status,
      comment: row.comment,
      actedAt: row.acted_at,
      isDelegated: row.is_delegated,
      requestId: row.request_id,
      requestStatus: row.request_status,
      applicantName: row.applicant_name,
      applicantNumber: row.applicant_number,
      applicantDept: row.applicant_dept,
      leaveTypeName: row.leave_type_name,
      startDate: row.start_date,
      endDate: row.end_date,
      totalDays: row.total_days,
    }));

    res.json({
      success: true,
      data: {
        history: data,
        pagination: {
          page: pageNum,
          pageSize: limitNum,
          total: countRow.cnt,
          totalPages: Math.ceil(countRow.cnt / limitNum)
        }
      }
    });
  } catch (err) {
    console.error('Error fetching approval history:', err);
    res.status(500).json({ success: false, error: '결재 이력 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
