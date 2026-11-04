// Builds .slog shot files for tests, following the layout parseBinaryShot reads
// (src/display/models/shot_log_format.h).

/** Sample fields in wire order (field mask bits 0..13) with their scale. */
const FIELDS = /** @type {const} */ ([
  ['t', 1],
  ['tt', 10],
  ['ct', 10],
  ['tp', 10],
  ['cp', 10],
  ['fl', 100],
  ['tf', 100],
  ['pf', 100],
  ['vf', 100],
  ['v', 10],
  ['ev', 10],
  ['pr', 100],
  ['si', 1],
  ['wp', 10],
]);
const SIGNED = new Set(['fl', 'tf', 'pf', 'vf']);

/**
 * @typedef {Partial<Record<(typeof FIELDS)[number][0], number>>} SlogSample
 * Decoded values (°C, bar, ml/s, g); `t` is elapsed ms (v6+) or the tick count (v4/v5),
 * `si` the raw system-info bits.
 */

/**
 * @typedef {object} SlogTransition
 * @property {number} sampleIndex
 * @property {number} phaseNumber
 * @property {string} phaseName
 * @property {number} [reason] PhaseExitReason code.
 */

/**
 * @param {object} options
 * @param {SlogSample[]} options.samples
 * @param {number} [options.version] 4..8; 4 has a 128-byte header, 6+ 32-bit elapsed-ms ticks.
 * @param {number} [options.fieldsMask] Defaults to bits 0..12 (v4..v6) or 0..13 (v7+).
 * @param {number} [options.sampleInterval]
 * @param {number} [options.sampleCount] Header sample count; 0 marks a shot still being written.
 * @param {number} [options.duration] Header duration in ms.
 * @param {number} [options.startEpoch]
 * @param {string} [options.profileId]
 * @param {string} [options.profileName]
 * @param {number} [options.finalWeight] g
 * @param {SlogTransition[]} [options.transitions]
 * @param {number} [options.finalExitReason]
 * @param {number} [options.brewDelay] ms
 * @param {number} [options.trailingBytes] Extra bytes after the last sample (a partial write).
 * @returns {ArrayBuffer}
 */
export function buildSlog({
  samples,
  version = 8,
  fieldsMask = version >= 7 ? 0x3fff : 0x1fff,
  sampleInterval = 250,
  sampleCount = samples.length,
  duration = samples.length ? (samples[samples.length - 1].t ?? 0) : 0,
  startEpoch = 0,
  profileId = '',
  profileName = '',
  finalWeight = 0,
  transitions = [],
  finalExitReason = 0,
  brewDelay = 0,
  trailingBytes = 0,
}) {
  const headerSize = version <= 4 ? 128 : 512;
  const elapsed = version >= 6;
  let fieldCount = 0;
  for (let bit = 0; bit < 32; bit++) if (fieldsMask & (1 << bit)) fieldCount++;
  const sampleSize = fieldCount * 2 + (elapsed ? 2 : 0);

  const buffer = new ArrayBuffer(headerSize + samples.length * sampleSize + trailingBytes);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const encoder = new TextEncoder();

  view.setUint32(0, 0x544f4853, true);
  view.setUint8(4, version);
  view.setUint8(5, sampleSize);
  view.setUint16(6, headerSize, true);
  view.setUint16(8, sampleInterval, true);
  view.setUint32(12, fieldsMask, true);
  view.setUint32(16, sampleCount, true);
  view.setUint32(20, duration, true);
  view.setUint32(24, startEpoch, true);
  bytes.set(encoder.encode(profileId).subarray(0, 31), 28);
  bytes.set(encoder.encode(profileName).subarray(0, 47), 60);
  view.setUint16(108, Math.round(finalWeight * 10), true);

  if (version >= 5) {
    transitions.forEach((transition, i) => {
      const offset = 110 + i * 29;
      view.setUint16(offset, transition.sampleIndex, true);
      view.setUint8(offset + 2, transition.phaseNumber);
      view.setUint8(offset + 3, transition.reason ?? 0);
      bytes.set(encoder.encode(transition.phaseName).subarray(0, 24), offset + 4);
    });
    view.setUint8(110 + 12 * 29, transitions.length);
    view.setUint8(110 + 12 * 29 + 1, finalExitReason);
    view.setUint16(110 + 12 * 29 + 2, brewDelay, true);
  }

  samples.forEach((sample, i) => {
    let offset = headerSize + i * sampleSize;
    for (let bit = 0; bit < 32; bit++) {
      if (!(fieldsMask & (1 << bit))) continue;
      const [name, scale] = FIELDS[bit] ?? [`unknown_${bit}`, 1];
      const raw = Math.round((sample[/** @type {keyof SlogSample} */ (name)] ?? 0) * scale);
      if (bit === 0 && elapsed) {
        view.setUint32(offset, raw, true);
        offset += 4;
      } else {
        if (SIGNED.has(name)) view.setInt16(offset, raw, true);
        else view.setUint16(offset, raw, true);
        offset += 2;
      }
    }
  });

  return buffer;
}
