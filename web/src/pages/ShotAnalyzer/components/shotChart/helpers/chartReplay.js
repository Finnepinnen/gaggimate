/**
 * @typedef {import('./types').ShotChartInstance} ShotChartInstance
 * @typedef {import('./types').ChartPoint} ChartPoint
 * @typedef {import('./types').ReplayDatasetMeta} ReplayDatasetMeta
 * @typedef {import('./types').ReplayAnnotationMeta} ReplayAnnotationMeta
 * @typedef {{ data?: unknown, label?: string }} ReplaySourceDataset
 * @typedef {{ value?: unknown, display?: boolean }} ReplaySourceAnnotation
 */

export const replayRevealPlugin = {
  id: 'replayReveal',
  /** @param {ShotChartInstance} chart */
  beforeDatasetsDraw(chart) {
    if (!chart?.$replayRevealEnabled || !chart.chartArea || !chart.scales?.x) return;
    const cutoffX = Number(chart.$replayRevealX);
    if (!Number.isFinite(cutoffX)) return;

    const cutoffPixelRaw = chart.scales.x.getPixelForValue(cutoffX);
    const cutoffPixel = Math.min(
      chart.chartArea.right,
      Math.max(
        chart.chartArea.left,
        Number.isFinite(cutoffPixelRaw) ? cutoffPixelRaw : chart.chartArea.left,
      ),
    );
    const clipWidth = Math.max(0, cutoffPixel - chart.chartArea.left);

    // Clip only the plotted area so axes, ticks, and annotations can still be
    // controlled independently while the data itself is progressively revealed.
    chart.ctx.save();
    chart.ctx.beginPath();
    chart.ctx.rect(
      chart.chartArea.left,
      chart.chartArea.top,
      clipWidth,
      chart.chartArea.bottom - chart.chartArea.top,
    );
    chart.ctx.clip();
    chart.$replayRevealClipActive = true;
  },
  /** @param {ShotChartInstance} chart */
  afterDatasetsDraw(chart) {
    if (!chart?.$replayRevealClipActive) return;
    chart.ctx.restore();
    chart.$replayRevealClipActive = false;
  },
};

/**
 * @param {number} value
 * @param {number} maxIndex
 * @returns {number}
 */
function clampReplayIndex(value, maxIndex) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maxIndex, value));
}

/**
 * @param {number} xValue
 * @param {number} shotStartSec
 * @param {number} durationSec
 * @param {number} frameCount
 * @returns {number}
 */
function getReplayFrameIndex(xValue, shotStartSec, durationSec, frameCount) {
  if (frameCount <= 0 || durationSec <= 0) return 0;
  // Replay annotations are mapped onto the same normalized frame timeline as the
  // dataset chunks so both appear in lockstep during playback/export.
  const progress = (xValue - shotStartSec) / durationSec;
  return clampReplayIndex(Math.floor(progress * frameCount), frameCount);
}

/**
 * @param {ChartPoint[]} points
 * @param {ChartPoint | null | undefined} point
 */
function pushReplayPoint(points, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const lastPoint = points[points.length - 1];
  if (lastPoint && lastPoint.x === point.x && lastPoint.y === point.y) return;
  points.push(point);
}

/**
 * @param {ChartPoint | null} lastVisiblePoint
 * @param {ChartPoint | null} nextPoint
 * @param {number} frameTime
 * @returns {ChartPoint | null}
 */
function buildReplayBoundaryPoint(lastVisiblePoint, nextPoint, frameTime) {
  if (lastVisiblePoint && nextPoint && nextPoint.x > lastVisiblePoint.x) {
    // Interpolate the frame boundary so replay motion stays visually smooth even
    // when several source samples fall between two replay frames.
    const progress = (frameTime - lastVisiblePoint.x) / (nextPoint.x - lastVisiblePoint.x);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    return {
      x: frameTime,
      y: lastVisiblePoint.y + (nextPoint.y - lastVisiblePoint.y) * clampedProgress,
    };
  }

  if (lastVisiblePoint) {
    return {
      x: frameTime,
      y: lastVisiblePoint.y,
    };
  }

  if (nextPoint) {
    return {
      x: frameTime,
      y: nextPoint.y,
    };
  }

  return null;
}

/**
 * @param {ChartPoint[]} intervalPoints
 * @param {ChartPoint | null} frameBoundaryPoint
 * @returns {ChartPoint[]}
 */
function buildCarryReplayPoints(intervalPoints, frameBoundaryPoint) {
  /** @type {ChartPoint[]} */
  const points = [];
  for (const point of intervalPoints) {
    pushReplayPoint(points, point);
  }

  // Most datasets should simply grow forward over time. Appending the boundary
  // point keeps the line continuous between frame buckets.
  pushReplayPoint(points, frameBoundaryPoint);

  return points;
}

/**
 * @param {ChartPoint[]} intervalPoints
 * @param {ChartPoint | null} frameBoundaryPoint
 * @returns {ChartPoint[]}
 */
function buildExtremaReplayPoints(intervalPoints, frameBoundaryPoint) {
  /** @type {ChartPoint[]} */
  const points = [];

  if (intervalPoints.length > 0) {
    let minIndex = 0;
    let maxIndex = 0;
    for (let i = 1; i < intervalPoints.length; i++) {
      if (intervalPoints[i].y < intervalPoints[minIndex].y) minIndex = i;
      if (intervalPoints[i].y > intervalPoints[maxIndex].y) maxIndex = i;
    }

    const candidateIndices = [0, minIndex, maxIndex, intervalPoints.length - 1]
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((a, b) => a - b);

    // Preserve the first, last, and local extrema inside each frame bucket so
    // spiky datasets do not flatten out when replay runs below raw sample rate.
    for (const candidateIndex of candidateIndices) {
      pushReplayPoint(points, intervalPoints[candidateIndex]);
    }
  }

  pushReplayPoint(points, frameBoundaryPoint);

  return points;
}

