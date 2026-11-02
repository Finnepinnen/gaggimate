// Shared between the settings page and the setup wizard.

/** @typedef {import('./types').AutoWakeupSchedule} AutoWakeupSchedule */

export const CHECKBOX_KEYS = [
  'tankLevelEnabled',
  'steamLevelEnabled',
  'albaRefillInterlock',
  'homekit',
  'boilerFillActive',
  'smartGrindActive',
  'smartDoseActive',
  'smartDoseAutomagic',
  'dosingCupEnabled',
  'portafilterEnabled',
  'mahlkonigActive',
  'homeAssistant',
  'momentaryButtons',
  'heaterCoordinationEnabled',
  'delayAdjust',
  'clock24hFormat',
  'autowakeupEnabled',
  'smartGrindToggle',
];

/**
 * @param {string} pidString "p,i,d[,kf]"
 * @returns {{ pid: string, kf: string }}
 */
export function splitPidString(pidString) {
  if (!pidString) return { pid: pidString, kf: '0.000' };
  const parts = pidString.split(',');
  if (parts.length >= 4) {
    return { pid: parts.slice(0, 3).join(','), kf: parts[3] };
  }
  return { pid: pidString, kf: '0.000' };
}

/**
 * @param {unknown} autowakeupSchedules
 * @returns {AutoWakeupSchedule[]}
 */
export function parseAutoWakeupSchedules(autowakeupSchedules) {
  const defaultSchedule = [{ time: '07:00', days: [true, true, true, true, true, true, true] }];
  if (!autowakeupSchedules) {
    return defaultSchedule;
  }
  /** @type {AutoWakeupSchedule[]} */
  const schedules = [];
  if (typeof autowakeupSchedules === 'string' && autowakeupSchedules.trim()) {
    const scheduleStrings = autowakeupSchedules.split(';');
    for (const scheduleStr of scheduleStrings) {
      const [time, daysStr] = scheduleStr.split('|');
      if (time && daysStr && daysStr.length === 7) {
        const days = daysStr.split('').map(d => d === '1');
        schedules.push({ time, days });
      }
    }
  }
  return schedules.length > 0 ? schedules : defaultSchedule;
}

/** @param {AutoWakeupSchedule[]} autowakeupSchedules */
export function serializeAutoWakeupSchedules(autowakeupSchedules) {
  return autowakeupSchedules
    .map(schedule => `${schedule.time}|${schedule.days.map(d => (d ? '1' : '0')).join('')}`)
    .join(';');
}
