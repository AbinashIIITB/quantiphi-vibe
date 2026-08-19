import { BILLING_CYCLES, MONTHS_PER_YEAR, STATUSES } from '../config/index.js';

/**
 * COST UNIFORMITY ENGINE
 * ----------------------
 * Subscriptions arrive on different billing cycles, so their raw costs cannot be
 * added together meaningfully. This module normalizes every subscription to a
 * common unit — a monthly rate — which is what makes the dashboard's Total
 * Monthly Burn Rate a correct figure rather than a mixed-unit sum.
 *
 * Rule: monthly -> cost as-is; yearly -> cost / 12.
 */

/**
 * Normalizes one subscription's cost to its equivalent monthly rate.
 *
 * @param {number} cost
 * @param {'monthly'|'yearly'} billingCycle
 * @returns {number} Unrounded monthly rate.
 */
export function toMonthlyRate(cost, billingCycle) {
  if (billingCycle === BILLING_CYCLES.YEARLY) {
    return cost / MONTHS_PER_YEAR;
  }
  return cost;
}

/**
 * Sums the monthly rates of every subscription matching `predicate`.
 *
 * Filtering inside the loop rather than via `.filter().reduce()` keeps this to a
 * single pass with no intermediate array allocated per call — the metrics run on
 * every request, so the throwaway arrays add up.
 *
 * Rounding happens once, on the final total, rather than per subscription:
 * rounding each yearly item first (e.g. 1499/12 = 124.9166 -> 124.92) and then
 * summing would accumulate a few paise of drift across many rows.
 *
 * @param {import('../models/Subscription.js').Subscription[]} subscriptions
 * @param {(sub: import('../models/Subscription.js').Subscription) => boolean} [predicate]
 * @returns {number} Total monthly cost, rounded to 2 decimals.
 */
export function sumMonthlyRates(subscriptions, predicate) {
  let total = 0;
  for (const sub of subscriptions) {
    if (predicate && !predicate(sub)) continue;
    total += toMonthlyRate(sub.cost, sub.billingCycle);
  }
  return round2(total);
}

/** True when a subscription is currently active. */
const isActive = (sub) => sub.status === STATUSES.ACTIVE;

/** True when a subscription is currently paused. */
const isPaused = (sub) => sub.status === STATUSES.PAUSED;

/**
 * Total Monthly Burn Rate — the headline dashboard metric.
 *
 * Only ACTIVE subscriptions contribute. This single filter is the mechanism
 * behind the pause/resume savings simulation: pausing a row does not delete it,
 * it simply removes it from this sum.
 *
 * @param {import('../models/Subscription.js').Subscription[]} subscriptions
 * @returns {number}
 */
export function calculateTotalMonthlyBurn(subscriptions) {
  return sumMonthlyRates(subscriptions, isActive);
}

/**
 * The monthly amount currently being saved by paused subscriptions —
 * the "what if I cancelled these?" figure.
 *
 * @param {import('../models/Subscription.js').Subscription[]} subscriptions
 * @returns {number}
 */
export function calculatePausedSavings(subscriptions) {
  return sumMonthlyRates(subscriptions, isPaused);
}

/** Rounds to 2 decimal places. */
export function round2(value) {
  return Math.round(value * 100) / 100;
}
