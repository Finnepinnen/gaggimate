import {
  EXTERNAL_TOOLTIP_FALLBACK_OFFSET_X,
  TOOLTIP_GROUP_BY_LABEL,
  TOOLTIP_INDEX,
  TOOLTIP_WATER_LABELS,
  UNIT_BY_LABEL,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from '../constants';
import { t } from '@lingui/core/macro';
import { getShotChartDisplayLabel } from '../labelVisuals';
import { createHiddenExternalTooltipState } from './tooltipState';

/** @typedef {import('./tooltipTypes').ShotChartInstance} ShotChartInstance */
/** @typedef {import('./tooltipTypes').ShotChartTooltipModel} ShotChartTooltipModel */
/** @typedef {import('./tooltipTypes').ShotChartTooltipItem} ShotChartTooltipItem */
/** @typedef {import('./tooltipTypes').ShotChartTooltipDataset} ShotChartTooltipDataset */
/** @typedef {import('./tooltipTypes').HoverWaterValuesGetter} HoverWaterValuesGetter */
/** @typedef {import('./tooltipTypes').TooltipRow} TooltipRow */
/** @typedef {import('./tooltipTypes').TooltipPhaseSummary} TooltipPhaseSummary */
/** @typedef {import('./tooltipTypes').PhaseTooltipRow} PhaseTooltipRow */
/** @typedef {import('./tooltipTypes').PhaseTooltipGroup} PhaseTooltipGroup */
/** @typedef {import('./tooltipTypes').ExternalTooltipState} ExternalTooltipState */
/** @typedef {{ x?: unknown, y?: unknown }} ChartPointLike */

/**
 * @param {string | null | undefined} label
 * @returns {boolean}
 */
export function shouldRenderTooltipLabel(label) {
  return Boolean(label) && label !== 'Phases' && label !== 'Stops';
}

/**
 * @param {{ dataset?: { label?: string } } | null | undefined} a
 * @param {{ dataset?: { label?: string } } | null | undefined} b
 * @returns {number}
 */
export function sortTooltipItems(a, b) {
  return (
    (TOOLTIP_INDEX[a?.dataset?.label ?? ''] ?? 999) -
    (TOOLTIP_INDEX[b?.dataset?.label ?? ''] ?? 999)
  );
}

/**
 * @param {unknown} dataPoints
 * @param {number} xValue
 * @returns {ChartPointLike | null}
 */
function findClosestPointAtX(dataPoints, xValue) {
  if (!Array.isArray(dataPoints) || dataPoints.length === 0 || !Number.isFinite(xValue)) {
    return null;
  }

  let low = 0;
  let high = dataPoints.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midX = Number(/** @type {ChartPointLike | null} */ (dataPoints[mid])?.x);

    if (!Number.isFinite(midX) || midX < xValue) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const candidateIndexes = [low - 1, low, low + 1];
  /** @type {ChartPointLike | null} */
  let bestPoint = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  candidateIndexes.forEach(index => {
    if (index < 0 || index >= dataPoints.length) return;
    const point = /** @type {ChartPointLike | null} */ (dataPoints[index]);
    const pointX = Number(point?.x);
    const pointY = Number(point?.y);

    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return;

    const distance = Math.abs(pointX - xValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = point;
    }
  });

  return bestPoint;
}

/** @param {string} label */
function getTooltipGroupKey(label) {
  return TOOLTIP_GROUP_BY_LABEL[label] || null;
}

/**
 * @param {TooltipRow[]} rows
 * @returns {TooltipRow | null}
 */
function buildCompareDifferenceRow(rows) {
  if (!Array.isArray(rows) || rows.length !== 2) return null;

  const [firstRow, secondRow] = [...rows].sort(
    (a, b) => /** @type {number} */ (a.shotOrder) - /** @type {number} */ (b.shotOrder),
  );
  if (!Number.isFinite(firstRow?.numericValue) || !Number.isFinite(secondRow?.numericValue)) {
    return null;
  }

  const delta =
    /** @type {number} */ (secondRow.numericValue) - /** @type {number} */ (firstRow.numericValue);
  const unit = UNIT_BY_LABEL[firstRow.label];
  const deltaPrefix = delta > 0 ? '+' : '';
  const deltaSuffix = unit ? ` ${unit}` : '';
  const formattedValue = `${deltaPrefix}${delta.toFixed(1)}${deltaSuffix}`;

  return {
    label: firstRow.label,
    displayLabel: t`Difference`,
    isDifference: true,
    valueText: formattedValue,
    color: firstRow.color,
    spacerBefore: true,
  };
}

/** @param {number | null | undefined} value */
function formatWaterValue(value) {
  return Number.isFinite(value) ? `${/** @type {number} */ (value).toFixed(1)} ml` : '-';
}

/**
 * @param {number | null | undefined} phaseWaterMl
 * @param {number | null | undefined} phaseTotalWaterMl
 */
function formatPhaseWaterValue(phaseWaterMl, phaseTotalWaterMl) {
  if (!Number.isFinite(phaseWaterMl) || !Number.isFinite(phaseTotalWaterMl)) return '-';
  return `${formatWaterValue(phaseWaterMl)} → ${formatWaterValue(phaseTotalWaterMl)}`;
}

/**
 * @typedef {object} CompareWaterValues
 * @property {string} shotLabel
 * @property {number} shotOrder
 * @property {number | null} phaseWaterMl
 * @property {number | null} phaseTotalWaterMl
 * @property {number | null} totalWaterMl
 * @property {string} color
 */

/**
 * @param {CompareWaterValues} values
 * @returns {TooltipRow[]}
 */
function buildCompareWaterRows({
  shotLabel,
  shotOrder,
  phaseWaterMl,
  phaseTotalWaterMl,
  totalWaterMl,
  color,
}) {
  return [
    {
      shotLabel,
      shotOrder,
      label: WATER_DRAWN_PHASE_LABEL,
      displayLabel: getShotChartDisplayLabel(WATER_DRAWN_PHASE_LABEL),
      valueText: formatPhaseWaterValue(phaseWaterMl, phaseTotalWaterMl),
      color,
    },
    {
      shotLabel,
      shotOrder,
      label: WATER_DRAWN_TOTAL_LABEL,
      displayLabel: getShotChartDisplayLabel(WATER_DRAWN_TOTAL_LABEL),
      valueText: formatWaterValue(totalWaterMl),
      color,
    },
  ];
}

/**
 * @param {ShotChartInstance} chart
 * @param {ShotChartTooltipModel} tooltip
 * @returns {number}
 */
function resolveTooltipAnchorX(chart, tooltip) {
  if (Number.isFinite(chart.$fixedTooltipPointerX)) {
    return /** @type {number} */ (chart.$fixedTooltipPointerX);
  }
  if (Number.isFinite(tooltip.caretX)) return tooltip.caretX;
  return chart.chartArea.left + EXTERNAL_TOOLTIP_FALLBACK_OFFSET_X;
}

/**
 * @param {ShotChartInstance} chart
 * @param {ShotChartTooltipModel} tooltip
 * @returns {number}
 */
function resolveTooltipAnchorY(chart, tooltip) {
  if (Number.isFinite(chart.$fixedTooltipPointerY)) {
    return /** @type {number} */ (chart.$fixedTooltipPointerY);
  }
  if (Number.isFinite(tooltip.caretY)) return tooltip.caretY;
  return chart.chartArea.top;
}

/**
 * @param {ShotChartTooltipItem} tooltipItem
 * @param {HoverWaterValuesGetter} getHoverWaterValuesAtX
 * @param {Record<string, string>} tooltipColorByLabel
 * @returns {TooltipRow | null}
 */
function buildTooltipRowModel(tooltipItem, getHoverWaterValuesAtX, tooltipColorByLabel) {
  const label = tooltipItem?.dataset?.label;
  if (!label || !shouldRenderTooltipLabel(label)) return null;

  let valueText = null;
  if (TOOLTIP_WATER_LABELS.has(label)) {
    const xValue = tooltipItem.parsed?.x;
    const { totalWaterMl, phaseWaterMl, phaseTotalWaterMl } = getHoverWaterValuesAtX(xValue);
    valueText =
      label === WATER_DRAWN_PHASE_LABEL
        ? formatPhaseWaterValue(phaseWaterMl, phaseTotalWaterMl)
        : formatWaterValue(totalWaterMl);
  } else {
    const value = tooltipItem.parsed?.y;
    if (value === null || value === undefined) return null;
    const unit = UNIT_BY_LABEL[label];
    valueText = unit ? `${value.toFixed(1)} ${unit}` : `${value.toFixed(1)}`;
  }

  return {
    label,
    valueText,
    color: tooltipColorByLabel[label] || '#94a3b8',
    spacerBefore: false,
  };
}

/**
 * @param {ShotChartTooltipItem[]} tooltipItems
 * @param {HoverWaterValuesGetter} getHoverWaterValuesAtX
 * @param {Record<string, string>} tooltipColorByLabel
 * @returns {TooltipRow[]}
 */
function buildExternalTooltipRows(tooltipItems, getHoverWaterValuesAtX, tooltipColorByLabel) {
  const sortedItems = [...(tooltipItems || [])]
    .filter(item => shouldRenderTooltipLabel(item?.dataset?.label))
    .sort(sortTooltipItems);

  /** @type {string | null} */
  let previousGroupKey = null;

  return sortedItems.reduce((rows, item) => {
    const row = buildTooltipRowModel(item, getHoverWaterValuesAtX, tooltipColorByLabel);
    if (!row) return rows;

    const groupKey = getTooltipGroupKey(row.label);
    if (previousGroupKey !== null && groupKey !== null && groupKey !== previousGroupKey) {
      row.spacerBefore = true;
    }

    if (groupKey !== null) previousGroupKey = groupKey;
    rows.push(row);
    return rows;
  }, /** @type {TooltipRow[]} */ ([]));
}

/**
 * @param {object} options
 * @param {ShotChartInstance} options.chart
 * @param {number | null} options.xValue
 * @returns {TooltipRow[]}
 */
function buildCompareExternalTooltipRows({ chart, xValue }) {
  if (!chart || !Number.isFinite(xValue)) return [];

  /** @type {ShotChartTooltipDataset[]} */
  const datasets = Array.isArray(chart.data?.datasets) ? chart.data.datasets : [];
  const xValueAt = /** @type {number} */ (xValue);
  /** @type {Map<number, CompareWaterValues>} */
  const waterByShotOrder = new Map();

  // Compare tooltips are grouped by metric first so Shot 1 / Shot 2 values sit
  // directly next to each other before the optional difference row.
  /** @type {TooltipRow[]} */
  const compareRows = datasets
    .map((dataset, datasetIndex) => {
      if (!dataset?.compareTooltipBaseLabel || !chart.isDatasetVisible(datasetIndex)) {
        return null;
      }

      const point = findClosestPointAtX(dataset.data, xValueAt);
      if (!point) return null;

      const baseLabel = dataset.compareTooltipBaseLabel;
      const value = Number(point.y);
      if (!Number.isFinite(value)) return null;

      const shotOrder = Number.isFinite(dataset.compareTooltipShotOrder)
        ? /** @type {number} */ (dataset.compareTooltipShotOrder)
        : 999;
      const shotNumber = shotOrder + 1;
      const shotLabel = t`Shot ${shotNumber}`;
      const waterGetter = dataset.compareTooltipGetHoverWaterValuesAtX;
      if (typeof waterGetter === 'function' && !waterByShotOrder.has(shotOrder)) {
        const { totalWaterMl, phaseWaterMl, phaseTotalWaterMl } = waterGetter(xValueAt);
        waterByShotOrder.set(shotOrder, {
          shotLabel,
          shotOrder,
          phaseWaterMl,
          phaseTotalWaterMl,
          totalWaterMl,
          color: /** @type {string} */ (dataset.borderColor) || '#94a3b8',
        });
      }

      const unit = UNIT_BY_LABEL[baseLabel];
      return {
        shotLabel,
        shotOrder,
        label: baseLabel,
        numericValue: value,
        displayLabel: getShotChartDisplayLabel(baseLabel),
        valueText: unit ? `${value.toFixed(1)} ${unit}` : `${value.toFixed(1)}`,
        color: /** @type {string} */ (dataset.borderColor) || '#94a3b8',
      };
    })
    .filter(row => row !== null);

  waterByShotOrder.forEach(waterValues => {
    compareRows.push(...buildCompareWaterRows(waterValues));
  });

  compareRows.sort((a, b) => {
    const labelOrder = (TOOLTIP_INDEX[a.label] ?? 999) - (TOOLTIP_INDEX[b.label] ?? 999);
    if (labelOrder !== 0) return labelOrder;
    return /** @type {number} */ (a.shotOrder) - /** @type {number} */ (b.shotOrder);
  });

  const groupedRows = compareRows.reduce((groups, row) => {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup || lastGroup[0]?.label !== row.label) {
      groups.push([row]);
      return groups;
    }
    lastGroup.push(row);
    return groups;
  }, /** @type {TooltipRow[][]} */ ([]));

  return groupedRows.flatMap((rows, groupIndex) => {
    const normalizedRows = rows.map((row, rowIndex) => ({
      ...row,
      spacerBefore: groupIndex > 0 && rowIndex === 0,
    }));

    if (!chart.$compareTooltipShowDifference) {
      return normalizedRows;
    }

    const differenceRow = buildCompareDifferenceRow(rows);
    return differenceRow ? [...normalizedRows, differenceRow] : normalizedRows;
  });
}

