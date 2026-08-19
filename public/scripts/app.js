import { fetchSubscriptions, createSubscription } from './api.js';
import {
  renderSubscriptionRows,
  renderFieldErrors,
  setStatus,
} from './render.js';

/**
 * Application entry point: wires DOM events to the API and re-renders from
 * whatever the server returns. The client keeps no derived state of its own.
 */

const form = document.getElementById('subscription-form');
const statusNode = document.getElementById('form-status');
const rowsNode = document.getElementById('subscription-rows');
const emptyState = document.getElementById('empty-state');

/** Fetches the current list and repaints the table. */
async function refresh() {
  try {
    const { subscriptions } = await fetchSubscriptions();
    renderSubscriptionRows(rowsNode, subscriptions);
    emptyState.hidden = subscriptions.length > 0;
  } catch (error) {
    setStatus(statusNode, error.message, 'error');
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
