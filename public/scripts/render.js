/**
 * Presentation layer.
 *
 * These functions only format and place values that the server already
 * computed. No business rule (normalization, totals, urgency) lives here.
 */

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

/** Formats a YYYY-MM-DD string, reading it as UTC so the day never shifts. */
export function formatDate(isoDate) {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

const CYCLE_LABELS = {
  monthly: 'Monthly',
  yearly: 'Yearly',
};

/**
 * Renders the subscription table body.
 *
 * @param {HTMLElement} tbody
 * @param {object[]} subscriptions Server-enriched subscription records.
 */
export function renderSubscriptionRows(tbody, subscriptions) {
  tbody.replaceChildren(...subscriptions.map(buildRow));
}

function buildRow(sub) {
  const row = document.createElement('tr');
  row.dataset.id = sub.id;

  row.append(
    cell(sub.name, 'service-name'),
    cell(formatCurrency(sub.cost), 'num'),
    cycleCell(sub.billingCycle),
    cell(formatCurrency(sub.monthlyCost), 'num'),
    cell(formatDate(sub.nextRenewalDate)),
  );

  return row;
}

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function cycleCell(billingCycle) {
  const td = document.createElement('td');
  const tag = document.createElement('span');
  tag.className = 'cycle-tag';
  tag.textContent = CYCLE_LABELS[billingCycle] || billingCycle;
  td.append(tag);
  return td;
}

/**
 * Clears any previously shown field errors, then renders the given ones.
 *
 * @param {HTMLFormElement} form
 * @param {Record<string, string>} fieldErrors
 */
export function renderFieldErrors(form, fieldErrors = {}) {
  form.querySelectorAll('[data-error-for]').forEach((node) => {
    const field = node.dataset.errorFor;
    const message = fieldErrors[field] || '';
    node.textContent = message;

    const input = form.elements[field];
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  });
}

/**
 * @param {HTMLElement} node
 * @param {string} message
 * @param {'error'|'success'|''} [tone]
 */
export function setStatus(node, message, tone = '') {
  node.textContent = message;
  node.className = tone ? `form-status form-status--${tone}` : 'form-status';
}
