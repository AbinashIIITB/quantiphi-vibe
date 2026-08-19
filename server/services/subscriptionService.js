import * as repository from '../repositories/subscriptionRepository.js';
import { createSubscription } from '../models/Subscription.js';
import { validateSubscriptionInput, validateStatusInput } from '../validators/subscriptionValidator.js';
import { toMonthlyRate, calculateTotalMonthlyBurn, calculatePausedSavings, round2 } from './costEngine.js';
import { daysUntilRenewal, isRenewingSoon } from './dateEngine.js';
import { STATUSES, config } from '../config/index.js';
import { ApiError } from '../core/ApiError.js';

/**
 * Subscription orchestration layer.
 *
 * Everything the dashboard displays is derived here, on the server. The client
 * receives finished numbers and flags and only formats them for display — it
 * never normalizes a billing cycle, computes a total, or decides urgency.
 */

/**
 * Attaches server-computed fields to a stored subscription:
 * - `monthlyCost`: Cost Uniformity Engine output.
 * - `daysUntilRenewal` / `renewingSoon`: Date Intersect Calculator output.
 *
 * `renewingSoon` is purely date-derived, exactly as the brief defines the badge:
 * a renewal date falling within the alert window flags the row regardless of
 * whether the subscription is currently paused. Status is a separate concern and
 * is applied where it actually belongs — the burn rate and the alert count.
 *
 * @param {import('../models/Subscription.js').Subscription} subscription
 */
function enrich(subscription) {
  const days = daysUntilRenewal(subscription.nextRenewalDate);
  return {
    ...subscription,
    monthlyCost: round2(toMonthlyRate(subscription.cost, subscription.billingCycle)),
    daysUntilRenewal: days,
    renewingSoon: isRenewingSoon(days),
  };
}

/**
 * Nearest renewal first, so the most urgent rows sit at the top of the grid.
 * ISO dates sort correctly as plain strings, so no Date objects are allocated.
 */
function byRenewalDate(a, b) {
  return a.nextRenewalDate < b.nextRenewalDate ? -1 : a.nextRenewalDate > b.nextRenewalDate ? 1 : 0;
}

/**
 * Validates the entry form payload and stores a new subscription.
 *
 * @param {unknown} payload Raw request body.
 * @returns {object} The created subscription, enriched.
 */
export function addSubscription(payload) {
  const validated = validateSubscriptionInput(payload);
  const created = repository.insert(createSubscription(validated));
  return enrich(created);
}

/**
 * Toggles a subscription between Active and Paused.
 *
 * This never removes the record — pausing only flips `status`, which is the
 * flag calculateTotalMonthlyBurn filters on. The row stays in the collection
 * and its cost simply drops out of (or back into) the burn-rate sum.
 *
 * @param {string} id
 * @param {unknown} payload Raw request body, expects `{ status }`.
 * @returns {object} The updated subscription, enriched.
 */
export function setSubscriptionStatus(id, payload) {
  const status = validateStatusInput(payload);
  const updated = repository.update(id, { status });
  if (!updated) throw ApiError.notFound(`No subscription with id "${id}"`);
  return enrich(updated);
}

/**
 * Deletes a subscription outright.
 *
 * @param {string} id
 */
export function deleteSubscription(id) {
  const removed = repository.remove(id);
  if (!removed) throw ApiError.notFound(`No subscription with id "${id}"`);
}

/**
 * Presentation settings the client needs but must not decide for itself:
 * the currency and locale to format with, the reference date the renewal
 * maths ran against, and the size of the alert window.
 *
 * Serving these keeps the 7-day rule and the currency defined in exactly one
 * place — server/config/index.js — instead of being duplicated in the UI.
 */
export function getDisplayMeta() {
  return {
    currency: config.currency,
    locale: config.locale,
    currentDate: config.currentDate,
    renewalWindowDays: config.renewalWindowDays,
  };
}

/**
 * @typedef {Object} Metrics
 * @property {number} totalMonthlyBurn      Sum of active monthly rates.
 * @property {number} upcomingRenewalsCount Active renewals inside the alert window.
 * @property {number} activeCount
 * @property {number} pausedCount
 * @property {number} pausedMonthlySavings  Monthly cost currently paused.
 */

/**
 * Derives the metrics row from an already-enriched list.
 *
 * Taking the enriched array as an argument rather than re-reading the store is
 * what lets `getDashboard` compute the whole payload from a single pass of
 * enrichment instead of doing the date and cost maths twice per request.
 *
 * @param {object[]} enriched Output of `enrich`, one entry per subscription.
 * @returns {Metrics}
 */
function computeMetrics(enriched) {
  let activeCount = 0;
  let upcomingRenewalsCount = 0;

  for (const sub of enriched) {
    if (sub.status !== STATUSES.ACTIVE) continue;
    activeCount += 1;
    // The alert card counts money about to leave the account, so paused rows are
    // excluded here even though they still carry the date-driven badge.
    if (sub.renewingSoon) upcomingRenewalsCount += 1;
  }

  return {
    totalMonthlyBurn: calculateTotalMonthlyBurn(enriched),
    upcomingRenewalsCount,
    activeCount,
    pausedCount: enriched.length - activeCount,
    pausedMonthlySavings: calculatePausedSavings(enriched),
  };
}

/**
 * Computes the dashboard metrics row.
 *
 * @returns {Metrics}
 */
export function getMetrics() {
  return computeMetrics(repository.findAll().map(enrich));
}

/**
 * Everything needed to paint the dashboard, built from one pass over the store.
 *
 * Every endpoint that changes state returns this same shape, so the client can
 * repaint directly from the mutation response instead of following it with a
 * second GET — one round trip per action instead of two, with the server still
 * the sole authority on every number.
 *
 * @returns {{subscriptions: object[], metrics: Metrics, meta: object}}
 */
export function getDashboard() {
  const enriched = repository.findAll().map(enrich);
  // Metrics are order-independent, so the in-place sort afterwards is safe.
  const metrics = computeMetrics(enriched);

  return {
    subscriptions: enriched.sort(byRenewalDate),
    metrics,
    meta: getDisplayMeta(),
  };
}
