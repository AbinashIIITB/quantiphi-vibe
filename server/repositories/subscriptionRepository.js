import { BILLING_CYCLES, STATUSES } from '../config/index.js';

/**
 * In-memory subscription store.
 *
 * Everything above this layer talks to these methods only, so swapping the Map
 * for a real database later means rewriting this one file and nothing else.
 * Records are cloned on the way out so callers cannot mutate stored state by
 * accident — only `update` changes what is held here.
 */

/** @type {Map<string, import('../models/Subscription.js').Subscription>} */
const store = new Map();

/** Seed data, so the dashboard is meaningful on first load. */
const SEED_SUBSCRIPTIONS = [
  {
    id: 'seed-netflix',
    name: 'Netflix',
    cost: 649,
    billingCycle: BILLING_CYCLES.MONTHLY,
    nextRenewalDate: '2026-08-23',
    status: STATUSES.ACTIVE,
    createdAt: '2026-01-05T10:00:00.000Z',
  },
  {
    id: 'seed-spotify',
    name: 'Spotify Premium',
    cost: 1499,
    billingCycle: BILLING_CYCLES.YEARLY,
    nextRenewalDate: '2026-08-21',
    status: STATUSES.ACTIVE,
    createdAt: '2026-01-08T10:00:00.000Z',
  },
  {
    id: 'seed-github',
    name: 'GitHub Copilot',
    cost: 850,
    billingCycle: BILLING_CYCLES.MONTHLY,
    nextRenewalDate: '2026-09-14',
    status: STATUSES.ACTIVE,
    createdAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'seed-adobe',
    name: 'Adobe Creative Cloud',
    cost: 42000,
    billingCycle: BILLING_CYCLES.YEARLY,
    nextRenewalDate: '2026-11-30',
    status: STATUSES.ACTIVE,
    createdAt: '2026-02-11T10:00:00.000Z',
  },
  {
    id: 'seed-notion',
    name: 'Notion Plus',
    cost: 800,
    billingCycle: BILLING_CYCLES.MONTHLY,
    nextRenewalDate: '2026-08-25',
    status: STATUSES.ACTIVE,
    createdAt: '2026-03-02T10:00:00.000Z',
  },
];

/** Loads seed data. Called once at startup. */
export function seed() {
  store.clear();
  for (const sub of SEED_SUBSCRIPTIONS) {
    store.set(sub.id, { ...sub });
  }
}

/**
 * @returns {import('../models/Subscription.js').Subscription[]}
 */
export function findAll() {
  return Array.from(store.values(), (sub) => ({ ...sub }));
}

/**
 * @param {string} id
 * @returns {import('../models/Subscription.js').Subscription | null}
 */
export function findById(id) {
  const found = store.get(id);
  return found ? { ...found } : null;
}

/**
 * @param {import('../models/Subscription.js').Subscription} subscription
 * @returns {import('../models/Subscription.js').Subscription}
 */
export function insert(subscription) {
  store.set(subscription.id, { ...subscription });
  return { ...subscription };
}

/**
 * Applies a partial update to a stored subscription.
 *
 * @param {string} id
 * @param {Partial<import('../models/Subscription.js').Subscription>} changes
 * @returns {import('../models/Subscription.js').Subscription | null}
 */
export function update(id, changes) {
  const existing = store.get(id);
  if (!existing) return null;

  const updated = { ...existing, ...changes, id: existing.id };
  store.set(id, updated);
  return { ...updated };
}

/**
 * @param {string} id
 * @returns {boolean} true if a record was removed.
 */
export function remove(id) {
  return store.delete(id);
}
