import { signal } from '@preact/signals';
import { msg } from '@lingui/core/macro';
import { i18n } from '../i18n.js';
import { isApp } from './platform.js';

// Settings that belong to the phone, not to a machine; persisted with Capacitor Preferences.
const STORAGE_KEY = 'gaggimate.appSettings';

// `label` and `help` are getters so they read in the active locale.
/**
 * @typedef {object} NotificationEventDef
 * @property {NotificationEventKey} key
 * @property {import('@lingui/core').MessageDescriptor} labelMsg
 * @property {import('@lingui/core').MessageDescriptor} helpMsg
 */

export const NOTIFICATION_EVENTS = /** @type {NotificationEventDef[]} */ ([
  {
    key: 'preheated',
    labelMsg: msg`Machine preheated`,
    helpMsg: msg`The boiler reached brew temperature.`,
  },
  {
    key: 'shotStarted',
    labelMsg: msg`Shot started`,
    helpMsg: msg`A brew started on the machine.`,
  },
  { key: 'shotFinished', labelMsg: msg`Shot finished`, helpMsg: msg`With shot time and weight.` },
  {
    key: 'steamLeftOn',
    labelMsg: msg`Steam mode left on`,
    helpMsg: msg`The machine has been in steam mode for 5 minutes.`,
  },
  {
    key: 'warnings',
    labelMsg: msg`Warnings`,
    helpMsg: msg`E.g. water tank low, scale battery low.`,
  },
  {
    key: 'errors',
    labelMsg: msg`Errors`,
    helpMsg: msg`Controller errors and error-level warnings.`,
  },
]).map(e => ({
  ...e,
  get label() {
    return i18n._(e.labelMsg);
  },
  get help() {
    return i18n._(e.helpMsg);
  },
}));

/** @typedef {'stable' | 'nightly'} UpdateChannel */

/**
 * Which events raise a local notification; `enabled` is the master switch.
 * @typedef {object} NotificationSettings
 * @property {boolean} enabled
 * @property {boolean} preheated
 * @property {boolean} shotStarted
 * @property {boolean} shotFinished
 * @property {boolean} steamLeftOn
 * @property {boolean} warnings
 * @property {boolean} errors
 */

/** @typedef {Exclude<keyof NotificationSettings, 'enabled'>} NotificationEventKey */

/**
 * @typedef {object} AppSettings
 * @property {UpdateChannel} updateChannel
 * @property {NotificationSettings} notifications
 */

/** @type {AppSettings} */
const DEFAULTS = {
  // Release channel for web UI updates (see updates.js).
  updateChannel: 'stable',
  notifications: {
    enabled: false,
    preheated: true,
    shotStarted: false,
    shotFinished: true,
    steamLeftOn: true,
    warnings: false,
    errors: true,
  },
};

export const appSettings = /* @__PURE__ */ signal(DEFAULTS);

export async function loadAppSettings() {
  if (!isApp) return;
  // Never return the Preferences plugin from an async function: resolving it calls the proxy's then().
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: STORAGE_KEY });
  try {
    const stored = JSON.parse(value ?? '{}');
    appSettings.value = {
      ...DEFAULTS,
      ...stored,
      notifications: { ...DEFAULTS.notifications, ...stored.notifications },
    };
  } catch {
    appSettings.value = DEFAULTS;
  }
}

/** @param {Partial<NotificationSettings>} changes */
export function updateNotificationSettings(changes) {
  return saveAppSettings({
    ...appSettings.value,
    notifications: { ...appSettings.value.notifications, ...changes },
  });
}

/** @param {UpdateChannel} updateChannel */
export function setUpdateChannel(updateChannel) {
  return saveAppSettings({ ...appSettings.value, updateChannel });
}

/** @param {AppSettings} next */
async function saveAppSettings(next) {
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(next) });
  appSettings.value = next;
}
