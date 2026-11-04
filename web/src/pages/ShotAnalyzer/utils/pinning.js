import {
  ANALYZER_DB_KEYS,
  MAX_PINNED_PROFILES,
  MAX_PINNED_SHOTS_PER_PROFILE,
  PINNED_NO_PROFILE_BUCKET,
} from './constants';
import { cleanName } from './formatting';
import { loadFromStorage, saveToStorage } from './storage';
import { resolveProfileFieldValue } from './profiles';

/** @typedef {import('../types').AnalyzerShot} AnalyzerShot */
/** @typedef {Pick<AnalyzerShot, 'id' | 'name' | 'storageKey'> & { source?: string }} ShotKeyFields source: LibrarySource */
/**
 * Anything with a profile name: a profile, a shot (`profile`), or a grouped list row.
 * @typedef {import('./profiles').NamedLibraryItem & { canonicalProfileName?: string, profileName?: string, profile?: string }} ProfilePinSubject
 */
/** @typedef {Record<string, string[]>} PinnedShotsByProfile Shot identity keys by profile pin key */
/**
 * @typedef {object} ProfilePinToggleResult
 * @property {boolean} changed
 * @property {'invalid-profile' | 'profile-limit' | null} reason
 * @property {string[]} pinnedProfiles
 * @property {string} [profileKey]
 */
/**
 * @typedef {object} ShotPinToggleResult
 * @property {boolean} changed
 * @property {'invalid-shot' | 'shot-limit' | null} reason
 * @property {PinnedShotsByProfile} pinnedShotsByProfile
 * @property {string} bucketKey
 * @property {string} [shotKey]
 */

/**
 * @template {string | number} [Id=string]
 * @param {(Omit<ShotKeyFields, 'id'> & { id?: Id }) | null | undefined} shot
 * @returns {string | Id} Load key: device id for GaggiMate shots, else the storage key
 */
export const getShotStorageKey = shot => {
  if (!shot) return '';
  // GaggiMate shots always carry their device id.
  return shot.source === 'gaggimate'
    ? /** @type {Id} */ (shot.id)
    : shot.storageKey || shot.name || shot.id || '';
};

/**
 * @param {(Omit<ShotKeyFields, 'id'> & { id?: string | number }) | null | undefined} shot
 * @returns {string} '<source>:<storage key>', '' without a shot
 */
export const getShotIdentityKey = shot => {
  if (!shot) return '';

  const source = shot.source || 'temp';
  const storageKey = String(getShotStorageKey(shot) || '');
  if (source === 'gaggimate') return `gaggimate:${storageKey}`;
  if (source === 'temp') return `temp:${storageKey}`;

  return `browser:${storageKey}`;
};

/**
 * @param {ProfilePinSubject | string | null | undefined} profile
 * @returns {string} Normalized lower-case profile name, '' if none
 */
export const getProfilePinKey = profile => {
  if (!profile) return '';

  if (typeof profile === 'string') {
    const normalized = cleanName(profile).trim().toLowerCase();
    return normalized === 'no profile loaded' ? '' : normalized;
  }

  const rawValue =
    profile.canonicalProfileName ||
    profile.profileName ||
    profile.profile ||
    resolveProfileFieldValue(profile) ||
    '';

  const normalized = cleanName(rawValue).trim().toLowerCase();
  return normalized === 'no profile loaded' ? '' : normalized;
};

/**
 * @param {ProfilePinSubject | string | null | undefined} shot
 * @returns {string}
 */
export const getShotPinBucketKey = shot => {
  const profileKey = getProfilePinKey(shot);
  return profileKey || PINNED_NO_PROFILE_BUCKET;
};

/**
 * @param {unknown} rawValue Stored JSON
 * @returns {string[]}
 */
