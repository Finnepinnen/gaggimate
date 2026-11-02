import { t } from '@lingui/core/macro';
import { INITIAL_VISIBILITY, MAIN_CHART_HEIGHT_DEFAULT } from '../constants';
import { buildShotChartModel } from '../buildShotChartModel';
import { getShotChartBrewModeMeta } from '../labelVisuals';
import { isStaticMobileTooltipViewport } from '../scrubberUtils';
import { COMPARE_TARGET_DISPLAY_MODES } from '../../../utils/analyzerUtils';
import {
  COMPARE_ALIGNMENT_PHASE_PREFIX,
  COMPARE_ALIGNMENT_SHOT_START,
  COMPARE_STYLE_FADE,
  COMPARE_STYLE_LINE_PATTERN,
} from './compareConstants';

/** @typedef {import('../model/types').ChartVisibility} ChartVisibility */
/** @typedef {import('../model/types').ChartSeriesMap} ChartSeriesMap */
/** @typedef {import('../model/types').PhaseAnnotation} PhaseAnnotation */
/** @typedef {import('../model/types').PhaseAnnotationMap} PhaseAnnotationMap */
/** @typedef {import('../model/types').PhaseOverviewRow} PhaseOverviewRow */
/** @typedef {import('../model/types').ShotChartColors} ShotChartColors */
/** @typedef {import('../model/types').ShotChartModel} ShotChartModel */
/** @typedef {import('./types').CompareAlignmentOption} CompareAlignmentOption */
/** @typedef {import('./types').CompareEntry} CompareEntry */
/** @typedef {import('./types').CompareModel} CompareModel */
/** @typedef {import('./types').ShotStylePreset} ShotStylePreset */

/**
 * @param {string} value
 * @param {CompareAlignmentOption[]} [options]
 */
function normalizeCompareAlignmentMode(value, options = []) {
  const optionValues = new Set(options.map(option => option.value));
  if (optionValues.has(value)) return value;
  return COMPARE_ALIGNMENT_SHOT_START;
}

/**
 * @param {unknown} storedVisibility Persisted visibility; validated key by key.
 * @param {{
 *   showPhaseAnnotations: boolean,
 *   showStopAnnotations: boolean,
 *   showBrewModeAnnotation: boolean,
 * }} options
 * @returns {ChartVisibility}
 */
export function normalizeCompareVisibility(
  storedVisibility,
  { showPhaseAnnotations, showStopAnnotations, showBrewModeAnnotation },
) {
  const defaultVisibility = {
    ...INITIAL_VISIBILITY,
    phaseNames: false,
    stops: false,
    brewModeLabel: Boolean(showBrewModeAnnotation),
    temp: false,
    puckFlow: false,
    puckResistance: false,
    liquidResistance: false,
    weight: false,
    weightFlow: false,
  };

  /** @type {ChartVisibility} */
  const nextVisibility = { ...defaultVisibility };
  if (storedVisibility && typeof storedVisibility === 'object') {
    const stored = /** @type {Partial<Record<keyof ChartVisibility, unknown>>} */ (
      storedVisibility
    );
    /** @type {(keyof ChartVisibility)[]} */ (Object.keys(INITIAL_VISIBILITY)).forEach(key => {
      if (typeof stored[key] === 'boolean') {
        nextVisibility[key] = stored[key];
      }
    });
  }

  if (!showPhaseAnnotations) nextVisibility.phaseNames = false;
  if (!showStopAnnotations) nextVisibility.stops = false;
  if (!showBrewModeAnnotation) nextVisibility.brewModeLabel = false;

  return nextVisibility;
}

/**
 * @param {ChartVisibility} visibility
 * @returns {ChartVisibility}
 */
export function getMobileCompareVisibility(visibility) {
  return {
    ...visibility,
    brewModeLabel: false,
    pressure: true,
    targetPressure: true,
    flow: true,
    targetFlow: true,
    puckFlow: false,
    puckResistance: Boolean(visibility.puckResistance),
    liquidResistance: Boolean(visibility.liquidResistance),
    temp: false,
    targetTemp: false,
    weight: false,
    weightFlow: false,
  };
}

