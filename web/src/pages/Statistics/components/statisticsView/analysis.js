// Shot analysis engine: metrics computation, compare entry building, profile/date-range extraction
import {
  cleanName,
  getProfileDisplayLabel,
  getShotDisplayName,
} from '../../../ShotAnalyzer/utils/analyzerUtils';
import {
  calculateShotMetrics,
  detectAutoDelay,
} from '../../../ShotAnalyzer/services/AnalyzerService';
import { libraryService } from '../../../ShotAnalyzer/services/LibraryService';
import { DEFAULT_SETTINGS } from './constants';
import {
  getShotSelectionKey,
  getStatisticsCompareFallbackKey,
  buildStatisticsCompareEntry,
} from './helpers';

/**
 * @typedef {import('../../types').DateBasisMode} DateBasisMode
 * @typedef {import('../../../ShotAnalyzer/types').LibrarySource} LibrarySource
 * @typedef {import('../../types').StatisticsShotMeta} StatisticsShotMeta
 * @typedef {import('../../types').StatisticsProfileMeta} StatisticsProfileMeta
 * @typedef {import('../../../ShotAnalyzer/types').AnalyzerProfile} AnalyzerProfile
 * @typedef {import('../../../ShotAnalyzer/types').AnalysisSettings} AnalysisSettings
 * @typedef {import('../../types').StatisticsEntry} StatisticsEntry
 * @typedef {import('../../types').StatisticsRunRequest} StatisticsRunRequest
 * @typedef {import('../../types').StatisticsProgress} StatisticsProgress
 * @typedef {import('../../types').StatisticsCompareEntry} StatisticsCompareEntry
 * @typedef {import('../../types').StatisticsResult} StatisticsResult
 * @typedef {Map<string, StatisticsProfileMeta>} ProfileLookupMap
 * @typedef {Map<string, Promise<AnalyzerProfile | null>>} LoadedProfileCache
 * @typedef {{ current: StatisticsEntry[] | null }} EntriesRef
 * @typedef {{
 *   fallbackProfileMap: ProfileLookupMap,
 *   loadedProfileCache: LoadedProfileCache,
 *   profileMap: ProfileLookupMap,
 * }} ProfileLookupContext
 */

/** @param {StatisticsCompareEntry | null} entry @returns {entry is StatisticsCompareEntry} */
const isCompareEntry = entry => Boolean(entry);

/**
 * @param {StatisticsProfileMeta[]} profileList
 * @param {ProfileLookupMap | null} [existingMap] - Keys already covered; skipped here.
 * @returns {ProfileLookupMap}
 */
export function buildProfileLookupMap(profileList, existingMap = null) {
  /** @type {ProfileLookupMap} */
  const profileMap = new Map();
  for (const profile of profileList) {
    const displayName = getProfileDisplayLabel(profile, '');
    const key = displayName.toLowerCase();
    if (key && !existingMap?.has(key)) profileMap.set(key, profile);
  }
  return profileMap;
}

/**
 * @param {StatisticsShotMeta} shot
 * @returns {string | number | null} null when the shot has nothing to load it by.
 */
export function getStatisticsShotId(shot) {
  const id = shot.source === 'gaggimate' ? shot.id : shot.storageKey || shot.name || shot.id;
  return id == null || id === '' ? null : id;
}

/**
 * @param {object} args
 * @param {StatisticsShotMeta | null | undefined} args.loadedShot
 * @param {StatisticsShotMeta} args.shot
 * @param {string | number} args.shotId
 * @returns {StatisticsShotMeta | null}
 */
export function buildFullStatisticsShot({ loadedShot, shot, shotId }) {
  if (!loadedShot) return null;
  return {
    ...loadedShot,
    source: loadedShot.source || shot.source,
    storageKey: loadedShot.storageKey || shot.storageKey || shot.name || String(shotId),
    name: loadedShot.name || shot.name || shot.storageKey || String(shotId),
  };
}

