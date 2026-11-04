import { describe, expect, test } from 'vitest';
import { parseBinaryShot } from '../src/pages/ShotHistory/parseBinaryShot.js';
import { buildSlog } from './helpers/slog.js';

/** @param {number} n */
const ticks = n => Array.from({ length: n }, (_, i) => ({ t: (i + 1) * 250 }));

describe('parseBinaryShot header', () => {
  test('reads profile, timing and stop metadata', () => {
    const shot = parseBinaryShot(
      buildSlog({
        samples: ticks(3),
        startEpoch: 1_760_000_000,
        profileId: 'p-123',
        profileName: 'Café crème', // multibyte UTF-8
        finalExitReason: 1,
        brewDelay: 800,
      }),
      'shot-1',
    );

    expect(shot).toMatchObject({
      id: 'shot-1',
      version: 8,
      profile: 'Café crème',
      profileId: 'p-123',
      timestamp: 1_760_000_000,
      sampleInterval: 250,
      fieldsMask: 0x3fff,
      samplesExpected: 3,
      duration: 750,
      incomplete: false,
      trailingBytes: 0,
      finalExitReason: 1,
      finalExitReasonLabel: 'Volumetric target',
      brewDelay: 800,
    });
  });

  test('labels an unknown exit reason', () => {
    const shot = parseBinaryShot(buildSlog({ samples: ticks(1), finalExitReason: 42 }), 'x');
    expect(shot.finalExitReasonLabel).toBe('Unknown');
  });

  test.each([
    ['too small', new ArrayBuffer(8), /too small for header/],
    [
      'bad magic',
      (() => {
        const buffer = buildSlog({ samples: ticks(1) });
        new DataView(buffer).setUint32(0, 0xdeadbeef, true);
        return buffer;
      })(),
      /Bad magic/,
    ],
    [
      'header size mismatch',
      (() => {
        const buffer = buildSlog({ samples: ticks(1) });
        new DataView(buffer).setUint16(6, 128, true);
        return buffer;
      })(),
      /Header size mismatch/,
    ],
    ['truncated v5+ header', buildSlog({ samples: [] }).slice(0, 200), /need 512 bytes/],
  ])('rejects %s', (_, buffer, error) => {
    expect(() => parseBinaryShot(buffer, 'bad')).toThrow(error);
  });
});

