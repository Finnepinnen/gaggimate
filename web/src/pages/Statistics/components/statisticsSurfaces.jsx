import { cx } from '../../../utils/cx.js';

const DROPDOWN_SURFACE_STYLE = {
  backgroundColor: 'color-mix(in srgb, var(--color-base-100) 97%, transparent)',
  backdropFilter: 'blur(16px) saturate(1.08)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.08)',
};

/**
 * Card surface for a Statistics section.
 *
 * @param {object} props
 * @param {string} [props.className]
 * @param {import('preact').ComponentChildren} [props.children]
 */
export function StatisticsPanel({ className, children }) {
  return <div className={cx('app-card-surface rounded-xl', className)}>{children}</div>;
}

/**
 * Frosted floating panel used by Statistics dropdowns and popovers.
 * Extra props (data attributes, etc.) are passed to the panel element.
 *
 * @param {object} props
 * @param {string} [props.className]
 * @param {import('preact').JSX.CSSProperties} [props.style] - Merged over the surface style
 * @param {import('preact').Ref<HTMLDivElement>} [props.panelRef]
 * @param {import('preact').ComponentChildren} [props.children]
 */
export function DropdownPanel({ className, style, panelRef, children, ...rest }) {
  return (
    <div
      {...rest}
      ref={panelRef}
      className={cx(
        'border-base-content/12 pointer-events-auto isolate z-[150] overflow-hidden rounded-xl border shadow-2xl',
        className,
      )}
      style={{ ...DROPDOWN_SURFACE_STYLE, ...style }}
    >
      {children}
    </div>
  );
}
