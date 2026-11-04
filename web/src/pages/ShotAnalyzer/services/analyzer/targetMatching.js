/** Resolves profile exit targets against measured and delay-adjusted shot values. */

import { LAST_PHASE_OVERSHOOT_MAX_G } from './delayTracking';
import { isWeightType } from './exitReasons.js';
import { calculatePumpedWaterAtSample } from './waterIntegration';

/** @typedef {import('../../../../types').ShotSample} ShotSample */
/** @typedef {import('../../types').AnalyzerTarget} AnalyzerTarget */
/** @typedef {import('../../types').TargetContext} TargetContext */
/** @typedef {import('../../types').TargetMatch} TargetMatch */
/** @typedef {import('../../types').TargetValues} TargetValues */
/** @typedef {import('../../types').TargetCalcValues} TargetCalcValues */
/** @typedef {{ anchorValue: number, nextValue: number, predictedValue: number }} LookAheadValues */
/** @typedef {TargetContext & { normalizedScaleDelayMs: number, normalizedSensorDelayMs: number }} ManualTargetContext */
/** @typedef {import('../../types').MeasuredSample} MeasuredSample */

export const PREDICTION_INTERVAL_MS = 100;

/**
 * @param {AnalyzerTarget['operator']} operator
 * @param {number} currentValue
 * @param {number} nextValue
 */
function isDirectionallyValidLookAhead(operator, currentValue, nextValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(nextValue)) return false;
  if (operator === 'gte') return nextValue >= currentValue;
  if (operator === 'lte') return nextValue <= currentValue;
  return true;
}

/**
 * @param {AnalyzerTarget} target
 * @returns {boolean}
 */
export function isWeightTarget(target) {
  return isWeightType(target.type);
}

/**
 * @param {AnalyzerTarget} target
 * @param {TargetContext} context
 */
function shouldSkipTarget(target, context) {
  const weightTarget = isWeightTarget(target);
  if (!weightTarget) return false;
  if (!context.isBrewByWeight) return true;
  if (context.scaleConnectionBrokenPermanently) return true;
  return (
    context.isLastPhase &&
    /** @type {number} */ (context.lastNonExtendedSample.v) >
      target.value + LAST_PHASE_OVERSHOOT_MAX_G
  );
}

/**
 * @param {AnalyzerTarget} target
 * @param {number} value
 * @param {Pick<TargetContext, 'isLastPhase'>} context
 * @returns {boolean}
 */
export function isTargetHit(target, value, context) {
  if (target.operator === 'lte') return value <= target.value;
  if (target.operator !== 'gte' || value < target.value) return false;

  return !(
    context.isLastPhase &&
    isWeightTarget(target) &&
    value > target.value + LAST_PHASE_OVERSHOOT_MAX_G
  );
}

/**
 * @param {AnalyzerTarget} target
 * @param {TargetValues} values
 * @returns {number | undefined}
 */
function getTargetValue(target, values) {
  if (target.type === 'pressure') return values.pressure;
  if (target.type === 'flow') return values.flow;
  if (isWeightTarget(target)) return values.weight;
  if (target.type === 'pumped') return values.pumped;
  return undefined;
}

/**
 * @param {AnalyzerTarget} target
 * @param {number} value
 * @param {number} delayMs
 * @param {ShotSample | null} [observedSample]
 * @returns {TargetMatch}
 */
function createTargetMatch(target, value, delayMs, observedSample = null) {
  return {
    target,
    delayMs,
    predictedWeight: isWeightTarget(target) ? value : null,
    observedSample,
  };
}

/**
 * @param {AnalyzerTarget[]} targets
 * @param {TargetValues} values
 * @param {number} delayMs
 * @param {TargetContext} context
 * @returns {TargetMatch | null}
 */
