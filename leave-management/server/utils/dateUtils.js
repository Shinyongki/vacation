const {
  differenceInCalendarDays,
  differenceInMonths,
  differenceInYears,
  addDays: addDaysFn,
  parseISO,
  format,
  getDay,
  isValid
} = require('date-fns');

/**
 * Parse a YYYY-MM-DD string into a Date object (local time)
 */
function parseDate(dateStr) {
  const d = parseISO(dateStr);
  if (!isValid(d)) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }
  return d;
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
function formatDate(date) {
  if (typeof date === 'string') return date;
  return format(date, 'yyyy-MM-dd');
}

/**
 * Check if a YYYY-MM-DD date falls on Saturday(6) or Sunday(0)
 */
function isWeekend(dateStr) {
  const day = getDay(parseDate(dateStr));
  return day === 0 || day === 6;
}

/**
 * Add days to a date string, return YYYY-MM-DD
 */
function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  return formatDate(addDaysFn(d, days));
}

/**
 * Get decimal years of service between hireDate and referenceDate
 */
function getYearsOfService(hireDate, referenceDate) {
  const hire = parseDate(hireDate);
  const ref = parseDate(referenceDate);
  const totalDays = differenceInCalendarDays(ref, hire);
  return totalDays / 365.25;
}

/**
 * Get full (integer) years of service between hireDate and referenceDate
 */
function getFullYearsOfService(hireDate, referenceDate) {
  const hire = parseDate(hireDate);
  const ref = parseDate(referenceDate);
  return differenceInYears(ref, hire);
}

/**
 * Get integer months of service between hireDate and referenceDate
 */
function getMonthsOfService(hireDate, referenceDate) {
  const hire = parseDate(hireDate);
  const ref = parseDate(referenceDate);
  return differenceInMonths(ref, hire);
}

/**
 * Count business days between startDate and endDate (inclusive of both),
 * excluding weekends and provided holiday date strings.
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {string[]} holidays array of YYYY-MM-DD strings
 * @returns {number}
 */
function diffBusinessDays(startDate, endDate, holidays = []) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const totalDays = differenceInCalendarDays(end, start) + 1;

  if (totalDays <= 0) return 0;

  const holidaySet = new Set(holidays);
  let count = 0;

  for (let i = 0; i < totalDays; i++) {
    const current = addDaysFn(start, i);
    const dateStr = formatDate(current);
    const day = getDay(current);

    if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) {
      count++;
    }
  }

  return count;
}

module.exports = {
  getYearsOfService,
  getFullYearsOfService,
  getMonthsOfService,
  diffBusinessDays,
  isWeekend,
  formatDate,
  parseDate,
  addDays
};