/**
 * @param {ShotChartInstance} chart
 * @param {ShotChartTooltipModel} tooltip
 * @param {ShotChartTooltipItem[]} tooltipItems
 * @param {boolean} isCompareTooltipMode
 * @returns {number | null}
 */
function resolveCompareXValue(chart, tooltip, tooltipItems, isCompareTooltipMode) {
  if (!isCompareTooltipMode) return null;
  if (Number.isFinite(chart?.$fixedTooltipXValue)) {
    return /** @type {number} */ (chart.$fixedTooltipXValue);
  }
  if (Number.isFinite(tooltipItems[0]?.parsed?.x)) return tooltipItems[0].parsed.x;

  const scaleXValue = chart.scales?.x?.getValueForPixel?.(tooltip.caretX);
  return Number.isFinite(scaleXValue) ? /** @type {number} */ (scaleXValue) : null;
}

/** Water getter for charts that have none: water rows show no value. */
function getNoHoverWaterValues() {
  return { totalWaterMl: null, phaseWaterMl: null, phaseTotalWaterMl: null };
}

/**
 * @param {object} options
 * @param {string} options.tooltipMode
 * @param {ShotChartInstance} options.chart
 * @param {number | null} options.compareXValue
 * @param {ShotChartTooltipItem[]} options.tooltipItems
 * @param {HoverWaterValuesGetter} [options.getHoverWaterValuesAtX]
 * @param {Record<string, string>} [options.tooltipColorByLabel]
 * @returns {TooltipRow[]}
 */
