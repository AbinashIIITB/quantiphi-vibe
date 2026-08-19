import { fetchSubscriptions, createSubscription, updateSubscriptionStatus } from './api.js';
import {
  renderSubscriptionRows,
  renderMetrics,
  renderFieldErrors,
  applyDisplayMeta,
  setStatus,
} from './render.js';

/**
 * Application entry point: wires DOM events to the API and repaints from
 * whatever the server returns. The client keeps no derived state of its own —
 * every number and flag on screen (burn rate, alert count, "Renewing Soon",
 * monthly rate) comes straight from the API response.
 */

const form = document.getElementById('subscription-form');
const submitButton = form.querySelector('button[type="submit"]');
const statusNode = document.getElementById('form-status');
const rowsNode = document.getElementById('subscription-rows');
const emptyState = document.getElementById('empty-state');

/**
 * Single render path. Every endpoint returns the same dashboard shape, so a
 * create or a toggle repaints from its own response — no follow-up request.
 *
 * @param {{subscriptions: object[], metrics: object, meta: object}} dashboard
 */
function renderDashboard({ subscriptions, metrics, meta }) {
  // Adopt the server's currency/locale/window settings before anything is formatted.
  applyDisplayMeta(meta);
  renderSubscriptionRows(rowsNode, subscriptions, handleToggleStatus);
  renderMetrics(metrics);
  emptyState.hidden = subscriptions.length > 0;
}

/** Loads the dashboard from scratch. Used on boot and to recover from errors. */
async function refresh() {
  try {
    renderDashboard(await fetchSubscriptions());
  } catch (error) {
    setStatus(statusNode, error.message, 'error');
  }
}

/**
 * Handles the row's Active/Paused toggle. Pausing never removes the record —
 * it flips `status` server-side, which drops that cost out of the burn-rate
 * sum, and the row repaints greyed out.
 *
 * @param {string} id
 * @param {'active'|'paused'} nextStatus
 */
async function handleToggleStatus(id, nextStatus) {
  try {
    renderDashboard(await updateSubscriptionStatus(id, nextStatus));
  } catch (error) {
    setStatus(statusNode, error.message, 'error');
    await refresh(); // snap the toggle back to the server's actual state
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  submitButton.disabled = true;
  renderFieldErrors(form, {});
  setStatus(statusNode, 'Saving…');

  const formData = new FormData(form);
  const payload = {
    name: formData.get('name'),
    cost: formData.get('cost'),
    billingCycle: formData.get('billingCycle'),
    nextRenewalDate: formData.get('nextRenewalDate'),
  };

  try {
    const response = await createSubscription(payload);
    form.reset();
    renderDashboard(response);
    setStatus(statusNode, `Added ${response.subscription.name}.`, 'success');
  } catch (error) {
    renderFieldErrors(form, error.fieldErrors);
    setStatus(statusNode, error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

refresh();
