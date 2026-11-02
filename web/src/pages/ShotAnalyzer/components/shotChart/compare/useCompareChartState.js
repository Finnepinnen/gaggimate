import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { ANALYZER_DB_KEYS, loadFromStorage, saveToStorage } from '../../../utils/analyzerUtils';
import { COMPARE_ALIGNMENT_SHOT_START, COMPARE_LEGEND_KEY_BY_LABEL } from './compareConstants';
import {
  getCompareEntryKey,
  getCompareMobileLayoutState,
  normalizeCompareVisibility,
} from './compareModel';

/** @typedef {import('./types').ShotStylePreset} ShotStylePreset */
/** @typedef {import('preact/hooks').Dispatch<import('preact/hooks').StateUpdater<string>>} SetCompareAlignmentMode */

/**
 * @param {{
 *   enableDualMainChartAnnotations: boolean,
 *   showBrewModeAnnotation: boolean,
 *   showPhaseAnnotations: boolean,
 *   showStopAnnotations: boolean,
 *   shotStylePreset: ShotStylePreset,
 * }} params
 */
export function useCompareVisibilityState({
  enableDualMainChartAnnotations,
  showBrewModeAnnotation,
  showPhaseAnnotations,
  showStopAnnotations,
  shotStylePreset,
}) {
  const shouldPersistCompareVisibility =
    shotStylePreset === 'analyzer' && enableDualMainChartAnnotations;
  const [visibility, setVisibility] = useState(() =>
    normalizeCompareVisibility(
      shouldPersistCompareVisibility
        ? loadFromStorage(ANALYZER_DB_KEYS.COMPARE_CHART_VISIBILITY)
        : null,
      { showPhaseAnnotations, showStopAnnotations, showBrewModeAnnotation },
    ),
  );

  useEffect(() => {
    if (!shouldPersistCompareVisibility) return;
    saveToStorage(ANALYZER_DB_KEYS.COMPARE_CHART_VISIBILITY, visibility);
  }, [shouldPersistCompareVisibility, visibility]);

  return { setVisibility, visibility };
}

export function useInitialCompareAlignmentState() {
  return useState(() => /** @type {string} */ (COMPARE_ALIGNMENT_SHOT_START));
}

/**
 * @param {{
 *   compareAlignmentMode: string,
 *   resolvedCompareAlignmentMode: string,
 *   setCompareAlignmentMode: SetCompareAlignmentMode,
 *   shotStylePreset: ShotStylePreset,
 * }} params
 */
export function useResolvedCompareAlignmentState({
  compareAlignmentMode,
  resolvedCompareAlignmentMode,
  setCompareAlignmentMode,
  shotStylePreset,
}) {
  useEffect(() => {
    if (shotStylePreset !== 'analyzer') return;
    if (resolvedCompareAlignmentMode === compareAlignmentMode) return;
    setCompareAlignmentMode(resolvedCompareAlignmentMode);
  }, [
    compareAlignmentMode,
    resolvedCompareAlignmentMode,
    setCompareAlignmentMode,
    shotStylePreset,
  ]);
}

/**
 * @param {{
 *   compareEntries: import('./types').CompareEntry[],
 *   setCompareAlignmentMode: SetCompareAlignmentMode,
 *   shotStylePreset: ShotStylePreset,
 * }} params
 */
export function useResetAnalyzerCompareAlignmentOnSecondaryShotChange({
  compareEntries,
  setCompareAlignmentMode,
  shotStylePreset,
}) {
  const secondaryShotKey = getCompareEntryKey(compareEntries?.[1], 1);

  useLayoutEffect(() => {
    if (shotStylePreset !== 'analyzer') return;
    setCompareAlignmentMode(COMPARE_ALIGNMENT_SHOT_START);
  }, [secondaryShotKey, setCompareAlignmentMode, shotStylePreset]);
}

/**
 * @param {{
 *   isFullDisplay: boolean,
 *   mainChartCardRef: import('preact').RefObject<HTMLElement>,
 *   shotStylePreset: ShotStylePreset,
 * }} params
 */
export function useCompareViewportState({ isFullDisplay, mainChartCardRef, shotStylePreset }) {
  const [viewportResizeNonce, setViewportResizeNonce] = useState(0);
  const [standardChartWidth, setStandardChartWidth] = useState(0);
  const [isMobileCompareLayout, setIsMobileCompareLayout] = useState(getCompareMobileLayoutState);

  useEffect(() => {
    const handleResize = () => setViewportResizeNonce(n => n + 1);
    globalThis.window?.addEventListener('resize', handleResize);
    return () => globalThis.window?.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (globalThis.window?.matchMedia === undefined) {
      return undefined;
    }

    const mediaQuery = globalThis.window.matchMedia('(max-width: 640px)');
    /** @param {MediaQueryListEvent} event */
    const handleChange = event => setIsMobileCompareLayout(event.matches);
    setIsMobileCompareLayout(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    if (shotStylePreset !== 'analyzer') return undefined;

    const targetElement = mainChartCardRef.current;
    if (!targetElement) return undefined;

    const updateWidth = () => {
      setStandardChartWidth(Math.round(targetElement.getBoundingClientRect().width || 0));
    };
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      const nextWidth = entry?.contentRect?.width ?? targetElement.getBoundingClientRect().width;
      setStandardChartWidth(Math.round(nextWidth || 0));
    });

    updateWidth();
    resizeObserver.observe(targetElement);

    return () => resizeObserver.disconnect();
  }, [isFullDisplay, mainChartCardRef, shotStylePreset, viewportResizeNonce]);

  return { isMobileCompareLayout, standardChartWidth };
}

/**
 * @param {{
 *   hasWeightData: boolean,
 *   hasWeightFlowData: boolean,
 *   setVisibility: import('./types').SetVisibility,
 * }} params
 * @returns {import('./types').LegendToggleHandler}
 */
export function getCompareLegendToggleHandler({ hasWeightData, hasWeightFlowData, setVisibility }) {
  return label => {
    const key = COMPARE_LEGEND_KEY_BY_LABEL[label];

    if (!key) return;
    if (label === 'Weight' && !hasWeightData) return;
    if (label === 'Weight Flow' && !hasWeightFlowData) return;
    setVisibility(prevVisibility => ({ ...prevVisibility, [key]: !prevVisibility[key] }));
  };
}
