import { effect } from '@preact/signals';
import { WARNINGS } from '../utils/warnings.js';
import { appSettings } from './appSettings.js';
import { resumeConnections, suspendConnections } from './machineConnections.js';
import { checkForUpdate } from './updates.js';
import { machines } from './machines.js';
import { nativePlatform } from './platform.js';

/**
 * Android-only native monitor (MachineMonitorService) that watches machines while the app is backgrounded.
 * @typedef {object} BackgroundMonitorPlugin
 * @property {(options: {
 *   enabled: boolean,
 *   machines: { name: string, host: string }[],
 *   events: Omit<import('./appSettings.js').NotificationSettings, 'enabled'>,
 *   warningLabels: Record<string, string>,
 * }) => Promise<void>} configure
 */

/** @type {BackgroundMonitorPlugin | null} */
let BackgroundMonitor = null;

// Loads the plugin lazily; never return the plugin proxy from an async function.
async function loadBackgroundMonitor() {
  if (BackgroundMonitor) return;
  const { registerPlugin } = await import('@capacitor/core');
  BackgroundMonitor = registerPlugin('BackgroundMonitor');
}

// Frees all machine sockets in the background; on Android MachineMonitorService takes over meanwhile.
/**
 * @param {import('../services/ApiService.js').default} apiService
 * @param {import('./notifications.js').NotificationService} notificationService
 */
export async function watchAppLifecycle(apiService, notificationService) {
  const { App } = await import('@capacitor/app');
  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      apiService.reopen();
      resumeConnections();
      notificationService.resume();
      checkForUpdate();
    } else {
      notificationService.suspend();
      suspendConnections();
      apiService.close();
    }
  });

  if (nativePlatform() !== 'android') return;
  await loadBackgroundMonitor();
  const warningLabels = Object.fromEntries(
    WARNINGS.map((/** @type {{ key: string, label: string }} */ w) => [w.key, w.label]),
  );
  effect(() => {
    const { enabled, ...events } = appSettings.value.notifications;
    BackgroundMonitor.configure({
      enabled: enabled && machines.value.length > 0,
      machines: machines.value.map(({ name, host }) => ({ name, host })),
      events,
      warningLabels,
    });
  });
}
