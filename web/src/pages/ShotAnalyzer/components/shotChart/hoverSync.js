/**
 * hoverSync.js
 *
 * Contains the cross-chart imperative behavior that keeps the main and
 * temperature charts visually aligned and hover-synchronized.
 */

/** @typedef {import('./tooltip/tooltipTypes').ShotChartInstance} ShotChartInstance */
/** @typedef {import('chart.js').ActiveDataPoint} ActiveDataPoint */
/** @typedef {import('chart.js').Scale} Scale */
/** @typedef {{ top: number, bottom: number }} VerticalTolerance */
/** @typedef {{ top: number, bottom: number, left: number }} ClientRectLike */
/** @typedef {MouseEvent | TouchEvent | PointerEvent} HoverEvent */

/** @param {ShotChartInstance | null | undefined} chart */
function clearTooltipState(chart) {
  if (!chart) return;
  chart.$fixedTooltipPointerX = null;
  chart.$fixedTooltipPointerY = null;
  chart.$externalTooltipSource = null;
  chart.$externalTooltipClientY = null;
  chart.$shotChartHoverSyncActive = false;
  chart.setActiveElements([]);
  chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  chart.update('none');
}

/**
 * @param {unknown} datasetData
 * @param {number} xValue
 * @returns {number}
 */
