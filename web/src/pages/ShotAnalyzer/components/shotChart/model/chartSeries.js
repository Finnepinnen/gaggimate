import { TARGET_FLOW_MAX, TARGET_PRESSURE_MAX } from '../constants';
import { getSpikeResistantSeriesMax, safeMax, safeMin, toNumberOrNull } from '../helpers';
import { createPumpedWaterSource } from '../../../services/analyzer/waterIntegration';
import {
  getLiquidResistanceValue,
  getPuckResistanceValue,
} from '../../../services/analyzer/puckResistance';

/** @typedef {import('./types').ChartSample} ChartSample */
/** @typedef {import('./types').ChartSeriesMap} ChartSeriesMap */

/**
 * @template {keyof ChartSample} K
 * @param {ChartSample} sample
 * @param {K[]} keys
 * @returns {ChartSample[K] | null}
 */
function getSampleValue(sample, keys) {
  for (const key of keys) {
    if (sample[key] !== undefined) return sample[key];
  }
  return null;
}

/** @param {ChartSample} sample */
function getFlowFromSample(sample) {
  return getSampleValue(sample, ['fl', 'f', 'flow']);
}

/** @param {ChartSample | undefined} sample */
function getSampleTimeMs(sample) {
  const time = Number(sample?.t);
  return Number.isFinite(time) ? time : 0;
}

/** @param {ChartSample[]} samples */
export function buildSampleTimeline(samples) {
  /** @type {number[]} */
  const sampleTimesSec = new Array(samples.length);
  /** @type {number[]} */
  const cumulativeWaterTotalBySample = new Array(samples.length);
  const pumpedWaterSource = createPumpedWaterSource(samples);
  const initialRecordedWater = pumpedWaterSource.usesRecordedPumpedWater
    ? Number(samples[0]?.wp)
    : 0;
  let cumulativeWaterTotal = 0;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] || /** @type {ChartSample} */ ({});
    const tMs = getSampleTimeMs(sample);
    sampleTimesSec[i] = tMs / 1000;

    if (i === 0) {
      cumulativeWaterTotalBySample[i] = 0;
      continue;
    }

    if (pumpedWaterSource.usesRecordedPumpedWater) {
      cumulativeWaterTotalBySample[i] = Math.max(0, Number(sample.wp) - initialRecordedWater);
      continue;
    }

    // The previous sample's flow was active during this interval. This also keeps
    // t=0 valid instead of treating the first 250 ms as a zero-length interval.
    const previousSample = samples[i - 1] || /** @type {ChartSample} */ ({});
    const prevTMs = getSampleTimeMs(previousSample);
    const dt = Math.max(0, (tMs - prevTMs) / 1000);
    const flow = Number(getFlowFromSample(previousSample));
    cumulativeWaterTotal += (Number.isFinite(flow) ? flow : 0) * dt;
    cumulativeWaterTotalBySample[i] = cumulativeWaterTotal;
  }

  return {
    maxTime: samples.length > 0 ? getSampleTimeMs(samples[samples.length - 1]) / 1000 : 0,
    shotStartSec: sampleTimesSec[0] ?? 0,
    sampleTimesSec,
    cumulativeWaterTotalBySample,
  };
}

/**
 * @param {ChartSample[]} samples
 * @returns {ChartSeriesMap}
 */
