/** Builds phase, stop, and overview metadata shared by chart rendering and tooltips. */

import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faFaucet } from '@fortawesome/free-solid-svg-icons/faFaucet';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faPercent } from '@fortawesome/free-solid-svg-icons/faPercent';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { getPhaseName } from '../helpers';
import { getDisplayStopReasonParts } from '../../../utils/analyzerUtils';
import { getLastNonExtendedIndex } from '../../../services/analyzer/weightRate';
import { isWeightType } from '../../../services/analyzer/exitReasons.js';

/** @typedef {import('./types').AnalyzerPhase} AnalyzerPhase */
/** @typedef {import('./types').AnalyzerResults} AnalyzerResults */
/** @typedef {import('./types').ChartSample} ChartSample */
/** @typedef {import('./types').ChartShotData} ChartShotData */
/** @typedef {import('./types').ChartVisibility} ChartVisibility */
/** @typedef {import('./types').PhaseAnnotation} PhaseAnnotation */
/** @typedef {import('./types').PhaseAnnotationMap} PhaseAnnotationMap */
/** @typedef {import('./types').PhaseBackgroundRange} PhaseBackgroundRange */
/** @typedef {import('./types').PhaseLabelOverlay} PhaseLabelOverlay */
/** @typedef {import('./types').PhaseNumberResolver} PhaseNumberResolver */
/** @typedef {import('./types').PhaseOverviewRow} PhaseOverviewRow */
/** @typedef {import('./types').ShotChartColors} ShotChartColors */
/** @typedef {import('./types').StopIconOverlay} StopIconOverlay */
/** @typedef {import('../../../../../types').ShotPhaseTransition} ShotPhaseTransition */
/** @typedef {{ time: number, zeroBased: number }} PhaseStart */

/** @param {AnalyzerPhase | null | undefined} phase */
function getRecordedStopActualValue(phase) {
  if (phase?.exit?.source !== 'recorded') return null;

  const value = Number(phase.exit.actualValue);
  return phase.exit.actualValue != null && Number.isFinite(value) ? value : null;
}

/**
 * @param {AnalyzerPhase | null | undefined} phase
 * @param {string} exitType
 * @returns {number | null}
 */
function getStopActualValue(phase, exitType) {
  if (!phase || !exitType) return null;

  const recordedValue = getRecordedStopActualValue(phase);
  if (recordedValue != null) return recordedValue;

  let calcValue = phase.targetCalcValues?.[exitType]?.value;
  if (!Number.isFinite(Number(calcValue)) && isWeightType(exitType)) {
    const altType = ['volumetric', 'weight', 'ratio'].find(
      type => type !== exitType && phase.targetCalcValues?.[type],
    );
    calcValue = altType ? phase.targetCalcValues[altType].value : undefined;
  }
  if (Number.isFinite(Number(calcValue))) return Number(calcValue);

  // For skipped phases, only use calc values — raw values are meaningless.
  if (phase.skipped) return null;

  if (exitType === 'duration') return Number(phase.duration);
  if (isWeightType(exitType)) {
    const predictedWeight = Number(phase.prediction?.finalWeight);
    if (Number.isFinite(predictedWeight)) return predictedWeight;
    return Number(phase.weight);
  }
  if (exitType === 'pumped') return Number(phase.water);
  if (exitType === 'pressure') return Number(phase.stats?.p?.end);
  if (exitType === 'flow') return Number(phase.stats?.f?.end);

  return null;
}

/**
 * @param {AnalyzerPhase | null | undefined} phase
 * @param {string} exitType
 */
function getStopTargetValue(phase, exitType) {
  if (!phase?.profilePhase || !exitType) return null;
  if (exitType === 'duration') return phase.profilePhase.duration;

  const targets = Array.isArray(phase.profilePhase.targets) ? phase.profilePhase.targets : [];
  const target = targets.find(candidate => {
    if (isWeightType(exitType)) return isWeightType(candidate?.type);
    return candidate?.type === exitType;
  });
  return target?.value ?? null;
}

/** @param {string} exitType */
function getStopUnit(exitType) {
  if (exitType === 'duration') return 's';
  if (isWeightType(exitType)) return 'g';
  if (exitType === 'pumped') return 'ml';
  if (exitType === 'pressure') return 'bar';
  if (exitType === 'flow') return 'ml/s';
  return '';
}

/**
 * @param {unknown} value
 * @param {string} unit
 */
function formatStopValue(value, unit) {
  if (value == null) return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  const formattedValue = numeric.toFixed(1);
  return unit ? `${formattedValue} ${unit}` : formattedValue;
}

