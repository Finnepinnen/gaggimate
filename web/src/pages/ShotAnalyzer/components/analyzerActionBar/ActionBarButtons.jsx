import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans, useLingui } from '@lingui/react/macro';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { faChartArea } from '@fortawesome/free-solid-svg-icons/faChartArea';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEquals } from '@fortawesome/free-solid-svg-icons/faEquals';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faLaptopFile } from '@fortawesome/free-solid-svg-icons/faLaptopFile';
import { analyzerUiColors } from '../../utils/analyzerUtils';
import { AnalyzerControl } from '../AnalyzerControl.jsx';
import { cx } from '../../../../utils/cx.js';

/**
 * Labelled button (or link, via `as`) in the analyzer action bar. Extra props
 * are passed to the AnalyzerControl.
 *
 * @param {{ className?: string } & Record<string, any>} props
 */
export function ActionBarButton({ className, ...props }) {
  return (
    <AnalyzerControl
      {...props}
      className={cx(
        'btn btn-sm btn-ghost h-8 min-h-0 shrink-0 gap-1.5 rounded-lg px-2.5 text-sm font-medium hover:opacity-100',
        className,
      )}
    />
  );
}

/**
 * Square previous/next button in the analyzer action bar.
 *
 * @param {Record<string, any>} props Passed to the AnalyzerControl.
 */
function ActionBarNavButton(props) {
  return (
    <AnalyzerControl
      {...props}
      className='btn btn-sm btn-ghost h-8 min-h-0 w-8 shrink-0 rounded-lg p-0 text-sm'
    />
  );
}

/**
 * @param {object} props
 * @param {boolean} props.canGoPrev
 * @param {boolean} props.canGoNext
 * @param {number} props.currentIndex
 * @param {(targetIndex: number, direction: number) => void} props.onNavigateToIndex
 */
export function ActionBarNavigationButtons({
  canGoPrev,
  canGoNext,
  currentIndex,
  onNavigateToIndex,
}) {
  const { t } = useLingui();
  return (
    <div className='flex shrink-0 items-center gap-1'>
      <ActionBarNavButton
        type='button'
        disabled={!canGoPrev}
        onClick={() => canGoPrev && onNavigateToIndex(currentIndex - 1, -1)}
        title={t`Previous shot`}
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </ActionBarNavButton>

      <ActionBarNavButton
        type='button'
        disabled={!canGoNext}
        onClick={() => canGoNext && onNavigateToIndex(currentIndex + 1, 1)}
        title={t`Next shot`}
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </ActionBarNavButton>
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.compareAvailable
 * @param {boolean} props.compareMode
 * @param {() => void} [props.onCompareModeToggle]
 */
export function ActionBarCompareButton({ compareAvailable, compareMode, onCompareModeToggle }) {
  const { t } = useLingui();
  return (
    <ActionBarButton
      type='button'
      className={compareMode ? 'text-primary opacity-100' : undefined}
      disabled={!compareAvailable}
      onClick={
        /** @param {Event} event */ event => {
          event.preventDefault();
          event.stopPropagation();
          onCompareModeToggle?.();
        }
      }
      title={compareMode ? t`Disable compare mode` : t`Enable compare mode`}
    >
      <FontAwesomeIcon icon={faEquals} className='text-sm' />
      <span>
        <Trans context='compare mode'>Compare</Trans>
      </span>
    </ActionBarButton>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.compareMode
 * @param {boolean} props.statisticsAvailable
 * @param {string} props.statsHref
 * @param {() => void} [props.onShowStats]
 */
export function ActionBarStatisticsAction({
  compareMode,
  statisticsAvailable,
  statsHref,
  onShowStats,
}) {
  const { t } = useLingui();
  const statisticsIcon = compareMode ? faChartArea : faChartSimple;
  const content = (
    <>
      <FontAwesomeIcon icon={statisticsIcon} className='text-sm' />
      <span>{compareMode ? <Trans>Multi-Compare</Trans> : <Trans>Profile Stats</Trans>}</span>
    </>
  );

  if (statisticsAvailable) {
    return (
      <ActionBarButton
        as='a'
        href={statsHref || '/statistics'}
        onClick={
          /** @param {Event} event */ event => {
            event.stopPropagation();
            onShowStats?.();
          }
        }
        title={t`Open statistics`}
      >
        {content}
      </ActionBarButton>
    );
  }

  return (
    <ActionBarButton type='button' disabled title={t`Load a profile to open statistics`}>
      {content}
    </ActionBarButton>
  );
}

/** @typedef {(event: import('preact').JSX.TargetedMouseEvent<HTMLElement>) => void} ActionBarClickHandler */

/**
 * @param {object} props
 * @param {import('../types').ImportMode} props.importMode
 * @param {import('preact').Ref<HTMLElement>} props.modeButtonRef
 * @param {ActionBarClickHandler} props.handleModeToggle
 */
function ActionBarImportModeToggle({ importMode, modeButtonRef, handleModeToggle }) {
  const { t } = useLingui();
  const isBrowserImportMode = importMode === 'browser';

  return (
    <ActionBarButton
      controlRef={modeButtonRef}
      type='button'
      className={isBrowserImportMode ? 'opacity-100' : undefined}
      style={isBrowserImportMode ? { color: analyzerUiColors.sourceBadgeWebText } : undefined}
      onClick={handleModeToggle}
      title={
        isBrowserImportMode
          ? t`Save to Browser. Click to switch imports to View temporarily.`
          : t`View temporarily. Click to switch imports to Save to Browser.`
      }
      aria-label={
        isBrowserImportMode
          ? t`Switch import mode to View temporarily`
          : t`Switch import mode to Save to Browser`
      }
    >
      <FontAwesomeIcon icon={isBrowserImportMode ? faLaptopFile : faEye} className='text-sm' />
      <span>
        {isBrowserImportMode ? (
          <Trans context='import mode'>Save</Trans>
        ) : (
          <Trans context='import mode'>View</Trans>
        )}
      </span>
    </ActionBarButton>
  );
}

/**
 * @param {object} props
 * @param {ActionBarClickHandler} props.handleImportClick
 * @param {ActionBarClickHandler} props.handleModeToggle
 * @param {import('../types').ImportMode} props.importMode
 * @param {boolean} props.isImporting
 * @param {import('preact').Ref<HTMLElement>} props.modeButtonRef
 * @param {boolean} props.showImportModeToggle
 */
export function ActionBarImportActions({
  handleImportClick,
  handleModeToggle,
  importMode,
  isImporting,
  modeButtonRef,
  showImportModeToggle,
}) {
  const { t } = useLingui();
  return (
    <div className='hidden shrink-0 items-center gap-1 sm:ml-auto sm:flex'>
      <ActionBarButton
        type='button'
        onClick={handleImportClick}
        disabled={isImporting}
        title={t`Import shot or profile`}
        aria-label={isImporting ? t`Importing shot or profile` : t`Import shot or profile`}
      >
        <FontAwesomeIcon
          icon={isImporting ? faCircleNotch : faFileImport}
          spin={isImporting}
          className='text-sm'
        />
        <span>
          <Trans>Import</Trans>
        </span>
      </ActionBarButton>

      {showImportModeToggle ? (
        <ActionBarImportModeToggle
          importMode={importMode}
          modeButtonRef={modeButtonRef}
          handleModeToggle={handleModeToggle}
        />
      ) : null}
    </div>
  );
}
