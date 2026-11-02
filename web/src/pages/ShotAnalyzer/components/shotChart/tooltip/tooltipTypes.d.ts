// Type-only shapes for the shot-chart tooltip and hover-sync modules.

import type { Chart, ChartDataset, TooltipItem, TooltipModel } from 'chart.js';

/** A shot-chart Chart.js instance; its `$`-props are declared in ../types.d.ts. */
export type ShotChartInstance = Chart<any, any, any>;

export type ShotChartTooltipModel = TooltipModel<'line'>;
export type ShotChartTooltipItem = TooltipItem<'line'>;

export interface HoverWaterValues {
  totalWaterMl: number | null;
  phaseWaterMl: number | null;
  phaseTotalWaterMl: number | null;
}

export type HoverWaterValuesGetter = (xValue: number) => HoverWaterValues;

/** Custom fields compare charts attach to their datasets. */
export type ShotChartTooltipDataset = ChartDataset<'line', unknown[]> & {
  compareTooltipBaseLabel?: string;
  compareTooltipShotOrder?: number;
  compareTooltipGetHoverWaterValuesAtX?: HoverWaterValuesGetter;
};

/** One metric line in the external tooltip. */
export interface TooltipRow {
  label: string;
  displayLabel?: string;
  valueText?: string;
  color?: string;
  spacerBefore?: boolean;
  spacerAfter?: boolean;
  shotLabel?: string;
  /** Zero-based compare shot index. */
  shotOrder?: number;
  numericValue?: number;
  isDifference?: boolean;
  isPlaceholder?: boolean;
}

/** Phase heading / stop info for the hovered x position. */
export interface TooltipPhaseSummary {
  phaseLabel: string;
  skipNotice: string;
  stopReason: string;
  stopValue: string;
  stopTargetValue: string;
  stopType: string;
  shotLabel: string;
  shotNumber: number | null;
  color: string | null;
}

/** A phase row as read for tooltips (subset of the phase overview rows). */
export interface PhaseTooltipRow {
  start?: number;
  end?: number;
  phaseNumber?: number | string;
  phaseName?: string;
  skipNotice?: string;
  stopReason?: string;
  stopValue?: string;
  stopTargetValue?: string;
  stopType?: string;
}

export interface PhaseTooltipGroup {
  rows?: PhaseTooltipRow[];
  shotLabel?: string;
  shotNumber?: number | null;
  color?: string | null;
}

export interface ExternalTooltipState {
  visible: boolean;
  titleLines: string[];
  phaseSummaries: TooltipPhaseSummary[];
  rows: TooltipRow[];
  anchorX: number;
  anchorY: number;
  chartWidth: number;
  chartHeight: number;
  chartAreaLeft: number;
  chartAreaRight: number;
  chartAreaTop: number;
  chartAreaBottom: number;
  /** Clamp bounds; fall back to the chart area when absent. */
  tooltipBoundsLeft?: number | null;
  tooltipBoundsRight?: number | null;
  tooltipBoundsTop?: number | null;
  tooltipBoundsBottom?: number | null;
}

export interface ExternalTooltipLayout {
  visible: boolean;
  x: number;
  y: number;
}

/** Which metric page a compact static tooltip shows. */
export interface TooltipMetricContext {
  label?: string;
  page?: string;
}

/** 'default' | 'comparePreview' | 'singleLine' | 'singlePaged' | 'statisticsCompact' | 'titleOnly' */
export type CompactTooltipVariant = string;
