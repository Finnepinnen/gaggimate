/** @typedef {import('./types').EditorPhase} EditorPhase */

/**
 * @param {{ phases?: EditorPhase[] } | null | undefined} data
 * @returns {EditorPhase[]}
 */
export function getProfilePhases(data) {
  return Array.isArray(data?.phases) ? data.phases : [];
}

/**
 * @param {EditorPhase[]} phases
 * @param {number} index
 * @param {EditorPhase} value
 */
export function updatePhaseAt(phases, index, value) {
  const next = [...phases];
  next[index] = value;
  return next;
}

/**
 * @param {EditorPhase[]} phases
 * @param {number} index
 */
export function removePhaseAt(phases, index) {
  return phases.filter((_, i) => i !== index);
}
