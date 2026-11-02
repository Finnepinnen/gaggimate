import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { STATISTICS_DENSE_VALUE_CLASS, STATISTICS_METRIC_LABEL_CLASS } from './statisticsUi';

/**
 * @param {object} props
 * @param {string} props.accentColor - CSS color
 * @param {import('@fortawesome/fontawesome-svg-core').IconDefinition} props.icon
 * @param {string} props.label
 * @param {string | null} [props.unit]
 * @param {string} props.value - Pre-formatted
 * @param {string} [props.valueClassName]
 */
export function StatisticsMetricHeader({
  accentColor,
  icon,
  label,
  unit = null,
  value,
  valueClassName = 'text-lg leading-none sm:text-xl',
}) {
  return (
    <div className='flex items-center gap-2.5'>
      <div
        className='flex h-10 w-10 shrink-0 items-center justify-center sm:h-11 sm:w-11'
        style={{
          color: accentColor,
        }}
      >
        <FontAwesomeIcon icon={icon} className='text-xl sm:text-[1.35rem]' />
      </div>

      <div className='min-w-0 flex-1'>
        <div className='flex items-baseline gap-1.5'>
          <span className={`truncate ${valueClassName} ${STATISTICS_DENSE_VALUE_CLASS}`}>
            {value}
          </span>
          {unit ? <span className='text-base-content/55 text-xs'>{unit}</span> : null}
        </div>
        <div className={`mt-1 truncate ${STATISTICS_METRIC_LABEL_CLASS}`}>{label}</div>
      </div>
    </div>
  );
}
