// Trend bucketing is intentionally done in the frontend so StatisticsService can stay
// focused on per-shot outputs. Buckets use local/browser time for user-facing charts.
import { t } from '@lingui/core/macro';

/**
 * @typedef {import('../types').TrendGranularity} TrendGranularity
 * @typedef {import('../types').TrendEntry} TrendEntry
 * @typedef {import('../types').TrendMetricKey} TrendMetricKey
 * @typedef {import('../types').TrendBucketPoint} TrendBucketPoint
 */

/** @param {unknown} timestamp - epoch seconds or ms */
function normalizeTimestampMs(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value)) return null;
  return value < 1e10 ? value * 1000 : value;
}

/** @param {number} ms */
function cloneAtLocalMidnight(ms) {
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * @param {unknown} timestamp - epoch seconds or ms
 * @returns {number | null}
 */
export function getDayStartLocalMs(timestamp) {
  const ms = normalizeTimestampMs(timestamp);
  if (ms === null) return null;
  const date = cloneAtLocalMidnight(ms);
  return date ? date.getTime() : null;
}

/**
 * @param {unknown} timestamp - epoch seconds or ms
 * @returns {number | null}
 */
export function getIsoWeekStartLocalMs(timestamp) {
  const ms = normalizeTimestampMs(timestamp);
  if (ms === null) return null;
  const date = cloneAtLocalMidnight(ms);
  if (!date) return null;
  const day = date.getDay() || 7; // ISO week: Monday=1 ... Sunday=7
  date.setDate(date.getDate() - (day - 1));
  return date.getTime();
}

/**
 * @param {unknown} timestamp - epoch seconds or ms
 * @returns {number | null}
 */
export function getMonthStartLocalMs(timestamp) {
  const ms = normalizeTimestampMs(timestamp);
  if (ms === null) return null;
  const date = cloneAtLocalMidnight(ms);
  if (!date) return null;
  date.setDate(1);
  return date.getTime();
}

/**
 * @param {unknown} timestamp - epoch seconds or ms
 * @returns {number | null}
 */
export function getYearStartLocalMs(timestamp) {
  const ms = normalizeTimestampMs(timestamp);
  if (ms === null) return null;
  const date = cloneAtLocalMidnight(ms);
  if (!date) return null;
  date.setMonth(0, 1);
  return date.getTime();
}

/**
 * @param {unknown} timestamp
 * @param {TrendGranularity} granularity
 */
function getBucketStartLocalMs(timestamp, granularity) {
  switch (granularity) {
    case 'day':
      return getDayStartLocalMs(timestamp);
    case 'week':
      return getIsoWeekStartLocalMs(timestamp);
    case 'month':
      return getMonthStartLocalMs(timestamp);
    case 'year':
      return getYearStartLocalMs(timestamp);
    default:
      return getMonthStartLocalMs(timestamp);
  }
}

/**
 * @param {number} bucketStartMs
 * @param {TrendGranularity} granularity
 */
function getNextBucketStartLocalMs(bucketStartMs, granularity) {
  const date = new Date(bucketStartMs);
  if (!Number.isFinite(date.getTime())) return null;

  switch (granularity) {
    case 'day':
      date.setDate(date.getDate() + 1);
      break;
    case 'week':
      date.setDate(date.getDate() + 7);
      break;
    case 'month':
      date.setMonth(date.getMonth() + 1, 1);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() + 1, 0, 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1, 1);
      break;
  }

  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * @param {number} bucketStartMs
 * @param {TrendGranularity} granularity
 * @returns {number | null}
 */
export function getBucketEndLocalMs(bucketStartMs, granularity) {
  const nextStart = getNextBucketStartLocalMs(bucketStartMs, granularity);
  if (nextStart === null || !Number.isFinite(nextStart)) return null;
  return nextStart - 1;
}

/** @param {number[]} values */
function averageOf(values) {
  if (!values.length) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * @param {TrendEntry[]} trends
 * @param {TrendMetricKey} metricKey
 * @param {TrendGranularity} granularity
 * @returns {TrendBucketPoint[]}
 */
export function aggregateTrendsByGranularity(trends, metricKey, granularity) {
  if (!Array.isArray(trends) || trends.length === 0) return [];

  /** @type {Map<number, { bucketStartMs: number, shotCount: number, values: number[] }>} */
  const buckets = new Map();
  for (const entry of trends) {
    const bucketStartMs = getBucketStartLocalMs(entry?.timestamp, granularity);
    if (bucketStartMs === null || !Number.isFinite(bucketStartMs)) continue;

    let bucket = buckets.get(bucketStartMs);
    if (!bucket) {
      bucket = {
        bucketStartMs,
        shotCount: 0,
        values: [],
      };
      buckets.set(bucketStartMs, bucket);
    }

    bucket.shotCount += 1;

    // Count-based metrics use bucket.shotCount directly; other metrics aggregate by average.
    if (metricKey !== 'shotCount') {
      const value = Number(
        entry?.[/** @type {Exclude<TrendMetricKey, 'shotCount'>} */ (metricKey)],
      );
      if (Number.isFinite(value)) bucket.values.push(value);
    }
  }

  const sortedBucketStarts = [...buckets.keys()].sort((a, b) => a - b);
  /** @type {TrendBucketPoint[]} */
  const points = [];
  for (const bucketStartMs of sortedBucketStarts) {
    const bucket = buckets.get(bucketStartMs);
    if (!bucket) continue;

    const bucketEndMs = getBucketEndLocalMs(bucketStartMs, granularity);
    if (metricKey === 'shotCount') {
      points.push({
        x: bucketStartMs,
        y: bucket.shotCount,
        bucketStartMs,
        bucketEndMs,
        shotCount: bucket.shotCount,
      });
      continue;
    }

    const avg = averageOf(bucket.values);
    if (avg === null || !Number.isFinite(avg)) continue;

    points.push({
      x: bucketStartMs,
      y: avg,
      bucketStartMs,
      bucketEndMs,
      shotCount: bucket.shotCount,
    });
  }

  // No zero-fill gaps in V1: only buckets with real shots are rendered.
  return points;
}

/**
 * @param {number | null | undefined} ms
 * @param {Intl.DateTimeFormatOptions} [options]
 */
export function formatDateLocal(ms, options) {
  if (!Number.isFinite(ms)) return '';
  try {
    return new Date(/** @type {number} */ (ms)).toLocaleDateString([], options);
  } catch {
    return '';
  }
}

/**
 * @param {number} xMs
 * @param {TrendGranularity} granularity
 * @param {{ containerWidth?: number }} [options]
 */
export function formatTrendBucketTickLabel(xMs, granularity, options = {}) {
  const width = Number(options.containerWidth) || 0;
  const compact = width > 0 && width < 420;

  switch (granularity) {
    case 'day':
      return formatDateLocal(
        xMs,
        compact ? { month: 'short', day: 'numeric' } : { day: '2-digit', month: 'short' },
      );
    case 'week':
      return formatDateLocal(
        xMs,
        compact
          ? { month: 'short', day: 'numeric' }
          : { day: '2-digit', month: 'short', year: '2-digit' },
      );
    case 'month':
      return formatDateLocal(
        xMs,
        compact ? { month: 'short', year: '2-digit' } : { month: 'long', year: 'numeric' },
      );
    case 'year':
      return formatDateLocal(xMs, { year: 'numeric' });
    default:
      return formatDateLocal(xMs, { month: 'short', day: 'numeric' });
  }
}

/**
 * @param {Partial<TrendBucketPoint> | null | undefined} pointMeta
 * @param {TrendGranularity} granularity
 */
export function formatTrendBucketTooltipTitle(pointMeta, granularity) {
  const bucketStartMs = Number(pointMeta?.bucketStartMs ?? pointMeta?.x);
  const bucketEndMs = Number(pointMeta?.bucketEndMs);
  if (!Number.isFinite(bucketStartMs)) return '';

  if (granularity === 'day') {
    return formatDateLocal(bucketStartMs, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (granularity === 'week') {
    const startText = formatDateLocal(bucketStartMs, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const endText = Number.isFinite(bucketEndMs)
      ? formatDateLocal(bucketEndMs, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';
    return endText ? t`Week: ${startText} - ${endText}` : t`Week: ${startText}`;
  }

  if (granularity === 'month') {
    return formatDateLocal(bucketStartMs, { month: 'long', year: 'numeric' });
  }

  if (granularity === 'year') {
    return formatDateLocal(bucketStartMs, { year: 'numeric' });
  }

  return formatDateLocal(bucketStartMs, { month: 'short', day: 'numeric', year: 'numeric' });
}
