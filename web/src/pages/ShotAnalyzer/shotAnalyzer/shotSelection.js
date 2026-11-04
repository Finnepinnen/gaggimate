/** Normalizes shot selections and loads shots with their preferred profiles. */

import { calculateShotMetrics, detectAutoDelay } from '../services/AnalyzerService';
import { libraryService } from '../services/LibraryService';
import { cleanName, getProfileDisplayLabel, getShotStorageKey } from '../utils/analyzerUtils';

/** @typedef {import('../types').AnalyzerShot} AnalyzerShot */
/** @typedef {import('../types').AnalyzerProfile} AnalyzerProfile */
/** @typedef {import('../types').LibrarySource} LibrarySource */
/** @typedef {import('../types').ShotAnalysisResult} ShotAnalysisResult */
/** @typedef {import('../types').ShotSelectionRequest} ShotSelectionRequest */
/** @typedef {{ profile: AnalyzerProfile, profileName: string }} MatchedProfile */

export const PROFILE_AUTO_MATCH_INITIAL_DELAY_MS = 250;
export const PROFILE_AUTO_MATCH_RETRY_DELAY_MS = 450;
export const PROFILE_AUTO_MATCH_MAX_ATTEMPTS = 4;
const SHOT_SELECTION_DEBOUNCE_MS = 400;
const DEFAULT_ANALYSIS_DELAY_MS = 200;

/**
 * @param {AnalyzerShot | null | undefined} item
 * @returns {boolean} True when `item` already carries its samples
 */
export function hasLoadedShotPayload(item) {
  return !!item && Array.isArray(item.samples);
}

/**
 * @param {AnalyzerShot | null | undefined} item
 * @param {string | number} [loadKey]
 * @returns {string}
 */
function getShotSelectionName(item, loadKey = getShotStorageKey(item)) {
  if (!item) return 'No Shot Loaded';
  return item.name || item.storageKey || String(loadKey || item.id || 'No Shot Loaded');
}

/**
 * @param {AnalyzerShot | null | undefined} item
 * @returns {string}
 */
export function getShotSelectionProfileName(item) {
  return item?.profile ? cleanName(item.profile) : 'No Profile Loaded';
}

/**
 * @param {AnalyzerShot | Partial<ShotSelectionRequest> | null | undefined} request
 * @returns {Partial<ShotSelectionRequest>}
 */
function createSelectionBaseRequest(request) {
  return !!request && typeof request === 'object' && Object.hasOwn(request, 'item')
    ? /** @type {Partial<ShotSelectionRequest>} */ (request)
    : { item: /** @type {AnalyzerShot} */ (request) };
}

/**
 * Accepts a bare shot or a (partial) selection request.
 * @param {AnalyzerShot | Partial<ShotSelectionRequest> | null | undefined} request
 * @param {LibrarySource} importMode Source assumed for items without one
 * @param {Partial<ShotSelectionRequest>} [defaults]
 * @returns {ShotSelectionRequest | null}
 */
export function normalizeSelectionRequest(request, importMode, defaults = {}) {
  const baseRequest = createSelectionBaseRequest(request);
  const item = baseRequest?.item;
  if (!item) return null;

  const shotItem = {
    ...item,
    source: item.source || importMode,
  };

  return {
    direction: 0,
    targetIndex: -1,
    debounceMs: SHOT_SELECTION_DEBOUNCE_MS,
    ...defaults,
    ...baseRequest,
    item: shotItem,
    name: baseRequest.name || getShotSelectionName(shotItem),
    listSnapshot: Array.isArray(baseRequest.listSnapshot) ? baseRequest.listSnapshot : [],
  };
}

/**
 * @param {ShotSelectionRequest | null | undefined} request
 * @returns {ShotSelectionRequest | null}
 */
export function getNextDirectionalSelection(request) {
  if (!request?.direction || !Array.isArray(request.listSnapshot)) return null;

  const nextIndex = request.targetIndex + request.direction;
  if (nextIndex < 0 || nextIndex >= request.listSnapshot.length) return null;

  const item = request.listSnapshot[nextIndex];
  if (!item) return null;

  return {
    ...request,
    item,
    name: getShotSelectionName(item),
    targetIndex: nextIndex,
    requestSelectionScroll: false,
  };
}

/**
 * @param {AnalyzerProfile[]} allProfiles
 * @param {string | undefined} shotProfileName
 * @param {LibrarySource | undefined} shotSource
 * @param {string} [shotProfileId]
 * @returns {AnalyzerProfile | null}
 */
