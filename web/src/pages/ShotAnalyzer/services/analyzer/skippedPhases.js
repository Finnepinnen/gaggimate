/** Inserts missing profile phases without discarding or reordering executed shot phases. */

import { createEmptyPhaseStats } from './metricStats';
import { formatStopReason, isTargetHit, isWeightTarget } from './targetMatching';

/** @typedef {import('../../../../types').ShotSample} ShotSample */
/** @typedef {import('../../types').AnalyzedPhase} AnalyzedPhase */
/** @typedef {import('../../types').AnalyzerProfile} AnalyzerProfile */
/** @typedef {import('../../types').AnalyzerProfilePhase} AnalyzerProfilePhase */
/** @typedef {import('../../types').AnalyzerTarget} AnalyzerTarget */
/** @typedef {import('../../types').SamplesByPhase} SamplesByPhase */
/** @typedef {import('../../types').TargetCalcValues} TargetCalcValues */
/** @typedef {{ reason: string, type: string, value: number | null }} SkipInfo */
/** @typedef {AnalyzerProfile & { phases: AnalyzerProfilePhase[] }} ProfileWithPhases */
/**
 * @typedef {object} SkippedPhaseLookup
 * @property {Map<string, AnalyzedPhase>} analyzedByName
 * @property {SamplesByPhase} phases
 * @property {ProfileWithPhases} profileData
 * @property {number} profileIndex
 */

/**
 * @param {string | null | undefined} name
 * @returns {string}
 */
function normalizePhaseLookupName(name) {
  return (name || '').trim().toLowerCase();
}

/**
 * @param {AnalyzerTarget} target
 * @param {AnalyzedPhase} prevPhase
 * @returns {number | undefined}
 */
function getPreviousPhaseTargetValue(target, prevPhase) {
  if (isWeightTarget(target)) return prevPhase.weight ?? 0;
  if (target.type === 'pumped') return prevPhase.water ?? 0;
  if (target.type === 'pressure') return prevPhase.stats?.p?.avg ?? 0;
  if (target.type === 'flow') return prevPhase.stats?.f?.avg ?? 0;
  return undefined;
}

/**
 * @param {AnalyzerTarget} target
 * @param {ShotSample} firstSample
 * @returns {number | undefined}
 */
function getFirstSampleTargetValue(target, firstSample) {
  if (isWeightTarget(target)) return firstSample.v ?? 0;
  if (target.type === 'pressure') return firstSample.cp ?? 0;
  if (target.type === 'flow') return firstSample.fl ?? 0;
  return undefined;
}

/**
 * @param {AnalyzerTarget[] | undefined} targets
 * @param {(target: AnalyzerTarget) => number | undefined} getCurrentValue
 * @returns {SkipInfo | null}
 */
function findSkippedTargetMatch(targets, getCurrentValue) {
  if (!Array.isArray(targets)) return null;

  for (const target of targets) {
    const currentValue = getCurrentValue(target);
    if (currentValue === undefined) continue;

    if (isTargetHit(target, currentValue, { isLastPhase: false })) {
      return {
        reason: `${formatStopReason(target.type)} (skipped)`,
        type: target.type,
        value: target.value,
      };
    }
  }
  return null;
}

/**
 * @param {SkippedPhaseLookup} options
 * @returns {ShotSample | null}
 */
function findNextExecutedFirstSample({ analyzedByName, phases, profileData, profileIndex }) {
  for (let index = profileIndex + 1; index < profileData.phases.length; index++) {
    const nextName = normalizePhaseLookupName(profileData.phases[index].name);
    const nextPhase = analyzedByName.get(nextName);
    if (!nextPhase) continue;

    const nextSamples = phases[nextPhase.number];
    return Array.isArray(nextSamples) ? nextSamples[0] || null : null;
  }
  return null;
}

/**
 * @param {AnalyzedPhase | null} prevPhase
 * @returns {SkipInfo}
 */
function getSkippedPhaseFallbackInfo(prevPhase) {
  return {
    reason: prevPhase ? 'Phase skipped' : 'Phase skipped (no preceding phase)',
    type: 'unknown',
    value: null,
  };
}

/**
 * @param {SkippedPhaseLookup & { prevPhase: AnalyzedPhase | null, profilePhase: AnalyzerProfilePhase }} options
 * @returns {SkipInfo}
 */
function getSkippedPhaseInfo({
  analyzedByName,
  phases,
  prevPhase,
  profileData,
  profileIndex,
  profilePhase,
}) {
  const previousMatch = prevPhase
    ? findSkippedTargetMatch(profilePhase.targets, target =>
        getPreviousPhaseTargetValue(target, prevPhase),
      )
    : null;
  if (previousMatch) return previousMatch;

  const firstSample = findNextExecutedFirstSample({
    analyzedByName,
    phases,
    profileData,
    profileIndex,
  });
  const nextMatch = firstSample
    ? findSkippedTargetMatch(profilePhase.targets, target =>
        getFirstSampleTargetValue(target, firstSample),
      )
    : null;

  return nextMatch || getSkippedPhaseFallbackInfo(prevPhase);
}

/**
 * @param {string} skipType
 * @param {number | null} skipValue
 * @returns {TargetCalcValues | null}
 */
