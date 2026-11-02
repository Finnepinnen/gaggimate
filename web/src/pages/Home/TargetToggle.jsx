import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { Trans } from '@lingui/react/macro';

/**
 * @param {object} props
 * @param {0 | 1} props.value 0 = time, 1 = weight
 * @param {(value: 0 | 1) => void} props.onChange
 */
const TargetToggle = ({ value, onChange }) => {
  /** @param {boolean} on */
  const pill = on =>
    `flex flex-row cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 py-1 text-xs transition-all duration-200 px-8 ${on ? 'bg-primary text-primary-content font-medium' : 'text-base-content/60 hover:text-base-content'}`;
  return (
    <div className='bg-base-200/70 flex min-w-0 rounded-full p-1'>
      <button className={pill(value === 0)} onClick={() => onChange(0)}>
        <FontAwesomeIcon icon={faClock} className='text-[0.65rem]' />{' '}
        <span>
          <Trans context='brew target'>Time</Trans>
        </span>
      </button>
      <button className={pill(value === 1)} onClick={() => onChange(1)}>
        <FontAwesomeIcon icon={faWeightScale} className='text-[0.65rem]' />{' '}
        <span>
          <Trans context='brew target'>Weight</Trans>
        </span>
      </button>
    </div>
  );
};

export default TargetToggle;
