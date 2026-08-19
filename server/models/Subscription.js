import { randomUUID } from 'node:crypto';
import { STATUSES } from '../config/index.js';

/**
 * @typedef {Object} Subscription
 * @property {string}  id               Stable identifier.
 * @property {string}  name             Service name, e.g. "Netflix".
 * @property {number}  cost             Amount charged per billing cycle.
 * @property {'monthly'|'yearly'} billingCycle
 * @property {string}  nextRenewalDate  ISO calendar date, YYYY-MM-DD.
 * @property {'active'|'paused'} status
 * @property {string}  createdAt        ISO timestamp.
 */

/**
 * Builds a Subscription from already-validated input.
 * New subscriptions always start Active.
 *
 * @param {{name: string, cost: number, billingCycle: string, nextRenewalDate: string}} input
 * @returns {Subscription}
 */
export function createSubscription(input) {
  return {
    id: randomUUID(),
    name: input.name,
    cost: input.cost,
    billingCycle: input.billingCycle,
    nextRenewalDate: input.nextRenewalDate,
    status: STATUSES.ACTIVE,
    createdAt: new Date().toISOString(),
  };
}
