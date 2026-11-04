// Local types for the Statistics page. Type-only: use from JSDoc as
// `/** @typedef {import('../types').StatisticsEntry} StatisticsEntry */` (path relative to the file).
import type {
  AnalysisCompareEntry,
  AnalyzerProfile,
  AnalyzerShot,
  LibrarySource,
  ShotAnalysisResult,
} from '../ShotAnalyzer/types';

// ---------------------------------------------------------------------------
// Sources, modes and options

export type StatisticsSource = 'gaggimate' | 'browser';
export type StatisticsSourceSelection = StatisticsSource | 'both';
/** Which timestamp drives date filtering: shot time, upload time, or shot time falling back to upload time. */
export type DateBasisMode = 'auto' | 'shot' | 'upload';
export type StatisticsMode = 'all' | 'profile' | 'shots';
export type StatisticsDetailSection = 'metrics' | 'trends' | 'compare' | 'profile' | 'phase';
export type TrendGranularity = 'day' | 'week' | 'month' | 'year';

/** Context handed to the page by a deep link or by sessionStorage `statsInitialContext`. */
export interface StatisticsInitialContext {
  source?: string;
  shotSource?: string;
  profileSource?: string;
  profileName?: string;
  preferredDetailSection?: string | null;
}

// ---------------------------------------------------------------------------
// Library items (LibraryService lists/loads) as Statistics reads them

/** A shot list item from LibraryService.getAllShots, or a loaded shot (loadShot). */
export interface StatisticsShotMeta extends AnalyzerShot {
  label?: string;
  title?: string;
  profileName?: string;
}

/** A profile list item from LibraryService.getAllProfiles, or a loaded profile. */
export type StatisticsProfileMeta = AnalyzerProfile;

export type PinnedShotsByProfile = Record<string, string[]>;

// ---------------------------------------------------------------------------
// Analyzer output, the subset StatisticsService aggregates

/** Metrics StatisticsService aggregates (a subset of the analyzer's MetricStatKey). */
export type AggregatedMetricKey = 'p' | 'f' | 'pf' | 't' | 'tt' | 'w' | 'pr' | 'lr';

/** Per-metric stats of one shot or phase (structurally a subset of the analyzer's PhaseStats). */
export type MetricStatsMap = {
  [K in AggregatedMetricKey]?: { avg?: number | null; min?: number | null; max?: number | null };
};

/** A target as StatisticsService matches it; `type` may hold legacy names such as 'weight'. */
export interface LooseTarget {
  type: string;
  value: number;
}

// ---------------------------------------------------------------------------
// Analyzed entries and the run that produces them

export interface StatisticsEntryMeta {
  id: string | number;
  selectionKey: string;
  displayName: string;
  timestamp: number;
  profileName: string;
  source: LibrarySource;
}

export interface StatisticsEntry {
  analysis: ShotAnalysisResult;
  shotData: StatisticsShotMeta;
  profileData: AnalyzerProfile | null;
  meta: StatisticsEntryMeta;
}

/** What StatisticsService needs from an entry. */
export type StatisticsServiceEntry = Pick<StatisticsEntry, 'analysis'> & {
  meta: Pick<StatisticsEntryMeta, 'id' | 'timestamp' | 'profileName' | 'source'>;
};

export interface StatisticsRunRequest {
  id: string;
  shots: StatisticsShotMeta[];
  profiles: StatisticsProfileMeta[];
  fallbackProfiles: StatisticsProfileMeta[];
  orderedShotKeys: string[];
  dateBasisMode: DateBasisMode;
  mode: StatisticsMode;
  preferredDetailSection: StatisticsDetailSection | null;
}

export interface StatisticsProgress {
  current: number;
  total: number;
}

/** Entry handed to CompareShotCharts. */
export type StatisticsCompareEntry = AnalysisCompareEntry;

// ---------------------------------------------------------------------------
// StatisticsService output

export interface AggregatedStat {
  count: number;
  avg: number;
  min: number;
  max: number;
  stdDev: number;
}

export type StatisticsMetricKey = AggregatedMetricKey | 'water' | 'duration' | 'ttDelta' | 'pPeak';
export type StatisticsMetrics = { [K in StatisticsMetricKey]?: AggregatedStat };

export interface StatisticsSummary {
  totalShots: number;
  totalDuration: number;
  totalWater: number;
  totalWeight: number;
  avgDuration: number;
  avgWater: number;
  avgWeight: number;
  avgTemp: number;
  avgTempTargetDeviation: number;
  dateRange: { earliest: number | null; latest: number | null };
  sourceBreakdown: { gaggimate: number; browser: number };
}

