const cron = require('node-cron');
const { getDatabase } = require('../database/connection');
const { routeToDelegate } = require('./delegateRouter');
const { calculateAnnualLeave } = require('./leaveCalculator');
const { notify } = require('./notificationService');
const { formatDate } = require('../utils/dateUtils');

const jobs = [];

/**
 * Job 1: Auto-delegate check
 * Runs every 30 minutes. Finds pending approval steps where the assignee
 * is absent and routes them to a delegate based on urgency thresholds.
 * At 50% of threshold, sends an unprocessed_warning notification.
 * At 100% of threshold, performs the actual delegate routing.
 */
function runAutoDelegateCheck() {
  try {
    const db = getDatabase();

    // Find all pending approval steps where assignee is absent
    // and the leave request is still pending
    const pendingSteps = db.prepare(`
      SELECT
        s.id as step_id,
        s.request_id,
        s.assigned_to,
        s.created_at,
        s.is_delegated,
        lr.is_urgent,
        lr.start_date,
        lr.status as request_status,
        e.name as assignee_name,
        e.is_absent
      FROM approval_steps s
      JOIN leave_requests lr ON lr.id = s.request_id
      JOIN employees e ON e.id = s.assigned_to
      WHERE s.status = 'pending'
        AND lr.status = 'pending'
    `).all();

    if (pendingSteps.length === 0) return;

    // Get system settings for delegate timing
    const getSetting = (key, defaultVal) => {
      const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
      return row ? parseFloat(row.value) : defaultVal;
    };

    const urgentHours = getSetting('delegate_urgent_hours', 0);
    const shortHours = getSetting('delegate_short_hours', 8);
    const normalHours = getSetting('delegate_normal_hours', 24);

    const today = formatDate(new Date());
    let routedCount = 0;
    let warnedCount = 0;

    for (const step of pendingSteps) {
      // Determine urgency
      const daysDiff = Math.floor(
        (new Date(step.start_date) - new Date(today)) / (1000 * 60 * 60 * 24)
      );

      let thresholdHours;
      if (step.is_urgent || daysDiff <= 1) {
        thresholdHours = urgentHours;
      } else if (daysDiff <= 3) {
        thresholdHours = shortHours;
      } else {
        thresholdHours = normalHours;
      }

      // Calculate elapsed hours since step creation
      const createdAt = new Date(step.created_at);
      const now = new Date();
      const elapsedHours = (now - createdAt) / (1000 * 60 * 60);

      // At 100% threshold: route to delegate (only if assignee is absent)
      if (elapsedHours >= thresholdHours && step.is_absent) {
        const result = routeToDelegate(step.step_id);
        if (result.routed) {
          routedCount++;
          console.log(
            `Auto-delegate: step ${step.step_id} routed from ${result.from} to ${result.to}`
          );
        }
      }
      // At 50% threshold: send unprocessed warning (regardless of absence)
      else if (thresholdHours > 0 && elapsedHours >= thresholdHours * 0.5) {
        // Check if warning was already sent to avoid duplicates
        const existingWarning = db.prepare(`
          SELECT id FROM notifications
          WHERE employee_id = ?
            AND type = 'unprocessed_warning'
            AND created_at >= ?
        `).get(step.assigned_to, step.created_at);

        if (!existingWarning) {
          try {
            // Count pending steps for this assignee
            const pendingCount = db.prepare(`
              SELECT COUNT(*) as cnt FROM approval_steps
              WHERE assigned_to = ? AND status = 'pending'
            `).get(step.assigned_to);

            notify(step.assigned_to, 'unprocessed_warning', {
              count: pendingCount ? pendingCount.cnt : 1
            });
            warnedCount++;
            console.log(
              `Unprocessed warning sent to employee ${step.assigned_to} for step ${step.step_id}`
            );
          } catch (err) {
            console.error('Failed to send unprocessed warning:', err.message);
          }
        }
      }
    }

    if (routedCount > 0 || warnedCount > 0) {
      console.log(
        `Auto-delegate check complete: ${routedCount} routed, ${warnedCount} warned`
      );
    }
  } catch (err) {
    console.error('Auto-delegate check failed:', err.message);
  }
}