/**
 * @param {object} args
 * @param {ProfileLookupMap} args.fallbackProfileMap
 * @param {StatisticsShotMeta} args.fullShot
 * @param {ProfileLookupMap} args.profileMap
 * @returns {StatisticsProfileMeta | null}
 */
export function resolveMatchedProfileEntry({ fallbackProfileMap, fullShot, profileMap }) {
  const profileField = fullShot.profile || '';
  const profileKey = cleanName(profileField).toLowerCase();
  if (!profileKey) return null;
  return profileMap.get(profileKey) || fallbackProfileMap.get(profileKey) || null;
}

/**
 * @param {StatisticsProfileMeta} profileEntry
 * @returns {string | undefined}
 */
export function getProfileLoadId(profileEntry) {
  if (profileEntry.source === 'gaggimate') return profileEntry.profileId || profileEntry.id;
  return profileEntry.label || profileEntry.name;
}

/**
 * @param {object} args
 * @param {LoadedProfileCache} args.loadedProfileCache
 * @param {StatisticsProfileMeta | null} args.matchedProfileEntry
 * @returns {Promise<AnalyzerProfile | null>}
 */
export async function loadStatisticsMatchedProfile({ loadedProfileCache, matchedProfileEntry }) {
  if (!matchedProfileEntry) return null;
  if (matchedProfileEntry.data) return matchedProfileEntry.data;

  const profileId = getProfileLoadId(matchedProfileEntry);
  if (!profileId) return null;

  const cacheKey = `${matchedProfileEntry.source}:${String(profileId || '')}`;
  if (!loadedProfileCache.has(cacheKey)) {
    loadedProfileCache.set(
      cacheKey,
      libraryService
        // Listed profiles always carry their library source.
        .loadProfile(profileId, /** @type {LibrarySource} */ (matchedProfileEntry.source))
        .catch(/** @returns {null} */ () => null),
    );
  }
  return /** @type {Promise<AnalyzerProfile | null>} */ (loadedProfileCache.get(cacheKey));
}

/**
 * @param {AnalyzerProfile | null} profile
 * @param {StatisticsProfileMeta | null} matchedProfileEntry
 * @returns {AnalyzerProfile | null}
 */
export function attachProfileSource(profile, matchedProfileEntry) {
  if (profile && matchedProfileEntry?.source && !profile.source) {
    return { ...profile, source: matchedProfileEntry.source };
  }
  return profile;
}

/**
 * @param {StatisticsShotMeta} fullShot
 * @param {AnalyzerProfile | null} matchedProfile
 * @returns {AnalysisSettings}
 */
export function getStatisticsAnalysisSettings(fullShot, matchedProfile) {
  const settings = { ...DEFAULT_SETTINGS };
  const autoResult = detectAutoDelay(fullShot, matchedProfile, settings.scaleDelayMs);
  if (autoResult.auto) {
    settings.scaleDelayMs = autoResult.delay;
    settings.isAutoAdjusted = true;
  }
  return settings;
}

/**
 * @param {ProfileLookupContext & { shot: StatisticsShotMeta }} args
 * @returns {Promise<StatisticsEntry | null>}
 */
export async function analyzeStatisticsShot({
  fallbackProfileMap,
  loadedProfileCache,
  profileMap,
  shot,
}) {
  try {
    const shotId = getStatisticsShotId(shot);
    if (shotId == null) return null;
    // Listed shots always carry their library source.
    const shotSource = /** @type {LibrarySource} */ (shot.source);
    const loadedShot = await libraryService.loadShot(shotId, shotSource);
    const fullShot = buildFullStatisticsShot({ loadedShot, shot, shotId });
    if (!fullShot?.samples || fullShot.samples.length === 0) return null;

    const matchedProfileEntry = resolveMatchedProfileEntry({
      fallbackProfileMap,
      fullShot,
      profileMap,
    });
    const loadedProfile = await loadStatisticsMatchedProfile({
      loadedProfileCache,
      matchedProfileEntry,
    });
    const matchedProfile = attachProfileSource(loadedProfile, matchedProfileEntry);
    const settings = getStatisticsAnalysisSettings(fullShot, matchedProfile);
    const profileField = fullShot.profile || '';

    return {
      analysis: calculateShotMetrics(fullShot, matchedProfile, settings),
      shotData: fullShot,
      profileData: matchedProfile,
      meta: {
        id: shotId,
        selectionKey: getShotSelectionKey(shot),
        displayName: getShotDisplayName(fullShot),
        timestamp: shot.timestamp || shot.shotDate || shot.uploadedAt || 0,
        profileName: cleanName(profileField) || '(Unknown)',
        source: shotSource,
      },
    };
  } catch {
    return null;
  }
}

