// Local types shared by the single-shot chart modules (type-only).

import type {
  AnalyzerPhase,
  AnalyzerResults,
  ChartShotData,
  ChartShotProfilePhase,
  ChartVisibility,
} from './model/types';

/** A shot as the analyzer hands it to the chart: the model's shot shape plus library metadata. */
export type ShotChartShotData = Omit<ChartShotData, 'profile'> & {
  /** A label for device shots; some imports embed the profile object. */
  profile?: string | { phases?: ChartShotProfilePhase[]; label?: string; name?: string };
  /** 'gaggimate' | 'browser' | 'temp' */
  source?: string;
  name?: string;
};

/** One analyzed phase from calculateShotMetrics. */
export type ShotChartAnalysisPhase = AnalyzerPhase;

/** calculateShotMetrics result as the chart consumes it. */
export type ShotChartAnalysisResults = AnalyzerResults & {
  id?: string;
  name?: string;
  isBrewByWeight?: boolean;
  brewModeLabel?: string;
  total?: import('../../types').TotalStats;
};

/** Series/overlay visibility toggles (keys of INITIAL_VISIBILITY). */
export type ShotChartVisibility = ChartVisibility;

// Ad-hoc state the shot charts stash on Chart.js instances (hover sync, fixed tooltips, replay reveal).
declare module 'chart.js' {
  interface Chart<TType, TData, TLabel> {
    /** Client Y of the pointer that produced the current external tooltip. */
    $externalTooltipClientY?: number | null;
    /** What drove the current external tooltip (e.g. 'scrubber'). */
    $externalTooltipSource?: string | null;
    $fixedTooltipPointerX?: number | null;
    $fixedTooltipPointerY?: number | null;
    $fixedTooltipXValue?: number | null;
    $shotChartHoverSyncActive?: boolean;
    $suppressHoverGuide?: boolean;
    $replayRevealEnabled?: boolean;
    $replayRevealX?: number | null;
    $replayRevealClipActive?: boolean;
    $replayStopRevealEnabled?: boolean;
    $replayStopRevealX?: number | null;
    $compareTitleOnlyDatasetIndex?: number;
    $compareTooltipShowDifference?: boolean;
  }
}
