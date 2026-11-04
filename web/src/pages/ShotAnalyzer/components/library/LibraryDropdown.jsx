import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { libraryService } from '../../services/LibraryService';
import {
  cleanName,
  getShotIdentityKey,
  getShotStorageKey,
  isProfilePinned,
  isShotPinned,
} from '../../utils/analyzerUtils';
import { AnalyzerControl } from '../AnalyzerControl.jsx';
import { LibrarySection } from './LibrarySection';
import { doesProfileLabelMatchShot, doesProfileMatchProfile } from './libraryData';
import {
  getLibraryProfileDeleteKey,
  getProfileCompareBadgeNumber,
  getShotCompareBadgeNumber,
} from './libraryDisplay';

/** @typedef {import('../types').LibraryItem} LibraryItem */
/** @typedef {import('../types').LibraryMobileSection} LibraryMobileSection */
/** @typedef {import('../types').LibrarySortConfig} LibrarySortConfig */
/** @typedef {import('../types').LibrarySortOrder} LibrarySortOrder */
/** @typedef {import('../types').LibraryUiSourceFilter} LibraryUiSourceFilter */
/** @typedef {import('../types').PinnedShotsByProfile} PinnedShotsByProfile */
/** @template T @typedef {import('preact/hooks').Dispatch<import('preact/hooks').StateUpdater<T>>} SetState */

/**
 * @param {LibrarySortConfig} currentSort
 * @param {string} key
 * @param {LibrarySortOrder} [order]
 * @returns {LibrarySortConfig}
 */
function getNextLibrarySortState(currentSort, key, order) {
  return {
    key,
    order: order || (currentSort.key === key && currentSort.order === 'desc' ? 'asc' : 'desc'),
  };
}

/**
 * @param {LibraryMobileSection} activeSection
 * @param {LibraryMobileSection} section
 */
function getLibrarySectionVisibilityClass(activeSection, section) {
  return activeSection === section ? 'block lg:block' : 'hidden lg:block';
}

/**
 * @param {object} props
 * @param {boolean} props.active
 * @param {() => void} props.onClick
 * @param {import('preact').ComponentChildren} [props.children]
 */
function LibraryMobileSectionTab({ active, onClick, children }) {
  if (active) {
    return (
      <button
        type='button'
        className='bg-base-100 text-base-content flex-1 rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition-all'
        onClick={onClick}
      >
        {children}
      </button>
    );
  }
  return (
    <AnalyzerControl
      type='button'
      variant='text'
      className='flex-1 justify-center rounded-md px-3 py-1.5 text-xs font-semibold transition-all'
      onClick={onClick}
    >
      {children}
    </AnalyzerControl>
  );
}

/**
 * @param {object} props
 * @param {LibraryMobileSection} props.activeSection
 * @param {(section: LibraryMobileSection) => void} props.onSectionChange
 */