describe('parseBinaryShot samples', () => {
  test('scales every field', () => {
    const shot = parseBinaryShot(
      buildSlog({
        samples: [
          {
            t: 250,
            tt: 93,
            ct: 92.4,
            tp: 9,
            cp: 8.7,
            fl: 2.45,
            tf: 2,
            pf: 1.5,
            vf: 1.25,
            v: 36.5,
            ev: 37,
            pr: 4.2,
            si: 0x1f,
            wp: 40.3,
          },
        ],
      }),
      'x',
    );
    const [sample] = shot.samples;
    expect(sample).toMatchObject({
      t: 250,
      tt: 93,
      ct: 92.4,
      tp: 9,
      cp: 8.7,
      fl: 2.45,
      tf: 2,
      pf: 1.5,
      vf: 1.25,
      v: 36.5,
      ev: 37,
      pr: 4.2,
      wp: 40.3,
    });
    expect(sample.systemInfo).toMatchObject({
      raw: 0x1f,
      shotStartedVolumetric: true,
      currentlyVolumetric: true,
      bluetoothScaleConnected: true,
      volumetricAvailable: true,
      extendedRecording: true,
      processIsBrew: false,
    });
  });

  test('decodes negative flow values', () => {
    const shot = parseBinaryShot(buildSlog({ samples: [{ t: 250, fl: -0.5, pf: -1 }] }), 'x');
    expect(shot.samples[0].fl).toBe(-0.5);
    expect(shot.samples[0].pf).toBe(-1);
  });

  test('converts v4/v5 tick counts to ms using the sample interval', () => {
    for (const version of [4, 5]) {
      const shot = parseBinaryShot(
        buildSlog({ version, sampleInterval: 200, samples: [{ t: 1 }, { t: 2 }, { t: 3 }] }),
        'x',
      );
      expect(shot.samples.map(s => s.t)).toEqual([200, 400, 600]);
    }
  });

  test('only v5+ files carry phase information', () => {
    expect(
      parseBinaryShot(buildSlog({ version: 4, samples: ticks(1) }), 'x').samples[0],
    ).not.toHaveProperty('phaseNumber');
    expect(
      parseBinaryShot(buildSlog({ version: 5, samples: ticks(1) }), 'x').samples[0],
    ).toMatchObject({ phaseNumber: 0, phaseDisplayNumber: 1, phaseName: 'Phase 1' });
  });

  test('assigns phases from header transitions', () => {
    const shot = parseBinaryShot(
      buildSlog({
        samples: ticks(5),
        transitions: [
          { sampleIndex: 0, phaseNumber: 0, phaseName: 'Preinfusion', reason: 5 },
          { sampleIndex: 2, phaseNumber: 1, phaseName: 'Brew', reason: 1 },
        ],
      }),
      'x',
    );

    expect(shot.samples.map(s => [s.phaseNumber, s.phaseDisplayNumber, s.phaseName])).toEqual([
      [0, 1, 'Preinfusion'],
      [0, 1, 'Preinfusion'],
      [1, 2, 'Brew'],
      [1, 2, 'Brew'],
      [1, 2, 'Brew'],
    ]);
    expect(shot.phaseTransitions).toEqual([
      {
        sampleIndex: 0,
        phaseNumber: 0,
        phaseName: 'Preinfusion',
        transitionReason: 5,
        transitionReasonLabel: 'Duration',
      },
      {
        sampleIndex: 2,
        phaseNumber: 1,
        phaseName: 'Brew',
        transitionReason: 1,
        transitionReasonLabel: 'Volumetric target',
      },
    ]);
  });

  test('skips fields it does not know, keeping later fields aligned', () => {
    // Bit 14 is not defined yet; the parser must step over it.
    const shot = parseBinaryShot(
      buildSlog({ samples: [{ t: 250, wp: 12.5 }], fieldsMask: 0x7fff }),
      'x',
    );
    expect(shot.samples[0]).toMatchObject({ wp: 12.5, unknown_14: 0 });
  });
});

describe('parseBinaryShot completeness', () => {
  test('a sample count of 0 marks a shot still being written; duration comes from the samples', () => {
    const shot = parseBinaryShot(
      buildSlog({ samples: ticks(4), sampleCount: 0, duration: 0 }),
      'x',
    );
    expect(shot.incomplete).toBe(true);
    expect(shot.samples).toHaveLength(4);
    expect(shot.duration).toBe(1000);
  });

  test('a partial trailing sample makes the shot incomplete and is ignored', () => {
    const shot = parseBinaryShot(buildSlog({ samples: ticks(3), trailingBytes: 7 }), 'x');
    expect(shot.incomplete).toBe(true);
    expect(shot.trailingBytes).toBe(7);
    expect(shot.samples).toHaveLength(3);
  });

  test('fewer samples than the header promises makes the shot incomplete', () => {
    const shot = parseBinaryShot(buildSlog({ samples: ticks(3), sampleCount: 10 }), 'x');
    expect(shot.incomplete).toBe(true);
    expect(shot.samples).toHaveLength(3);
  });

  test('extra samples beyond the header count are ignored', () => {
    const shot = parseBinaryShot(buildSlog({ samples: ticks(5), sampleCount: 2 }), 'x');
    expect(shot.incomplete).toBe(false);
    expect(shot.samples).toHaveLength(2);
  });

  test('a complete shot uses the header duration', () => {
    const shot = parseBinaryShot(buildSlog({ samples: ticks(3), duration: 900 }), 'x');
    expect(shot.duration).toBe(900);
  });
});

describe('parseBinaryShot volume', () => {
  test('prefers the header final weight', () => {
    const shot = parseBinaryShot(
      buildSlog({ samples: [{ t: 250, v: 30 }], finalWeight: 36.4 }),
      'x',
    );
    expect(shot.volume).toBe(36.4);
  });

  test('falls back to the last sample weight', () => {
    const shot = parseBinaryShot(
      buildSlog({
        samples: [
          { t: 250, v: 10 },
          { t: 500, v: 31.2 },
        ],
      }),
      'x',
    );
    expect(shot.volume).toBe(31.2);
  });

  test('is null without any weight', () => {
    expect(parseBinaryShot(buildSlog({ samples: ticks(2) }), 'x').volume).toBeNull();
  });
});