export interface ProfileGroupStats {
  profileName: string;
  shotCount: number;
  avgDuration: number;
  avgWeight: number;
  avgWater: number;
  metrics: { [K in AggregatedMetricKey]?: AggregatedStat };
}

export type TargetDeltaKey = 'duration' | 'water' | 'p' | 'f' | 't' | 'w';

export interface TargetDelta {
  actual: number;
  target: number;
  delta: number;
}

/** Phase metric stats; the total row's fallback for metrics with no data has no count. */
export type PhaseMetricStat = Omit<AggregatedStat, 'count'> & { count?: number };

export interface PhaseStatsRow {
  phaseName: string;
  shotCount: number;
  avgDuration: number;
  avgWater: number;
  exitReasonDistribution: Record<string, number>;
  metrics: { [K in AggregatedMetricKey]?: PhaseMetricStat };
  targetDeltas?: { [K in TargetDeltaKey]?: TargetDelta };
  isTotal?: boolean;
}

export interface TrendEntry {
  timestamp: number;
  shotId: string | number;
  profileName: string;
  duration: number;
  weight: number;
  water: number;
  avgPressure: number;
  avgFlow: number;
  avgTemp: number;
  avgPuckFlow: number;
}

export type TrendMetricKey =
  | 'duration'
  | 'weight'
  | 'water'
  | 'shotCount'
  | 'avgPressure'
  | 'avgFlow'
  | 'avgTemp'
  | 'avgPuckFlow';

export interface TrendBucketPoint {
  x: number;
  y: number;
  bucketStartMs: number;
  bucketEndMs: number | null;
  shotCount: number;
}

export interface StatisticsResult {
  summary: StatisticsSummary;
  metrics: StatisticsMetrics;
  profileGroups: ProfileGroupStats[];
  phaseStats: PhaseStatsRow[];
  trends: TrendEntry[];
}

// ---------------------------------------------------------------------------
// Search DSL and filtering

export type DateOperator = '>' | '>=' | '<' | '<=' | '=';

export interface StatisticsQueryIssue {
  code: string;
  message: string;
  raw?: string;
}

export interface StatisticsQueryClause {
  /** A supported field name, or '__free' for free text. */
  field: string;
  op: DateOperator | null;
  value: string;
  exact: boolean;
  raw: string;
  /** Set on 'pinned' clauses once the value is parsed. */
  pinnedValue?: boolean;
}

export interface ParsedStatisticsQuery {
  clauses: StatisticsQueryClause[];
  errors: StatisticsQueryIssue[];
  warnings: StatisticsQueryIssue[];
}

export type ShotMetaPredicate = (shotMeta: StatisticsShotMeta) => boolean;

export interface ShotCandidateFilter {
  predicate: ShotMetaPredicate;
  errors: StatisticsQueryIssue[];
  warnings: StatisticsQueryIssue[];
}

export interface ParsedDateInput {
  valueMs: number | null;
  error: string | null;
}

export interface StatisticsFilterState {
  filteredShots: StatisticsShotMeta[];
  /** null when the filter has errors. */
  count: number | null;
  parseErrors: StatisticsQueryIssue[];
  parseWarnings: StatisticsQueryIssue[];
}

export interface DateBasisWarningState {
  showDateBasisWarning: boolean;
  dateBasisWarningMessage: string | null;
  missingShotTimestampCount: number;
  uploadFallbackCount: number;
  noUsableDateCount: number;
}

// ---------------------------------------------------------------------------
// Selection items (StatisticsMultiSelectDropdown)

export interface MultiSelectItem {
  id: string;
  primary?: string;
  secondary?: string;
  searchText?: string;
  isPinned?: boolean;
  pinDisabledReason?: string;
}

export interface ProfileSelectionItem extends MultiSelectItem {
  primary: string;
  searchText: string;
  isPinned: boolean;
  pinDisabledReason: string;
}

export interface ShotSelectionBaseItem {
  id: string;
  primary: string;
  fileStem: string;
  shotId: string;
  secondary: string;
  searchText: string;
}

export interface ShotSelectionItem extends ShotSelectionBaseItem, MultiSelectItem {
  primary: string;
  secondary: string;
  searchText: string;
  shotMeta: StatisticsShotMeta;
  pinBucketKey: string;
  isPinned: boolean;
  pinDisabledReason: string;
}

// ---------------------------------------------------------------------------
// Hooks

/** A useState setter. */
export type SetState<S> = import('preact/hooks').Dispatch<import('preact/hooks').StateUpdater<S>>;
