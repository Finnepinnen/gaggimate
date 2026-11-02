import { Trans } from '@lingui/react/macro';

/** @typedef {import('preact').JSX.TargetedPointerEvent<HTMLDivElement>} ScrubberPointerEvent */

/**
 * @param {object} props
 * @param {boolean} [props.active]
 * @param {string} props.ariaLabel
 * @param {{ left: number, right: number }} [props.insets]
 * @param {number} props.max
 * @param {number} [props.min]
 * @param {(event: import('preact').JSX.TargetedEvent<HTMLInputElement, Event>) => void} props.onInput
 * @param {(event: ScrubberPointerEvent) => void} props.onPointerUpdate
 * @param {import('preact').Ref<HTMLDivElement>} props.scrubberRef
 * @param {number} props.value
 * @param {'single' | 'compare'} props.variant
 */
export function MobileChartScrubber({
  active = false,
  ariaLabel,
  insets = { left: 0, right: 0 },
  max,
  min = 0,
  onInput,
  onPointerUpdate,
  scrubberRef,
  value,
  variant,
}) {
  /** @param {ScrubberPointerEvent} event */
  const handlePointerDown = event => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onPointerUpdate(event);
  };

  /** @param {ScrubberPointerEvent} event */
  const handlePointerMove = event => {
    if (event.buttons !== 1 && event.pointerType !== 'touch') return;
    onPointerUpdate(event);
  };

  return (
    <div
      ref={scrubberRef}
      className={`shot-chart-mobile-scrubber shot-chart-mobile-scrubber--${variant} ${
        active ? 'shot-chart-mobile-scrubber--active' : ''
      }`}
      style={{
        marginLeft: `${insets.left}px`,
        marginRight: `${insets.right}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <div className='shot-chart-mobile-scrubber__track' aria-hidden='true' />
      <div className='shot-chart-mobile-scrubber__hint' aria-hidden='true'>
        <Trans>Swipe</Trans>
      </div>
      <input
        type='range'
        min={String(min)}
        // Preact types input `max` as string only; a number renders identically.
        max={/** @type {string} */ (/** @type {unknown} */ (max))}
        step='0.1'
        value={value}
        className='shot-chart-mobile-scrubber__range'
        aria-label={ariaLabel}
        onInput={onInput}
      />
    </div>
  );
}
