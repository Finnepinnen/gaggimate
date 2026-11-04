import { expect, test } from 'vitest';
import { axisUnitLabelPlugin } from '../src/pages/ShotAnalyzer/components/shotChart/helpers/axisPlugins.js';

/** A 2D context that records the text drawn on it. */
function recordingContext() {
  /** @type {string[]} */
  const texts = [];
  const ctx = new Proxy(
    { texts },
    {
      get(target, prop) {
        if (prop === 'texts') return target.texts;
        if (prop === 'fillText') return (/** @type {string} */ text) => texts.push(text);
        if (prop === 'measureText') return () => ({ width: 10 });
        return () => {};
      },
      set: () => true,
    },
  );
  return /** @type {CanvasRenderingContext2D & { texts: string[] }} */ (
    /** @type {unknown} */ (ctx)
  );
}

/** @param {Record<string, unknown>} scales */
function drawLabels(scales) {
  const ctx = recordingContext();
  const chart = /** @type {import('chart.js').Chart} */ (
    /** @type {unknown} */ ({
      ctx,
      width: 800,
      chartArea: { top: 40, left: 40, right: 760, bottom: 400 },
      scales,
    })
  );
  axisUnitLabelPlugin.afterDraw?.(
    chart,
    {},
    {
      yLabels: [
        { scaleId: 'yMain', label: 'bar' },
        { scaleId: 'yWeight', label: 'g', side: 'right' },
      ],
    },
  );
  return ctx.texts;
}

test('draws unit labels for visible axes only', () => {
  // Chart.js keeps `display` in the scale options; the plugin used to read `scale.display`,
  // which is never set, so hidden axes still got their unit label.
  expect(
    drawLabels({
      yMain: { left: 40, right: 60, options: { display: true } },
      yWeight: { left: 740, right: 760, options: { display: false } },
    }),
  ).toEqual(['bar']);
});
