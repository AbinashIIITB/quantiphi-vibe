import { fetchSubscriptions, createSubscription, updateSubscriptionStatus } from './api.js';
import {
  renderSubscriptionRows,
  renderMetrics,
  renderFieldErrors,
  applyDisplayMeta,
  setStatus,
} from './render.js';

/**
 * Application entry point: wires DOM events to the API and re-renders from
 * whatever the server returns. The client keeps no derived state of its own —
 * every number and flag on screen (burn rate, alert count, "Renewing Soon",
 * monthly rate) comes straight from the API response.
 */

const form = document.getElementById('subscription-form');
const statusNode = document.getElementById('form-status');
const rowsNode = document.getElementById('subscription-rows');
const emptyState = document.getElementById('empty-state');

/** Fetches the current list + metrics and repaints the dashboard. */
async function refresh() {
  try {
    const { subscriptions, metrics, meta } = await fetchSubscriptions();
    // Adopt the server's currency/locale/window settings before anything is formatted.
    applyDisplayMeta(meta);
    renderSubscriptionRows(rowsNode, subscriptions, handleToggleStatus);
    renderMetrics(metrics);
    emptyState.hidden = subscriptions.length > 0;
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
    await updateSubscriptionStatus(id, nextStatus);
    await refresh();
  } catch (error) {
    setStatus(statusNode, error.message, 'error');
    await refresh(); // revert the toggle to the server's actual state
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector('button[type="submit"]');
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
    const { subscription } = await createSubscription(payload);
    form.reset();
    setStatus(statusNode, `Added ${subscription.name}.`, 'success');
    await refresh();
  } catch (error) {
    renderFieldErrors(form, error.fieldErrors);
    setStatus(statusNode, error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

refresh();
