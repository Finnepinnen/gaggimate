/**
 * StatusBar.jsx
 * * Merges seamlessly with the dropdown when expanded.
 */

import { cleanName, analyzerUiColors } from '../../utils/analyzerUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { t } from '@lingui/core/macro';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons/faRotateRight';
import { AnalyzerControl } from '../AnalyzerControl.jsx';
import { cx } from '../../../../utils/cx.js';
import { getLoadedNameLabel } from './libraryDisplay';

/** @typedef {import('../types').LibraryItem} LibraryItem */
/** @typedef {import('preact').JSX.TargetedMouseEvent<HTMLElement>} ControlClickEvent */

/**
 * @typedef {object} StatusBarProps
 * @property {LibraryItem | null} [currentShot]
 * @property {LibraryItem | null} [currentProfile]
 * @property {string} currentShotName
 * @property {string} currentProfileName
 * @property {boolean} [isShotPending]
 * @property {boolean} [canRetryProfileSearch]
 * @property {() => void} onUnloadShot
 * @property {() => void} onUnloadProfile
 * @property {(() => unknown) | null} [onExportShot]
 * @property {(() => unknown) | null} [onExportProfile]
 * @property {() => void} [onRetryProfileSearch]
 * @property {() => void} [onTogglePanel]
 * @property {() => void} [onShotPanelToggle]
 * @property {() => void} [onProfilePanelToggle]
 * @property {boolean} [isMismatch]
 * @property {boolean} [compareMode]
 * @property {boolean} [isSearchingProfile]
 * @property {boolean} [compact]
 * @property {number | null} [compareBadgeNumber]
 * @property {boolean} [ghosted]
 */

/**
 * @param {object} options
 * @param {boolean | undefined} options.isMismatch
 * @param {LibraryItem | null | undefined} options.currentProfile
 * @param {string} options.badgeBaseClass
 * @param {string} options.loadedShadowClass
 */
function getProfileBadgeClasses({ isMismatch, currentProfile, badgeBaseClass, loadedShadowClass }) {
  if (isMismatch) return `${badgeBaseClass} ${loadedShadowClass} border-transparent text-white`;
  if (currentProfile) {
    return `${badgeBaseClass} ${loadedShadowClass} bg-primary border-primary text-primary-content`;
  }
  return `${badgeBaseClass} border-base-content/15 bg-transparent text-base-content/70 shadow-none hover:bg-base-content/5`;
}

/**
 * @param {object} options
 * @param {boolean} options.ghosted
 * @param {string} options.badgeBaseClass
 * @param {LibraryItem | null | undefined} options.currentShot
 */
function getShotBadgeClasses({ ghosted, badgeBaseClass, currentShot }) {
  if (ghosted) {
    return getGhostedBadgeClasses(badgeBaseClass, Boolean(currentShot));
  }
  if (currentShot) {
    return `${badgeBaseClass} bg-primary border-primary text-primary-content`;
  }
  return `${badgeBaseClass} border-base-content/15 bg-transparent text-base-content/70 shadow-none hover:bg-base-content/5`;
}

/**
 * @param {string} baseClasses
 * @param {boolean} isActive
 */
function getGhostedBadgeClasses(baseClasses, isActive) {
  if (isActive) {
    // Secondary compare slots stay visually tied to the active theme while
    // remaining lighter than the primary bar.
    return `${baseClasses} bg-primary/24 border-transparent text-primary hover:bg-primary/30 shadow-none`;
  }
  return `${baseClasses} border-base-content/10 bg-transparent text-base-content/65 hover:bg-base-content/5 shadow-none`;
}

/** @param {boolean | undefined} isMismatch */
function getProfileBadgeTitle(isMismatch) {
  if (isMismatch) {
    return t`Profile mismatch detected. Use Import below or drop files here to import.`;
  }
  return t`Click to open the library. Use Import below or drop files here to import.`;
}

/**
 * @param {object} options
 * @param {LibraryItem | null | undefined} options.currentShot
 * @param {boolean} options.ghosted
 */