/** @param {AnalyzerPhase | null | undefined} phase */
function getPhaseStopValue(phase) {
  const exitType = phase?.exit?.type;
  if (!exitType) return '-';
  return formatStopValue(getStopActualValue(phase, exitType), getStopUnit(exitType));
}

/** @param {AnalyzerPhase | null | undefined} phase */
function getPhaseStopTargetValue(phase) {
  const exitType = phase?.exit?.type;
  if (!exitType) return null;

  const targetValue = getStopTargetValue(phase, exitType);
  if (!Number.isFinite(Number(targetValue))) return null;
  return formatStopValue(targetValue, getStopUnit(exitType));
}

/**
 * @param {unknown} rawPhaseNumber
 * @param {number} [fallbackIndex]
 */
function getZeroBasedPhaseNumber(rawPhaseNumber, fallbackIndex = 0) {
  const numericPhaseNumber = Number(rawPhaseNumber);
  return Number.isFinite(numericPhaseNumber) ? numericPhaseNumber : fallbackIndex;
}

/** @param {unknown} value */
function normalizePhaseNameKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * @param {AnalyzerResults | null | undefined} results
 * @returns {PhaseNumberResolver}
 */
function buildPhaseNumberResolver(results) {
  const resultPhases = Array.isArray(results?.phases) ? results.phases : [];
  const isProfileOrdered = resultPhases.some(phase => phase?.profilePhase || phase?.skipped);

  if (!isProfileOrdered) {
    return (rawPhaseNumber, fallbackIndex = 0) =>
      getZeroBasedPhaseNumber(rawPhaseNumber, fallbackIndex);
  }

  /** @type {Map<string, number>} */
  const byName = new Map();
  /** @type {Map<number, number>} */
  const rawCounts = new Map();
  /** @type {Map<number, number>} */
  const rawToProfileIndex = new Map();

  resultPhases.forEach((phase, profileIndex) => {
    [phase?.profilePhase?.name, phase?.displayName, phase?.name].forEach(name => {
      const key = normalizePhaseNameKey(name);
      if (key && !byName.has(key)) byName.set(key, profileIndex);
    });

    const rawNumber = Number(phase?.number);
    if (Number.isFinite(rawNumber)) {
      rawCounts.set(rawNumber, (rawCounts.get(rawNumber) || 0) + 1);
      rawToProfileIndex.set(rawNumber, profileIndex);
    }
  });

  rawCounts.forEach((count, rawNumber) => {
    if (count > 1) rawToProfileIndex.delete(rawNumber);
  });

  return (rawPhaseNumber, fallbackIndex = 0, phaseName = null) => {
    const nameKey = normalizePhaseNameKey(phaseName);
    if (nameKey && byName.has(nameKey)) return byName.get(nameKey);

    const numericPhaseNumber = Number(rawPhaseNumber);
    if (Number.isFinite(numericPhaseNumber) && rawToProfileIndex.has(numericPhaseNumber)) {
      return rawToProfileIndex.get(numericPhaseNumber);
    }

    return getZeroBasedPhaseNumber(rawPhaseNumber, fallbackIndex);
  };
}

/** @param {number} phaseNumber */
function getStopBadgePadding(phaseNumber) {
  const digitCount = String(Math.max(0, Number(phaseNumber) || 0)).length;
  return {
    x: digitCount <= 1 ? 7 : 3,
    y: 4,
  };
}

const STOP_BADGE_X_ADJUST = 18;
const STOP_BADGE_Y_ADJUST = -30;

/** @type {Record<string, import('@fortawesome/fontawesome-svg-core').IconDefinition | undefined>} */
const STOP_ICON_BY_TYPE = {
  pressure: faGauge,
  flow: faFaucet,
  weight: faScaleBalanced,
  volumetric: faScaleBalanced,
  ratio: faPercent,
  duration: faClock,
  pumped: faDroplet,
  safety: faTriangleExclamation,
};
const WEIGHT_STOP_LEFT_X_ADJUST = -STOP_BADGE_X_ADJUST;
const WEIGHT_STOP_LEFT_Y_ADJUST = STOP_BADGE_Y_ADJUST;

/**
 * @param {import('./types').AnnotationScriptContext | undefined} context
 * @param {string} scaleId
 * @param {number} value
 * @param {number} pixelOffset
 */
