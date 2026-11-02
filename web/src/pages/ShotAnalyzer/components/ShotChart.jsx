/** Public chart entry point that selects the single-shot or compare implementation. */

import { CompareShotCharts } from './shotChart/CompareShotCharts';
import { SingleShotChart } from './shotChart/single/SingleShotChart';
import './ShotChart.css';

/** @typedef {import('preact').ComponentProps<typeof SingleShotChart>} SingleShotChartProps */
/** @typedef {import('preact').ComponentProps<typeof CompareShotCharts>} CompareShotChartsProps */

/**
 * @param {object} props
 * @param {SingleShotChartProps['shotData']} props.shotData
 * @param {SingleShotChartProps['profileData']} [props.profileData]
 * @param {SingleShotChartProps['results']} props.results
 * @param {CompareShotChartsProps['compareEntries']} [props.compareEntries]
 * @param {boolean} [props.isCompareActive]
 * @param {number} [props.desktopCardHeight]
 * @param {CompareShotChartsProps['onCompareSwap']} [props.onCompareSwap]
 * @param {CompareShotChartsProps['compareTargetDisplayMode']} props.compareTargetDisplayMode
 * @param {CompareShotChartsProps['onCompareTargetDisplayModeChange']} [props.onCompareTargetDisplayModeChange]
 */
export function ShotChart({
  shotData,
  profileData,
  results,
  compareEntries = [],
  isCompareActive = false,
  desktopCardHeight = 0,
  onCompareSwap = null,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
}) {
  if (isCompareActive && Array.isArray(compareEntries) && compareEntries.length > 1) {
    return (
      <CompareShotCharts
        compareEntries={compareEntries}
        onCompareSwap={onCompareSwap}
        compareTargetDisplayMode={compareTargetDisplayMode}
        onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
        showMainChartTitle={false}
        detailChartTitleVariant='legend'
      />
    );
  }

  return (
    <SingleShotChart
      shotData={shotData}
      profileData={profileData}
      results={results}
      desktopCardHeight={desktopCardHeight}
    />
  );
}
