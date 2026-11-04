import { createHiddenExternalTooltipState } from '../ShotChartExternalTooltip';
import { INITIAL_VISIBILITY, SINGLE_METRIC_PAGE_KEYS } from '../constants';
import { isStaticMobileTooltipViewport } from '../scrubberUtils';
import { getShotIdentityKey } from '../../../utils/analyzerUtils';

/** @typedef {import('../model/types').ChartSample} ChartSample */
/** @typedef {import('../types').ShotChartShotData} ShotChartShotData */
/** @typedef {import('../types').ShotChartAnalysisResults} ShotChartAnalysisResults */
/** @typedef {import('../types').ShotChartVisibility} ShotChartVisibility */

export const HIDDEN_STATIC_TOOLTIP_STATE = createHiddenExternalTooltipState();

/** @type {Record<string, string[]>} */
const SINGLE_METRIC_PAGE_SERIES = {
  [SINGLE_METRIC_PAGE_KEYS.BASICS]: ['pressure', 'flow', 'weight'],
  [SINGLE_METRIC_PAGE_KEYS.PRESSURE_FLOW]: ['pressure', 'targetPressure', 'flow', 'targetFlow'],
  [SINGLE_METRIC_PAGE_KEYS.FLOW_VOLUME]: ['weight', 'weightFlow', 'puckFlow'],
  [SINGLE_METRIC_PAGE_KEYS.TEMPERATURE]: [],
  [SINGLE_METRIC_PAGE_KEYS.PUCK_RESISTANCE]: ['puckResistance', 'liquidResistance'],
  [SINGLE_METRIC_PAGE_KEYS.ALL]: [
    'pressure',
    'targetPressure',
    'flow',
    'targetFlow',
    'puckFlow',
    'puckResistance',
    'liquidResistance',
    'weight',
    'weightFlow',
  ],
};

const SINGLE_CHART_SERIES_VISIBILITY_KEYS = [
  'pressure',
  'targetPressure',
  'flow',
  'targetFlow',
  'puckFlow',
  'puckResistance',
  'liquidResistance',
  'weight',
  'weightFlow',
];

const TEMPERATURE_SERIES_VISIBILITY = {
  temp: true,
  targetTemp: true,
};

/** @returns {ShotChartVisibility} */
function getDefaultSingleChartVisibility() {
  const showContextOverlaysByDefault = !isStaticMobileTooltipViewport();

  return {
    ...INITIAL_VISIBILITY,
    // Keep the first mobile view quiet; persisted user choices still take precedence.
    phaseNames: showContextOverlaysByDefault,
    stops: showContextOverlaysByDefault,
  };
}

/**
 * @param {any} storedVisibility
 * @returns {ShotChartVisibility}
 */
export function normalizeSingleChartVisibility(storedVisibility) {
  const defaultVisibility = getDefaultSingleChartVisibility();
  if (!storedVisibility || typeof storedVisibility !== 'object') return defaultVisibility;

  const keys = /** @type {(keyof ShotChartVisibility)[]} */ (Object.keys(defaultVisibility));
  return keys.reduce(
    (visibility, key) => ({
      ...visibility,
      [key]:
        typeof storedVisibility[key] === 'boolean' ? storedVisibility[key] : defaultVisibility[key],
    }),
    /** @type {ShotChartVisibility} */ ({}),
  );
}

/**
 * @param {{
 *   hasWeightData: boolean,
 *   hasWeightFlowData: boolean,
 *   pageKey: string,
 *   visibility: ShotChartVisibility,
 * }} options
 * @returns {ShotChartVisibility}
 */
export function getSingleMetricPageVisibility({
  hasWeightData,
  hasWeightFlowData,
  pageKey,
  visibility,
}) {
  const visibleSeries = new Set(
    SINGLE_METRIC_PAGE_SERIES[pageKey] || SINGLE_METRIC_PAGE_SERIES[SINGLE_METRIC_PAGE_KEYS.BASICS],
  );

  return SINGLE_CHART_SERIES_VISIBILITY_KEYS.reduce(
    (nextVisibility, key) => ({
      ...nextVisibility,
      [key]:
        visibleSeries.has(key) &&
        (key !== 'weight' || hasWeightData) &&
        (key !== 'weightFlow' || hasWeightFlowData),
    }),
    /** @type {ShotChartVisibility} */ ({ ...visibility, ...TEMPERATURE_SERIES_VISIBILITY }),
  );
}

/** @type {readonly ChartSample[]} */
export const EMPTY_SHOT_SAMPLES = Object.freeze([]);

/**
 * @param {ShotChartShotData | null | undefined} shotData
 * @param {ShotChartAnalysisResults | null | undefined} results
 * @returns {string}
 */
export function getShotChartIdentityKey(shotData, results) {
  return getShotIdentityKey(shotData) || `analysis:${results?.id || results?.name || ''}`;
}

/**
 * @param {ChartSample} sample
 */
function sampleHasWeightData(sample) {
  const rawWeight = sample?.v ?? sample?.w ?? sample?.weight ?? sample?.m;
  const numericWeight = Number(rawWeight);
  return Number.isFinite(numericWeight) && numericWeight > 0;
}

/** @param {ChartSample} sample */
function sampleHasWeightFlowData(sample) {
  const value = Number(sample?.vf ?? sample?.weight_flow);
  return Number.isFinite(value) && value > 0;
}

/** @param {readonly ChartSample[]} shotSamples */
export function getShotSampleCapabilities(shotSamples) {
  return {
    hasWeightData: shotSamples.some(sampleHasWeightData),
    hasWeightFlowData: shotSamples.some(sampleHasWeightFlowData),
  };
}

/**
 * @param {number | string | null | undefined} scrubXValue
 * @returns {boolean}
 */
export function hasFiniteScrubValue(scrubXValue) {
  return scrubXValue !== null && scrubXValue !== undefined && Number.isFinite(Number(scrubXValue));
}

/**
 * @param {number | string | null | undefined} scrubXValue
 * @param {number} scrubberMax
 * @returns {number}
 */
export function getClampedScrubXValue(scrubXValue, scrubberMax) {
  return hasFiniteScrubValue(scrubXValue)
    ? Math.min(scrubberMax, Math.max(0, Number(scrubXValue)))
    : 0;
}
