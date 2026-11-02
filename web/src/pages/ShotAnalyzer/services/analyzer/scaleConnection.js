/** Tracks the active scale, falling back to Bluetooth for legacy upstream histories.
 * The exported name and returned state key are retained for existing callers.
 */

/** @typedef {import('../../../../types').ShotSystemInfo} ShotSystemInfo */
/** @typedef {{ systemInfo?: Pick<ShotSystemInfo, 'activeScaleConnected' | 'bluetoothScaleConnected'> }} ScaleFlagSample */

/** @param {boolean | number | undefined} value */
function isBluetoothScaleConnected(value) {
  return value === true || value === 1;
}

/** @param {boolean | number | undefined} value */
function isBluetoothScaleDisconnected(value) {
  return value === false || value === 0;
}

/**
 * @param {ScaleFlagSample[]} samples
 * @param {boolean} [bluetoothScaleWasConnected]
 * @returns {{ bluetoothScaleWasConnected: boolean, scaleLost: boolean }}
 */
export function getBluetoothScaleConnectionState(samples, bluetoothScaleWasConnected = false) {
  let wasConnected = bluetoothScaleWasConnected;
  let scaleLost = false;

  for (const sample of samples) {
    const connection =
      sample?.systemInfo?.activeScaleConnected ?? sample?.systemInfo?.bluetoothScaleConnected;
    if (isBluetoothScaleConnected(connection)) {
      wasConnected = true;
    } else if (wasConnected && isBluetoothScaleDisconnected(connection)) {
      scaleLost = true;
    }
  }

  return { bluetoothScaleWasConnected: wasConnected, scaleLost };
}
