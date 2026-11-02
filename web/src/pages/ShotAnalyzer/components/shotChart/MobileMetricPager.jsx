import { useRef, useState } from 'preact/hooks';
import { useLingui } from '@lingui/react/macro';
import { formatMetricValue } from '../../utils/analyzerUtils';

/**
 * @typedef {object} ChartMetricRow
 * @property {string} [key]
 * @property {string} label
 * @property {number | string | null | undefined} value
 * @property {number} [digits]
 * @property {string} [unit]
 */

/** @typedef {{ key: string }} MetricPage */

/**
 * @param {MetricPage[]} pages
 * @param {string} activePageKey
 * @param {number} direction
 * @returns {string}
 */
function getNextMetricPageKey(pages, activePageKey, direction) {
  if (!Array.isArray(pages) || pages.length === 0) return activePageKey;
  const activeIndex = Math.max(
    0,
    pages.findIndex(page => page.key === activePageKey),
  );
  const nextIndex = Math.min(pages.length - 1, Math.max(0, activeIndex + direction));
  return pages[nextIndex]?.key || activePageKey;
}

/**
 * @param {{ className?: string, row: ChartMetricRow }} props
 */
export function ChartMetricValue({ className = '', row }) {
  return (
    <div className={['shot-chart-value-metric', className].filter(Boolean).join(' ')}>
      <div className='shot-chart-value-metric__value-row'>
        <span className='shot-chart-value-metric__value'>
          {formatMetricValue(row.value, row.digits)}
        </span>
        <span className='shot-chart-value-metric__unit'>{row.unit}</span>
      </div>
      <div className='shot-chart-value-metric__label'>{row.label}</div>
    </div>
  );
}

/**
 * @param {{ row: ChartMetricRow }} props
 */
export function MobileMetricValue({ row }) {
  return <ChartMetricValue className='shot-chart-compare-mobile-metric' row={row} />;
}

/**
 * @param {object} props
 * @param {string | null} [props.ariaLabel]
 * @param {string} [props.className]
 * @param {string} [props.entryClassName]
 * @param {{ key?: string | number | null, rows: ChartMetricRow[] }[]} props.entries
 * @param {import('preact').ComponentChildren} [props.footer]
 */
export function MobileMetricGrid({
  ariaLabel = null,
  className = '',
  entryClassName = '',
  entries,
  footer = null,
}) {
  const { t } = useLingui();
  const hasMetrics = entries.some(entry => entry.rows.length > 0);

  if (!hasMetrics) return null;

  return (
    <div className='shot-chart-tooltip__compact-content shot-chart-tooltip__compact-content--compare-preview'>
      <div
        className={['shot-chart-compare-mobile-metrics', className].filter(Boolean).join(' ')}
        aria-label={ariaLabel || t`Shot metrics`}
      >
        {entries.map(({ key, rows }, index) => (
          <div
            key={key || index}
            className={['shot-chart-compare-mobile-metrics__shot', entryClassName]
              .filter(Boolean)
              .join(' ')}
          >
            {rows.map(row => (
              <MobileMetricValue key={row.key} row={row} />
            ))}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

/**
 * @template {MetricPage} P
 * @param {object} props
 * @param {string} props.activePageKey
 * @param {string} [props.className]
 * @param {(pageKey: string) => void} props.onPageChange
 * @param {P[]} props.pages
 * @param {(page: P) => import('preact').ComponentChildren} props.renderPage
 */
export function MobileMetricPager({
  activePageKey,
  className = '',
  onPageChange,
  pages,
  renderPage,
}) {
  const { t } = useLingui();
  const pointerStartXRef = useRef(/** @type {number | null} */ (null));
  const pointerStartYRef = useRef(/** @type {number | null} */ (null));
  const [dragOffset, setDragOffset] = useState(0);
  const activeIndex = Math.max(
    0,
    pages.findIndex(page => page.key === activePageKey),
  );
  const isDragging = Math.abs(dragOffset) > 0;

  const resetDrag = () => {
    pointerStartXRef.current = null;
    pointerStartYRef.current = null;
    setDragOffset(0);
  };

  /** @param {import('preact').JSX.TargetedPointerEvent<HTMLDivElement>} event */
  const handlePointerMove = event => {
    if (pointerStartXRef.current === null) return;
    if (event.pointerType === 'mouse' && event.buttons !== 1) return;

    const width = event.currentTarget.getBoundingClientRect().width;
    const deltaX = event.clientX - pointerStartXRef.current;
    // Set alongside pointerStartXRef, which was just checked.
    const deltaY = event.clientY - /** @type {number} */ (pointerStartYRef.current);
    // Let vertical page scrolling win once the gesture is clearly not a horizontal page swipe.
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
      setDragOffset(0);
      return;
    }

    const fullPageOffset = Number.isFinite(width) && width > 0 ? width : 320;
    const edgeResistanceOffset = fullPageOffset * 0.32;
    // Edge resistance keeps the pager responsive without implying that another page exists.
    const minOffset = activeIndex < pages.length - 1 ? -fullPageOffset : -edgeResistanceOffset;
    const maxOffset = activeIndex > 0 ? fullPageOffset : edgeResistanceOffset;
    setDragOffset(Math.max(minOffset, Math.min(maxOffset, deltaX)));
  };

  /** @param {import('preact').JSX.TargetedPointerEvent<HTMLDivElement>} event */
  const handlePointerEnd = event => {
    if (pointerStartXRef.current === null) return;
    const deltaX = event.clientX - pointerStartXRef.current;
    // Set alongside pointerStartXRef, which was just checked.
    const deltaY = event.clientY - /** @type {number} */ (pointerStartYRef.current);
    resetDrag();
    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

    const nextPageKey = getNextMetricPageKey(pages, activePageKey, deltaX < 0 ? 1 : -1);
    if (nextPageKey !== activePageKey) onPageChange(nextPageKey);
  };

  return (
    <div
      className={['shot-chart-mobile-metric-pager', className].filter(Boolean).join(' ')}
      onPointerDown={event => {
        pointerStartXRef.current = event.clientX;
        pointerStartYRef.current = event.clientY;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={resetDrag}
      onLostPointerCapture={resetDrag}
    >
      <div className='shot-chart-mobile-metric-pager__viewport'>
        <div
          className={[
            'shot-chart-mobile-metric-pager__track',
            isDragging ? 'shot-chart-mobile-metric-pager__track--dragging' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            transform: `translate3d(calc(${-activeIndex * 100}% + ${dragOffset}px), 0, 0)`,
          }}
        >
          {pages.map(page => (
            <div key={page.key} className='shot-chart-mobile-metric-pager__page'>
              {renderPage(page)}
            </div>
          ))}
        </div>
      </div>
      <div className='shot-chart-mobile-metric-pager__dots' aria-label={t`Metric pages`}>
        {pages.map((page, index) => {
          const pageNumber = index + 1;
          return (
            <button
              type='button'
              key={page.key}
              className={[
                'shot-chart-mobile-metric-pager__dot',
                index === activeIndex ? 'shot-chart-mobile-metric-pager__dot--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                if (page.key !== activePageKey) onPageChange(page.key);
              }}
              onPointerDown={event => {
                event.stopPropagation();
              }}
              aria-label={t`Show metric page ${pageNumber}`}
              aria-current={index === activeIndex ? 'page' : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
