import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { faExclamationTriangle, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { getDisplayStopReasonParts, utilityColors } from '../../utils/analyzerUtils';
import { isSafetyExitReason, isWeightType } from '../../services/analyzer/exitReasons.js';

/** @typedef {import('../../types').AnalyzedPhase} AnalyzedPhase */
/** @typedef {import('../../types').ShotAnalysisResult} ShotAnalysisResult */
/** @typedef {import('../../types').PhaseStats} PhaseStats */
/** @typedef {import('../../types').TotalStats} TotalStats */
/** @typedef {import('../../types').MetricStats} MetricStats */
/** @typedef {import('../../types').SysAnomaly} SysAnomaly */
/** @typedef {import('../../utils/columns.js').AnalyzerColumn} AnalyzerColumn */
/** @typedef {import('preact').JSX.CSSProperties} CSSProperties */
/** @typedef {import('preact').JSX.Element} JSXElement */

/**
 * @typedef {object} ResolvedCellValue
 * @property {string | number} mainValue
 * @property {string} unit
 * @property {boolean} isBoolean
 * @property {JSXElement | null} booleanContent
 */

/**
 * @param {object} props
 * @param {AnalyzedPhase | null} props.phase
 * @param {number} [props.phaseIndex]
 * @param {ShotAnalysisResult | null | undefined} props.results
 */
export function ComparePhaseLabel({ phase, results }) {
  if (!phase) {
    return <div className='text-base-content/45 leading-tight font-medium'>-</div>;
  }

  const { skipNotice, stopReason } = getDisplayStopReasonParts(phase.exit?.reason);
  const safetyStop = isSafetyExitReason(phase.exit?.code);

  return (
    <>
      <div className='text-base-content/90 mb-0.5 leading-none font-medium'>
        {phase.displayName}
      </div>
      {skipNotice ? (
        <div
          className='text-base-content/55 leading-tight font-medium'
          style={{ fontSize: '0.8em' }}
        >
          {skipNotice}
        </div>
      ) : null}
      {stopReason ? (
        <div
          className='font-normal'
          style={{
            fontSize: '0.85em',
            color: safetyStop ? utilityColors.warningOrange : utilityColors.stopRed,
          }}
        >
          {stopReason}
        </div>
      ) : null}
      {phase.isFinalExecuted && (
        <div
          className='text-base-content/55 leading-tight font-medium'
          style={{
            fontSize: '0.8em',
            color: results?.completionTone === 'warning' ? utilityColors.warningOrange : undefined,
          }}
        >
          {results?.completionLabel || results?.brewModeLabel}
        </div>
      )}
    </>
  );
}

/** @type {Record<string, { path: 'duration' | 'water' | 'weight', unit: string }>} */
const DIRECT_CELL_FIELDS = {
  duration: { path: 'duration', unit: 's' },
  water: { path: 'water', unit: 'ml' },
  weight: { path: 'weight', unit: 'g' },
};

/** @type {Record<string, string>} */
const CELL_METRIC_UNITS = {
  p: 'bar',
  tp: 'bar',
  f: 'ml/s',
  tf: 'ml/s',
  pf: 'ml/s',
  pr: 's·√bar/mL',
  lr: 'bar·s/mL',
  t: '°C',
  tt: '°C',
  w: 'g',
  wf: 'g/s',
};

/** @type {Record<string, (keyof MetricStats)[]>} */
const CELL_METRIC_PARTS = {
  se: ['start', 'end'],
  mm: ['min', 'max'],
  avg: ['avg'],
};

/** @type {Record<string, import('../../types').SysStatKey>} */
const BOOLEAN_CELL_FIELDS = {
  sys_shot_vol: 'sys_shot_vol',
  sys_curr_vol: 'sys_curr_vol',
  sys_scale: 'sys_scale',
  sys_vol_avail: 'sys_vol_avail',
  sys_ext: 'sys_ext',
};

/** @type {Record<string, { unit: string }>} */
const SYSTEM_VALUE_CELL_FIELDS = {
  sys_brew_mode: { unit: '' },
  sys_recorded_stop_reason: { unit: '' },
  sys_scale_delay: { unit: 'ms' },
};

/**
 * @param {unknown} value
 * @param {number} [digits]
 */
function formatCellNumber(value, digits = 1) {
  const numericValue = Number(value);
  return value != null && Number.isFinite(numericValue) ? numericValue.toFixed(digits) : '-';
}

/** @param {boolean | undefined} value */
function renderCellBoolean(value) {
  if (value === true) {
    return <FontAwesomeIcon icon={faCheck} className='text-success text-[1em]' />;
  }
  if (value === false) {
    return <FontAwesomeIcon icon={faTimes} className='text-error text-[1em]' />;
  }
  return <span className='text-base-content/55 font-medium'>-</span>;
}

/**
 * @param {string} colId
 * @param {unknown} value
 */
function formatSystemCellValue(colId, value) {
  if (colId === 'sys_scale_delay') {
    return formatCellNumber(value, 0);
  }
  if (value == null || value === '') {
    return '-';
  }
  return String(value);
}

/**
 * @param {PhaseStats | undefined} stats
 * @param {string} metricKey
 * @param {string} partKey
 */
function getMetricCellValue(stats, metricKey, partKey) {
  const metric = stats?.[/** @type {import('../../types').MetricStatKey} */ (metricKey)];
  const parts = CELL_METRIC_PARTS[partKey];
  if (!parts) return '-';

  /** @param {keyof MetricStats} part */
  const formatPart = part => {
    const value = metric?.[part];
    return metricKey === 'wf' ? formatCellNumber(Math.max(0, value ?? 0)) : formatCellNumber(value);
  };

  return parts.length === 1
    ? formatPart(parts[0])
    : `${formatPart(parts[0])}/${formatPart(parts[1])}`;
}

/**
 * @param {object} options
 * @param {AnalyzedPhase | TotalStats} options.data
 * @param {PhaseStats | undefined} options.stats
 * @param {AnalyzerColumn} options.col
 * @param {boolean} [options.isSkipped]
 * @returns {ResolvedCellValue}
 */
function resolveCellValue({ data, stats, col, isSkipped = false }) {
  if (
    isSkipped &&
    col.id !== 'sys_raw' &&
    !BOOLEAN_CELL_FIELDS[col.id] &&
    !SYSTEM_VALUE_CELL_FIELDS[col.id]
  ) {
    const metricMatch = /^([a-z]+)_(se|mm|avg)$/.exec(col.id);
    return {
      mainValue: '-',
      unit: metricMatch
        ? CELL_METRIC_UNITS[metricMatch[1]] || ''
        : DIRECT_CELL_FIELDS[col.id]?.unit || '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const directField = DIRECT_CELL_FIELDS[col.id];
  if (directField) {
    return {
      mainValue: formatCellNumber(data?.[directField.path]),
      unit: directField.unit,
      isBoolean: false,
      booleanContent: null,
    };
  }

  if (col.id === 'sys_raw') {
    return {
      mainValue: stats?.sys_raw ?? '-',
      unit: '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const systemValueField = SYSTEM_VALUE_CELL_FIELDS[col.id];
  if (systemValueField) {
    const value = stats?.[/** @type {keyof PhaseStats} */ (col.id)];
    return {
      mainValue: formatSystemCellValue(col.id, value),
      unit: systemValueField.unit,
      isBoolean: false,
      booleanContent: null,
    };
  }

  const booleanField = BOOLEAN_CELL_FIELDS[col.id];
  if (booleanField) {
    return {
      mainValue: '-',
      unit: '',
      isBoolean: true,
      booleanContent: renderCellBoolean(stats?.[booleanField]),
    };
  }

  const metricMatch = /^([a-z]+)_(se|mm|avg)$/.exec(col.id);
  if (!metricMatch) {
    return {
      mainValue: '-',
      unit: '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const [, metricKey, partKey] = metricMatch;
  return {
    mainValue: getMetricCellValue(stats, metricKey, partKey),
    unit: CELL_METRIC_UNITS[metricKey] || '',
    isBoolean: false,
    booleanContent: null,
  };
}

/**
 * @param {object} props
 * @param {number} props.targetVal
 * @param {string} props.unit
 * @param {CSSProperties} props.subTextSize
 */
function TargetDeltaDisplay({ targetVal, unit, subTextSize }) {
  return (
    <div
      style={subTextSize}
      className='text-base-content/55 mt-0.5 leading-tight font-medium tracking-normal whitespace-nowrap italic'
    >
      Target {targetVal} {unit}
    </div>
  );
}

/**
 * @param {AnalyzedPhase | null} phase
 * @param {AnalyzerColumn} col
 */
function findPhaseTarget(phase, col) {
  const targets = Array.isArray(phase?.profilePhase?.targets) ? phase.profilePhase.targets : [];
  return targets.find(target => {
    if (col.id === 'weight') return isWeightType(target.type);
    return target.type === col.targetType;
  });
}

/**
 * @param {object} options
 * @param {AnalyzedPhase | null} options.phase
 * @param {AnalyzerColumn} options.col
 * @param {string} options.unit
 * @param {CSSProperties} options.subTextSize
 */
function getTargetDisplay({ phase, col, unit, subTextSize }) {
  if (col.id === 'duration' && phase?.profilePhase?.duration > 0) {
    return (
      <TargetDeltaDisplay
        targetVal={phase.profilePhase.duration}
        unit={unit}
        subTextSize={subTextSize}
      />
    );
  }

  if (!col.targetType) return null;

  const target = findPhaseTarget(phase, col);
  if (!target) return null;

  return <TargetDeltaDisplay targetVal={target.value} unit={unit} subTextSize={subTextSize} />;
}

/**
 * @param {AnalyzedPhase | null} phase
 * @param {AnalyzerColumn} col
 */
function getTargetCalcEntry(phase, col) {
  if (!col.targetType || !phase?.targetCalcValues) return null;
  return col.id === 'weight'
    ? phase.targetCalcValues.volumetric ||
        phase.targetCalcValues.weight ||
        phase.targetCalcValues.ratio
    : phase.targetCalcValues[col.targetType];
}

/**
 * @param {object} options
 * @param {string | number} options.mainValue
 * @param {{ value: number, isStopReason: boolean } | null | undefined} options.calcEntry
 * @param {AnalyzerColumn} options.col
 */
function replaceCellValueWithCalc({ mainValue, calcEntry, col }) {
  if (!calcEntry) return mainValue;

  const calcValue = formatCellNumber(calcEntry.value);
  if (
    typeof mainValue === 'string' &&
    mainValue.includes('/') &&
    (col.type === 'se' || col.type === 'mm')
  ) {
    const parts = mainValue.split('/');
    return `${parts.slice(0, -1).join('/')}/${calcValue}`;
  }

  return calcValue;
}

/**
 * @param {object} options
 * @param {AnalyzedPhase} options.phase
 * @param {boolean} options.isWeightCol
 * @param {CSSProperties} options.subTextSize
 * @returns {JSXElement[]}
 */
function getWeightWarnings({ phase, isWeightCol, subTextSize }) {
  if (!isWeightCol) return [];

  /** @type {JSXElement[]} */
  const warnings = [];
  if (phase.scaleLost) {
    warnings.push(
      <div
        key='scale-lost-warning'
        style={{ ...subTextSize, color: utilityColors.warningOrange }}
        className='mt-0.5 flex items-center justify-end gap-1 font-bold'
      >
        <FontAwesomeIcon icon={faExclamationTriangle} />
        <span>
          <Trans>Scale Lost</Trans>
        </span>
      </div>,
    );
  }

  if (phase.highScaleDelay) {
    warnings.push(
      <div
        key='high-scale-delay-warning'
        style={{ ...subTextSize, color: utilityColors.warningOrange }}
        className='mt-0.5 flex items-center justify-end gap-1 font-bold'
      >
        <FontAwesomeIcon icon={faExclamationTriangle} />
        <span>
          <Trans>High Scale Delay</Trans>
          {phase.estimatedScaleDelayMs ? ` (${phase.estimatedScaleDelayMs} ms)` : ''}
        </span>
      </div>,
    );
  }

  return warnings;
}

/**
 * @param {ResolvedCellValue & { warning?: boolean }} options
 */
function renderTotalCellContent({ isBoolean, booleanContent, mainValue, unit, warning = false }) {
  if (isBoolean) return <div className='flex justify-end'>{booleanContent}</div>;
  return (
    <span
      className='text-base-content/90 font-medium'
      style={warning ? { color: utilityColors.warningOrange } : undefined}
    >
      {mainValue} {unit}
    </span>
  );
}

/**
 * @param {object} options
 * @param {AnalyzedPhase} options.phase
 * @param {AnalyzerColumn} options.col
 */
function getCellHitState({ phase, col }) {
  if (col.id === 'weight') {
    return isWeightType(phase.exit?.type);
  }
  if (!col.targetType) return false;
  return phase.exit?.type === col.targetType;
}

/**
 * @param {object} options
 * @param {JSXElement | null} options.booleanContent
 * @param {SysAnomaly | null | undefined} options.booleanAnomaly
 * @param {CSSProperties} options.subTextSize
 */
function renderBooleanCellContent({ booleanContent, booleanAnomaly, subTextSize }) {
  const sampleNumber = booleanAnomaly?.sampleInPhase;
  const sampleValue = String(booleanAnomaly?.value);
  return (
    <div className='flex h-full flex-col items-end justify-center pb-1'>
      <div className='flex items-center'>{booleanContent}</div>
      {booleanAnomaly && (
        <div
          style={subTextSize}
          className='text-base-content/55 mt-0.5 flex flex-col items-end leading-tight font-medium tracking-normal'
          title={t`Sample ${sampleNumber}: ${sampleValue}`}
        >
          <span>
            <Trans>Sample {sampleNumber}</Trans>
            {Number.isFinite(booleanAnomaly.sampleCountInPhase)
              ? ` (${booleanAnomaly.sampleCountInPhase})`
              : ''}
          </span>
          <span className='text-base-content/55 font-normal'>{String(booleanAnomaly.value)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * @param {object} options
 * @param {boolean} options.isHit
 * @param {boolean} options.calcIsStopReason
 * @param {string | number} options.mainValue
 * @param {string} options.unit
 * @param {boolean} options.mainValueIsCalculated
 * @param {boolean} [options.warning]
 */
function renderMetricCellValue({
  isHit,
  calcIsStopReason,
  mainValue,
  unit,
  mainValueIsCalculated,
  warning = false,
}) {
  const isStopValue = mainValueIsCalculated ? calcIsStopReason : isHit && !calcIsStopReason;
  /** @type {import('preact').JSX.CSSProperties} */
  let style = {};
  if (warning) {
    style = { color: utilityColors.warningOrange };
  } else if (isStopValue) {
    style = { color: utilityColors.stopRed };
  }

  return (
    <span
      className={isStopValue ? 'font-normal' : 'text-base-content/90 font-medium'}
      style={style}
    >
      {mainValue} {unit}
    </span>
  );
}

/**
 * @param {object} props
 * @param {AnalyzedPhase | null} props.phase
 * @param {AnalyzerColumn} props.col
 * @param {ShotAnalysisResult | null | undefined} props.results
 * @param {boolean} [props.isTotal]
 */
export function CellContent({ phase, col, results, isTotal = false }) {
  const data = isTotal ? results?.total : phase;
  const stats = isTotal ? results?.total : phase?.stats;

  if (!data) return <span>-</span>;

  const { mainValue, unit, isBoolean, booleanContent } = resolveCellValue({
    data,
    stats,
    col,
    isSkipped: Boolean(phase?.skipped),
  });
  const safetyStopReason =
    col.id === 'sys_recorded_stop_reason' &&
    isSafetyExitReason(isTotal ? results?.finalExitReasonCode : phase?.exit?.code);

  if (isTotal) {
    return renderTotalCellContent({
      isBoolean,
      booleanContent,
      mainValue,
      unit,
      warning: safetyStopReason,
    });
  }

  const isWeightCol = col.id === 'weight';
  const isHit = getCellHitState({ phase, col });

  // Keep secondary text proportional to the table text.
  const subTextSize = { fontSize: '0.85em' };
  const booleanAnomaly = isBoolean
    ? stats?.sys_anomalies?.[/** @type {import('../../types').SysStatKey} */ (col.id)]
    : null;
  const calcEntry = getTargetCalcEntry(phase, col);
  const displayMainValue = isBoolean
    ? mainValue
    : replaceCellValueWithCalc({ mainValue, calcEntry, col });
  const mainValueIsCalculated = !isBoolean && Boolean(calcEntry);
  const targetDisplay = getTargetDisplay({
    phase,
    col,
    unit,
    subTextSize,
  });
  const calcIsStopReason = Boolean(calcEntry?.isStopReason);
  const warningDisplays = getWeightWarnings({ phase, isWeightCol, subTextSize });

  return (
    <div className='flex min-h-[2em] flex-col items-end justify-center'>
      {isBoolean
        ? renderBooleanCellContent({ booleanContent, booleanAnomaly, subTextSize })
        : renderMetricCellValue({
            isHit,
            calcIsStopReason,
            mainValue: displayMainValue,
            unit,
            mainValueIsCalculated,
            warning: safetyStopReason,
          })}
      {targetDisplay}
      {warningDisplays}
    </div>
  );
}
