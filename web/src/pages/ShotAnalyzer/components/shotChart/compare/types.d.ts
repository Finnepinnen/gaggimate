// Shapes shared by the compare chart modules (type-only).
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ComponentChildren, RefObject } from 'preact';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import type { Chart } from 'chart.js';
import type {
  AnalyzerResults,
  ChartPoint,
  ChartSeriesKey,
  ChartShotData,
  ChartVisibility,
  ChartVisibilityKey,
  HoverWaterValueGetter,
  ShotChartModel,
} from '../model/types';

export type ShotStylePreset = 'analyzer' | 'statistics';
export type CompareStyle = 'linePattern' | 'fade';
export type CompareTooltipMode = 'compare' | 'compareTitleOnly';
export type StaticTooltipVariant =
  'default' | 'singleLine' | 'comparePreview' | 'statisticsCompact';

/** min / avg / max of one metric (services/analyzer/metricStats.js). */
export type AnalyzerMetricStats = {
  start?: number | null;
  end?: number | null;
  min?: number | null;
  max?: number | null;
  avg?: number | null;
};

/** Whole-shot totals from calculateShotMetrics (`results.total`). */
export type AnalyzerTotals = {
  duration?: number;
  water?: number;
  weight?: number;
  p?: AnalyzerMetricStats;
  tp?: AnalyzerMetricStats;
  f?: AnalyzerMetricStats;
  pf?: AnalyzerMetricStats;
  tf?: AnalyzerMetricStats;
  t?: AnalyzerMetricStats;
  tt?: AnalyzerMetricStats;
  w?: AnalyzerMetricStats;
  wf?: AnalyzerMetricStats;
  pr?: AnalyzerMetricStats;
  lr?: AnalyzerMetricStats;
};

export type CompareAnalyzerResults = AnalyzerResults & {
  total?: AnalyzerTotals;
  isBrewByWeight?: boolean;
};

/** One shot in the compare view (shotAnalyzerViewModel.js, Statistics analysis.js). */
export interface CompareEntry {
  key?: string;
  shot: ChartShotData;
  results: CompareAnalyzerResults | null;
  label: string;
  isReference?: boolean;
  accentColor?: string;
  accentStrength?: number;
}

/** A shot chart model shifted to the selected compare alignment. */
export type CompareModel = ShotChartModel & {
  compareAlignmentOffset: number;
  minTime: number;
};

export interface CompareModelEntry<M = CompareModel> {
  entry: CompareEntry;
  model: M;
}

export interface CompareAlignmentOption {
  value: string;
  label: string;
}

export interface AxisRange {
  min: number;
  max: number;
}

export interface CompareShotStyle {
  opacity: number;
  lineWidth: number;
  dash: number[];
  targetDash: number[];
}

export interface CompareLegendItem {
  label: string;
  color: string;
  badgeColor: string;
  lineWidth: number;
  dash: number[];
  shotNumber: number;
}

export interface CompareDatasetMeta {
  compareTooltipShotLabel: string;
  compareTooltipShotOrder: number;
  compareTooltipGetHoverWaterValuesAtX: HoverWaterValueGetter | null;
}

/** Chart.js line dataset options plus the compare tooltip metadata. */
export interface CompareDataset extends CompareDatasetMeta {
  label: string;
  compareTooltipBaseLabel: string | null;
  data: ChartPoint[];
  axisScaleMode?: 'weight' | 'weightFlow';
  borderColor: string;
  backgroundColor: string;
  yAxisID?: string;
  borderWidth: number;
  borderDash: number[];
  tension: number;
  order?: number;
  pointRadius: number;
  pointHoverRadius: number;
  pointHitRadius: number;
  hidden?: boolean;
}

/** Static description of one compare detail chart (compareConstants.js DETAIL_CHARTS). */
export interface DetailChartDef {
  id: string;
  title: string;
  tooltipBaseLabel: string;
  targetTooltipBaseLabel: string | null;
  visibleKey: ChartVisibilityKey;
  targetVisibleKey: ChartVisibilityKey | null;
  seriesKey: ChartSeriesKey;
  targetSeriesKey: ChartSeriesKey | null;
  axisColorKey: keyof import('../model/types').ShotChartColors;
  beginAtZero: boolean;
}

export interface AxisUnitLabel {
  scaleId: string;
  label: string;
  side?: 'left' | 'right';
  yOffset?: number;
}

/** Chart.js config plus the compare-only fields createCompareChartConfig strips. */
export interface CompareChartConfig {
  type: 'line';
  data: { datasets: CompareDataset[] };
  plugins: unknown[];
  options: { plugins?: Record<string, unknown>; [option: string]: unknown };
  phaseTooltipGroups?: ComparePhaseTooltipGroup[];
  showPhaseTooltipNames?: boolean;
  showPhaseTooltipStops?: boolean;
  compareTooltipShowDifference?: boolean;
}

export interface ComparePhaseTooltipGroup {
  rows: import('../model/types').PhaseOverviewRow[];
  shotLabel: string;
  shotNumber: number;
  color: string | null;
}

export type CompareDetailChart = DetailChartDef & { config: CompareChartConfig };

export interface ScrubberRange {
  min: number;
  max: number;
  key?: string;
}

export type CompareChart = Chart;

/** A summary / preview metric row (statistics and mobile compare previews). */
export interface CompareMetricRowDef {
  key: string;
  label: string;
  unit: string;
  color?: string;
  icon?: IconDefinition | null;
  getValue: (total: AnalyzerTotals | undefined) => number | null | undefined;
}
export type CompareMetricRow = CompareMetricRowDef & { value: number | null | undefined };

