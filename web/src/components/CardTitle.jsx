/**
 * @param {object} props
 * @param {import('preact').ComponentChildren} [props.children]
 * @param {string} [props.className]
 */
export function CardTitle({ children, className = '' }) {
  return (
    <h3
      className={`text-base-content/55 text-[10px] leading-tight font-semibold ${className}`.trim()}
    >
      {children}
    </h3>
  );
}