function getShiftedScaleValue(context, scaleId, value, pixelOffset) {
  const scale = context?.chart?.scales?.[scaleId];
  if (!scale || !Number.isFinite(Number(value))) return value;

  const pixel = scale.getPixelForValue(Number(value));
  if (!Number.isFinite(pixel)) return value;

  return scale.getValueForPixel(pixel + pixelOffset);
}

/** @param {ChartShotData | null | undefined} shotData */
function buildPhaseNameCache(shotData) {
  /** @type {Map<number, string>} */
  const phaseNameCache = new Map();
  if (!Array.isArray(shotData?.phaseTransitions)) return phaseNameCache;

  shotData.phaseTransitions.forEach(transition => {
    const zeroBased = getZeroBasedPhaseNumber(transition.phaseNumber, 0);
    if (!phaseNameCache.has(zeroBased) && transition.phaseName) {
      phaseNameCache.set(zeroBased, transition.phaseName);
    }
  });

  return phaseNameCache;
}

/**
 * @param {{
 *   transition: ShotPhaseTransition | undefined,
 *   samples: ChartSample[],
 *   sampleInterval: number | undefined,
 * }} params
 */
function getTransitionTimeInSeconds({ transition, samples, sampleInterval }) {
  if (transition?.sampleIndex === undefined) return 0;
  const sample = samples[transition.sampleIndex];
  if (sample) return (sample.t || 0) / 1000;
  return (transition.sampleIndex * (sampleInterval || 250)) / 1000;
}

/**
 * @param {{ value: number }} params
 * @returns {PhaseAnnotation}
 */
function createPhaseSeparatorAnnotation({ value }) {
  return {
    type: 'line',
    scaleID: 'x',
    value,
    borderColor: 'transparent',
    borderWidth: 0,
    display: false,
    label: {
      display: false,
    },
  };
}

/** @param {AnalyzerPhase | null | undefined} phase */
function getResultPhaseNameKeys(phase) {
  return [phase?.profilePhase?.name, phase?.displayName, phase?.name].map(normalizePhaseNameKey);
}

/**
 * @param {AnalyzerResults | null | undefined} results
 * @param {ShotPhaseTransition | undefined} transition
 */
function findResultPhaseForTransition(results, transition) {
  const transitionNameKey = normalizePhaseNameKey(transition?.phaseName);
  const resultPhases = Array.isArray(results?.phases) ? results.phases : [];

  if (transitionNameKey) {
    const phaseByName = resultPhases.find(phase =>
      getResultPhaseNameKeys(phase).includes(transitionNameKey),
    );
    if (phaseByName) return phaseByName;
  }

  return resultPhases.find(phase => String(phase.number) === String(transition?.phaseNumber));
}

/** @param {ChartSample[]} samples */
function getMaxPressure(samples) {
  let maxCp = 0;
  for (const sample of samples) {
    const cp = sample.cp ?? 0;
    if (cp > maxCp) maxCp = cp;
  }
  return maxCp;
}

/** @type {Record<string, 'fl' | 'cp' | undefined>} */
const MAIN_STOP_SAMPLE_KEY_BY_EXIT_TYPE = {
  flow: 'fl',
  pressure: 'cp',
  pumped: 'fl',
};

/**
 * @param {string} exitType
 * @param {ChartSample | null | undefined} refSample
 * @param {ChartSample[]} samples
 * @returns {number}
 */
function getMainStopYValue(exitType, refSample, samples) {
  const sampleKey = MAIN_STOP_SAMPLE_KEY_BY_EXIT_TYPE[exitType];
  if (sampleKey) return refSample?.[sampleKey] ?? 0;
  if (exitType === 'duration' && samples.length > 0) {
    return refSample?.cp ?? getMaxPressure(samples) / 2;
  }
  return 0;
}

/**
 * @param {{
 *   exitType: string,
 *   stopSample: ChartSample | null | undefined,
 *   samples: ChartSample[],
 * }} params
 * @returns {{ yValue: number, yScaleID: string }}
 */
function getStopPosition({ exitType, stopSample, samples }) {
  const isWeightStop = isWeightType(exitType);

  if (isWeightStop) {
    return {
      yValue: stopSample?.v ?? 0,
      yScaleID: 'yWeight',
    };
  }

  return {
    yValue: getMainStopYValue(exitType, stopSample, samples),
    yScaleID: 'yMain',
  };
}

/**
 * @param {{
 *   xValue: number,
 *   yValue: number,
 *   yScaleID: string,
 *   displayNumber: number,
 *   calloutDisplay: boolean,
 *   calloutSide: number,
 *   xAdjust: number,
 *   yAdjust: number,
 *   fontSize: number,
 *   calloutBorderWidth: number,
 *   color?: string,
 * }} params
 * @returns {PhaseAnnotation}
 */
