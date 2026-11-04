import { afterEach, describe, expect, test, vi } from 'vitest';
import { activeWarnings } from '../src/utils/warnings.js';
import { notesService } from '../src/pages/ShotAnalyzer/services/NotesService.js';
import { getShotStorageKey } from '../src/pages/ShotAnalyzer/utils/pinning.js';
import {
  deleteLibraryItem,
  getLibraryProfileDeleteKey,
} from '../src/pages/ShotAnalyzer/components/library/libraryDisplay.js';
import { libraryService } from '../src/pages/ShotAnalyzer/services/LibraryService.js';
import { computeStatistics } from '../src/pages/Statistics/services/StatisticsService.js';

/**
 * Loosely typed fixture.
 * @template T
 * @param {object} value
 * @returns {T}
 */
const as = value => /** @type {T} */ (/** @type {unknown} */ (value));

describe('activeWarnings', () => {
  test('keeps shown, active warnings that have a definition', () => {
    const warnings = activeWarnings([
      { key: 'water', level: 2, active: true },
      { key: 'temperature', level: 0, active: true }, // ignored
      { key: 'switch', level: 1, active: false }, // not active
      { key: 'not-a-warning', level: 2, active: true }, // unknown to this UI
    ]);
    expect(warnings.map(w => [w.key, w.level, typeof w.icon])).toEqual([['water', 2, 'string']]);
    expect(warnings[0].label).toBe('Water tank low');
  });
});

describe('notesService.getDefaults', () => {
  test('gives the no-shot placeholder an empty id', () => {
    expect(notesService.getDefaults(null).id).toBe('');
    expect(notesService.getDefaults('42').id).toBe('42');
  });
});

describe('library keys', () => {
  test('getShotStorageKey never returns undefined', () => {
    expect(getShotStorageKey(as({ source: 'gaggimate', id: 7 }))).toBe(7);
    expect(getShotStorageKey(as({ source: 'gaggimate' }))).toBe('');
    expect(getShotStorageKey(as({ source: 'browser', name: 'a.json' }))).toBe('a.json');
    expect(getShotStorageKey(as({ source: 'browser' }))).toBe('');
  });

  test('getLibraryProfileDeleteKey', () => {
    expect(getLibraryProfileDeleteKey(as({ source: 'gaggimate', profileId: 'p1', id: 'x' }))).toBe(
      'p1',
    );
    expect(getLibraryProfileDeleteKey(as({ source: 'browser', name: 'Mine' }))).toBe('Mine');
    expect(getLibraryProfileDeleteKey(as({ source: 'browser' }))).toBe('');
  });
});

describe('deleteLibraryItem', () => {
  afterEach(() => vi.restoreAllMocks());

  test('deletes shots and profiles by their key', async () => {
    const deleteShot = vi.spyOn(libraryService, 'deleteShot').mockResolvedValue(undefined);
    const deleteProfile = vi.spyOn(libraryService, 'deleteProfile').mockResolvedValue(undefined);
    await deleteLibraryItem(as({ source: 'gaggimate', id: 7, duration: 30 }));
    await deleteLibraryItem(as({ source: 'browser', name: 'Mine' }));
    expect(deleteShot).toHaveBeenCalledWith(7, 'gaggimate');
    expect(deleteProfile).toHaveBeenCalledWith('Mine', 'browser');
  });

  test('refuses an item without a key instead of deleting "undefined"', async () => {
    const deleteProfile = vi.spyOn(libraryService, 'deleteProfile').mockResolvedValue(undefined);
    await expect(deleteLibraryItem(as({ source: 'browser' }))).rejects.toThrow(/no id/);
    expect(deleteProfile).not.toHaveBeenCalled();
  });
});

describe('computeStatistics without weights', () => {
  test('leaves shots without a recorded weight out of the weight totals', () => {
    /** @param {number | undefined} weight */
    const entry = weight =>
      as({
        analysis: { phases: [], total: { duration: 10, water: 30, weight } },
        meta: { id: String(weight), timestamp: 1, profileName: 'P', source: 'gaggimate' },
      });
    const { summary, metrics, profileGroups } = computeStatistics([entry(36), entry(undefined)]);
    expect(summary.totalWeight).toBe(36);
    expect(metrics.w?.count).toBe(1);
    expect(profileGroups[0].avgWeight).toBe(36);
  });
});
