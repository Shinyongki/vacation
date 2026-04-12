const { getDatabase } = require('../database/connection');

/**
 * Notification type templates
 */
const NOTIFICATION_TEMPLATES = {
  approval_request: {
    title: '결재 요청',
    message: (p) => `${p.requesterName}님이 ${p.leaveTypeName} 결재를 요청했습니다.`,
    targetUrl: () => '/approvals'
  },
  approved: {
    title: '휴가 승인',
    message: (p) => `${p.leaveTypeName} 신청이 최종 승인되었습니다.`,
    targetUrl: (p) => `/leaves/${p.requestId}`
  },
  rejected: {
    title: '휴가 반려',
    message: (p) => `${p.leaveTypeName} 신청이 반려되었습니다. 사유: ${p.comment}`,
    targetUrl: (p) => `/leaves/${p.requestId}`
  },
  delegate_request: {
    title: '대결 요청',
    message: (p) => `${p.originalApproverName}님의 대결 건이 있습니다.`,
    targetUrl: () => '/approvals'
  },
  cancelled: {
    title: '휴가 취소',
    message: (p) => `${p.requesterName}님이 ${p.leaveTypeName} 신청을 취소했습니다.`,
    targetUrl: (p) => `/leaves/${p.requestId}`
  },
  urgent: {
    title: '긴급 휴가',
    message: (p) => `${p.requesterName}님이 긴급 ${p.leaveTypeName}을(를) 신청했습니다.`,
    targetUrl: () => '/approvals'
  },
  auto_delegate: {
    title: '자동 대결 전환',
    message: (p) => `${p.originalApproverName}님 부재로 대결자에게 전환되었습니다.`,
    targetUrl: () => '/approvals'
  },
  unprocessed_warning: {
    title: '미처리 경고',
    message: (p) => `처리 대기 중인 결재 건이 ${p.count}건 있습니다.`,
    targetUrl: () => '/approvals'
  },
  recalled: {
    title: '휴가 회수',
    message: (p) => `${p.requesterName}님이 ${p.leaveTypeName} 신청을 회수했습니다.`,
    targetUrl: (p) => `/leaves/${p.requestId}`
  }
};

/**
 * Create a single notification
 * @param {number} employeeId - Target employee ID
 * @param {string} type - Notification type (one of 9 types)
 * @param {object} params - Context-specific parameters for building title/message/target_url
 * @returns {object} The created notification row
 */
function notify(employeeId, type, params = {}) {
  const db = getDatabase();
  const template = NOTIFICATION_TEMPLATES[type];

  if (!template) {
    console.error(`Unknown notification type: ${type}`);
    return null;
  }

  const title = template.title;
  const message = template.message(params);
  const targetUrl = template.targetUrl(params);

  const stmt = db.prepare(`
    INSERT INTO notifications (employee_id, type, title, message, target_url)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(employeeId, type, title, message, targetUrl);

  return {
    id: result.lastInsertRowid,
    employeeId,
    type,
    title,
    message,
    targetUrl
  };
}

/**
 * Create notifications for multiple recipients
 * @param {number[]} employeeIds - Array of target employee IDs
 * @param {string} type - Notification type
 * @param {object} params - Context-specific parameters
 * @returns {object[]} Array of created notification summaries
 */
function notifyMultiple(employeeIds, type, params = {}) {
  const db = getDatabase();
  const template = NOTIFICATION_TEMPLATES[type];

  if (!template) {
    console.error(`Unknown notification type: ${type}`);
    return [];
  }

  const title = template.title;
  const message = template.message(params);
  const targetUrl = template.targetUrl(params);

  const stmt = db.prepare(`
    INSERT INTO notifications (employee_id, type, title, message, target_url)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((ids) => {
    const results = [];
    for (const empId of ids) {
      const result = stmt.run(empId, type, title, message, targetUrl);
      results.push({
        id: result.lastInsertRowid,
        employeeId: empId,
        type,
        title,
        message,
        targetUrl
      });
    }
    return results;
  });

  return insertMany(employeeIds);
}

module.exports = { notify, notifyMultiple };
