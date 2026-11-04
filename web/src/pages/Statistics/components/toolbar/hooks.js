// Custom hooks for StatisticsToolbar: keyboard shortcut registration
import { useEffect } from 'preact/hooks';
import { closeOpenToolbarDetails, isToolbarFloatingPanelTarget } from './helpers';

/**
 * @template S
 * @typedef {import('../../types').SetState<S>} SetState
 */
/**
 * @template T
 * @typedef {import('preact').RefObject<T>} RefObject
 */

/**
 * @param {object} args
 * @param {string} args.query
 * @param {number} args.parseErrorsLength
 * @param {number} args.parseWarningsLength
 * @param {boolean} args.showAdvancedSearch
 * @param {SetState<boolean>} args.setShowAdvancedSearch
 * @param {SetState<boolean>} args.setShowDslSelectionPreview
 */
export function useAdvancedSearchSync({
  query,
  parseErrorsLength,
  parseWarningsLength,
  showAdvancedSearch,
  setShowAdvancedSearch,
  setShowDslSelectionPreview,
}) {
  useEffect(() => {
    if (query || parseErrorsLength > 0 || parseWarningsLength > 0) {
      setShowAdvancedSearch(true);
    }
  }, [query, parseErrorsLength, parseWarningsLength, setShowAdvancedSearch]);

  useEffect(() => {
    if (!showAdvancedSearch) {
      setShowDslSelectionPreview(false);
    }
  }, [showAdvancedSearch, setShowDslSelectionPreview]);

  useEffect(() => {
    if (!String(query || '').trim()) {
      setShowDslSelectionPreview(false);
    }
  }, [query, setShowDslSelectionPreview]);
}

/**
 * @param {object} args
 * @param {boolean} args.shouldShowDslSelectionPreview
 * @param {boolean} args.isToolbarExpanded
 * @param {RefObject<HTMLDivElement>} args.dslInputRef
 * @param {SetState<boolean>} args.setShowDslSelectionPreview
 */
export function useDslPreviewOutsideDismiss({
  shouldShowDslSelectionPreview,
  isToolbarExpanded,
  dslInputRef,
  setShowDslSelectionPreview,
}) {
  useEffect(() => {
    if (!shouldShowDslSelectionPreview || !isToolbarExpanded) return;

    /** @param {PointerEvent} event */
    const handlePointerDown = event => {
      const inputNode = dslInputRef.current;
      if (!inputNode) return;
      if (inputNode.contains(/** @type {Node | null} */ (event.target))) return;
      setShowDslSelectionPreview(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [shouldShowDslSelectionPreview, isToolbarExpanded, dslInputRef, setShowDslSelectionPreview]);
}

/**
 * @param {object} args
 * @param {boolean} args.isToolbarExpanded
 * @param {boolean} args.isBusy
 * @param {boolean} args.shouldCollapseToolbar
 * @param {boolean} args.isCollapsedStripExpanded
 * @param {RefObject<HTMLDivElement>} args.toolbarContainerRef
 * @param {SetState<boolean>} args.setShowDslSelectionPreview
 * @param {SetState<boolean>} args.setIsCollapsedStripExpanded
 */
export function useToolbarCollapseBehavior({
  isToolbarExpanded,
  isBusy,
  shouldCollapseToolbar,
  isCollapsedStripExpanded,
  toolbarContainerRef,
  setShowDslSelectionPreview,
  setIsCollapsedStripExpanded,
}) {
  useEffect(() => {
    if (isToolbarExpanded) return;

    setShowDslSelectionPreview(false);
    const toolbarNode = toolbarContainerRef.current;
    if (!toolbarNode) return;

    closeOpenToolbarDetails(toolbarNode);
  }, [isToolbarExpanded, setShowDslSelectionPreview, toolbarContainerRef]);

  useEffect(() => {
    if (!isBusy) return;

    const toolbarNode = toolbarContainerRef.current;
    if (!toolbarNode) return;

    closeOpenToolbarDetails(toolbarNode);
  }, [isBusy, toolbarContainerRef]);

  useEffect(() => {
    if (!shouldCollapseToolbar) {
      setIsCollapsedStripExpanded(false);
    }
  }, [shouldCollapseToolbar, setIsCollapsedStripExpanded]);

  useEffect(() => {
    if (!shouldCollapseToolbar || !isCollapsedStripExpanded) return;

    /** @param {PointerEvent} event */
    const handlePointerDown = event => {
      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;
      if (toolbarNode.contains(/** @type {Node | null} */ (event.target))) return;
      if (isToolbarFloatingPanelTarget(event.target)) return;
      setIsCollapsedStripExpanded(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setIsCollapsedStripExpanded,
  ]);

  useEffect(() => {
    if (!shouldCollapseToolbar || !isCollapsedStripExpanded) return;

    /** @param {KeyboardEvent} event */
    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;

      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;

      const eventTarget = event.target instanceof Element ? event.target : null;
      const activeElement = globalThis.document?.activeElement;
      const isToolbarFocused =
        (eventTarget && toolbarNode.contains(eventTarget)) ||
        isToolbarFloatingPanelTarget(eventTarget) ||
        (activeElement instanceof Element && toolbarNode.contains(activeElement)) ||
        isToolbarFloatingPanelTarget(activeElement);

      if (!isToolbarFocused) return;

      event.preventDefault();
      setIsCollapsedStripExpanded(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setIsCollapsedStripExpanded,
  ]);
}

/**
 * @param {object} args
 * @param {RefObject<HTMLDivElement>} args.toolbarContainerRef
 * @param {boolean} args.isToolbarExpanded
 */
export function useToolbarDropdownBehavior({ toolbarContainerRef, isToolbarExpanded }) {
  useEffect(() => {
    const toolbarNode = toolbarContainerRef.current;
    if (!toolbarNode) return;

    /** @param {MouseEvent} event */
    const handleClick = event => {
      const eventTarget = /** @type {Element} */ (event.target);
      if (eventTarget.closest('[data-statistics-multiselect-trigger]')) {
        closeOpenToolbarDetails(toolbarNode);
        return;
      }

      const summary = eventTarget.closest('summary');
      if (!summary) return;
      const details = /** @type {HTMLDetailsElement | null} */ (summary.parentElement);
      if (details?.tagName !== 'DETAILS') return;
      if (details.open) return;

      /** @type {NodeListOf<HTMLDetailsElement>} */ (
        toolbarNode.querySelectorAll('details[open]')
      ).forEach(detailsNode => {
        if (detailsNode !== details) {
          detailsNode.open = false;
        }
      });
    };

    toolbarNode.addEventListener('click', handleClick);
    return () => {
      toolbarNode.removeEventListener('click', handleClick);
    };
  }, [toolbarContainerRef]);

  useEffect(() => {
    if (!isToolbarExpanded) return;

    /** @param {PointerEvent} event */
    const handlePointerDown = event => {
      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      /** @type {NodeListOf<HTMLDetailsElement>} */ (
        toolbarNode.querySelectorAll('details[data-close-on-outside][open]')
      ).forEach(detailsNode => {
        if (detailsNode.contains(target)) return;
        detailsNode.open = false;
      });
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isToolbarExpanded, toolbarContainerRef]);
}