/**
 * @param {ProfileLookupContext & { batch: StatisticsShotMeta[] }} args
 */
export async function analyzeStatisticsShotBatch({
  batch,
  fallbackProfileMap,
  loadedProfileCache,
  profileMap,
}) {
  return Promise.all(
    batch.map(shot =>
      analyzeStatisticsShot({
        fallbackProfileMap,
        loadedProfileCache,
        profileMap,
        shot,
      }),
    ),
  );
}

/** @param {StatisticsRunRequest} runRequest */
export function getStatisticsRunSources(runRequest) {
  const shotList = Array.isArray(runRequest.shots) ? runRequest.shots : [];
  const profileList = Array.isArray(runRequest.profiles) ? runRequest.profiles : [];
  const fallbackProfileList = Array.isArray(runRequest.fallbackProfiles)
    ? runRequest.fallbackProfiles
    : [];

  return { fallbackProfileList, profileList, shotList };
}

/**
 * @param {StatisticsEntry[]} targetEntries
 * @param {(StatisticsEntry | null)[]} batchResults
 */
function appendDefinedEntries(targetEntries, batchResults) {
  for (const entry of batchResults) {
    if (entry) targetEntries.push(entry);
  }
}

/**
 * @param {object} args
 * @param {() => boolean} args.isCurrentRun
 * @param {(progress: StatisticsProgress) => void} args.onProgress
 * @param {StatisticsRunRequest} args.runRequest
 * @returns {Promise<StatisticsEntry[] | null>} null when superseded by a newer run
 */
export async function runStatisticsAnalysis({ isCurrentRun, onProgress, runRequest }) {
  const { fallbackProfileList, profileList, shotList } = getStatisticsRunSources(runRequest);
  const profileMap = buildProfileLookupMap(profileList);
  const fallbackProfileMap = buildProfileLookupMap(fallbackProfileList, profileMap);
  /** @type {LoadedProfileCache} */
  const loadedProfileCache = new Map();
  const total = shotList.length;

  onProgress({ current: 0, total });
  if (total === 0) return [];

  /** @type {StatisticsEntry[]} */
  const entries = [];
  for (let i = 0; i < total; i += 2) {
    if (!isCurrentRun()) return null;

    const batch = shotList.slice(i, i + 2);
    const batchResults = await analyzeStatisticsShotBatch({
      batch,
      fallbackProfileMap,
      loadedProfileCache,
      profileMap,
    });
    appendDefinedEntries(entries, batchResults);

    if (!isCurrentRun()) return null;
    onProgress({ current: Math.min(i + 2, total), total });
  }

  return entries;
}

/**
 * @param {StatisticsResult | null} result
 * @param {StatisticsRunRequest | null} runRequest
 * @param {EntriesRef} entriesRef
 * @returns {StatisticsCompareEntry[]}
 */