/** @param {number} containerWidth */
function getStandardCompareChartHeight(containerWidth) {
  if (globalThis.window === undefined) return MAIN_CHART_HEIGHT_DEFAULT;
  const isSmartphone = globalThis.window.innerWidth <= 640;
  if (isSmartphone) {
    const viewportHeight =
      globalThis.window.visualViewport?.height || globalThis.window.innerHeight || 0;
    const numericWidth = Number(containerWidth);
    const widthBasedHeight =
      Number.isFinite(numericWidth) && numericWidth > 0
        ? Math.round(numericWidth * 0.78)
        : MAIN_CHART_HEIGHT_DEFAULT;
    if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
      return Math.max(230, Math.min(widthBasedHeight, Math.round(viewportHeight * 0.42)));
    }
    return Math.max(230, widthBasedHeight);
  }
  const isDesktop = globalThis.window.innerWidth >= 1024;
  if (isDesktop) {
    const vh = globalThis.window.innerHeight;
    if (!Number.isFinite(vh) || vh <= 0) return MAIN_CHART_HEIGHT_DEFAULT;
    return Math.round(vh * (3 / 5));
  }
  const numericWidth = Number(containerWidth);
  if (!Number.isFinite(numericWidth) || numericWidth <= 0) return MAIN_CHART_HEIGHT_DEFAULT;
  return Math.round(numericWidth * (2 / 3));
}

export function getCompareFullDisplayViewportHeight() {
  if (globalThis.window === undefined) return 0;
  return Math.round(globalThis.window.visualViewport?.height || globalThis.window.innerHeight || 0);
}

export function getFullDisplayCompareMainChartHeight() {
  const viewportHeight = getCompareFullDisplayViewportHeight();
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return 420;

  const availableHeight = Math.max(280, viewportHeight - 170);
  const preferredHeight = Math.round(availableHeight * 0.62);
  const minimumHeight = viewportHeight < 560 ? 240 : 320;
  return Math.max(minimumHeight, Math.min(720, preferredHeight));
}

export function getCompareMobileLayoutState() {
  return isStaticMobileTooltipViewport();
}

/**
 * @param {{
 *   shouldUseAnalyzerMobileCompareLayout: boolean,
 *   shouldUseStatisticsMobileCompactLayout: boolean,
 * }} params
 * @returns {{ detail: import('./types').StaticTooltipVariant, main: import('./types').StaticTooltipVariant }}
 */
export function getStaticTooltipVariants({
  shouldUseAnalyzerMobileCompareLayout,
  shouldUseStatisticsMobileCompactLayout,
}) {
  if (shouldUseStatisticsMobileCompactLayout) {
    return {
      detail: 'statisticsCompact',
      main: 'statisticsCompact',
    };
  }
  if (shouldUseAnalyzerMobileCompareLayout) {
    return {
      detail: 'singleLine',
      main: 'comparePreview',
    };
  }
  return {
    detail: 'default',
    main: 'default',
  };
}

/**
 * @param {{
 *   compareTooltipMode: import('./types').CompareTooltipMode,
 *   isFullDisplay: boolean,
 *   isMobileCompareLayout: boolean,
 *   shotStylePreset: ShotStylePreset,
 * }} params
 */
export function getCompareLayoutFlags({
  compareTooltipMode,
  isFullDisplay,
  isMobileCompareLayout,
  shotStylePreset,
}) {
  const isAnalyzerMobileCompareLayout = shotStylePreset === 'analyzer' && isMobileCompareLayout;
  const shouldUseAnalyzerMobileCompareLayout = isAnalyzerMobileCompareLayout && !isFullDisplay;
  const shouldUseStatisticsMobileCompactLayout =
    shotStylePreset === 'statistics' &&
    compareTooltipMode === 'compareTitleOnly' &&
    isMobileCompareLayout &&
    !isFullDisplay;

  return {
    isAnalyzerMobileCompareLayout,
    shouldUseAnalyzerMobileCompareLayout,
    shouldUseMobileStaticCompareLayout:
      shouldUseAnalyzerMobileCompareLayout || shouldUseStatisticsMobileCompactLayout,
    shouldUseStatisticsMobileCompactLayout,
  };
}