export interface ComparePreviewEntry {
  entry: CompareEntry;
  rows: CompareMetricRow[];
}

export interface CompareMetricPage {
  key: string;
  previewEntries: ComparePreviewEntry[];
}

export type LegendToggleHandler = (label: string) => void;
export type SetVisibility = Dispatch<StateUpdater<ChartVisibility>>;

/** Props shared by the compare chart cards (CompareChartLayout.jsx). */
export interface CompareChartsBodyProps {
  chartCardClass: string;
  compareEntries: CompareEntry[];
  compareEntriesKey: string;
  compareTooltipMode: CompareTooltipMode;
  detailChartHeight: number;
  detailChartTitleVariant: string;
  detailCharts: CompareDetailChart[];
  detailStaticCompactVariant: StaticTooltipVariant;
  enableHoverInfo: boolean;
  fullDisplayMainChartHeight: number;
  hasScrubberRange: boolean;
  hasWeightData: boolean;
  hasWeightFlowData: boolean;
  hiddenLegendLabels: string[];
  isFullDisplay: boolean;
  isMobileDetailExpanded: boolean;
  legendColorByLabel: Record<string, string>;
  mainChartCardRef: RefObject<HTMLDivElement>;
  mainChartConfig: CompareChartConfig;
  mainChartTitleContent: ComponentChildren;
  mainControls: ComponentChildren;
  mainEmptyStaticTooltipContent: ComponentChildren;
  mainMobileChartControls: ComponentChildren;
  mainMobileShotSwitcher: ComponentChildren;
  mainStaticCompactVariant: StaticTooltipVariant;
  mobileCompareLegend: ComponentChildren;
  detailMetricPageByChartId: Record<string, string>;
  onDetailMetricPageChange: (chartId: string, pageKey: string) => void;
  onLegendToggle: LegendToggleHandler;
  resolvedCompareAlignmentMode: string;
  resolvedMainChartHeight: number;
  scrubberMax: number;
  scrubberMin: number;
  setIsMobileDetailExpanded: Dispatch<StateUpdater<boolean>>;
  shouldCollapseDetailCharts: boolean;
  shouldUseAnalyzerMobileCompareLayout: boolean;
  shouldUseMobileStaticCompareLayout: boolean;
  shouldUseStatisticsMobileCompactLayout: boolean;
  shotStylePreset: ShotStylePreset;
  useStaticTooltip: boolean;
  visibility: ChartVisibility;
}

export type CompareMainChartCardProps = Omit<
  CompareChartsBodyProps,
  | 'detailChartHeight'
  | 'detailChartTitleVariant'
  | 'detailCharts'
  | 'detailStaticCompactVariant'
  | 'isMobileDetailExpanded'
  | 'detailMetricPageByChartId'
  | 'onDetailMetricPageChange'
  | 'setIsMobileDetailExpanded'
  | 'shouldCollapseDetailCharts'
> & { shouldShowDesktopCompareSeriesLegend: boolean };

export type CompareDetailChartCardProps = Pick<
  CompareChartsBodyProps,
  | 'chartCardClass'
  | 'compareEntries'
  | 'compareEntriesKey'
  | 'compareTooltipMode'
  | 'detailChartHeight'
  | 'detailChartTitleVariant'
  | 'detailMetricPageByChartId'
  | 'detailStaticCompactVariant'
  | 'enableHoverInfo'
  | 'hasScrubberRange'
  | 'isFullDisplay'
  | 'legendColorByLabel'
  | 'onDetailMetricPageChange'
  | 'resolvedCompareAlignmentMode'
  | 'scrubberMax'
  | 'scrubberMin'
  | 'shouldUseAnalyzerMobileCompareLayout'
  | 'shouldUseMobileStaticCompareLayout'
  | 'shouldUseStatisticsMobileCompactLayout'
  | 'shotStylePreset'
  | 'useStaticTooltip'
> & { chart: CompareDetailChart };

export interface CompareControlsProps {
  compareAlignmentMode: string;
  compareAlignmentOptions: CompareAlignmentOption[];
  compareAnnotationsEnabled: boolean;
  compareShotLegendItems: CompareLegendItem[];
  compareTargetDisplayMode: string;
  exportMenuRef: RefObject<HTMLDivElement>;
  hasWeightData: boolean;
  hasWeightFlowData: boolean;
  hiddenLegendLabels: string[];
  hideCompareControlsRowOnMobile: boolean;
  isAnalyzerMobileCompareLayout: boolean;
  isFullDisplay: boolean;
  legendColorByLabel: Record<string, string>;
  onCompareAlignmentModeChange: ((mode: string) => void) | null;
  onCompareSwap: (() => void) | null;
  onCompareTargetDisplayModeChange?:
    ((mode: import('../../../utils/constants.js').CompareTargetDisplayMode) => void) | null;
  onFullDisplayToggle: () => void;
  onLegendToggle: LegendToggleHandler;
  shotStylePreset: ShotStylePreset;
  visibility: ChartVisibility;
}

export interface CompareMobileLegendSectionProps {
  hiddenLegendLabels: string[];
  isExpanded: boolean;
  isVisible: boolean;
  hasWeightData: boolean;
  hasWeightFlowData: boolean;
  legendColorByLabel: Record<string, string>;
  onLegendToggle: LegendToggleHandler;
  onToggleExpanded: () => void;
  visibility: ChartVisibility;
}