export function buildStatisticsCompareEntries(result, runRequest, entriesRef) {
  if (!result) return [];

  const cachedEntries = Array.isArray(entriesRef.current) ? entriesRef.current : [];
  const entryBySelectionKey = new Map(
    cachedEntries.map(entry => [entry?.meta?.selectionKey, entry]),
  );
  const orderedShotKeys = Array.isArray(runRequest?.orderedShotKeys)
    ? runRequest.orderedShotKeys.filter(Boolean)
    : [];
  const fallbackShotKeys = Array.isArray(runRequest?.shots)
    ? runRequest.shots.map(getShotSelectionKey).filter(Boolean)
    : [];
  const preferredShotOrder = orderedShotKeys.length > 0 ? orderedShotKeys : fallbackShotKeys;

  const orderedCompareEntries = preferredShotOrder
    .map((selectionKey, index) =>
      buildStatisticsCompareEntry(entryBySelectionKey.get(selectionKey), {
        key: selectionKey,
        isReference: index === 0,
      }),
    )
    .filter(isCompareEntry);

  const matchedCompareKeys = new Set(orderedCompareEntries.map(entry => entry.key));
  const unmatchedCompareEntries = cachedEntries
    .map((entry, index) => {
      const fallbackKey = getStatisticsCompareFallbackKey(entry, index);
      if (matchedCompareKeys.has(fallbackKey)) return null;

      return buildStatisticsCompareEntry(entry, {
        key: fallbackKey,
        isReference: orderedCompareEntries.length === 0 && index === 0,
      });
    })
    .filter(isCompareEntry);

  if (preferredShotOrder.length > 0) {
    if (orderedCompareEntries.length === cachedEntries.length) {
      return orderedCompareEntries;
    }
    if (orderedCompareEntries.length > 0 || unmatchedCompareEntries.length > 0) {
      return [...orderedCompareEntries, ...unmatchedCompareEntries];
    }
  }

  return cachedEntries
    .map((entry, index) =>
      buildStatisticsCompareEntry(entry, {
        key: getStatisticsCompareFallbackKey(entry, index),
        isReference: index === 0,
      }),
    )
    .filter(isCompareEntry);
}

/** @param {EntriesRef} entriesRef */
export function getBuiltProfileCount(entriesRef) {
  const cachedEntries = Array.isArray(entriesRef.current) ? entriesRef.current : [];
  /** @type {Set<string>} */
  const profileNames = new Set();

  cachedEntries.forEach(entry => {
    const rawName = entry?.meta?.profileName || getProfileDisplayLabel(entry?.profileData, '');
    const cleanedName = cleanName(rawName || '');
    if (cleanedName) {
      profileNames.add(cleanedName);
    }
  });

  return profileNames.size;
}

/**
 * @param {EntriesRef} entriesRef
 * @param {DateBasisMode} dateBasisMode
 * @returns {{ startMs: number | null, endMs: number | null }}
 */
export function getBuiltDateRange(entriesRef, dateBasisMode) {
  const cachedEntries = Array.isArray(entriesRef.current) ? entriesRef.current : [];
  const timestamps = cachedEntries
    .map(entry => resolveShotEffectiveTimestampMs(entry?.shotData || entry?.meta, dateBasisMode))
    .filter(
      /** @returns {value is number} */
      value => value !== null && Number.isFinite(value) && value > 0,
    )
    .sort((a, b) => a - b);

  if (timestamps.length === 0) {
    return { startMs: null, endMs: null };
  }

  return {
    startMs: timestamps[0],
    endMs: timestamps[timestamps.length - 1],
  };
}

/**
 * @param {{ timestamp?: number, shotDate?: number, uploadedAt?: number } | null | undefined} shotMeta
 * @param {DateBasisMode} dateBasisMode
 * @returns {number | null}
 */
function resolveShotEffectiveTimestampMs(shotMeta, dateBasisMode) {
  if (dateBasisMode === 'shot' || dateBasisMode === 'auto') {
    const ts = shotMeta?.timestamp || shotMeta?.shotDate || 0;
    if (Number.isFinite(ts) && ts > 0) return Number(ts);
  }
  if (dateBasisMode === 'upload' || dateBasisMode === 'auto') {
    const ts = shotMeta?.uploadedAt || 0;
    if (Number.isFinite(ts) && ts > 0) return Number(ts);
  }
  return null;
}
