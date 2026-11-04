import { t } from '@lingui/core/macro';
import { libraryService } from '../../services/LibraryService';
import {
  cleanName,
  getProfileDisplayLabel,
  getProfilePinKey,
  getShotIdentityKey,
  getShotStorageKey,
  isProfilePinned,
  isShotPinned,
  MAX_PINNED_PROFILES,
  MAX_PINNED_SHOTS_PER_PROFILE,
  PINNED_NO_PROFILE_BUCKET,
} from '../../utils/analyzerUtils';
import {
  doesProfileMatchProfile,
  getLibraryRequestSource,
  hasLoadedProfileMismatch,
} from './libraryData';

/** @typedef {import('../types').LibraryItem} LibraryItem */
/** @typedef {import('../types').LibraryProfileItem} LibraryProfileItem */
/** @typedef {import('../types').LibrarySelectionTarget} LibrarySelectionTarget */
/** @typedef {import('../types').LibraryUiSourceFilter} LibraryUiSourceFilter */
/** @typedef {import('../types').LibraryShotSelectRequest} LibraryShotSelectRequest */
/** @typedef {import('../types').PendingShotSelection} PendingShotSelection */
/** @typedef {import('../types').PinnedShotsByProfile} PinnedShotsByProfile */
/** @typedef {import('../types').ShotRowActionIntent} ShotRowActionIntent */
/** @typedef {import('../types').AnalyzerStatsContext} AnalyzerStatsContext */
/** @typedef {import('../types').OnShotSelect} OnShotSelect */
/** @typedef {import('../types').OnCompareShotToggle} OnCompareShotToggle */
/** @typedef {import('../types').OnProfileLoad} OnProfileLoad */
/** @typedef {import('../types').OnShowStats} OnShowStats */
/** @typedef {import('../../types').AnalyzerProfile} AnalyzerProfile */
/** @typedef {(item: LibraryItem) => string} ShotPinBucketKeyGetter */

// 'No Shot Loaded' / 'No Profile Loaded' are sentinel values; translate them only for display.
/** @param {string} name */
export function getLoadedNameLabel(name) {
  if (name === 'No Shot Loaded') return t`No Shot Loaded`;
  if (name === 'No Profile Loaded') return t`No Profile Loaded`;
  return name;
}

/**
 * @param {object} options
 * @param {LibraryItem | null | undefined} options.currentShot
 * @param {LibraryItem | null | undefined} options.currentProfile
 * @param {string} options.currentShotName
 * @param {string} options.currentProfileName
 * @param {PendingShotSelection | null | undefined} options.pendingPrimarySelection
 * @param {LibraryItem | null | undefined} options.secondaryShot
 * @param {LibraryItem | null | undefined} options.secondaryProfile
 * @param {string} options.secondaryShotName
 * @param {string} options.secondaryProfileName
 * @param {PendingShotSelection | null | undefined} options.pendingCompareSelection
 * @param {boolean} options.isSearchingProfile
 * @param {boolean} options.compareIsSearchingProfile
 * @param {boolean} options.collapsed
 */
