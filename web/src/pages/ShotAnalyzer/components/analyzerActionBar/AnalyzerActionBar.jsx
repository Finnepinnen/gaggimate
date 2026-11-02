/** Coordinates analyzer navigation, import actions, status hints, and loading state. */

import { useCallback, useEffect, useRef } from 'preact/hooks';
import { getShotNotesKey } from '../useShotNotesState';
import {
  ActionBarCompareButton,
  ActionBarImportActions,
  ActionBarNavigationButtons,
  ActionBarStatisticsAction,
} from './ActionBarButtons';
import { ModeHintPortal, useAnalyzerActionBarModeHint } from './ActionBarModeHint';
import { MobileStatusActionsMenu } from './MobileStatusActionsMenu';
import {
  getAnalyzerActionBarDisplayState,
  getAnalyzerActionBarNavigationState,
  isTypingTarget,
} from './actionBarState';
import { useAnalyzerActionBarLoadIndicator } from './useActionBarLoadIndicator';

/** @typedef {import('../types').LibraryItem} LibraryItem */
/** @typedef {import('../types').ImportMode} ImportMode */

/**
 * @typedef {object} AnalyzerActionBarProps
 * @property {LibraryItem | null} [currentShot]
 * @property {LibraryItem | null} [selectedShot]
 * @property {LibraryItem[]} [shotList]
 * @property {(request: import('../types').LibraryShotSelectRequest) => void} [onNavigate]
 * @property {() => void} [onCompareModeToggle]
 * @property {boolean} [compareAvailable]
 * @property {boolean} [compareMode]
 * @property {boolean} [showCompareButton]
 * @property {() => void} [onShowStats]
 * @property {string} [statsHref]
 * @property {boolean} [statisticsAvailable]
 * @property {(files: File[]) => void} [onImport]
 * @property {boolean} [isImporting]
 * @property {ImportMode} [importMode]
 * @property {(mode: ImportMode) => void} [onImportModeChange]
 * @property {boolean} [isSelectionPending]
 * @property {boolean} [isProfilePending]
 * @property {boolean} [showImportModeToggle]
 * @property {boolean} [enableKeyboardNavigation]
 */

/** @param {AnalyzerActionBarProps} props */
export function AnalyzerActionBar({
  currentShot,
  selectedShot = null,
  shotList = [],
  onNavigate,
  onCompareModeToggle,
  compareAvailable = false,
  compareMode = false,
  showCompareButton = true,
  onShowStats,
  statsHref = '/statistics',
  statisticsAvailable = true,
  onImport,
  isImporting = false,
  importMode = 'temp',
  onImportModeChange,
  isSelectionPending = false,
  isProfilePending = false,
  showImportModeToggle = true,
  enableKeyboardNavigation = true,
}) {
  /** @type {import('preact').RefObject<HTMLInputElement>} */
  const fileInputRef = useRef(null);
  const {
    modeButtonRef,
    modeHint,
    modeHintVariant,
    modeHintPosition,
    modeHintBadgeStyle,
    handleModeToggle,
  } = useAnalyzerActionBarModeHint({
    importMode,
    onImportModeChange,
  });

  const { displayShot, hasDisplayShot } = getAnalyzerActionBarDisplayState({
    currentShot,
    selectedShot,
  });
  const { loadIndicatorVisible, loadIndicatorWidth } = useAnalyzerActionBarLoadIndicator({
    isSelectionPending,
    isProfilePending,
  });

  const handleNavigateToIndex = useCallback(
    /**
     * @param {number} targetIndex
     * @param {number} direction
     */
    (targetIndex, direction) => {
      if (targetIndex < 0 || targetIndex >= shotList.length) return;
      onNavigate?.({
        item: shotList[targetIndex],
        direction,
        listSnapshot: shotList,
        targetIndex,
        debounceMs: 0,
      });
    },
    [onNavigate, shotList],
  );

  // Navigation
  const { currentIndex, canGoPrev, canGoNext } = getAnalyzerActionBarNavigationState({
    hasShot: hasDisplayShot,
    shotList,
    activeShot: displayShot,
    getShotNotesKey,
  });

  // Keyboard navigation: ArrowLeft / ArrowRight
  useEffect(() => {
    if (!displayShot || !enableKeyboardNavigation) return;

    /** @param {KeyboardEvent} e */
    const handleKeyDown = e => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === 'ArrowLeft' && canGoPrev) {
        e.preventDefault();
        handleNavigateToIndex(currentIndex - 1, -1);
      } else if (e.key === 'ArrowRight' && canGoNext) {
        e.preventDefault();
        handleNavigateToIndex(currentIndex + 1, 1);
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [
    displayShot,
    canGoPrev,
    canGoNext,
    currentIndex,
    handleNavigateToIndex,
    enableKeyboardNavigation,
  ]);

  const borderClasses = 'border-base-content/5 border-t';

  /** @param {Event} event */
  const handleImportClick = event => {
    event.preventDefault();
    event.stopPropagation();
    if (isImporting) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  /** @param {import('preact').JSX.TargetedEvent<HTMLInputElement, Event>} event */
  const handleFileSelect = event => {
    const input = /** @type {HTMLInputElement} */ (event.target);
    const files = Array.from(input.files || []);
    if (files.length > 0) {
      onImport?.(files);
      input.value = '';
    }
  };

  return (
    <div>
      <div className={`overflow-hidden transition-all duration-200 ${borderClasses}`}>
        <div className='shot-analyzer-action-scroll shot-analyzer-status-actions flex w-full items-center gap-1.5 overflow-x-auto overflow-y-hidden px-1.5 py-1 sm:px-2'>
          <ActionBarNavigationButtons
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            currentIndex={currentIndex}
            onNavigateToIndex={handleNavigateToIndex}
          />

          {showCompareButton ? (
            <ActionBarCompareButton
              compareAvailable={compareAvailable}
              compareMode={compareMode}
              onCompareModeToggle={onCompareModeToggle}
            />
          ) : null}

          <ActionBarStatisticsAction
            compareMode={compareMode}
            statisticsAvailable={statisticsAvailable}
            statsHref={statsHref}
            onShowStats={onShowStats}
          />

          <MobileStatusActionsMenu
            handleImportClick={handleImportClick}
            handleModeToggle={handleModeToggle}
            importMode={importMode}
            isImporting={isImporting}
            showImportModeToggle={showImportModeToggle}
          />

          <ActionBarImportActions
            handleImportClick={handleImportClick}
            handleModeToggle={handleModeToggle}
            importMode={importMode}
            isImporting={isImporting}
            modeButtonRef={modeButtonRef}
            showImportModeToggle={showImportModeToggle}
          />

          <input
            ref={fileInputRef}
            type='file'
            multiple
            accept='.slog,.json'
            onChange={handleFileSelect}
            className='hidden'
            disabled={isImporting}
          />
        </div>

        {loadIndicatorVisible && (
          <div className='bg-primary/15 h-0.5 w-full overflow-hidden'>
            <div
              className='bg-primary h-full rounded-full transition-[width] duration-200 ease-out'
              style={{ width: loadIndicatorWidth }}
            />
          </div>
        )}
      </div>

      <ModeHintPortal
        modeHint={modeHint}
        modeHintBadgeStyle={modeHintBadgeStyle}
        modeHintPosition={modeHintPosition}
        modeHintVariant={modeHintVariant}
      />
    </div>
  );
}
