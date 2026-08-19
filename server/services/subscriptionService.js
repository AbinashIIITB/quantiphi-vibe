import * as repository from '../repositories/subscriptionRepository.js';
import { createSubscription } from '../models/Subscription.js';
import { validateSubscriptionInput } from '../validators/subscriptionValidator.js';
import { toMonthlyRate, round2 } from './costEngine.js';

/**
 * Subscription orchestration layer.
 *
 * Everything the dashboard displays is derived here, on the server. The client
 * receives finished numbers and only formats them for display — it never
 * normalizes a billing cycle or computes a total of its own.
 */

/**
 * Attaches server-computed fields to a stored subscription.
 *
 * `monthlyCost` is the Cost Uniformity Engine's output: the subscription's cost
 * expressed as a monthly rate regardless of how it is actually billed.
 *
 * @param {import('../models/Subscription.js').Subscription} subscription
 */
function enrich(subscription) {
  return {
    ...subscription,
    monthlyCost: round2(toMonthlyRate(subscription.cost, subscription.billingCycle)),
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
