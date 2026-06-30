// shared/utils/dates.js
// Date calculations for cycle due dates
// Handles SA public holidays and weekends

// SA public holidays fixed dates (MM-DD format)
const FIXED_HOLIDAYS = [
  '01-01', // New Year's Day
  '03-21', // Human Rights Day
  '04-27', // Freedom Day
  '05-01', // Workers Day
  '06-16', // Youth Day
  '08-09', // National Women's Day
  '09-24', // Heritage Day
  '12-16', // Day of Reconciliation
  '12-25', // Christmas Day
  '12-26', // Day of Goodwill
];

/**
 * Calculate Easter Sunday for a given year
 * Uses the Anonymous Gregorian algorithm
 */
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Get all SA public holidays for a given year
 * including Easter-based holidays
 */
function getSAHolidays(year) {
  const holidays = new Set();

  // Add fixed holidays
  FIXED_HOLIDAYS.forEach(mmdd => {
    holidays.add(`${year}-${mmdd}`);
  });

  // Easter-based holidays
  const easter = getEasterSunday(year);

  // Good Friday 2 days before Easter
  const goodFriday = new Date(easter);
  goodFriday.setDate(goodFriday.getDate() - 2);
  holidays.add(formatDate(goodFriday));

  // Family Day day after Easter Monday
  const familyDay = new Date(easter);
  familyDay.setDate(familyDay.getDate() + 1);
  holidays.add(formatDate(familyDay));

  return holidays;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if a date is a weekend
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if a date is a SA public holiday
 */
function isSAPublicHoliday(date) {
  const year     = date.getFullYear();
  const holidays = getSAHolidays(year);
  return holidays.has(formatDate(date));
}

/**
 * Check if a date is a working day
 */
function isWorkingDay(date) {
  return !isWeekend(date) && !isSAPublicHoliday(date);
}

/**
 * Move date back to the last working day before it
 * if it falls on a weekend or public holiday
 */
function toLastWorkingDay(date) {
  const result = new Date(date);
  while (!isWorkingDay(result)) {
    result.setDate(result.getDate() - 1);
  }
  return result;
}

/**
 * Calculate cycle due date
 * 30 days from activation, adjusted to last working day
 *
 * @param {Date} fromDate  group activation date
 * @param {number} cycleNumber 1, 2, or 3
 * @returns {Date} due date
 */
function calculateCycleDueDate(fromDate, cycleNumber) {
  const due = new Date(fromDate);

  // Each cycle is 30 days apart
  due.setDate(due.getDate() + (30 * cycleNumber));

  // Adjust to last working day if needed
  return toLastWorkingDay(due);
}

/**
 * Calculate days remaining until a date
 * Returns 0 if date is in the past
 */
function daysUntil(targetDate) {
  const now  = new Date();
  const diff = new Date(targetDate) - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Format a date for display
 * e.g. "Tuesday, 15 July 2026"
 */
function formatDisplayDate(date) {
  return new Date(date).toLocaleDateString('en-ZA', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

module.exports = {
  calculateCycleDueDate,
  isWorkingDay,
  isWeekend,
  isSAPublicHoliday,
  toLastWorkingDay,
  daysUntil,
  formatDisplayDate,
  getSAHolidays,
  formatDate,
};
