import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

/**
 * @param {object} state
 * @param {boolean} state.isSelectionPending
 * @param {boolean} state.isProfilePending
 */
function getLoadIndicatorTargetProgress({ isSelectionPending, isProfilePending }) {
  if (isSelectionPending) return 0.36;
  if (isProfilePending) return 0.78;
  return 1;
}

/**
 * @param {boolean} loadIndicatorVisible
 * @param {number} loadIndicatorProgress 0..1
 */
function getLoadIndicatorWidth(loadIndicatorVisible, loadIndicatorProgress) {
  if (!loadIndicatorVisible) return '0%';
  return `${Math.min(100, Math.max(loadIndicatorProgress * 100, 8))}%`;
}

/**
 * @param {object} state
 * @param {boolean} state.isSelectionPending
 * @param {boolean} state.isProfilePending
 */
export function useAnalyzerActionBarLoadIndicator({ isSelectionPending, isProfilePending }) {
  /** @type {import('preact/hooks').MutableRef<ReturnType<typeof setTimeout> | null>} */
  const loadIndicatorHideTimerRef = useRef(null);
  const [loadIndicatorVisible, setLoadIndicatorVisible] = useState(false);
  const [loadIndicatorProgress, setLoadIndicatorProgress] = useState(0);

  const clearLoadIndicatorHideTimer = useCallback(() => {
    if (loadIndicatorHideTimerRef.current) {
      globalThis.clearTimeout(loadIndicatorHideTimerRef.current);
      loadIndicatorHideTimerRef.current = null;
    }
  }, []);

  const isCombinedLoadActive = isSelectionPending || isProfilePending;
  const loadIndicatorTargetProgress = getLoadIndicatorTargetProgress({
    isSelectionPending,
    isProfilePending,
  });

  useEffect(() => {
    clearLoadIndicatorHideTimer();

    if (isCombinedLoadActive) {
      setLoadIndicatorVisible(true);
      setLoadIndicatorProgress(loadIndicatorTargetProgress);
      return undefined;
    }

    if (!loadIndicatorVisible) {
      setLoadIndicatorProgress(0);
      return undefined;
    }

    setLoadIndicatorProgress(1);
    loadIndicatorHideTimerRef.current = globalThis.setTimeout(() => {
      setLoadIndicatorVisible(false);
      setLoadIndicatorProgress(0);
      loadIndicatorHideTimerRef.current = null;
    }, 220);

    return clearLoadIndicatorHideTimer;
  }, [
    clearLoadIndicatorHideTimer,
    isCombinedLoadActive,
    loadIndicatorTargetProgress,
    loadIndicatorVisible,
  ]);

  useEffect(() => clearLoadIndicatorHideTimer, [clearLoadIndicatorHideTimer]);

  return {
    loadIndicatorVisible,
    loadIndicatorWidth: getLoadIndicatorWidth(loadIndicatorVisible, loadIndicatorProgress),
  };
}
