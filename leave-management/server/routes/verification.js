const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getDatabase } = require('../database/connection');
const { verifyExport } = require('../services/verificationService');

/**
 * POST /api/verification/verify
 * Verify an export by its verification code
 */
router.post('/verify',
  authenticateToken,
  requireRole('foundation'),
  (req, res) => {
    try {
      const { verificationCode } = req.body;

      if (!verificationCode) {
        return res.status(400).json({
          success: false,
          error: '검증코드를 입력해 주세요.'
        });
      }

      const result = verifyExport(verificationCode);

      return res.json({
        success: true,
        data: result
      });
    } catch (err) {
      console.error('Verification error:', err);
      return res.status(500).json({
        success: false,
        error: '검증 처리 중 오류가 발생했습니다.'
      });
    }
  }
);

/**
 * GET /api/verification/export-logs
 * List export logs with repeated-export warnings
 */
router.get('/export-logs',
  authenticateToken,
  requireRole('foundation'),
  (req, res) => {
    try {
      const { date_from, date_to, page = 1, limit = 20 } = req.query;
      const pageNum = Math.max(1, parseInt(page));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * pageSize;

      const db = getDatabase();

      let whereClauses = [];
      let params = [];

      if (date_from) {
        whereClauses.push('el.created_at >= ?');
        params.push(date_from);
      }
      if (date_to) {
        whereClauses.push('el.created_at <= ?');
        params.push(date_to + ' 23:59:59');
      }

      const whereStr = whereClauses.length > 0
        ? 'WHERE ' + whereClauses.join(' AND ')
        : '';

      // Count total
      const countRow = db.prepare(`
        SELECT COUNT(*) AS total FROM export_logs el ${whereStr}
      `).get(...params);

      // Fetch logs
      const rows = db.prepare(`
        SELECT
          el.id,
          el.export_type,
          el.date_from,
          el.date_to,
          el.verification_code,
          el.file_hash,
          el.created_at,
          e.name AS exported_by_name,
          e.employee_number AS exported_by_number
        FROM export_logs el
        JOIN employees e ON e.id = el.exported_by
        ${whereStr}
        ORDER BY el.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, pageSize, offset);

      // Detect repeated exports (same date_from + date_to appearing multiple times)
      const repeatCounts = db.prepare(`
        SELECT date_from, date_to, COUNT(*) AS cnt
        FROM export_logs
        GROUP BY date_from, date_to
        HAVING cnt > 1
      `).all();

      const repeatSet = new Set(
        repeatCounts.map(r => `${r.date_from}|${r.date_to}`)
      );

      const data = rows.map(row => ({
        ...row,
        isRepeated: repeatSet.has(`${row.date_from}|${row.date_to}`)
      }));

      return res.json({
        success: true,
        data: {
          items: data,
          total: countRow.total,
          page: pageNum,
          limit: pageSize,
          totalPages: Math.ceil(countRow.total / pageSize)
        }
      });
    } catch (err) {
      console.error('Export logs error:', err);
      return res.status(500).json({
        success: false,
        error: '내보내기 이력 조회 중 오류가 발생했습니다.'
      });
    }
  }
);

/**
 * GET /api/verification/adjustment-logs
 * List balance adjustments with bulk-adjustment warnings
 */
router.get('/adjustment-logs',
  authenticateToken,
  requireRole('foundation'),
  (req, res) => {
    try {
      const { date_from, date_to, employee_id, adjusted_by, page = 1, limit = 20 } = req.query;
      const pageNum = Math.max(1, parseInt(page));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * pageSize;

      const db = getDatabase();

      let whereClauses = [];
      let params = [];

      if (date_from) {
        whereClauses.push('ba.created_at >= ?');
        params.push(date_from);
      }
      if (date_to) {
        whereClauses.push('ba.created_at <= ?');
        params.push(date_to + ' 23:59:59');
      }
      if (employee_id) {
        whereClauses.push('lb.employee_id = ?');
        params.push(parseInt(employee_id));
      }
      if (adjusted_by) {
        whereClauses.push('ba.adjusted_by = ?');
        params.push(parseInt(adjusted_by));
      }

      const whereStr = whereClauses.length > 0
        ? 'WHERE ' + whereClauses.join(' AND ')
        : '';

      // Count total
      const countRow = db.prepare(`
        SELECT COUNT(*) AS total
        FROM balance_adjustments ba
        JOIN leave_balances lb ON lb.id = ba.balance_id
        ${whereStr}
      `).get(...params);

      // Fetch adjustment logs
      const rows = db.prepare(`
        SELECT
          ba.id,
          ba.amount,
          ba.reason,
          ba.created_at,
          target_emp.name AS target_name,
          target_emp.employee_number AS target_number,
          adjuster.name AS adjuster_name,
          adjuster.employee_number AS adjuster_number,
          ba.adjusted_by AS adjuster_id
        FROM balance_adjustments ba
        JOIN leave_balances lb ON lb.id = ba.balance_id
        JOIN employees target_emp ON target_emp.id = lb.employee_id
        JOIN employees adjuster ON adjuster.id = ba.adjusted_by
        ${whereStr}
        ORDER BY ba.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, pageSize, offset);

      // Detect bulk adjustments (5+ adjustments by same person on same day)
      const bulkRows = db.prepare(`
        SELECT adjusted_by, DATE(created_at) AS adj_date, COUNT(*) AS cnt
        FROM balance_adjustments
        GROUP BY adjusted_by, DATE(created_at)
        HAVING cnt >= 5
      `).all();

      const bulkSet = new Set(
        bulkRows.map(r => `${r.adjusted_by}|${r.adj_date}`)
      );

      const data = rows.map(row => ({
        ...row,
        isBulk: bulkSet.has(`${row.adjuster_id}|${row.created_at.substring(0, 10)}`)
      }));

      return res.json({
        success: true,
        data: {
          items: data,
          total: countRow.total,
          page: pageNum,
          limit: pageSize,
          totalPages: Math.ceil(countRow.total / pageSize)
        }
      });
    } catch (err) {
      console.error('Adjustment logs error:', err);
      return res.status(500).json({
        success: false,
        error: '조정 이력 조회 중 오류가 발생했습니다.'
      });
    }
  }
);

module.exports = router;
