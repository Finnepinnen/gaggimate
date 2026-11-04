/** Orchestrates full-shot aggregation while delegating phase-level decisions. */

import { t } from '@lingui/core/macro';
import {
  analyzerDebug,
  createDelayTotals,
  getDelayReviewMessage,
  isAnalyzerDebugEnabled,
} from './delayTracking';
import { getMetricStats } from './metricStats';
import { getLiquidResistanceStats, getNativePuckResistanceStats } from './puckResistance';
import { analyzeExecutedPhase } from './phaseAnalysis';
import { getBluetoothScaleConnectionState } from './scaleConnection';
import { getSlowSampleIntervalSummary } from './sampleIntervals';
import { mergeSkippedProfilePhases } from './skippedPhases';
import { calculatePumpedWater, createPumpedWaterSource } from './waterIntegration';
import { getFinalWeightSample, getFinalWeightSamples } from './weightRate';
import {
  buildRecordedExitReasonByPhase,
  getBrewCompletionLabel,
  getBrewModeLabel,
  getPhaseExitReasonLabel,
  isSafetyExitReason,
  normalizePhaseExitReasonCode,
} from './exitReasons.js';

/** @typedef {import('../../../../types').ShotPhaseTransition} ShotPhaseTransition */
/** @typedef {import('../../../../types').ShotSample} ShotSample */
/** @typedef {import('../../../../types').ShotSystemInfo} ShotSystemInfo */
/** @typedef {import('../../types').AnalysisSettings} AnalysisSettings */
/** @typedef {import('../../types').AnalyzedPhase} AnalyzedPhase */
/** @typedef {import('../../types').AnalyzerProfile} AnalyzerProfile */
/** @typedef {import('../../types').AnalyzerShot} AnalyzerShot */
/** @typedef {import('../../types').DelayTotals} DelayTotals */
/** @typedef {import('../../types').SamplesByPhase} SamplesByPhase */
/** @typedef {import('../../types').ShotAnalysisResult} ShotAnalysisResult */
/** @typedef {import('../../types').TotalStats} TotalStats */

const CONFIGURED_SCALE_DELAY_WARNING_THRESHOLD_MS = 1200;

/**
 * @param {ShotPhaseTransition[] | undefined} [phaseTransitions]
 * @returns {Record<string, string>}
 */
function buildPhaseNameMap(phaseTransitions = []) {
  const transitions = Array.isArray(phaseTransitions) ? phaseTransitions : [];
  return transitions.reduce((map, pt) => {
    map[pt.phaseNumber] = pt.phaseName;
    return map;
  }, /** @type {Record<string, string>} */ ({}));
}

/**
 * @param {ShotSample[]} samples
 * @returns {SamplesByPhase}
 */
function groupSamplesByPhase(samples) {
  return samples.reduce((groups, sample) => {
    const pNum = String(sample.phaseNumber);
    if (!groups[pNum]) groups[pNum] = [];
    groups[pNum].push(sample);
    return groups;
  }, /** @type {SamplesByPhase} */ ({}));
}

/**
 * @param {AnalyzedPhase[]} analyzedPhases
 * @param {number} configuredScaleDelayMs
 * @returns {boolean}
 */
function applyConfiguredScaleDelayWarning(analyzedPhases, configuredScaleDelayMs) {
  const configuredHighScaleDelay =
    configuredScaleDelayMs > CONFIGURED_SCALE_DELAY_WARNING_THRESHOLD_MS;
  const lastExecutedPhase = analyzedPhases.at(-1);

  if (configuredHighScaleDelay && lastExecutedPhase) {
    lastExecutedPhase.highScaleDelay = true;
    lastExecutedPhase.estimatedScaleDelayMs = Math.max(
      lastExecutedPhase.estimatedScaleDelayMs || 0,
      configuredScaleDelayMs,
    );
  }

  return configuredHighScaleDelay;
}

/**
 * @param {AnalyzedPhase[]} analyzedPhases
 * @param {string} brewModeLabel
 * @param {number} configuredScaleDelayMs
 */