function createStopLabelAnnotation({
  xValue,
  yValue,
  yScaleID,
  displayNumber,
  calloutDisplay,
  calloutSide,
  xAdjust,
  yAdjust,
  fontSize,
  calloutBorderWidth,
  color = '#dc2626',
}) {
  return {
    type: 'label',
    xScaleID: 'x',
    yScaleID,
    xValue,
    yValue,
    display: false,
    content: [String(displayNumber)],
    backgroundColor: color,
    borderRadius: 999,
    borderWidth: 0,
    color,
    font: { size: fontSize, weight: 'bold' },
    padding: getStopBadgePadding(displayNumber),
    callout: {
      display: calloutDisplay,
      position: 'bottom',
      side: calloutSide,
      start: '50%',
      margin: 6,
      borderColor: color,
      borderWidth: calloutBorderWidth,
    },
    xAdjust,
    yAdjust,
  };
}

/**
 * @param {{
 *   stopIconOverlays: StopIconOverlay[],
 *   exitType: string,
 *   visible: boolean,
 *   xValue: number,
 *   yValue: number,
 *   yScaleID: string,
 *   xOffset: number,
 *   yOffset: number,
 *   color?: string,
 * }} params
 */
function addStopIconOverlay({
  stopIconOverlays,
  exitType,
  visible,
  xValue,
  yValue,
  yScaleID,
  xOffset,
  yOffset,
  color = '#ffffff',
}) {
  const stopIcon = STOP_ICON_BY_TYPE[exitType];
  if (!stopIcon) return;

  stopIconOverlays.push({
    visible,
    iconDef: stopIcon,
    xValue,
    yValue,
    xScaleID: 'x',
    yScaleID,
    xOffset,
    yOffset,
    color,
  });
}

/**
 * @param {{
 *   phaseAnnotations: PhaseAnnotationMap,
 *   stopIconOverlays: StopIconOverlay[],
 *   transition: ShotPhaseTransition,
 *   previousTransition: ShotPhaseTransition,
 *   index: number,
 *   samples: ChartSample[],
 *   results: AnalyzerResults | null | undefined,
 *   visibility: ChartVisibility,
 *   resolvePhaseNumber: PhaseNumberResolver,
 *   timeInSeconds: number,
 *   colors: ShotChartColors,
 * }} params
 */
function addTransitionStopAnnotation({
  phaseAnnotations,
  stopIconOverlays,
  transition,
  previousTransition,
  index,
  samples,
  results,
  visibility,
  resolvePhaseNumber,
  timeInSeconds,
  colors,
}) {
  const endedPhase = findResultPhaseForTransition(results, previousTransition);
  if (!endedPhase?.exit?.reason) return;

  const stopSample = transition.sampleIndex === undefined ? null : samples[transition.sampleIndex];
  const exitType = endedPhase.exit.type || '';
  const stopColor = exitType === 'safety' ? colors.warning : colors.stopLabel;
  const { yValue, yScaleID } = getStopPosition({ exitType, stopSample, samples });
  const stopPhaseNum = resolvePhaseNumber(
    previousTransition.phaseNumber,
    index - 1,
    previousTransition.phaseName,
  );
  const stopPhaseDisplayNum = stopPhaseNum + 1;

  phaseAnnotations[`phase_stop_${index}`] = createStopLabelAnnotation({
    xValue: timeInSeconds,
    yValue,
    yScaleID,
    displayNumber: stopPhaseDisplayNum,
    calloutDisplay: visibility.stops,
    calloutSide: -11,
    xAdjust: STOP_BADGE_X_ADJUST,
    yAdjust: STOP_BADGE_Y_ADJUST,
    fontSize: 12,
    calloutBorderWidth: 2.5,
    color: stopColor,
  });

  addStopIconOverlay({
    stopIconOverlays,
    exitType,
    visible: visibility.stops,
    xValue: timeInSeconds,
    yValue,
    yScaleID,
    xOffset: STOP_BADGE_X_ADJUST,
    yOffset: STOP_BADGE_Y_ADJUST,
    color: '#ffffff',
  });
}

/**
 * @param {{
 *   phaseAnnotations: PhaseAnnotationMap,
 *   stopIconOverlays: StopIconOverlay[],
 *   shotData: ChartShotData | null | undefined,
 *   results: AnalyzerResults | null | undefined,
 *   samples: ChartSample[],
 *   colors: ShotChartColors,
 *   visibility: ChartVisibility,
 *   resolvePhaseNumber: PhaseNumberResolver,
 * }} params
 */
