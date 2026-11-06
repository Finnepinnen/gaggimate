import { useRef } from 'preact/hooks';
import { Chart } from 'chart.js';
import { ChartComponent } from './Chart';
import { t } from '@lingui/core/macro';
import { isDarkTheme } from '../utils/themeManager.js';

/** @typedef {import('../types').ProfilePhase} ProfilePhase */
/** @typedef {import('../types').PumpAdvanced} PumpAdvanced */

/**
 * A phase as the chart reads it. The profile editor passes raw form values, so
 * `duration` may be a string; JS coerces it in the arithmetic below.
 * @typedef {Omit<ProfilePhase, 'duration'> & { duration: number | string }} ChartPhase
 */

/**
 * ChartPhase with simple (numeric) pumps readable as an object: their fields read as undefined.
 * @typedef {Omit<ChartPhase, 'pump'> & { pump: ProfilePhase['pump'] & Partial<PumpAdvanced> }} PumpReadablePhase
 */

/** @typedef {{ x: number, y: number, target: boolean }} ProfilePoint */
/** Segment context of a line dataset; `raw` is the ProfilePoint. */
/** @typedef {{ p0: { raw: ProfilePoint } }} SegmentContext */

/** @typedef {{ start: number, end: number }} PhaseRange */

/**
 * Plugin options as built below; `annotation` is filled in after the literal.
 * @typedef {{ drawTime: string, clip: boolean, annotations: object[], interaction?: object }} AnnotationConfig
 * @typedef {{ legend: object, title: object, annotation?: AnnotationConfig }} LinePlugins
 */

const POINT_INTERVAL = 0.1; // s

/**
 * @template T
 * @param {SegmentContext} ctx
 * @param {T} value
 * @returns {T | undefined}
 */
const skipped = (ctx, value) => (!ctx.p0.raw.target ? value : undefined);
const pressureDatasetDefaults = {
  borderColor: 'rgb(75, 192, 192)',
  tension: 0.4,
  cubicInterpolationMode: 'monotone',
  segment: {
    borderColor: /** @param {SegmentContext} ctx */ ctx => skipped(ctx, 'rgba(75, 192, 192, 0.6)'),
    borderDash: /** @param {SegmentContext} ctx */ ctx => skipped(ctx, [6, 6]),
  },
  spanGaps: true,
};

const flowDatasetDefaults = {
  borderColor: 'rgb(255, 192, 192)',
  tension: 0.4,
  cubicInterpolationMode: 'monotone',
  segment: {
    borderColor: /** @param {SegmentContext} ctx */ ctx => skipped(ctx, 'rgba(255, 192, 192, 0.6)'),
    borderDash: /** @param {SegmentContext} ctx */ ctx => skipped(ctx, [6, 6]),
  },
  spanGaps: true,
  yAxisID: 'y1',
};

/** @param {number} t */
function easeLinear(t) {
  return t;
}
/** @param {number} t */
function easeIn(t) {
  return t * t;
}
/** @param {number} t */
function easeOut(t) {
  return 1.0 - (1.0 - t) * (1.0 - t);
}
/** @param {number} t */
function easeInOut(t) {
  return t < 0.5 ? 2.0 * t * t : 1.0 - 2.0 * (1.0 - t) * (1.0 - t);
}

/**
 * @param {number} t
 * @param {import('../types').TransitionType} type
 */
function applyEasing(t, type) {
  if (t <= 0.0) return 0.0;
  if (t >= 1.0) return 1.0;
  switch (type) {
    case 'linear':
      return easeLinear(t);
    case 'ease-in':
      return easeIn(t);
    case 'ease-out':
      return easeOut(t);
    case 'ease-in-out':
      return easeInOut(t);
    case 'instant':
    default:
      return 1.0;
  }
}

/**
 * @param {PumpReadablePhase[]} phases
 * @param {'pressure' | 'flow'} target
 * @returns {ProfilePoint[]}
 */
