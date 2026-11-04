import { expect, test } from 'vitest';
import { getCompareAnnotations } from '../src/pages/ShotAnalyzer/components/shotChart/compare/compareChartConfig.js';

/** The annotation keys the chart model creates (model/phaseAnnotations.js). */
const phaseAnnotations = Object.fromEntries(
  [
    'shot_start',
    'phase_line_0',
    'phase_stop_0',
    'shot_end',
    'shot_end_stop',
    'shot_end_stop_line',
  ].map(key => [key, { type: 'line', display: false }]),
);

/** @param {boolean} showStopAnnotations */
function mainAnnotationKeys(showStopAnnotations) {
  const model = { phaseAnnotations };
  const { mainAnnotations } = getCompareAnnotations(
    /** @type {any} */ ({
      compareModels: [{ model }, { model }],
      enableDualMainChartAnnotations: true,
      showBrewModeAnnotation: true,
      showPhaseAnnotations: true,
      showStopAnnotations,
      visibility: { phaseNames: true, stops: true, brewModeLabel: true },
    }),
  );
  return Object.keys(mainAnnotations).filter(key => key.startsWith('primary'));
}

test('hiding stops removes every stop annotation', () => {
  // The filter used to look for phase_exit_* keys, which the model no longer creates.
  expect(mainAnnotationKeys(false).map(key => key.replace(/^primary_?/, ''))).toEqual([
    'shot_start',
    'phase_line_0',
  ]);
});

test('showing stops keeps them', () => {
  expect(mainAnnotationKeys(true)).toHaveLength(6);
});