function addPhaseSeparatorAndStops({
  phaseAnnotations,
  stopIconOverlays,
  shotData,
  results,
  samples,
  colors,
  visibility,
  resolvePhaseNumber,
}) {
  const transitions = Array.isArray(shotData?.phaseTransitions) ? shotData.phaseTransitions : [];
  if (transitions.length === 0) return;

  if (samples.length > 0) {
    const shotStartTime = (samples[0].t || 0) / 1000;
    phaseAnnotations.shot_start = createPhaseSeparatorAnnotation({
      value: shotStartTime,
      // @ts-expect-error colors/visibility are passed but createPhaseSeparatorAnnotation ignores them
      colors,
      visibility,
    });
  }

  for (const [index, transition] of transitions.entries()) {
    const timeInSeconds = getTransitionTimeInSeconds({
      transition,
      samples,
      sampleInterval: shotData.sampleInterval,
    });
    if (timeInSeconds <= 0.1 && index === 0) continue;

    phaseAnnotations[`phase_line_${index}`] = createPhaseSeparatorAnnotation({
      value: timeInSeconds,
      // @ts-expect-error colors/visibility are passed but createPhaseSeparatorAnnotation ignores them
      colors,
      visibility,
    });

    const previousTransition = transitions[index - 1];
    if (previousTransition && Array.isArray(results?.phases)) {
      addTransitionStopAnnotation({
        phaseAnnotations,
        stopIconOverlays,
        transition,
        previousTransition,
        index,
        samples,
        results,
        visibility,
        resolvePhaseNumber,
        timeInSeconds,
        colors,
      });
    }
  }
}

/**
 * @param {{
 *   shotData: ChartShotData | null | undefined,
 *   samples: ChartSample[],
 *   maxTime: number,
 *   resolvePhaseNumber: PhaseNumberResolver,
 * }} params
 * @returns {PhaseStart[]}
 */
function buildPhaseStarts({ shotData, samples, maxTime, resolvePhaseNumber }) {
  const transitions = Array.isArray(shotData?.phaseTransitions) ? shotData.phaseTransitions : [];
  if (transitions.length === 0) return [];

  const firstSample = samples[0] || /** @type {Partial<ChartSample>} */ ({});
  /** @type {Partial<ShotPhaseTransition>} */
  const firstTransition =
    transitions.find(transition => {
      const sampleIndex = Number(transition?.sampleIndex);
      return Number.isFinite(sampleIndex) && sampleIndex <= 0;
    }) ||
    transitions[0] ||
    {};
  const shotStartTime = samples.length > 0 ? (firstSample.t || 0) / 1000 : 0;
  const phaseStarts = [
    {
      time: shotStartTime,
      zeroBased: resolvePhaseNumber(
        firstSample.phaseNumber ?? firstTransition.phaseNumber,
        0,
        firstSample.phaseName || firstTransition.phaseName,
      ),
    },
  ];

  for (const [index, transition] of transitions.entries()) {
    const timeInSeconds = getTransitionTimeInSeconds({
      transition,
      samples,
      sampleInterval: shotData.sampleInterval,
    });
    if (timeInSeconds <= 0.1 && index === 0) continue;

    phaseStarts.push({
      time: timeInSeconds,
      zeroBased: resolvePhaseNumber(transition.phaseNumber, index, transition.phaseName),
    });
  }

  return phaseStarts.filter((phaseStart, index, allStarts) => {
    const nextTime = allStarts[index + 1]?.time ?? maxTime;
    return Number.isFinite(phaseStart.time) && nextTime - phaseStart.time > 0.05;
  });
}

/**
 * @param {{
 *   phaseLabelOverlays: PhaseLabelOverlay[],
 *   phaseStarts: PhaseStart[],
 *   maxTime: number,
 *   getPhaseLabel: (zeroBasedNum: number) => string,
 *   usePhaseNumbers: boolean,
 *   visibility: ChartVisibility,
 * }} params
 */
function addPhaseLabelOverlays({
  phaseLabelOverlays,
  phaseStarts,
  maxTime,
  getPhaseLabel,
  usePhaseNumbers,
  visibility,
}) {
  phaseStarts.forEach((phaseStart, index, allStarts) => {
    const nextTime = allStarts[index + 1]?.time ?? maxTime;
    phaseLabelOverlays.push({
      key: `phase_label_${index}`,
      label: getPhaseLabel(phaseStart.zeroBased),
      xValue: phaseStart.time + (nextTime - phaseStart.time) / 2,
      usePhaseNumbers,
      display: visibility.phaseNames,
    });
  });
}

