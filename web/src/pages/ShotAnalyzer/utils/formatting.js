import { msg, t } from '@lingui/core/macro';
import { i18n } from '../../../i18n.js';
import { COMPARE_TARGET_DISPLAY_MODES, TIMESTAMP_SECONDS_THRESHOLD } from './constants';

/** @typedef {import('../types').AnalyzerShot} AnalyzerShot */
/** @typedef {import('./constants').CompareTargetDisplayMode} CompareTargetDisplayMode */

// Analyzer stop reasons stay English internally; translate only for display.
/** @type {Record<string, import('@lingui/core').MessageDescriptor>} */
const STOP_REASON_MESSAGES = {
  'Weight Stop': msg`Weight Stop`,
  'Pressure Stop': msg`Pressure Stop`,
  'Pump Flow Stop': msg`Pump Flow Stop`,
  'Pumped Water Stop': msg`Pumped Water Stop`,
  'Time Stop': msg`Time Stop`,
  'Ratio Stop': msg`Ratio Stop`,
  'Safety Timeout': msg`Safety Timeout`,
  'Manually Stopped': msg`Manually Stopped`,
  'Time Limit': msg`Time Limit`,
};

/**
 * @param {string} reason
 * @returns {string}
 */
function translateStopReason(reason) {
  const message = STOP_REASON_MESSAGES[reason];
  return message ? i18n._(message) : reason;
}

/**
 * @param {unknown} value
 * @param {number} [digits]
 * @returns {string} '-' when not a finite number
 */
export function formatMetricValue(value, digits = 1) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(digits) : '-';
}

/**
 * @param {string} reason
 * @returns {string}
 */
function getDisplayStopReason(reason) {
  if (reason === 'Water Drawn Stop') return 'Pumped Water Stop';
  if (reason === 'Flow Stop') return 'Pump Flow Stop';
  return reason;
}

/**
 * @param {string | null} [reason] Untranslated analyzer stop reason
 * @returns {{ skipNotice: string, stopReason: string }}
 */
export function getDisplayStopReasonParts(reason = '') {
  const rawReason = reason ?? '';
  const skippedSuffix = ' (skipped)';
  const hasSkippedSuffix = rawReason.endsWith(skippedSuffix);
  const baseReason = hasSkippedSuffix ? rawReason.slice(0, -skippedSuffix.length) : rawReason;
  const displayReason = getDisplayStopReason(baseReason);
  if (!displayReason) {
    return { skipNotice: '', stopReason: '' };
  }

  if (displayReason === 'Phase skipped') {
    return { skipNotice: t`Phase skipped`, stopReason: '' };
  }

  if (displayReason === 'Phase skipped (no preceding phase)') {
    return { skipNotice: t`Phase skipped`, stopReason: t`No preceding phase` };
  }

  if (hasSkippedSuffix) {
    return {
      skipNotice: t`Phase skipped`,
      stopReason: translateStopReason(displayReason),
    };
  }

  return { skipNotice: '', stopReason: translateStopReason(displayReason) };
}

/**
 * @param {string | null | undefined} name
 * @returns {string}
 */
export const cleanName = name => {
  if (!name) return '';
  return name.replace(/\.json$/i, '');
};

/**
 * @param {number | null | undefined} timestamp Epoch seconds or ms
 * @returns {string}
 */
export const formatTimestamp = timestamp => {
  if (!timestamp) return '';
  const ms = timestamp < TIMESTAMP_SECONDS_THRESHOLD ? timestamp * 1000 : timestamp;
  return new Date(ms).toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * @param {import('../../../types').ShotSample[] | null | undefined} samples
 * @returns {string}
 */
export const formatDuration = samples => {
  if (!samples || samples.length === 0) return '0s';
  const duration = (samples.at(-1).t - samples[0].t) / 1000;
  return `${duration.toFixed(1)}s`;
};

/**
 * @param {AnalyzerShot | null | undefined} shot
 * @returns {string}
 */
export const getShotDisplayName = shot => {
  if (!shot) return t`Unknown`;
  if (shot.source === 'gaggimate') {
    return `#${shot.id || shot.name || t`Unknown`}`;
  }
  return cleanName(shot.name || shot.storageKey || shot.id || t`Unknown`);
};

/**
 * @param {number | null | undefined} doseIn g
 * @param {number | null | undefined} doseOut g
 * @returns {number | null}
 */
export const calculateRatio = (doseIn, doseOut) => {
  if (!doseIn || !doseOut || doseIn <= 0) return null;
  return Number.parseFloat((doseOut / doseIn).toFixed(2));
};

/**
 * @param {unknown} value
 * @returns {CompareTargetDisplayMode}
 */
export const normalizeCompareTargetDisplayMode = value => {
  if (value === COMPARE_TARGET_DISPLAY_MODES.NONE) return value;
  if (value === COMPARE_TARGET_DISPLAY_MODES.MAIN_SHOT_ONLY) return value;
  if (value === COMPARE_TARGET_DISPLAY_MODES.PER_SHOT) return value;
  return COMPARE_TARGET_DISPLAY_MODES.NONE;
};
