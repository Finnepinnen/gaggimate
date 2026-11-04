import { afterEach, describe, expect, test, vi } from 'vitest';
import { getWaterLevelPercent } from '../src/pages/Home/utils.js';
import { compareNewestFirst } from '../src/pages/ShotAnalyzer/services/LibraryService.js';
import { scheduleFrame } from '../src/pages/ShotAnalyzer/components/shotChart/helpers/frameScheduler.js';
import {
  removePhaseTargetAt,
  updatePhaseTargetAt,
} from '../src/pages/ProfileEdit/profilePhases.js';

describe('getWaterLevelPercent', () => {
  const calibrated = { tof: true, emptyTankDistance: 200, fullTankDistance: 40 };

  test('maps the distance between empty and full to 0–100 %', () => {
    expect(getWaterLevelPercent({ ...calibrated, distance: 120 })).toBe(50);
    expect(getWaterLevelPercent({ ...calibrated, distance: 250 })).toBe(0);
    expect(getWaterLevelPercent({ ...calibrated, distance: 10 })).toBe(100);
  });

  test('is unknown until a reading arrives', () => {
    // Used to be NaN when the capability arrived before the first status frame.
    expect(getWaterLevelPercent({ ...calibrated, distance: undefined })).toBeNull();
  });

  test('is unknown without a sensor or calibration', () => {
    expect(getWaterLevelPercent({ ...calibrated, tof: false, distance: 120 })).toBeNull();
    expect(getWaterLevelPercent({ ...calibrated, fullTankDistance: 0, distance: 120 })).toBeNull();
    expect(
      getWaterLevelPercent({ ...calibrated, fullTankDistance: 200, distance: 120 }),
    ).toBeNull();
  });
});

describe('compareNewestFirst', () => {
  test('sorts newest first and shots without a timestamp last', () => {
    const shots = [
      { id: 'none', timestamp: undefined },
      { id: 'old', timestamp: 100 },
      { id: 'null', timestamp: null },
      { id: 'new', timestamp: 300 },
      { id: 'mid', timestamp: 200 },
    ];
    expect(shots.sort(compareNewestFirst).map(s => s.id)).toEqual([
      'new',
      'mid',
      'old',
      'none',
      'null',
    ]);
  });
});

describe('scheduleFrame', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('cancels an animation frame without touching timers', () => {
    const cancelAnimationFrame = vi.fn();
    const clearTimeout = vi.spyOn(globalThis, 'clearTimeout');
    vi.stubGlobal('requestAnimationFrame', () => 5);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);

    scheduleFrame(() => {})();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(5);
    // The old code also cleared timer 5, which could belong to someone else.
    expect(clearTimeout).not.toHaveBeenCalled();
  });

  test('falls back to a timer without requestAnimationFrame', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.useFakeTimers();
    const ran = vi.fn();
    const cancelled = vi.fn();

    scheduleFrame(ran);
    scheduleFrame(cancelled)();
    vi.advanceTimersByTime(16);
    expect(ran).toHaveBeenCalledOnce();
    expect(cancelled).not.toHaveBeenCalled();
  });
});

describe('phase target helpers', () => {
  const phase = /** @type {import('../src/pages/ProfileEdit/types').EditorPhase} */ ({
    name: 'Brew',
    phase: 'brew',
    valve: 1,
    duration: 30,
    pump: 100,
    targets: [
      { type: 'volumetric', value: 36 },
      { type: 'pressure', value: 9 },
    ],
  });

  test('replace a target without changing the phase passed in', () => {
    const before = structuredClone(phase);
    const next = updatePhaseTargetAt(phase, 0, { type: 'volumetric', value: 40 });
    expect(next.targets).toEqual([
      { type: 'volumetric', value: 40 },
      { type: 'pressure', value: 9 },
    ]);
    // ExtendedPhase used to write into the parent's targets array.
    expect(phase).toEqual(before);
    expect(next.targets).not.toBe(phase.targets);
  });

  test('remove a target without changing the phase passed in', () => {
    const before = structuredClone(phase);
    expect(removePhaseTargetAt(phase, 0).targets).toEqual([{ type: 'pressure', value: 9 }]);
    expect(phase).toEqual(before);
  });
});
