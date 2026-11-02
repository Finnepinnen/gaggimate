import PropTypes from 'prop-types';

/**
 * @param {object} props
 * @param {string} [props.mode] Selected mode: cup, automatic or portafilter.
 * @param {boolean} props.cupConfigured
 * @param {boolean} props.portafilterConfigured
 * @param {boolean} [props.automaticAvailable]
 * @param {(mode: string) => void} props.onChange
 * @param {boolean} [props.disabled]
 */
export default function SmartDoseModeSelector({
  mode,
  cupConfigured,
  portafilterConfigured,
  automaticAvailable,
  onChange,
  disabled = false,
}) {
  /** @type {[string, string, boolean | undefined][]} */
  const choices = [
    ['cup', 'Dosing Cup', cupConfigured],
    ['automatic', 'Auto', automaticAvailable],
    ['portafilter', 'Portafilter', portafilterConfigured],
  ];
  return (
    <div className='join inline-flex max-w-full' role='group' aria-label='Dosing mode'>
      {choices.map(([value, label, available]) => (
        <button
          key={value}
          type='button'
          className={`btn btn-sm join-item min-h-11 px-3 text-xs sm:px-4 ${mode === value && available ? 'btn-primary' : 'btn-ghost bg-base-100'}`}
          aria-pressed={mode === value && !!available}
          disabled={disabled || !available}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
SmartDoseModeSelector.propTypes = {
  mode: PropTypes.string,
  cupConfigured: PropTypes.bool,
  portafilterConfigured: PropTypes.bool,
  automaticAvailable: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