export function getLibraryPanelDisplayState({
  currentShot,
  currentProfile,
  currentShotName,
  currentProfileName,
  pendingPrimarySelection,
  secondaryShot,
  secondaryProfile,
  secondaryShotName,
  secondaryProfileName,
  pendingCompareSelection,
  isSearchingProfile,
  compareIsSearchingProfile,
  collapsed,
}) {
  const primaryDisplayShot = pendingPrimarySelection?.shot || currentShot;
  const primaryDisplayShotName = pendingPrimarySelection?.name || currentShotName;
  const primaryDisplayProfile = pendingPrimarySelection ? null : currentProfile;
  const primaryDisplayProfileName = pendingPrimarySelection
    ? cleanName(primaryDisplayShot?.profile || 'No Profile Loaded')
    : currentProfileName;
  const secondaryDisplayShot = pendingCompareSelection?.shot || secondaryShot;
  const secondaryDisplayShotName = pendingCompareSelection?.name || secondaryShotName;
  const secondaryDisplayProfile = pendingCompareSelection ? null : secondaryProfile;
  const secondaryDisplayProfileName = pendingCompareSelection
    ? cleanName(secondaryDisplayShot?.profile || 'No Profile Loaded')
    : secondaryProfileName;
  const isPrimarySelectionPending = Boolean(pendingPrimarySelection);
  const isCompareSelectionPending = Boolean(pendingCompareSelection);
  const primaryProfileMismatch = hasLoadedProfileMismatch(
    primaryDisplayShot,
    primaryDisplayProfile,
    primaryDisplayProfileName,
  );
  const secondaryProfileMismatch = hasLoadedProfileMismatch(
    secondaryDisplayShot,
    secondaryDisplayProfile,
    secondaryDisplayProfileName,
  );
  const isPrimaryProfileSearching = !isPrimarySelectionPending && isSearchingProfile;
  const isCompareProfileSearching = !isCompareSelectionPending && compareIsSearchingProfile;
  const normalizedPrimaryExpectedProfileName = cleanName(
    primaryDisplayShot?.profile || '',
  ).toLowerCase();
  const normalizedCompareExpectedProfileName = cleanName(
    secondaryDisplayShot?.profile || '',
  ).toLowerCase();

  return {
    primaryDisplayShot,
    primaryDisplayShotName,
    primaryDisplayProfile,
    primaryDisplayProfileName,
    secondaryDisplayShot,
    secondaryDisplayShotName,
    secondaryDisplayProfile,
    secondaryDisplayProfileName,
    isPrimarySelectionPending,
    isCompareSelectionPending,
    primaryProfileMismatch,
    secondaryProfileMismatch,
    isPrimaryProfileSearching,
    isCompareProfileSearching,
    normalizedPrimaryExpectedProfileName,
    normalizedCompareExpectedProfileName,
    canRetryPrimaryProfileSearch:
      !pendingPrimarySelection &&
      !primaryDisplayProfile &&
      !isPrimaryProfileSearching &&
      Boolean(normalizedPrimaryExpectedProfileName) &&
      normalizedPrimaryExpectedProfileName !== 'no profile loaded',
    canRetryCompareProfileSearch:
      !pendingCompareSelection &&
      !secondaryDisplayProfile &&
      !isCompareProfileSearching &&
      Boolean(normalizedCompareExpectedProfileName) &&
      normalizedCompareExpectedProfileName !== 'no profile loaded',
    selectionPromotionsEnabled: !collapsed,
  };
}

/**
 * @param {object} options
 * @param {boolean} options.compareMode
 * @param {LibraryItem} options.item
 * @param {LibraryItem | null | undefined} options.primaryDisplayShot
 * @param {string} options.compareSecondaryShotKey
 * @returns {1 | 2 | null}
 */
export function getShotCompareBadgeNumber({
  compareMode,
  item,
  primaryDisplayShot,
  compareSecondaryShotKey,
}) {
  if (!compareMode) return null;
  const itemKey = getShotIdentityKey(item);
  if (!itemKey) return null;
  if (primaryDisplayShot && itemKey === getShotIdentityKey(primaryDisplayShot)) return 1;
  if (compareSecondaryShotKey && itemKey === compareSecondaryShotKey) return 2;
  return null;
}

/**
 * @param {object} options
 * @param {boolean} options.compareMode
 * @param {LibraryItem} options.item
 * @param {LibraryItem | null | undefined} options.primaryDisplayProfile
 * @param {string} options.primaryDisplayProfileName
 * @param {LibraryItem | null | undefined} options.secondaryDisplayProfile
 * @param {string} options.secondaryDisplayProfileName
 * @returns {1 | 2 | null}
 */
export function getProfileCompareBadgeNumber({
  compareMode,
  item,
  primaryDisplayProfile,
  primaryDisplayProfileName,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
}) {
  if (!compareMode) return null;
  if (
    primaryDisplayProfile &&
    doesProfileMatchProfile(item, primaryDisplayProfile, primaryDisplayProfileName)
  ) {
    return 1;
  }
  if (
    secondaryDisplayProfile &&
    doesProfileMatchProfile(item, secondaryDisplayProfile, secondaryDisplayProfileName)
  ) {
    return 2;
  }
  return null;
}

/**
 * @param {LibraryProfileItem} item
 * @returns {string}
 */
export function getLibraryProfileDeleteKey(item) {
  // Device profiles are deleted by id, browser profiles by name (the IndexedDB key).
  const key = item.source === 'gaggimate' ? item.profileId || item.id : item.label || item.name;
  return key == null ? '' : String(key);
}

/**
 * @param {object} options
 * @param {boolean} options.compareMode
 * @param {LibraryItem | null | undefined} options.currentShot
 * @param {LibraryItem} options.profileItem
 * @param {LibraryItem | null | undefined} options.secondaryShot
 * @param {LibraryUiSourceFilter} options.shotsSourceFilter
 * @returns {AnalyzerStatsContext}
 */
