// Shot Analyzer domain types. Type-only: use from JSDoc as
// `/** @typedef {import('<relative path>/ShotAnalyzer/types').ShotAnalysis} ShotAnalysis */`.

import type {
  PhaseTarget,
  Profile,
  ProfilePhase,
  ShotNotes,
  ShotPhaseTransition,
  ShotSample,
} from '../../types';

// ---------------------------------------------------------------------------
// Library items (LibraryService, IndexedDBService)

/** Where a library item lives; 'temp' items are drag-and-drop imports kept in memory. */
export type LibrarySource = 'gaggimate' | 'browser' | 'temp';
/** Library source filter for list queries. */
export type LibrarySourceFilter = 'both' | 'gaggimate' | 'browser';

/**
 * A shot as the analyzer holds it: a parsed .slog, an uploaded JSON export, or a
 * library list item (index metadata only, `samples` absent or 0).
 */
export interface AnalyzerShot {
  /** Device shot id (unpadded) or the id carried by an uploaded export. */
  id?: string;
  /** Display / storage name (browser shots: the IndexedDB key). */
  name?: string;
  storageKey?: string;
  exportName?: string;
  fileName?: string;
  source?: LibrarySource;
  /** ms epoch (browser uploads) */
  uploadedAt?: number;
  /** Profile label at shot start. */
  profile?: string;
  profileId?: string;
  /** Unix epoch seconds */
  timestamp?: number;
  shotDate?: number;
  /** ms */
  duration?: number;
  samples?: ShotSample[] | 0;
  volume?: number | null;
  rating?: number | null;
  incomplete?: boolean;
  notes?: ShotNotes | null;
  phaseTransitions?: ShotPhaseTransition[];
  /** Predictive brew stop delay in ms. */
  brewDelay?: number;
  finalExitReason?: number;
  finalExitReasonLabel?: string;
  avgTemp?: number | null;
  maxPressure?: number | null;
  avgFlow?: number | null;
  version?: number;
  sampleInterval?: number;
  loaded?: boolean;
  /** Legacy localStorage library wrapper payload. */
  data?: AnalyzerShot | null;
}

/** A profile target after ratio targets were resolved to grams (`ratio` keeps the original multiplier). */
export interface AnalyzerTarget extends PhaseTarget {
  ratio?: number;
}

export interface AnalyzerProfilePhase extends Omit<ProfilePhase, 'targets'> {
  targets?: AnalyzerTarget[];
}

/** A profile as the analyzer holds it: device/browser profile plus library metadata. */
export interface AnalyzerProfile extends Partial<Omit<Profile, 'phases'>> {
  phases?: AnalyzerProfilePhase[];
  name?: string;
  fileName?: string;
  exportName?: string;
  source?: LibrarySource;
  /** Device profile id (req:profiles:load); `id` may be rewritten by list views. */
  profileId?: string;
  storageKey?: string;
  uploadedAt?: number;
  /** Legacy localStorage library wrapper payload. */
  data?: AnalyzerProfile | null;
}

/** Notes as NotesService returns them (defaults merged, `id` always set). */
export interface AnalyzerNotes extends ShotNotes {
  id: string;
}

// ---------------------------------------------------------------------------
// Analysis results (services/analyzer/*)

export interface AnalysisSettings {
  /** Scale latency in ms. */
  scaleDelayMs: number;
  /** System sensor delay in ms. */
  sensorDelayMs: number;
  /** Whether delays were auto-detected. */
  isAutoAdjusted: boolean;
}

/** Time-weighted stats of one metric; all null for skipped phases. Stats shapes are type aliases so they stay assignable to Record<string, unknown>. */
export type MetricStats = {
  start: number | null;
  end: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
};

/** p pressure, tp target pressure, f pump flow, pf puck flow, tf target flow, t temp, tt target temp, w weight, wf weight flow, pr puck resistance, lr liquid resistance. */
export type MetricStatKey = 'p' | 'tp' | 'f' | 'pf' | 'tf' | 't' | 'tt' | 'w' | 'wf' | 'pr' | 'lr';

