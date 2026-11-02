import { useEffect, useState } from 'preact/hooks';

/** @type {import('preact').JSX.CSSProperties} */
export const ANALYSIS_SCROLLBAR_HIDE_STYLE = {
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

/**
 * @param {boolean} isTouchOptimized
 * @returns {import('preact').JSX.CSSProperties}
 */
export function getAnalysisTouchInteractionStyle(isTouchOptimized) {
  if (!isTouchOptimized) {
    return { touchAction: 'pan-y' };
  }

  return {
    touchAction: 'pan-x pan-y pinch-zoom',
    WebkitOverflowScrolling: 'touch',
    overscrollBehaviorX: 'contain',
  };
}

/** @typedef {import('preact').RefObject<HTMLElement>} TableContainerRef */

/**
 * @param {TableContainerRef} ref
 * @param {number} amount px
 */
export function scrollAnalysisTable(ref, amount) {
  ref.current?.scrollBy({ left: amount, behavior: 'smooth' });
}

/**
 * @param {TableContainerRef} ref
 * @param {'start' | 'end'} direction
 */
export function scrollAnalysisTableToBound(ref, direction) {
  const tableElement = ref.current;
  if (!tableElement) return;
  const left = direction === 'start' ? 0 : tableElement.scrollWidth;
  tableElement.scrollTo({ left, behavior: 'smooth' });
}

/** @param {TableContainerRef} tableContainerRef */
export function useVerticalWheelForwarding(tableContainerRef) {
  useEffect(() => {
    const tableElement = tableContainerRef.current;
    if (!tableElement) return undefined;

    /** @param {WheelEvent} event */
    const handleWheel = event => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      globalThis.window?.scrollBy({
        top: event.deltaY,
        left: 0,
        behavior: 'auto',
      });
    };

    tableElement.addEventListener('wheel', handleWheel, { passive: true });
    return () => tableElement.removeEventListener('wheel', handleWheel);
  }, [tableContainerRef]);
}

export function useTouchOptimizedPointer() {
  const [isTouchOptimized, setIsTouchOptimized] = useState(false);

  useEffect(() => {
    const browserWindow = globalThis.window;
    if (!browserWindow) return undefined;

    const mediaQuery = browserWindow.matchMedia?.('(any-pointer: coarse)') || null;
    const updateTouchOptimization = () => {
      const hasCoarsePointer = Boolean(mediaQuery?.matches);
      const hasTouchPoints = Number(browserWindow.navigator?.maxTouchPoints || 0) > 0;
      setIsTouchOptimized(hasCoarsePointer || hasTouchPoints);
    };

    updateTouchOptimization();
    if (mediaQuery === null) return undefined;

    mediaQuery.addEventListener?.('change', updateTouchOptimization);
    return () => mediaQuery.removeEventListener?.('change', updateTouchOptimization);
  }, []);

  return isTouchOptimized;
}
