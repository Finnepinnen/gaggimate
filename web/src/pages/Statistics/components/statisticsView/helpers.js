// Pure helper functions for StatisticsView: date parsing, profile/shot pinning, selection, candidate filtering, and display formatting
import {
  cleanName,
  getProfileDisplayLabel,
  getProfilePinKey,
  getShotDisplayName,
  getShotPinBucketKey,
  isProfilePinned,
  isShotPinned,
  MAX_PINNED_PROFILES,
  MAX_PINNED_SHOTS_PER_PROFILE,
  PINNED_NO_PROFILE_BUCKET,
} from '../../../ShotAnalyzer/utils/analyzerUtils';
import { resolveShotEffectiveTimestampMs } from '../../utils/statisticsSearchDsl';
import { STATISTICS_SOURCE_FALLBACK } from '../../utils/statisticsRoute';
import { t } from '@lingui/core/macro';

/**
 * Number.isFinite as a type guard.
 * @param {unknown} value
 * @returns {value is number}
 */
const isFiniteNumber = value => Number.isFinite(value);

/**
 * @typedef {import('../../types').DateBasisMode} DateBasisMode
 * @typedef {import('../../types').StatisticsMode} StatisticsMode
 * @typedef {import('../../types').StatisticsSource} StatisticsSource
 * @typedef {import('../../types').StatisticsDetailSection} StatisticsDetailSection
 * @typedef {import('../../types').StatisticsInitialContext} StatisticsInitialContext
 * @typedef {import('../../types').StatisticsShotMeta} StatisticsShotMeta
 * @typedef {import('../../types').StatisticsProfileMeta} StatisticsProfileMeta
 * @typedef {import('../../types').StatisticsEntry} StatisticsEntry
 * @typedef {import('../../types').StatisticsCompareEntry} StatisticsCompareEntry
 * @typedef {import('../../types').ShotSelectionBaseItem} ShotSelectionBaseItem
 * @typedef {import('../../types').PinnedShotsByProfile} PinnedShotsByProfile
 * @typedef {import('../../types').ShotCandidateFilter} ShotCandidateFilter
 * @typedef {import('../../types').ParsedDateInput} ParsedDateInput
 * @typedef {import('../../types').StatisticsFilterState} StatisticsFilterState
 * @typedef {import('../../types').DateBasisWarningState} DateBasisWarningState
 * @typedef {Map<string, string | null>} ShotKeyToCanonicalProfile
 * @typedef {{
 *   hasCompareStatistics: boolean,
 *   hasMetricStatistics: boolean,
 *   hasTrendStatistics: boolean,
 *   hasProfileGroupStatistics: boolean,
 *   hasPhaseStatistics: boolean,
 * }} DetailSectionAvailability
 */

/**
 * @param {string} source
 * @returns {StatisticsSource | null}
 */
export function getStatisticsFallbackSource(source) {
  return STATISTICS_SOURCE_FALLBACK[source] || null;
}

/**
 * @param {StatisticsInitialContext | null | undefined} initialContext
 * @returns {string}
 */
export function getInitialProfileName(initialContext) {
  const profileName = initialContext?.profileName;
  if (profileName && profileName !== 'No Profile Loaded') return profileName;
  return '';
}

/**
 * @param {StatisticsProfileMeta[] | null | undefined} profileList
 * @returns {string[]}
 */
export function getAvailableProfileNames(profileList) {
  /** @type {string[]} */
  const profileNames = [];
  for (const p of profileList || []) {
    const displayName = getProfileDisplayLabel(p, '');
    if (displayName) profileNames.push(displayName);
  }
  profileNames.sort((a, b) => a.localeCompare(b));
  return [...new Set(profileNames)];
}

/**
 * @param {string | null | undefined} value - `YYYY-MM-DD` or any Date-parsable string
 * @param {'start' | 'end'} [boundary] - Time of day for date-only values
 * @returns {ParsedDateInput}
 */
