import { Router } from '../core/router.js';
import * as controller from '../controllers/subscriptionController.js';

/**
 * API route table. Registering routes in one place keeps the surface of the
 * API readable at a glance.
 */
export function createApiRouter() {
  const router = new Router();

  router.get('/api/subscriptions', controller.getSubscriptions);
  router.post('/api/subscriptions', controller.createSubscriptionHandler);
  router.patch('/api/subscriptions/:id/status', controller.updateStatusHandler);
  router.delete('/api/subscriptions/:id', controller.deleteSubscriptionHandler);
  router.get('/api/metrics', controller.getMetricsHandler);

  return router;
}
