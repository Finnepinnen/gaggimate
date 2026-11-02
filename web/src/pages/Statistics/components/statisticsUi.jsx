import { cx } from '../../../utils/cx.js';

/** @typedef {{ className?: string, children?: import('preact').ComponentChildren }} TextProps */

/** @param {TextProps} props */
export function SectionTitle({ className, children }) {
  return (
    <h3 className={cx('text-base-content px-1 text-base leading-tight font-semibold', className)}>
      {children}
    </h3>
  );
}

/** @param {TextProps} props */
export function CardHeading({ className, children }) {
  return (
    <span
      className={cx('text-base-content text-[0.6875rem] leading-[1.2] font-semibold', className)}
    >
      {children}
    </span>
  );
}

/** @param {TextProps} props */
export function MetricLabel({ className, children }) {
  return (
    <div
      className={cx('text-base-content/55 text-[0.6875rem] leading-[1.2] font-medium', className)}
    >
      {children}
    </div>
  );
}

/** @param {TextProps} props */
export function SmallLabel({ className, children }) {
  return (
    <div className={cx('text-base-content/60 text-xs leading-tight font-normal', className)}>
      {children}
    </div>
  );
}

/**
 * Tabular-figure number, inline by default.
 *
 * @param {TextProps & { as?: 'span' | 'div', style?: import('preact').JSX.CSSProperties }} props
 */
export function DenseValue({ as: Tag = 'span', className, style, children }) {
  return (
    <Tag className={cx('font-normal tabular-nums', className)} style={style}>
      {children}
    </Tag>
  );
}

/** @param {TextProps & { style?: import('preact').JSX.CSSProperties }} props */
export function NumberCell({ className, style, children }) {
  return (
    <td className={cx('text-right tabular-nums', className)} style={style}>
      {children}
    </td>
  );
}