function resolveTooltipRows({
  tooltipMode,
  chart,
  compareXValue,
  tooltipItems,
  getHoverWaterValuesAtX,
  tooltipColorByLabel,
}) {
  if (tooltipMode === 'compare') {
    return buildCompareExternalTooltipRows({ chart, xValue: compareXValue });
  }
  if (tooltipMode === 'compareTitleOnly') {
    return [];
  }
  return buildExternalTooltipRows(
    tooltipItems,
    getHoverWaterValuesAtX || getNoHoverWaterValues,
    tooltipColorByLabel || {},
  );
}

/**
 * @param {ShotChartInstance} chart
 * @param {ShotChartTooltipModel} tooltip
 * @param {ShotChartTooltipItem[]} tooltipItems
 * @returns {number | null}
 */
function resolveSingleXValue(chart, tooltip, tooltipItems) {
  if (Number.isFinite(chart?.$fixedTooltipXValue)) {
    return /** @type {number} */ (chart.$fixedTooltipXValue);
  }
  if (Number.isFinite(tooltipItems?.[0]?.parsed?.x)) return tooltipItems[0].parsed.x;
  const scaleXValue = chart?.scales?.x?.getValueForPixel?.(tooltip?.caretX);
  return Number.isFinite(scaleXValue) ? /** @type {number} */ (scaleXValue) : null;
}