function getCompareSlotBadgeClasses({ currentShot, ghosted }) {
  if (!currentShot) return 'bg-base-100 text-base-content/55 ring-base-200';
  return ghosted
    ? 'bg-primary/70 text-primary-content ring-base-100'
    : 'bg-primary text-primary-content ring-base-100';
}

/**
 * @param {LibraryItem | null | undefined} currentShot
 * @param {string} currentShotName
 */
function getShotBadgeLabel(currentShot, currentShotName) {
  if (currentShot?.source === 'gaggimate') {
    return `#${currentShot.id}`;
  }
  return getLoadedNameLabel(cleanName(currentShotName));
}

/**
 * @param {object} options
 * @param {boolean | undefined} options.isMismatch
 * @param {boolean} options.ghosted
 */
function getMismatchProfileBadgeStyle({ isMismatch, ghosted }) {
  if (!isMismatch) return undefined;

  return {
    backgroundColor: ghosted
      ? `color-mix(in srgb, ${analyzerUiColors.warningOrange} 34%, transparent)`
      : analyzerUiColors.warningOrange,
  };
}

/**
 * Round icon button inside a status bar badge. Extra props go to the button.
 *
 * @param {{ compact?: boolean, ghosted?: boolean, children?: import('preact').ComponentChildren } & Record<string, any>} props
 */
function BadgeIconButton({ compact, ghosted, children, ...props }) {
  return (
    <AnalyzerControl
      {...props}
      className={cx(
        'shrink-0 rounded-full text-current',
        compact ? 'h-5 w-5' : 'h-6 w-6',
        ghosted
          ? 'hover:bg-primary/12 opacity-90 hover:text-current hover:opacity-100'
          : 'opacity-75 hover:bg-black/10 hover:text-current hover:opacity-100',
      )}
    >
      {children}
    </AnalyzerControl>
  );
}

/**
 * @param {object} options
 * @param {boolean} options.compact
 * @param {boolean} options.ghosted
 * @param {LibraryItem | null | undefined} options.currentShot
 * @param {LibraryItem | null | undefined} options.currentProfile
 * @param {boolean | undefined} options.isMismatch
 * @param {boolean} options.isSearchingProfile
 */
function getStatusBarViewModel({
  compact,
  ghosted,
  currentShot,
  currentProfile,
  isMismatch,
  isSearchingProfile,
}) {
  const badgeBaseClass = compact
    ? 'flex items-center justify-between flex-1 px-2 h-full rounded-md border cursor-pointer transition-all min-w-0'
    : 'flex items-center justify-between flex-1 px-2 sm:px-3 h-full rounded-lg border cursor-pointer transition-all min-w-0';
  const shotBadgeClasses = getShotBadgeClasses({
    ghosted,
    badgeBaseClass,
    currentShot,
  });

  const mismatchProfileBadgeStyle = getMismatchProfileBadgeStyle({
    isMismatch,
    ghosted,
  });

  const profileBadgeClasses =
    ghosted && !isMismatch
      ? getGhostedBadgeClasses(badgeBaseClass, Boolean(currentProfile))
      : getProfileBadgeClasses({
          isMismatch,
          currentProfile,
          badgeBaseClass,
          loadedShadowClass: '',
        });

  return {
    shotBadgeClasses,
    mismatchProfileBadgeStyle,
    profileBadgeClasses,
    compareBadgeClasses: getCompareSlotBadgeClasses({ currentShot, ghosted }),
    showShotChevron: true,
    showProfileChevron: Boolean(currentProfile) || !isSearchingProfile,
  };
}

/**
 * @param {object} props
 * @param {LibraryItem | null | undefined} props.currentProfile
 * @param {string} props.currentProfileName
 * @param {boolean | undefined} props.isMismatch
 * @param {boolean} props.isSearchingProfile
 * @param {boolean} props.canRetryProfileSearch
 * @param {(() => void) | undefined} props.onRetryProfileSearch
 * @param {() => void} props.onUnloadProfile
 * @param {boolean} props.compact
 * @param {boolean} props.ghosted
 */