function buildSkippedTargetCalcValues(skipType, skipValue) {
  if (!skipType || skipValue == null) return null;

  /** @type {Record<string, string>} */
  const calcValueByType = {
    duration: 'duration',
    flow: 'flow',
    pressure: 'pressure',
    pumped: 'pumped',
    ratio: 'weight',
    volumetric: 'weight',
    weight: 'weight',
  };
  const calcKey = calcValueByType[skipType];
  if (!calcKey) return null;

  return {
    [calcKey]: {
      value: skipValue,
      isStopReason: true,
    },
  };
}

/**
 * @param {AnalyzerProfilePhase} profilePhase
 * @param {number} profileIndex
 * @param {SkipInfo} skipInfo
 * @returns {AnalyzedPhase}
 */
function createSkippedPhase(profilePhase, profileIndex, skipInfo) {
  return {
    number: profileIndex,
    name: profilePhase.name,
    displayName: profilePhase.name,
    start: 0,
    end: 0,
    duration: 0,
    water: 0,
    weight: 0,
    stats: createEmptyPhaseStats(),
    exit: {
      code: 0,
      reason: skipInfo.reason,
      source: 'inferred',
      type: skipInfo.type || 'unknown',
    },
    profilePhase,
    scaleLost: false,
    scalePermanentlyLost: false,
    highScaleDelay: false,
    estimatedScaleDelayMs: null,
    delayReviewHint: false,
    delayReviewReason: null,
    delayReviewMs: null,
    prediction: { finalWeight: null },
    targetCalcValues: buildSkippedTargetCalcValues(skipInfo.type, skipInfo.value),
    isFinalExecuted: false,
    skipped: true,
  };
}

/**
 * @param {AnalyzedPhase[]} analyzedPhases
 * @returns {Map<string, AnalyzedPhase>}
 */
function buildAnalyzedPhaseLookup(analyzedPhases) {
  /** @type {Map<string, AnalyzedPhase>} */
  const analyzedByName = new Map();

  for (const phase of analyzedPhases) {
    const key = normalizePhaseLookupName(phase.displayName || phase.name);
    if (key) analyzedByName.set(key, phase);
  }

  return analyzedByName;
}

/**
 * @param {AnalyzerProfilePhase[]} profilePhases
 * @param {AnalyzedPhase} phase
 * @param {number} startIndex
 * @returns {number}
 */
function findMatchingProfilePhaseIndex(profilePhases, phase, startIndex) {
  const phaseName = normalizePhaseLookupName(phase.displayName || phase.name);
  if (!phaseName) return -1;

  return profilePhases.findIndex(
    (profilePhase, profileIndex) =>
      profileIndex >= startIndex && normalizePhaseLookupName(profilePhase.name) === phaseName,
  );
}

/**
 * @param {object} options
 * @param {Map<string, AnalyzedPhase>} options.analyzedByName
 * @param {number} options.endIndex
 * @param {AnalyzedPhase[]} options.orderedPhases
 * @param {SamplesByPhase} options.phases
 * @param {AnalyzedPhase | null} options.prevPhase
 * @param {ProfileWithPhases} options.profileData
 * @param {number} options.startIndex
 */
function appendSkippedProfilePhases({
  analyzedByName,
  endIndex,
  orderedPhases,
  phases,
  prevPhase,
  profileData,
  startIndex,
}) {
  for (let profileIndex = startIndex; profileIndex < endIndex; profileIndex++) {
    const profilePhase = profileData.phases[profileIndex];
    if (!normalizePhaseLookupName(profilePhase.name)) continue;

    const skipInfo = getSkippedPhaseInfo({
      analyzedByName,
      phases,
      prevPhase,
      profileData,
      profileIndex,
      profilePhase,
    });
    orderedPhases.push(createSkippedPhase(profilePhase, profileIndex, skipInfo));
  }
}

/**
 * Inserts skipped profile phases into `analyzedPhases` in place.
 * @param {object} options
 * @param {AnalyzedPhase[]} options.analyzedPhases
 * @param {SamplesByPhase} options.phases
 * @param {AnalyzerProfile | null} options.profileData
 */
export function mergeSkippedProfilePhases({ analyzedPhases, phases, profileData }) {
  if (!profileData?.phases?.length) return;
  const profile = /** @type {ProfileWithPhases} */ (profileData);

  const executedPhases = [...analyzedPhases];
  const analyzedByName = buildAnalyzedPhaseLookup(executedPhases);
  /** @type {AnalyzedPhase[]} */
  const orderedPhases = [];
  let profileIndex = 0;
  /** @type {AnalyzedPhase | null} */
  let previousExecutedPhase = null;

  for (const executedPhase of executedPhases) {
    const matchingProfileIndex = findMatchingProfilePhaseIndex(
      profile.phases,
      executedPhase,
      profileIndex,
    );

    if (matchingProfileIndex >= 0) {
      appendSkippedProfilePhases({
        analyzedByName,
        endIndex: matchingProfileIndex,
        orderedPhases,
        phases,
        prevPhase: previousExecutedPhase,
        profileData: profile,
        startIndex: profileIndex,
      });
      profileIndex = matchingProfileIndex + 1;
    }

    orderedPhases.push(executedPhase);
    previousExecutedPhase = executedPhase;
  }

  appendSkippedProfilePhases({
    analyzedByName,
    endIndex: profile.phases.length,
    orderedPhases,
    phases,
    prevPhase: previousExecutedPhase,
    profileData: profile,
    startIndex: profileIndex,
  });

  analyzedPhases.length = 0;
  analyzedPhases.push(...orderedPhases);
}