export type SysStatKey =
  | 'sys_shot_vol'
  | 'sys_curr_vol'
  | 'sys_scale'
  | 'sys_vol_avail'
  | 'sys_ext';

/** First in-phase sample whose system flag differs from the phase's final value. */
export interface SysAnomaly {
  sampleInPhase: number;
  sampleCountInPhase: number;
  value: boolean;
}

export type PhaseStats = Record<MetricStatKey, MetricStats> & {
  sys_raw?: number;
  sys_shot_vol?: boolean;
  sys_curr_vol?: boolean;
  sys_scale?: boolean;
  sys_vol_avail?: boolean;
  sys_ext?: boolean;
  sys_brew_mode?: string;
  sys_recorded_stop_reason?: string;
  /** ms */
  sys_scale_delay?: number;
  sys_anomalies?: Partial<Record<SysStatKey, SysAnomaly>>;
};

export type TotalStats = PhaseStats & {
  /** s */
  duration: number;
  /** ml */
  water: number;
  /** g */
  weight: number;
};

/** Target value at the inferred stop delay, keyed by target type (or 'weight' / 'duration'). */
export type TargetCalcValues = Partial<Record<string, { value: number; isStopReason: boolean }>>;

/** 'volumetric' | 'weight' | 'ratio' | 'pressure' | 'flow' | 'pumped' | 'duration' | 'safety' | 'manual' | 'unknown' */
export type PhaseExitType = string;

export interface PhaseExit {
  /** Recorded ExitReason code, 0 when not recorded. */
  code: number;
  /** Untranslated stop label (e.g. 'Weight Stop', 'Time Limit'). */
  reason: string | null;
  source: 'recorded' | 'inferred' | null;
  type: PhaseExitType | null;
  /** Measured value at the recorded stop (unit by `type`). */
  actualValue?: number | null;
}

export interface AnalyzedPhase {
  /** Executed phases: the sample phaseNumber key (string). Skipped phases: the profile phase index. */
  number: string | number;
  name: string | undefined;
  displayName: string;
  /** s since shot start */
  start: number;
  end: number;
  duration: number;
  /** ml */
  water: number;
  /** g */
  weight: number | undefined;
  stats: PhaseStats;
  exit: PhaseExit;
  profilePhase: AnalyzerProfilePhase | null;
  scaleLost: boolean;
  scalePermanentlyLost: boolean;
  highScaleDelay: boolean;
  estimatedScaleDelayMs: number | null;
  delayReviewHint: boolean;
  delayReviewReason: string | null;
  delayReviewMs: number | null;
  prediction: { finalWeight: number | null };
  targetCalcValues: TargetCalcValues | null;
  isFinalExecuted: boolean;
  /** Profile phase absent from the shot. */
  skipped?: boolean;
}

/** calculateShotMetrics result for a shot with samples. */
export interface ShotAnalysis {
  isBrewByWeight: boolean;
  globalScaleLost: boolean;
  hasSlowSampleInterval: boolean;
  maxSampleIntervalMs: number | null;
  highScaleDelay: boolean;
  highScaleDelayMs: number | null;
  delayReviewHint: boolean;
  delayReviewPhaseNumber: number | null;
  delayReviewMs: number | null;
  delayReviewMessage: string | null;
  isAutoAdjusted: boolean;
  brewModeLabel: string;
  completionLabel: string;
  completionTone: 'warning' | 'default';
  configuredHighScaleDelay: boolean;
  configuredScaleDelayMs: number;
  finalExitReasonCode: number;
  finalExitReasonLabel: string;
  usedSettings: { scaleDelayMs: number; sensorDelayMs: number };
  phases: AnalyzedPhase[];
  total: TotalStats;
  rawSamples: ShotSample[];
  /** ms, `t` of the first sample */
  startTime: number;
  warnings?: undefined;
}

/** calculateShotMetrics result when the shot has no samples. */
export interface EmptyShotAnalysis extends Partial<Omit<ShotAnalysis, 'phases' | 'warnings'>> {
  phases: AnalyzedPhase[];
  warnings: string[];
}

