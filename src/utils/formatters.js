/**
 * AgriNex Safe Formatting Utilities
 * Prevents TypeError crashes (e.g. Cannot read properties of undefined reading 'toLocaleString')
 */

export const RUPEE_SYMBOL = '\u20B9';

/**
 * Format currency in Indian Rupees (INR) safely
 * @param {number|string|null|undefined} amount 
 * @param {string} fallback 
 * @returns {string}
 */
export function formatCurrency(amount, fallback = `${RUPEE_SYMBOL}0`) {
  if (amount == null) return fallback;
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(num)) return fallback;
  return `${RUPEE_SYMBOL}${num.toLocaleString('en-IN')}`;
}

/**
 * Format quantity or numeric metrics safely
 * @param {number|string|null|undefined} value 
 * @param {string} fallback 
 * @returns {string}
 */
export function formatNumber(value, fallback = '0') {
  if (value == null) return fallback;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num.toLocaleString('en-IN');
}

/**
 * Format date/time safely
 * @param {Date|string|number|null|undefined} date 
 * @param {string} fallback 
 * @returns {string}
 */
export function formatDate(date, fallback = 'N/A') {
  if (!date) return fallback;
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(d.getTime())) return fallback;
    return d.toLocaleString();
  } catch {
    return fallback;
  }
}

/**
 * Format time string safely
 * @param {Date|string|number|null|undefined} date 
 * @param {string} fallback 
 * @returns {string}
 */
export function formatTime(date, fallback = 'Awaiting updates') {
  if (!date) return fallback;
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(d.getTime())) return fallback;
    return d.toLocaleTimeString();
  } catch {
    return fallback;
  }
}
