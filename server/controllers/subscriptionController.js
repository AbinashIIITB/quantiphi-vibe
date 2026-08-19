import * as subscriptionService from '../services/subscriptionService.js';
import { readJsonBody, sendJson } from '../core/http.js';

/**
 * HTTP-facing layer. Controllers translate between the request/response cycle
 * and the service layer; they hold no business logic themselves.
 *
 * Every endpoint that reads or changes state answers with the same dashboard
 * shape — `{ subscriptions, metrics, meta }` — so the client has exactly one
 * render path and never needs a follow-up GET to see the effect of a change.
 */

/** GET /api/subscriptions — the whole dashboard in one call. */
export async function getSubscriptions(req, res) {
  sendJson(res, 200, { success: true, ...subscriptionService.getDashboard() });
}

/** GET /api/metrics — the metrics block on its own. */
export async function getMetricsHandler(req, res) {
  sendJson(res, 200, { success: true, metrics: subscriptionService.getMetrics() });
}

/** POST /api/subscriptions */
export async function createSubscriptionHandler(req, res) {
  const body = await readJsonBody(req);
  // `subscription` is the newly created row, surfaced separately so the client
  // can name it in its confirmation message.
  const subscription = subscriptionService.addSubscription(body);
  sendJson(res, 201, { success: true, subscription, ...subscriptionService.getDashboard() });
}

/** PATCH /api/subscriptions/:id/status — the Active / Paused toggle. */
export async function updateStatusHandler(req, res) {
  const body = await readJsonBody(req);
  const subscription = subscriptionService.setSubscriptionStatus(req.params.id, body);
  sendJson(res, 200, { success: true, subscription, ...subscriptionService.getDashboard() });
}

/** DELETE /api/subscriptions/:id */
export async function deleteSubscriptionHandler(req, res) {
  subscriptionService.deleteSubscription(req.params.id);
  sendJson(res, 200, { success: true, ...subscriptionService.getDashboard() });
}
