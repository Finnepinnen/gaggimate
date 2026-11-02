import { msg, t } from '@lingui/core/macro';
import { i18n } from '../../../../i18n.js';

/** @typedef {import('../../types').AnalyzerShot} AnalyzerShot */
/** @typedef {{ label: import('@lingui/core').MessageDescriptor, stopReason: string, exitType: string | null }} ExitReasonMeta */

export const PHASE_EXIT_REASON = Object.freeze({
  UNKNOWN: 0,
  TARGET_VOLUMETRIC: 1,
  TARGET_PRESSURE: 2,
  TARGET_FLOW: 3,
  TARGET_PUMPED: 4,
  DURATION: 5,
  SAFETY: 6,
  ABORTED: 7,
  TARGET_RATIO: 9,
});

/** @type {Readonly<Record<number, ExitReasonMeta>>} */
const EXIT_REASON_META = Object.freeze({
  [PHASE_EXIT_REASON.UNKNOWN]: {
    label: msg`Unknown`,
    stopReason: '',
    exitType: null,
  },
  [PHASE_EXIT_REASON.TARGET_VOLUMETRIC]: {
    label: msg`Volumetric target`,
    stopReason: 'Weight Stop',
    exitType: 'volumetric',
  },
  [PHASE_EXIT_REASON.TARGET_PRESSURE]: {
    label: msg`Pressure target`,
    stopReason: 'Pressure Stop',
    exitType: 'pressure',
  },
  [PHASE_EXIT_REASON.TARGET_FLOW]: {
    label: msg`Flow target`,
    stopReason: 'Pump Flow Stop',
    exitType: 'flow',
  },
  [PHASE_EXIT_REASON.TARGET_PUMPED]: {
    label: msg`Pumped-water target`,
    stopReason: 'Pumped Water Stop',
    exitType: 'pumped',
  },
  [PHASE_EXIT_REASON.DURATION]: {
    label: msg`Duration`,
    stopReason: 'Time Stop',
    exitType: 'duration',
  },
  [PHASE_EXIT_REASON.SAFETY]: {
    label: msg`Safety timeout`,
    stopReason: 'Safety Timeout',
    exitType: 'safety',
  },
  [PHASE_EXIT_REASON.ABORTED]: {
    label: msg`Manually stopped`,
    stopReason: 'Manually Stopped',
    exitType: 'manual',
  },
  [PHASE_EXIT_REASON.TARGET_RATIO]: {
    label: msg`Ratio target`,
    stopReason: 'Ratio Stop',
    exitType: 'ratio',
  },
});

/** Ratio targets are resolved to grams before analysis, so they behave like weight targets. */
/**
 * @param {string | null | undefined} type
 * @returns {boolean}
 */
export function isWeightType(type) {
  return type === 'volumetric' || type === 'weight' || type === 'ratio';
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function normalizePhaseExitReasonCode(value) {
  const code = Number(value);
  return Number.isInteger(code) && EXIT_REASON_META[code] ? code : PHASE_EXIT_REASON.UNKNOWN;
}

/**
 * @param {unknown} value
 * @returns {ExitReasonMeta}
 */
export function getPhaseExitReasonMeta(value) {
  return EXIT_REASON_META[normalizePhaseExitReasonCode(value)];
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function getPhaseExitReasonLabel(value) {
  return i18n._(getPhaseExitReasonMeta(value).label);
}

/** @param {unknown} value */
export function isKnownPhaseExitReason(value) {
  return normalizePhaseExitReasonCode(value) !== PHASE_EXIT_REASON.UNKNOWN;
}

/** @param {unknown} value */
export function isSafetyExitReason(value) {
  return normalizePhaseExitReasonCode(value) === PHASE_EXIT_REASON.SAFETY;
}

/**
 * @param {boolean} isBrewByWeight
 * @returns {string}
 */
export function getBrewModeLabel(isBrewByWeight) {
  return isBrewByWeight ? t`Brewed by Weight` : t`Brewed by Time`;
}

/**
 * @param {boolean} isBrewByWeight
 * @param {unknown} finalExitReason
 * @returns {string}
 */
export function getBrewCompletionLabel(isBrewByWeight, finalExitReason) {
  const code = normalizePhaseExitReasonCode(finalExitReason);
  if (code === PHASE_EXIT_REASON.ABORTED) return t`Stopped: Manually`;
  if (code === PHASE_EXIT_REASON.SAFETY) return t`Stopped: Safety timeout`;
  return getBrewModeLabel(isBrewByWeight);
}

/**
 * @param {AnalyzerShot | null | undefined} shotData
 * @returns {Map<string, number>} Exit reason code by stringified phase number
 */
export function buildRecordedExitReasonByPhase(shotData) {
  /** @type {Map<string, number>} */
  const reasonByPhase = new Map();
  const transitions = Array.isArray(shotData?.phaseTransitions) ? shotData.phaseTransitions : [];

  // A transition stores why the phase immediately before it ended.
  for (let index = 1; index < transitions.length; index += 1) {
    const endedPhaseNumber = transitions[index - 1]?.phaseNumber;
    if (endedPhaseNumber == null) continue;
    reasonByPhase.set(
      String(endedPhaseNumber),
      normalizePhaseExitReasonCode(transitions[index]?.transitionReason),
    );
  }

  const samples = Array.isArray(shotData?.samples) ? shotData.samples : [];
  const finalPhaseNumber = samples.at(-1)?.phaseNumber ?? transitions.at(-1)?.phaseNumber;
  if (finalPhaseNumber != null) {
    reasonByPhase.set(
      String(finalPhaseNumber),
      normalizePhaseExitReasonCode(shotData?.finalExitReason),
    );
  }

  return reasonByPhase;
}
