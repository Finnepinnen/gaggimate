// Local types for the low-level ShotChart helpers (type-only).

import type { Chart, ChartType } from 'chart.js';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/** A chart.js instance; its `$` state props are declared on Chart in ../types.d.ts. */
export type ShotChartInstance<TType extends ChartType = ChartType> = Chart<TType>;

export interface ChartPoint {
  x: number;
  y: number;
}

export interface HoverGuidePluginOptions {
  overflow?: number;
  color?: string;
  lineWidth?: number;
  dash?: number[];
}

export interface FinalWeightCallout {
  visible?: boolean;
  xScaleID?: string;
  yScaleID?: string;
  xValue?: number;
  yValue?: number;
  xAdjust?: number;
  yAdjust?: number;
  edgeInset?: number;
  color?: string;
  lineWidth?: number;
}

export interface FinalWeightCalloutLinePluginOptions {
  callouts?: FinalWeightCallout[];
}

export interface PhaseBackgroundRange {
  visible?: boolean;
  shaded?: boolean;
  startX: number;
  endX: number;
  color?: string;
}

export interface PhaseBackgroundOverlayPluginOptions {
  ranges?: PhaseBackgroundRange[];
  xScaleID?: string;
  color?: string;
}

export interface StopIconOverlayItem {
  visible?: boolean;
  iconDef?: IconDefinition | null;
  xScaleID?: string;
  yScaleID?: string;
  xValue: number;
  yValue: number;
  badgeRadius?: number;
  iconSize?: number;
  color?: string;
  backgroundColor?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export interface StopIconOverlayPluginOptions {
  stops?: StopIconOverlayItem[];
}

export interface FinalWeightBadgeLabel {
  visible?: boolean;
  xScaleID?: string;
  yScaleID?: string;
  xValue?: number;
  yValue?: number;
  xAdjust?: number;
  yAdjust?: number;
  content?: string | string[];
  padding?: number | { x?: number; y?: number };
  font?: { size?: number; weight?: string | number };
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  color?: string;
}

export interface FinalWeightBadgeOverlayPluginOptions {
  labels?: FinalWeightBadgeLabel[];
}

/** A dataset pre-sliced into per-frame point chunks for replay. */
export interface ReplayDatasetMeta {
  fullData: ChartPoint[];
  activeData: ChartPoint[];
  frameChunks: ChartPoint[][];
}

export interface ReplayAnnotationMeta {
  key: string;
  time: number;
  baseDisplay: boolean;
  frameIndex: number;
}

export interface ShotChartReplayModel {
  frameCount: number;
  totalDurationSec: number;
  mainReplayDatasets: ReplayDatasetMeta[];
  tempReplayDatasets: ReplayDatasetMeta[];
  mainAnnotationMeta: ReplayAnnotationMeta[];
  tempAnnotationMeta: ReplayAnnotationMeta[];
}
