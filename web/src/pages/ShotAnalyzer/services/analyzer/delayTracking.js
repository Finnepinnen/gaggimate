import { t } from '@lingui/core/macro';
import { isWeightType } from './exitReasons.js';

/** @typedef {import('../../types').DelayTotals} DelayTotals */
/** @typedef {import('../../types').PhaseDelayState} PhaseDelayState */
/** @typedef {import('../../types').PhaseDelayTracker} PhaseDelayTracker */

export const LAST_PHASE_UNDERSHOOT_MIN_G = 2;
export const LAST_PHASE_UNDERSHOOT_MAX_G = 6;
export const LAST_PHASE_OVERSHOOT_MAX_G = 4;
export const LAST_PHASE_ESTIMATED_DELAY_MAX_MS = 4000;

/** @returns {boolean} */
export function isAnalyzerDebugEnabled() {
  if (typeof globalThis === 'undefined') return false;
  try {
    return (
      /** @type {{ __SHOT_ANALYZER_DEBUG__?: boolean }} */ (globalThis).__SHOT_ANALYZER_DEBUG__ ===
        true || globalThis.localStorage?.getItem('shotAnalyzerDebug') === '1'
    );
  } catch {
    return (
      /** @type {{ __SHOT_ANALYZER_DEBUG__?: boolean }} */ (globalThis).__SHOT_ANALYZER_DEBUG__ ===
      true
    );
  }
}

/**
 * @param {boolean} enabled
 * @param {string} message
 * @param {object | null} [payload]
 */
export function analyzerDebug(enabled, message, payload = null) {
  if (!enabled) return;
  if (payload == null) {
    console.debug(`[ShotAnalyzer] ${message}`);
  } else {
    console.debug(`[ShotAnalyzer] ${message}`, payload);
  }
}

/**
 * @param {number | null} phaseNumber
 * @param {number | null} delayMs
 * @returns {string | null}
 */
export function getDelayReviewMessage(phaseNumber, delayMs) {
  if (!phaseNumber) return null;
  if (delayMs != null) {
    return t`Unusually high inferred delay in Phase ${phaseNumber} (${delayMs} ms).`;
  }
  return t`Unusually high inferred delay in Phase ${phaseNumber}.`;
}

/** @returns {DelayTotals} */
export function createDelayTotals() {
  return {
    sumScaleDelay: 0,
    countScaleHits: 0,
    sumSensorDelay: 0,
    countSensorHits: 0,
  };
}

/**
 * @param {DelayTotals} delayTotals
 * @param {string | null} exitType
 * @param {number} delayMs
 */
export function addDelayHit(delayTotals, exitType, delayMs) {
  if (isWeightType(exitType)) {
    delayTotals.sumScaleDelay += delayMs;
    delayTotals.countScaleHits++;
    return;
  }
  delayTotals.sumSensorDelay += delayMs;
  delayTotals.countSensorHits++;
}

/**
 * @param {boolean} isLastPhase
 * @returns {PhaseDelayTracker}
 */
export function createPhaseDelayTracker(isLastPhase) {
  /** @type {PhaseDelayState} */
  const state = {
    highScaleDelay: false,
    estimatedScaleDelayMs: null,
    delayReviewHint: false,
    delayReviewReason: null,
    delayReviewMs: null,
  };

  /** @param {number | null | undefined} delayMs */
  const setEstimatedScaleDelay = delayMs => {
    if (delayMs == null || !Number.isFinite(delayMs) || delayMs < 0) return;
    const roundedDelay = Math.round(delayMs);
    state.estimatedScaleDelayMs =
      state.estimatedScaleDelayMs == null
        ? roundedDelay
        : Math.max(state.estimatedScaleDelayMs, roundedDelay);
    if (isLastPhase && roundedDelay > 2000) {
      state.highScaleDelay = true;
    }
  };

  /**
   * @param {number | null | undefined} delayMs
   * @param {string} [reason]
   */
  const setPhaseDelayReviewHint = (delayMs, reason) => {
    if (delayMs == null || !Number.isFinite(delayMs) || delayMs < 1000) return;
    const roundedDelay = Math.round(delayMs);
    state.delayReviewHint = true;
    state.delayReviewReason = reason || 'manual-check';
    state.delayReviewMs =
      state.delayReviewMs == null ? roundedDelay : Math.max(state.delayReviewMs, roundedDelay);
  };

  return { state, setEstimatedScaleDelay, setPhaseDelayReviewHint };
}