function ProfileTrailingControl({
  currentProfile,
  currentProfileName,
  isMismatch,
  isSearchingProfile,
  canRetryProfileSearch,
  onRetryProfileSearch,
  onUnloadProfile,
  compact,
  ghosted,
}) {
  const retryTitle = t`Retry automatic profile search`;
  const hasDismissibleProfileState =
    isSearchingProfile || cleanName(currentProfileName || '').toLowerCase() !== 'no profile loaded';

  if (currentProfile) {
    const showRetry = (isMismatch || canRetryProfileSearch) && onRetryProfileSearch;

    return (
      <div className='flex items-center gap-1'>
        {showRetry ? (
          <BadgeIconButton
            compact={compact}
            ghosted={ghosted}
            type='button'
            onClick={
              /** @param {ControlClickEvent} event */ event => {
                event.stopPropagation();
                onRetryProfileSearch();
              }
            }
            title={retryTitle}
            aria-label={retryTitle}
            disabled={isSearchingProfile}
          >
            <FontAwesomeIcon icon={faRotateRight} className='text-xs' />
          </BadgeIconButton>
        ) : null}

        <BadgeIconButton
          compact={compact}
          ghosted={ghosted}
          type='button'
          onClick={
            /** @param {ControlClickEvent} event */ event => {
              event.stopPropagation();
              onUnloadProfile();
            }
          }
        >
          <FontAwesomeIcon icon={faTimes} />
        </BadgeIconButton>
      </div>
    );
  }

  return (
    <div className='flex items-center gap-1'>
      {canRetryProfileSearch && onRetryProfileSearch ? (
        <BadgeIconButton
          compact={compact}
          ghosted={ghosted}
          type='button'
          onClick={
            /** @param {ControlClickEvent} event */ event => {
              event.stopPropagation();
              onRetryProfileSearch();
            }
          }
          title={retryTitle}
          aria-label={retryTitle}
          disabled={isSearchingProfile}
        >
          <FontAwesomeIcon icon={faRotateRight} className='text-xs' />
        </BadgeIconButton>
      ) : null}

      {hasDismissibleProfileState ? (
        <BadgeIconButton
          compact={compact}
          ghosted={ghosted}
          type='button'
          onClick={
            /** @param {ControlClickEvent} event */ event => {
              event.stopPropagation();
              onUnloadProfile();
            }
          }
        >
          <FontAwesomeIcon icon={faTimes} />
        </BadgeIconButton>
      ) : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.available
 * @param {boolean} props.compact
 * @param {boolean} props.ghosted
 * @param {(() => unknown) | null | undefined} props.onExport
 * @param {string} props.label
 */
function BadgeExportControl({ available, compact, ghosted, onExport, label }) {
  if (!available || !onExport) return null;

  return (
    <BadgeIconButton
      compact={compact}
      ghosted={ghosted}
      type='button'
      onClick={
        /** @param {ControlClickEvent} event */ event => {
          event.stopPropagation();
          onExport();
        }
      }
      title={label}
      aria-label={label}
    >
      <FontAwesomeIcon icon={faFileExport} />
    </BadgeIconButton>
  );
}

/**
 * @param {object} props
 * @param {LibraryItem | null | undefined} props.currentShot
 * @param {boolean} props.compact
 * @param {boolean} props.ghosted
 * @param {() => void} props.onUnloadShot
 */
function ShotTrailingControl({ currentShot, compact, ghosted, onUnloadShot }) {
  return (
    <div className='flex items-center gap-1'>
      {currentShot ? (
        <BadgeIconButton
          compact={compact}
          ghosted={ghosted}
          type='button'
          onClick={
            /** @param {ControlClickEvent} event */ event => {
              event.stopPropagation();
              onUnloadShot();
            }
          }
        >
          <FontAwesomeIcon icon={faTimes} />
        </BadgeIconButton>
      ) : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {LibraryItem | null | undefined} props.currentShot
 * @param {string} props.currentShotName
 * @param {boolean} props.isShotPending
 * @param {boolean} props.compact
 * @param {string} props.shotBadgeClasses
 * @param {boolean} props.showShotChevron
 * @param {(() => void) | undefined} props.handleShotPanelToggle
 * @param {boolean} props.ghosted
 * @param {() => void} props.onUnloadShot
 * @param {(() => unknown) | null | undefined} props.onExportShot
 */
function ShotBadge({
  currentShot,
  currentShotName,
  isShotPending,
  compact,
  shotBadgeClasses,
  showShotChevron,
  handleShotPanelToggle,
  ghosted,
  onUnloadShot,
  onExportShot,
}) {
  return (
    <div
      data-import-target='shot'
      className={shotBadgeClasses}
      title={t`Click to open the library. Use Import below or drop files here to import.`}
    >
      <BadgeExportControl
        available={Boolean(currentShot)}
        compact={compact}
        ghosted={ghosted}
        onExport={onExportShot}
        label={t`Export current shot`}
      />
      <button
        type='button'
        onClick={handleShotPanelToggle}
        className={`mx-1.5 flex min-w-0 flex-1 items-center justify-center self-stretch overflow-hidden text-center ${compact ? 'text-xs font-medium' : 'text-sm font-semibold'}`}
        title={t`Open library`}
      >
        <span className='inline-flex max-w-full min-w-0 flex-1 items-center justify-center gap-1'>
          <span className='min-w-0 truncate'>
            {getShotBadgeLabel(currentShot, currentShotName)}
          </span>
          {isShotPending ? (
            <FontAwesomeIcon icon={faCircleNotch} spin className='shrink-0 text-xs opacity-60' />
          ) : null}
          {showShotChevron ? (
            <FontAwesomeIcon icon={faChevronDown} className='shrink-0 text-xs opacity-40' />
          ) : null}
        </span>
      </button>
      <ShotTrailingControl
        currentShot={currentShot}
        compact={compact}
        ghosted={ghosted}
        onUnloadShot={onUnloadShot}
      />
    </div>
  );
}

/**
 * @param {object} props
 * @param {LibraryItem | null | undefined} props.currentProfile
 * @param {string} props.currentProfileName
 * @param {boolean} props.compact
 * @param {string} props.profileBadgeClasses
 * @param {import('preact').JSX.CSSProperties | undefined} props.mismatchProfileBadgeStyle
 * @param {boolean | undefined} props.isMismatch
 * @param {boolean} props.showProfileChevron
 * @param {(() => void) | undefined} props.handleProfilePanelToggle
 * @param {boolean} props.ghosted
 * @param {boolean} props.isSearchingProfile
 * @param {boolean} props.canRetryProfileSearch
 * @param {(() => void) | undefined} props.onRetryProfileSearch
 * @param {() => void} props.onUnloadProfile
 * @param {(() => unknown) | null | undefined} props.onExportProfile
 */
function ProfileBadge({
  currentProfile,
  currentProfileName,
  compact,
  profileBadgeClasses,
  mismatchProfileBadgeStyle,
  isMismatch,
  showProfileChevron,
  handleProfilePanelToggle,
  ghosted,
  isSearchingProfile,
  canRetryProfileSearch,
  onRetryProfileSearch,
  onUnloadProfile,
  onExportProfile,
}) {
  return (
    <div
      data-import-target='profile'
      className={profileBadgeClasses}
      style={mismatchProfileBadgeStyle}
      title={getProfileBadgeTitle(isMismatch)}
    >
      <BadgeExportControl
        available={Boolean(currentProfile)}
        compact={compact}
        ghosted={ghosted}
        onExport={onExportProfile}
        label={t`Export current profile`}
      />
      <button
        type='button'
        onClick={handleProfilePanelToggle}
        className={`mx-1.5 flex min-w-0 flex-1 items-center justify-center self-stretch overflow-hidden text-center ${compact ? 'text-xs font-medium' : 'text-sm font-semibold'}`}
        title={getProfileBadgeTitle(isMismatch)}
      >
        <span className='inline-flex max-w-full min-w-0 flex-1 items-center justify-center gap-1'>
          {isMismatch ? (
            <FontAwesomeIcon icon={faTriangleExclamation} className='mr-1 shrink-0' />
          ) : null}
          <span
            className={`min-w-0 truncate ${isSearchingProfile && !currentProfile ? 'italic opacity-75' : ''}`}
          >
            {getLoadedNameLabel(cleanName(currentProfileName))}
          </span>
          {isSearchingProfile ? (
            <FontAwesomeIcon icon={faCircleNotch} spin className='shrink-0 text-xs opacity-60' />
          ) : null}
          {showProfileChevron ? (
            <FontAwesomeIcon icon={faChevronDown} className='shrink-0 text-xs opacity-40' />
          ) : null}
        </span>
      </button>

      <ProfileTrailingControl
        currentProfile={currentProfile}
        currentProfileName={currentProfileName}
        isMismatch={isMismatch}
        isSearchingProfile={isSearchingProfile}
        canRetryProfileSearch={canRetryProfileSearch}
        onRetryProfileSearch={onRetryProfileSearch}
        onUnloadProfile={onUnloadProfile}
        compact={compact}
        ghosted={ghosted}
      />
    </div>
  );
}

/** @param {StatusBarProps} props */
export function StatusBar({
  currentShot,
  currentProfile,
  currentShotName,
  currentProfileName,
  isShotPending = false,
  canRetryProfileSearch = false,
  onUnloadShot,
  onUnloadProfile,
  onExportShot,
  onExportProfile,
  onRetryProfileSearch,
  onTogglePanel,
  onShotPanelToggle,
  onProfilePanelToggle,
  isMismatch,
  compareMode = false,
  isSearchingProfile = false, // Show spinner on profile badge
  compact = false,
  compareBadgeNumber = null,
  ghosted = false,
}) {
  const handleShotPanelToggle = onShotPanelToggle || onTogglePanel;
  const handleProfilePanelToggle = onProfilePanelToggle || onTogglePanel;

  const {
    shotBadgeClasses,
    mismatchProfileBadgeStyle,
    profileBadgeClasses,
    compareBadgeClasses,
    showShotChevron,
    showProfileChevron,
  } = getStatusBarViewModel({
    compact,
    ghosted,
    currentShot,
    // @ts-expect-error compareMode is passed but getStatusBarViewModel never reads it
    compareMode,
    currentProfile,
    isMismatch,
    isSearchingProfile,
  });

  return (
    <div className='relative w-full overflow-visible'>
      {compareBadgeNumber ? (
        <span
          className={`pointer-events-none absolute top-0 left-1 z-10 inline-flex h-4 min-w-4 -translate-x-1/3 -translate-y-1/4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold shadow-md ring-2 ${compareBadgeClasses}`}
        >
          {compareBadgeNumber}
        </span>
      ) : null}
      <div className={`relative ${compact ? 'px-1.5 py-0.5 sm:px-2' : 'px-1.5 py-1.5 sm:px-2'}`}>
        <div
          className={`grid ${compact ? 'h-7 rounded-lg' : 'h-9 min-h-9 rounded-lg'} w-full items-center gap-1 transition-all sm:gap-1.5`}
          style={{
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          }}
        >
          {/* --- CENTER: SHOT BADGE --- */}
          <ShotBadge
            currentShot={currentShot}
            currentShotName={currentShotName}
            isShotPending={isShotPending}
            compact={compact}
            shotBadgeClasses={shotBadgeClasses}
            showShotChevron={showShotChevron}
            handleShotPanelToggle={handleShotPanelToggle}
            ghosted={ghosted}
            onUnloadShot={onUnloadShot}
            onExportShot={onExportShot}
          />

          {/* --- CENTER: PROFILE BADGE --- */}
          <ProfileBadge
            currentProfile={currentProfile}
            currentProfileName={currentProfileName}
            compact={compact}
            profileBadgeClasses={profileBadgeClasses}
            mismatchProfileBadgeStyle={mismatchProfileBadgeStyle}
            isMismatch={isMismatch}
            showProfileChevron={showProfileChevron}
            handleProfilePanelToggle={handleProfilePanelToggle}
            ghosted={ghosted}
            isSearchingProfile={isSearchingProfile}
            canRetryProfileSearch={canRetryProfileSearch}
            onRetryProfileSearch={onRetryProfileSearch}
            onUnloadProfile={onUnloadProfile}
            onExportProfile={onExportProfile}
          />
        </div>
      </div>
    </div>
  );
}
