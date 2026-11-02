// Local types for the setup wizard.

import type { Settings } from '../../types';

/** GET /api/settings fields the wizard reads that the shared Settings type doesn't list. */
export interface SetupSettings extends Settings {
  /** Running its own access point. */
  apMode?: boolean;
  /** Persisted wizard progress, `custom:` prefixed when machine setup was deferred. */
  setupStep?: string;
  setupDone?: boolean;
  /** false until the controller confirms the applied hardware configuration. */
  machineHardwareReady?: boolean;
}

/** The Wi-Fi network picked in the wizard. `selected` is the SSID or the "other" marker. */
export interface WifiChoice {
  selected: string | null;
  ssid: string;
  secure: boolean;
  password: string;
}

/** One entry of evt:wifi:scan (SetupWizardPlugin::finishScan). */
export interface WifiNetwork {
  ssid: string;
  /** dBm */
  rssi: number;
  secure: boolean;
  channel?: number;
}

/** evt:setup:test (SetupWizardPlugin::publish), or the local placeholder while starting. */
export interface SetupTestStatus {
  test?: 'heater' | 'pressure';
  state: 'running' | 'passed' | 'failed' | 'aborted';
  phase?: string;
  /** Key of REASONS in TestStep. */
  reason?: string;
  // Heater test
  startTemp?: number;
  temp?: number;
  rise?: number;
  targetRise?: number;
  // Pressure test
  pressure?: number;
  maxPressure?: number;
  residualPressure?: number;
}
