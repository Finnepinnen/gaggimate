// Shared formatting helpers for Statistics components.

/**
 * @param {number | null | undefined} val
 * @param {number} [digits]
 */
export function fmt(val, digits = 1) {
  return Number.isFinite(val) ? /** @type {number} */ (val).toFixed(digits) : '-';
}