export function buildSeries(samples) {
  /** @type {ChartSeriesMap} */
  const series = {
    pressure: [],
    flow: [],
    puckFlow: [],
    puckResistance: [],
    liquidResistance: [],
    temp: [],
    weight: [],
    weightFlow: [],
    targetPressure: [],
    targetFlow: [],
    targetTemp: [],
  };

  samples.forEach(sample => {
    const t = (sample.t || 0) / 1000;

    // Samples may come from different sources/versions, so each series resolves a
    // small key fallback chain instead of assuming one canonical payload shape.
    const pressure = toNumberOrNull(getSampleValue(sample, ['cp', 'p', 'pressure']));
    const flow = toNumberOrNull(getFlowFromSample(sample));
    const puckFlow = toNumberOrNull(getSampleValue(sample, ['pf', 'puck_flow']));
    const puckResistance = getPuckResistanceValue(sample);
    const liquidResistance = getLiquidResistanceValue(sample);
    const temp = toNumberOrNull(getSampleValue(sample, ['ct', 'temperature']));
    const weight = toNumberOrNull(getSampleValue(sample, ['v', 'w', 'weight', 'm']));
    const weightFlow = toNumberOrNull(getSampleValue(sample, ['vf', 'weight_flow']));
    const targetPressure = toNumberOrNull(getSampleValue(sample, ['tp', 'target_pressure']));
    const targetFlow = toNumberOrNull(getSampleValue(sample, ['tf', 'target_flow']));
    const targetTemp = toNumberOrNull(getSampleValue(sample, ['tt', 'tr', 'target_temperature']));

    if (pressure !== null) series.pressure.push({ x: t, y: pressure });
    if (flow !== null) series.flow.push({ x: t, y: flow });
    if (puckFlow !== null) series.puckFlow.push({ x: t, y: puckFlow });
    if (puckResistance !== null) series.puckResistance.push({ x: t, y: puckResistance });
    if (liquidResistance !== null) series.liquidResistance.push({ x: t, y: liquidResistance });
    if (temp !== null) series.temp.push({ x: t, y: temp });
    if (weight !== null && weight >= 0) series.weight.push({ x: t, y: weight });
    if (weightFlow !== null) series.weightFlow.push({ x: t, y: Math.max(0, weightFlow) });

    if (targetPressure !== null) {
      series.targetPressure.push({ x: t, y: Math.min(targetPressure, TARGET_PRESSURE_MAX) });
    }
    if (targetFlow !== null) {
      series.targetFlow.push({ x: t, y: Math.min(targetFlow, TARGET_FLOW_MAX) });
    }
    if (targetTemp !== null) series.targetTemp.push({ x: t, y: targetTemp });
  });

  return series;
}

/** @param {ChartSeriesMap} series */
export function buildAxisRanges(series) {
  const hasWeight = series.weight.some(point => point.y > 0);

  // The left axis should represent pressure/flow-family values only. Weight has its
  // own axis and should not inflate the shared scale used by the other series.
  const mainAxisMaxRaw = safeMax(
    [
      ...series.pressure.map(point => point.y),
      ...series.targetPressure.map(point => point.y),
      ...series.flow.map(point => point.y),
      ...series.puckFlow.map(point => point.y),
      ...series.targetFlow.map(point => point.y),
      getSpikeResistantSeriesMax(series.weightFlow, {
        fallback: 0,
        seriesKind: 'weightFlow',
      }),
    ],
    1,
  );
  const mainAxisMax = Math.max(9.7, mainAxisMaxRaw * 1.02);

  const weightAxisMaxRaw = getSpikeResistantSeriesMax(series.weight, {
    fallback: 1,
    seriesKind: 'weight',
  });
  const weightAxisMax = Math.max(1, weightAxisMaxRaw * 1.02);
  const puckResistanceAxisMax = Math.max(
    1,
    safeMax(
      series.puckResistance.map(point => point.y),
      1,
    ) * 1.05,
  );
  const liquidResistanceAxisMax = Math.max(
    1,
    safeMax(
      series.liquidResistance.map(point => point.y),
      1,
    ) * 1.05,
  );

  const tempAxisSamples = [...series.temp, ...series.targetTemp];
  const tempMinRaw = safeMin(
    tempAxisSamples.map(point => point.y),
    80,
  );
  const tempMaxRaw = safeMax(
    tempAxisSamples.map(point => point.y),
    100,
  );
  const tempRange = Math.max(0.5, tempMaxRaw - tempMinRaw);
  const tempTopPadding = Math.max(0.15, tempRange * 0.02);
  const tempBottomPadding = Math.max(0.25, tempRange * 0.07);

  return {
    hasWeight,
    mainAxisMax,
    weightAxisMax,
    puckResistanceAxisMax,
    liquidResistanceAxisMax,
    tempAxisMin: tempMinRaw - tempBottomPadding,
    tempAxisMax: tempMaxRaw + tempTopPadding,
  };
}
