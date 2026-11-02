import PropTypes from 'prop-types';
import { useEffect } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTint } from '@fortawesome/free-solid-svg-icons/faTint';
import { Trans, useLingui } from '@lingui/react/macro';

/**
 * @param {object} props
 * @param {string} props.className
 * @param {boolean} props.isFlushing
 * @param {() => void} props.startFlush
 * @param {() => void} props.stopFlush
 */
// Press-and-hold aware: a hold-to-flush (flush duration 0) runs until the pointer or key is released.
export function FlushButton({ className, isFlushing, startFlush, stopFlush }) {
  const { t } = useLingui();
  // The release is caught on the window so it still arrives when the pointer left the button.
  useEffect(() => {
    if (!isFlushing) return undefined;
    window.addEventListener('pointerup', stopFlush);
    window.addEventListener('pointercancel', stopFlush);
    return () => {
      window.removeEventListener('pointerup', stopFlush);
      window.removeEventListener('pointercancel', stopFlush);
    };
  }, [isFlushing, stopFlush]);

  /** @param {import('preact').JSX.TargetedKeyboardEvent<HTMLButtonElement>} e */
  const onKeyDown = e => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      startFlush();
    }
  };
  /** @param {import('preact').JSX.TargetedKeyboardEvent<HTMLButtonElement>} e */
  const onKeyUp = e => {
    if (e.key === 'Enter' || e.key === ' ') stopFlush();
  };
  return (
    <button
      type='button'
      className={`${className} ${isFlushing ? 'btn-active' : ''}`}
      onPointerDown={startFlush}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      aria-pressed={isFlushing}
      aria-label={t`Flush water`}
    >
      <FontAwesomeIcon icon={faTint} /> <Trans context='action'>Flush</Trans>
    </button>
  );
}

FlushButton.propTypes = {
  className: PropTypes.string.isRequired,
  isFlushing: PropTypes.bool.isRequired,
  startFlush: PropTypes.func.isRequired,
  stopFlush: PropTypes.func.isRequired,
};