export function createLibraryProfileStatsContext({
  compareMode,
  currentShot,
  profileItem,
  secondaryShot,
  shotsSourceFilter,
}) {
  const profileSource = profileItem.source || profileItem.src || 'both';
  /** @type {AnalyzerStatsContext} */
  const statsInitialContext = {
    profileName: getProfileDisplayLabel(profileItem, ''),
    shotSource:
      currentShot?.source ||
      secondaryShot?.source ||
      getLibraryRequestSource(shotsSourceFilter) ||
      'both',
    profileSource,
    source: profileSource,
  };

  if (compareMode) {
    statsInitialContext.preferredDetailSection = 'compare';
  }

  return statsInitialContext;
}

/**
 * @param {LibraryItem | null | undefined} profile
 * @param {boolean} profileMismatch
 * @param {string} profileName
 */
export function getNormalizedCurrentProfileName(profile, profileMismatch, profileName) {
  return profile && !profileMismatch ? cleanName(profileName).toLowerCase() : '';
}

/** @param {string} profileValue */
function getRealProfilePinKey(profileValue) {
  const key = getProfilePinKey(profileValue);
  return key && key !== 'no profile loaded' ? key : '';
}

/**
 * @param {object} options
 * @param {LibraryItem | null | undefined} options.primaryDisplayProfile
 * @param {boolean} options.primaryProfileMismatch
 * @param {string} options.primaryDisplayProfileName
 */
export function getActiveShotPinBucketKey({
  primaryDisplayProfile,
  primaryProfileMismatch,
  primaryDisplayProfileName,
}) {
  return primaryDisplayProfile && !primaryProfileMismatch
    ? getRealProfilePinKey(primaryDisplayProfileName)
    : '';
}

/**
 * @param {LibraryItem} item
 * @param {PinnedShotsByProfile} pinnedShotsByProfile
 * @returns {string}
 */
export function getPinnedShotBucketKeyForItem(item, pinnedShotsByProfile) {
  const shotKey = getShotIdentityKey(item);
  if (!shotKey) return '';

  return (
    Object.entries(pinnedShotsByProfile).find(([, shotKeys]) => shotKeys.includes(shotKey))?.[0] ||
    ''
  );
}

/**
 * @param {LibraryItem} item
 * @param {string[]} pinnedProfiles
 * @returns {string}
 */
export function getProfilePinDisabledReasonForItem(item, pinnedProfiles) {
  if (isProfilePinned(item, pinnedProfiles)) return '';
  return pinnedProfiles.length >= MAX_PINNED_PROFILES
    ? t`Maximum ${MAX_PINNED_PROFILES} pinned profiles`
    : '';
}

/**
 * @param {object} options
 * @param {LibraryItem} options.item
 * @param {ShotPinBucketKeyGetter} options.getEffectiveShotPinBucketKey
 * @param {PinnedShotsByProfile} options.pinnedShotsByProfile
 * @returns {string}
 */
export function getShotPinDisabledReasonForItem({
  item,
  getEffectiveShotPinBucketKey,
  pinnedShotsByProfile,
}) {
  const bucketKey = getEffectiveShotPinBucketKey(item);
  if (isShotPinned(item, bucketKey, pinnedShotsByProfile)) return '';

  const pinnedCount = (pinnedShotsByProfile[bucketKey] || []).length;
  if (pinnedCount < MAX_PINNED_SHOTS_PER_PROFILE) return '';

  return bucketKey === PINNED_NO_PROFILE_BUCKET
    ? t`Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots without a profile`
    : t`Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots per profile`;
}

/**
 * @param {LibrarySelectionTarget} target
 * @returns {import('../types').LibraryMobileSection}
 */
export function getLibraryTargetMobileSection(target) {
  return target === 'primaryProfile' || target === 'secondaryProfile' ? 'profiles' : 'shots';
}

/**
 * @param {LibraryItem | null | undefined} currentShot
 * @returns {import('../types').ImportSlot}
 */
export function getSecondaryImportSlot(currentShot) {
  return currentShot ? 'secondary' : 'primary';
}

/**
 * @param {LibraryItem | null | undefined} primaryDisplayShot
 * @returns {LibrarySelectionTarget}
 */