function prepareData(phases, target) {
  if (!Array.isArray(phases) || phases.length === 0) {
    return [];
  }

  const data = [];
  let time = 0;
  let phaseTime = 0;
  let phaseIndex = 0;
  let currentPhase = phases[phaseIndex];
  let currentPressure = 0;
  let currentFlow = 0;
  let phaseStartFlow = 0;
  let phaseStartPressure = 0;
  let effectiveFlow = currentPhase.pump?.flow || 0;
  let effectivePressure = currentPhase.pump?.pressure || 0;

  do {
    currentPhase = phases[phaseIndex];
    const alpha = applyEasing(
      phaseTime /
        (currentPhase.transition?.duration || /** @type {number} */ (currentPhase.duration)),
      currentPhase?.transition?.type || 'linear',
    );
    currentFlow =
      currentPhase.pump?.target === 'flow'
        ? phaseStartFlow + (effectiveFlow - phaseStartFlow) * alpha
        : currentPhase.pump?.flow || 0;
    currentPressure =
      currentPhase.pump?.target === 'pressure'
        ? phaseStartPressure + (effectivePressure - phaseStartPressure) * alpha
        : currentPhase.pump?.pressure || 0;
    data.push({
      x: time,
      y: target === 'pressure' ? currentPressure : currentFlow,
      target: currentPhase.pump?.target === target,
    });
    time += POINT_INTERVAL;
    phaseTime += POINT_INTERVAL;
    if (phaseTime >= /** @type {number} */ (currentPhase.duration)) {
      phaseTime = 0;
      phaseIndex++;
      if (phaseIndex < phases.length) {
        phaseStartFlow = currentFlow;
        phaseStartPressure = currentPressure;
        let nextPhase = phases[phaseIndex];
        effectiveFlow = nextPhase.pump?.flow === -1 ? currentFlow : nextPhase.pump?.flow || 0;
        effectivePressure =
          nextPhase.pump?.pressure === -1 ? currentPressure : nextPhase.pump?.pressure || 0;
      }
    }
  } while (phaseIndex < phases.length);

  return data;
}

/**
 * @param {{ phases?: ChartPhase[] } | null | undefined} data
 * @param {number | null} selectedPhase
 * @param {PhaseRange[]} phaseRanges
 * @param {((index: number) => void) | null} onPhaseClick
 * @param {boolean} [isDarkMode]
 * @param {boolean} [showPhaseLabels]
 */