/**
 * @param {ShotStylePreset} shotStylePreset
 * @returns {import('./types').CompareStyle}
 */
export function getResolvedCompareStyle(shotStylePreset) {
  if (shotStylePreset === 'analyzer') return COMPARE_STYLE_LINE_PATTERN;
  return COMPARE_STYLE_FADE;
}

/**
 * @template T
 * @template [F=null]
 * @param {ShotStylePreset} shotStylePreset
 * @param {T} value
 * @param {F} [fallback]
 * @returns {T | F}
 */
export function getAnalyzerCompareValue(shotStylePreset, value, fallback = null) {
  if (shotStylePreset === 'analyzer') return value;
  return fallback;
}

/**
 * @param {CompareEntry | null | undefined} entry
 * @param {number} index
 * @returns {string | number}
 */
export function getCompareEntryKey(entry, index) {
  return entry?.key || entry?.shot?.storageKey || entry?.shot?.id || entry?.label || index;
}

/** @param {CompareEntry[]} compareEntries */
export function getCompareEntriesKey(compareEntries) {
  return compareEntries.map((entry, index) => getCompareEntryKey(entry, index)).join('|');
}

/**
 * @param {{ showPhaseAnnotations: boolean, showStopAnnotations: boolean }} params
 * @returns {string[]}
 */
export function getHiddenLegendLabels({ showPhaseAnnotations, showStopAnnotations }) {
  return [...(showPhaseAnnotations ? [] : ['Phases']), ...(showStopAnnotations ? [] : ['Stops'])];
}

/**
 * @param {CompareEntry[]} compareEntries
 * @param {keyof import('../model/types').ChartSample} sampleKey
 */
export function hasCompareSampleValue(compareEntries, sampleKey) {
  return compareEntries.some(
    entry =>
      Array.isArray(entry.shot?.samples) &&
      entry.shot.samples.some(sample => Number(sample?.[sampleKey]) > 0),
  );
}

/**
 * @param {{
 *   colors: ShotChartColors,
 *   compareAlignmentMode: string,
 *   compareEntries: CompareEntry[],
 *   shotStylePreset: ShotStylePreset,
 *   visibility: ChartVisibility,
 * }} params
 */
export function getCompareModels({
  colors,
  compareAlignmentMode,
  compareEntries,
  shotStylePreset,
  visibility,
}) {
  const rawCompareModels = compareEntries.map(entry => ({
    entry,
    model: buildShotChartModel({
      shotData: entry.shot,
      results: entry.results,
      visibility,
      colors,
      brewModeMeta: getShotChartBrewModeMeta(entry.results, colors),
      usePhaseNumbers: true,
    }),
  }));
  const compareAlignmentOptions =
    shotStylePreset === 'analyzer'
      ? getComparePhaseAlignmentOptions(rawCompareModels)
      : [{ value: COMPARE_ALIGNMENT_SHOT_START, label: t`Shot start` }];
  const resolvedCompareAlignmentMode =
    shotStylePreset === 'analyzer'
      ? normalizeCompareAlignmentMode(compareAlignmentMode, compareAlignmentOptions)
      : COMPARE_ALIGNMENT_SHOT_START;
  const compareModels = rawCompareModels.map(({ entry, model }) => ({
    entry,
    model: alignCompareModel(model, resolvedCompareAlignmentMode),
  }));

  return {
    compareAlignmentOptions,
    compareModels,
    resolvedCompareAlignmentMode,
  };
}

/** @param {import('./types').AxisRange} xRange */
export function getScrubberRange(xRange) {
  const min = Number.isFinite(xRange.min) ? xRange.min : 0;
  const max = Number.isFinite(xRange.max) ? xRange.max : 0;
  return {
    hasRange: max > min,
    max,
    min,
  };
}

/**
 * @param {import('./types').CompareModelEntry<ShotChartModel>[]} compareModels
 * @returns {CompareAlignmentOption[]}
 */
