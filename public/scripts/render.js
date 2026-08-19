/**
 * Presentation layer.
 *
 * These functions only format and place values that the server already
 * computed. No business rule (normalization, totals, urgency) lives here.
 */

/**
 * Formatters are built from the locale and currency the server reports, so the
 * UI never hardcodes a business setting that config/index.js already owns.
 * These defaults only apply for the moment before the first response lands.
 */
let currencyFormatter = buildCurrencyFormatter('en-IN', 'INR');
let dateFormatter = buildDateFormatter('en-IN');

function buildCurrencyFormatter(locale, currency) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildDateFormatter(locale) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Adopts the server's display settings. Called before each render pass.
 *
 * @param {{locale: string, currency: string, renewalWindowDays: number}} meta
 */
export function applyDisplayMeta(meta) {
  if (!meta) return;
  currencyFormatter = buildCurrencyFormatter(meta.locale, meta.currency);
  dateFormatter = buildDateFormatter(meta.locale);

  const alertHint = document.getElementById('metric-alert-hint');
  if (alertHint) {
    alertHint.textContent = `Within the next ${meta.renewalWindowDays} days`;
  }
}

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
 * @param {(id: string, nextStatus: string) => void} onToggleStatus
 */
export function renderSubscriptionRows(tbody, subscriptions, onToggleStatus) {
  tbody.replaceChildren(...subscriptions.map((sub) => buildRow(sub, onToggleStatus)));
}

function buildRow(sub, onToggleStatus) {
  const isPaused = sub.status === 'paused';

  const row = document.createElement('tr');
  row.dataset.id = sub.id;
  row.className = [isPaused && 'row--paused', sub.renewingSoon && 'row--renewing-soon']
    .filter(Boolean)
    .join(' ');

  row.append(
    cell(sub.name, 'service-name'),
    cell(formatCurrency(sub.cost), 'num'),
    cycleCell(sub.billingCycle),
    cell(formatCurrency(sub.monthlyCost), 'num'),
    renewalCell(sub),
    statusCell(sub, onToggleStatus),
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

function renewalCell(sub) {
  const td = document.createElement('td');
  td.append(document.createTextNode(formatDate(sub.nextRenewalDate)));

  if (sub.renewingSoon) {
    const badge = document.createElement('span');
    badge.className = 'badge-soon';
    badge.textContent = 'Renewing Soon';
    td.append(badge);
  }
  return td;
}

function statusCell(sub, onToggleStatus) {
  const td = document.createElement('td');
  const isActive = sub.status === 'active';

  const label = document.createElement('label');
  label.className = 'status-toggle';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = isActive;
  input.setAttribute('aria-label', `Toggle ${sub.name} active or paused`);
  input.addEventListener('change', () => {
    onToggleStatus(sub.id, input.checked ? 'active' : 'paused');
  });

  const track = document.createElement('span');
  track.className = 'status-toggle__track';
  track.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'status-toggle__label';
  text.textContent = isActive ? 'Active' : 'Paused';

  label.append(input, track, text);
  td.append(label);
  return td;
}

/**
 * Paints the metrics row from the server's metrics block.
 *
 * @param {{totalMonthlyBurn: number, upcomingRenewalsCount: number, pausedMonthlySavings: number}} metrics
 */
export function renderMetrics(metrics) {
  document.getElementById('metric-burn-rate').textContent = formatCurrency(metrics.totalMonthlyBurn);
  document.getElementById('metric-alert-count').textContent = String(metrics.upcomingRenewalsCount);

  const savingsHint = document.getElementById('metric-savings-hint');
  if (metrics.pausedMonthlySavings > 0) {
    savingsHint.textContent = `Saving ${formatCurrency(metrics.pausedMonthlySavings)}/mo from paused items`;
    savingsHint.className = 'metric-card__hint metric-card__hint--savings';
  } else {
    savingsHint.textContent = '';
    savingsHint.className = 'metric-card__hint';
  }
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
