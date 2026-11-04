import { describe, expect, test } from 'vitest';
import {
  calculateShotMetrics,
  detectAutoDelay,
} from '../src/pages/ShotAnalyzer/services/analyzer/shotAnalysis.js';
import {
  SETTINGS,
  SI_ACTIVE_SCALE,
  SI_BREW,
  SI_BT_SCALE,
  SI_STARTED_VOLUMETRIC,
  makeProfile,
  makeShot,
} from './helpers/shots.js';

/**
 * @param {ReturnType<typeof calculateShotMetrics>} result
 * @returns {import('../src/pages/ShotAnalyzer/types').ShotAnalysis}
 */
function analysed(result) {
  if (!result.total) throw new Error(`no analysis: ${result.warnings?.join(', ')}`);
  return /** @type {import('../src/pages/ShotAnalyzer/types').ShotAnalysis} */ (result);
}

describe('calculateShotMetrics', () => {
  test('warns when there are no samples', () => {
    expect(calculateShotMetrics(null, null, SETTINGS)).toEqual({
      phases: [],
      warnings: ['No sample data available for analysis.'],
    });
  });

  test('splits the shot into its executed phases', () => {
    const result = analysed(calculateShotMetrics(makeShot(), null, SETTINGS));
    expect(
      result.phases.map(
        ({ number, name, start, end, duration, water, weight, isFinalExecuted }) => ({
          number,
          name,
          start,
          end,
          duration,
          water,
          weight,
          isFinalExecuted,
        }),
      ),
    ).toEqual([
      {
        number: '0',
        name: 'Preinfusion',
        start: 0,
        end: 5,
        duration: 5,
        water: 20,
        weight: 0,
        isFinalExecuted: false,
      },
      {
        number: '1',
        name: 'Brew',
        start: 5,
        end: 10,
        duration: 5,
        water: 10,
        weight: 36,
        isFinalExecuted: true,
      },
    ]);
    expect(result.phases[0].stats.p).toEqual({ start: 3, end: 3, min: 3, max: 3, avg: 3 });
    expect(result.phases[1].stats.p).toEqual({ start: 9, end: 9, min: 9, max: 9, avg: 9 });
  });

  test('uses the recorded exit reason of each phase', () => {
    const result = analysed(calculateShotMetrics(makeShot(), null, SETTINGS));
    expect(result.phases.map(p => p.exit)).toEqual([
      expect.objectContaining({ code: 5, source: 'recorded' }),
      expect.objectContaining({
        code: 1,
        reason: 'Weight Stop',
        source: 'recorded',
        type: 'volumetric',
        actualValue: 36,
      }),
    ]);
    expect(result).toMatchObject({
      finalExitReasonCode: 1,
      finalExitReasonLabel: 'Volumetric target',
      completionTone: 'default',
    });
  });

  test('flags a safety stop', () => {
    const result = analysed(
      calculateShotMetrics(makeShot({ slog: { finalExitReason: 6 } }), null, SETTINGS),
    );
    expect(result.completionTone).toBe('warning');
  });

  test('adds totals for the whole shot', () => {
    const { total } = analysed(calculateShotMetrics(makeShot(), null, SETTINGS));
    expect(total).toMatchObject({
      duration: 10,
      water: 30,
      weight: 36,
      sys_shot_vol: true,
      sys_scale: true,
      sys_brew_mode: 'Brewed by Weight',
      sys_recorded_stop_reason: 'Volumetric target',
    });
    expect(total.p).toMatchObject({ start: 3, end: 9, min: 3, max: 9 });
    expect(total.t.avg).toBe(92);
  });

  test('prefers the recorded pump counter over integrated flow', () => {
    // 0.5 ml per sample instead of the 1 / 0.5 ml the flow integrates to.
    const shot = makeShot({
      mapSample: (s, i) => ({ ...s, wp: i * 0.5 }),
      slog: { fieldsMask: 0x3fff },
    });
    const result = analysed(calculateShotMetrics(shot, null, SETTINGS));
    expect(result.total.water).toBe(20);
    expect(result.phases.map(p => p.water)).toEqual([10, 10]);
  });

  test('falls back to integrated flow when the pump counter goes backwards', () => {
    const shot = makeShot({
      mapSample: (s, i) => ({ ...s, wp: i === 30 ? 0 : i * 0.5 }),
      slog: { fieldsMask: 0x3fff },
    });
    expect(analysed(calculateShotMetrics(shot, null, SETTINGS)).total.water).toBe(30);
  });

  test('matches executed phases to the profile and lists skipped ones', () => {
    const result = analysed(calculateShotMetrics(makeShot(), makeProfile(), SETTINGS));
    expect(result.phases.map(p => [p.name, p.profilePhase?.name, p.skipped ?? false])).toEqual([
      ['Preinfusion', 'Preinfusion', false],
      ['Brew', 'Brew', false],
      ['Never reached', 'Never reached', true],
    ]);
    expect(result.phases[2].exit).toMatchObject({ reason: 'Phase skipped', source: 'inferred' });
    expect(result.phases[2].stats.sys_recorded_stop_reason).toBe('Not recorded');
  });

  test('turns ratio targets into grams using the dose from the notes', () => {
    const profile = makeProfile();
    // Non-null: makeProfile always has phases.
    /** @type {NonNullable<typeof profile.phases>} */ (profile.phases)[1].targets = [
      { type: 'ratio', operator: 'gte', value: 2 },
    ];
    const withDose = analysed(
      calculateShotMetrics({ ...makeShot(), notes: { doseIn: '18' } }, profile, SETTINGS),
    );
    expect(withDose.phases[1].profilePhase?.targets).toEqual([
      { type: 'ratio', operator: 'gte', value: 36, ratio: 2 },
    ]);

    // Without a dose the firmware skips the ratio target, and so does the analysis.
    const withoutDose = analysed(calculateShotMetrics(makeShot(), profile, SETTINGS));
    expect(withoutDose.phases[1].profilePhase?.targets).toEqual([]);
  });

  test('labels a shot brewed by time', () => {
    const result = analysed(
      calculateShotMetrics(makeShot({ si: SI_BREW | SI_BT_SCALE }), null, SETTINGS),
    );
    expect(result).toMatchObject({ isBrewByWeight: false, brewModeLabel: 'Brewed by Time' });
  });

  test('detects a scale lost during a brew by weight', () => {
    const connected = SI_STARTED_VOLUMETRIC | SI_BREW | SI_ACTIVE_SCALE;
    const shot = makeShot({
      si: connected,
      mapSample: (s, i) => (i >= 30 ? { ...s, si: connected & ~SI_ACTIVE_SCALE } : s),
    });
    expect(analysed(calculateShotMetrics(shot, null, SETTINGS)).globalScaleLost).toBe(true);
    expect(analysed(calculateShotMetrics(makeShot(), null, SETTINGS)).globalScaleLost).toBe(false);
  });

  test('reports sample gaps longer than the normal interval', () => {
    // Shift every sample after the 10th by 750 ms, leaving one 1 s gap.
    const shot = makeShot({ mapSample: (s, i) => (i > 10 ? { ...s, t: (s.t ?? 0) + 750 } : s) });
    expect(analysed(calculateShotMetrics(shot, null, SETTINGS))).toMatchObject({
      hasSlowSampleInterval: true,
      maxSampleIntervalMs: 1000,
    });
    expect(analysed(calculateShotMetrics(makeShot(), null, SETTINGS)).hasSlowSampleInterval).toBe(
      false,
    );
  });

  test('warns about a configured scale delay above 1.2 s on the last executed phase', () => {
    const result = analysed(
      calculateShotMetrics(makeShot({ slog: { brewDelay: 1500 } }), makeProfile(), SETTINGS),
    );
    expect(result).toMatchObject({
      configuredHighScaleDelay: true,
      configuredScaleDelayMs: 1500,
      highScaleDelay: true,
      highScaleDelayMs: 1500,
    });
    expect(result.phases.map(p => p.highScaleDelay)).toEqual([false, true, false]);
  });
});

describe('detectAutoDelay', () => {
  test('falls back to the given delay without a profile to match against', () => {
    expect(detectAutoDelay(makeShot(), null, 300)).toEqual({ delay: 300, auto: true });
  });

  test('is not automatic without samples', () => {
    expect(detectAutoDelay(null, null, 300)).toEqual({ delay: 300, auto: false });
  });
});
