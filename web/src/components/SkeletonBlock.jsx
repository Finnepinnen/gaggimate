import PropTypes from 'prop-types';

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {import('preact').JSX.CSSProperties} [props.style]
 */
export function SkeletonBlock({ className = '', style }) {
  return (
    <div
      aria-hidden='true'
      className={className ? `shimmer ${className}` : 'shimmer'}
      style={style}
    />
  );
}

SkeletonBlock.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
};
