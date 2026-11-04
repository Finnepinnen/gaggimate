import { afterEach, describe, expect, test, vi } from 'vitest';
import { drawFontAwesomeIcon } from '../src/pages/ShotAnalyzer/components/shotChart/helpers/canvasDrawing.js';
import { getPhaseName } from '../src/pages/ShotAnalyzer/components/shotChart/helpers/chartData.js';
import { buildPhaseOverviewRows } from '../src/pages/ShotAnalyzer/components/shotChart/model/phaseAnnotations.js';
import { buildExternalTooltipState } from '../src/pages/ShotAnalyzer/components/shotChart/tooltip/tooltipModel.js';
import { WATER_DRAWN_TOTAL_LABEL } from '../src/pages/ShotAnalyzer/components/shotChart/constants.js';

/**
 * Loosely typed fixture.
 * @template T
 * @param {object} value
 * @returns {T}
 */
const as = value => /** @type {T} */ (/** @type {unknown} */ (value));

describe('drawFontAwesomeIcon', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Records each fill with the path it got and the alpha it was drawn at. */
  function drawIcon(/** @type {string | string[]} */ path) {
    vi.stubGlobal(
      'Path2D',
      class {
        constructor(/** @type {string} */ d) {
          this.d = d;
        }
      },
    );
    /** @type {{ d: string, alpha: number }[]} */
    const fills = [];
    const ctx = {
      globalAlpha: 1,
      save() {},
      restore() {},
      translate() {},
      scale() {},
      fill(/** @type {{ d: string }} */ p) {
        fills.push({ d: p.d, alpha: this.globalAlpha });
      },
    };
    drawFontAwesomeIcon(as(ctx), {
      iconDef: as({ icon: [512, 512, [], '', path] }),
      x: 0,
      y: 0,
      size: 16,
      color: 'red',
    });
    return fills;
  }

  test('draws a solid icon path', () => {
    expect(drawIcon('M0 0')).toEqual([{ d: 'M0 0', alpha: 1 }]);
  });

  test('draws both layers of a duotone icon, the secondary at 40 %', () => {
    // An array path used to reach new Path2D() as "M0 0,M1 1".
    expect(drawIcon(['M0 0', 'M1 1'])).toEqual([
      { d: 'M0 0', alpha: 0.4 },
      { d: 'M1 1', alpha: 1 },
    ]);
  });
});

describe('buildExternalTooltipState', () => {
  test('builds single-mode rows without the optional callbacks', () => {
    // Used to throw: the water getter and colour map were assumed to be passed.
    const state = buildExternalTooltipState({
      chart: as({ chartArea: { left: 0, right: 100, top: 0, bottom: 100 }, scales: {} }),
      tooltip: as({
        opacity: 1,
        title: ['1.0 s'],
        dataPoints: [
          { dataset: { label: 'Pressure' }, parsed: { x: 1, y: 9 } },
          { dataset: { label: WATER_DRAWN_TOTAL_LABEL }, parsed: { x: 1, y: 0 } },
        ],
      }),
    });
    expect(state.visible).toBe(true);
    expect(state.rows.map(row => [row.label, row.color])).toEqual([
      ['Pressure', '#94a3b8'],
      [WATER_DRAWN_TOTAL_LABEL, '#94a3b8'],
    ]);
  });
});

describe('phase names without a shot', () => {
  test('getPhaseName falls back to a generic name', () => {
    expect(getPhaseName(null, 0)).toBe('Start');
    expect(getPhaseName(undefined, 2)).toBe('P3');
  });

  test('buildPhaseOverviewRows names unnamed phases without a shot', () => {
    // Used to throw: it cast shotData to non-null when results came without a shot.
    const rows = buildPhaseOverviewRows({
      shotData: null,
      results: as({ phases: [{ number: '1', start: 0, end: 5, exit: {} }] }),
    });
    expect(rows.map(row => row.phaseName)).toEqual(['P2']);
  });
});
