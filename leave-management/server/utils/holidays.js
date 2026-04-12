const { getDatabase } = require('../database/connection');
const { isWeekend, parseDate, formatDate, diffBusinessDays } = require('./dateUtils');
const { addDays: addDaysFn, differenceInCalendarDays } = require('date-fns');

/**
 * Get all holiday date strings for a given year
 * @param {number} year
 * @returns {string[]} array of YYYY-MM-DD strings
 */
function getHolidaysForYear(year) {
  const db = getDatabase();
  const rows = db.prepare('SELECT date FROM holidays WHERE year = ?').all(year);
  return rows.map(r => r.date);
}

/**
 * Get holiday date strings within a date range (inclusive)
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {string[]}
 */
function getHolidaysInRange(startDate, endDate) {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT date FROM holidays WHERE date >= ? AND date <= ? ORDER BY date'
  ).all(startDate, endDate);
  return rows.map(r => r.date);
}

/**
 * Check if a date string is a holiday
 * @param {string} dateStr YYYY-MM-DD
 * @returns {boolean}
 */
function isHoliday(dateStr) {
  const db = getDatabase();
  const row = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
  return !!row;
}

/**
 * Count business days in a date range, excluding weekends and holidays
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {number}
 */
function getBusinessDaysInRange(startDate, endDate) {
  const holidays = getHolidaysInRange(startDate, endDate);
  return diffBusinessDays(startDate, endDate, holidays);
}

module.exports = {
  getHolidaysForYear,
  getHolidaysInRange,
  isHoliday,
  getBusinessDaysInRange
};
