/** @typedef {import('preact').JSX.ButtonHTMLAttributes<HTMLButtonElement>} ButtonProps */

/** @param {ButtonProps} props */
export function PrimaryButton({ children, className = '', ...rest }) {
  return (
    <button type='button' className={`btn btn-primary ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** @param {ButtonProps} props */
export function SecondaryButton({ children, className = '', ...rest }) {
  return (
    <button type='button' className={`btn btn-ghost ${className}`} {...rest}>
      {children}
    </button>
  );
}