function makeChartData(
  data,
  selectedPhase,
  phaseRanges,
  onPhaseClick,
  isDarkMode = false,
  showPhaseLabels = true,
) {
  const phases = Array.isArray(data?.phases) ? data.phases : [];
  let duration = 0;
  for (const phase of phases) {
    duration += Number.parseFloat(/** @type {string} */ (phase.duration));
  }
  const chartData = {
    type: 'line',
    data: {
      datasets: [
        {
          ...pressureDatasetDefaults,
          label: t`Pressure`,
          data: prepareData(/** @type {PumpReadablePhase[]} */ (phases), 'pressure'),
        },
        {
          ...flowDatasetDefaults,
          label: t`Flow`,
          data: prepareData(/** @type {PumpReadablePhase[]} */ (phases), 'flow'),
        },
      ],
    },
    options: {
      fill: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
      },
      plugins: /** @type {LinePlugins} */ ({
        legend: {
          position: 'top',
          display: true,
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            pointStyleWidth: 20,
            padding: 8,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            /** @param {import('chart.js').Chart<'line'>} chart */
            generateLabels(chart) {
              const original = Chart.defaults.plugins.legend.labels.generateLabels;
              /** @type {import('chart.js').LegendItem[]} */
              const labels = original.call(this, chart);

              labels.forEach(label => {
                label.lineWidth = 3;
              });

              return labels;
            },
          },
        },
        title: {
          display: false,
          text: t`Temperature History`,
          font: {
            size: window.innerWidth < 640 ? 14 : 16,
          },
        },
      }),
      animations: false,
      radius: 0,
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: duration,
          display: true,
          position: 'bottom',
          title: {},
          ticks: {
            source: 'auto',
            callback: (/** @type {number} */ value) => {
              return `${value?.toFixed()}s`;
            },
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            maxTicksLimit: 10,
          },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: t`Pressure (bar)`,
          },
          min: 0,
          max: 12,
          ticks: {
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: t`Flow (ml/s)`,
          },
          min: 0,
          max: 10,
          ticks: {
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
        },
      },
    },
  };

  // Always show phase dividers and labels
  chartData.options.plugins.annotation = {
    drawTime: 'afterDatasetsDraw',
    clip: false,
    annotations: [],
  };

  // Add highlighting box only if a phase is selected
  if (selectedPhase !== null && phaseRanges[selectedPhase]) {
    const start = phaseRanges[selectedPhase].start;
    const end = phaseRanges[selectedPhase].end;

    chartData.options.plugins.annotation.annotations.push({
      id: 'box1',
      type: 'box',
      xMin: start + 0.1,
      xMax: end - 0.1,
      backgroundColor: 'rgba(0,105,255,0.2)',
      borderColor: 'rgba(100, 100, 100, 0)',
    });
  }

  const chartWidth = window.innerWidth;
  const showLabels = showPhaseLabels && chartWidth >= 520;
  const isSmall = window.innerWidth < 640;
  // const yMax = chartData.options.scales.y.max ?? 12;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const phaseNumber = i + 1;
    const phaseName = phase.name || t`Phase ${phaseNumber}`;

    chartData.options.plugins.annotation.annotations.push({
      type: 'line',
      xMin: phaseRanges[i].start,
      xMax: phaseRanges[i].start,
      borderColor: 'rgb(128,128,128)',
      borderWidth: 1,
      label: showLabels
        ? {
            display: true,
            content: phaseName,
            rotation: -90,
            position: 'end', // anchor at top of line
            xAdjust: i === 0 ? -7 : 8, // tweak first label inward to compensate for y-axis padding
            yAdjust: 0,
            padding: { x: 4, y: 0 },
            color: isDarkMode ? 'rgb(255,255,255)' : 'rgb(0,0,0)',
            backgroundColor: isDarkMode ? 'rgba(22,33,50,0.75)' : 'rgba(255,255,255,0.75)',
            textAlign: 'start',
            font: {
              size: isSmall ? 9 : 11,
              weight: 500,
            },
          }
        : undefined,
    });
  }

  // If we are in the edit profile page (we have phases and a phase is selected) set the hover effect and onPhaseClick()
  if (selectedPhase !== null && phases.length > 0) {
    chartData.options.plugins.annotation.interaction = {
      intersect: false,
      mode: 'x',
      axis: 'x',
    };

    const hoverEnterColor = 'rgb(0 105 255 / 0.07)';
    const hoverLeaveColor = 'rgb(0 0 0 / 0)';

    for (let i = 0; i < phaseRanges.length; i++) {
      const start = phaseRanges[i].start;
      const end = phaseRanges[i].end;
      chartData.options.plugins.annotation.annotations.push({
        id: `phase${i}`,
        type: 'box',
        xMin: start + 0.1,
        xMax: end - 0.1,
        backgroundColor: hoverLeaveColor,
        borderColor: 'rgba(100, 100, 100, 0)',
        clip: true,
        /** @param {{ element: { options: { backgroundColor: string } } }} context */
        enter({ element }) {
          element.options.backgroundColor = hoverEnterColor;
          return true;
        },
        /** @param {{ element: { options: { backgroundColor: string } } }} context */
        leave({ element }) {
          element.options.backgroundColor = hoverLeaveColor;
          return true;
        },
        click() {
          if (onPhaseClick) onPhaseClick(i);
          return true;
        },
      });
    }
  }

  return chartData;
}

/**
 * @param {ChartPhase[]} phases
 * @returns {PhaseRange[]}
 */
function buildPhaseRanges(phases) {
  const ranges = [];
  let start = 0;
  for (const phase of phases) {
    const duration = Number.parseFloat(/** @type {string} */ (phase.duration));
    ranges.push({ start, end: start + duration });
    start += duration;
  }
  return ranges;
}

/**
 * @param {object} props
 * @param {{ phases?: ChartPhase[] } | null} [props.data] Profile, or the editor's form state
 * @param {string} [props.className]
 * @param {number | null} [props.selectedPhase]
 * @param {((index: number) => void) | null} [props.onPhaseClick]
 * @param {boolean} [props.showPhaseLabels]
 * @param {import('preact').JSX.CSSProperties} [props.style]
 */
export function ExtendedProfileChart({
  data,
  className = 'max-h-36 w-full',
  selectedPhase = null,
  onPhaseClick = null,
  showPhaseLabels = true,
  style,
}) {
  const phases = Array.isArray(data?.phases) ? data.phases : [];
  const phaseRanges = buildPhaseRanges(phases);
  const phaseRangesRef = useRef(phaseRanges);
  phaseRangesRef.current = phaseRanges;
  const config = makeChartData(
    data,
    selectedPhase,
    phaseRanges,
    onPhaseClick,
    isDarkTheme(),
    showPhaseLabels,
  );

  return (
    <ChartComponent
      className='min-h-0 max-w-full shrink grow'
      chartClassName={`${className}${onPhaseClick ? ' cursor-pointer' : ''}`}
      data={config}
      style={style}
    />
  );
}
