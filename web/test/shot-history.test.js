import { describe, expect, test } from 'vitest';
import { getHistoryChartRange } from '../src/pages/ShotHistory/chartRange.js';
import { mergeLoadedShot } from '../src/pages/ShotHistory/mergeLoadedShot.js';
import { makeShot } from './helpers/shots.js';

/** @typedef {import('../src/types').Shot} Shot */

describe('mergeLoadedShot', () => {
  const indexEntry = /** @type {Shot} */ ({
    id: 'test-shot',
    profile: 'Index name',
    volume: 40,
    rating: null,
    incomplete: false,
    loaded: false,
  });

  test('keeps index metadata over the shot file', () => {
    const merged = mergeLoadedShot({ ...indexEntry, rating: 4 }, makeShot());
    expect(merged).toMatchObject({ volume: 40, rating: 4, incomplete: false, loaded: true });
    expect(merged.samples).toHaveLength(41);
  });

  test('leaves an unrated shot at null', () => {
    // parseBinaryShot sets no rating, so `null ?? undefined` used to make this undefined.
    const merged = mergeLoadedShot(indexEntry, makeShot());
    expect(merged.rating).toBeNull();
  });

  test('uses the shot file volume when the index has none', () => {
    const merged = mergeLoadedShot({ ...indexEntry, volume: null }, makeShot());
    expect(merged.volume).toBe(36);
  });
});

describe('getHistoryChartRange', () => {
  test('pads the temperature range', () => {
    expect(getHistoryChartRange([92, 93, 94], [0, 5, 10])).toEqual({
      x: { min: 0, max: 10 },
      y: { min: 87, max: 99 },
    });
    // A spread over 10 °C gets less padding.
    expect(getHistoryChartRange([80, 95], [0]).y).toEqual({ min: 78, max: 97 });
  });

  test('ignores missing temperatures', () => {
    // Math.min/max used to turn one missing value into NaN bounds.
    expect(getHistoryChartRange([92, undefined, null, 94], [0, 1]).y).toEqual({
      min: 87,
      max: 99,
    });
  });

  test('leaves the bounds to Chart.js without data', () => {
    expect(getHistoryChartRange([undefined], [])).toEqual({ x: {}, y: {} });
  });
});
