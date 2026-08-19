/**
 * Application configuration.
 *
 * CURRENT_DATE is deliberately a FIXED date rather than `new Date()`. The problem
 * statement specifies that the Date Intersect Calculator evaluates renewal dates
 * "against a fixed current date", and a fixed reference also makes the dashboard
 * reproducible for a reviewer: the same seed data always produces the same
 * "Renewing Soon" flags and the same alert count.
 */

export const config = {
  port: Number(process.env.PORT) || 3000,

  /** Reference "today" for every date calculation. Format: YYYY-MM-DD. */
  currentDate: process.env.CURRENT_DATE || '2026-08-19',

  /** A renewal falling within this many days of currentDate is flagged as urgent. */
  renewalWindowDays: 7,

  /** Currency used for presentation formatting on the client. */
  currency: 'INR',
  locale: 'en-IN',
};

export const BILLING_CYCLES = Object.freeze({
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
});

export const STATUSES = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
});

/** Months per year — the divisor used by the Cost Uniformity Engine. */
export const MONTHS_PER_YEAR = 12;
