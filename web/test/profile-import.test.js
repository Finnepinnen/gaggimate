import { describe, expect, test } from 'vitest';
import { parseProfile } from '../src/pages/ProfileList/utils.js';

/** @param {unknown} value */
const parseJson = value => parseProfile(JSON.stringify(value));

describe('parseProfile', () => {
  test('passes a GaggiMate profile through', () => {
    const profile = { label: 'Mine', type: 'standard', temperature: 93, phases: [] };
    expect(parseJson(profile)).toEqual([profile]);
  });

  test('passes an array of profiles through', () => {
    const profiles = [{ label: 'A' }, { label: 'B' }];
    expect(parseJson(profiles)).toEqual(profiles);
  });

  test('returns nothing for input that is neither JSON nor TCL', () => {
    expect(parseProfile('not a profile')).toEqual([]);
    expect(parseProfile('')).toEqual([]);
  });
});

describe('Gaggiuino import', () => {
  const gaggiuino = {
    name: 'Londinium',
    waterTemperature: 92,
    globalStopConditions: { weight: 40 },
    phases: [
      {
        name: 'Fill',
        type: 'FLOW',
        restriction: 3,
        target: { time: 0, end: 4, curve: 'INSTANT' },
        stopConditions: { time: 10000, pressureAbove: 2.5 },
      },
      {
        type: 'PRESSURE',
        restriction: 2.5,
        waterTemperature: 90,
        target: { time: 4000, end: 9, curve: 'LINEAR' },
        stopConditions: { time: 30000, weight: 36, flowBelow: 0.5 },
      },
    ],
  };

  test('converts phases, pump targets and stop conditions', () => {
    const [profile] = parseJson(gaggiuino);
    expect(profile).toMatchObject({
      label: 'Londinium',
      type: 'pro',
      description: '',
      temperature: 92,
    });
    expect(profile.phases).toEqual([
      {
        name: 'Fill',
        phase: 'preinfusion',
        valve: 1,
        pump: { target: 'flow', pressure: 3, flow: 4 },
        duration: 10,
        targets: [
          { type: 'pressure', value: 2.5 },
          // Falls back to the global weight stop.
          { type: 'volumetric', value: 40 },
        ],
        temperature: 0,
        transition: { type: 'instant', duration: 0, adaptive: true },
      },
      {
        name: 'Phase 2',
        phase: 'brew',
        valve: 1,
        pump: { target: 'pressure', pressure: 9, flow: 2.5 },
        duration: 30,
        targets: [
          { type: 'flow', operator: 'lte', value: 0.5 },
          // A per-phase weight replaces the global one.
          { type: 'volumetric', value: 36 },
        ],
        temperature: 90,
        transition: { type: 'linear', duration: 4, adaptive: true },
      },
    ]);
  });

  test('uses the ramp time when it is longer than the stop time', () => {
    const [profile] = parseJson({
      waterTemperature: 93,
      phases: [{ target: { time: 8000, end: 0, curve: 'LINEAR' }, stopConditions: { time: 5000 } }],
    });
    expect(profile.phases[0].duration).toBe(8);
    // A zero end target leaves the pump off.
    expect(profile.phases[0].pump).toBe(0);
  });

  test.each([
    ['INSTANT', 'instant'],
    ['LINEAR', 'linear'],
    ['EASE_IN', 'ease-in'],
    ['EASE_OUT', 'ease-out'],
    ['EASE_IN_OUT', 'ease-in-out'],
    ['ease_in_out', 'ease-in-out'],
    ['WIGGLE', 'linear'],
  ])('maps the %s curve to %s', (curve, type) => {
    const [profile] = parseJson({
      waterTemperature: 93,
      phases: [{ target: { time: 0, end: 9, curve }, stopConditions: { time: 1000 } }],
    });
    expect(profile.phases[0].transition?.type).toBe(type);
  });

  test('runs a phase without a time stop for the maximum duration', () => {
    const [profile] = parseJson({
      waterTemperature: 93,
      phases: [{ target: { time: 2000, end: 9, curve: 'LINEAR' }, stopConditions: { weight: 36 } }],
    });
    expect(profile.phases[0].duration).toBe(300);
  });

  test('imports sparse phases with defaults', () => {
    const [profile] = parseJson({ waterTemperature: 93, phases: [{ type: 'PRESSURE' }] });
    expect(profile.label).toBe('Imported Profile');
    expect(profile.phases).toEqual([
      {
        name: 'Phase 1',
        phase: 'brew',
        valve: 1,
        pump: 0,
        duration: 300,
        targets: [],
        temperature: 0,
        transition: { type: 'instant', duration: 0, adaptive: true },
      },
    ]);
  });

  test('never puts an undefined restriction into the pump', () => {
    const [profile] = parseJson({
      waterTemperature: 93,
      phases: [{ type: 'PRESSURE', target: { time: 0, end: 9, curve: 'INSTANT' } }],
    });
    expect(profile.phases[0].pump).toEqual({ target: 'pressure', pressure: 9, flow: 0 });
  });
});

