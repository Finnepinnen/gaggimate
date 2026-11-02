import {
  COMPARE_STYLE_FADE,
  COMPARE_STYLE_LINE_PATTERN,
  SHOT_STYLE_PRESETS,
} from './compareConstants';
import { shouldShowTargetsForEntry } from './compareModel';

/** @typedef {import('../model/types').ChartPoint} ChartPoint */
/** @typedef {import('../model/types').ChartVisibility} ChartVisibility */
/** @typedef {import('../model/types').ShotChartColors} ShotChartColors */
/** @typedef {import('./types').CompareDataset} CompareDataset */
/** @typedef {import('./types').CompareDatasetMeta} CompareDatasetMeta */
/** @typedef {import('./types').CompareEntry} CompareEntry */
/** @typedef {import('./types').CompareLegendItem} CompareLegendItem */
/** @typedef {import('./types').CompareModel} CompareModel */
/** @typedef {import('./types').CompareModelEntry} CompareModelEntry */
/** @typedef {import('./types').CompareShotStyle} CompareShotStyle */
/** @typedef {import('./types').CompareStyle} CompareStyle */
/** @typedef {import('./types').ShotStylePreset} ShotStylePreset */

/**
 * @typedef {object} MainDatasetSpecParams
 * @property {CompareEntry} entry
 * @property {CompareModel} model
 * @property {ChartVisibility} visibility
 * @property {ShotChartColors} colors
 * @property {CompareShotStyle} shotStyle
 * @property {boolean} [showTargets]
 * @property {CompareDatasetMeta} compareDatasetMeta
 * @property {boolean} [showWeightInMainChart]
 * @property {boolean} [showWeightFlowInMainChart]
 */

/**
 * @param {{
 *   colors: ShotChartColors,
 *   compareEntries: CompareEntry[],
 *   resolvedCompareStyle: CompareStyle,
 *   shotStylePreset: ShotStylePreset,
 *   showCompareShotLegend: boolean,
 * }} params
 * @returns {CompareLegendItem[]}
 */
export function getCompareShotLegendItems({
  colors,
  compareEntries,
  resolvedCompareStyle,
  shotStylePreset,
  showCompareShotLegend,
}) {
  if (!showCompareShotLegend) return [];
  return buildCompareLegendItems(compareEntries, colors, shotStylePreset, resolvedCompareStyle);
}

/** @type {CanvasRenderingContext2D | null} */
let scratchContext = null;

function getScratchContext() {
  if (scratchContext || globalThis.document === undefined) return scratchContext;
  scratchContext = globalThis.document.createElement('canvas').getContext('2d');
  return scratchContext;
}

/**
 * @param {string} color
 * @returns {string}
 */
function resolveCanvasColor(color) {
  const ctx = getScratchContext();
  if (!ctx || !color) return color;

  try {
    ctx.fillStyle = '#000000';
    ctx.fillStyle = color;
    return /** @type {string} */ (ctx.fillStyle) || color;
  } catch {
    return color;
  }
}

/**
 * @param {string} color
 * @param {number} alpha
 * @returns {string}
 */
function applyColorAlpha(color, alpha) {
  const resolvedColor = resolveCanvasColor(color);
  if (!resolvedColor) return color;

  const rgbMatch = resolvedColor.match(
    /^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)(?:[,\s/]+([0-9.]+))?\s*\)$/i,
  );

  if (rgbMatch) {
    const [, red, green, blue, existingAlpha] = rgbMatch;
    const nextAlpha = Math.max(
      0,
      Math.min(1, Number(existingAlpha ?? 1) * Math.max(0, Math.min(1, alpha))),
    );
    return `rgba(${red}, ${green}, ${blue}, ${nextAlpha})`;
  }

  const hex = resolvedColor.replace('#', '');
  if (hex.length === 3 || hex.length === 4) {
    const normalized = hex
      .split('')
      .map(char => `${char}${char}`)
      .join('');
    return applyColorAlpha(`#${normalized}`, alpha);
  }

  if (hex.length === 6 || hex.length === 8) {
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    const existingAlpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
    const nextAlpha = Math.max(0, Math.min(1, existingAlpha * Math.max(0, Math.min(1, alpha))));
    return `rgba(${red}, ${green}, ${blue}, ${nextAlpha})`;
  }

  return resolvedColor;
}

/**
 * @param {number} index
 * @param {ShotStylePreset} [preset]
 * @param {CompareStyle} [compareStyle]
 * @returns {CompareShotStyle}
 */