function LibraryMobileSectionTabs({ activeSection, onSectionChange }) {
  return (
    <div className='px-4 pt-4 lg:hidden'>
      <div className='bg-base-200/60 flex items-center gap-1 rounded-lg p-1'>
        <LibraryMobileSectionTab
          active={activeSection === 'shots'}
          onClick={() => onSectionChange('shots')}
        >
          <Trans>Shots</Trans>
        </LibraryMobileSectionTab>
        <LibraryMobileSectionTab
          active={activeSection === 'profiles'}
          onClick={() => onSectionChange('profiles')}
        >
          <Trans>Profiles</Trans>
        </LibraryMobileSectionTab>
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {import('preact').ComponentChildren} [props.children]
 * @param {import('preact').JSX.CSSProperties} props.dropdownStyle
 * @param {LibraryMobileSection} props.mobileActiveSection
 * @param {() => void} props.onClose
 * @param {(section: LibraryMobileSection) => void} props.onMobileSectionChange
 */
export function LibraryDropdown({
  children,
  dropdownStyle,
  mobileActiveSection,
  onClose,
  onMobileSectionChange,
}) {
  return (
    <>
      <button
        type='button'
        className='fixed inset-0 cursor-pointer border-0 bg-black/20 p-0'
        style={{ zIndex: 40 }}
        onClick={onClose}
        aria-label={t`Close library`}
      />
      <div style={dropdownStyle}>
        <div className='library-panel-dropdown-surface app-card-surface origin-top overflow-hidden rounded-b-xl'>
          <LibraryMobileSectionTabs
            activeSection={mobileActiveSection}
            onSectionChange={onMobileSectionChange}
          />
          <div className='max-h-[75vh] overflow-y-auto overscroll-contain lg:max-h-none lg:overflow-hidden'>
            <div className='grid grid-cols-1 gap-x-4 gap-y-4 p-4 lg:grid-cols-2 lg:gap-x-1.5'>
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.compareMode
 * @param {string[]} props.comparePendingKeys
 * @param {string} props.compareSecondaryShotKey
 * @param {number} props.compareSelectedCount
 * @param {Set<string>} props.compareSelectionKeys
 * @param {string | undefined} props.desktopSectionHeight
 * @param {(item: LibraryItem) => string} props.getEffectiveShotPinBucketKey
 * @param {(item: LibraryItem) => string} props.getPinnedShotBucketKey
 * @param {(item: LibraryItem) => string} props.getShotPinDisabledReason
 * @param {(item: LibraryItem) => void} props.handleDelete
 * @param {(item: LibraryItem, isShot: boolean) => unknown} props.handleExport
 * @param {(item: LibraryItem) => void} props.handleShotPinToggle
 * @param {(item: LibraryItem) => void} props.handleShotRowAction
 * @param {boolean} props.loading
 * @param {LibraryMobileSection} props.mobileActiveSection
 * @param {string} props.normalizedCurrentProfileName
 * @param {import('../types').OnCompareShotToggle} [props.onCompareShotToggle]
 * @param {PinnedShotsByProfile} props.pinnedShotsByProfile
 * @param {LibraryItem | null | undefined} props.primaryDisplayProfile
 * @param {LibraryItem | null | undefined} props.primaryDisplayShot
 * @param {() => unknown} props.refreshLibraries
 * @param {SetState<boolean>} props.setShotsPinnedFirst
 * @param {(value: string) => void} props.setShotsSearch
 * @param {(sort: LibrarySortConfig) => void} props.setShotsSort
 * @param {(value: LibraryUiSourceFilter) => void} props.setShotsSourceFilter
 * @param {LibraryItem[]} props.shots
 * @param {boolean} props.shotsPinnedFirst
 * @param {string} props.shotsSearch
 * @param {LibrarySortConfig} props.shotsSort
 * @param {LibraryUiSourceFilter} props.shotsSourceFilter
 */
export function LibraryShotsPanelSection({
  compareMode,
  comparePendingKeys,
  compareSecondaryShotKey,
  compareSelectedCount,
  compareSelectionKeys,
  desktopSectionHeight,
  getEffectiveShotPinBucketKey,
  getPinnedShotBucketKey,
  getShotPinDisabledReason,
  handleDelete,
  handleExport,
  handleShotPinToggle,
  handleShotRowAction,
  loading,
  mobileActiveSection,
  normalizedCurrentProfileName,
  onCompareShotToggle,
  pinnedShotsByProfile,
  primaryDisplayProfile,
  primaryDisplayShot,
  refreshLibraries,
  setShotsPinnedFirst,
  setShotsSearch,
  setShotsSort,
  setShotsSourceFilter,
  shots,
  shotsPinnedFirst,
  shotsSearch,
  shotsSort,
  shotsSourceFilter,
}) {
  const handleExportAllShots = () => {
    if (shots.length === 0) return;
    const count = shots.length;
    if (
      confirm(
        t`Do you really want to export all ${count} filtered shots? (Shots are downloaded individually, one after the other.)`,
      )
    ) {
      for (let i = 0; i < shots.length; i++)
        setTimeout(() => handleExport(shots[i], true), i * 300);
    }
  };

  const handleDeleteAllShots = async () => {
    const count = shots.length;
    if (
      confirm(t`WARNING: Do you really want to IRREVOCABLY delete all ${count} filtered shots?`)
    ) {
      for (const shot of shots) {
        await libraryService.deleteShot(getShotStorageKey(shot), shot.source);
      }
      refreshLibraries();
    }
  };

  return (
    <div className={getLibrarySectionVisibilityClass(mobileActiveSection, 'shots')}>
      <LibrarySection
        title={t`Shots`}
        items={shots}
        isShot={true}
        compareMode={compareMode}
        sectionHeight={desktopSectionHeight}
        searchValue={shotsSearch}
        sortKey={shotsSort.key}
        sortOrder={shotsSort.order}
        sourceFilter={shotsSourceFilter}
        onSearchChange={setShotsSearch}
        onSortChange={(key, order) => setShotsSort(getNextLibrarySortState(shotsSort, key, order))}
        onSourceFilterChange={setShotsSourceFilter}
        onLoad={handleShotRowAction}
        onExport={item => handleExport(item, true)}
        onDelete={handleDelete}
        compareSelectedCount={compareSelectedCount}
        compareSelectionKeys={compareSelectionKeys}
        comparePendingKeys={comparePendingKeys}
        compareReferenceKey={primaryDisplayShot ? getShotIdentityKey(primaryDisplayShot) : ''}
        getCompareBadgeNumber={item =>
          getShotCompareBadgeNumber({
            compareMode,
            item,
            primaryDisplayShot,
            compareSecondaryShotKey,
          })
        }
        onCompareToggle={onCompareShotToggle}
        isLoading={loading}
        onExportAll={handleExportAllShots}
        onDeleteAll={handleDeleteAllShots}
        getMatchStatus={item =>
          primaryDisplayProfile &&
          cleanName(item.profile || '').toLowerCase() === normalizedCurrentProfileName
        }
        getActiveStatus={item =>
          primaryDisplayShot &&
          getShotIdentityKey(item) === getShotIdentityKey(primaryDisplayShot) &&
          item.source === primaryDisplayShot.source
        }
        getPinStatus={item =>
          shotsPinnedFirst
            ? Boolean(getPinnedShotBucketKey(item))
            : isShotPinned(item, getEffectiveShotPinBucketKey(item), pinnedShotsByProfile)
        }
        getPinDisabledReason={getShotPinDisabledReason}
        pinnedFirstEnabled={shotsPinnedFirst}
        onPinnedFirstToggle={() => setShotsPinnedFirst(value => !value)}
        onPinToggle={handleShotPinToggle}
      />
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.compareMode
 * @param {string | undefined} props.desktopSectionHeight
 * @param {(item: LibraryItem) => string} props.getProfilePinDisabledReason
 * @param {(item: LibraryItem) => void} props.handleDelete
 * @param {(item: LibraryItem, isShot: boolean) => unknown} props.handleExport
 * @param {(item: LibraryItem) => void} props.handleLibraryProfileStatsOpen
 * @param {(item: LibraryItem) => void} props.handleProfilePinToggle
 * @param {(item: LibraryItem) => void} props.handleProfileRowAction
 * @param {boolean} props.loading
 * @param {LibraryMobileSection} props.mobileActiveSection
 * @param {string} props.normalizedCompareSecondaryProfileName
 * @param {string[]} props.pinnedProfiles
 * @param {LibraryItem | null | undefined} props.primaryDisplayProfile
 * @param {string} props.primaryDisplayProfileName
 * @param {LibraryItem | null | undefined} props.primaryDisplayShot
 * @param {import('../types').LibraryProfileItem[]} props.profiles
 * @param {boolean} props.profilesPinnedFirst
 * @param {string} props.profilesSearch
 * @param {LibrarySortConfig} props.profilesSort
 * @param {LibraryUiSourceFilter} props.profilesSourceFilter
 * @param {() => unknown} props.refreshLibraries
 * @param {LibraryItem | null | undefined} props.secondaryDisplayProfile
 * @param {string} props.secondaryDisplayProfileName
 * @param {LibraryItem | null | undefined} props.secondaryDisplayShot
 * @param {SetState<boolean>} props.setProfilesPinnedFirst
 * @param {(value: string) => void} props.setProfilesSearch
 * @param {(sort: LibrarySortConfig) => void} props.setProfilesSort
 * @param {(value: LibraryUiSourceFilter) => void} props.setProfilesSourceFilter
 */
export function LibraryProfilesPanelSection({
  compareMode,
  desktopSectionHeight,
  getProfilePinDisabledReason,
  handleDelete,
  handleExport,
  handleLibraryProfileStatsOpen,
  handleProfilePinToggle,
  handleProfileRowAction,
  loading,
  mobileActiveSection,
  normalizedCompareSecondaryProfileName,
  pinnedProfiles,
  primaryDisplayProfile,
  primaryDisplayProfileName,
  primaryDisplayShot,
  profiles,
  profilesPinnedFirst,
  profilesSearch,
  profilesSort,
  profilesSourceFilter,
  refreshLibraries,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
  secondaryDisplayShot,
  setProfilesPinnedFirst,
  setProfilesSearch,
  setProfilesSort,
  setProfilesSourceFilter,
}) {
  const handleExportAllProfiles = () => {
    if (profiles.length === 0) return;
    const count = profiles.length;
    if (
      confirm(
        t`Do you really want to export all ${count} filtered profiles? (Profiles are downloaded individually, one after the other.)`,
      )
    ) {
      for (let i = 0; i < profiles.length; i++)
        setTimeout(() => handleExport(profiles[i], false), i * 300);
    }
  };

  const handleDeleteAllProfiles = async () => {
    const count = profiles.length;
    if (
      confirm(t`WARNING: Do you really want to IRREVOCABLY delete all ${count} filtered profiles?`)
    ) {
      for (const profile of profiles) {
        const key = getLibraryProfileDeleteKey(profile);
        if (key) await libraryService.deleteProfile(key, profile.source);
      }
      refreshLibraries();
    }
  };

  return (
    <div className={getLibrarySectionVisibilityClass(mobileActiveSection, 'profiles')}>
      <LibrarySection
        title={t`Profiles`}
        items={profiles}
        isShot={false}
        compareMode={compareMode}
        sectionHeight={desktopSectionHeight}
        searchValue={profilesSearch}
        sortKey={profilesSort.key}
        sortOrder={profilesSort.order}
        sourceFilter={profilesSourceFilter}
        onSearchChange={setProfilesSearch}
        onSortChange={(key, order) =>
          setProfilesSort(getNextLibrarySortState(profilesSort, key, order))
        }
        onSourceFilterChange={setProfilesSourceFilter}
        onLoad={handleProfileRowAction}
        onShowStats={handleLibraryProfileStatsOpen}
        onExport={item => handleExport(item, false)}
        onDelete={handleDelete}
        isLoading={loading}
        onExportAll={handleExportAllProfiles}
        onDeleteAll={handleDeleteAllProfiles}
        getMatchStatus={item =>
          primaryDisplayShot && doesProfileLabelMatchShot(item, primaryDisplayShot)
        }
        getCompareStatus={item =>
          Boolean(
            secondaryDisplayProfileName &&
            normalizedCompareSecondaryProfileName &&
            normalizedCompareSecondaryProfileName !== 'no profile loaded' &&
            doesProfileLabelMatchShot(item, secondaryDisplayShot),
          )
        }
        getCompareBadgeNumber={item =>
          getProfileCompareBadgeNumber({
            compareMode,
            item,
            primaryDisplayProfile,
            primaryDisplayProfileName,
            secondaryDisplayProfile,
            secondaryDisplayProfileName,
          })
        }
        getActiveStatus={item =>
          primaryDisplayProfile &&
          doesProfileMatchProfile(item, primaryDisplayProfile, primaryDisplayProfileName)
        }
        getPinStatus={item => isProfilePinned(item, pinnedProfiles)}
        getPinDisabledReason={getProfilePinDisabledReason}
        pinnedFirstEnabled={profilesPinnedFirst}
        onPinnedFirstToggle={() => setProfilesPinnedFirst(value => !value)}
        onPinToggle={handleProfilePinToggle}
      />
    </div>
  );
}
