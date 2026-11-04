/**
 * StatisticsService.js
 * Pure aggregation logic for multi-shot statistics.
 * No side effects, no state — just computation.
 *
 * Input: Array of { analysis, meta: { id, timestamp, profileName, source } }
 * Output: StatisticsResult object
 */
import { t } from '@lingui/core/macro';

/**
 * @typedef {import('../types').StatisticsServiceEntry} StatisticsServiceEntry
 * @typedef {import('../types').StatisticsResult} StatisticsResult
 * @typedef {import('../types').StatisticsSummary} StatisticsSummary
 * @typedef {import('../types').StatisticsMetrics} StatisticsMetrics
 * @typedef {import('../types').StatisticsMetricKey} StatisticsMetricKey
 * @typedef {import('../types').AggregatedMetricKey} AggregatedMetricKey
 * @typedef {import('../types').MetricStatsMap} MetricStatsMap
 * @typedef {import('../types').LooseTarget} LooseTarget
 * @typedef {import('../../ShotAnalyzer/types').TotalStats} TotalStats
 * @typedef {import('../../ShotAnalyzer/types').AnalyzedPhase} AnalyzedPhase
 * @typedef {import('../types').AggregatedStat} AggregatedStat
 * @typedef {import('../types').PhaseMetricStat} PhaseMetricStat
 * @typedef {import('../types').ProfileGroupStats} ProfileGroupStats
 * @typedef {import('../types').PhaseStatsRow} PhaseStatsRow
 * @typedef {import('../types').TargetDeltaKey} TargetDeltaKey
 * @typedef {import('../types').TargetDelta} TargetDelta
 * @typedef {import('../types').TrendEntry} TrendEntry
 * @typedef {Record<TargetDeltaKey, number[]>} TargetDeltaValues
 * @typedef {{ phase: AnalyzedPhase, actuals: TargetDeltaValues, targets: TargetDeltaValues }} TargetDeltaContext
 */