function getShotStyle(index, preset = 'analyzer', compareStyle = COMPARE_STYLE_FADE) {
  const stylePreset = SHOT_STYLE_PRESETS[preset] || SHOT_STYLE_PRESETS.analyzer;
  const { opacities, lineWidths } = stylePreset;

  if (preset === 'analyzer' && compareStyle === COMPARE_STYLE_LINE_PATTERN) {
    return {
      opacity: index === 0 ? 1 : 0.92,
      lineWidth: index === 0 ? 3.4 : 3.1,
      dash: index === 0 ? [] : [10, 5],
      targetDash: index === 0 ? [6, 4] : [2, 4, 10, 4],
    };
  }

  return {
    opacity: opacities[index] ?? opacities[opacities.length - 1],
    lineWidth: lineWidths[index] ?? lineWidths[lineWidths.length - 1],
    dash: [],
    targetDash: [6, 4],
  };
}

/** @param {boolean} [isTarget] */
function getComparePointStyle(isTarget = false) {
  return {
    pointRadius: 0,
    pointHoverRadius: 0,
    pointHitRadius: isTarget ? 10 : 12,
  };
}

/**
 * @param {string} seriesKey
 * @returns {CompareDataset['axisScaleMode']}
 */
function getDetailChartAxisScaleMode(seriesKey) {
  if (seriesKey === 'weight') return 'weight';
  if (seriesKey === 'weightFlow') return 'weightFlow';
  return undefined;
}

/**
 * @param {CompareEntry[]} compareEntries
 * @param {ShotChartColors} colors
 * @param {ShotStylePreset} shotStylePreset
 * @param {CompareStyle} compareStyle
 * @returns {CompareLegendItem[]}
 */
function buildCompareLegendItems(compareEntries, colors, shotStylePreset, compareStyle) {
  return compareEntries.map((entry, index) => {
    const shotStyle = getShotStyle(index, shotStylePreset, compareStyle);
    const accentColor = getCompareLegendAccentColor(entry);

    return {
      label: entry.label,
      color: accentColor || applyColorAlpha(colors.phaseLine, shotStyle.opacity),
      badgeColor:
        entry.accentColor || accentColor || applyColorAlpha(colors.phaseLine, shotStyle.opacity),
      lineWidth: shotStyle.lineWidth,
      dash: shotStyle.dash,
      shotNumber: index + 1,
    };
  });
}

/**
 * @param {CompareEntry} entry
 * @returns {string | null}
 */
function getCompareLegendAccentColor(entry) {
  if (!entry.accentColor) return null;
  const accentStrength = Number.isFinite(Number(entry.accentStrength))
    ? Number(entry.accentStrength)
    : 1;
  if (accentStrength >= 1) return entry.accentColor;
  return `color-mix(in srgb, ${entry.accentColor} ${Math.round(
    accentStrength * 100,
  )}%, transparent)`;
}

/**
 * @param {MainDatasetSpecParams} params
 * @returns {(CompareDataset | null)[]}
 */
function buildMainPressureDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  showTargets,
  compareDatasetMeta,
}) {
  return [
    visibility.pressure && model.series.pressure.length > 0
      ? {
          label: `${entry.label} Pressure`,
          compareTooltipBaseLabel: 'Pressure',
          data: model.series.pressure,
          borderColor: applyColorAlpha(colors.pressure, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.pressure, shotStyle.opacity),
          yAxisID: 'yMain',
          borderWidth: shotStyle.lineWidth,
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
    visibility.targetPressure && showTargets && model.series.targetPressure.length > 0
      ? {
          label: `${entry.label} Target Pressure`,
          compareTooltipBaseLabel: 'Target P',
          data: model.series.targetPressure,
          borderColor: applyColorAlpha(colors.pressure, Math.max(0.26, shotStyle.opacity * 0.72)),
          backgroundColor: 'transparent',
          yAxisID: 'yMain',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 1.2),
          borderDash: shotStyle.targetDash,
          tension: 0,
          order: entry.isReference ? -10 : -20,
          ...getComparePointStyle(true),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

/**
 * @param {MainDatasetSpecParams} params
 * @returns {(CompareDataset | null)[]}
 */
function buildMainFlowDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  showTargets,
  compareDatasetMeta,
}) {
  return [
    visibility.flow && model.series.flow.length > 0
      ? {
          label: `${entry.label} Pump Flow`,
          compareTooltipBaseLabel: 'Pump Flow',
          data: model.series.flow,
          borderColor: applyColorAlpha(colors.flow, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.flow, shotStyle.opacity),
          yAxisID: 'yMain',
          borderWidth: shotStyle.lineWidth,
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
    visibility.targetFlow && showTargets && model.series.targetFlow.length > 0
      ? {
          label: `${entry.label} Target Pump Flow`,
          compareTooltipBaseLabel: 'Target F',
          data: model.series.targetFlow,
          borderColor: applyColorAlpha(colors.flow, Math.max(0.26, shotStyle.opacity * 0.72)),
          backgroundColor: 'transparent',
          yAxisID: 'yMain',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 1.2),
          borderDash: shotStyle.targetDash,
          tension: 0,
          order: entry.isReference ? -10 : -20,
          ...getComparePointStyle(true),
          ...compareDatasetMeta,
        }
      : null,
    visibility.puckFlow && model.series.puckFlow.length > 0
      ? {
          label: `${entry.label} Puck Flow`,
          compareTooltipBaseLabel: 'Puck Flow',
          data: model.series.puckFlow,
          borderColor: applyColorAlpha(colors.puckFlow, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.puckFlow, shotStyle.opacity),
          yAxisID: 'yMain',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 0.8),
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

/**
 * @param {MainDatasetSpecParams} params
 * @returns {(CompareDataset | null)[]}
 */
function buildMainWeightDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  compareDatasetMeta,
  showWeightInMainChart,
  showWeightFlowInMainChart,
}) {
  return [
    showWeightInMainChart && visibility.weight && model.series.weight.length > 0
      ? {
          label: `${entry.label} Weight`,
          compareTooltipBaseLabel: 'Weight',
          data: model.series.weight,
          axisScaleMode: 'weight',
          borderColor: applyColorAlpha(colors.weight, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.weight, shotStyle.opacity),
          yAxisID: 'yWeight',
          borderWidth: shotStyle.lineWidth,
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
    showWeightFlowInMainChart && visibility.weightFlow && model.series.weightFlow.length > 0
      ? {
          label: `${entry.label} Weight Flow`,
          compareTooltipBaseLabel: 'Weight Flow',
          data: model.series.weightFlow,
          axisScaleMode: 'weightFlow',
          borderColor: applyColorAlpha(colors.weightFlow, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.weightFlow, shotStyle.opacity),
          yAxisID: 'yMain',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 0.8),
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

/**
 * @param {MainDatasetSpecParams} params
 * @returns {(CompareDataset | null)[]}
 */
function buildMainPuckResistanceDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  compareDatasetMeta,
}) {
  return [
    visibility.puckResistance && model.series.puckResistance.length > 0
      ? {
          label: `${entry.label} Puck Resistance`,
          compareTooltipBaseLabel: 'Puck Resistance',
          data: model.series.puckResistance,
          borderColor: applyColorAlpha(colors.puckResistance, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.puckResistance, shotStyle.opacity),
          yAxisID: 'yPuckResistance',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 0.8),
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
    visibility.liquidResistance && model.series.liquidResistance.length > 0
      ? {
          label: `${entry.label} Liquid Resistance`,
          compareTooltipBaseLabel: 'Liquid Resistance',
          data: model.series.liquidResistance,
          borderColor: applyColorAlpha(colors.liquidResistance, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.liquidResistance, shotStyle.opacity),
          yAxisID: 'yLiquidResistance',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 0.8),
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

/**
 * @param {MainDatasetSpecParams} params
 * @returns {CompareDataset[]}
 */
function buildMainChartDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  showTargets,
  compareDatasetMeta,
  showWeightInMainChart,
  showWeightFlowInMainChart,
}) {
  return [
    ...buildMainPressureDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      showTargets,
      compareDatasetMeta,
    }),
    ...buildMainFlowDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      showTargets,
      compareDatasetMeta,
    }),
    ...buildMainPuckResistanceDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      compareDatasetMeta,
    }),
    ...buildMainWeightDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      compareDatasetMeta,
      showWeightInMainChart,
      showWeightFlowInMainChart,
    }),
  ].filter(dataset => dataset !== null);
}

/**
 * @param {{
 *   chart: import('./types').DetailChartDef,
 *   entry: CompareEntry,
 *   actualSeries: ChartPoint[],
 *   targetSeries: ChartPoint[],
 *   baseColor: string,
 *   shotStyle: CompareShotStyle,
 *   compareDatasetMeta: CompareDatasetMeta,
 *   visibility: ChartVisibility,
 *   showTargets: boolean | null | undefined,
 * }} params
 * @returns {CompareDataset[]}
 */
