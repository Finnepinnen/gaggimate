import { MAIN_CHART_HEIGHT_DEFAULT, TEMP_CHART_HEIGHT_RATIO } from '../constants';

const MOBILE_CHART_STACK_GAP = 12;
const MOBILE_SCRUBBER_HEIGHT_FALLBACK = 48;
const MOBILE_COLLAPSED_LEGEND_HEIGHT_FALLBACK = 32;

/** @typedef {import('chart.js').Chart} Chart */
/** @typedef {import('../tooltip/tooltipState').ExternalTooltipState} ExternalTooltipState */
/** @typedef {import('preact/hooks').Dispatch<import('preact/hooks').StateUpdater<number>>} SetViewportResizeNonce */
/** @typedef {{ frameId: number, timeoutIds: number[] }} ViewportResizeHandles */

/** @returns {Window | undefined} */
export function getBrowserWindow() {
  return globalThis.window;
}

export function isSmartphoneViewport(browserWindow = getBrowserWindow()) {
  if (typeof browserWindow?.matchMedia === 'function') {
    return browserWindow.matchMedia('(max-width: 640px)').matches;
  }
  return Number(browserWindow?.innerWidth) <= 640;
}

/** @param {SetViewportResizeNonce} setViewportResizeNonce */
function bumpViewportResizeNonce(setViewportResizeNonce) {
  setViewportResizeNonce(n => n + 1);
}

/**
 * @param {Window} browserWindow
 * @param {SetViewportResizeNonce} setViewportResizeNonce
 * @param {ViewportResizeHandles} handles
 * @param {number[]} delays
 */
export function scheduleViewportResizeBumps(
  browserWindow,
  setViewportResizeNonce,
  handles,
  delays,
) {
  handles.frameId = browserWindow.requestAnimationFrame(() =>
    bumpViewportResizeNonce(setViewportResizeNonce),
  );
  handles.timeoutIds = delays.map(delay =>
    browserWindow.setTimeout(() => bumpViewportResizeNonce(setViewportResizeNonce), delay),
  );
}

/**
 * @param {Window} browserWindow
 * @param {ViewportResizeHandles} handles
 */
export function clearViewportResizeBumps(browserWindow, handles) {
  browserWindow.cancelAnimationFrame(handles.frameId);
  for (const timeoutId of handles.timeoutIds || []) {
    browserWindow.clearTimeout(timeoutId);
  }
  handles.frameId = 0;
  handles.timeoutIds = [];
}

/** @param {Element | null | undefined} element */
function getElementHeight(element) {
  return element?.getBoundingClientRect().height || 0;
}

/**
 * @param {{
 *   hasExternalDesktopCardHeight: boolean,
 *   isSmartphone: boolean,
 *   shellHeight: number,
 *   shellTop: number,
 *   viewportHeight: number,
 * }} options
 */
function getAvailableShellHeight({
  hasExternalDesktopCardHeight,
  isSmartphone,
  shellHeight,
  shellTop,
  viewportHeight,
}) {
  if (isSmartphone && shellHeight > 0) {
    return shellHeight;
  }
  if (hasExternalDesktopCardHeight && shellHeight > 0) {
    return shellHeight;
  }
  return viewportHeight - shellTop - 24;
}

/**
 * @param {{
 *   browserWindow: Window | undefined,
 *   desktopCardHeight: number | string,
 *   desktopLegendElement: Element | null,
 *   externalTooltipElement: Element | null,
 *   mobileActionsElement: Element | null,
 *   mobileLegendElement: Element | null,
 *   mobileScrubberElement: Element | null,
 *   scrubberMax: number,
 *   shellElement: Element | null,
 *   useStaticTooltip: boolean,
 * }} options
 * @returns {number}
 */
