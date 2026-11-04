/**
 * LibraryService.js
 *
 * Unified service for loading shots and profiles from multiple sources:
 * - GaggiMate Controller (via API)
 * - Browser Uploads (via IndexedDB)
 */

import { t } from '@lingui/core/macro';
import { parseBinaryIndex, indexToShotList } from '../../ShotHistory/parseBinaryIndex';
import { parseBinaryShot } from '../../ShotHistory/parseBinaryShot';
import { indexedDBService } from './IndexedDBService';
import { notesService } from './NotesService';
import { getProfileDisplayLabel, getShotStorageKey } from '../utils/analyzerUtils';

/** @typedef {import('../../../types').ShotSample} ShotSample */
/** @typedef {import('../../../types').ShotNotes} ShotNotes */
/** @typedef {import('../types').AnalyzerShot} AnalyzerShot */
/** @typedef {import('../types').AnalyzerProfile} AnalyzerProfile */
/** @typedef {import('../types').LibrarySource} LibrarySource */
/** @typedef {import('../types').LibrarySourceFilter} LibrarySourceFilter */
/** @typedef {Required<Omit<ShotNotes, 'id' | 'rating'>> & { id: string, rating: number }} HistoryExportNotes */
/** @typedef {{ total: number, shots: number, profiles: number }} SourceStats */

/** @type {HistoryExportNotes} */
const HISTORY_NOTES_DEFAULTS = {
  id: '',
  rating: 0,
  beanType: '',
  doseIn: '',
  doseOut: '',
  ratio: '',
  grindSetting: '',
  balanceTaste: 'balanced',
  notes: '',
};

/**
 * @template {number | null | undefined} T
 * @param {T} v
 * @returns {T}
 */
function round2(v) {
  if (v == null || Number.isNaN(v)) return v;
  return /** @type {T} */ (Math.round((v + Number.EPSILON) * 100) / 100);
}

/**
 * @param {ShotSample} [sample]
 * @returns {ShotSample}
 */
function normalizeShotSampleForHistoryExport(sample = /** @type {ShotSample} */ ({})) {
  return {
    t: sample.t,
    tt: round2(sample.tt),
    ct: round2(sample.ct),
    tp: round2(sample.tp),
    cp: round2(sample.cp),
    fl: round2(sample.fl),
    tf: round2(sample.tf),
    pf: round2(sample.pf),
    vf: round2(sample.vf),
    v: round2(sample.v),
    ev: round2(sample.ev),
    pr: round2(sample.pr),
    wp: round2(sample.wp),
    systemInfo: sample.systemInfo,
    phaseNumber: sample.phaseNumber,
    phaseDisplayNumber: sample.phaseDisplayNumber,
  };
}

/**
 * @param {Partial<import('../types').AnalyzerNotes> | null | undefined} notes
 * @param {string | number | undefined} shotId
 * @returns {HistoryExportNotes}
 */
function normalizeNotesForHistoryExport(notes, shotId) {
  const merged = {
    ...HISTORY_NOTES_DEFAULTS,
    ...notes,
    id: String(shotId ?? notes?.id ?? ''),
  };

  return {
    id: merged.id,
    rating: merged.rating ?? 0,
    beanType: merged.beanType ?? '',
    doseIn: merged.doseIn ?? '',
    doseOut: merged.doseOut ?? '',
    ratio: merged.ratio ?? '',
    grindSetting: merged.grindSetting ?? '',
    balanceTaste: merged.balanceTaste ?? 'balanced',
    notes: merged.notes ?? '',
  };
}

/**
 * @param {AnalyzerShot} rawShot
 * @param {AnalyzerShot} listItem
 * @param {Partial<import('../types').AnalyzerNotes> | null} notes
 */
function buildHistoryLikeShotExport(rawShot, listItem, notes) {
  const shotId = rawShot?.id ?? listItem?.id ?? listItem?.name ?? '';

  const base = {
    id: String(shotId),
    profile: rawShot?.profile || listItem?.profile || '',
    profileId: rawShot?.profileId || listItem?.profileId || '',
    timestamp: rawShot?.timestamp,
    duration: rawShot?.duration,
    samples: Array.isArray(rawShot?.samples)
      ? rawShot.samples.map(normalizeShotSampleForHistoryExport)
      : [],
    volume: listItem?.volume ?? rawShot?.volume ?? null,
    rating: listItem?.rating ?? null,
    incomplete: listItem?.incomplete ?? rawShot?.incomplete ?? false,
    notes: normalizeNotesForHistoryExport(notes, shotId),
    loaded: true,
    data: /** @type {null} */ (null),
  };

  return {
    ...base,
    ...rawShot,
    samples: base.samples,
    volume: round2(base.volume),
    rating: base.rating,
    incomplete: base.incomplete,
    notes: base.notes,
    loaded: true,
    data: /** @type {null} */ (null),
  };
}

