import * as subscriptionService from '../services/subscriptionService.js';
import { readJsonBody, sendJson } from '../core/http.js';

/**
 * HTTP-facing layer. Controllers translate between the request/response cycle
 * and the service layer; they hold no business logic themselves.
 */

/** GET /api/subscriptions — list plus the metrics block, so one call paints the whole dashboard. */
export async function getSubscriptions(req, res) {
  const subscriptions = subscriptionService.listSubscriptions();
  const metrics = subscriptionService.getMetrics();
  sendJson(res, 200, { success: true, subscriptions, metrics });
}

/** GET /api/metrics */
export async function getMetricsHandler(req, res) {
  const metrics = subscriptionService.getMetrics();
  sendJson(res, 200, { success: true, metrics });
}

/** POST /api/subscriptions */
export async function createSubscriptionHandler(req, res) {
  const body = await readJsonBody(req);
  const subscription = subscriptionService.addSubscription(body);
  const metrics = subscriptionService.getMetrics();
  sendJson(res, 201, { success: true, subscription, metrics });
}

/** PATCH /api/subscriptions/:id/status */
export async function updateStatusHandler(req, res) {
  const body = await readJsonBody(req);
  const subscription = subscriptionService.setSubscriptionStatus(req.params.id, body);
  const metrics = subscriptionService.getMetrics();
  sendJson(res, 200, { success: true, subscription, metrics });
}

/** DELETE /api/subscriptions/:id */
export async function deleteSubscriptionHandler(req, res) {
  subscriptionService.deleteSubscription(req.params.id);
  const metrics = subscriptionService.getMetrics();
  sendJson(res, 200, { success: true, metrics });
}