function applySkippedPhaseSystemStats(analyzedPhases, brewModeLabel, configuredScaleDelayMs) {
  analyzedPhases.forEach(phase => {
    if (!phase.skipped) return;
    phase.stats.sys_brew_mode = brewModeLabel;
    phase.stats.sys_recorded_stop_reason = t`Not recorded`;
    phase.stats.sys_scale_delay = configuredScaleDelayMs;
  });
}

/**
 * @param {AnalysisSettings & { delayTotals: DelayTotals }} options
 * @returns {{ avgScaleDelay: number, avgSensorDelay: number }}
 */
function getAverageDelaySettings({ delayTotals, isAutoAdjusted, scaleDelayMs, sensorDelayMs }) {
  if (!isAutoAdjusted) {
    return { avgScaleDelay: scaleDelayMs, avgSensorDelay: sensorDelayMs };
  }

  const avgScaleDelay =
    delayTotals.countScaleHits > 0
      ? Math.round(delayTotals.sumScaleDelay / delayTotals.countScaleHits / 50) * 50
      : scaleDelayMs;
  const avgSensorDelay =
    delayTotals.countSensorHits > 0
      ? Math.round(delayTotals.sumSensorDelay / delayTotals.countSensorHits / 50) * 50
      : sensorDelayMs;

  return { avgScaleDelay, avgSensorDelay };
}

/** @param {AnalyzedPhase[]} analyzedPhases */
function getDelayReviewSummary(analyzedPhases) {
  const delayReviewPhases = analyzedPhases
    .map((phase, idx) => ({ ...phase, tablePhaseNumber: idx + 1 }))
    .filter(phase => phase.delayReviewHint);
  const primaryDelayReview =
    delayReviewPhases.length > 0
      ? [...delayReviewPhases].sort((a, b) => (b.delayReviewMs || 0) - (a.delayReviewMs || 0))[0]
      : null;
  const hideLastPhaseDelayReview = primaryDelayReview?.tablePhaseNumber === analyzedPhases.length;
  const shouldExposeDelayReview = Boolean(primaryDelayReview) && !hideLastPhaseDelayReview;
  const delayReviewPhaseNumber =
    shouldExposeDelayReview && primaryDelayReview ? primaryDelayReview.tablePhaseNumber : null;
  const delayReviewMs =
    shouldExposeDelayReview && primaryDelayReview ? primaryDelayReview.delayReviewMs : null;

  return {
    delayReviewHint: shouldExposeDelayReview,
    delayReviewPhaseNumber,
    delayReviewMs,
    delayReviewMessage: getDelayReviewMessage(delayReviewPhaseNumber, delayReviewMs),
  };
}

/**
 * Converts ratio targets to grams using the shot's dose (notes, then profile); without a dose the firmware skips them too.
 * @param {AnalyzerProfile | null} profileData
 * @param {AnalyzerShot} shotData
 * @returns {AnalyzerProfile | null}
 */
function resolveRatioTargets(profileData, shotData) {
  if (!profileData?.phases?.some(phase => phase.targets?.some(t => t.type === 'ratio')))
    return profileData;

  const dose =
    Number.parseFloat(/** @type {string} */ (shotData.notes?.doseIn)) ||
    Number(profileData.dose) ||
    0;
  return {
    ...profileData,
    phases: profileData.phases.map(phase => ({
      ...phase,
      targets: (phase.targets || []).flatMap(target => {
        if (target.type !== 'ratio') return [target];
        return dose > 0 ? [{ ...target, value: target.value * dose, ratio: target.value }] : [];
      }),
    })),
  };
}

/**
 * Main Analysis Function
 * Calculates all metrics for a shot with optional profile comparison
 * * @param {AnalyzerShot | null | undefined} shotData - Shot data with samples array
 * @param {AnalyzerProfile | null} rawProfileData - Optional profile for comparison
 * @param {AnalysisSettings} settings - Analysis settings
 * @returns {ShotAnalysisResult} Analysis results with phases and totals
 */
