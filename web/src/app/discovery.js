import { signal } from '@preact/signals';

// Native mDNS browser for _gaggimate._tcp (ios/App/App/MachineDiscoveryPlugin.swift, android MachineDiscoveryPlugin.java).
/**
 * A machine announced over mDNS.
 * @typedef {object} DiscoveredMachine
 * @property {string} name mDNS service name.
 * @property {string} host "host[:port]"
 * @property {string} version Firmware version from the TXT record; "" when not announced.
 */

/** @typedef {import('@capacitor/core').PluginListenerHandle} PluginListenerHandle */

/**
 * @typedef {object} MachineDiscoveryPlugin
 * @property {{
 *   (event: 'machineFound', listener: (machine: DiscoveredMachine) => void): Promise<PluginListenerHandle>,
 *   (event: 'machineLost', listener: (machine: { name: string }) => void): Promise<PluginListenerHandle>,
 * }} addListener
 * @property {() => Promise<void>} start
 * @property {() => Promise<void>} stop
 */

/** @type {MachineDiscoveryPlugin | null} */
let MachineDiscovery = null;

// Loads @capacitor/core lazily so the firmware bundle never includes it; never return the plugin proxy from here.
async function loadPlugin() {
  if (MachineDiscovery) return;
  const { registerPlugin } = await import('@capacitor/core');
  MachineDiscovery = registerPlugin('MachineDiscovery');
}

// Machines currently visible on the network: [{ name, host, version }].
export const discoveredMachines = /* @__PURE__ */ signal(/** @type {DiscoveredMachine[]} */ ([]));
// False when the platform has no native browser (e.g. the app build running in a desktop browser).
export const discoveryAvailable = /* @__PURE__ */ signal(true);

/** @type {PluginListenerHandle[]} */
let listeners = [];

export async function startDiscovery() {
  await loadPlugin();
  await stopDiscovery();
  const plugin = /** @type {MachineDiscoveryPlugin} */ (MachineDiscovery);
  discoveredMachines.value = [];
  try {
    listeners = await Promise.all([
      plugin.addListener('machineFound', machine => {
        discoveredMachines.value = [
          ...discoveredMachines.value.filter(m => m.name !== machine.name),
          machine,
        ];
      }),
      plugin.addListener('machineLost', ({ name }) => {
        discoveredMachines.value = discoveredMachines.value.filter(m => m.name !== name);
      }),
    ]);
    await plugin.start();
  } catch {
    discoveryAvailable.value = false;
  }
}

export async function stopDiscovery() {
  if (!MachineDiscovery) return;
  await Promise.all(listeners.map(listener => listener.remove()));
  listeners = [];
  try {
    await MachineDiscovery.stop();
  } catch {
    // Not running or unavailable on this platform.
  }
}