/** @param {number[]} values */
function averageOf(values) {
  if (!values.length) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

// Population standard deviation (not sample): we treat the loaded shots as the full
// dataset, not a sample drawn from a larger population.
/**
 * @param {number[]} values
 * @param {number} mean
 */
function stdDevOf(values, mean) {
  if (values.length < 2) return 0;
  let sumSq = 0;
  for (const value of values) {
    const d = value - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / values.length);
}

/**
 * @param {MetricStatsMap[]} totals
 * @param {AggregatedMetricKey} key
 * @returns {AggregatedStat}
 */
function aggregateMetricStats(totals, key) {
  /** @type {number[]} */
  const avgs = [];
  /** @type {number[]} */
  const mins = [];
  /** @type {number[]} */
  const maxs = [];

  for (const t of totals) {
    const stat = t[key];
    if (!stat) continue;
    if (Number.isFinite(stat.avg)) avgs.push(/** @type {number} */ (stat.avg));
    if (Number.isFinite(stat.min)) mins.push(/** @type {number} */ (stat.min));
    if (Number.isFinite(stat.max)) maxs.push(/** @type {number} */ (stat.max));
  }

  const avg = averageOf(avgs);
  return {
    count: avgs.length,
    avg,
    min: mins.length ? Math.min(...mins) : 0,
    max: maxs.length ? Math.max(...maxs) : 0,
    stdDev: stdDevOf(avgs, avg),
  };
}

/**
 * @param {(number | null | undefined)[]} values
 * @returns {AggregatedStat}
 */
function aggregateValueStats(values) {
  const finiteValues = /** @type {number[]} */ (values.filter(Number.isFinite));
  const avg = averageOf(finiteValues);
  return {
    count: finiteValues.length,
    avg,
    min: finiteValues.length ? Math.min(...finiteValues) : 0,
    max: finiteValues.length ? Math.max(...finiteValues) : 0,
    stdDev: stdDevOf(finiteValues, avg),
  };
}

/** @param {TotalStats | undefined} total */
function getTotalTempTargetDeviation(total) {
  const actualAvg = Number(total?.t?.avg);
  const targetAvg = Number(total?.tt?.avg);
  if (!Number.isFinite(actualAvg) || !Number.isFinite(targetAvg)) return null;
  return Math.abs(actualAvg - targetAvg);
}

function createSummaryAccumulator() {
  return {
    totalDuration: 0,
    totalWater: 0,
    totalWeight: 0,
    earliest: Infinity,
    latest: -Infinity,
    gmCount: 0,
    browserCount: 0,
    tempAvgs: /** @type {number[]} */ ([]),
    tempTargetDeviations: /** @type {number[]} */ ([]),
  };
}

/** @typedef {ReturnType<typeof createSummaryAccumulator>} SummaryAccumulator */

/**
 * @param {SummaryAccumulator} acc
 * @param {TotalStats | undefined} total
 */
function addTotalSummaryValues(acc, total) {
  if (!total) return;
  if (Number.isFinite(total.duration)) acc.totalDuration += total.duration;
  if (Number.isFinite(total.water)) acc.totalWater += total.water;
  if (Number.isFinite(total.weight)) acc.totalWeight += total.weight;
  if (Number.isFinite(total.t?.avg)) acc.tempAvgs.push(/** @type {number} */ (total.t.avg));
  const tempTargetDeviation = getTotalTempTargetDeviation(total);
  if (tempTargetDeviation !== null && Number.isFinite(tempTargetDeviation)) {
    acc.tempTargetDeviations.push(tempTargetDeviation);
  }
}

/**
 * @param {SummaryAccumulator} acc
 * @param {StatisticsServiceEntry['meta']} meta
 */
function addMetaSummaryValues(acc, meta) {
  if (Number.isFinite(meta.timestamp)) {
    acc.earliest = Math.min(acc.earliest, meta.timestamp);
    acc.latest = Math.max(acc.latest, meta.timestamp);
  }
  if (meta.source === 'gaggimate') acc.gmCount += 1;
  else acc.browserCount += 1;
}

/**
 * @param {StatisticsServiceEntry[]} entries
 * @returns {StatisticsSummary}
 */
function computeSummary(entries) {
  const totalShots = entries.length;
  const acc = createSummaryAccumulator();

  for (const { analysis, meta } of entries) {
    addTotalSummaryValues(acc, analysis.total);
    addMetaSummaryValues(acc, meta);
  }

  const avgTemp = averageOf(acc.tempAvgs);
  const avgTempTargetDeviation = averageOf(acc.tempTargetDeviations);

  return {
    totalShots,
    totalDuration: acc.totalDuration,
    totalWater: acc.totalWater,
    totalWeight: acc.totalWeight,
    avgDuration: totalShots ? acc.totalDuration / totalShots : 0,
    avgWater: totalShots ? acc.totalWater / totalShots : 0,
    avgWeight: totalShots ? acc.totalWeight / totalShots : 0,
    avgTemp,
    avgTempTargetDeviation,
    dateRange: {
      earliest: acc.earliest === Infinity ? null : acc.earliest,
      latest: acc.latest === -Infinity ? null : acc.latest,
    },
    sourceBreakdown: { gaggimate: acc.gmCount, browser: acc.browserCount },
  };
}

/**
 * @param {StatisticsServiceEntry[]} entries
 * @returns {StatisticsMetrics}
 */
function computeMetricAverages(entries) {
  const totals = /** @type {TotalStats[]} */ (entries.map(e => e.analysis.total).filter(Boolean));
  /** @type {AggregatedMetricKey[]} */
  const keys = ['p', 'f', 'pf', 'tt', 't', 'w', 'pr', 'lr'];
  /** @type {StatisticsMetrics} */
  const metrics = {};
  for (const key of keys) {
    metrics[key] =
      key === 'w'
        ? aggregateValueStats(totals.map(total => total.weight))
        : aggregateMetricStats(totals, key);
  }
  metrics.water = aggregateValueStats(totals.map(total => total.water));
  metrics.duration = aggregateValueStats(totals.map(total => total.duration));
  metrics.ttDelta = aggregateValueStats(totals.map(getTotalTempTargetDeviation));
  metrics.pPeak = aggregateValueStats(totals.map(total => total.p?.max));
  return metrics;
}

/**
 * @param {StatisticsServiceEntry[]} entries
 * @returns {ProfileGroupStats[]}
 */
function computeProfileGroups(entries) {
  /** @type {Map<string, StatisticsServiceEntry[]>} */
  const groups = new Map();

  for (const entry of entries) {
    const name = entry.meta.profileName || '(Unmatched)';
    if (!groups.has(name)) {
      groups.set(name, []);
    }
    /** @type {StatisticsServiceEntry[]} */ (groups.get(name)).push(entry);
  }

  /** @type {ProfileGroupStats[]} */
  const result = [];
  for (const [profileName, groupEntries] of groups) {
    const totals = /** @type {TotalStats[]} */ (
      groupEntries.map(e => e.analysis.total).filter(Boolean)
    );
    const durations = totals.map(t => t.duration).filter(Number.isFinite);
    const weights = totals.map(t => t.weight).filter(Number.isFinite);
    const waters = totals.map(t => t.water).filter(Number.isFinite);

    /** @type {AggregatedMetricKey[]} */
    const keys = ['p', 'f', 'pf', 't', 'w'];
    /** @type {ProfileGroupStats['metrics']} */
    const metrics = {};
    for (const key of keys) {
      metrics[key] =
        key === 'w'
          ? aggregateValueStats(totals.map(total => total.weight))
          : aggregateMetricStats(totals, key);
    }

    result.push({
      profileName,
      shotCount: groupEntries.length,
      avgDuration: averageOf(durations),
      avgWeight: averageOf(weights),
      avgWater: averageOf(waters),
      metrics,
    });
  }

  result.sort((a, b) => b.shotCount - a.shotCount);
  return result;
}

/**
 * For a group of same-name phases across shots, compute the average
 * deviation from profile targets (duration, water/pumped, pressure, flow, weight, temp).
 * Uses the measured values from the analyzed shot.
 *
 * @param {AnalyzedPhase[]} phases
 * @returns {NonNullable<PhaseStatsRow['targetDeltas']>}
 */
function computePhaseTargetDeltas(phases) {
  /** @type {TargetDeltaKey[]} */
  const keys = ['duration', 'water', 'p', 'f', 't', 'w'];
  const actuals = /** @type {TargetDeltaValues} */ ({});
  const targets = /** @type {TargetDeltaValues} */ ({});
  for (const k of keys) {
    actuals[k] = [];
    targets[k] = [];
  }

  for (const phase of phases) {
    addPhaseTargetDeltaValues({ phase, actuals, targets });
  }

  /** @type {NonNullable<PhaseStatsRow['targetDeltas']>} */
  const result = {};
  for (const key of keys) {
    if (actuals[key].length > 0) {
      const avgActual = averageOf(actuals[key]);
      const avgTarget = averageOf(targets[key]);
      result[key] = { actual: avgActual, target: avgTarget, delta: avgActual - avgTarget };
    }
  }
  return result;
}

/**
 * @param {object} args
 * @param {TargetDeltaValues} args.actuals
 * @param {TargetDeltaValues} args.targets
 * @param {TargetDeltaKey} args.key
 * @param {number | null | undefined} args.actual
 * @param {number | null | undefined} args.target
 */
function pushTargetDeltaValues({ actuals, targets, key, actual, target }) {
  if (!Number.isFinite(actual) || !Number.isFinite(target)) return;
  actuals[key].push(/** @type {number} */ (actual));
  targets[key].push(/** @type {number} */ (target));
}

/**
 * @param {AnalyzedPhase} phase
 * @param {(target: LooseTarget) => boolean} predicate
 */
function findPhaseTarget(phase, predicate) {
  const targets = Array.isArray(phase?.profilePhase?.targets) ? phase.profilePhase.targets : [];
  return targets.find(predicate);
}

/** @param {TargetDeltaContext} context */
function addDurationTargetDelta({ phase, actuals, targets }) {
  pushTargetDeltaValues({
    actuals,
    targets,
    key: 'duration',
    actual: phase.duration,
    target: phase.profilePhase?.duration,
  });
}

/** @param {TargetDeltaContext} context */
function addPumpedTargetDelta({ phase, actuals, targets }) {
  const pumpedTarget = findPhaseTarget(phase, target => target.type === 'pumped');
  pushTargetDeltaValues({
    actuals,
    targets,
    key: 'water',
    actual: phase.water,
    target: pumpedTarget?.value,
  });
}

/** @param {TargetDeltaContext} context */
function addWeightTargetDelta({ phase, actuals, targets }) {
  const weightTarget = findPhaseTarget(
    phase,
    target => target.type === 'weight' || target.type === 'volumetric',
  );
  pushTargetDeltaValues({
    actuals,
    targets,
    key: 'w',
    actual: phase.prediction?.finalWeight ?? phase.weight,
    target: weightTarget?.value,
  });
}

/** @param {TargetDeltaContext & { key: 'p' | 'f', targetType: string }} context */
function addMetricTargetDelta({ phase, actuals, targets, key, targetType }) {
  const target = findPhaseTarget(phase, candidate => candidate.type === targetType);
  pushTargetDeltaValues({
    actuals,
    targets,
    key,
    actual: phase.stats?.[key]?.avg,
    target: target?.value,
  });
}

/** @param {TargetDeltaContext} context */
function addTemperatureTargetDelta({ phase, actuals, targets }) {
  pushTargetDeltaValues({
    actuals,
    targets,
    key: 't',
    actual: phase.stats?.t?.avg,
    target: phase.stats?.tt?.avg,
  });
}

/** @param {TargetDeltaContext} context */
function addPhaseTargetDeltaValues({ phase, actuals, targets }) {
  if (!phase.profilePhase) return;
  addDurationTargetDelta({ phase, actuals, targets });
  addPumpedTargetDelta({ phase, actuals, targets });
  addWeightTargetDelta({ phase, actuals, targets });
  addMetricTargetDelta({
    phase,
    actuals,
    targets,
    key: 'p',
    targetType: 'pressure',
  });
  addMetricTargetDelta({
    phase,
    actuals,
    targets,
    key: 'f',
    targetType: 'flow',
  });
  addTemperatureTargetDelta({ phase, actuals, targets });
}

/** @param {StatisticsServiceEntry[]} entries */
function buildPhaseMap(entries) {
  /** @type {Map<string, AnalyzedPhase[]>} */
  const phaseMap = new Map();

  for (const { analysis } of entries) {
    if (!analysis.phases) continue;
    for (const phase of analysis.phases) {
      // Executed phases carry the sample phaseNumber key as a string; skipped ones a number.
      const phaseNumber = Number(phase.number) + 1;
      const name = phase.displayName || phase.name || t`Phase ${phaseNumber}`;
      if (!phaseMap.has(name)) {
        phaseMap.set(name, []);
      }
      /** @type {AnalyzedPhase[]} */ (phaseMap.get(name)).push(phase);
    }
  }

  return phaseMap;
}

/**
 * @param {object} args
 * @param {AnalyzedPhase[]} args.phases
 * @param {Record<string, number>} args.phaseCounts
 * @param {Record<string, number>} args.totalCounts
 */
function addExitReasonCounts({ phases, phaseCounts, totalCounts }) {
  for (const phase of phases) {
    const reason = phase.exit?.reason || 'Unknown';
    phaseCounts[reason] = (phaseCounts[reason] || 0) + 1;
    totalCounts[reason] = (totalCounts[reason] || 0) + 1;
  }
}

/**
 * @param {object} args
 * @param {MetricStatsMap[]} args.statsArray
 * @param {AggregatedMetricKey[]} args.metricKeys
 * @param {Partial<Record<AggregatedMetricKey, MetricStatsMap[]>>} args.allStatsArrays
 */
function aggregatePhaseMetrics({ statsArray, metricKeys, allStatsArrays }) {
  /** @type {PhaseStatsRow['metrics']} */
  const metrics = {};
  for (const key of metricKeys) {
    metrics[key] = aggregateMetricStats(statsArray, key);
    if (!allStatsArrays[key]) allStatsArrays[key] = [];
    allStatsArrays[key].push(...statsArray);
  }
  return metrics;
}

/**
 * @param {object} args
 * @param {AggregatedMetricKey[]} args.metricKeys
 * @param {Partial<Record<AggregatedMetricKey, MetricStatsMap[]>>} args.allStatsArrays
 */
function buildTotalPhaseMetrics({ metricKeys, allStatsArrays }) {
  /** @type {PhaseStatsRow['metrics']} */
  const totalMetrics = {};
  for (const key of metricKeys) {
    totalMetrics[key] = allStatsArrays[key]
      ? aggregateMetricStats(allStatsArrays[key], key)
      : { avg: 0, min: 0, max: 0, stdDev: 0 };
  }
  return totalMetrics;
}

/**
 * @param {StatisticsServiceEntry[]} entries
 * @returns {PhaseStatsRow[]}
 */
function computePhaseStats(entries) {
  const phaseMap = buildPhaseMap(entries);
  /** @type {PhaseStatsRow[]} */
  const result = [];
  let totalDuration = 0;
  let totalWater = 0;
  let totalShotCount = 0;
  /** @type {Record<string, number>} */
  const totalExitReasons = {};
  /** @type {Partial<Record<AggregatedMetricKey, MetricStatsMap[]>>} */
  const allStatsArrays = {};
  /** @type {AggregatedMetricKey[]} */
  const metricKeys = ['p', 'f', 'pf', 't', 'w'];

  for (const [phaseName, phases] of phaseMap) {
    const durations = phases.map(p => p.duration).filter(Number.isFinite);
    const waters = phases.map(p => p.water).filter(Number.isFinite);
    /** @type {Record<string, number>} */
    const exitReasonDistribution = {};
    const statsArray = phases.map(p => p.stats).filter(Boolean);
    addExitReasonCounts({
      phases,
      phaseCounts: exitReasonDistribution,
      totalCounts: totalExitReasons,
    });
    const metrics = aggregatePhaseMetrics({ statsArray, metricKeys, allStatsArrays });
    const targetDeltas = computePhaseTargetDeltas(phases);

    const avgDur = averageOf(durations);
    const avgWat = averageOf(waters);
    // Accumulate weighted sums so the total row reflects a proper weighted average.
    totalDuration += avgDur * phases.length;
    totalWater += avgWat * phases.length;
    totalShotCount += phases.length;

    result.push({
      phaseName,
      shotCount: phases.length,
      avgDuration: avgDur,
      avgWater: avgWat,
      exitReasonDistribution,
      metrics,
      targetDeltas,
    });
  }

  // Add total row
  const totalMetrics = buildTotalPhaseMetrics({ metricKeys, allStatsArrays });

  result.push({
    phaseName: 'Total',
    shotCount: totalShotCount,
    avgDuration: totalShotCount ? totalDuration / totalShotCount : 0,
    avgWater: totalShotCount ? totalWater / totalShotCount : 0,
    exitReasonDistribution: totalExitReasons,
    metrics: totalMetrics,
    isTotal: true,
  });

  return result;
}

/**
 * @param {StatisticsServiceEntry[]} entries
 * @returns {TrendEntry[]}
 */
function computeTrends(entries) {
  const sorted = [...entries].sort((a, b) => (a.meta.timestamp || 0) - (b.meta.timestamp || 0));

  return sorted.map(({ analysis, meta }) => {
    const total = analysis.total || /** @type {Partial<TotalStats>} */ ({});
    return {
      timestamp: meta.timestamp,
      shotId: meta.id,
      profileName: meta.profileName || '(Unknown)',
      duration: total.duration || 0,
      weight: total.weight || 0,
      water: total.water || 0,
      avgPressure: total.p?.avg || 0,
      avgFlow: total.f?.avg || 0,
      avgTemp: total.t?.avg || 0,
      avgPuckFlow: total.pf?.avg || 0,
    };
  });
}

/**
 * @param {StatisticsServiceEntry[] | null | undefined} entries
 * @returns {StatisticsResult}
 */
export function computeStatistics(entries) {
  if (!entries || entries.length === 0) {
    return {
      summary: {
        totalShots: 0,
        totalDuration: 0,
        totalWater: 0,
        totalWeight: 0,
        avgDuration: 0,
        avgWater: 0,
        avgWeight: 0,
        avgTemp: 0,
        avgTempTargetDeviation: 0,
        dateRange: { earliest: null, latest: null },
        sourceBreakdown: { gaggimate: 0, browser: 0 },
      },
      metrics: {},
      profileGroups: [],
      phaseStats: [],
      trends: [],
    };
  }

  return {
    summary: computeSummary(entries),
    metrics: computeMetricAverages(entries),
    profileGroups: computeProfileGroups(entries),
    phaseStats: computePhaseStats(entries),
    trends: computeTrends(entries),
  };
}
