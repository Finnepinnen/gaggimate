import { parseBinaryShot } from '../../src/pages/ShotHistory/parseBinaryShot.js';
import { buildSlog } from './slog.js';

/** @typedef {import('./slog.js').SlogSample} SlogSample */

// System-info bits (see parseBinaryShot).
export const SI_STARTED_VOLUMETRIC = 0x01;
export const SI_BT_SCALE = 0x04;
export const SI_BREW = 0x20;
export const SI_ACTIVE_SCALE = 0x100;

/**
 * A 10 s two-phase shot sampled every 250 ms, run through the real .slog parser:
 * - "Preinfusion" (phase 0, 0–5 s): 3 bar, 4 ml/s, no weight.
 * - "Brew" (phase 1, 5–10 s): 9 bar, 2 ml/s, weight rising 1.8 g per sample to 36 g.
 * Flow integrates to 20 ml + 10 ml. The preinfusion ends on time, the shot on weight.
 * @param {object} [options]
 * @param {number} [options.si] System-info bits on every sample (default: brew by weight, scale connected).
 * @param {(sample: SlogSample, index: number) => SlogSample} [options.mapSample]
 * @param {Partial<Parameters<typeof buildSlog>[0]>} [options.slog] Overrides for the file header.
 */
export function makeShot({
  si = SI_STARTED_VOLUMETRIC | SI_BT_SCALE | SI_BREW | SI_ACTIVE_SCALE,
  mapSample = s => s,
  slog = {},
} = {}) {
  /** @type {SlogSample[]} */
  const samples = [];
  for (let i = 0; i <= 40; i++) {
    const brew = i >= 20;
    const sample = {
      t: i * 250,
      tt: 93,
      ct: 92,
      tp: brew ? 9 : 3,
      cp: brew ? 9 : 3,
      fl: brew ? 2 : 4,
      pf: brew ? 1.5 : 0,
      v: brew ? (i - 20) * 1.8 : 0,
      si,
    };
    samples.push(mapSample(sample, i));
  }

  const buffer = buildSlog({
    samples,
    // v7 records no active-scale bit, so use v8; the default mask has no wp field.
    version: 8,
    fieldsMask: 0x1fff,
    profileName: 'Test profile',
    finalWeight: 36,
    // A transition records why the previous phase ended; the final reason covers the last phase.
    transitions: [
      { sampleIndex: 0, phaseNumber: 0, phaseName: 'Preinfusion', reason: 0 },
      { sampleIndex: 20, phaseNumber: 1, phaseName: 'Brew', reason: 5 },
    ],
    finalExitReason: 1,
    ...slog,
  });
  return parseBinaryShot(buffer, 'test-shot');
}

/** @returns {import('../../src/pages/ShotAnalyzer/types').AnalyzerProfile} */
export function makeProfile() {
  return {
    label: 'Test profile',
    type: 'pro',
    temperature: 93,
    phases: [
      {
        name: 'Preinfusion',
        phase: 'preinfusion',
        valve: 1,
        duration: 5,
        pump: { target: 'flow', pressure: 3, flow: 4 },
      },
      {
        name: 'Brew',
        phase: 'brew',
        valve: 1,
        duration: 30,
        pump: { target: 'pressure', pressure: 9, flow: 0 },
        targets: [{ type: 'volumetric', operator: 'gte', value: 36 }],
      },
      {
        name: 'Never reached',
        phase: 'brew',
        valve: 1,
        duration: 5,
        pump: { target: 'pressure', pressure: 6, flow: 0 },
      },
    ],
  };
}

/** @type {import('../../src/pages/ShotAnalyzer/types').AnalysisSettings} */
export const SETTINGS = { scaleDelayMs: 0, sensorDelayMs: 0, isAutoAdjusted: false };
