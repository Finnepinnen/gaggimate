import {
  cleanName,
  getProfileDisplayLabel,
  isProfilePinned,
  isShotPinnedAnywhere,
  loadFromStorage,
} from '../../utils/analyzerUtils';

/** @typedef {import('../types').LibraryItem} LibraryItem */
/** @typedef {import('../types').LibraryShotItem} LibraryShotItem */
/** @typedef {import('../types').LibraryProfileItem} LibraryProfileItem */
/** @typedef {import('../types').LibrarySortConfig} LibrarySortConfig */
/** @typedef {import('../types').LibraryUiSourceFilter} LibraryUiSourceFilter */
/** @typedef {import('../types').PinnedShotsByProfile} PinnedShotsByProfile */
/** @typedef {import('../../types').LibrarySourceFilter} LibrarySourceFilter */

/**
 * @param {string} storageKey
 * @returns {LibraryUiSourceFilter}
 */

export function getStoredLibrarySourceFilter(storageKey) {
  const storedValue = loadFromStorage(storageKey, /** @type {string} */ ('all'));
  return storedValue === 'gaggimate' || storedValue === 'browser' || storedValue === 'all'
    ? storedValue
    : 'all';
}

/**
 * @param {LibraryUiSourceFilter} sourceFilter
 * @returns {LibrarySourceFilter}
 */
export function getLibraryRequestSource(sourceFilter) {
  return sourceFilter === 'all' ? 'both' : sourceFilter;
}

/**
 * @param {LibraryItem} item
 * @param {string} query
 */
function getLibraryShotSearchPriority(item, query) {
  const normalizedId = String(item?.id || '').toLowerCase();
  const normalizedName = (item?.name || item?.label || item?.title || '').toLowerCase();
  return normalizedName.includes(query) || normalizedId.includes(query) ? 0 : 1;
}

/**
 * @template {LibraryItem} T
 * @param {T[]} items
 * @param {LibrarySortConfig} cfg
 * @returns {T[]}
 */
