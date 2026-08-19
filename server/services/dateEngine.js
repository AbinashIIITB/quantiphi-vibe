import { config } from '../config/index.js';

/**
 * DATE INTERSECT CALCULATOR
 * -------------------------
 * Evaluates a subscription's renewal date against a fixed reference "today"
 * (server/config/index.js) to determine how many days remain until the next
 * billing event, and whether that event falls inside the urgent window.
 *
 * Dates are parsed as UTC midnight on both sides of the diff. Comparing local
 * time against UTC (or vice versa) is the classic source of an off-by-one day
 * near midnight or across a DST boundary; anchoring both sides to UTC avoids it.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parses a YYYY-MM-DD string into a UTC-midnight Date. */
function parseIsoDateUTC(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Days remaining until `isoDate`, relative to the app's fixed current date.
 * Negative values mean the date has already passed.
 *
 * @param {string} isoDate YYYY-MM-DD
 * @param {string} [referenceDate] YYYY-MM-DD, defaults to config.currentDate
 * @returns {number}
 */
export function daysUntilRenewal(isoDate, referenceDate = config.currentDate) {
  const target = parseIsoDateUTC(isoDate);
  const reference = parseIsoDateUTC(referenceDate);
  return Math.round((target.getTime() - reference.getTime()) / MS_PER_DAY);
}

/**
 * True when a renewal is today or within the configured alert window
 * (inclusive), and has not already passed.
 *
 * @param {number} days Result of daysUntilRenewal.
 * @returns {boolean}
 */
export function isRenewingSoon(days) {
  return days >= 0 && days <= config.renewalWindowDays;
}