function buildDetailChartDatasetSpecs({
  chart,
  entry,
  actualSeries,
  targetSeries,
  baseColor,
  shotStyle,
  compareDatasetMeta,
  visibility,
  showTargets,
}) {
  return [
    visibility[chart.visibleKey] && actualSeries.length > 0
      ? {
          label: `${entry.label} ${chart.title}`,
          compareTooltipBaseLabel: chart.tooltipBaseLabel,
          data: actualSeries,
          axisScaleMode: getDetailChartAxisScaleMode(chart.seriesKey),
          borderColor: applyColorAlpha(baseColor, shotStyle.opacity),
          backgroundColor: applyColorAlpha(baseColor, shotStyle.opacity),
          borderWidth: shotStyle.lineWidth,
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
    showTargets && targetSeries.length > 0
      ? {
          label: `${entry.label} ${chart.title} Target`,
          compareTooltipBaseLabel: chart.targetTooltipBaseLabel,
          data: targetSeries,
          borderColor: applyColorAlpha(baseColor, Math.max(0.26, shotStyle.opacity * 0.72)),
          backgroundColor: 'transparent',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 1.2),
          borderDash: shotStyle.targetDash,
          tension: 0,
          order: entry.isReference ? -10 : -20,
          ...getComparePointStyle(true),
          ...compareDatasetMeta,
        }
      : null,
  ].filter(dataset => dataset !== null);
}

/**
 * @param {{
 *   compareModels: CompareModelEntry[],
 *   colors: ShotChartColors,
 *   visibility: ChartVisibility,
 *   targetDisplayMode: string,
 *   shotStylePreset: ShotStylePreset,
 *   compareStyle: CompareStyle,
 *   showWeightInMainChart?: boolean,
 *   showWeightFlowInMainChart?: boolean,
 * }} params
 * @returns {CompareDataset[]}
 */
export function buildMainChartDatasets({
  compareModels,
  colors,
  visibility,
  targetDisplayMode,
  shotStylePreset,
  compareStyle,
  showWeightInMainChart = true,
  showWeightFlowInMainChart = true,
}) {
  return compareModels.flatMap(({ entry, model }, index) => {
    const shotStyle = getShotStyle(index, shotStylePreset, compareStyle);
    const showTargets = shouldShowTargetsForEntry({
      entry,
      targetDisplayMode,
    });
    /** @type {CompareDatasetMeta} */
    const compareDatasetMeta = {
      compareTooltipShotLabel: entry.label,
      compareTooltipShotOrder: index,
      compareTooltipGetHoverWaterValuesAtX: model.getHoverWaterValuesAtX,
    };
    return buildMainChartDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      showTargets,
      compareDatasetMeta,
      showWeightInMainChart,
      showWeightFlowInMainChart,
    });
  });
}

/**
 * @param {{
 *   chart: import('./types').DetailChartDef,
 *   compareModels: CompareModelEntry[],
 *   colors: ShotChartColors,
 *   includePumpFlowWaterTooltip?: boolean,
 *   targetDisplayMode: string,
 *   visibility: ChartVisibility,
 *   shotStylePreset: ShotStylePreset,
 *   compareStyle: CompareStyle,
 * }} params
 * @returns {CompareDataset[]}
 */
export function buildDetailChartDatasets({
  chart,
  compareModels,
  colors,
  includePumpFlowWaterTooltip = false,
  targetDisplayMode,
  visibility,
  shotStylePreset,
  compareStyle,
}) {
  return compareModels.flatMap(({ entry, model }, index) => {
    const shotStyle = getShotStyle(index, shotStylePreset, compareStyle);
    const actualSeries = model.series[chart.seriesKey] || [];
    const targetSeries = chart.targetSeriesKey ? model.series[chart.targetSeriesKey] || [] : [];
    const baseColor = colors[chart.axisColorKey];
    const showTargets =
      chart.targetSeriesKey &&
      chart.targetVisibleKey &&
      shouldShowTargetsForEntry({
        entry,
        targetDisplayMode,
      });
    /** @type {CompareDatasetMeta} */
    const compareDatasetMeta = {
      compareTooltipShotLabel: entry.label,
      compareTooltipShotOrder: index,
      compareTooltipGetHoverWaterValuesAtX:
        includePumpFlowWaterTooltip && chart.tooltipBaseLabel === 'Pump Flow'
          ? model.getHoverWaterValuesAtX
          : null,
    };
    return buildDetailChartDatasetSpecs({
      chart,
      entry,
      actualSeries,
      targetSeries,
      baseColor,
      shotStyle,
      compareDatasetMeta,
      visibility: { ...visibility, [chart.visibleKey]: true },
      showTargets,
    });
  });
}
