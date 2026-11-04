import { faBullseye } from '@fortawesome/free-solid-svg-icons/faBullseye';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faFaucet } from '@fortawesome/free-solid-svg-icons/faFaucet';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faGaugeHigh } from '@fortawesome/free-solid-svg-icons/faGaugeHigh';
import { faGears } from '@fortawesome/free-solid-svg-icons/faGears';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { groupColors } from '../../utils/analyzerUtils';

/**
 * @typedef {object} AnalyzerGroupVisual
 * @property {import('@fortawesome/fontawesome-svg-core').IconDefinition} icon
 * @property {string} color
 */

/** @type {Record<string, import('@fortawesome/fontawesome-svg-core').IconDefinition>} */
const GROUP_ICON_BY_KEY = {
  basics: faClock,
  pressure: faGauge,
  target_pressure: faBullseye,
  flow: faFaucet,
  target_flow: faBullseye,
  puckflow: faFilter,
  puckresistance: faGaugeHigh,
  liquidresistance: faGaugeHigh,
  temp: faTemperatureHalf,
  target_temp: faBullseye,
  weight: faScaleBalanced,
  weightflow: faScaleBalanced,
  system: faGears,
};

const WATER_ICON_COLOR = 'var(--statistics-summary-water)';

/**
 * @param {string | undefined} groupKey
 * @returns {AnalyzerGroupVisual}
 */
export function getAnalyzerGroupVisual(groupKey) {
  const colors =
    groupColors[/** @type {keyof typeof groupColors} */ (groupKey)] || groupColors.basics;
  return {
    icon: (groupKey !== undefined && GROUP_ICON_BY_KEY[groupKey]) || faClock,
    color: colors.anchor,
  };
}

/**
 * @param {import('../../utils/columns.js').AnalyzerColumn | null | undefined} column
 * @returns {AnalyzerGroupVisual}
 */
export function getAnalyzerColumnVisual(column) {
  if (column?.id === 'duration') {
    return {
      icon: faClock,
      color: groupColors.basics.anchor,
    };
  }

  if (column?.id === 'water') {
    return {
      icon: faDroplet,
      color: WATER_ICON_COLOR,
    };
  }

  return getAnalyzerGroupVisual(column?.group);
}

/**
 * @param {string} groupKey
 * @returns {AnalyzerGroupVisual[]}
 */
export function getAnalyzerGroupCardVisuals(groupKey) {
  if (groupKey === 'basics') {
    return [
      { icon: faClock, color: groupColors.basics.anchor },
      { icon: faDroplet, color: WATER_ICON_COLOR },
    ];
  }

  return [getAnalyzerGroupVisual(groupKey)];
}
