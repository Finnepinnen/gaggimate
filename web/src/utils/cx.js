/**
 * Joins class names, skipping falsy values.
 *
 * @param {...(string | false | null | undefined)} classes
 * @returns {string}
 */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}