function getComparePhaseAlignmentOptions(compareModels) {
  const modelRows = compareModels.map(({ model }) =>
    Array.isArray(model?.phaseOverviewRows) ? model.phaseOverviewRows : [],
  );
  if (modelRows.length === 0 || modelRows.some(rows => rows.length === 0)) {
    return [{ value: COMPARE_ALIGNMENT_SHOT_START, label: t`Shot start` }];
  }

  const commonPhaseCount = Math.min(...modelRows.map(rows => rows.length));
  const referenceRows = modelRows[0] || [];
  const phaseOptions = Array.from({ length: commonPhaseCount }, (_, index) => {
    const row = referenceRows[index] || /** @type {Partial<PhaseOverviewRow>} */ ({});
    const phaseNumber = Number.isFinite(Number(row.phaseNumber))
      ? Number(row.phaseNumber)
      : index + 1;
    const phaseName = typeof row.phaseName === 'string' ? row.phaseName.trim() : '';

    return {
      value: `${COMPARE_ALIGNMENT_PHASE_PREFIX}${phaseNumber}`,
      label: formatComparePhaseAlignmentLabel(phaseNumber, phaseName),
    };
  });

  return [{ value: COMPARE_ALIGNMENT_SHOT_START, label: t`Shot start` }, ...phaseOptions];
}

/**
 * @param {number} phaseNumber
 * @param {string} phaseName
 */
function formatComparePhaseAlignmentLabel(phaseNumber, phaseName) {
  return phaseName ? t`Phase ${phaseNumber}: ${phaseName}` : t`Phase ${phaseNumber}`;
}

/** @param {unknown} alignmentMode */
function parsePhaseAlignmentNumber(alignmentMode) {
  if (typeof alignmentMode !== 'string') return null;
  if (!alignmentMode.startsWith(COMPARE_ALIGNMENT_PHASE_PREFIX)) return null;
  const phaseNumber = Number(alignmentMode.slice(COMPARE_ALIGNMENT_PHASE_PREFIX.length));
  return Number.isFinite(phaseNumber) && phaseNumber > 0 ? phaseNumber : null;
}

/**
 * @param {PhaseOverviewRow[]} rows
 * @param {number} phaseNumber
 */
function findPhaseRowIndex(rows, phaseNumber) {
  if (!Array.isArray(rows)) return -1;
  const byNumberIndex = rows.findIndex(row => Number(row?.phaseNumber) === phaseNumber);
  if (byNumberIndex >= 0) return byNumberIndex;
  const byPositionIndex = phaseNumber - 1;
  return byPositionIndex >= 0 && byPositionIndex < rows.length ? byPositionIndex : -1;
}

/**
 * @param {ShotChartModel} model
 * @param {string} alignmentMode
 */
function resolvePhaseAlignmentOffset(model, alignmentMode) {
  const phaseNumber = parsePhaseAlignmentNumber(alignmentMode);
  if (!phaseNumber) return 0;

  const rows = Array.isArray(model?.phaseOverviewRows) ? model.phaseOverviewRows : [];
  const phaseIndex = findPhaseRowIndex(rows, phaseNumber);
  if (phaseIndex < 0) return 0;

  for (let index = phaseIndex; index < rows.length; index += 1) {
    const row = rows[index];
    const start = Number(row?.start);
    if (row?.skipped === true || !Number.isFinite(start)) continue;
    return start;
  }

  return 0;
}

/**
 * @param {import('../model/types').ChartPoint} point
 * @param {number} xOffset
 */
function shiftPointX(point, xOffset) {
  if (!point || typeof point !== 'object') return point;
  const x = Number(point.x);
  if (!Number.isFinite(x)) return point;
  return { ...point, x: x - xOffset };
}

/**
 * @param {ChartSeriesMap} series
 * @param {number} xOffset
 * @returns {ChartSeriesMap}
 */
function shiftSeriesMap(series, xOffset) {
  if (!series || typeof series !== 'object' || xOffset === 0) return series;

  return /** @type {ChartSeriesMap} */ (
    Object.fromEntries(
      Object.entries(series).map(([key, points]) => [
        key,
        Array.isArray(points) ? points.map(point => shiftPointX(point, xOffset)) : points,
      ]),
    )
  );
}