/**
 * @param {{
 *   phaseBackgroundRanges: PhaseBackgroundRange[],
 *   phaseStarts: PhaseStart[],
 *   maxTime: number,
 *   visibility: ChartVisibility,
 *   extendedStartX?: number | null,
 * }} params
 */
function addPhaseBackgroundRanges({
  phaseBackgroundRanges,
  phaseStarts,
  maxTime,
  visibility,
  extendedStartX = null,
}) {
  let rangeIndex = 0;
  phaseStarts.forEach((phaseStart, index, allStarts) => {
    const nextTime = allStarts[index + 1]?.time ?? maxTime;
    const boundaries = [phaseStart.time];
    if (
      Number.isFinite(extendedStartX) &&
      extendedStartX - phaseStart.time > 0.05 &&
      nextTime - extendedStartX > 0.05
    ) {
      boundaries.push(extendedStartX);
    }
    boundaries.push(nextTime);

    for (let boundaryIndex = 0; boundaryIndex < boundaries.length - 1; boundaryIndex += 1) {
      phaseBackgroundRanges.push({
        startX: boundaries[boundaryIndex],
        endX: boundaries[boundaryIndex + 1],
        visible: visibility.phaseNames,
        shaded: rangeIndex % 2 === 0,
      });
      rangeIndex += 1;
    }
  });
}

/**
 * @param {ChartSample[]} samples
 * @param {number} maxTime
 * @returns {number | null}
 */
export function getExtendedRecordingStartX(samples, maxTime) {
  const firstExtendedSample = samples.find(sample => sample?.systemInfo?.extendedRecording);
  const startX = Number(firstExtendedSample?.t) / 1000;
  const endX = Number(maxTime);

  if (!Number.isFinite(startX) || !Number.isFinite(endX) || endX - startX <= 0.05) {
    return null;
  }

  return startX;
}

/**
 * @param {{
 *   phaseAnnotations: PhaseAnnotationMap,
 *   stopTimeSec: number,
 *   yScaleID: string,
 *   yValue: number,
 * }} params
 */
function addFinalWeightStopLines({ phaseAnnotations, stopTimeSec, yScaleID, yValue }) {
  phaseAnnotations.shot_end = {
    type: 'line',
    scaleID: 'x',
    value: stopTimeSec,
    display: false,
    borderColor: 'transparent',
    borderWidth: 0,
  };

  phaseAnnotations.shot_end_stop_line = {
    type: 'line',
    xScaleID: 'x',
    yScaleID,
    xMin: stopTimeSec,
    xMax: context => getShiftedScaleValue(context, 'x', stopTimeSec, WEIGHT_STOP_LEFT_X_ADJUST),
    yMin: yValue,
    yMax: context => getShiftedScaleValue(context, yScaleID, yValue, WEIGHT_STOP_LEFT_Y_ADJUST),
    display: false,
    borderColor: '#dc2626',
    borderWidth: 2.5,
  };
}

/**
 * @param {ChartSample[]} samples
 * @returns {ChartSample | null}
 */
function getLastPhaseStopSample(samples) {
  const lastNonExtendedIndex = getLastNonExtendedIndex(samples);
  return lastNonExtendedIndex >= 0 ? samples[lastNonExtendedIndex] : samples.at(-1) || null;
}

/**
 * @param {{
 *   maxTime: number,
 *   resolvePhaseNumber: PhaseNumberResolver,
 *   results: AnalyzerResults | null | undefined,
 *   samples: ChartSample[],
 * }} params
 */
function resolveFinalStopAnnotationContext({ maxTime, resolvePhaseNumber, results, samples }) {
  const resultPhases = Array.isArray(results?.phases) ? results.phases : [];
  if (resultPhases.length === 0) return null;

  const lastPhase = resultPhases.find(phase => phase?.isFinalExecuted) || resultPhases.at(-1);
  if (!lastPhase?.exit?.reason) return null;

  const exitType = lastPhase.exit.type || '';
  const isWeightStop = isWeightType(exitType);
  const lastPhaseStopSample = getLastPhaseStopSample(samples);
  const stopTimeMs = Number(lastPhaseStopSample?.t);
  const stopTimeSec = isWeightStop && Number.isFinite(stopTimeMs) ? stopTimeMs / 1000 : maxTime;
  const refSample = isWeightStop ? lastPhaseStopSample : samples.at(-1) || null;
  const position = getStopPosition({
    exitType,
    stopSample: refSample,
    samples,
  });
  const lastPhaseNum = resolvePhaseNumber(
    lastPhase.number,
    resultPhases.length - 1,
    lastPhase.profilePhase?.name || lastPhase.displayName || lastPhase.name,
  );

  return {
    exitType,
    isWeightStop,
    lastPhaseDisplayNum: lastPhaseNum + 1,
    stopTimeSec,
    ...position,
  };
}

