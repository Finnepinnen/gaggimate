// Shared domain types for the web UI. Type-only: use from JSDoc as
// `/** @typedef {import('../types').Profile} Profile */` (path relative to the file).
// Sources: schema/profile.json, schema/shot_history.json, schema/shot_notes.json,
// docs/websocket-api.yaml and WebUIPlugin.cpp on the firmware.

export type {
  Capabilities,
  HistoryEntry,
  MachineState,
  MachineStatus,
  ProcessProgress,
  ScaleState,
  SocketMessage,
  StatusFrame,
  SystemStatus,
  WarningState,
  WarningStateFrame,
} from './services/machineTypes.js';

// ---------------------------------------------------------------------------
// Profiles (schema/profile.json)

export type ProfileType = 'standard' | 'pro';
export type PhaseType = 'preinfusion' | 'brew';
export type TransitionType = 'instant' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type TargetType = 'volumetric' | 'ratio' | 'pressure' | 'flow' | 'pumped';
export type TargetOperator = 'gte' | 'lte';

/** How the pump setpoint ramps into a phase. */
export interface PhaseTransition {
  type: TransitionType;
  /** Ramp length in seconds; 0 = instant. */
  duration: number;
  /** Start the ramp from the measured value instead of the previous setpoint. */
  adaptive: boolean;
}

/** Closed-loop pump control; the field not named by `target` is a soft limit (0 = no limit, -1 = hold measured). */
export interface PumpAdvanced {
  target: 'pressure' | 'flow';
  /** bar */
  pressure: number;
  /** g/s */
  flow: number;
}

/** Simple duty cycle 0..100 (utility profiles) or an advanced pressure/flow command. */
export type PumpSettings = number | PumpAdvanced;

/** A phase stop condition. Units by type: g, multiplier of dose, bar, ml/s, ml. */
export interface PhaseTarget {
  type: TargetType;
  /** Defaults to 'gte'. */
  operator?: TargetOperator;
  value: number;
}

export interface ProfilePhase {
  name: string;
  phase: PhaseType;
  /** 0 closed, 1 open. */
  valve: 0 | 1;
  /** Seconds (hard cap). */
  duration: number;
  /** °C; 0 = use the profile temperature. */
  temperature?: number;
  transition?: PhaseTransition;
  pump: PumpSettings;
  /** OR-combined; omitted or empty = run the full duration. */
  targets?: PhaseTarget[];
}

export interface Profile {
  /** Firmware-managed; absent on new/imported profiles. */
  id?: string;
  label: string;
  type: ProfileType;
  description: string;
  /** °C */
  temperature?: number;
  /** grams, used by 'ratio' targets */
  dose?: number;
  /** Overwritten by the device on load. */
  favorite?: boolean;
  /** Overwritten by the device on load. */
  selected?: boolean;
  /** Utility (non-espresso) routine such as backflush. */
  utility?: boolean;
  phases: ProfilePhase[];
  /** `_`-prefixed user annotations are preserved on disk. */
  [annotation: `_${string}`]: unknown;
}

// ---------------------------------------------------------------------------
// Shot history (schema/shot_history.json, pages/ShotHistory/parseBinary*.js)

/** 0 unknown, 1 volumetric, 2 pressure, 3 flow, 4 pumped, 5 duration, 6 safety timeout, 7 aborted, 8 hold released, 9 ratio. */
export type ExitReason = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Phase start recorded in the shot log header (v5+). */
export interface ShotPhaseTransition {
  /** Index of the first sample of this phase. */
  sampleIndex: number;
  /** Zero-based profile phase index. */
  phaseNumber: number;
  phaseName: string;
  /** Why the previous phase ended. */
  transitionReason?: ExitReason;
  transitionReasonLabel?: string;
}

/** Decoded per-sample system flags (shot log v2+). */
export interface ShotSystemInfo {
  raw: number;
  shotStartedVolumetric?: boolean;
  currentlyVolumetric?: boolean;
  bluetoothScaleConnected?: boolean;
  volumetricAvailable?: boolean;
  /** Recorded after the pump stopped, while the weight settles. */
  extendedRecording?: boolean;
  processIsBrew?: boolean;
  targetIsVolumetric?: boolean;
  phaseHasVolumetric?: boolean;
  /** Any scale (BLE or hardware) connected. */
  activeScaleConnected?: boolean;
}

