// Firmware versions come from `git describe`: "v1.9.0" for a release, "v1.9.0-82-gad2cb603[-dirty]" for a nightly.
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-(\d+)-g[0-9a-f]+)?/i;

/**
 * @param {string | null | undefined} version
 * @returns {{ major: number, minor: number, patch: number, nightly: boolean } | null}
 */
export function parseFirmwareVersion(version) {
  const match = VERSION_PATTERN.exec(version ?? '');
  if (!match) return null;
  const [, major, minor, patch, commits] = match;
  return { major: +major, minor: +minor, patch: +patch, nightly: commits !== undefined };
}

// The app needs 1.10.0+, or a nightly built on top of 1.9.x; null when the version is unknown.
/**
 * @param {string | null | undefined} version
 * @returns {boolean | null}
 */
export function isFirmwareSupported(version) {
  const v = parseFirmwareVersion(version);
  if (!v) return null;
  /**
   * @param {number} major
   * @param {number} minor
   */
  const at = (major, minor) => v.major > major || (v.major === major && v.minor >= minor);
  return at(1, 10) || (at(1, 9) && v.nightly);
}