/**
 * @param {number | undefined} value
 * @param {number} xOffset
 */
function shiftOptionalXValue(value, xOffset) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue - xOffset : value;
}

/**
 * @param {PhaseAnnotation} annotation
 * @param {number} xOffset
 * @returns {PhaseAnnotation}
 */
function shiftAnnotationX(annotation, xOffset) {
  if (!annotation || typeof annotation !== 'object' || xOffset === 0) return annotation;

  const nextAnnotation = { ...annotation };
  ['value', 'xValue', 'xMin', 'xMax'].forEach(key => {
    if (Number.isFinite(Number(nextAnnotation[key]))) {
      nextAnnotation[key] = Number(nextAnnotation[key]) - xOffset;
    }
  });
  return nextAnnotation;
}

/**
 * @param {PhaseAnnotationMap} annotations
 * @param {number} xOffset
 * @returns {PhaseAnnotationMap}
 */
function shiftAnnotationMap(annotations, xOffset) {
  if (!annotations || typeof annotations !== 'object' || xOffset === 0) return annotations;
  return Object.fromEntries(
    Object.entries(annotations).map(([key, annotation]) => [
      key,
      shiftAnnotationX(annotation, xOffset),
    ]),
  );
}

/**
 * @param {PhaseOverviewRow[]} rows
 * @param {number} xOffset
 * @returns {PhaseOverviewRow[]}
 */
function shiftPhaseRows(rows, xOffset) {
  if (!Array.isArray(rows) || xOffset === 0) return rows;
  return rows.map(row => ({
    ...row,
    start: shiftOptionalXValue(row?.start, xOffset),
    end: shiftOptionalXValue(row?.end, xOffset),
  }));
}

/**
 * @template {{ xValue: number }} T
 * @param {T[]} overlays
 * @param {number} xOffset
 * @returns {T[]}
 */
function shiftOverlayX(overlays, xOffset) {
  if (!Array.isArray(overlays) || xOffset === 0) return overlays;
  return overlays.map(overlay => ({
    ...overlay,
    xValue: shiftOptionalXValue(overlay?.xValue, xOffset),
  }));
}

/** @param {ShotChartModel} model */
function getModelMinTime(model) {
  const sampleTimes = Array.isArray(model?.sampleTimesSec) ? model.sampleTimesSec : [];
  const firstSampleTime = sampleTimes.find(time => Number.isFinite(Number(time)));
  if (Number.isFinite(Number(firstSampleTime))) return Number(firstSampleTime);

  const seriesPoints = Object.values(model?.series || {}).flatMap(points =>
    Array.isArray(points) ? points : [],
  );
  const firstPoint = seriesPoints.find(point => Number.isFinite(Number(point?.x)));
  return Number.isFinite(Number(firstPoint?.x)) ? Number(firstPoint.x) : 0;
}

/**
 * @param {ShotChartModel} model
 * @param {string} alignmentMode
 * @returns {CompareModel}
 */
function alignCompareModel(model, alignmentMode) {
  const xOffset = resolvePhaseAlignmentOffset(model, alignmentMode);
  if (!xOffset) {
    return {
      ...model,
      compareAlignmentOffset: 0,
      minTime: getModelMinTime(model),
    };
  }

  const originalWaterGetter = model.getHoverWaterValuesAtX;
  return {
    ...model,
    compareAlignmentOffset: xOffset,
    minTime: getModelMinTime(model) - xOffset,
    maxTime: Number(model.maxTime || 0) - xOffset,
    shotStartSec: Number(model.shotStartSec || 0) - xOffset,
    sampleTimesSec: Array.isArray(model.sampleTimesSec)
      ? model.sampleTimesSec.map(time => Number(time) - xOffset)
      : model.sampleTimesSec,
    series: shiftSeriesMap(model.series, xOffset),
    phaseAnnotations: shiftAnnotationMap(model.phaseAnnotations, xOffset),
    tempPhaseAnnotations: shiftAnnotationMap(model.tempPhaseAnnotations, xOffset),
    phaseLabelOverlays: shiftOverlayX(model.phaseLabelOverlays, xOffset),
    stopIconOverlays: shiftOverlayX(model.stopIconOverlays, xOffset),
    phaseOverviewRows: shiftPhaseRows(model.phaseOverviewRows, xOffset),
    getHoverWaterValuesAtX:
      typeof originalWaterGetter === 'function'
        ? /** @param {number} xValue */ xValue => originalWaterGetter(Number(xValue) + xOffset)
        : originalWaterGetter,
  };
}