export function findTargetMatch(targets, values, delayMs, context) {
  for (const target of targets) {
    if (shouldSkipTarget(target, context)) continue;

    const value = getTargetValue(target, values);
    if (value === undefined) continue;

    if (isTargetHit(target, value, context)) {
      return createTargetMatch(target, value, delayMs);
    }
  }
  return null;
}

/**
 * @param {AnalyzerTarget} target
 * @param {ShotSample} nextSample
 * @param {number} delayMs
 * @param {TargetContext} context
 * @returns {LookAheadValues | null}
 */
function getLookAheadTargetValues(target, nextSample, delayMs, context) {
  const horizon = Math.max(0, delayMs) / 1000;
  const anchor = /** @type {MeasuredSample} */ (context.anchor);
  const next = /** @type {MeasuredSample} */ (nextSample);

  if (target.type === 'pressure') {
    return {
      anchorValue: anchor.cp,
      nextValue: next.cp,
      predictedValue: Math.max(0, anchor.cp + context.pressureSlope * horizon),
    };
  }
  if (target.type === 'flow') {
    return {
      anchorValue: anchor.fl,
      nextValue: next.fl,
      predictedValue: Math.max(0, anchor.fl + context.flowSlope * horizon),
    };
  }
  if (isWeightTarget(target)) {
    return {
      anchorValue: anchor.v,
      nextValue: next.v,
      predictedValue: anchor.v + (context.weightRate > 0 ? context.weightRate * horizon : 0),
    };
  }
  if (target.type === 'pumped') {
    const observedPumped = Array.isArray(context.phaseSamples)
      ? calculatePumpedWaterAtSample(context.phaseSamples, nextSample, context.pumpedWaterSource)
      : context.anchorPumped + anchor.fl * horizon;
    return {
      anchorValue: context.anchorPumped,
      nextValue: observedPumped,
      predictedValue: context.anchorPumped + Math.max(0, anchor.fl) * horizon,
    };
  }
  return null;
}

/**
 * @param {AnalyzerTarget} target
 * @param {ShotSample} nextSample
 * @param {number} delayMs
 * @param {TargetContext} context
 * @returns {number | undefined}
 */
function getLookAheadMatchedValue(target, nextSample, delayMs, context) {
  const values = getLookAheadTargetValues(target, nextSample, delayMs, context);
  if (!values) return undefined;

  const directionIsValid = isDirectionallyValidLookAhead(
    target.operator,
    values.anchorValue,
    values.nextValue,
  );
  return directionIsValid ? values.nextValue : values.predictedValue;
}

/**
 * @param {AnalyzerTarget[]} targets
 * @param {ShotSample} nextSample
 * @param {TargetContext} context
 * @returns {TargetMatch | null}
 */
export function findTargetMatchWithDirection(targets, nextSample, context) {
  const rawDelayMs = Number(nextSample?.t) - Number(context.anchor?.t);
  const delayMs = Number.isFinite(rawDelayMs) ? Math.max(0, rawDelayMs) : 0;

  for (const target of targets) {
    if (shouldSkipTarget(target, context)) continue;

    const value = getLookAheadMatchedValue(target, nextSample, delayMs, context);
    if (value === undefined) continue;

    if (isTargetHit(target, value, context)) {
      return createTargetMatch(target, value, delayMs, nextSample);
    }
  }
  return null;
}

/**
 * @param {number} delayMs
 * @param {TargetContext} context
 * @returns {TargetValues}
 */
export function predictTargetValuesAtDelay(delayMs, context) {
  const horizon = Math.max(0, delayMs) / 1000;
  const anchor = /** @type {MeasuredSample} */ (context.anchor);
  return {
    pressure: Math.max(0, anchor.cp + context.pressureSlope * horizon),
    flow: Math.max(0, anchor.fl + context.flowSlope * horizon),
    weight: anchor.v + (context.weightRate > 0 ? context.weightRate * horizon : 0),
    pumped: context.anchorPumped + Math.max(0, anchor.fl) * horizon,
  };
}