function applyLibrarySort(items, cfg) {
  return [...items].sort((a, b) => {
    /** @type {any} */
    let valA;
    /** @type {any} */
    let valB;

    switch (cfg.key) {
      case 'shotDate':
        valA = a.timestamp || 0;
        valB = b.timestamp || 0;
        break;
      case 'name':
        valA = getProfileDisplayLabel(a, a.profile || '').toLowerCase();
        valB = getProfileDisplayLabel(b, b.profile || '').toLowerCase();
        break;
      case 'data.rating':
        valA = a.rating || 0;
        valB = b.rating || 0;
        break;
      case 'duration':
        // parseFloat also takes the numeric durations as-is.
        valA = Number.parseFloat(/** @type {string} */ (/** @type {unknown} */ (a.duration))) || 0;
        valB = Number.parseFloat(/** @type {string} */ (/** @type {unknown} */ (b.duration))) || 0;
        break;
      default:
        valA = /** @type {Record<string, unknown>} */ (a)[cfg.key];
        valB = /** @type {Record<string, unknown>} */ (b)[cfg.key];
    }

    if (valA < valB) return cfg.order === 'asc' ? -1 : 1;
    if (valA > valB) return cfg.order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * @template {LibraryItem} T
 * @param {T[]} items
 * @param {(item: T) => unknown} predicate
 * @returns {T[]}
 */
function promoteLibraryItems(items, predicate) {
  /** @type {T[]} */
  const promoted = [];
  /** @type {T[]} */
  const remaining = [];

  items.forEach(item => {
    if (predicate(item)) promoted.push(item);
    else remaining.push(item);
  });

  return [...promoted, ...remaining];
}

/**
 * @param {LibraryShotItem[]} shotsData
 * @param {string} shotSearch
 * @param {string} profileSearch
 */
function filterLibraryShots(shotsData, shotSearch, profileSearch) {
  let filteredShots = shotsData;

  if (shotSearch) {
    const normalizedShotSearch = shotSearch.toLowerCase();
    filteredShots = shotsData.filter(shot => {
      const nameMatch = (shot.name || shot.label || shot.title || '')
        .toLowerCase()
        .includes(normalizedShotSearch);
      const profileMatch = (shot.profile || shot.profileName || '')
        .toLowerCase()
        .includes(normalizedShotSearch);
      const idMatch = String(shot.id || '')
        .toLowerCase()
        .includes(normalizedShotSearch);
      const fileMatch = (shot.fileName || shot.exportName || '')
        .toLowerCase()
        .includes(normalizedShotSearch);

      return nameMatch || profileMatch || idMatch || fileMatch;
    });

    filteredShots.sort(
      (a, b) =>
        getLibraryShotSearchPriority(a, normalizedShotSearch) -
        getLibraryShotSearchPriority(b, normalizedShotSearch),
    );
  }

  if (!profileSearch) return filteredShots;

  const normalizedProfileSearch = profileSearch.toLowerCase();
  return filteredShots.filter(shot =>
    (shot.profile || shot.profileName || '').toLowerCase().includes(normalizedProfileSearch),
  );
}

/**
 * @param {LibraryProfileItem[]} profilesData
 * @param {string} profileSearch
 */
function filterLibraryProfiles(profilesData, profileSearch) {
  if (!profileSearch) return profilesData;
  const normalizedProfileSearch = profileSearch.toLowerCase();
  return profilesData.filter(profile =>
    getProfileDisplayLabel(profile, '').toLowerCase().includes(normalizedProfileSearch),
  );
}

/** @param {LibraryItem | null | undefined} profile */
function getProfileIdentityId(profile) {
  return String(
    profile?.profileId || profile?.id || profile?.data?.profileId || profile?.data?.id || '',
  ).trim();
}

/**
 * @param {LibraryItem | null | undefined} profile
 * @param {LibraryItem | null | undefined} shot
 * @param {string} [fallbackProfileName]
 */
function doesProfileMatchShot(profile, shot, fallbackProfileName = '') {
  if (!profile || !shot) return false;

  const shotProfileId = String(shot.profileId || '').trim();
  const profileId = getProfileIdentityId(profile);
  if (shotProfileId && profileId) {
    return shotProfileId === profileId;
  }

  const expectedProfileName = cleanName(shot.profile || '').toLowerCase();
  if (!expectedProfileName) return false;

  return getProfileDisplayLabel(profile, fallbackProfileName).toLowerCase() === expectedProfileName;
}

/**
 * @param {LibraryItem | null | undefined} profile
 * @param {LibraryItem | null | undefined} shot
 * @param {string} [fallbackProfileName]
 * @returns {boolean}
 */
export function doesProfileLabelMatchShot(profile, shot, fallbackProfileName = '') {
  if (!profile || !shot) return false;

  const expectedProfileName = cleanName(shot.profile || '').toLowerCase();
  if (!expectedProfileName) return doesProfileMatchShot(profile, shot, fallbackProfileName);

  const profileLabel = cleanName(
    getProfileDisplayLabel(profile, fallbackProfileName),
  ).toLowerCase();
  return profileLabel === expectedProfileName;
}

/**
 * @param {LibraryItem | null | undefined} profile
 * @param {LibraryItem | null | undefined} selectedProfile
 * @param {string} [selectedProfileName]
 * @returns {boolean}
 */
export function doesProfileMatchProfile(profile, selectedProfile, selectedProfileName = '') {
  if (!profile || !selectedProfile) return false;

  const profileId = getProfileIdentityId(profile);
  const selectedProfileId = getProfileIdentityId(selectedProfile);
  if (profileId && selectedProfileId) {
    return profileId === selectedProfileId;
  }

  const selectedLabel = getProfileDisplayLabel(selectedProfile, selectedProfileName).toLowerCase();
  return getProfileDisplayLabel(profile, '').toLowerCase() === selectedLabel;
}

/**
 * @param {LibraryItem | null | undefined} shot
 * @param {LibraryItem | null | undefined} profile
 * @param {string} [fallbackProfileName]
 */
export function hasLoadedProfileMismatch(shot, profile, fallbackProfileName = '') {
  return Boolean(shot && profile && !doesProfileLabelMatchShot(profile, shot, fallbackProfileName));
}

/**
 * @param {object} options
 * @param {LibraryShotItem[]} options.shotsData
 * @param {LibraryProfileItem[]} options.profilesData
 * @param {string} options.shotSearch
 * @param {string} options.profileSearch
 * @param {LibrarySortConfig} options.shotsSort
 * @param {LibrarySortConfig} options.profilesSort
 * @param {string} options.normalizedCurrentProfileName
 * @param {string} options.normalizedCurrentShotProfileName
 * @param {string[]} options.pinnedProfiles
 * @param {PinnedShotsByProfile} options.pinnedShotsByProfile
 * @param {boolean} options.shotsPinnedFirst
 * @param {boolean} options.profilesPinnedFirst
 * @param {boolean} [options.selectionPromotionsEnabled]
 */
export function buildPromotedLibraryItems({
  shotsData,
  profilesData,
  shotSearch,
  profileSearch,
  shotsSort,
  profilesSort,
  normalizedCurrentProfileName,
  normalizedCurrentShotProfileName,
  pinnedProfiles,
  pinnedShotsByProfile,
  shotsPinnedFirst,
  profilesPinnedFirst,
  selectionPromotionsEnabled = true,
}) {
  const filteredShots = filterLibraryShots(shotsData, shotSearch, profileSearch);
  const filteredProfiles = filterLibraryProfiles(profilesData, profileSearch);
  const hasActiveProfileMatch =
    selectionPromotionsEnabled &&
    normalizedCurrentProfileName &&
    normalizedCurrentProfileName !== 'no profile loaded';
  const hasActiveShotProfileMatch =
    selectionPromotionsEnabled &&
    normalizedCurrentShotProfileName &&
    normalizedCurrentShotProfileName !== 'no profile loaded';
  /** @param {LibraryShotItem} item */
  const promoteMatchedShots = item =>
    hasActiveProfileMatch &&
    cleanName(item.profile || '').toLowerCase() === normalizedCurrentProfileName;
  /** @param {LibraryProfileItem} item */
  const promoteMatchedProfiles = item =>
    hasActiveShotProfileMatch &&
    doesProfileLabelMatchShot(item, { profile: normalizedCurrentShotProfileName });

  let nextShots = applyLibrarySort(filteredShots, shotsSort);
  if (shotsPinnedFirst) {
    nextShots = promoteLibraryItems(nextShots, item =>
      isShotPinnedAnywhere(item, pinnedShotsByProfile),
    );
  } else {
    nextShots = promoteLibraryItems(nextShots, promoteMatchedShots);
  }

  let nextProfiles = applyLibrarySort(filteredProfiles, profilesSort);
  if (selectionPromotionsEnabled) {
    nextProfiles = promoteLibraryItems(nextProfiles, promoteMatchedProfiles);
  }
  if (profilesPinnedFirst) {
    nextProfiles = promoteLibraryItems(nextProfiles, item => isProfilePinned(item, pinnedProfiles));
  }

  return { nextShots, nextProfiles };
}

/**
 * @param {object} options
 * @param {LibraryShotItem[]} options.shotsData
 * @param {LibrarySortConfig} options.shotsSort
 * @param {boolean} options.shotsPinnedFirst
 * @param {PinnedShotsByProfile} options.pinnedShotsByProfile
 */
export function buildShotNavigationItems({
  shotsData,
  shotsSort,
  shotsPinnedFirst,
  pinnedShotsByProfile,
}) {
  let nextShots = applyLibrarySort(shotsData, shotsSort);

  if (shotsPinnedFirst) {
    nextShots = promoteLibraryItems(nextShots, item =>
      isShotPinnedAnywhere(item, pinnedShotsByProfile),
    );
  }

  return nextShots;
}
