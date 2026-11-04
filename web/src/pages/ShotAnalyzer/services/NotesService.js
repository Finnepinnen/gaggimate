/**
 * NotesService.js
 *
 * Dual-persistence notes service for Shot Analyzer.
 * Notes JSON format is identical across all backends:
 *   { id, rating, beanType, doseIn, doseOut, ratio, grindSetting, balanceTaste, notes }
 *
 * - GaggiMate shots: Uses the same API as ShotHistory (req:history:notes:get/save)
 * - Browser shots: Dedicated 'notes' store in IndexedDB (same JSON format as API)
 * - Temp shots: In-memory only, no persistence
 */

import { indexedDBService } from './IndexedDBService';

/** @typedef {import('../../../types').ShotNotes} ShotNotes */
/** @typedef {import('../types').AnalyzerNotes} AnalyzerNotes */
/** @typedef {import('../types').LibrarySource} LibrarySource */
/** @typedef {string} ShotId */
/** @typedef {(notes: AnalyzerNotes, meta: { originId: string | null }) => void} NotesSubscriber */

/** @type {Omit<AnalyzerNotes, 'id'>} */
const DEFAULT_NOTES = {
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
 * @param {string | Partial<ShotNotes>} notesPayload JSON string or parsed notes
 * @returns {Partial<ShotNotes>}
 */
function parseNotesPayload(notesPayload) {
  if (typeof notesPayload !== 'string') return notesPayload;

  try {
    return JSON.parse(notesPayload);
  } catch (e) {
    console.warn('Failed to parse notes JSON:', e);
    return {};
  }
}

class NotesService {
  /** @type {import('../../../services/ApiService.js').default | null} */
  apiService = null;
  /** @type {Map<string, AnalyzerNotes>} */
  _tempCache = new Map();
  /** @type {Map<string, Set<NotesSubscriber>>} */
  _subscribers = new Map();

  /** @param {import('../../../services/ApiService.js').default} apiService */
  setApiService(apiService) {
    this.apiService = apiService;
  }

  /**
   * @param {ShotId | null} shotId `null` builds the placeholder used while no shot is loaded.
   * @returns {AnalyzerNotes}
   */
  getDefaults(shotId) {
    return { ...DEFAULT_NOTES, id: shotId ?? '' };
  }

  /**
   * @param {ShotId | null | undefined} shotId
   * @param {LibrarySource | null | undefined} source
   * @returns {string}
   */
  getChannelKey(shotId, source) {
    return `${source || 'unknown'}:${String(shotId || '')}`;
  }

  // Multiple Analyzer panels can edit the same shot notes at once on mobile;
  // this channel keeps those local hook instances in sync before persistence finishes.
  /**
   * @param {ShotId} shotId
   * @param {LibrarySource | null | undefined} source
   * @param {NotesSubscriber} callback
   * @returns {() => void} Unsubscribe
   */
  subscribeNotes(shotId, source, callback) {
    if (typeof callback !== 'function') return () => {};
    const channelKey = this.getChannelKey(shotId, source);
    let subscribers = this._subscribers.get(channelKey);
    if (!subscribers) {
      subscribers = new Set();
      this._subscribers.set(channelKey, subscribers);
    }
    subscribers.add(callback);

    return () => {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        this._subscribers.delete(channelKey);
      }
    };
  }

  /**
   * @param {ShotId} shotId
   * @param {LibrarySource | null | undefined} source
   * @param {Partial<ShotNotes>} notes
   * @param {string | null} [originId]
   */
  publishNotesUpdate(shotId, source, notes, originId = null) {
    const channelKey = this.getChannelKey(shotId, source);
    const subscribers = this._subscribers.get(channelKey);
    if (!subscribers || subscribers.size === 0) return;

    const nextNotes = { ...notes, id: String(shotId || notes?.id || '') };
    subscribers.forEach(callback => {
      try {
        callback(nextNotes, { originId });
      } catch (error) {
        console.error('Failed to publish notes update:', error);
      }
    });
  }

  /**
   * @param {ShotId} shotId
   * @param {AnalyzerNotes} defaults
   * @returns {Promise<AnalyzerNotes>}
   */
  async loadGaggiMateNotes(shotId, defaults) {
    if (!this.apiService) return defaults;

    try {
      const response = await this.apiService.request({
        tp: 'req:history:notes:get',
        id: shotId,
      });
      return response.notes ? { ...defaults, ...parseNotesPayload(response.notes) } : defaults;
    } catch (e) {
      console.error('Failed to load notes from API:', e);
      return defaults;
    }
  }

  /**
   * @param {ShotId} shotId
   * @param {AnalyzerNotes} defaults
   * @returns {Promise<AnalyzerNotes>}
   */
  async loadBrowserNotes(shotId, defaults) {
    try {
      const stored = await Promise.resolve(indexedDBService.getNotes(String(shotId)));
      return stored ? { ...defaults, ...stored } : defaults;
    } catch (e) {
      console.error('Failed to load notes from IndexedDB:', e);
      return defaults;
    }
  }

  /**
   * @param {ShotId} shotId
   * @param {AnalyzerNotes} defaults
   * @returns {AnalyzerNotes}
   */
  loadTempNotes(shotId, defaults) {
    const cachedNotes = this._tempCache.get(String(shotId));
    return cachedNotes ? { ...defaults, ...cachedNotes } : defaults;
  }

  /**
   * @param {ShotId} shotId
   * @param {LibrarySource | null | undefined} source
   * @returns {Promise<AnalyzerNotes>}
   */
  async loadNotes(shotId, source) {
    const defaults = this.getDefaults(shotId);

    if (source === 'gaggimate') return this.loadGaggiMateNotes(shotId, defaults);
    if (source === 'browser') return this.loadBrowserNotes(shotId, defaults);
    return this.loadTempNotes(shotId, defaults);
  }

  /**
   * @param {ShotId} shotId
   * @param {LibrarySource | null | undefined} source
   * @param {Partial<ShotNotes>} notes
   */
  async saveNotes(shotId, source, notes) {
    // Ensure the notes object always has the shot ID
    const notesWithId = { ...notes, id: String(shotId) };

    if (source === 'gaggimate') {
      if (!this.apiService) throw new Error('ApiService not available');
      await this.apiService.request({
        tp: 'req:history:notes:save',
        id: shotId,
        notes: notesWithId,
      });
      return;
    }

    if (source === 'browser') {
      await indexedDBService.saveNotes(notesWithId);
      return;
    }

    // Temp source: store in memory only
    this._tempCache.set(String(shotId), notesWithId);
  }
}

export const notesService = new NotesService();