/**
 * @param {PhaseTooltipRow[] | undefined} rows
 * @param {number | null} xValue
 * @returns {PhaseTooltipRow | null}
 */
function findPhaseRowAtX(rows, xValue) {
  if (!Array.isArray(rows) || !Number.isFinite(xValue)) return null;
  const x = /** @type {number} */ (xValue);

  /** @type {PhaseTooltipRow | null} */
  let closestRow = null;
  let closestDistance = 0.25;

  rows.forEach(row => {
    const start = Number(row?.start);
    const end = Number(row?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    if (x >= start && x <= end) {
      closestRow = row;
      closestDistance = 0;
      return;
    }

    const distance = Math.max(0, start - x, x - end);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestRow = row;
    }
  });

  return closestRow;
}

/**
 * @param {object} options
 * @param {number | null} options.xValue
 * @param {PhaseTooltipGroup[]} options.phaseTooltipGroups
 * @param {boolean} options.showPhaseNames
 * @param {boolean} options.showStops
 * @returns {TooltipPhaseSummary[]}
 */
function buildPhaseTooltipSummaries({ xValue, phaseTooltipGroups, showPhaseNames, showStops }) {
  if (!showPhaseNames && !showStops) return [];
  if (!Array.isArray(phaseTooltipGroups) || phaseTooltipGroups.length === 0) return [];

  return phaseTooltipGroups.reduce((summaries, group) => {
    const row = findPhaseRowAtX(group?.rows, xValue);
    if (!row) return summaries;

    const phaseNumber = row.phaseNumber;
    const phaseName = showPhaseNames ? row.phaseName || '' : '';
    const phaseLabel = showPhaseNames ? buildPhaseLabel(phaseNumber, phaseName) : '';
    const skipNotice = showStops ? row.skipNotice || '' : '';
    const stopReason = showStops ? row.stopReason || '' : '';
    const stopValue = showStops ? row.stopValue || '' : '';
    const stopTargetValue = showStops ? row.stopTargetValue || '' : '';
    const stopType = showStops ? row.stopType || '' : '';

    if (!phaseLabel && !skipNotice && !stopReason && !stopValue && !stopTargetValue) {
      return summaries;
    }

    summaries.push({
      phaseLabel,
      skipNotice,
      stopReason: stopReason && stopReason !== '-' ? stopReason : '',
      stopValue: stopValue && stopValue !== '-' ? stopValue : '',
      stopTargetValue,
      stopType,
      shotLabel: group.shotLabel || '',
      shotNumber: group.shotNumber ?? null,
      color: group.color || null,
    });
    return summaries;
  }, /** @type {TooltipPhaseSummary[]} */ ([]));
}