function findClosestPointIndex(datasetData, xValue) {
  if (!Array.isArray(datasetData) || datasetData.length === 0) return -1;

  // Hover sync operates on the rendered chart datasets, not raw samples. A simple
  // nearest-point scan keeps the logic format-agnostic across replay and static states.
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < datasetData.length; i++) {
    const point = /** @type {{ x?: unknown } | null} */ (datasetData[i]);
    if (!point || typeof point.x !== 'number') continue;

    const distance = Math.abs(/** @type {number} */ (point.x) - xValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * @param {ShotChartInstance} chart
 * @param {number} xValue
 * @returns {ActiveDataPoint[]}
 */
function buildActiveElementsForX(chart, xValue) {
  /** @type {ActiveDataPoint[]} */
  const active = [];

  chart.data.datasets.forEach((dataset, datasetIndex) => {
    const meta = chart.getDatasetMeta(datasetIndex);
    if (!meta || meta.hidden || dataset.hidden) return;

    const index = findClosestPointIndex(dataset.data, xValue);
    if (index >= 0) active.push({ datasetIndex, index });
  });

  return active;
}

/**
 * @param {ShotChartInstance} chart
 * @param {number} xValue
 * @param {number | null | undefined} pointerClientY
 * @param {boolean} [showTooltip]
 * @param {{ tooltipSource?: string, tooltipClientY?: number | null }} [options]
 */
function applyHoverForChart(chart, xValue, pointerClientY, showTooltip = true, options = {}) {
  if (!chart || !Number.isFinite(xValue)) return;

  const active = buildActiveElementsForX(chart, xValue);
  if (!active.length) {
    clearTooltipState(chart);
    return;
  }

  const xPixel = chart.scales?.x?.getPixelForValue(xValue);
  const tooltipX = Number.isFinite(xPixel) ? xPixel : chart.chartArea.left + 8;
  let tooltipY = chart.chartArea.top + 8;

  if (Number.isFinite(pointerClientY) && chart.canvas) {
    // Clamp the tooltip anchor into the plotted region so dragging near the chart
    // edges never sends the tooltip outside the visible drawing area.
    const chartRect = chart.canvas.getBoundingClientRect();
    const minClientY = chartRect.top + chart.chartArea.top;
    const maxClientY = chartRect.top + chart.chartArea.bottom;
    const clampedClientY = Math.min(
      maxClientY,
      Math.max(minClientY, /** @type {number} */ (pointerClientY)),
    );
    tooltipY = clampedClientY - chartRect.top;
  }

  chart.$fixedTooltipPointerY = tooltipY;
  chart.$fixedTooltipPointerX = tooltipX;
  chart.$externalTooltipSource = options.tooltipSource || null;
  chart.$externalTooltipClientY = Number.isFinite(options.tooltipClientY)
    ? options.tooltipClientY
    : null;
  if (showTooltip) chart.$shotChartHoverSyncActive = true;
  chart.setActiveElements(active);
  if (showTooltip) {
    chart.tooltip?.setActiveElements(active, { x: tooltipX, y: tooltipY });
  } else {
    chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  }
  chart.update('none');
}

/**
 * @param {object} options
 * @param {ShotChartInstance | null | undefined} options.mainChart
 * @param {ShotChartInstance | null | undefined} options.tempChart
 * @param {number} options.xValue
 * @param {number | null | undefined} options.pointerClientY
 * @param {string} [options.tooltipSource]
 * @param {(xValue: number) => void} [options.onHoverXChange]
 */
export function applyShotChartHoverAtX({
  mainChart,
  tempChart,
  xValue,
  pointerClientY,
  tooltipSource = 'main',
  onHoverXChange,
}) {
  if (!mainChart || !tempChart || !Number.isFinite(xValue)) return;

  applyHoverForChart(mainChart, xValue, pointerClientY, true, {
    tooltipSource,
    tooltipClientY: pointerClientY,
  });
  applyHoverForChart(tempChart, xValue, pointerClientY, false);
  onHoverXChange?.(xValue);
}

/**
 * @param {HoverEvent | null | undefined} event
 * @returns {{ clientX: number, clientY: number } | null}
 */
export function extractClientPoint(event) {
  if (!event) return null;
  const mouseEvent = /** @type {MouseEvent} */ (event);
  if (Number.isFinite(mouseEvent.clientX) && Number.isFinite(mouseEvent.clientY)) {
    return { clientX: mouseEvent.clientX, clientY: mouseEvent.clientY };
  }

  const touchEvent = /** @type {TouchEvent} */ (event);
  const touch = touchEvent.touches?.[0] || touchEvent.changedTouches?.[0];
  if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
    return { clientX: touch.clientX, clientY: touch.clientY };
  }

  return null;
}

/**
 * @param {ShotChartInstance} mainChart
 * @param {ShotChartInstance} tempChart
 * @returns {{ mainXScale: Scale, mainRect: DOMRect, tempRect: DOMRect | null } | null}
 */
function getChartClientRects(mainChart, tempChart) {
  if (!mainChart.scales?.x || !mainChart.canvas) return null;

  return {
    mainXScale: mainChart.scales.x,
    mainRect: mainChart.canvas.getBoundingClientRect(),
    tempRect: tempChart.canvas?.getBoundingClientRect?.() || null,
  };
}

/**
 * @param {boolean | undefined} isTouch
 * @returns {VerticalTolerance}
 */
function getHoverVerticalTolerance(isTouch) {
  return {
    bottom: isTouch ? 96 : 10,
    top: isTouch ? 48 : 0,
  };
}

/**
 * @param {number} clientY
 * @param {ClientRectLike} rect
 * @param {VerticalTolerance} tolerance
 */
function isClientYInRect(clientY, rect, tolerance) {
  return clientY >= rect.top - tolerance.top && clientY <= rect.bottom + tolerance.bottom;
}

/**
 * @param {number} clientY
 * @param {ClientRectLike} mainRect
 * @param {ClientRectLike | null} tempRect
 * @param {boolean | undefined} isTouch
 */
function isClientYInChartHoverRange(clientY, mainRect, tempRect, isTouch) {
  const tolerance = getHoverVerticalTolerance(isTouch);
  const withinMainChart = isClientYInRect(clientY, mainRect, tolerance);
  const withinTempChart = tempRect ? isClientYInRect(clientY, tempRect, tolerance) : false;
  const stackBottom = tempRect?.bottom || mainRect.bottom;
  const withinChartStack =
    clientY >= mainRect.top - tolerance.top && clientY <= stackBottom + tolerance.bottom;

  return withinMainChart || withinTempChart || withinChartStack;
}

/**
 * @param {ShotChartInstance} mainChart
 * @param {Scale} mainXScale
 * @param {ClientRectLike} mainRect
 * @param {number} clientX
 * @returns {number}
 */
function getHoverXValueForClientX(mainChart, mainXScale, mainRect, clientX) {
  const minClientX = mainRect.left + (mainChart.chartArea?.left || 0);
  const maxClientX = mainRect.left + (mainChart.chartArea?.right || mainChart.width || 0);
  const clampedClientX = Math.min(maxClientX, Math.max(minClientX, clientX));
  const sourceX = clampedClientX - mainRect.left;

  return mainXScale.getValueForPixel(sourceX);
}

/**
 * @param {ClientRectLike | null} tempRect
 * @param {number} clientY
 * @returns {'temp' | 'main'}
 */
function getTooltipSourceForClientY(tempRect, clientY) {
  return tempRect && clientY >= tempRect.top && clientY <= tempRect.bottom ? 'temp' : 'main';
}

/**
 * @param {object} options
 * @param {ShotChartInstance | null | undefined} options.mainChart
 * @param {ShotChartInstance | null | undefined} options.tempChart
 * @returns {() => void} Detaches the observers.
 */
export function attachTempChartLayoutSync({ mainChart, tempChart }) {
  if (!mainChart || !tempChart) return () => {};

  const syncTempPlotArea = () => {
    // The temperature chart must mirror the main chart's inner plot width so the shared x-position lines up exactly.
    if (!mainChart.chartArea || !tempChart.chartArea) return;

    const currentPadding = tempChart.options.layout?.padding || {};
    const currentLeft = Number(currentPadding.left) || 0;
    const currentRight = Number(currentPadding.right) || 0;
    const currentTop = Number(currentPadding.top) || 0;
    const currentBottom = Number(currentPadding.bottom) || 0;
    const mainLeftMargin = mainChart.chartArea.left;
    const mainRightMargin = mainChart.width - mainChart.chartArea.right;
    const tempLeftMargin = tempChart.chartArea.left;
    const tempRightMargin = tempChart.width - tempChart.chartArea.right;
    const targetLeft = Math.max(0, currentLeft + mainLeftMargin - tempLeftMargin);
    const targetRight = Math.max(0, currentRight + mainRightMargin - tempRightMargin);
    const targetTop = currentTop;
    const targetBottom = currentBottom;

    if (
      Math.abs(currentLeft - targetLeft) < 0.5 &&
      Math.abs(currentRight - targetRight) < 0.5 &&
      Math.abs(currentTop - targetTop) < 0.5 &&
      Math.abs(currentBottom - targetBottom) < 0.5
    ) {
      return;
    }

    // Chart.js exposes resolved options through a Proxy. Never assign that Proxy
    // back into its own configuration: subsequent writes recurse indefinitely.
    tempChart.options.layout.padding = {
      left: targetLeft,
      right: targetRight,
      top: targetTop,
      bottom: targetBottom,
    };
    tempChart.update('none');
  };

  const syncTempPlotAreaSettled = () => {
    // Chart.js chartArea measurements can settle over a few passes when hidden
    // axes and layout padding interact, so iterate until the plotted x-range converges.
    for (let pass = 0; pass < 4; pass += 1) {
      syncTempPlotArea();
    }
  };

  const browserWindow = globalThis.window;
  let frameId = 0;
  const scheduleTempPlotAreaSync = () => {
    if (!browserWindow?.requestAnimationFrame) {
      syncTempPlotAreaSettled();
      return;
    }
    if (frameId) return;

    frameId = browserWindow.requestAnimationFrame(() => {
      frameId = 0;
      syncTempPlotAreaSettled();
    });
  };

  const resizeObserver =
    typeof globalThis.ResizeObserver === 'function'
      ? new globalThis.ResizeObserver(scheduleTempPlotAreaSync)
      : null;

  // Chart.js calculates the axes synchronously, but responsive canvas sizing may
  // settle one frame later. Run both passes so additional right-side axes keep the
  // temperature chart's x-range identical to the main chart's x-range.
  syncTempPlotAreaSettled();
  if (browserWindow) {
    scheduleTempPlotAreaSync();
    browserWindow.addEventListener('resize', scheduleTempPlotAreaSync);
  }
  if (resizeObserver && mainChart.canvas) resizeObserver.observe(mainChart.canvas);
  if (resizeObserver && tempChart.canvas) resizeObserver.observe(tempChart.canvas);

  return () => {
    if (frameId && browserWindow?.cancelAnimationFrame) browserWindow.cancelAnimationFrame(frameId);
    if (browserWindow) browserWindow.removeEventListener('resize', scheduleTempPlotAreaSync);
    resizeObserver?.disconnect();
  };
}

/**
 * @param {object} options
 * @param {HTMLElement | null} options.hoverArea
 * @param {ShotChartInstance | null | undefined} options.mainChart
 * @param {ShotChartInstance | null | undefined} options.tempChart
 * @param {() => void} options.hideExternalTooltip
 * @param {{ current: () => void }} options.clearAllHoverRef
 * @param {{ current: boolean }} options.isReplayingRef
 * @param {{ current: boolean }} options.isExportingRef
 * @param {(xValue: number | null) => void} [options.onHoverXChange]
 * @param {boolean} [options.disableDirectHoverOnMobile]
 * @returns {() => void} Detaches the listeners.
 */
export function attachShotChartHoverSync({
  hoverArea,
  mainChart,
  tempChart,
  hideExternalTooltip,
  clearAllHoverRef,
  isReplayingRef,
  isExportingRef,
  onHoverXChange,
  disableDirectHoverOnMobile = false,
}) {
  if (!hoverArea || !mainChart || !tempChart) return () => {};

  const clearAllHover = () => {
    clearTooltipState(mainChart);
    clearTooltipState(tempChart);
    hideExternalTooltip();
    onHoverXChange?.(null);
  };
  const isDirectMobileHoverDisabled = () =>
    disableDirectHoverOnMobile &&
    Boolean(globalThis.window?.matchMedia?.('(max-width: 640px)').matches);
  clearAllHoverRef.current = clearAllHover;
  /** @type {number | null} */
  let activeTouchPointerId = null;
  let touchHoverActive = false;

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @param {{ isTouch?: boolean, keepHoverOnMiss?: boolean }} [options]
   */
  const applyUnifiedHoverFromClientPoint = (clientX, clientY, options = {}) => {
    if (isReplayingRef.current) {
      clearAllHover();
      return;
    }
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

    const chartRects = getChartClientRects(mainChart, tempChart);
    if (!chartRects) return;

    const { mainXScale, mainRect, tempRect } = chartRects;
    if (!isClientYInChartHoverRange(clientY, mainRect, tempRect, options.isTouch)) {
      if (!options.keepHoverOnMiss) clearAllHover();
      return;
    }

    const xValue = getHoverXValueForClientX(mainChart, mainXScale, mainRect, clientX);
    if (!Number.isFinite(xValue)) {
      clearAllHover();
      return;
    }

    applyShotChartHoverAtX({
      mainChart,
      tempChart,
      xValue,
      pointerClientY: clientY,
      tooltipSource: getTooltipSourceForClientY(tempRect, clientY),
      onHoverXChange,
    });
  };

  /** @param {HoverEvent} event */
  const handleUnifiedMove = event => {
    if (isReplayingRef.current || isExportingRef.current) {
      clearAllHover();
      return;
    }

    if (isDirectMobileHoverDisabled()) {
      return;
    }

    const point = extractClientPoint(event);
    if (!point) return;

    const isTouch =
      /** @type {PointerEvent} */ (event)?.pointerType === 'touch' ||
      event?.type?.startsWith('touch');
    if (isTouch) {
      return;
    }

    applyUnifiedHoverFromClientPoint(point.clientX, point.clientY, {
      isTouch,
      keepHoverOnMiss: isTouch,
    });
  };

  /** @param {PointerEvent} event */
  const handlePointerEnd = event => {
    if (isDirectMobileHoverDisabled()) return;
    if (event?.pointerType === 'touch') {
      activeTouchPointerId = null;
      touchHoverActive = false;
    }
    clearAllHover();
  };

  /** @param {PointerEvent} event */
  const handlePointerDown = event => {
    if (isDirectMobileHoverDisabled()) return;
    if (event?.pointerType === 'touch') {
      activeTouchPointerId = event.pointerId;
      touchHoverActive = false;
      clearAllHover();
      return;
    }
    handleUnifiedMove(event);
  };

  /** @param {PointerEvent} event */
  const handlePointerLeave = event => {
    if (event?.pointerType === 'touch' || activeTouchPointerId != null || touchHoverActive) return;
    clearAllHover();
  };

  /** @param {PointerEvent} event */
  const handlePointerCancel = event => {
    if (isDirectMobileHoverDisabled()) return;
    if (event?.pointerType === 'touch') {
      activeTouchPointerId = null;
      touchHoverActive = false;
      return;
    }
    clearAllHover();
  };

  /** @param {TouchEvent} event */
  const handleTouchStart = event => {
    if (isReplayingRef.current || isExportingRef.current) {
      clearAllHover();
      return;
    }

    if (isDirectMobileHoverDisabled()) {
      return;
    }

    const point = extractClientPoint(event);
    if (!point) return;

    touchHoverActive = true;
    applyUnifiedHoverFromClientPoint(point.clientX, point.clientY, {
      isTouch: true,
      keepHoverOnMiss: true,
    });
  };

  /** @param {TouchEvent} event */
  const handleTouchMove = event => {
    if (!touchHoverActive) return;
    const point = extractClientPoint(event);
    if (!point) return;

    applyUnifiedHoverFromClientPoint(point.clientX, point.clientY, {
      isTouch: true,
      keepHoverOnMiss: true,
    });
  };

  const handleTouchEnd = () => {
    if (isDirectMobileHoverDisabled()) return;
    activeTouchPointerId = null;
    touchHoverActive = false;
    clearAllHover();
  };

  const supportsPointerEvents = Boolean(globalThis.window?.PointerEvent);
  if (supportsPointerEvents) {
    hoverArea.addEventListener('pointerdown', handlePointerDown, { passive: true });
    hoverArea.addEventListener('pointermove', handleUnifiedMove, { passive: true });
    hoverArea.addEventListener('pointerup', handlePointerEnd);
    hoverArea.addEventListener('pointerleave', handlePointerLeave);
    hoverArea.addEventListener('pointercancel', handlePointerCancel);
  } else {
    hoverArea.addEventListener('mousemove', handleUnifiedMove);
    hoverArea.addEventListener('mouseleave', clearAllHover);
  }
  hoverArea.addEventListener('touchstart', handleTouchStart, { passive: true });
  hoverArea.addEventListener('touchmove', handleTouchMove, { passive: true });
  hoverArea.addEventListener('touchend', handleTouchEnd);
  document.addEventListener('touchend', handleTouchEnd);

  return () => {
    clearAllHoverRef.current = () => {};
    if (supportsPointerEvents) {
      hoverArea.removeEventListener('pointerdown', handlePointerDown);
      hoverArea.removeEventListener('pointermove', handleUnifiedMove);
      hoverArea.removeEventListener('pointerup', handlePointerEnd);
      hoverArea.removeEventListener('pointerleave', handlePointerLeave);
      hoverArea.removeEventListener('pointercancel', handlePointerCancel);
    } else {
      hoverArea.removeEventListener('mousemove', handleUnifiedMove);
      hoverArea.removeEventListener('mouseleave', clearAllHover);
    }
    hoverArea.removeEventListener('touchstart', handleTouchStart);
    hoverArea.removeEventListener('touchmove', handleTouchMove);
    hoverArea.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchend', handleTouchEnd);
  };
}