/**
 * @param {{
 *   phaseAnnotations: PhaseAnnotationMap,
 *   stopIconOverlays: StopIconOverlay[],
 *   results: AnalyzerResults | null | undefined,
 *   samples: ChartSample[],
 *   maxTime: number,
 *   visibility: ChartVisibility,
 *   resolvePhaseNumber: PhaseNumberResolver,
 *   colors: ShotChartColors,
 * }} params
 */
function addFinalStopAnnotations({
  phaseAnnotations,
  stopIconOverlays,
  results,
  samples,
  maxTime,
  visibility,
  resolvePhaseNumber,
  colors,
}) {
  const context = resolveFinalStopAnnotationContext({
    maxTime,
    resolvePhaseNumber,
    results,
    samples,
  });
  if (!context) return;

  const { exitType, isWeightStop, lastPhaseDisplayNum, stopTimeSec, yScaleID, yValue } = context;
  const stopColor = exitType === 'safety' ? colors.warning : colors.stopLabel;
  const xAdjust = isWeightStop ? WEIGHT_STOP_LEFT_X_ADJUST : -STOP_BADGE_X_ADJUST;
  const yAdjust = isWeightStop ? WEIGHT_STOP_LEFT_Y_ADJUST : STOP_BADGE_Y_ADJUST;

  if (isWeightStop) {
    addFinalWeightStopLines({ phaseAnnotations, stopTimeSec, yScaleID, yValue });
  }

  phaseAnnotations.shot_end_stop = createStopLabelAnnotation({
    xValue: stopTimeSec,
    yValue,
    yScaleID,
    displayNumber: lastPhaseDisplayNum,
    calloutDisplay: isWeightStop ? false : visibility.stops,
    calloutSide: isWeightStop ? 11 : -11,
    xAdjust,
    yAdjust,
    fontSize: 10,
    calloutBorderWidth: 1.5,
    color: stopColor,
  });

  addStopIconOverlay({
    stopIconOverlays,
    exitType,
    visible: visibility.stops,
    xValue: stopTimeSec,
    yValue,
    yScaleID,
    xOffset: xAdjust,
    yOffset: yAdjust,
    color: '#ffffff',
  });
}

/**
 * @param {{
 *   shotData: ChartShotData | null | undefined,
 *   results: AnalyzerResults | null | undefined,
 * }} params
 * @returns {PhaseOverviewRow[]}
 */
export function buildPhaseOverviewRows({ shotData, results }) {
  const resultPhases = Array.isArray(results?.phases) ? results.phases : [];
  if (resultPhases.length > 0) {
    const resolvePhaseNumber = buildPhaseNumberResolver(results);

    return resultPhases.map((phase, index) => {
      const zeroBasedPhaseNumber = resolvePhaseNumber(
        phase?.number,
        index,
        phase?.profilePhase?.name || phase?.displayName || phase?.name,
      );
      const { skipNotice, stopReason } = getDisplayStopReasonParts(phase?.exit?.reason);

      return {
        phaseNumber: zeroBasedPhaseNumber + 1,
        phaseName:
          phase?.displayName || phase?.name || getPhaseName(shotData, zeroBasedPhaseNumber),
        skipNotice,
        stopReason: stopReason || '-',
        stopValue: getPhaseStopValue(phase),
        stopTargetValue: getPhaseStopTargetValue(phase),
        stopType: phase?.exit?.type || null,
        start: Number(phase?.start),
        end: Number(phase?.end),
        skipped: Boolean(phase?.skipped),
      };
    });
  }

  const transitions = Array.isArray(shotData?.phaseTransitions) ? shotData.phaseTransitions : [];
  if (transitions.length > 0) {
    /** @type {Map<number, string>} */
    const phaseNameByNumber = new Map();

    transitions.forEach((transition, index) => {
      const zeroBasedPhaseNumber = getZeroBasedPhaseNumber(transition?.phaseNumber, index);
      if (phaseNameByNumber.has(zeroBasedPhaseNumber)) return;
      phaseNameByNumber.set(
        zeroBasedPhaseNumber,
        transition?.phaseName || getPhaseName(shotData, zeroBasedPhaseNumber),
      );
    });

    return [...phaseNameByNumber.entries()]
      .sort(([a], [b]) => a - b)
      .map(
        /** @returns {PhaseOverviewRow} */ ([zeroBasedPhaseNumber, phaseName]) => ({
          phaseNumber: zeroBasedPhaseNumber + 1,
          phaseName,
          stopReason: '-',
          stopValue: '-',
          stopTargetValue: null,
        }),
      );
  }

  const embeddedProfile =
    /** @type {{ phases?: import('./types').ChartShotProfilePhase[] } | undefined} */ (
      shotData?.profile
    );
  const profilePhases = Array.isArray(embeddedProfile?.phases) ? embeddedProfile.phases : [];
  return profilePhases.map(
    /** @returns {PhaseOverviewRow} */ (phase, index) => ({
      phaseNumber: index + 1,
      phaseName: phase?.displayName || phase?.name || getPhaseName(shotData, index),
      stopReason: '-',
      stopValue: '-',
      stopTargetValue: null,
    }),
  );
}