describe('Meticulous import', () => {
  const meticulous = {
    name: 'Bloom & Press',
    temperature: 91,
    final_weight: 42,
    display: { shortDescription: 'Short', image: 'data:image/png;base64,AAAA' },
    variables: [
      { key: 'peak', value: 8.5 },
      { key: 'bloom_time', value: 12 },
    ],
    stages: [
      {
        name: 'Bloom',
        type: 'flow',
        temperature_delta: -2,
        dynamics: { points: [[0, 4]], over: 'time', interpolation: 'linear' },
        exit_triggers: [
          { type: 'time', value: '$bloom_time' },
          { type: 'pressure', value: 3, comparison: '>=' },
        ],
        limits: [{ type: 'pressure', value: 4 }],
      },
      {
        name: 'Press',
        type: 'pressure',
        dynamics: {
          points: [
            [0, 2],
            [6, '$peak'],
          ],
          over: 'time',
          interpolation: 'curve',
        },
        exit_triggers: [
          { type: 'weight', value: 5, relative: true },
          { type: 'flow', value: 1, comparison: '<=' },
          { type: 'time', value: 40 },
        ],
        limits: [{ type: 'flow', value: 3 }],
      },
      { name: 'Drip', type: 'power', dynamics: { points: [[0, 140]], over: 'weight' } },
    ],
  };

  test('converts stages to phases', () => {
    const [profile] = parseJson(meticulous);
    expect(profile).toMatchObject({
      label: 'Bloom & Press',
      type: 'pro',
      description: 'Short',
      temperature: 91,
      image: 'data:image/png;base64,AAAA',
    });
    expect(profile.phases).toEqual([
      {
        name: 'Bloom',
        phase: 'preinfusion',
        valve: 1,
        duration: 12,
        pump: { target: 'flow', pressure: 4, flow: 4 },
        transition: { type: 'linear', duration: 0, adaptive: false },
        temperature: 89,
        targets: [
          { type: 'pressure', operator: 'gte', value: 3 },
          { type: 'volumetric', operator: 'gte', value: 42 },
        ],
      },
      {
        name: 'Press',
        phase: 'brew',
        valve: 1,
        duration: 40,
        pump: { target: 'pressure', pressure: 8.5, flow: 3 },
        transition: { type: 'ease-in-out', duration: 6, adaptive: false },
        // The relative weight trigger is dropped; final_weight caps the phase instead.
        targets: [
          { type: 'flow', operator: 'lte', value: 1 },
          { type: 'volumetric', operator: 'gte', value: 42 },
        ],
      },
      {
        name: 'Drip',
        phase: 'brew',
        valve: 1,
        // No time trigger and not a time axis: falls back to the 300 s maximum.
        duration: 300,
        // Power stages clamp to a 0..100 % duty cycle.
        pump: 100,
        transition: { type: 'instant', duration: 0, adaptive: false },
        targets: [{ type: 'volumetric', operator: 'gte', value: 42 }],
      },
    ]);
  });

  test('fills in defaults for a minimal profile', () => {
    const [profile] = parseJson({
      stages: [{ type: 'flow', dynamics: { points: [[0, 2]], over: 'time' } }],
    });
    expect(profile).toMatchObject({
      label: 'Imported Profile',
      description: '',
      temperature: 93,
    });
    expect(profile).not.toHaveProperty('image');
    // A single point at t=0 gives no duration, so it falls back to the 300 s maximum.
    expect(profile.phases[0]).toMatchObject({ name: 'Phase 1', duration: 300 });
    expect(profile.phases[0]).not.toHaveProperty('targets');
  });
});