const PROFILE_EXPORT_METADATA_FIELDS = [
  'id',
  'selected',
  'favorite',
  'name',
  'source',
  'uploadedAt',
  'exportName',
  'fileName',
  'profileId',
  'storageKey',
  'data',
];

/**
 * @param {string | number | null | undefined} filename
 * @returns {string}
 */
function ensureJsonFilename(filename) {
  const resolvedFilename = String(filename || 'export.json');
  if (
    resolvedFilename.toLowerCase().endsWith('.json') ||
    resolvedFilename.toLowerCase().endsWith('.slog')
  ) {
    return resolvedFilename;
  }
  return `${resolvedFilename}.json`;
}

/**
 * @param {AnalyzerProfile} profile
 * @param {string} [fallback]
 * @returns {string}
 */
function getProfileExportFilename(profile, fallback = 'profile') {
  const label = getProfileDisplayLabel(profile, fallback);
  return ensureJsonFilename(label || fallback || 'profile');
}

/**
 * @param {AnalyzerShot} item
 * @returns {string}
 */
function getShotExportFilename(item) {
  if (item?.exportName) return ensureJsonFilename(item.exportName);
  if (item?.id) return ensureJsonFilename(`shot-${item.id}`);
  return ensureJsonFilename(item?.storageKey || item?.fileName || item?.name || 'shot');
}

/**
 * @param {AnalyzerProfile} profile
 * @param {AnalyzerProfile | null} [fallbackProfile]
 * @returns {AnalyzerProfile}
 */
function cleanProfileForExport(profile, fallbackProfile = null) {
  const clean = { ...profile };
  if (!clean.label && fallbackProfile) {
    clean.label = getProfileDisplayLabel(fallbackProfile, '');
  }

  PROFILE_EXPORT_METADATA_FIELDS.forEach(field => {
    delete clean[/** @type {keyof AnalyzerProfile} */ (field)];
  });

  return clean;
}

class LibraryService {
  /** @type {import('../../../services/ApiService.js').default | null} */
  apiService = null;

  /**
   * Set API service reference
   * @param {import('../../../services/ApiService.js').default} apiService
   */
  setApiService(apiService) {
    this.apiService = apiService;
  }

  /**
   * Get shots from GaggiMate controller
   * @returns {Promise<AnalyzerShot[]>} List of GaggiMate shots with source tag
   */
  async getGaggiMateShots() {
    try {
      const response = await fetch('/api/history/index.bin');

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const indexData = parseBinaryIndex(arrayBuffer);
      const shotList = indexToShotList(indexData);

      // Add source tag and ensure name property exists
      return shotList.map(
        /** @returns {AnalyzerShot} */
        shot => ({
          ...shot,
          name: shot.profile || shot.id || 'Unknown', // Display Name for UI (e.g. "Turbo Bloom")
          exportName: `shot-${shot.id}.json`, // Real Filename for Export (e.g. "shot-1701234.json")
          source: 'gaggimate',
        }),
      );
    } catch (error) {
      console.error('Failed to load GaggiMate shots:', error);
      return [];
    }
  }

  /**
   * Get shots from browser uploads
   * @returns {Promise<AnalyzerShot[]>} List of browser shots with source tag
   */
  async getBrowserShots() {
    try {
      const shots = await Promise.resolve(indexedDBService.getAllShots());
      return shots.map(shot => ({
        ...shot,
        storageKey: shot.storageKey || shot.name || String(shot.id || ''),
      }));
    } catch (error) {
      console.error('Failed to load browser shots:', error);
      return [];
    }
  }

  /**
   * Get merged shot list from all sources
   * @param {LibrarySourceFilter} [sourceFilter] - 'both', 'gaggimate', or 'browser'
   * @returns {Promise<AnalyzerShot[]>} Filtered and merged shot list
   */
  async getAllShots(sourceFilter = 'both') {
    /** @type {Promise<AnalyzerShot[]>[]} */
    const promises = [];

    // Load from selected sources
    if (sourceFilter === 'both' || sourceFilter === 'gaggimate') {
      promises.push(this.getGaggiMateShots());
    }
    if (sourceFilter === 'both' || sourceFilter === 'browser') {
      promises.push(this.getBrowserShots());
    }

    const results = await Promise.all(promises);
    const merged = results.flat();

    // Sort by timestamp (newest first)
    return merged.sort(
      (a, b) => /** @type {number} */ (b.timestamp) - /** @type {number} */ (a.timestamp),
    );
  }