/**
 * @param {string | undefined} label
 * @returns {'extrema' | 'carry'}
 */
function getReplayDatasetStrategy(label) {
  switch (label) {
    case 'Pressure':
    case 'Pump Flow':
    case 'Puck Flow':
    case 'Weight Flow':
      return 'extrema';
    default:
      return 'carry';
  }
}

/**
 * @param {{ data: unknown, label: string | undefined, shotStartSec: number, maxTime: number, frameCount: number, frameDurationSec: number }} options
 * @returns {ReplayDatasetMeta}
 */
function buildReplayDatasetMeta({
  data,
  label,
  shotStartSec,
  maxTime,
  frameCount,
  frameDurationSec,
}) {
  /** @type {ChartPoint[]} */
  const fullData = Array.isArray(data)
    ? data.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  /** @type {ChartPoint[]} */
  const activeData = [];
  /** @type {ChartPoint[][]} */
  const frameChunks = Array.from(
    { length: frameCount + 1 },
    () => /** @type {ChartPoint[]} */ ([]),
  );

  if (!fullData.length) {
    return { fullData, activeData, frameChunks };
  }

  const durationSec = Math.max(0, maxTime - shotStartSec);
  const strategy = getReplayDatasetStrategy(label);
  let pointCursor = 0;
  /** @type {ChartPoint | null} */
  let lastVisiblePoint = null;
  let previousFrameTime = shotStartSec;

  // Pre-slice every dataset into replay frame chunks once. Live replay can then
  // append cheap immutable chunks instead of reprocessing the full series per frame.
  for (let frameIndex = 0; frameIndex <= frameCount; frameIndex++) {
    const frameTime = shotStartSec + Math.min(durationSec, frameIndex * frameDurationSec);
    /** @type {ChartPoint[]} */
    const intervalPoints = [];

    while (pointCursor < fullData.length && fullData[pointCursor].x <= frameTime) {
      const point = fullData[pointCursor];
      if (frameIndex === 0 || point.x > previousFrameTime) {
        intervalPoints.push(point);
      }
      lastVisiblePoint = point;
      pointCursor += 1;
    }

    const nextPoint = pointCursor < fullData.length ? fullData[pointCursor] : null;
    const frameBoundaryPoint = buildReplayBoundaryPoint(lastVisiblePoint, nextPoint, frameTime);

    frameChunks[frameIndex] =
      strategy === 'extrema'
        ? buildExtremaReplayPoints(intervalPoints, frameBoundaryPoint)
        : buildCarryReplayPoints(intervalPoints, frameBoundaryPoint);

    previousFrameTime = frameTime;
  }

  return {
    fullData,
    activeData,
    frameChunks,
  };
}

/**
 * @param {Record<string, ReplaySourceAnnotation> | null | undefined} annotations
 * @param {number} shotStartSec
 * @param {number} maxTime
 * @param {number} frameCount
 * @returns {ReplayAnnotationMeta[]}
 */
function buildReplayAnnotationMeta(annotations, shotStartSec, maxTime, frameCount) {
  const durationSec = Math.max(0, maxTime - shotStartSec);
  return Object.entries(annotations || {}).reduce((acc, [key, annotation]) => {
    const time = Number(annotation?.value);
    if (!Number.isFinite(time)) return acc;

    acc.push({
      key,
      time,
      baseDisplay: annotation?.display !== false,
      frameIndex: getReplayFrameIndex(time, shotStartSec, durationSec, frameCount),
    });
    return acc;
  }, /** @type {ReplayAnnotationMeta[]} */ ([]));
}

/**
 * @param {{ mainDatasets: ReplaySourceDataset[] | null | undefined, tempDatasets: ReplaySourceDataset[] | null | undefined, mainAnnotations: Record<string, ReplaySourceAnnotation> | null | undefined, tempAnnotations: Record<string, ReplaySourceAnnotation> | null | undefined, shotStartSec: number, maxTime: number, frameDurationSec: number }} options
 * @returns {import('./types').ShotChartReplayModel}
 */
export function buildShotChartReplayModel({
  mainDatasets,
  tempDatasets,
  mainAnnotations,
  tempAnnotations,
  shotStartSec,
  maxTime,
  frameDurationSec,
}) {
  const durationSec = Math.max(0, maxTime - shotStartSec);
  const frameCount = Math.max(1, Math.ceil(durationSec / Math.max(frameDurationSec, 0.001)));

  // Build one replay runtime description that can be shared by both live replay
  // and export. The caller stays responsible only for applying frames over time.
  return {
    frameCount,
    totalDurationSec: durationSec,
    mainReplayDatasets: (mainDatasets || []).map(dataset =>
      buildReplayDatasetMeta({
        data: dataset?.data,
        label: dataset?.label,
        shotStartSec,
        maxTime,
        frameCount,
        frameDurationSec,
      }),
    ),
    tempReplayDatasets: (tempDatasets || []).map(dataset =>
      buildReplayDatasetMeta({
        data: dataset?.data,
        label: dataset?.label,
        shotStartSec,
        maxTime,
        frameCount,
        frameDurationSec,
      }),
    ),
    mainAnnotationMeta: buildReplayAnnotationMeta(
      mainAnnotations,
      shotStartSec,
      maxTime,
      frameCount,
    ),
    tempAnnotationMeta: buildReplayAnnotationMeta(
      tempAnnotations,
      shotStartSec,
      maxTime,
      frameCount,
    ),
  };
}
