import { describe, expect, test } from 'vitest';
import { cleanName } from '../src/pages/ShotAnalyzer/utils/formatting.js';
import { getAnalyzerShotDisplayName } from '../src/pages/ShotAnalyzer/components/useShotNotesState.js';
import { getStatisticsShotId } from '../src/pages/Statistics/components/statisticsView/analysis.js';
import { buildStatisticsCompareEntry } from '../src/pages/Statistics/components/statisticsView/helpers.js';

/**
 * Loosely typed fixture: ids are typed as strings but can be numbers at runtime.
 * @template T
 * @param {object} value
 * @returns {T}
 */
const as = value => /** @type {T} */ (/** @type {unknown} */ (value));

/** @typedef {import('../src/pages/ShotAnalyzer/types').AnalyzerShot} AnalyzerShot */
/** @typedef {import('../src/pages/Statistics/types').StatisticsShotMeta} StatisticsShotMeta */

describe('cleanName', () => {
  test('strips a .json extension', () => {
    expect(cleanName('Morning.JSON')).toBe('Morning');
  });

  test('accepts a numeric shot id', () => {
    // Used to throw: the fallback chain can end in a numeric id.
    expect(cleanName(42)).toBe('42');
    expect(cleanName(0)).toBe('0');
  });

  test('returns an empty string for nothing', () => {
    expect(cleanName(null)).toBe('');
    expect(cleanName(undefined)).toBe('');
    expect(cleanName('')).toBe('');
  });
});

describe('getAnalyzerShotDisplayName', () => {
  test('falls back to a numeric id for a browser shot without a name', () => {
    /** @type {AnalyzerShot} */
    const shot = as({ source: 'browser', id: 7, name: '', samples: [] });
    expect(getAnalyzerShotDisplayName(shot)).toBe('7');
  });
});

describe('getStatisticsShotId', () => {
  /** @param {object} meta */
  const idOf = meta => getStatisticsShotId(/** @type {StatisticsShotMeta} */ (as(meta)));

  test('uses the id for GaggiMate shots and the storage key for browser shots', () => {
    expect(idOf({ source: 'gaggimate', id: 12 })).toBe(12);
    expect(idOf({ source: 'browser', storageKey: 'k', name: 'n', id: 1 })).toBe('k');
  });

  test('returns null when there is nothing to load the shot by', () => {
    expect(idOf({ source: 'browser' })).toBeNull();
    expect(idOf({ source: 'browser', name: '' })).toBeNull();
  });
});

describe('buildStatisticsCompareEntry', () => {
  test('gives a shot without a name its id as a string', () => {
    const entry = buildStatisticsCompareEntry(
      as({ shotData: { name: '', samples: [] }, analysis: { phases: [] }, meta: { id: 42 } }),
      { key: 'a' },
    );
    expect(entry?.shotName).toBe('42');
  });
});