/**
 * @param {import('./types').CompareModelEntry[]} compareModels
 * @returns {import('./types').AxisRange}
 */
export function getCompareXRange(compareModels) {
  const min = Math.min(0, ...compareModels.map(({ model }) => Number(model?.minTime || 0)));
  const max = Math.max(1, ...compareModels.map(({ model }) => Number(model?.maxTime || 0)));
  return max <= min ? { min: 0, max: 1 } : { min, max };
}

/**
 * @param {{ entry: CompareEntry, targetDisplayMode: string }} params
 * @returns {boolean}
 */
export function shouldShowTargetsForEntry({ entry, targetDisplayMode }) {
  if (targetDisplayMode === COMPARE_TARGET_DISPLAY_MODES.NONE) {
    return false;
  }

  if (targetDisplayMode === COMPARE_TARGET_DISPLAY_MODES.MAIN_SHOT_ONLY) {
    return entry.isReference;
  }

  return true;
}

/**
 * @param {PhaseAnnotation} annotation
 * @param {{ ghosted?: boolean }} [options]
 * @returns {PhaseAnnotation}
 */
function cloneCompareAnnotation(annotation, { ghosted = false } = {}) {
  if (!annotation) return annotation;

  const labelXAdjust = Number(annotation.label?.xAdjust) || 0;

  return {
    ...annotation,
    borderColor: annotation.borderColor,
    label: annotation.label
      ? {
          ...annotation.label,
          position: ghosted ? 'end' : annotation.label.position,
          xAdjust: labelXAdjust,
          yAdjust: Number(annotation.label.yAdjust) || 0,
          color: annotation.label.color,
          backgroundColor: annotation.label.backgroundColor,
          borderColor: annotation.label.borderColor,
          borderWidth: annotation.label.borderWidth,
          font: annotation.label.font,
        }
      : annotation.label,
  };
}

/**
 * @param {PhaseAnnotationMap | null | undefined} annotations
 * @param {string} prefix
 * @param {{ ghosted?: boolean, startLabelSuffix?: string | null }} [options]
 * @returns {PhaseAnnotationMap}
 */
export function prefixCompareAnnotations(
  annotations,
  prefix,
  { ghosted = false, startLabelSuffix = null } = {},
) {
  if (!annotations) return {};

  return Object.fromEntries(
    Object.entries(annotations).map(([key, annotation]) => {
      const nextAnnotation = cloneCompareAnnotation(annotation, { ghosted });
      const isPhaseSeparator =
        key === 'shot_start' || key === 'shot_end' || key.startsWith('phase_line_');

      if (isPhaseSeparator && nextAnnotation) {
        nextAnnotation.display = true;
        nextAnnotation.borderWidth = nextAnnotation.borderWidth || 1;
        nextAnnotation.borderColor =
          nextAnnotation.borderColor === 'transparent' || !nextAnnotation.borderColor
            ? 'rgba(107, 114, 128, 0.5)'
            : nextAnnotation.borderColor;
      }

      if (key === 'shot_start' && startLabelSuffix && nextAnnotation?.label?.content) {
        nextAnnotation.label = {
          ...nextAnnotation.label,
          content: `${nextAnnotation.label.content} ${startLabelSuffix}`,
        };
      }

      return [`${prefix}_${key}`, nextAnnotation];
    }),
  );
}

/**
 * @param {{ shotStylePreset: ShotStylePreset, standardChartWidth: number }} params
 * @returns {number}
 */
export function getResolvedCompareMainChartHeight({ shotStylePreset, standardChartWidth }) {
  if (shotStylePreset === 'analyzer') {
    return getStandardCompareChartHeight(standardChartWidth);
  }
  return MAIN_CHART_HEIGHT_DEFAULT;
}
