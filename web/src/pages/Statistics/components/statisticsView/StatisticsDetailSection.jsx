// Sub-components for the Statistics view detail section: header bar and panel body with metrics, profile groups, phase stats, trend chart, and compare
import { useLingui } from '@lingui/react/macro';
import { STATISTICS_PANEL_CLASS } from './constants';
import { StatisticsShotCompareSection } from '../StatisticsShotCompareSection';
import { MetricsTable } from '../MetricsTable';
import { ProfileGroupTable } from '../ProfileGroupTable';
import { PhaseStatistics } from '../PhaseStatistics';
import { TrendChart } from '../TrendChart';
import { ActivityHeatmap } from '../ActivityHeatmap';

/**
 * @typedef {import('../../types').StatisticsDetailSection} StatisticsDetailSection
 * @typedef {import('../../types').StatisticsResult} StatisticsResult
 * @typedef {import('../../types').StatisticsCompareEntry} StatisticsCompareEntry
 * @typedef {import('../../../ShotAnalyzer/utils/constants').CompareTargetDisplayMode} CompareTargetDisplayMode
 * @typedef {{
 *   hasMetricStatistics: boolean,
 *   hasTrendStatistics: boolean,
 *   hasPhaseStatistics: boolean,
 *   hasProfileGroupStatistics: boolean,
 *   resolvedStatisticsDetailSection: StatisticsDetailSection,
 *   setStatisticsDetailSection: (section: StatisticsDetailSection) => void,
 * }} DetailSectionState
 */

const STATISTICS_SECTION_TITLE_CLASS = 'text-xs font-semibold uppercase tracking-widest opacity-90';

/** @param {DetailSectionState & { hasCompareStatistics: boolean }} props */
function StatisticsDetailHeader({
  hasCompareStatistics,
  hasMetricStatistics,
  hasTrendStatistics,
  hasPhaseStatistics,
  hasProfileGroupStatistics,
  resolvedStatisticsDetailSection,
  setStatisticsDetailSection,
}) {
  const { t } = useLingui();
  const availableTabs = /** @type {{ id: StatisticsDetailSection, label: string }[]} */ (
    [
      hasMetricStatistics ? { id: 'metrics', label: t`Global metric averages` } : null,
      hasTrendStatistics ? { id: 'trends', label: t`Trends` } : null,
      hasCompareStatistics ? { id: 'compare', label: t`Shot Charts` } : null,
      hasProfileGroupStatistics ? { id: 'profile', label: t`Per-profile statistics` } : null,
      hasPhaseStatistics ? { id: 'phase', label: t`Per-phase statistics` } : null,
    ].filter(Boolean)
  );

  if (availableTabs.length > 1) {
    return (
      <div role='tablist' className='tabs tabs-border'>
        {availableTabs.map(tab => (
          <button
            key={tab.id}
            type='button'
            role='tab'
            className={`tab ${resolvedStatisticsDetailSection === tab.id ? 'tab-active' : ''}`}
            aria-selected={resolvedStatisticsDetailSection === tab.id}
            onClick={() => setStatisticsDetailSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  const title = availableTabs[0]?.label || t`Statistics`;
  return <h3 className={STATISTICS_SECTION_TITLE_CLASS}>{title}</h3>;
}

/**
 * @param {DetailSectionState & {
 *   compareEntries: StatisticsCompareEntry[],
 *   compareTargetDisplayMode: CompareTargetDisplayMode,
 *   onCompareTargetDisplayModeChange: (mode: CompareTargetDisplayMode) => void,
 *   result: StatisticsResult | null,
 *   hidePhaseExitReasons?: boolean,
 *   chartRunKey?: string,
 * }} props
 */
export function StatisticsDetailSectionPanel({
  compareEntries,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
  hasMetricStatistics,
  hasTrendStatistics,
  hasPhaseStatistics,
  hasProfileGroupStatistics,
  resolvedStatisticsDetailSection,
  result,
  setStatisticsDetailSection,
  hidePhaseExitReasons = false,
  chartRunKey = 'idle',
}) {
  const hasCompareStatistics = Array.isArray(compareEntries) && compareEntries.length > 0;

  if (
    !hasCompareStatistics &&
    !hasMetricStatistics &&
    !hasTrendStatistics &&
    !hasProfileGroupStatistics &&
    !hasPhaseStatistics
  ) {
    return null;
  }

  // Every has*Statistics flag except compare is derived from a non-null result.
  const stats = /** @type {StatisticsResult} */ (result);

  const shouldUsePanelSurface =
    resolvedStatisticsDetailSection !== 'metrics' &&
    resolvedStatisticsDetailSection !== 'compare' &&
    resolvedStatisticsDetailSection !== 'phase';
  const shouldUseCompactChartPadding = resolvedStatisticsDetailSection === 'trends';

  const sectionContent = (
    <>
      {hasCompareStatistics && resolvedStatisticsDetailSection === 'compare' && (
        <StatisticsShotCompareSection
          key={`statistics-shot-charts-${chartRunKey}`}
          compareEntries={compareEntries}
          compareTargetDisplayMode={compareTargetDisplayMode}
          onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
          showTitle={false}
          embedded={true}
        />
      )}

      {hasMetricStatistics && resolvedStatisticsDetailSection === 'metrics' && (
        <MetricsTable metrics={stats.metrics} />
      )}

      {hasTrendStatistics && resolvedStatisticsDetailSection === 'trends' && (
        <div className='space-y-4'>
          <TrendChart key={`statistics-trends-${chartRunKey}`} trends={stats.trends} />
          <ActivityHeatmap trends={stats.trends} />
        </div>
      )}

      {hasProfileGroupStatistics && resolvedStatisticsDetailSection === 'profile' && (
        <ProfileGroupTable profileGroups={stats.profileGroups} showTitle={false} />
      )}

      {hasPhaseStatistics && resolvedStatisticsDetailSection === 'phase' && (
        <PhaseStatistics
          phaseStats={stats.phaseStats}
          showTitle={false}
          hideExitReasons={hidePhaseExitReasons}
        />
      )}
    </>
  );

  return (
    <div className='space-y-2'>
      <StatisticsDetailHeader
        hasCompareStatistics={hasCompareStatistics}
        hasMetricStatistics={hasMetricStatistics}
        hasTrendStatistics={hasTrendStatistics}
        hasPhaseStatistics={hasPhaseStatistics}
        hasProfileGroupStatistics={hasProfileGroupStatistics}
        resolvedStatisticsDetailSection={resolvedStatisticsDetailSection}
        setStatisticsDetailSection={setStatisticsDetailSection}
      />
      {shouldUsePanelSurface ? (
        <div
          className={`${STATISTICS_PANEL_CLASS} ${
            shouldUseCompactChartPadding ? 'px-1.5 py-2 sm:px-2' : 'p-4'
          }`}
        >
          {sectionContent}
        </div>
      ) : (
        sectionContent
      )}
    </div>
  );
}