describe('Decent TCL import', () => {
  test('converts a simple pressure profile', () => {
    const tcl = [
      'profile_title {Classic Italian}',
      'profile_notes {Line one\n  line two}',
      'settings_profile_type settings_2a',
      'espresso_temperature 92.5',
      'preinfusion_time 8',
      'preinfusion_flow_rate 4',
      'preinfusion_stop_pressure 4',
      'espresso_hold_time 10',
      'espresso_pressure 9',
      'espresso_decline_time 20',
      'pressure_end 6',
      'final_desired_shot_weight 36',
    ].join('\n');

    const [profile] = parseProfile(tcl);
    expect(profile).toMatchObject({
      label: 'Classic Italian',
      description: 'Line one line two',
      temperature: 92.5,
    });
    const weightCap = { type: 'volumetric', operator: 'gte', value: 36 };
    expect(profile.phases).toEqual([
      {
        name: 'Pre-infusion',
        phase: 'preinfusion',
        valve: 1,
        duration: 8,
        pump: { target: 'flow', pressure: 0, flow: 4 },
        targets: [{ type: 'pressure', operator: 'gte', value: 4 }, weightCap],
      },
      {
        name: 'Hold',
        phase: 'brew',
        valve: 1,
        duration: 10,
        pump: { target: 'pressure', pressure: 9, flow: 0 },
        targets: [weightCap],
      },
      {
        name: 'Decline',
        phase: 'brew',
        valve: 1,
        duration: 20,
        transition: { type: 'linear', duration: 20, adaptive: true },
        pump: { target: 'pressure', pressure: 6, flow: 0 },
        targets: [weightCap],
      },
    ]);
  });

  test('converts an advanced profile', () => {
    const tcl = [
      'profile_title Advanced',
      'settings_profile_type settings_2c',
      'final_desired_shot_volume_advanced_count_start 1',
      'final_desired_shot_weight_advanced 38',
      'advanced_shot {{name {Soak} pump flow flow 2 seconds 15 exit_if 1 exit_type pressure_over exit_pressure_over 3 max_flow_or_pressure 4 temperature 90} {name {Pour} pump pressure pressure 8.6 seconds 30 transition smooth volume 60 max_flow_or_pressure 2.5}}',
    ].join('\n');

    const [profile] = parseProfile(tcl);
    expect(profile.phases).toEqual([
      {
        name: 'Soak',
        phase: 'preinfusion',
        valve: 1,
        duration: 15,
        pump: { target: 'flow', pressure: 4, flow: 2 },
        transition: { type: 'instant', duration: 0, adaptive: false },
        temperature: 90,
        targets: [
          { type: 'pressure', operator: 'gte', value: 3 },
          { type: 'volumetric', operator: 'gte', value: 38 },
        ],
      },
      {
        name: 'Pour',
        phase: 'brew',
        valve: 1,
        duration: 30,
        pump: { target: 'pressure', pressure: 8.6, flow: 2.5 },
        transition: { type: 'linear', duration: 30, adaptive: false },
        targets: [
          { type: 'pumped', operator: 'gte', value: 60 },
          { type: 'volumetric', operator: 'gte', value: 38 },
        ],
      },
    ]);
  });

  test('rejects a profile that yields no phases', () => {
    expect(parseProfile('profile_title Empty\nsettings_profile_type settings_2a')).toEqual([]);
  });
});