export function getSecondaryShotPanelTarget(primaryDisplayShot) {
  return primaryDisplayShot ? 'secondaryShot' : 'primaryShot';
}

/**
 * @param {object} options
 * @param {boolean} options.collapsed
 * @param {boolean} options.compareMode
 * @param {LibraryItem | null | undefined} options.currentShot
 * @param {LibraryItem | null | undefined} options.item
 * @param {LibrarySelectionTarget} options.librarySelectionTarget
 * @param {LibraryItem | null | undefined} options.primaryDisplayShot
 * @param {LibraryItem | null | undefined} options.secondaryShot
 * @returns {ShotRowActionIntent}
 */
export function getShotRowActionIntent({
  collapsed,
  compareMode,
  currentShot,
  item,
  librarySelectionTarget,
  primaryDisplayShot,
  secondaryShot,
}) {
  const primaryShotKey = primaryDisplayShot ? getShotIdentityKey(primaryDisplayShot) : '';
  const committedSecondaryShotKey = secondaryShot ? getShotIdentityKey(secondaryShot) : '';
  const itemShotKey = item ? getShotIdentityKey(item) : '';

  if (librarySelectionTarget === 'secondaryShot') {
    return !primaryDisplayShot || !itemShotKey || itemShotKey === primaryShotKey
      ? { type: 'ignore' }
      : { type: 'selectSecondary' };
  }

  if (compareMode && committedSecondaryShotKey && itemShotKey === committedSecondaryShotKey) {
    return { type: 'swap' };
  }

  const keepLibraryOpen = compareMode && !currentShot;
  return {
    type: 'selectPrimary',
    closeLibrary: !keepLibraryOpen,
    requestSelectionScroll: !collapsed && !keepLibraryOpen,
  };
}

/**
 * @param {object} options
 * @param {boolean} options.compareMode
 * @param {() => void} options.handleSwapCompareSlots
 * @param {ShotRowActionIntent} options.intent
 * @param {LibraryItem} options.item
 * @param {OnCompareShotToggle} [options.onCompareShotToggle]
 * @param {OnShotSelect} [options.onShotSelect]
 * @param {(collapsed: boolean) => void} options.setCollapsed
 */
export function executeShotRowActionIntent({
  compareMode,
  handleSwapCompareSlots,
  intent,
  item,
  onCompareShotToggle,
  onShotSelect,
  setCollapsed,
}) {
  if (intent.type === 'ignore') return;
  if (intent.type === 'selectSecondary') {
    setCollapsed(true);
    onCompareShotToggle?.({ item, debounceMs: 0 }, true);
    return;
  }

  if (intent.type === 'swap') {
    setCollapsed(true);
    handleSwapCompareSlots();
    return;
  }

  if (intent.closeLibrary) {
    setCollapsed(true);
  }
  onShotSelect?.({
    item,
    preserveCompare: compareMode,
    requestSelectionScroll: intent.requestSelectionScroll,
    debounceMs: 0,
  });
}

/**
 * @param {object} options
 * @param {LibraryItem} options.item
 * @param {LibrarySelectionTarget} options.librarySelectionTarget
 * @param {OnProfileLoad} [options.onCompareProfileLoad]
 * @param {OnProfileLoad} options.onProfileLoad
 * @param {LibraryItem | null | undefined} options.secondaryShot
 * @param {(collapsed: boolean) => void} options.setCollapsed
 */
export function executeProfileRowAction({
  item,
  librarySelectionTarget,
  onCompareProfileLoad,
  onProfileLoad,
  secondaryShot,
  setCollapsed,
}) {
  if (librarySelectionTarget === 'secondaryProfile') {
    if (!secondaryShot) return;
    onCompareProfileLoad?.(
      /** @type {AnalyzerProfile} */ (item.data || item),
      getProfileDisplayLabel(item, ''),
      item.source,
    );
    setCollapsed(true);
    return;
  }

  onProfileLoad(
    /** @type {AnalyzerProfile} */ (item.data || item),
    getProfileDisplayLabel(item, ''),
    item.source,
  );
  setCollapsed(true);
}

/**
 * @param {object} options
 * @param {boolean} options.compareMode
 * @param {() => void} [options.onCompareModeToggle]
 * @param {(target: LibrarySelectionTarget) => void} options.openLibraryForTarget
 * @param {LibraryItem | null | undefined} options.primaryDisplayShot
 */