export function parseDateInputMs(value, boundary = 'start') {
  if (!value) return { valueMs: null, error: null };

  const normalizedValue = String(value).trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedValue);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const yearNum = Number(year);
    const monthNum = Number(month);
    const dayNum = Number(day);
    const date = new Date(
      yearNum,
      monthNum - 1,
      dayNum,
      boundary === 'end' ? 23 : 0,
      boundary === 'end' ? 59 : 0,
      boundary === 'end' ? 59 : 0,
      boundary === 'end' ? 999 : 0,
    );
    if (
      date.getFullYear() !== yearNum ||
      date.getMonth() + 1 !== monthNum ||
      date.getDate() !== dayNum
    ) {
      return { valueMs: null, error: t`Invalid date: ${value}` };
    }
    const valueMs = date.getTime();
    if (!Number.isFinite(valueMs)) {
      return { valueMs: null, error: t`Invalid date: ${value}` };
    }
    return { valueMs, error: null };
  }

  const date = new Date(normalizedValue);
  const valueMs = date.getTime();
  if (!Number.isFinite(valueMs)) {
    return { valueMs: null, error: t`Invalid date/time: ${value}` };
  }
  return { valueMs, error: null };
}

/** @param {number} ms */
export function formatDateTimeLocalInputValue(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * @param {StatisticsShotMeta | null | undefined} shotMeta
 * @returns {string}
 */
export function getShotSelectionKey(shotMeta) {
  if (!shotMeta) return '';
  if (shotMeta.source === 'gaggimate') return `gaggimate:${String(shotMeta.id || '')}`;
  return `browser:${String(shotMeta.storageKey || shotMeta.name || shotMeta.id || '')}`;
}

/** @param {string | undefined} source */
export function getSourceShortLabel(source) {
  if (source === 'gaggimate') return 'GM';
  if (source === 'browser') return 'WEB';
  return 'SRC';
}

/** @param {number | null} ms */
export function formatShotDateTime(ms) {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return t`No date`;
  try {
    return new Date(ms).toLocaleString(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return t`No date`;
  }
}

/** @param {StatisticsShotMeta | null | undefined} shotMeta */
export function getShotDisplayPrimary(shotMeta) {
  return String(
    shotMeta?.name || shotMeta?.label || shotMeta?.title || shotMeta?.id || t`Unknown Shot`,
  );
}

/** @param {string | null | undefined} value */
function stripFileExtension(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/\.[^./\\]{1,8}$/, '');
}

/** @param {StatisticsShotMeta | null | undefined} shotMeta */
export function getShotFileStem(shotMeta) {
  const fileName = shotMeta?.name || shotMeta?.storageKey;
  if (fileName) return String(stripFileExtension(fileName));
  return String(shotMeta?.label || shotMeta?.title || shotMeta?.id || t`Unknown Shot`);
}

/**
 * @param {StatisticsShotMeta | null | undefined} shotMeta
 * @param {DateBasisMode | null | undefined} dateBasisMode
 */
export function getShotDisplaySecondary(shotMeta, dateBasisMode) {
  const ts = resolveShotEffectiveTimestampMs(shotMeta, dateBasisMode || 'auto');
  return `${formatShotDateTime(ts)} • ${getSourceShortLabel(shotMeta?.source)}`;
}

/** @param {EventTarget | null} target */
export function isStatisticsHotkeyBlockedTarget(target) {
  const activeElement =
    typeof Element !== 'undefined' && target instanceof Element ? target : document.activeElement;
  if (!activeElement) return false;
  const tag = activeElement.tagName?.toLowerCase();
  if (/** @type {HTMLElement} */ (activeElement).isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return true;
  return !!activeElement.closest(
    'input, textarea, select, button, summary, a[href], [contenteditable="true"], [role="textbox"]',
  );
}

/**
 * @param {StatisticsShotMeta} shot
 * @param {DateBasisMode} dateBasisMode
 * @returns {ShotSelectionBaseItem}
 */
export function buildShotSelectionItem(shot, dateBasisMode) {
  return {
    id: getShotSelectionKey(shot),
    primary: getShotDisplayPrimary(shot),
    fileStem: getShotFileStem(shot),
    shotId: String(shot?.id || shot?.storageKey || shot?.name || ''),
    secondary: getShotDisplaySecondary(shot, dateBasisMode),
    searchText: `${shot?.id || ''} ${shot?.profile || ''} ${shot?.name || ''} ${shot?.source || ''}`,
  };
}

/**
 * @param {StatisticsEntry | null | undefined} entry
 * @param {number} index
 * @returns {string}
 */
export function getStatisticsCompareFallbackKey(entry, index) {
  return (
    entry?.meta?.selectionKey || `${entry?.meta?.source || 'shot'}:${entry?.meta?.id || index}`
  );
}

/**
 * @param {StatisticsEntry | null | undefined} entry
 * @param {object} [options]
 * @param {string} [options.key]
 * @param {boolean} [options.isReference]
 * @returns {StatisticsCompareEntry | null}
 */
export function buildStatisticsCompareEntry(entry, { key, isReference = false } = {}) {
  if (!entry?.shotData || !entry?.analysis) return null;

  return {
    // Every caller passes a key.
    key: /** @type {string} */ (key),
    shot: entry.shotData,
    shotName: entry.shotData.name || entry.meta?.id,
    label: entry.meta?.displayName || getShotDisplayName(entry.shotData),
    profile: entry.profileData || null,
    profileName: entry.meta?.profileName,
    results: entry.analysis,
    isReference,
  };
}

/**
 * @param {{ runMode: StatisticsMode | undefined } & Omit<DetailSectionAvailability, 'hasProfileGroupStatistics' | 'hasPhaseStatistics'>} args
 * @returns {StatisticsDetailSection}
 */
export function getPreferredStatisticsDetailSection({
  runMode,
  hasCompareStatistics,
  hasMetricStatistics,
  hasTrendStatistics,
}) {
  if (hasMetricStatistics) return 'metrics';
  if (hasTrendStatistics) return 'trends';
  if (hasCompareStatistics) return 'compare';
  return runMode === 'profile' ? 'phase' : 'profile';
}

/**
 * @param {unknown} value
 * @returns {StatisticsDetailSection | null}
 */
export function normalizeStatisticsDetailSection(value) {
  return ['metrics', 'trends', 'compare', 'profile', 'phase'].includes(
    /** @type {string} */ (value),
  )
    ? /** @type {StatisticsDetailSection} */ (value)
    : null;
}

/**
 * @param {{ candidate: StatisticsDetailSection } & DetailSectionAvailability} args
 * @returns {StatisticsDetailSection}
 */
export function resolveStatisticsDetailSectionChoice({
  candidate,
  hasCompareStatistics,
  hasMetricStatistics,
  hasTrendStatistics,
  hasProfileGroupStatistics,
  hasPhaseStatistics,
}) {
  /** @type {Record<StatisticsDetailSection, boolean>} */
  const availabilityBySection = {
    compare: hasCompareStatistics,
    metrics: hasMetricStatistics,
    trends: hasTrendStatistics,
    profile: hasProfileGroupStatistics,
    phase: hasPhaseStatistics,
  };

  if (availabilityBySection[candidate]) {
    return candidate;
  }

  /** @type {StatisticsDetailSection[]} */
  const fallbackOrder = ['compare', 'metrics', 'trends', 'profile', 'phase'];
  const fallbackSection = fallbackOrder.find(section => availabilityBySection[section]);
  if (fallbackSection) {
    return fallbackSection;
  }

  return candidate;
}

/**
 * @param {StatisticsShotMeta} shotMeta
 * @param {ShotKeyToCanonicalProfile} shotKeyToCanonicalProfile
 */
export function getCanonicalShotProfilePinKeyFromMap(shotMeta, shotKeyToCanonicalProfile) {
  const shotKey = getShotSelectionKey(shotMeta);
  const canonicalProfile = shotKeyToCanonicalProfile.get(shotKey);
  return canonicalProfile
    ? getProfilePinKey(canonicalProfile)
    : getProfilePinKey(shotMeta?.profile || shotMeta?.profileName || '');
}

/**
 * @param {StatisticsShotMeta} shotMeta
 * @param {object} pins
 * @param {ShotKeyToCanonicalProfile} pins.shotKeyToCanonicalProfile
 * @param {PinnedShotsByProfile} pins.pinnedShotsByProfile
 * @param {string[]} pins.pinnedProfiles
 */
export function matchesPinnedShotMetaWithPins(
  shotMeta,
  { shotKeyToCanonicalProfile, pinnedShotsByProfile, pinnedProfiles },
) {
  const shotKey = getShotSelectionKey(shotMeta);
  const profilePinKey = getCanonicalShotProfilePinKeyFromMap(shotMeta, shotKeyToCanonicalProfile);
  return (
    isShotPinnedAnywhere(shotKey, pinnedShotsByProfile) ||
    (profilePinKey ? isProfilePinned(profilePinKey, pinnedProfiles) : false)
  );
}

/**
 * @param {string} shotKey
 * @param {PinnedShotsByProfile} pinnedShotsByProfile
 */
function isShotPinnedAnywhere(shotKey, pinnedShotsByProfile) {
  if (!shotKey) return false;
  return Object.values(pinnedShotsByProfile).some(bucket => bucket.includes(shotKey));
}

/**
 * @param {string} profileName
 * @param {string[]} pinnedProfiles
 */
export function getProfilePinDisabledReasonText(profileName, pinnedProfiles) {
  if (isProfilePinned(profileName, pinnedProfiles)) return '';
  if (pinnedProfiles.length >= MAX_PINNED_PROFILES) {
    const maxPinned = MAX_PINNED_PROFILES;
    return t`Maximum ${maxPinned} pinned profiles`;
  }
  return '';
}

/**
 * @param {StatisticsShotMeta} shotMeta
 * @param {ShotKeyToCanonicalProfile} shotKeyToCanonicalProfile
 * @param {PinnedShotsByProfile} pinnedShotsByProfile
 */
export function getShotPinDisabledReasonText(
  shotMeta,
  shotKeyToCanonicalProfile,
  pinnedShotsByProfile,
) {
  const bucketKey =
    getCanonicalShotProfilePinKeyFromMap(shotMeta, shotKeyToCanonicalProfile) ||
    getShotPinBucketKey(shotMeta);
  if (isShotPinned(shotMeta, bucketKey, pinnedShotsByProfile)) return '';

  const pinnedCount = (pinnedShotsByProfile[bucketKey] || []).length;
  if (pinnedCount >= MAX_PINNED_SHOTS_PER_PROFILE) {
    const maxPinned = MAX_PINNED_SHOTS_PER_PROFILE;
    return bucketKey === PINNED_NO_PROFILE_BUCKET
      ? t`Maximum ${maxPinned} pinned shots without a profile`
      : t`Maximum ${maxPinned} pinned shots per profile`;
  }

  return '';
}

/**
 * @param {StatisticsShotMeta[] | null | undefined} rawShotCandidates
 * @returns {DateBasisWarningState}
 */
export function buildDateBasisWarningState(rawShotCandidates) {
  let missingShotTimestampCount = 0;
  let uploadFallbackCount = 0;
  let noUsableDateCount = 0;

  for (const shot of rawShotCandidates || []) {
    const shotTs = resolveShotEffectiveTimestampMs(shot, 'shot');
    if (Number.isFinite(shotTs)) continue;

    missingShotTimestampCount += 1;
    const uploadTs = resolveShotEffectiveTimestampMs(shot, 'upload');
    if (Number.isFinite(uploadTs)) uploadFallbackCount += 1;
    else noUsableDateCount += 1;
  }

  const showDateBasisWarning = missingShotTimestampCount > 0;
  let dateBasisWarningMessage = null;

  if (showDateBasisWarning) {
    if (uploadFallbackCount > 0 && noUsableDateCount > 0) {
      dateBasisWarningMessage = t`Some shots have no shot timestamp. Choose how date handling should treat them (Shot = exclude missing, Auto = fallback to upload time, Upload = upload time only). Some shots have no usable date at all and may still be excluded from date filtering.`;
    } else if (uploadFallbackCount > 0) {
      dateBasisWarningMessage = t`Some shots have no shot timestamp. Choose how date handling should treat them (Shot = exclude missing, Auto = fallback to upload time, Upload = upload time only).`;
    } else {
      dateBasisWarningMessage = t`Some shots have no usable shot timestamp. Date filtering may exclude them unless upload time is available.`;
    }
  }

  return {
    showDateBasisWarning,
    dateBasisWarningMessage,
    missingShotTimestampCount,
    uploadFallbackCount,
    noUsableDateCount,
  };
}

/**
 * @param {object} args
 * @param {ShotCandidateFilter} args.compiledDslFilter
 * @param {ParsedDateInput} args.visualDateFrom
 * @param {ParsedDateInput} args.visualDateTo
 * @param {DateBasisMode} args.dateBasisMode
 * @param {StatisticsShotMeta[] | null | undefined} args.rawShotCandidates
 * @returns {StatisticsFilterState}
 */
export function buildBaseFilterState({
  compiledDslFilter,
  visualDateFrom,
  visualDateTo,
  dateBasisMode,
  rawShotCandidates,
}) {
  const parseErrors = [...compiledDslFilter.errors];
  const parseWarnings = [...compiledDslFilter.warnings];

  if (visualDateFrom.error) {
    parseErrors.push({
      code: 'visual_date_from_invalid',
      message: visualDateFrom.error,
    });
  }
  if (visualDateTo.error) {
    parseErrors.push({
      code: 'visual_date_to_invalid',
      message: visualDateTo.error,
    });
  }

  const fromMs = visualDateFrom.valueMs;
  const toMs = visualDateTo.valueMs;
  if (isFiniteNumber(fromMs) && isFiniteNumber(toMs) && fromMs > toMs) {
    parseErrors.push({
      code: 'visual_date_range_invalid',
      message: t`Date range invalid: From is after To.`,
    });
  }

  if (parseErrors.length > 0) {
    return { filteredShots: [], count: null, parseErrors, parseWarnings };
  }

  const filteredShots = (rawShotCandidates || []).filter(shot => {
    if (isFiniteNumber(fromMs) || isFiniteNumber(toMs)) {
      const ts = resolveShotEffectiveTimestampMs(shot, dateBasisMode);
      if (!isFiniteNumber(ts)) return false;
      if (isFiniteNumber(fromMs) && ts < fromMs) return false;
      if (isFiniteNumber(toMs) && ts > toMs) return false;
    }

    return compiledDslFilter.predicate(shot);
  });

  return {
    filteredShots,
    count: filteredShots.length,
    parseErrors,
    parseWarnings,
  };
}

/**
 * @param {object} args
 * @param {StatisticsFilterState} args.baseFilterState
 * @param {StatisticsMode} args.mode
 * @param {string[]} args.selectedProfileNames
 * @param {string[]} args.selectedShotKeys
 * @param {ShotKeyToCanonicalProfile} args.shotKeyToCanonicalProfile
 * @returns {StatisticsFilterState}
 */
export function buildCandidateFilterState({
  baseFilterState,
  mode,
  selectedProfileNames,
  selectedShotKeys,
  shotKeyToCanonicalProfile,
}) {
  const parseErrors = [...baseFilterState.parseErrors];
  const parseWarnings = [...baseFilterState.parseWarnings];

  if (parseErrors.length > 0) {
    return { filteredShots: [], count: null, parseErrors, parseWarnings };
  }
  if (mode === 'profile' && selectedProfileNames.length === 0) {
    return { filteredShots: [], count: 0, parseErrors, parseWarnings };
  }
  if (mode === 'shots' && selectedShotKeys.length === 0) {
    return { filteredShots: [], count: 0, parseErrors, parseWarnings };
  }

  const selectedProfileSet = new Set(
    selectedProfileNames.map(name => cleanName(name).toLowerCase()),
  );
  const selectedShotKeySetLocal = new Set(selectedShotKeys);
  const filteredShots = (baseFilterState.filteredShots || []).filter(shot => {
    const shotKey = getShotSelectionKey(shot);
    if (!shotKey) return false;

    if (mode === 'profile') {
      const canonical = shotKeyToCanonicalProfile.get(shotKey);
      const profileKey = canonical ? cleanName(canonical).toLowerCase() : '';
      if (!selectedProfileSet.has(profileKey)) return false;
      if (!selectedShotKeySetLocal.has(shotKey)) return false;
    } else if (mode === 'shots' && !selectedShotKeySetLocal.has(shotKey)) {
      return false;
    }

    return true;
  });

  return {
    filteredShots,
    count: filteredShots.length,
    parseErrors,
    parseWarnings,
  };
}

/**
 * @param {{ mode: StatisticsMode, selectedProfileNames: string[], selectedShotKeys: string[] }} args
 * @returns {string | null}
 */
export function getStatisticsSelectionHint({ mode, selectedProfileNames, selectedShotKeys }) {
  if (mode === 'profile' && selectedProfileNames.length === 0) {
    return t`Select one or more profiles.`;
  }
  if (mode === 'shots' && selectedShotKeys.length === 0) {
    return t`Select one or more shots.`;
  }
  return null;
}
