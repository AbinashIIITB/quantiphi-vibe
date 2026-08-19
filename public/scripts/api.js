/**
 * Thin API client. The only place in the frontend that knows about endpoints.
 *
 * Server error envelopes ({ message, errors }) are re-thrown as an Error with
 * a `fieldErrors` property so the form can render messages next to each input.
 */

const BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.fieldErrors = payload.errors || {};
    throw error;
  }
  return payload;
}

/** @returns {Promise<{subscriptions: object[], metrics: object}>} */
export function fetchSubscriptions() {
  return request('/subscriptions');
}

/** @param {object} data Entry form values. */
export function createSubscription(data) {
  return request('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * @param {string} id
 * @param {'active'|'paused'} status
 */
export function updateSubscriptionStatus(id, status) {
  return request(`/subscriptions/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