export type ShotAnalysisResult = ShotAnalysis | EmptyShotAnalysis;

// ---------------------------------------------------------------------------
// Analyzer internals (shared across services/analyzer/*)

export interface PumpedWaterSource {
  usesRecordedPumpedWater: boolean;
}

export interface DelayTotals {
  sumScaleDelay: number;
  countScaleHits: number;
  sumSensorDelay: number;
  countSensorHits: number;
}

export interface PhaseDelayState {
  highScaleDelay: boolean;
  estimatedScaleDelayMs: number | null;
  delayReviewHint: boolean;
  delayReviewReason: string | null;
  delayReviewMs: number | null;
}

export interface PhaseDelayTracker {
  state: PhaseDelayState;
  setEstimatedScaleDelay: (delayMs: number | null | undefined) => void;
  setPhaseDelayReviewHint: (delayMs: number | null | undefined, reason?: string) => void;
}

/**
 * A sample whose cp / fl / v the analyzer reads as numbers. A missing field stays
 * undefined at runtime and turns the arithmetic into NaN, which never hits a target
 * and fails the Number.isFinite checks downstream.
 */
export type MeasuredSample = ShotSample & { cp: number; fl: number; v: number };

/** Values compared against targets. */
export interface TargetValues {
  /** undefined when the sample lacks the field */
  pressure: number | undefined;
  flow: number | undefined;
  weight: number | undefined;
  pumped: number;
}

/** Context for evaluating a phase's targets at its anchor sample. */
export interface TargetContext {
  anchor: ShotSample;
  anchorPumped: number;
  flowSlope: number;
  pressureSlope: number;
  weightRate: number;
  isBrewByWeight?: boolean;
  isLastPhase: boolean;
  lastNonExtendedSample: ShotSample;
  phaseSamples?: ShotSample[];
  pumpedWaterSource?: PumpedWaterSource;
  scaleConnectionBrokenPermanently?: boolean;
  /** Manual (non auto-adjusted) delays. */
  normalizedScaleDelayMs?: number;
  normalizedSensorDelayMs?: number;
  /** buildTargetCalcValues only. */
  matchDelayMs?: number;
  observedSample?: ShotSample | null;
}

export interface TargetMatch {
  target: AnalyzerTarget;
  delayMs: number;
  predictedWeight: number | null;
  observedSample: ShotSample | null;
}

/** Samples grouped by `phaseNumber` (keys are stringified numbers). */
export type SamplesByPhase = Record<string, ShotSample[]>;

// ---------------------------------------------------------------------------
// Shot selection / compare (shotAnalyzer/*)

export interface ShotSelectionRequest {
  item: AnalyzerShot;
  name: string;
  /** -1/+1 to auto-advance through `listSnapshot` when loading fails; 0 = no retry. */
  direction: number;
  targetIndex: number;
  debounceMs: number;
  listSnapshot: AnalyzerShot[];
  /** Primary selection only: keep the current compare shot. */
  preserveCompare?: boolean;
  /** Scroll the analyzer/library into view after loading. */
  requestSelectionScroll?: boolean;
  /** Compare selection only: compare load generation. */
  loadId?: number;
}

export interface PendingShotSelection {
  shot: AnalyzerShot;
  name: string;
}

export type ProfileSelectionMode = 'none' | 'auto' | 'manual';

/** A secondary (compare) shot slot. */
export interface CompareShotEntry {
  key: string;
  shot: AnalyzerShot;
  shotName: string;
  profile: AnalyzerProfile | null;
  profileName: string;
  profileSelectionMode: ProfileSelectionMode;
}

export interface CompareResultEntry {
  key: string;
  results: ShotAnalysisResult | null;
}

/** A shot plus its analysis, as passed to chart, details and table in compare/single views. */
export interface AnalysisCompareEntry {
  key: string;
  shot: AnalyzerShot;
  shotName: string;
  label: string;
  profile: AnalyzerProfile | null;
  profileName: string;
  results: ShotAnalysisResult | null;
  isReference: boolean;
  accentColor?: string;
  accentStrength?: number;
}