export function findPreferredProfileMatch(
  allProfiles,
  shotProfileName,
  shotSource,
  shotProfileId = '',
) {
  // Legacy shots may retain IDs from an older profile revision. Prefer the normalized
  // profile label so they follow the intended version, then fall back to the stored ID.
  const target = cleanName(shotProfileName).toLowerCase();
  if (target) {
    const matches = allProfiles.filter(
      profile => getProfileDisplayLabel(profile, '').toLowerCase() === target,
    );
    const preferredNameMatch = matches.find(profile => profile.source === shotSource) || matches[0];
    if (preferredNameMatch) return preferredNameMatch;
  }

  const targetId = String(shotProfileId || '').trim();
  if (targetId) {
    const idMatches = allProfiles.filter(
      profile => String(profile.profileId || profile.id || '').trim() === targetId,
    );
    const preferredIdMatch =
      idMatches.find(profile => profile.source === shotSource) || idMatches[0];
    if (preferredIdMatch) return preferredIdMatch;
  }

  return null;
}

/**
 * @param {AnalyzerProfile} profileMatch
 * @returns {string | undefined}
 */
function getProfileLookupId(profileMatch) {
  return profileMatch.source === 'gaggimate'
    ? profileMatch.profileId || profileMatch.id
    : profileMatch.label ||
        profileMatch.data?.label ||
        profileMatch.name ||
        profileMatch.data?.name ||
        profileMatch.fileName ||
        profileMatch.data?.fileName ||
        profileMatch.exportName ||
        profileMatch.data?.exportName;
}

/**
 * @param {AnalyzerProfile} profileData
 * @param {LibrarySource | undefined} profileSource
 * @returns {AnalyzerProfile}
 */
export function normalizeMatchedProfileSource(profileData, profileSource) {
  if (
    profileSource &&
    (profileSource === 'gaggimate' || profileSource === 'browser') &&
    !profileData?.source
  ) {
    return { ...profileData, source: profileSource };
  }
  return profileData;
}

/** @returns {boolean} */
export function shouldAutoScrollAnalyzerOnSelection() {
  const viewportWindow = globalThis.window;
  if (!viewportWindow || typeof viewportWindow.matchMedia !== 'function') return false;
  return viewportWindow.matchMedia('(max-width: 1023px)').matches;
}

/**
 * @param {AnalyzerShot} shotWithMetadata
 * @param {AnalyzerProfile[]} allProfiles
 * @returns {Promise<MatchedProfile | null>}
 */
export async function loadPreferredAutoMatchedProfile(shotWithMetadata, allProfiles) {
  const preferredMatch = findPreferredProfileMatch(
    allProfiles,
    shotWithMetadata.profile,
    shotWithMetadata.source,
    shotWithMetadata.profileId,
  );

  if (!preferredMatch) return null;

  const profileName = getProfileDisplayLabel(preferredMatch, '');
  // Listed profiles always carry an id (device) or a name (browser).
  const profileId = /** @type {string} */ (getProfileLookupId(preferredMatch));
  const fullProfile = preferredMatch.data
    ? preferredMatch.data
    : await libraryService.loadProfile(profileId, preferredMatch.source);

  if (!fullProfile) return null;

  return {
    profile: normalizeMatchedProfileSource(fullProfile, preferredMatch.source),
    profileName,
  };
}

/**
 * @param {AnalyzerShot} shotData
 * @param {AnalyzerProfile | null} profileData
 * @returns {ShotAnalysisResult}
 */
export function analyzeShot(shotData, profileData) {
  let usedSensorDelay = DEFAULT_ANALYSIS_DELAY_MS;
  let isAutoAdjusted = false;

  if (profileData) {
    const detection = detectAutoDelay(shotData, profileData, DEFAULT_ANALYSIS_DELAY_MS);
    usedSensorDelay = detection.delay;
    isAutoAdjusted = detection.auto;
  }

  return calculateShotMetrics(shotData, profileData, {
    scaleDelayMs: DEFAULT_ANALYSIS_DELAY_MS,
    sensorDelayMs: usedSensorDelay,
    isAutoAdjusted,
  });
}

/**
 * @param {object} options
 * @param {AnalyzerShot} options.item List item that was selected
 * @param {AnalyzerShot} options.loadedShot Full shot
 * @param {LibrarySource} options.importMode
 * @param {string | number} options.loadKey
 * @returns {AnalyzerShot}
 */
export function buildShotWithMetadata({ item, loadedShot, importMode, loadKey }) {
  return {
    ...loadedShot,
    source: loadedShot.source || item.source || importMode,
    storageKey: loadedShot.storageKey || item.storageKey || item.name || String(loadKey),
    name: loadedShot.name || item.name || item.storageKey || String(loadKey),
  };
}

/**
 * @param {object} options
 * @param {AnalyzerShot} options.item
 * @param {LibrarySource} options.importMode
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ loadKey: string | number, shotName: string, shotWithMetadata: AnalyzerShot }>}
 */
export async function loadShotSelection({ item, importMode, signal }) {
  const loadKey = getShotStorageKey(item);
  const loadedShot = hasLoadedShotPayload(item)
    ? item
    : await libraryService.loadShot(loadKey, item.source, { signal });
  const shotWithMetadata = buildShotWithMetadata({
    item,
    loadedShot,
    importMode,
    loadKey,
  });

  return {
    loadKey,
    shotName: getShotSelectionName(item, loadKey),
    shotWithMetadata,
  };
}
