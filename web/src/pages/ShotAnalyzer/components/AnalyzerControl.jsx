/**
 * Shared interactive controls for the Shot Analyzer (also used by Statistics).
 * Keeping the interaction shell in one component helps the table, chart,
 * library and notes controls feel like one system instead of drifting apart.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cx } from '../../../utils/cx.js';

const ICON_TONES = {
  neutral: 'text-base-content/55 hover:text-primary',
  subtle: 'text-base-content/35 hover:text-primary',
  primary: 'text-primary hover:text-primary',
  success: 'text-base-content/35 hover:text-success',
  error: 'text-base-content/35 hover:text-error',
};

const TEXT_TONES = {
  neutral: 'text-base-content/70 hover:text-primary',
  primary: 'text-primary hover:text-primary',
  success: 'text-base-content/55 hover:text-success',
  error: 'text-base-content/55 hover:text-error',
};

const SIZES = {
  // Square icon button in action bars.
  action: 'h-8 w-8 p-0',
  // Short inline control, e.g. selects in chart toolbars.
  compact: 'h-5 min-h-0',
};

/**
 * @typedef {'icon' | 'text' | 'surface'} AnalyzerControlVariant
 * @typedef {'neutral' | 'subtle' | 'primary' | 'success' | 'error'} AnalyzerControlTone
 */

/**
 * Class names for an analyzer control. Prefer `<AnalyzerControl>`; this is for
 * the rare element that can't be rendered through it.
 *
 * @param {object} [options]
 * @param {AnalyzerControlVariant} [options.variant]
 * @param {AnalyzerControlTone} [options.tone]
 * @param {keyof typeof SIZES} [options.size]
 * @param {string} [options.className]
 */
export function analyzerControlClasses({
  variant = 'icon',
  tone = 'neutral',
  size,
  className,
} = {}) {
  if (variant === 'surface') {
    return cx(
      'hover:bg-base-content/5 cursor-pointer rounded-md transition-colors duration-150',
      TEXT_TONES[tone] || TEXT_TONES.neutral,
      size && SIZES[size],
      className,
    );
  }
  return cx(
    variant === 'icon'
      ? 'inline-flex items-center justify-center rounded-md'
      : 'inline-flex items-center rounded-md',
    'hover:bg-base-content/5 cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30',
    variant === 'icon'
      ? ICON_TONES[tone] || ICON_TONES.neutral
      : TEXT_TONES[tone] || TEXT_TONES.neutral,
    size && SIZES[size],
    className,
  );
}

/**
 * An analyzer control. Renders a `<button>` unless `as` says otherwise; every
 * other prop is passed to the element.
 *
 * @param {{
 *   as?: 'button' | 'summary' | 'select' | 'label' | 'div' | 'span' | 'a',
 *   variant?: AnalyzerControlVariant,
 *   tone?: AnalyzerControlTone,
 *   size?: keyof typeof SIZES,
 *   className?: string,
 *   controlRef?: import('preact').Ref<any>,
 *   children?: import('preact').ComponentChildren,
 * } & Record<string, any>} props - `as` picks the element, e.g. 'summary', 'select', 'label'
 */
export function AnalyzerControl({
  as: Tag = 'button',
  variant = 'icon',
  tone = 'neutral',
  size,
  className,
  controlRef,
  children,
  ...rest
}) {
  // Typed loosely: the ref's element type depends on `as`.
  const elementProps = /** @type {Record<string, any>} */ ({ ...rest, ref: controlRef });
  return (
    <Tag {...elementProps} className={analyzerControlClasses({ variant, tone, size, className })}>
      {children}
    </Tag>
  );
}

/**
 * Icon sized for analyzer action buttons.
 *
 * @param {object} props
 * @param {import('@fortawesome/fontawesome-svg-core').IconDefinition} props.icon
 * @param {string} [props.className]
 */
export function AnalyzerActionIcon({ icon, className }) {
  return (
    <FontAwesomeIcon
      icon={icon}
      className={cx('text-sm', className)}
      style={{ width: '14px', height: '14px' }}
    />
  );
}

/**
 * Row of analyzer action buttons.
 *
 * @param {object} props
 * @param {string} [props.className]
 * @param {import('preact').ComponentChildren} [props.children]
 */
export function AnalyzerActionGroup({ className, children }) {
  return <div className={cx('flex items-center gap-1', className)}>{children}</div>;
}