/**
 * Job 2: Auto absence release
 * Runs daily at midnight. Releases absent status for employees
 * whose return date has arrived.
 */
function runAbsenceRelease() {
  try {
    const db = getDatabase();
    const today = formatDate(new Date());

    const absentEmployees = db.prepare(`
      SELECT id, name FROM employees
      WHERE is_absent = 1
        AND absent_return_date IS NOT NULL
        AND absent_return_date <= ?
    `).all(today);

    if (absentEmployees.length === 0) return;

    const updateStmt = db.prepare(`
      UPDATE employees
      SET is_absent = 0, absent_return_date = NULL, updated_at = datetime('now','localtime')
      WHERE id = ?
    `);

    const releaseAll = db.transaction((employees) => {
      for (const emp of employees) {
        updateStmt.run(emp.id);
        console.log(`Auto-released absence for employee ${emp.name} (${emp.id})`);
      }
    });

    releaseAll(absentEmployees);
    console.log(`Absence release complete: ${absentEmployees.length} employee(s) released`);
  } catch (err) {
    console.error('Absence release failed:', err.message);
  }
}

/**
 * Job 3: Annual leave calculation
 * Runs on January 1 at midnight. Calculates and assigns annual leave
 * entitlements for all active employees for the new year.
 */
function runAnnualLeaveCalculation() {
  try {
    const db = getDatabase();
    const newYear = new Date().getFullYear();

    const activeEmployees = db.prepare(`
      SELECT id, name, hire_date FROM employees
      WHERE status = 'active'
    `).all();

    if (activeEmployees.length === 0) return;

    const upsertStmt = db.prepare(`
      INSERT INTO leave_balances (employee_id, year, total_days, used_days, adjusted_days, calc_detail)
      VALUES (?, ?, ?, 0, 0, ?)
      ON CONFLICT(employee_id, year) DO UPDATE SET
        total_days = excluded.total_days,
        calc_detail = excluded.calc_detail
    `);

    const calculateAll = db.transaction((employees) => {
      let count = 0;
      for (const emp of employees) {
        try {
          const result = calculateAnnualLeave(emp.hire_date, newYear);
          upsertStmt.run(
            emp.id,
            newYear,
            result.totalDays,
            JSON.stringify(result.calcDetail)
          );
          count++;
        } catch (err) {
          console.error(
            `Annual leave calculation failed for employee ${emp.name} (${emp.id}):`,
            err.message
          );
        }
      }
      return count;
    });

    const count = calculateAll(activeEmployees);
    console.log(`Annual leave calculated for ${count} employees for year ${newYear}`);
  } catch (err) {
    console.error('Annual leave calculation failed:', err.message);
  }
}

/**
 * Start all scheduled cron jobs.
 * Should be called explicitly from the application entry point.
 *
 * @returns {Array} Array of cron job references
 */
function startScheduler() {
  // Job 1: Auto-delegate check every 30 minutes
  const autoDelegateJob = cron.schedule('*/30 * * * *', () => {
    console.log('Running auto-delegate check...');
    runAutoDelegateCheck();
  });
  jobs.push(autoDelegateJob);

  // Job 2: Absence release daily at midnight
  const absenceReleaseJob = cron.schedule('0 0 * * *', () => {
    console.log('Running absence release check...');
    runAbsenceRelease();
  });
  jobs.push(absenceReleaseJob);

  // Job 3: Annual leave calculation on January 1 at midnight
  const annualLeaveJob = cron.schedule('0 0 1 1 *', () => {
    console.log('Running annual leave calculation...');
    runAnnualLeaveCalculation();
  });
  jobs.push(annualLeaveJob);

  console.log('Scheduler started: 3 cron jobs registered');
  return jobs;
}

/**
 * Stop all running cron jobs.
 */
function stopScheduler() {
  for (const job of jobs) {
    job.stop();
  }
  jobs.length = 0;
  console.log('Scheduler stopped: all cron jobs cleared');
}

module.exports = { startScheduler, stopScheduler };
