// Constants for StatisticsToolbar: source/mode/date options, warning styles and date patterns
import { msg } from '@lingui/core/macro';

/**
 * @template {string} V
 * @typedef {{ value: V, label: import('@lingui/core').MessageDescriptor }} ToolbarOption
 */

export const SOURCE_OPTIONS = [
  { value: /** @type {const} */ ('gaggimate'), label: 'GM' },
  {
    value: /** @type {const} */ ('browser'),
    label: msg({ message: 'WEB', context: 'shot source: browser storage' }),
  },
  {
    value: /** @type {const} */ ('both'),
    label: msg({ message: 'ALL', context: 'shot source: all sources' }),
  },
];

/** @type {ToolbarOption<import('../../types').StatisticsMode>[]} */
export const MODE_OPTIONS = [
  { value: 'all', label: msg({ message: 'All', context: 'statistics mode' }) },
  { value: 'profile', label: msg`By Profile` },
  { value: 'shots', label: msg`By Shots` },
];

/** @type {ToolbarOption<import('../../types').DateBasisMode>[]} */
export const DATE_BASIS_OPTIONS = [
  { value: 'shot', label: msg({ message: 'Shot', context: 'date basis' }) },
  { value: 'auto', label: msg({ message: 'Auto', context: 'date basis' }) },
  { value: 'upload', label: msg({ message: 'Upload', context: 'date basis' }) },
];

export const WARNING_ORANGE_TEXT_STYLE = { color: 'var(--analyzer-warning-orange)' };

export const WARNING_ORANGE_TEXT_MUTED_STYLE = {
  color: 'color-mix(in srgb, var(--analyzer-warning-orange) 70%, var(--color-base-content) 30%)',
};

export const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