/** One decoded shot log sample. Fields present depend on the log's fieldsMask. */
export interface ShotSample {
  /** ms since shot start */
  t: number;
  /** target temperature °C */
  tt?: number;
  /** current temperature °C */
  ct?: number;
  /** target / limit pressure bar */
  tp?: number;
  /** current pressure bar */
  cp?: number;
  /** pump flow ml/s */
  fl?: number;
  /** target / limit pump flow ml/s */
  tf?: number;
  /** puck flow ml/s */
  pf?: number;
  /** scale weight flow g/s */
  vf?: number;
  /** measured weight g */
  v?: number;
  /** estimated weight g */
  ev?: number;
  /** puck resistance */
  pr?: number;
  /** cumulative water pumped ml */
  wp?: number;
  systemInfo?: ShotSystemInfo;
  /** v5+: zero-based phase index */
  phaseNumber?: number;
  /** v5+: one-based phase number */
  phaseDisplayNumber?: number;
  /** v5+: phase name from the header transitions */
  phaseName?: string;
}

/** User notes for a shot (/h/<id>.json, req:history:notes:get/save). Numeric fields hold raw form strings. */
export interface ShotNotes {
  id?: string;
  /** 0 = unrated */
  rating?: number;
  beanType?: string;
  doseIn?: string;
  doseOut?: string;
  ratio?: string;
  grindSetting?: string;
  balanceTaste?: 'bitter' | 'balanced' | 'sour';
  notes?: string;
}

/** One entry of the binary shot index (/api/history/index.bin). */
export interface ShotIndexEntry {
  id: number;
  /** Unix epoch seconds */
  timestamp: number;
  /** ms */
  duration: number;
  /** g; null when not recorded */
  volume: number | null;
  rating: number;
  flags: number;
  profileId: string;
  profileName: string;
  avgTemp: number | null;
  maxPressure: number | null;
  avgFlow: number | null;
  completed: boolean;
  deleted: boolean;
  hasNotes: boolean;
  incomplete: boolean;
}

/** A parsed .slog file (parseBinaryShot). */
export interface ShotLog {
  /** Shot id without zero padding. */
  id: string;
  /** Shot log format version. */
  version: number;
  /** Profile label at shot start. */
  profile: string;
  profileId: string;
  /** Unix epoch seconds */
  timestamp: number;
  /** ms */
  duration: number;
  samples: ShotSample[];
  /** g; null when unknown */
  volume: number | null;
  incomplete: boolean;
  /** ms */
  sampleInterval: number;
  fieldsMask: number;
  /** Bytes after the last complete sample (non-zero = truncated). */
  trailingBytes: number;
  /** Sample count from the header; 0 if not finalized. */
  samplesExpected: number;
  phaseTransitions: ShotPhaseTransition[];
  finalExitReason?: ExitReason;
  finalExitReasonLabel?: string;
  /** Predictive brew stop delay in ms. */
  brewDelay?: number;
}

/**
 * A shot as the history UI holds it: index metadata, plus the parsed log once
 * `loaded`. Before loading, `samples` is 0 (count unknown).
 */
export interface Shot extends Omit<Partial<ShotLog>, 'samples'> {
  id: string;
  profile: string;
  profileId: string;
  timestamp: number;
  duration: number;
  volume: number | null;
  samples: ShotSample[] | 0;
  /** null when unrated */
  rating: number | null;
  incomplete: boolean;
  avgTemp?: number | null;
  maxPressure?: number | null;
  avgFlow?: number | null;
  notes: ShotNotes | null;
  loaded: boolean;
  data: null;
}

