/**
 * Axis bounds for the shot history chart. Missing samples are ignored; an axis without any
 * value gets no bounds, so Chart.js scales it automatically.
 * @param {(number | null | undefined)[]} temperatures °C, current and target.
 * @param {number[]} times s
 * @returns {{ x: { min?: number, max?: number }, y: { min?: number, max?: number } }}
 */
export function getHistoryChartRange(temperatures, times) {
  const temps = temperatures.filter(
    /** @returns {v is number} */ v => typeof v === 'number' && Number.isFinite(v),
  );
  const xs = times.filter(v => Number.isFinite(v));

  /** @type {{ min?: number, max?: number }} */
  let y = {};
  if (temps.length) {
    const minTemp = Math.floor(Math.min(...temps));
    const maxTemp = Math.ceil(Math.max(...temps));
    const padding = maxTemp - minTemp > 10 ? 2 : 5;
    y = { min: Math.max(minTemp - padding, 0), max: maxTemp + padding };
  }

  return {
    x: xs.length ? { min: Math.min(...xs), max: Math.max(...xs) } : {},
    y,
  };
}
