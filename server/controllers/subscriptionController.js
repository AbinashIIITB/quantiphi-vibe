import * as subscriptionService from '../services/subscriptionService.js';
import { readJsonBody, sendJson } from '../core/http.js';

/**
 * HTTP-facing layer. Controllers translate between the request/response cycle
 * and the service layer; they hold no business logic themselves.
 */

/** GET /api/subscriptions */
export async function getSubscriptions(req, res) {
  const subscriptions = subscriptionService.listSubscriptions();
  sendJson(res, 200, { success: true, subscriptions });
}

/** POST /api/subscriptions */
export async function createSubscriptionHandler(req, res) {
  const body = await readJsonBody(req);
  const subscription = subscriptionService.addSubscription(body);
  sendJson(res, 201, { success: true, subscription });
}