export function executeStatusBarCompareToggle({
  compareMode,
  onCompareModeToggle,
  openLibraryForTarget,
  primaryDisplayShot,
}) {
  onCompareModeToggle?.();
  if (!compareMode) {
    openLibraryForTarget(getSecondaryShotPanelTarget(primaryDisplayShot));
  }
}

/**
 * @param {object} options
 * @param {(target: LibrarySelectionTarget) => void} options.openLibraryForTarget
 * @param {LibraryItem | null | undefined} options.secondaryDisplayShot
 */
export function maybeOpenSecondaryProfilePanel({ openLibraryForTarget, secondaryDisplayShot }) {
  if (!secondaryDisplayShot) return;
  openLibraryForTarget('secondaryProfile');
}

/**
 * @param {{ changed: boolean, pinnedProfiles: string[] }} result
 * @param {(pinnedProfiles: string[]) => void} setPinnedProfiles
 */
export function applyChangedProfilePins(result, setPinnedProfiles) {
  if (!result.changed) return;
  setPinnedProfiles(result.pinnedProfiles);
}

/**
 * @param {{ changed: boolean, pinnedShotsByProfile: PinnedShotsByProfile }} result
 * @param {(pinnedShotsByProfile: PinnedShotsByProfile) => void} setPinnedShotsByProfile
 */
export function applyChangedShotPins(result, setPinnedShotsByProfile) {
  if (!result.changed) return;
  setPinnedShotsByProfile(result.pinnedShotsByProfile);
}

/**
 * @param {object} options
 * @param {ShotPinBucketKeyGetter} options.getEffectiveShotPinBucketKey
 * @param {ShotPinBucketKeyGetter} options.getPinnedShotBucketKey
 * @param {LibraryItem} options.item
 * @param {boolean} options.shotsPinnedFirst
 * @returns {string}
 */
export function getShotPinToggleBucketKey({
  getEffectiveShotPinBucketKey,
  getPinnedShotBucketKey,
  item,
  shotsPinnedFirst,
}) {
  return (shotsPinnedFirst && getPinnedShotBucketKey(item)) || getEffectiveShotPinBucketKey(item);
}

/** @param {LibraryItem} item */
export async function deleteLibraryItem(item) {
  const isShot = item.duration !== undefined || Boolean(item.samples);
  const key = isShot
    ? getShotStorageKey(item)
    : getLibraryProfileDeleteKey(/** @type {LibraryProfileItem} */ (item));
  if (key === '' || key == null) throw new Error(t`This item has no id to delete it by.`);
  if (isShot) await libraryService.deleteShot(key, item.source);
  else await libraryService.deleteProfile(String(key), item.source);
}

/**
 * @param {LibraryItem | null | undefined} item
 * @param {boolean} isShot
 * @param {(item: LibraryItem, isShot: boolean) => unknown} handleExport
 * @returns {(() => unknown) | null}
 */
export function getLibraryExportHandler(item, isShot, handleExport) {
  return item ? () => handleExport(item, isShot) : null;
}

/**
 * @param {object} options
 * @param {OnShowStats} [options.onShowStats]
 * @param {LibraryItem | null | undefined} options.primaryDisplayProfile
 * @param {string} options.primaryDisplayProfileName
 * @param {LibraryItem | null | undefined} options.primaryDisplayShot
 * @returns {() => void}
 */
export function createPrimaryStatsHandler({
  onShowStats,
  primaryDisplayProfile,
  primaryDisplayProfileName,
  primaryDisplayShot,
}) {
  return () =>
    onShowStats?.({
      shotSource: primaryDisplayShot?.source || 'both',
      profileSource: primaryDisplayProfile?.source || 'both',
      profileName: primaryDisplayProfileName,
    });
}

/**
 * @param {object} options
 * @param {OnShowStats} [options.onShowStats]
 * @param {LibraryItem | null | undefined} options.primaryDisplayShot
 * @param {LibraryItem | null | undefined} options.secondaryDisplayProfile
 * @param {string} options.secondaryDisplayProfileName
 * @param {LibraryItem | null | undefined} options.secondaryDisplayShot
 * @returns {() => void}
 */
export function createSecondaryStatsHandler({
  onShowStats,
  primaryDisplayShot,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
  secondaryDisplayShot,
}) {
  return () =>
    onShowStats?.({
      shotSource: secondaryDisplayShot?.source || primaryDisplayShot?.source || 'both',
      profileSource: secondaryDisplayProfile?.source || 'both',
      profileName: secondaryDisplayProfileName,
    });
}