/**
 * @param {number | string} phaseNumber
 * @param {string} phaseName
 * @returns {string}
 */
function buildPhaseLabel(phaseNumber, phaseName) {
  if (!phaseName) return t`Phase ${phaseNumber}`;
  return t`Phase ${phaseNumber}: ${phaseName}`;
}

/**
 * @param {object} options
 * @param {boolean} options.isCompareTooltipMode
 * @param {number | null} options.compareXValue
 * @param {ShotChartTooltipModel} options.tooltip
 * @returns {string[]}
 */
function resolveTitleLines({ isCompareTooltipMode, compareXValue, tooltip }) {
  if (isCompareTooltipMode) {
    return Number.isFinite(compareXValue)
      ? [`${/** @type {number} */ (compareXValue).toFixed(2)} s`]
      : [];
  }

  return Array.isArray(tooltip.title)
    ? tooltip.title.filter(title => typeof title === 'string' && title.trim().length > 0)
    : [];
}

/**
 * @param {object} options
 * @param {ShotChartInstance} options.chart
 * @param {ShotChartTooltipModel} options.tooltip
 * @param {HoverWaterValuesGetter} [options.getHoverWaterValuesAtX] Water rows show no value without it.
 * @param {Record<string, string>} [options.tooltipColorByLabel] Rows use a neutral colour without it.
 * @param {string} [options.tooltipMode]
 * @param {PhaseTooltipGroup[]} [options.phaseTooltipGroups]
 * @param {boolean} [options.showPhaseNames]
 * @param {boolean} [options.showStops]
 * @returns {ExternalTooltipState}
 */
