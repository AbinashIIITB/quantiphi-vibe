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
 * Lists every subscription, enriched with derived fields.
 * Sorted by nearest renewal date first, so the most urgent rows sit at the top.
 */
export function listSubscriptions() {
  return repository
    .findAll()
    .map(enrich)
    .sort((a, b) => a.nextRenewalDate.localeCompare(b.nextRenewalDate));
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
 * Computes the dashboard metrics row.
 *
 * @returns {{
 *   totalMonthlyBurn: number,
 *   upcomingRenewalsCount: number,
 *   activeCount: number,
 *   pausedCount: number,
 *   pausedMonthlySavings: number,
 * }}
 */
export function getMetrics() {
  const all = repository.findAll();
  const enriched = all.map(enrich);

  const activeCount = enriched.filter((sub) => sub.status === STATUSES.ACTIVE).length;
  const pausedCount = enriched.length - activeCount;

  // The alert card counts money that is actually about to leave the account, so
  // paused subscriptions are excluded here even though their row still carries
  // the date-driven "Renewing Soon" badge.
  const upcomingRenewalsCount = enriched.filter(
    (sub) => sub.renewingSoon && sub.status === STATUSES.ACTIVE,
  ).length;

  return {
    totalMonthlyBurn: calculateTotalMonthlyBurn(all),
    upcomingRenewalsCount,
    activeCount,
    pausedCount,
    pausedMonthlySavings: calculatePausedSavings(all),
  };
}