  /**
   * Get profiles from GaggiMate controller
   * @returns {Promise<AnalyzerProfile[]>} List of GaggiMate profiles with source tag
   */
  async getGaggiMateProfiles() {
    if (this.apiService?.socket?.readyState !== WebSocket.OPEN) {
      return [];
    }

    try {
      const response = await this.apiService.request({
        tp: 'req:profiles:list',
      });

      if (!response.profiles) {
        return [];
      }

      // Add source tag and preserve the API id for req:profiles:load.
      return response.profiles.map(
        /**
         * @param {AnalyzerProfile} profile
         * @returns {AnalyzerProfile}
         */
        profile => ({
          ...profile,
          exportName: getProfileExportFilename(profile),
          profileId: profile.id, // Keep real API id for req:profiles:load
          label: profile.label,
          source: 'gaggimate',
        }),
      );
    } catch (error) {
      console.error('Failed to load GaggiMate profiles:', error);
      return [];
    }
  }

  /**
   * Get profiles from browser uploads
   * @returns {Promise<AnalyzerProfile[]>} List of browser profiles with source tag
   */
  async getBrowserProfiles() {
    try {
      return await Promise.resolve(indexedDBService.getAllProfiles());
    } catch (error) {
      console.error('Failed to load browser profiles:', error);
      return [];
    }
  }

  /**
   * Get merged profile list from all sources
   * @param {LibrarySourceFilter} [sourceFilter] - 'both', 'gaggimate', or 'browser'
   * @returns {Promise<AnalyzerProfile[]>} Filtered and merged profile list
   */
  async getAllProfiles(sourceFilter = 'both') {
    /** @type {Promise<AnalyzerProfile[]>[]} */
    const promises = [];

    if (sourceFilter === 'both' || sourceFilter === 'gaggimate') {
      promises.push(this.getGaggiMateProfiles());
    }
    if (sourceFilter === 'both' || sourceFilter === 'browser') {
      promises.push(this.getBrowserProfiles());
    }

    const results = await Promise.all(promises);
    const merged = results.flat();

    return merged.sort((a, b) =>
      getProfileDisplayLabel(a, '').localeCompare(getProfileDisplayLabel(b, '')),
    );
  }

