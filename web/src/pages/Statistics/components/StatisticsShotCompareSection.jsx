import { Trans } from '@lingui/react/macro';
import { CompareShotCharts } from '../../ShotAnalyzer/components/shotChart/CompareShotCharts';
import { SectionTitle } from './statisticsUi.jsx';
import { StatisticsPanel } from './statisticsSurfaces.jsx';

/**
 * @param {object} props
 * @param {import('../types').StatisticsCompareEntry[]} props.compareEntries
 * @param {import('../../ShotAnalyzer/utils/constants').CompareTargetDisplayMode} props.compareTargetDisplayMode
 * @param {(mode: import('../../ShotAnalyzer/utils/constants').CompareTargetDisplayMode) => void} props.onCompareTargetDisplayModeChange
 * @param {boolean} [props.showTitle]
 * @param {boolean} [props.embedded]
 */
export function StatisticsShotCompareSection({
  compareEntries,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
  showTitle = true,
  embedded = false,
}) {
  if (!Array.isArray(compareEntries) || compareEntries.length === 0) return null;

  const content = (
    <CompareShotCharts
      compareEntries={compareEntries}
      compareTargetDisplayMode={compareTargetDisplayMode}
      onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
      showPhaseAnnotations={false}
      showStopAnnotations={false}
      showBrewModeAnnotation={false}
      // @ts-expect-error CompareShotCharts has no showCompareAnnotationToggle prop; it is ignored
      showCompareAnnotationToggle={false}
      enableDualMainChartAnnotations={false}
      showMainChartTitle={false}
      detailChartTitleVariant='legend'
      enableHoverInfo={true}
      compareTooltipMode='compareTitleOnly'
      showCompareShotLegend={false}
      shotStylePreset='statistics'
      showWeightInMainChart={false}
      showWeightFlowInMainChart={false}
    />
  );

  if (embedded) {
    return (
      <div className='space-y-2'>
        {showTitle && (
          <SectionTitle>
            <Trans>Shot Charts</Trans>
          </SectionTitle>
        )}
        {content}
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      {showTitle && (
        <SectionTitle>
          <Trans>Shot Charts</Trans>
        </SectionTitle>
      )}

      <StatisticsPanel className='px-1.5 py-2 sm:px-2'>{content}</StatisticsPanel>
    </div>
  );
}