/**
 * @param {{
 *   shotData: ChartShotData | null | undefined,
 *   results: AnalyzerResults | null | undefined,
 *   samples: ChartSample[],
 *   maxTime: number,
 *   colors: ShotChartColors,
 *   visibility: ChartVisibility,
 *   usePhaseNumbers: boolean,
 *   phaseLabelOverlays?: PhaseLabelOverlay[],
 *   phaseBackgroundRanges?: PhaseBackgroundRange[],
 *   extendedStartX?: number | null,
 *   stopIconOverlays?: StopIconOverlay[],
 * }} params
 * @returns {PhaseAnnotationMap}
 */
export function buildPhaseAnnotations({
  shotData,
  results,
  samples,
  maxTime,
  colors,
  visibility,
  usePhaseNumbers,
  phaseLabelOverlays = [],
  phaseBackgroundRanges = [],
  extendedStartX = null,
  stopIconOverlays = [],
}) {
  /** @type {PhaseAnnotationMap} */
  const phaseAnnotations = {};
  const resolvePhaseNumber = buildPhaseNumberResolver(results);
  const hasPhaseTransitions =
    Array.isArray(shotData?.phaseTransitions) && shotData.phaseTransitions.length > 0;
  if (!hasPhaseTransitions) return phaseAnnotations;

  const phaseNameCache = buildPhaseNameCache(shotData);
  /** @param {number} zeroBasedNum */
  const getPhaseLabel = zeroBasedNum =>
    usePhaseNumbers
      ? String(zeroBasedNum + 1)
      : phaseNameCache.get(zeroBasedNum) || getPhaseName(shotData, zeroBasedNum);
  const phaseStarts = buildPhaseStarts({ shotData, samples, maxTime, resolvePhaseNumber });

  addPhaseSeparatorAndStops({
    phaseAnnotations,
    stopIconOverlays,
    shotData,
    results,
    samples,
    colors,
    visibility,
    resolvePhaseNumber,
  });
  addPhaseLabelOverlays({
    phaseLabelOverlays,
    phaseStarts,
    maxTime,
    getPhaseLabel,
    usePhaseNumbers,
    visibility,
  });
  addPhaseBackgroundRanges({
    phaseBackgroundRanges,
    phaseStarts,
    maxTime,
    visibility,
    extendedStartX,
  });
  addFinalStopAnnotations({
    phaseAnnotations,
    stopIconOverlays,
    results,
    samples,
    maxTime,
    visibility,
    resolvePhaseNumber,
    colors,
  });

  return phaseAnnotations;
}

/**
 * @param {PhaseAnnotationMap} phaseAnnotations
 * @returns {PhaseAnnotationMap}
 */
export function buildTempPhaseAnnotations(phaseAnnotations) {
  // The temperature chart mirrors only the timing separators. Labels stay on the
  // main chart to avoid duplicated annotation text in the stacked layout.
  return Object.entries(phaseAnnotations).reduce((acc, [key, annotation]) => {
    const isPhaseSeparator =
      key === 'shot_start' || key === 'shot_end' || key.startsWith('phase_line_');
    if (!isPhaseSeparator) return acc;

    acc[key] = {
      ...annotation,
      label: { display: false },
    };
    return acc;
  }, /** @type {PhaseAnnotationMap} */ ({}));
}