export function getAvailableCombinedChartHeight({
  browserWindow,
  desktopCardHeight,
  desktopLegendElement,
  externalTooltipElement,
  mobileActionsElement,
  mobileLegendElement,
  mobileScrubberElement,
  scrubberMax,
  shellElement,
  useStaticTooltip,
}) {
  if (!shellElement || !browserWindow) return 0;

  const shellRect = shellElement.getBoundingClientRect();
  const shellTop = shellRect.top || 0;
  const shellHeight = shellRect.height || 0;
  const viewportHeight = browserWindow.visualViewport?.height || browserWindow.innerHeight || 0;
  const smartphoneViewport = isSmartphoneViewport(browserWindow);
  const numericDesktopCardHeight = Number(desktopCardHeight);
  const hasExternalDesktopCardHeight =
    smartphoneViewport === false &&
    Number.isFinite(numericDesktopCardHeight) &&
    numericDesktopCardHeight > 0;
  const staticTooltipHeight = useStaticTooltip ? getElementHeight(externalTooltipElement) : 0;
  const measuredMobileScrubberHeight = useStaticTooltip
    ? getElementHeight(mobileScrubberElement)
    : 0;
  const mobileScrubberHeight =
    useStaticTooltip && scrubberMax > 0
      ? Math.max(measuredMobileScrubberHeight, MOBILE_SCRUBBER_HEIGHT_FALLBACK)
      : measuredMobileScrubberHeight;
  const measuredMobileLegendHeight = getElementHeight(mobileLegendElement);
  const mobileLegendHeight = smartphoneViewport
    ? Math.max(measuredMobileLegendHeight, MOBILE_COLLAPSED_LEGEND_HEIGHT_FALLBACK)
    : measuredMobileLegendHeight;
  const mobileActionsHeight = useStaticTooltip ? getElementHeight(mobileActionsElement) : 0;
  const desktopLegendHeight = getElementHeight(desktopLegendElement);
  const availableShellHeight = getAvailableShellHeight({
    hasExternalDesktopCardHeight,
    isSmartphone: smartphoneViewport,
    shellHeight,
    shellTop,
    viewportHeight,
  });
  const chartStackGap =
    smartphoneViewport || hasExternalDesktopCardHeight ? MOBILE_CHART_STACK_GAP : 0;

  return Math.max(
    0,
    availableShellHeight -
      staticTooltipHeight -
      mobileScrubberHeight -
      mobileLegendHeight -
      mobileActionsHeight -
      desktopLegendHeight -
      chartStackGap,
  );
}

/**
 * @param {Chart} chart
 * @returns {number | undefined}
 */
export function getChartPointerClientY(chart) {
  const chartRect = chart.canvas?.getBoundingClientRect?.();
  if (!chartRect) return undefined;

  const chartAreaTop = Number(chart.chartArea?.top) || 0;
  const chartAreaHeight = Number(chart.chartArea?.bottom) - Number(chart.chartArea?.top);
  const midpointOffset =
    Number.isFinite(chartAreaHeight) && chartAreaHeight > 0 ? chartAreaHeight / 2 : 0;
  return chartRect.top + chartAreaTop + midpointOffset;
}

/**
 * @param {number} containerWidth
 * @param {number} [availableCombinedHeight]
 * @param {boolean} [fillAvailableDesktopHeight]
 * @returns {number}
 */
export function getStandardMainChartHeight(
  containerWidth,
  availableCombinedHeight = 0,
  fillAvailableDesktopHeight = false,
) {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return MAIN_CHART_HEIGHT_DEFAULT;
  const measuredCombinedHeight = Number(availableCombinedHeight);
  const isDesktop = browserWindow.innerWidth >= 1024;
  if (isDesktop) {
    const vh = browserWindow.innerHeight;
    if (!Number.isFinite(vh) || vh <= 0) return MAIN_CHART_HEIGHT_DEFAULT;
    const combinedChartHeight = vh * (3 / 5);
    const preferredMainHeight = Math.round(combinedChartHeight / (1 + TEMP_CHART_HEIGHT_RATIO));
    if (
      fillAvailableDesktopHeight &&
      Number.isFinite(measuredCombinedHeight) &&
      measuredCombinedHeight > 0
    ) {
      const availableMainHeight = Math.round(
        measuredCombinedHeight / (1 + TEMP_CHART_HEIGHT_RATIO),
      );
      return Math.max(120, availableMainHeight);
    }
    return preferredMainHeight;
  }
  const numericWidth = Number(containerWidth);
  if (!Number.isFinite(numericWidth) || numericWidth <= 0) return MAIN_CHART_HEIGHT_DEFAULT;
  const preferredCombinedHeight = numericWidth;
  const isSmartphone = browserWindow.innerWidth <= 640;
  if (isSmartphone && Number.isFinite(measuredCombinedHeight) && measuredCombinedHeight > 0) {
    const availableMainHeight = measuredCombinedHeight / (1 + TEMP_CHART_HEIGHT_RATIO);
    return Math.round(Math.max(120, availableMainHeight));
  }
  const combinedChartHeight =
    Number.isFinite(measuredCombinedHeight) && measuredCombinedHeight > 0
      ? Math.min(preferredCombinedHeight, measuredCombinedHeight)
      : preferredCombinedHeight;
  const compactMinimumMainHeight =
    Number.isFinite(measuredCombinedHeight) && measuredCombinedHeight > 0
      ? Math.min(
          MAIN_CHART_HEIGHT_DEFAULT,
          Math.max(180, measuredCombinedHeight / (1 + TEMP_CHART_HEIGHT_RATIO)),
        )
      : MAIN_CHART_HEIGHT_DEFAULT;
  const minimumCombinedHeight = compactMinimumMainHeight * (1 + TEMP_CHART_HEIGHT_RATIO);
  return Math.round(
    Math.max(minimumCombinedHeight, combinedChartHeight) / (1 + TEMP_CHART_HEIGHT_RATIO),
  );
}