  /**
   * Load full shot data
   * @param {string | number} id - Shot ID
   * @param {LibrarySource | undefined} source - 'gaggimate' or 'browser' (anything else: browser)
   * @param {{ signal?: AbortSignal }} [options] - Optional request controls for GaggiMate fetches
   * @returns {Promise<AnalyzerShot>} Full shot data with samples
   */
  async loadShot(id, source, { signal } = {}) {
    const idStr = String(id);

    if (source === 'gaggimate') {
      const paddedId = idStr.padStart(6, '0');
      const response = await fetch(`/api/history/${paddedId}.slog`, { signal });

      if (!response.ok) {
        const status = response.status;
        throw new Error(t`Failed to load shot ${idStr}: HTTP ${status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      /** @type {AnalyzerShot} */
      const shot = parseBinaryShot(arrayBuffer, idStr);
      shot.source = 'gaggimate';
      return shot;
    }
    const shot = await indexedDBService.getShot(idStr);
    if (!shot) {
      throw new Error(t`Shot ${idStr} not found in browser storage`);
    }
    shot.storageKey = shot.storageKey || shot.name || idStr;
    shot.source = shot.source || 'browser';
    return shot;
  }

  /**
   * Load full profile data
   * @param {string} nameOrId - Profile name/ID (for GM: use label)
   * @param {LibrarySource | undefined} source - 'gaggimate' or 'browser' (anything else: browser)
   * @returns {Promise<AnalyzerProfile>} Full profile data
   */
  async loadProfile(nameOrId, source) {
    if (source === 'gaggimate') {
      if (this.apiService?.socket?.readyState !== WebSocket.OPEN) {
        throw new Error(t`WebSocket not connected`);
      }

      const response = await this.apiService.request({
        tp: 'req:profiles:load',
        id: nameOrId,
      });

      if (!response.profile) {
        throw new Error(t`Profile ${nameOrId} not found`);
      }

      return {
        ...response.profile,
        source: 'gaggimate',
      };
    }
    const profile = await indexedDBService.getProfile(nameOrId);
    if (!profile) {
      throw new Error(t`Profile ${nameOrId} not found in browser storage`);
    }
    return profile;
  }

  /**
   * PREPARE EXPORT DATA
   * Fetches the original data and cleans it for export.
   * @param {AnalyzerShot | AnalyzerProfile} item - The library item (shot or profile)
   * @param {boolean} isShot - True if item is a shot
   * @returns {Promise<{ exportData: object, filename: string }>} Export payload and filename
   */
  async exportItem(item, isShot) {
    const shotItem = /** @type {AnalyzerShot} */ (item);
    const profileItem = /** @type {AnalyzerProfile} */ (item);
    let exportData = null;
    let filename = isShot
      ? getShotExportFilename(shotItem)
      : ensureJsonFilename(item.exportName || item.name || item.id || 'export.json');

    if (item.source === 'gaggimate') {
      if (isShot) {
        // SHOT EXPORT (GM):
        // We MUST load the full shot because the list item only has summary data.
        // Use the 'id' (timestamp) to load, ignoring the 'name' (profile name).
        const loadId = shotItem.id;
        if (!loadId) throw new Error(t`Shot ID missing for export`);

        const fullShot = await this.loadShot(loadId, 'gaggimate');
        delete fullShot.source;

        const notes = await notesService.loadNotes(loadId, 'gaggimate');
        exportData = buildHistoryLikeShotExport(fullShot, shotItem, notes);
      } else {
        // PROFILE EXPORT (GM):
        // Load fresh from controller using the hidden profileId
        const loadId = profileItem.profileId || profileItem.id;
        if (!loadId) throw new Error(t`Profile ID missing for export`);

        const raw = await this.loadProfile(loadId, 'gaggimate');
        filename = getProfileExportFilename(
          raw,
          profileItem.label ||
            profileItem.name ||
            profileItem.fileName ||
            profileItem.exportName ||
            profileItem.id ||
            'profile',
        );
        exportData = cleanProfileForExport(raw, profileItem);
      }
    } else if (isShot) {
      // BROWSER EXPORT:
      // Just clean up our internal tags
      const exportShot = { ...(shotItem.data || shotItem) };
      delete exportShot.source;
      delete exportShot.uploadedAt;

      const shotNotesKey = getShotStorageKey(shotItem);
      const notes = await notesService.loadNotes(shotNotesKey, 'browser');
      exportData = buildHistoryLikeShotExport(exportShot, shotItem, notes);
    } else {
      const rawProfile = profileItem.data || profileItem;
      filename = getProfileExportFilename(
        rawProfile,
        profileItem.label ||
          profileItem.name ||
          profileItem.fileName ||
          profileItem.exportName ||
          profileItem.id ||
          'profile',
      );
      exportData = cleanProfileForExport(rawProfile, profileItem);
    }

    // Return raw object
    // The UI helper 'downloadJson' will handle stringify and blob creation.
    return { exportData, filename };
  }

  /**
   * Delete a shot
   * @param {string} id - Shot ID
   * @param {LibrarySource | undefined} source - 'gaggimate' or 'browser' (anything else: browser)
   */
  async deleteShot(id, source) {
    if (source === 'gaggimate') {
      if (!this.apiService) throw new Error('ApiService not set');
      await this.apiService.request({ tp: 'req:history:delete', id });
    } else {
      await indexedDBService.deleteShot(id);
      await indexedDBService.deleteNotes(String(id));
    }
  }

  /**
   * Delete a profile
   * @param {string} id - Profile ID (gaggimate: internal API id, browser: name)
   * @param {LibrarySource | undefined} source - 'gaggimate' or 'browser' (anything else: browser)
   */
  async deleteProfile(id, source) {
    if (source === 'gaggimate') {
      if (!this.apiService) throw new Error('ApiService not set');
      await this.apiService.request({ tp: 'req:profiles:delete', id });
    } else {
      await indexedDBService.deleteProfile(id);
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<{ gaggimate: Omit<SourceStats, 'total'>, browser: Omit<SourceStats, 'total'>, total: Omit<SourceStats, 'total'> }>} Stats from all sources
   */
  async getStats() {
    const [gmShots, browserShots, gmProfiles, browserProfiles] = await Promise.all([
      this.getGaggiMateShots(),
      this.getBrowserShots(),
      this.getGaggiMateProfiles(),
      this.getBrowserProfiles(),
    ]);

    return {
      gaggimate: {
        shots: gmShots.length,
        profiles: gmProfiles.length,
      },
      browser: {
        shots: browserShots.length,
        profiles: browserProfiles.length,
      },
      total: {
        shots: gmShots.length + browserShots.length,
        profiles: gmProfiles.length + browserProfiles.length,
      },
    };
  }
}

export const libraryService = new LibraryService();