export function calculateShotMetrics(shotData, rawProfileData, settings) {
  // Defensive guard: ensure valid shot data with samples
  if (!shotData || !Array.isArray(shotData.samples) || shotData.samples.length === 0) {
    return { phases: [], warnings: [t`No sample data available for analysis.`] };
  }
  const profileData = resolveRatioTargets(rawProfileData, shotData);

  const { scaleDelayMs, sensorDelayMs, isAutoAdjusted } = settings;
  const debugEnabled = isAnalyzerDebugEnabled();
  const gSamples = shotData.samples;
  const globalStartTime = gSamples[0].t;
  const lastSample = gSamples[gSamples.length - 1];
  const pumpedWaterSource = createPumpedWaterSource(gSamples);

  // --- 1. PHASE SEPARATION ---
  const phaseNameMap = buildPhaseNameMap(shotData.phaseTransitions);
  const phases = groupSamplesByPhase(gSamples);

  const sortedPhaseKeys = Object.keys(phases).sort((a, b) => Number(a) - Number(b));
  // gSamples is non-empty, so there is at least one phase key.
  const lastPhaseKey = /** @type {string} */ (sortedPhaseKeys.at(-1));
  const recordedExitReasonByPhase = buildRecordedExitReasonByPhase(shotData);

  // --- 2. BREW MODE DETECTION ---
  const startSysInfo = gSamples[0].systemInfo || /** @type {Partial<ShotSystemInfo>} */ ({});
  const isBrewByWeight = startSysInfo.shotStartedVolumetric === true;
  const brewModeLabel = getBrewModeLabel(isBrewByWeight);
  const configuredScaleDelayMs = Math.max(0, Number(shotData.brewDelay) || 0);
  const finalExitReasonCode = normalizePhaseExitReasonCode(shotData.finalExitReason);
  const finalExitReasonLabel = getPhaseExitReasonLabel(finalExitReasonCode);

  const globalScaleLost = isBrewByWeight && getBluetoothScaleConnectionState(gSamples).scaleLost;
  const { hasSlowSampleInterval, maxSampleIntervalMs } = getSlowSampleIntervalSummary(gSamples);

  // --- 3. GLOBAL TOTALS ---
  const gDuration = (lastSample.t - gSamples[0].t) / 1000;
  const gWater = calculatePumpedWater(gSamples, gSamples.length - 1, null, pumpedWaterSource);
  const gWeightSamples = getFinalWeightSamples(gSamples);
  const gWeight = (getFinalWeightSample(gSamples) || lastSample).v;

  // --- 4. PHASE-BY-PHASE ANALYSIS ---
  /** @type {AnalyzedPhase[]} */
  const analyzedPhases = [];
  const delayTotals = createDelayTotals();
  let bluetoothScaleWasConnected = false;
  let scaleConnectionBrokenPermanently = false;

  for (const phaseNum of sortedPhaseKeys) {
    const result = analyzeExecutedPhase({
      debugEnabled,
      delayTotals,
      globalStartTime,
      isAutoAdjusted,
      isBrewByWeight,
      lastPhaseKey,
      phaseNameMap,
      phaseNum,
      phases,
      profileData,
      pumpedWaterSource,
      recordedExitReasonCode: recordedExitReasonByPhase.get(String(phaseNum)) || 0,
      bluetoothScaleWasConnected,
      scaleConnectionBrokenPermanently,
      settings,
      shotData,
      sortedPhaseKeys,
    });
    analyzedPhases.push(result.phase);
    bluetoothScaleWasConnected = result.bluetoothScaleWasConnected;
    scaleConnectionBrokenPermanently = result.scaleConnectionBrokenPermanently;
  }

  const configuredHighScaleDelay = applyConfiguredScaleDelayWarning(
    analyzedPhases,
    configuredScaleDelayMs,
  );

  // --- 4b. DETECT SKIPPED PHASES (phases defined in profile but absent from shot) ---
  mergeSkippedProfilePhases({ analyzedPhases, phases, profileData });
  applySkippedPhaseSystemStats(analyzedPhases, brewModeLabel, configuredScaleDelayMs);

  // Calculate distinct Average Delays
  const { avgScaleDelay, avgSensorDelay } = getAverageDelaySettings({
    delayTotals,
    isAutoAdjusted,
    scaleDelayMs,
    sensorDelayMs,
  });

  analyzerDebug(debugEnabled, 'Auto-delay summary', {
    shotId: shotData.id,
    isAutoAdjusted,
    scaleHits: delayTotals.countScaleHits,
    sensorHits: delayTotals.countSensorHits,
    avgScaleDelayMs: avgScaleDelay,
    avgSensorDelayMs: avgSensorDelay,
  });

  // --- 5. TOTAL STATS ---
  const finalSysInfo = lastSample.systemInfo || /** @type {Partial<ShotSystemInfo>} */ ({});

  /** @type {TotalStats} */
  const totalStats = {
    duration: gDuration,
    water: gWater,
    // TotalStats.weight is typed number; undefined when no sample carries `v`.
    weight: /** @type {number} */ (gWeight),
    p: getMetricStats(gSamples, 'cp'),
    tp: getMetricStats(gSamples, 'tp'),
    f: getMetricStats(gSamples, 'fl'),
    pf: getMetricStats(gSamples, 'pf'),
    tf: getMetricStats(gSamples, 'tf'),
    t: getMetricStats(gSamples, 'ct'),
    tt: getMetricStats(gSamples, 'tt'),
    w: getMetricStats(gWeightSamples, 'v'),
    wf: getMetricStats(gSamples, 'vf'),
    pr: getNativePuckResistanceStats(gSamples),
    lr: getLiquidResistanceStats(gSamples),
    sys_raw: finalSysInfo.raw,
    sys_shot_vol: finalSysInfo.shotStartedVolumetric,
    sys_curr_vol: finalSysInfo.currentlyVolumetric,
    sys_scale: finalSysInfo.activeScaleConnected,
    sys_vol_avail: finalSysInfo.volumetricAvailable,
    sys_ext: finalSysInfo.extendedRecording,
    sys_brew_mode: brewModeLabel,
    sys_recorded_stop_reason: finalExitReasonLabel,
    sys_scale_delay: configuredScaleDelayMs,
  };

  const highScaleDelayPhases = analyzedPhases.filter(p => p.highScaleDelay);
  const hasHighScaleDelay = highScaleDelayPhases.length > 0;
  const highScaleDelayMs = hasHighScaleDelay
    ? Math.max(...highScaleDelayPhases.map(p => p.estimatedScaleDelayMs || 0))
    : null;
  const delayReviewSummary = getDelayReviewSummary(analyzedPhases);

  return {
    isBrewByWeight,
    globalScaleLost,
    hasSlowSampleInterval,
    maxSampleIntervalMs,
    highScaleDelay: hasHighScaleDelay,
    highScaleDelayMs,
    delayReviewHint: delayReviewSummary.delayReviewHint,
    delayReviewPhaseNumber: delayReviewSummary.delayReviewPhaseNumber,
    delayReviewMs: delayReviewSummary.delayReviewMs,
    delayReviewMessage: delayReviewSummary.delayReviewMessage,
    isAutoAdjusted,
    brewModeLabel,
    completionLabel: getBrewCompletionLabel(isBrewByWeight, finalExitReasonCode),
    completionTone: isSafetyExitReason(finalExitReasonCode) ? 'warning' : 'default',
    configuredHighScaleDelay,
    configuredScaleDelayMs,
    finalExitReasonCode,
    finalExitReasonLabel,
    usedSettings: {
      scaleDelayMs: avgScaleDelay,
      sensorDelayMs: avgSensorDelay,
    },
    phases: analyzedPhases,
    total: totalStats,
    rawSamples: gSamples,
    startTime: globalStartTime,
  };
}

/**
 * Auto-Delay Detection
 * Optimization Loop: 0 to 3000ms in 100ms steps.
 * Special Handling: Last phase weight target is calculated independently.
 * * @param {AnalyzerShot | null | undefined} shotData - Shot data
 * @param {AnalyzerProfile | null} profileData - Profile data with targets
 * @param {number} fallbackDelay - Delay used when automatic detection cannot find a match
 * @returns {{ delay: number, auto: boolean }}
 */
export function detectAutoDelay(shotData, profileData, fallbackDelay) {
  // Perform a quick check using calculateShotMetrics logic
  const results = calculateShotMetrics(shotData, profileData, {
    scaleDelayMs: fallbackDelay,
    sensorDelayMs: fallbackDelay,
    isAutoAdjusted: true,
  });

  if (results?.usedSettings) {
    // Return scale delay as primary "detected" delay for legacy compatibility
    return { delay: results.usedSettings.scaleDelayMs, auto: true };
  }

  return { delay: fallbackDelay, auto: false };
}
