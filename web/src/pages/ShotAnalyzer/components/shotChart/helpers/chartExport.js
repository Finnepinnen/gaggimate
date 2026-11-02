import {
  LEGEND_BLOCK_LABELS,
  LEGEND_DASHED_LABELS,
  LEGEND_ORDER,
  LEGEND_THIN_LINE_LABELS,
  STANDARD_LINE_WIDTH,
  THIN_LINE_WIDTH,
  VISIBILITY_KEY_BY_LABEL,
} from '../constants';
import { getShotChartShortLabel } from '../labelVisuals';

/**
 * @typedef {'block' | 'dashed' | 'line'} ExportLegendItemStyle
 * @typedef {{ label: string, color: string, style: ExportLegendItemStyle, lineWidth: number }} ExportLegendItem
 * @typedef {{ name?: string, storageKey?: string, id?: string | number, profile?: string | { label?: string, name?: string } | null }} ExportShotNameSource
 */

/**
 * @param {string} label
 * @returns {ExportLegendItemStyle}
 */
function getLegendItemStyle(label) {
  if (LEGEND_BLOCK_LABELS.has(label)) return 'block';
  if (LEGEND_DASHED_LABELS.has(label)) return 'dashed';
  return 'line';
}

/**
 * @param {{ legendColorByLabel: Record<string, string>, visibility: Record<string, boolean>, hasWeightData: boolean, hasWeightFlowData: boolean }} options
 * @returns {ExportLegendItem[]}
 */
export function getVisibleLegendItemsForExport({
  legendColorByLabel,
  visibility,
  hasWeightData,
  hasWeightFlowData,
}) {
  // Exported legends should reflect the same visibility rules as the live chart,
  // including data-dependent series such as weight and weight flow.
  return LEGEND_ORDER.reduce((items, label) => {
    if (label === 'Weight' && !hasWeightData) return items;
    if (label === 'Weight Flow' && !hasWeightFlowData) return items;

    const key = /** @type {Record<string, string>} */ (VISIBILITY_KEY_BY_LABEL)[label];
    if (key && !visibility[key]) return items;

    items.push({
      label: getShotChartShortLabel(label),
      color: legendColorByLabel[label] || '#94a3b8',
      style: getLegendItemStyle(label),
      lineWidth: LEGEND_THIN_LINE_LABELS.has(label) ? THIN_LINE_WIDTH : STANDARD_LINE_WIDTH,
    });
    return items;
  }, /** @type {ExportLegendItem[]} */ ([]));
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function stripExportFileExtension(value) {
  return String(value || '')
    .trim()
    .replace(/\.[^./\\]{1,8}$/, '');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function sanitizeExportFilenameSegment(value) {
  return stripExportFileExtension(value)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @param {ExportShotNameSource | null | undefined} shotData
 * @param {string} fallbackStem
 * @returns {string}
 */
function resolveShotExportStem(shotData, fallbackStem) {
  const profileValue =
    typeof shotData?.profile === 'string'
      ? shotData.profile
      : shotData?.profile?.label || shotData?.profile?.name || '';
  // Prefer the storage/name fields first so exported files stay stable even when
  // display labels contain punctuation or are not unique.
  return (
    sanitizeExportFilenameSegment(
      shotData?.name || shotData?.storageKey || shotData?.id || profileValue || fallbackStem,
    ) || fallbackStem
  );
}

/**
 * @param {ExportShotNameSource | null | undefined} shotData
 * @param {boolean} includeLegend
 * @param {string} [exportFormat]
 * @returns {string}
 */
export function buildReplayExportFilename(shotData, includeLegend, exportFormat = 'mp4') {
  const stem = resolveShotExportStem(shotData, 'shot-analyzer-replay');
  const extension = exportFormat === 'webm' ? 'webm' : 'mp4';
  return `${stem}${includeLegend ? '-with-legend' : ''}-replay.${extension}`;
}

/**
 * @param {ExportShotNameSource | null | undefined} shotData
 * @param {boolean} includeLegend
 * @returns {string}
 */
export function buildReplayImageFilename(shotData, includeLegend) {
  const stem = resolveShotExportStem(shotData, 'shot-analyzer-chart');
  return `${stem}${includeLegend ? '-with-legend' : ''}.png`;
}
