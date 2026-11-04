import { describe, expect, test } from 'vitest';
import { calculateShotMetrics } from '../src/pages/ShotAnalyzer/services/analyzer/shotAnalysis.js';
import { computeStatistics } from '../src/pages/Statistics/services/StatisticsService.js';
import { SETTINGS, makeProfile, makeShot } from './helpers/shots.js';

/** @typedef {import('../src/pages/Statistics/types').StatisticsServiceEntry} StatisticsServiceEntry */

/**
 * @param {object} meta
 * @param {string} meta.id
 * @param {number} meta.timestamp
 * @param {string} meta.profileName
 * @param {'gaggimate' | 'browser'} meta.source
 * @param {number} [scale] Multiplies every recorded weight.
 * @returns {StatisticsServiceEntry}
 */
function entry(meta, scale = 1) {
  const shot = makeShot({ mapSample: s => ({ ...s, v: (s.v ?? 0) * scale }) });
  const analysis = calculateShotMetrics(shot, makeProfile(), SETTINGS);
  return /** @type {StatisticsServiceEntry} */ ({ analysis, meta });
}

describe('computeStatistics', () => {
  test('returns an empty result without shots', () => {
    const result = computeStatistics([]);
    expect(result.summary).toMatchObject({
      totalShots: 0,
      avgWeight: 0,
      dateRange: { earliest: null, latest: null },
    });
    expect(result.phaseStats).toEqual([]);
    expect(result.trends).toEqual([]);
  });

  const entries = [
    entry({ id: 'a', timestamp: 2000, profileName: 'Test profile', source: 'gaggimate' }),
    // Same shot, but it reached 40 g.
    entry({ id: 'b', timestamp: 1000, profileName: 'Test profile', source: 'browser' }, 40 / 36),
    entry({ id: 'c', timestamp: 3000, profileName: '', source: 'gaggimate' }),
  ];

  test('summarises all shots', () => {
    const { summary } = computeStatistics(entries);
    expect(summary).toMatchObject({
      totalShots: 3,
      totalDuration: 30,
      totalWater: 90,
      avgDuration: 10,
      avgWater: 30,
      avgTemp: 92,
      avgTempTargetDeviation: 1,
      dateRange: { earliest: 1000, latest: 3000 },
      sourceBreakdown: { gaggimate: 2, browser: 1 },
    });
    expect(summary.totalWeight).toBeCloseTo(112);
    expect(summary.avgWeight).toBeCloseTo(112 / 3);
  });

  test('aggregates metrics across shots', () => {
    const { metrics } = computeStatistics(entries);
    expect(metrics.w).toMatchObject({ count: 3, min: 36 });
    expect(metrics.w?.max).toBeCloseTo(40);
    expect(metrics.pPeak).toMatchObject({ count: 3, avg: 9, min: 9, max: 9, stdDev: 0 });
    expect(metrics.duration).toMatchObject({ avg: 10, stdDev: 0 });
  });

  test('groups shots by profile', () => {
    const groups = computeStatistics(entries).profileGroups;
    expect(groups.map(g => [g.profileName, g.shotCount])).toEqual([
      ['Test profile', 2],
      ['(Unmatched)', 1],
    ]);
  });

  test('aggregates each phase, including skipped ones, plus a total row', () => {
    const phaseStats = computeStatistics(entries).phaseStats;
    expect(phaseStats.map(p => [p.phaseName, p.shotCount, p.avgDuration, p.avgWater])).toEqual([
      ['Preinfusion', 3, 5, 20],
      ['Brew', 3, 5, 10],
      ['Never reached', 3, 0, 0],
      ['Total', 9, 10 / 3, 10],
    ]);
    expect(phaseStats[1].exitReasonDistribution).toEqual({ 'Weight Stop': 3 });
    expect(phaseStats[3].isTotal).toBe(true);
  });

  test('lists trends in time order', () => {
    const { trends } = computeStatistics(entries);
    expect(trends.map(t => [t.shotId, t.timestamp, t.profileName])).toEqual([
      ['b', 1000, 'Test profile'],
      ['a', 2000, 'Test profile'],
      ['c', 3000, '(Unknown)'],
    ]);
    expect(trends[1]).toMatchObject({ duration: 10, weight: 36, water: 30, avgTemp: 92 });
  });

  // Known bug, see web/IMPROVEMENTS.md ("Phase number concatenated as a string"): an unnamed
  // executed phase is labelled "Phase 01". Turn this into a normal test once it is fixed.
  test.fails('labels an unnamed phase by its 1-based number', () => {
    const named = entry({ id: 'a', timestamp: 0, profileName: 'P', source: 'gaggimate' });
    const analysis = /** @type {import('../src/pages/ShotAnalyzer/types').ShotAnalysis} */ (
      named.analysis
    );
    const unnamed = {
      ...named,
      analysis: {
        ...analysis,
        phases: analysis.phases.slice(0, 1).map(p => ({ ...p, name: undefined, displayName: '' })),
      },
    };
    expect(computeStatistics([unnamed]).phaseStats[0].phaseName).toBe('Phase 1');
  });
});