/**
 * @param {{
 *   tooltipState: ExternalTooltipState,
 *   sourceChart: Chart,
 *   tempChart: Chart | null,
 *   hoverAreaElement: Element | null,
 *   mainChartElement: Element | null,
 *   tempChartElement: Element | null,
 * }} options
 * @returns {ExternalTooltipState}
 */
export function getSurfaceExternalTooltipState({
  tooltipState,
  sourceChart,
  tempChart,
  hoverAreaElement,
  mainChartElement,
  tempChartElement,
}) {
  if (!tooltipState?.visible || !hoverAreaElement || !mainChartElement || !sourceChart?.chartArea) {
    return tooltipState;
  }

  const hoverAreaRect = hoverAreaElement.getBoundingClientRect();
  const mainRect = mainChartElement.getBoundingClientRect();
  const mainOffsetLeft = mainRect.left - hoverAreaRect.left;
  const mainOffsetTop = mainRect.top - hoverAreaRect.top;
  const chartAreaLeft = mainOffsetLeft + tooltipState.chartAreaLeft;
  const chartAreaRight = mainOffsetLeft + tooltipState.chartAreaRight;
  const chartAreaTop = mainOffsetTop + tooltipState.chartAreaTop;
  const chartAreaBottom = mainOffsetTop + tooltipState.chartAreaBottom;
  const tempRect =
    tempChart?.chartArea && tempChartElement ? tempChartElement.getBoundingClientRect() : null;
  const pointerClientY = Number(sourceChart.$externalTooltipClientY);
  const minClientY = mainRect.top + tooltipState.chartAreaTop;
  const maxClientY = tempRect
    ? tempRect.top + tempChart.chartArea.bottom
    : mainRect.top + tooltipState.chartAreaBottom;
  const fallbackClientY = mainRect.top + tooltipState.anchorY;
  const clampedClientY = Math.min(
    maxClientY,
    Math.max(minClientY, Number.isFinite(pointerClientY) ? pointerClientY : fallbackClientY),
  );

  return {
    ...tooltipState,
    anchorX: mainOffsetLeft + tooltipState.anchorX,
    anchorY: clampedClientY - hoverAreaRect.top,
    chartWidth: hoverAreaRect.width,
    chartHeight: hoverAreaRect.height,
    chartAreaLeft,
    chartAreaRight,
    chartAreaTop,
    chartAreaBottom,
    tooltipBoundsLeft: chartAreaLeft,
    tooltipBoundsRight: chartAreaRight,
    tooltipBoundsTop: 0,
    tooltipBoundsBottom: hoverAreaRect.height,
  };
}

/**
 * @param {{
 *   externalTooltipState: ExternalTooltipState,
 *   hasActiveScrubValue: boolean,
 *   hoverAreaElement: Element | null,
 *   mainChartElement: Element | null,
 *   mobileScrubberElement: Element | null,
 *   tempChart: Chart | null,
 *   tempChartElement: Element | null,
 *   useStaticTooltip: boolean,
 * }} options
 * @returns {{ display: 'none' | 'block', left?: string, top?: string, height?: string }}
 */
export function getHoverGuideConnectorStyle({
  externalTooltipState,
  hasActiveScrubValue,
  hoverAreaElement,
  mainChartElement,
  mobileScrubberElement,
  tempChart,
  tempChartElement,
  useStaticTooltip,
}) {
  if (!externalTooltipState.visible) return { display: 'none' };
  if (!hoverAreaElement || !mainChartElement || !tempChartElement || !tempChart?.chartArea) {
    return { display: 'none' };
  }

  const hoverAreaRect = hoverAreaElement.getBoundingClientRect();
  const tempRect = tempChartElement.getBoundingClientRect();
  const guideOverflow = 6;
  const top = (Number(externalTooltipState.chartAreaTop) || 0) - guideOverflow;
  const bottom =
    useStaticTooltip && hasActiveScrubValue && mobileScrubberElement
      ? mobileScrubberElement.getBoundingClientRect().bottom - hoverAreaRect.top
      : tempRect.top - hoverAreaRect.top + tempChart.chartArea.bottom + guideOverflow;

  return {
    display: 'block',
    left: `${externalTooltipState.anchorX}px`,
    top: `${Math.max(0, top)}px`,
    height: `${Math.max(0, bottom - top)}px`,
  };
}
