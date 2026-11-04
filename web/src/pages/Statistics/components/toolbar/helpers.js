// Pure helper functions for StatisticsToolbar: label formatting and source label construction
import { DATE_ONLY_PATTERN, DATE_TIME_PATTERN } from './constants';
import { plural, t } from '@lingui/core/macro';

/**
 * @typedef {import('../../types').StatisticsQueryIssue} StatisticsQueryIssue
 * @typedef {{ label: string, fromText: string, toText: string, isAuto: boolean }} DateRangeDisplay
 */

/**
 * @template {string | number | null | undefined} V
 * @param {V} value - `YYYY-MM-DD`, `YYYY-MM-DDTHH:MM`, or epoch ms
 * @returns {string | V} The input unchanged when it can't be parsed
 */
export function formatToolbarDateTimeDisplay(value) {
  if (!value) return '';
  const valueText = String(value);
  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(valueText);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}.${month}.${year}`;
  }
  const match = DATE_TIME_PATTERN.exec(valueText);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return `${day}.${month}.${year}, ${hour}:${minute}`;
  }
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return value;
  try {
    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return value;
  }
}

/**
 * @param {object} args
 * @param {string} args.dateFromLocal
 * @param {string} args.dateToLocal
 * @param {string} args.dateFromPreviewLocal
 * @param {string} args.dateToPreviewLocal
 * @returns {DateRangeDisplay}
 */
export function getDateRangeDisplay({
  dateFromLocal,
  dateToLocal,
  dateFromPreviewLocal,
  dateToPreviewLocal,
}) {
  const hasManualDateFilter = Boolean(dateFromLocal || dateToLocal);
  const fromValue = hasManualDateFilter ? dateFromLocal : dateFromPreviewLocal;
  const toValue = hasManualDateFilter ? dateToLocal : dateToPreviewLocal;
  const fromText = formatToolbarDateTimeDisplay(fromValue);
  const toText = formatToolbarDateTimeDisplay(toValue);

  if (hasManualDateFilter) {
    if (fromText && toText) {
      return { label: t`Date Range`, fromText, toText, isAuto: false };
    }
    if (fromText) {
      return {
        label: t({ message: 'From', context: 'date range start' }),
        fromText,
        toText: '',
        isAuto: false,
      };
    }
    if (toText) {
      return {
        label: t({ message: 'To', context: 'date range end' }),
        fromText: '',
        toText,
        isAuto: false,
      };
    }
    return { label: t`Date Range`, fromText: t`No dates`, toText: '', isAuto: false };
  }

  if (fromText || toText) {
    return { label: t`Auto Range`, fromText: fromText || t`No date`, toText, isAuto: true };
  }

  return { label: t`Auto Range`, fromText: t`No dates`, toText: '', isAuto: true };
}

/** @param {unknown} value */
function toCount(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

/** @param {unknown} value */
export function formatShotCountLabel(value) {
  return plural(toCount(value), { one: '# shot', other: '# shots' });
}

/** @param {unknown} value */
export function formatProfileCountLabel(value) {
  return plural(toCount(value), { one: '# profile', other: '# profiles' });
}

/**
 * @param {number | null} startValue - epoch ms
 * @param {number | null} endValue - epoch ms
 */
export function formatCollapsedDateRangeText(startValue, endValue) {
  const fromText = formatToolbarDateTimeDisplay(startValue) || t`No dates`;
  const toText = formatToolbarDateTimeDisplay(endValue) || '';
  return toText ? `${fromText} - ${toText}` : fromText;
}

/**
 * @param {{ metadataLoading: boolean, candidateCount: number | null }} args
 */
export function getCandidateSummary({ metadataLoading, candidateCount }) {
  if (metadataLoading) {
    return {
      candidateLabel: '...',
      resetAriaCount: t`loading candidates`,
    };
  }

  if (candidateCount !== null && Number.isFinite(candidateCount)) {
    return {
      candidateLabel: String(candidateCount),
      resetAriaCount: plural(candidateCount, { one: '# candidate', other: '# candidates' }),
    };
  }

  return {
    candidateLabel: '-',
    resetAriaCount: t`unknown candidates`,
  };
}

/**
 * @param {object} args
 * @param {StatisticsQueryIssue[]} args.parseErrors
 * @param {StatisticsQueryIssue[]} args.parseWarnings
 * @param {string | null} args.metadataError
 */
export function getToolbarMessages({ parseErrors, parseWarnings, metadataError }) {
  const topError = parseErrors[0]?.message || null;
  const topWarning = topError ? null : parseWarnings[0]?.message || null;
  const noticeMessage = topError || metadataError || topWarning || null;
  const noticeTone = /** @type {'error' | 'warning'} */ (topError ? 'error' : 'warning');

  return {
    topError,
    topWarning,
    noticeMessage,
    noticeTone,
  };
}

/** @param {import('../../types').DateBasisMode} value */
export function getDateBasisOptionTitle(value) {
  if (value === 'shot') return t`Use shot timestamp only`;
  if (value === 'auto') return t`Use shot timestamp, fallback to upload time`;
  return t`Use upload time only`;
}

/** @param {Element} target */
export function closeParentDetails(target) {
  const details = target.closest('details');
  if (details) details.open = false;
}

/** @param {Element} toolbarNode */
export function closeOpenToolbarDetails(toolbarNode) {
  /** @type {NodeListOf<HTMLDetailsElement>} */ (
    toolbarNode.querySelectorAll('details[open]')
  ).forEach(detailsNode => {
    detailsNode.open = false;
  });
}

/** @param {EventTarget | null} target */
export function isToolbarFloatingPanelTarget(target) {
  return target instanceof Element && target.closest('[data-statistics-toolbar-floating-panel]');
}