function normalizePinnedProfiles(rawValue) {
  if (!Array.isArray(rawValue)) return [];

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {string[]} */
  const normalized = [];
  for (const entry of rawValue) {
    const key = getProfilePinKey(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  return normalized;
}

/**
 * @param {unknown} rawValue Stored JSON
 * @returns {PinnedShotsByProfile}
 */
function normalizePinnedShotsByProfile(rawValue) {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) return {};

  /** @type {PinnedShotsByProfile} */
  const normalized = {};

  Object.entries(rawValue).forEach(([bucketKey, shotKeys]) => {
    const resolvedBucketKey = String(bucketKey || '').trim() || PINNED_NO_PROFILE_BUCKET;
    if (!Array.isArray(shotKeys)) return;

    /** @type {Set<string>} */
    const seen = new Set();
    /** @type {string[]} */
    const normalizedShotKeys = [];
    shotKeys.forEach(shotKey => {
      const nextShotKey = String(shotKey || '').trim();
      if (!nextShotKey || seen.has(nextShotKey)) return;
      seen.add(nextShotKey);
      normalizedShotKeys.push(nextShotKey);
    });

    if (normalizedShotKeys.length > 0) {
      normalized[resolvedBucketKey] = normalizedShotKeys;
    }
  });

  return normalized;
}

/** @returns {string[]} */
export const getPinnedProfiles = () =>
  normalizePinnedProfiles(loadFromStorage(ANALYZER_DB_KEYS.PINNED_PROFILES, []));

/** @returns {PinnedShotsByProfile} */
export const getPinnedShotsByProfile = () =>
  normalizePinnedShotsByProfile(loadFromStorage(ANALYZER_DB_KEYS.PINNED_SHOTS_BY_PROFILE, {}));

/**
 * @param {ProfilePinSubject | string | null | undefined} profile
 * @param {string[]} [pinnedProfiles]
 * @returns {boolean}
 */
export const isProfilePinned = (profile, pinnedProfiles = getPinnedProfiles()) =>
  pinnedProfiles.includes(getProfilePinKey(profile));

/**
 * @param {(ShotKeyFields & ProfilePinSubject) | string} shot Shot or shot identity key
 * @param {string} [bucketKey]
 * @param {PinnedShotsByProfile} [pinnedShotsByProfile]
 * @returns {boolean}
 */
export const isShotPinned = (
  shot,
  bucketKey = getShotPinBucketKey(shot),
  pinnedShotsByProfile = getPinnedShotsByProfile(),
) => {
  const shotKey = typeof shot === 'string' ? shot : getShotIdentityKey(shot);
  if (!shotKey) return false;
  return (pinnedShotsByProfile[bucketKey] || []).includes(shotKey);
};

/**
 * @param {ShotKeyFields | string} shot Shot or shot identity key
 * @param {PinnedShotsByProfile} [pinnedShotsByProfile]
 * @returns {boolean}
 */
export const isShotPinnedAnywhere = (shot, pinnedShotsByProfile = getPinnedShotsByProfile()) => {
  const shotKey = typeof shot === 'string' ? shot : getShotIdentityKey(shot);
  if (!shotKey) return false;
  return Object.values(pinnedShotsByProfile).some(bucket => bucket.includes(shotKey));
};

/**
 * @param {ProfilePinSubject | string | null | undefined} profile
 * @returns {ProfilePinToggleResult}
 */
export const toggleProfilePin = profile => {
  const profileKey = getProfilePinKey(profile);
  const pinnedProfiles = getPinnedProfiles();
  if (!profileKey) {
    return { changed: false, reason: 'invalid-profile', pinnedProfiles };
  }

  const isPinned = pinnedProfiles.includes(profileKey);
  if (!isPinned && pinnedProfiles.length >= MAX_PINNED_PROFILES) {
    return { changed: false, reason: 'profile-limit', pinnedProfiles };
  }

  const nextPinnedProfiles = isPinned
    ? pinnedProfiles.filter(entry => entry !== profileKey)
    : [...pinnedProfiles, profileKey];

  saveToStorage(ANALYZER_DB_KEYS.PINNED_PROFILES, nextPinnedProfiles);
  return { changed: true, reason: null, pinnedProfiles: nextPinnedProfiles, profileKey };
};

/**
 * @param {(ShotKeyFields & ProfilePinSubject) | string} shot Shot or shot identity key
 * @param {string} [explicitBucketKey]
 * @returns {ShotPinToggleResult}
 */
export const toggleShotPin = (shot, explicitBucketKey = '') => {
  const shotKey = typeof shot === 'string' ? shot : getShotIdentityKey(shot);
  const bucketKey = explicitBucketKey || getShotPinBucketKey(shot);
  const pinnedShotsByProfile = getPinnedShotsByProfile();

  if (!shotKey) {
    return { changed: false, reason: 'invalid-shot', pinnedShotsByProfile, bucketKey };
  }

  const currentBucket = [...(pinnedShotsByProfile[bucketKey] || [])];
  const isPinned = currentBucket.includes(shotKey);

  if (!isPinned && currentBucket.length >= MAX_PINNED_SHOTS_PER_PROFILE) {
    return { changed: false, reason: 'shot-limit', pinnedShotsByProfile, bucketKey };
  }

  const nextBucket = isPinned
    ? currentBucket.filter(entry => entry !== shotKey)
    : [...currentBucket, shotKey];

  const nextPinnedShotsByProfile = { ...pinnedShotsByProfile };
  if (nextBucket.length > 0) {
    nextPinnedShotsByProfile[bucketKey] = nextBucket;
  } else {
    delete nextPinnedShotsByProfile[bucketKey];
  }

  saveToStorage(ANALYZER_DB_KEYS.PINNED_SHOTS_BY_PROFILE, nextPinnedShotsByProfile);
  return {
    changed: true,
    reason: null,
    pinnedShotsByProfile: nextPinnedShotsByProfile,
    bucketKey,
    shotKey,
  };
};