export function buildExternalTooltipState({
  chart,
  tooltip,
  getHoverWaterValuesAtX,
  tooltipColorByLabel,
  tooltipMode = 'single',
  phaseTooltipGroups = [],
  showPhaseNames = true,
  showStops = true,
}) {
  // Chart.js still drives hit-testing, but the visible tooltip is rendered as HTML for richer layout control.
  if (!tooltip || tooltip.opacity === 0 || !chart.chartArea) {
    return createHiddenExternalTooltipState();
  }

  const tooltipItems = Array.isArray(tooltip.dataPoints) ? tooltip.dataPoints : [];
  const isCompareTooltipMode = tooltipMode === 'compare' || tooltipMode === 'compareTitleOnly';
  const compareXValue = resolveCompareXValue(chart, tooltip, tooltipItems, isCompareTooltipMode);
  const tooltipXValue = isCompareTooltipMode
    ? compareXValue
    : resolveSingleXValue(chart, tooltip, tooltipItems);
  const rows = resolveTooltipRows({
    tooltipMode,
    chart,
    compareXValue,
    tooltipItems,
    getHoverWaterValuesAtX,
    tooltipColorByLabel,
  });
  const titleLines = resolveTitleLines({
    isCompareTooltipMode,
    compareXValue,
    tooltip,
  });
  const phaseSummaries = buildPhaseTooltipSummaries({
    xValue: tooltipXValue,
    phaseTooltipGroups,
    showPhaseNames,
    showStops,
  });

  if (rows.length === 0 && titleLines.length === 0 && phaseSummaries.length === 0) {
    return createHiddenExternalTooltipState();
  }

  return {
    visible: true,
    titleLines,
    phaseSummaries,
    rows,
    anchorX: resolveTooltipAnchorX(chart, tooltip),
    anchorY: resolveTooltipAnchorY(chart, tooltip),
    chartWidth: chart.width,
    chartHeight: chart.height,
    chartAreaLeft: chart.chartArea.left,
    chartAreaRight: chart.chartArea.right,
    chartAreaTop: chart.chartArea.top,
    chartAreaBottom: chart.chartArea.bottom,
    tooltipBoundsLeft: chart.chartArea.left,
    tooltipBoundsRight: chart.chartArea.right,
    tooltipBoundsTop: chart.chartArea.top,
    tooltipBoundsBottom: chart.chartArea.bottom,
  };
}