/** JSON export of one shot (schema/shot_history.json). Exporters may add fields. */
export interface ShotExport extends ShotLog {
  rating?: number | null;
  avgTemp?: number | null;
  maxPressure?: number | null;
  avgFlow?: number | null;
  notes?: ShotNotes | null;
  loaded?: boolean;
  data?: null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Settings (GET/POST /api/settings, WebUIPlugin::handleSettings)

/** GET /api/settings response. Durations are seconds unless noted. */
export interface Settings {
  startupMode: 'brew' | 'standby';
  startupProfile: string;
  targetSteamTemp: number;
  targetWaterTemp: number;
  homekit: boolean;
  homeAssistant: boolean;
  haUser: string;
  haPassword: string;
  haIP: string;
  haPort: number;
  haTopic: string;
  heaterCoordinationEnabled: boolean;
  heaterHandoverMs: number;
  /** "p,i,d[,kf]" */
  pid: string;
  /** Comma-separated pump model coefficients. */
  pumpModelCoeffs: string;
  pumpSlipCoeffs: string;
  wifiSsid: string;
  /** "---unchanged---" in AP mode. */
  wifiPassword: string;
  apPassword: string;
  mdnsName: string;
  /** Numbers serialized as strings by the firmware. */
  temperatureOffset: string;
  pressureOffset: string;
  pressureScaling: string;
  scaleFactor1: number;
  scaleFactor2: number;
  hardwareScaleSampleRateSps: number;
  hardwareScaleIdleAlpha: number;
  hardwareScaleActiveAlpha: number;
  preferredScaleSource: string;
  boilerFillActive: boolean;
  startupFillTime: number;
  steamFillTime: number;
  smartGrindActive: boolean;
  smartGrindIp: string;
  smartGrindMode: number;
  mahlkonigActive: boolean;
  mahlkonigRecipeProfiles: string;
  /** Read-only, for display. */
  deviceIp: string;
  momentaryButtons: boolean;
  /** 0 = as long as the button is held */
  flushDuration: number;
  warnWaterLevel: number;
  warnFlush: number;
  warnSteamSwitch: number;
  warnScaleConnected: number;
  warnScaleBattery: number;
  warnTemperature: number;
  warnBackflush: number;
  warnDescaling: number;
  /** 0 = off */
  backflushIntervalDays: number;
  backflushIntervalShots: number;
  descalingIntervalWeeks: number;
  descalingIntervalShots: number;
  /** Epoch seconds, 0 = never. */
  lastBackflushTime: number;
  lastDescalingTime: number;
  shotsSinceBackflush: number;
  shotsSinceDescaling: number;
  /** ms */
  brewDelay: number;
  /** ms */
  grindDelay: number;
  delayAdjust: boolean;
  timezone: string;
  clock24hFormat: boolean;
  standbyTimeout: number;
  mainBrightness: number;
  standbyBrightness: number;
  standbyBrightnessTimeout: number;
  steamPumpPercentage: number;
  steamPumpCutoff: number;
  themeMode: number;
  statusDisplayMode: number;
  /** Sunrise LED colors as strings. */
  sunriseIdle: string;
  sunriseActive: string;
  sunriseFinished: string;
  sunriseError: string;
  sunriseExtBrightness: number;
  emptyTankDistance: number;
  fullTankDistance: number;
  altRelayFunction: number;
  autowakeupEnabled: boolean;
  /** "HH:MM|1111100;..." (time, then one flag per weekday). */
  autowakeupSchedules: string;
  /** Comma-separated button behaviors. */
  buttonBehavior: string;
  commutationGain: number;
  convergenceGain: number;
  integralGain: number;
  maxPumpPower: number;
  savedScale: string;
  savedScaleName: string;
}

// ---------------------------------------------------------------------------
// Socket payloads (docs/websocket-api.yaml)

/** res:ota-settings */
export interface OtaSettings {
  latestVersion?: string;
  displayVersion?: string;
  controllerVersion?: string;
  hardware?: string;
  displayUpdateAvailable?: boolean;
  controllerUpdateAvailable?: boolean;
  channel?: string;
  updating?: boolean;
}

/** evt:ota-progress. phase: 0 idle, 1 display fw, 2 display fs, 3 controller fw, 4 finished, 5 failed. */
export interface OtaProgress {
  phase: 0 | 1 | 2 | 3 | 4 | 5;
  /** Percent of the current phase. */
  progress: number;
}
