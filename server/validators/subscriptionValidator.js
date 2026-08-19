import { BILLING_CYCLES, STATUSES } from '../config/index.js';
import { ApiError } from '../core/ApiError.js';

const MAX_NAME_LENGTH = 60;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates and normalizes the subscription entry form payload.
 *
 * All validation lives here on the server — the browser's `required` attributes
 * are a convenience only and are never trusted. Errors are collected per field
 * so the form can render them inline instead of failing on the first problem.
 *
 * @param {unknown} payload Raw parsed request body.
 * @returns {{name: string, cost: number, billingCycle: string, nextRenewalDate: string}}
 * @throws {ApiError} 400 with a field-keyed `errors` map.
 */
export function validateSubscriptionInput(payload) {
  const errors = {};
  const body = payload && typeof payload === 'object' ? payload : {};

  // --- Service name -------------------------------------------------------
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    errors.name = 'Service name is required';
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Service name must be ${MAX_NAME_LENGTH} characters or fewer`;
  }

  // --- Cost ---------------------------------------------------------------
  // Accepts a number or a numeric string, since HTML form fields submit strings.
  const rawCost = body.cost;
  const cost = typeof rawCost === 'string' ? Number(rawCost.trim()) : rawCost;
  if (rawCost === undefined || rawCost === null || rawCost === '') {
    errors.cost = 'Cost is required';
  } else if (typeof cost !== 'number' || !Number.isFinite(cost)) {
    errors.cost = 'Cost must be a valid number';
  } else if (cost <= 0) {
    errors.cost = 'Cost must be greater than zero';
  }

  // --- Billing cycle ------------------------------------------------------
  const billingCycle = typeof body.billingCycle === 'string' ? body.billingCycle.trim().toLowerCase() : '';
  const allowedCycles = Object.values(BILLING_CYCLES);
  if (!billingCycle) {
    errors.billingCycle = 'Billing cycle is required';
  } else if (!allowedCycles.includes(billingCycle)) {
    errors.billingCycle = `Billing cycle must be one of: ${allowedCycles.join(', ')}`;
  }

  // --- Next renewal date --------------------------------------------------
  const nextRenewalDate = typeof body.nextRenewalDate === 'string' ? body.nextRenewalDate.trim() : '';
  if (!nextRenewalDate) {
    errors.nextRenewalDate = 'Next renewal date is required';
  } else if (!ISO_DATE_PATTERN.test(nextRenewalDate)) {
    errors.nextRenewalDate = 'Next renewal date must be in YYYY-MM-DD format';
  } else if (!isRealCalendarDate(nextRenewalDate)) {
    errors.nextRenewalDate = 'Next renewal date is not a real calendar date';
  }

  if (Object.keys(errors).length > 0) {
    throw ApiError.badRequest('Validation failed', errors);
  }

  return {
    name,
    // Money is rounded to 2 decimals at the boundary so the store never holds
    // values like 12.999999 that would quietly skew the burn rate.
    cost: Math.round(cost * 100) / 100,
    billingCycle,
    nextRenewalDate,
  };
}

/**
 * Validates a status-change payload for the Active / Paused toggle.
 *
 * @param {unknown} payload
 * @returns {'active'|'paused'}
 * @throws {ApiError} 400 when the status is missing or unrecognised.
 */
export function validateStatusInput(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
  const allowed = Object.values(STATUSES);

  if (!allowed.includes(status)) {
    throw ApiError.badRequest('Validation failed', {
      status: `Status must be one of: ${allowed.join(', ')}`,
    });
  }
  return status;
}

/**
 * Guards against dates that match the YYYY-MM-DD shape but do not exist,
 * such as 2026-02-30, which JavaScript would otherwise roll forward silently.
 */
function isRealCalendarDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
