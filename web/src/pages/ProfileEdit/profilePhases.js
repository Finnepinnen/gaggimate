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

/**
 * Returns a copy of the phase with one stop target replaced; the phase passed in is unchanged.
 * @param {EditorPhase} phase
 * @param {number} index
 * @param {import('../../types').PhaseTarget} value
 * @returns {EditorPhase}
 */
export function updatePhaseTargetAt(phase, index, value) {
  const targets = [...(phase.targets || [])];
  targets[index] = value;
  return { ...phase, targets };
}

/**
 * Returns a copy of the phase without one stop target.
 * @param {EditorPhase} phase
 * @param {number} index
 * @returns {EditorPhase}
 */
export function removePhaseTargetAt(phase, index) {
  return { ...phase, targets: (phase.targets || []).filter((_, i) => i !== index) };
}
