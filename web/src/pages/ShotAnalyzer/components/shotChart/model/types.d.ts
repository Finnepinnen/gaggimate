// Shapes shared by the ShotChart model builders (single and compare charts).
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Chart } from 'chart.js';
import type {
  PhaseTarget,
  ProfilePhase,
  ShotPhaseTransition,
  ShotSample,
} from '../../../../../types';
import type { CHART_COLOR_FALLBACKS, INITIAL_VISIBILITY } from '../constants.js';
import type { buildShotChartModel } from './buildShotChartModel.js';

/** Shot sample plus legacy / imported key aliases the chart still reads. */
export type ChartSample = ShotSample & {
  f?: number;
  flow?: number;
  p?: number;
  pressure?: number;
  puck_flow?: number;
  temperature?: number;
  w?: number;
  weight?: number;
  m?: number;
  weight_flow?: number;
  target_pressure?: number;
  target_flow?: number;
  tr?: number;
  target_temperature?: number;
};

/** Profile phase as embedded in imported / legacy shot data. */
export interface ChartShotProfilePhase {
  name: string;
  displayName?: string;
}

/** The subset of a shot (history, library or imported) the chart model reads. */
export interface ChartShotData {
  id?: string | number;
  storageKey?: string;
  samples?: ChartSample[] | 0;
  phaseTransitions?: ShotPhaseTransition[];
  /** ms */
  sampleInterval?: number;
  /** A label for device shots; some imports embed the profile object. */
  profile?: string | { phases?: ChartShotProfilePhase[] };
}

export interface AnalyzerPhaseExit {
  code?: number;
  reason?: string | null;
  source?: string | null;
  type?: string | null;
  actualValue?: number | string | null;
}

/** One phase of the analyzer results (services/analyzer/phaseAnalysis.js, skippedPhases.js). */
export interface AnalyzerPhase {
  /** Phase key; may be the string key from sample grouping. */
  number?: number | string;
  name?: string;
  displayName?: string;
  /** Seconds relative to shot start. */
  start?: number;
  end?: number;
  duration?: number;
  water?: number;
  weight?: number;
  stats?: { p?: { end?: number | null }; f?: { end?: number | null } };
  exit?: AnalyzerPhaseExit;
  profilePhase?: (Partial<ProfilePhase> & { targets?: PhaseTarget[] }) | null;
  prediction?: { finalWeight?: number | null };
  targetCalcValues?: Record<string, { value?: number; isStopReason?: boolean } | undefined>;
  isFinalExecuted?: boolean;
  skipped?: boolean;
}

/** Analyzer results (calculateShotMetrics) as read by the chart. */
export interface AnalyzerResults {
  phases?: AnalyzerPhase[];
}

export type ChartVisibility = { [K in keyof typeof INITIAL_VISIBILITY]: boolean };
export type ChartVisibilityKey = keyof ChartVisibility;

/** Resolved CSS colors keyed by CHART_COLOR_FALLBACKS keys. */
export type ShotChartColors = Record<keyof typeof CHART_COLOR_FALLBACKS, string>;

export interface BrewModeMeta {
  label?: string | null;
  iconDef?: IconDefinition | null;
}

export interface ChartPoint {
  x: number;
  y: number;
}

export type ChartSeriesMap = {
  pressure: ChartPoint[];
  flow: ChartPoint[];
  puckFlow: ChartPoint[];
  puckResistance: ChartPoint[];
  liquidResistance: ChartPoint[];
  temp: ChartPoint[];
  weight: ChartPoint[];
  weightFlow: ChartPoint[];
  targetPressure: ChartPoint[];
  targetFlow: ChartPoint[];
  targetTemp: ChartPoint[];
};
export type ChartSeriesKey = keyof ChartSeriesMap;

/** Context passed to scriptable annotation options. */
export interface AnnotationScriptContext {
  chart?: Chart;
}
export type ScriptableAnnotationValue = number | ((context: AnnotationScriptContext) => unknown);

export interface PhaseAnnotationLabel {
  display?: boolean;
  content?: string | string[];
  position?: string;
  xAdjust?: number;
  yAdjust?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  font?: { size?: number; weight?: string };
}

/** chartjs-plugin-annotation line / label options built for phases and stops. */
export interface PhaseAnnotation {
  type: 'line' | 'label';
  scaleID?: string;
  xScaleID?: string;
  yScaleID?: string;
  value?: number;
  xValue?: number;
  yValue?: number;
  xMin?: ScriptableAnnotationValue;
  xMax?: ScriptableAnnotationValue;
  yMin?: ScriptableAnnotationValue;
  yMax?: ScriptableAnnotationValue;
  display?: boolean;
  content?: string[];
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  font?: { size?: number; weight?: string };
  padding?: { x: number; y: number };
  callout?: {
    display?: boolean;
    position?: string;
    side?: number;
    start?: string;
    margin?: number;
    borderColor?: string;
    borderWidth?: number;
  };
  label?: PhaseAnnotationLabel;
  xAdjust?: number;
  yAdjust?: number;
  [key: string]: unknown;
}
export type PhaseAnnotationMap = Record<string, PhaseAnnotation>;

export interface PhaseLabelOverlay {
  key: string;
  label: string;
  xValue: number;
  usePhaseNumbers: boolean;
  display: boolean;
}

export interface PhaseBackgroundRange {
  startX: number;
  endX: number;
  visible: boolean;
  shaded: boolean;
}

export interface StopIconOverlay {
  visible: boolean;
  iconDef: IconDefinition;
  xValue: number;
  yValue: number;
  xScaleID: string;
  yScaleID: string;
  xOffset: number;
  yOffset: number;
  color: string;
}

export interface PhaseOverviewRow {
  /** One-based. */
  phaseNumber: number;
  phaseName: string;
  skipNotice?: string | null;
  stopReason: string;
  stopValue: string;
  stopTargetValue: string | null;
  stopType?: string | null;
  start?: number;
  end?: number;
  skipped?: boolean;
}

/** Cached absolute phase window for hover water lookups. */
export interface PhaseHoverRange {
  label: string | null;
  startAbs: number;
  endAbs: number;
  phaseTotalWaterMl: number | null;
  startCumWater: number;
}

export interface HoverWaterValues {
  totalWaterMl: number | null;
  phaseWaterMl: number | null;
  phaseTotalWaterMl: number | null;
}
export type HoverWaterValueGetter = (xValue: number) => HoverWaterValues;

/** Resolves a raw phase number (and optional name) to a zero-based profile phase index. */
export type PhaseNumberResolver = (
  rawPhaseNumber: unknown,
  fallbackIndex?: number,
  phaseName?: string | null,
) => number;

export type ShotChartModel = ReturnType<typeof buildShotChartModel>;
