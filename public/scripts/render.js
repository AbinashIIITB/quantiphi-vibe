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

/** Metric nodes are looked up once — they are repainted on every render pass. */
const metricNodes = {
  burnRate: document.getElementById('metric-burn-rate'),
  alertCount: document.getElementById('metric-alert-count'),
  alertHint: document.getElementById('metric-alert-hint'),
  savingsHint: document.getElementById('metric-savings-hint'),
};

/** Remembers the last meta applied, so identical settings skip rebuilding formatters. */
let appliedMetaKey = '';

/**
 * Adopts the server's display settings. Called before each render pass, but the
 * settings rarely change, so the `Intl` formatters are rebuilt only when they do.
 *
 * @param {{locale: string, currency: string, renewalWindowDays: number}} meta
 */
export function applyDisplayMeta(meta) {
  if (!meta) return;

  const key = `${meta.locale}|${meta.currency}|${meta.renewalWindowDays}`;
  if (key === appliedMetaKey) return;
  appliedMetaKey = key;

  currencyFormatter = buildCurrencyFormatter(meta.locale, meta.currency);
  dateFormatter = buildDateFormatter(meta.locale);
  metricNodes.alertHint.textContent = `Within the next ${meta.renewalWindowDays} days`;
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

/** Mirrors the server's STATUSES enum; kept here so no status string is inlined. */
const STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
};

/**
 * Renders the subscription table body.
 *
 * @param {HTMLElement} tbody
 * @param {object[]} subscriptions Server-enriched subscription records.
 * @param {(id: string, nextStatus: string) => void} onToggleStatus
 */
export function renderSubscriptionRows(tbody, subscriptions, onToggleStatus) {
  // Rows are assembled off-document in a fragment, so the table reflows once
  // rather than once per row.
  const fragment = document.createDocumentFragment();
  for (const sub of subscriptions) {
    fragment.append(buildRow(sub, onToggleStatus));
  }
  tbody.replaceChildren(fragment);
}

/** Modifier classes a row can carry. The two are independent and can co-occur. */
function rowModifiers(sub) {
  const classNames = [];
  if (sub.status === STATUS.PAUSED) classNames.push('row--paused');
  if (sub.renewingSoon) classNames.push('row--renewing-soon');
  return classNames.join(' ');
}

function buildRow(sub, onToggleStatus) {
  const row = document.createElement('tr');
  row.dataset.id = sub.id;
  row.className = rowModifiers(sub);

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
  const isActive = sub.status === STATUS.ACTIVE;

  const label = document.createElement('label');
  label.className = 'status-toggle';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = isActive;
  input.setAttribute('aria-label', `Toggle ${sub.name} active or paused`);
  input.addEventListener('change', () => {
    onToggleStatus(sub.id, input.checked ? STATUS.ACTIVE : STATUS.PAUSED);
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
  const { burnRate, alertCount, savingsHint } = metricNodes;

  burnRate.textContent = formatCurrency(metrics.totalMonthlyBurn);
  alertCount.textContent = String(metrics.upcomingRenewalsCount);

  const isSaving = metrics.pausedMonthlySavings > 0;
  savingsHint.textContent = isSaving
    ? `Saving ${formatCurrency(metrics.pausedMonthlySavings)}/mo from paused items`
    : '';
  savingsHint.className = isSaving
    ? 'metric-card__hint metric-card__hint--savings'
    : 'metric-card__hint';
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
