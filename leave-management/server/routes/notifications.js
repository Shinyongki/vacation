const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user
 * Query params: ?unread=true, ?page=1, ?limit=20
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const employeeId = req.user.id;
    const unreadOnly = req.query.unread === 'true';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = 'WHERE employee_id = ?';
    const params = [employeeId];

    if (unreadOnly) {
      whereClause += ' AND is_read = 0';
    }

    // Get total count
    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM notifications ${whereClause}`
    ).get(...params);
    const total = countRow.total;

    // Get unread count (always, regardless of filter)
    const unreadRow = db.prepare(
      'SELECT COUNT(*) as cnt FROM notifications WHERE employee_id = ? AND is_read = 0'
    ).get(employeeId);
    const unreadCount = unreadRow.cnt;

    // Get notifications
    const notifications = db.prepare(
      `SELECT id, type, title, message, target_url, is_read, created_at
       FROM notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    const mapped = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      targetUrl: n.target_url,
      isRead: n.is_read === 1,
      createdAt: n.created_at
    }));

    return res.json({
      success: true,
      data: {
        notifications: mapped,
        total,
        unreadCount
      }
    });
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    return res.status(500).json({
      success: false,
      error: '알림 목록을 불러오는 데 실패했습니다.'
    });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all unread notifications as read for the authenticated user
 * NOTE: This route must be defined BEFORE /:id/read to avoid route conflicts
 */
router.put('/read-all', (req, res) => {
  try {
    const db = getDatabase();
    const employeeId = req.user.id;

    const result = db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE employee_id = ? AND is_read = 0'
    ).run(employeeId);

    return res.json({
      success: true,
      data: {
        updatedCount: result.changes
      }
    });
  } catch (err) {
    console.error('Failed to mark all notifications as read:', err);
    return res.status(500).json({
      success: false,
      error: '알림을 읽음 처리하는 데 실패했습니다.'
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
router.put('/:id/read', (req, res) => {
  try {
    const db = getDatabase();
    const notificationId = parseInt(req.params.id);
    const employeeId = req.user.id;

    if (isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 알림 ID입니다.'
      });
    }

    // Validate notification belongs to user
    const notification = db.prepare(
      'SELECT id, employee_id FROM notifications WHERE id = ?'
    ).get(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: '알림을 찾을 수 없습니다.'
      });
    }

    if (notification.employee_id !== employeeId) {
      return res.status(403).json({
        success: false,
        error: '해당 알림에 대한 권한이 없습니다.'
      });
    }

    db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ?'
    ).run(notificationId);

    return res.json({
      success: true,
      data: { id: notificationId, isRead: true }
    });
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
    return res.status(500).json({
      success: false,
      error: '알림을 읽음 처리하는 데 실패했습니다.'
    });
  }
});

module.exports = router;