/**
 * @param {AnalyzerTarget} target
 * @param {ManualTargetContext} context
 * @returns {{ delayMs: number, value: number } | null}
 */
function getManualTargetValue(target, context) {
  const scaleDelaySec = context.normalizedScaleDelayMs / 1000;
  const sensorDelaySec = context.normalizedSensorDelayMs / 1000;
  const anchor = /** @type {MeasuredSample} */ (context.anchor);

  if (target.type === 'pressure') {
    return {
      delayMs: context.normalizedSensorDelayMs,
      value: Math.max(0, anchor.cp + context.pressureSlope * sensorDelaySec),
    };
  }
  if (target.type === 'flow') {
    return {
      delayMs: context.normalizedSensorDelayMs,
      value: Math.max(0, anchor.fl + context.flowSlope * sensorDelaySec),
    };
  }
  if (isWeightTarget(target)) {
    return {
      delayMs: context.normalizedScaleDelayMs,
      value: anchor.v + (context.weightRate > 0 ? context.weightRate * scaleDelaySec : 0),
    };
  }
  if (target.type === 'pumped') {
    return {
      delayMs: context.normalizedSensorDelayMs,
      value: context.anchorPumped + Math.max(0, anchor.fl) * sensorDelaySec,
    };
  }
  return null;
}

/**
 * @param {AnalyzerTarget[]} targets
 * @param {ManualTargetContext} context
 * @returns {TargetMatch | null}
 */
export function findManualTargetMatch(targets, context) {
  for (const target of targets) {
    if (shouldSkipTarget(target, context)) continue;

    const result = getManualTargetValue(target, context);
    if (!result) continue;

    if (isTargetHit(target, result.value, context)) {
      return createTargetMatch(target, result.value, result.delayMs);
    }
  }
  return null;
}

/**
 * @param {AnalyzerTarget} target
 * @param {TargetContext} context
 * @returns {number | undefined}
 */
function getCalculatedTargetValueAtDelay(target, context) {
  // Set by buildTargetCalcValues, the only caller.
  const matchDelayMs = /** @type {number} */ (context.matchDelayMs);
  if (context.observedSample) {
    return getLookAheadMatchedValue(target, context.observedSample, matchDelayMs, context);
  }

  return getTargetValue(target, predictTargetValuesAtDelay(matchDelayMs, context));
}

/**
 * @param {AnalyzerTarget[]} targets
 * @param {TargetMatch} match
 * @param {TargetContext} context
 * @returns {TargetCalcValues | null}
 */
export function buildTargetCalcValues(targets, match, context) {
  if (match.delayMs <= 0) return null;

  /** @type {TargetCalcValues} */
  const targetCalcValues = {};
  /** @type {TargetContext} */
  const calcContext = {
    ...context,
    matchDelayMs: match.delayMs,
    observedSample: match.observedSample,
  };

  for (const target of targets) {
    if (shouldSkipTarget(target, context)) continue;

    const value = getCalculatedTargetValueAtDelay(target, calcContext);
    if (value === undefined) continue;

    targetCalcValues[target.type] = {
      value,
      isStopReason: target === match.target,
    };
  }

  return targetCalcValues;
}

/**
 * Format stop reason type into human-readable string
 * @param {string | null | undefined} type - Raw stop reason type
 * @returns {string} Formatted reason
 */
export function formatStopReason(type) {
  if (!type) return '';

  const t = type.toLowerCase();

  // Map internal types to GM UI friendly labels
  if (t === 'duration') return 'Time Stop';
  if (t === 'ratio') return 'Ratio Stop';
  if (t === 'pumped') return 'Pumped Water Stop';
  if (t === 'volumetric' || t === 'weight') return 'Weight Stop';
  if (t === 'pressure') return 'Pressure Stop';
  if (t === 'flow') return 'Pump Flow Stop';

  // Fallback
  return `${t.charAt(0).toUpperCase() + t.slice(1)} Stop`;
}
