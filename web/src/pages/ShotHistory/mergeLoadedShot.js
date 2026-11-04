/** @typedef {import('../../types').Shot} Shot */
/** @typedef {import('../../types').ShotLog} ShotLog */

/**
 * Merges a freshly parsed .slog into its history list entry. Index metadata wins over the
 * shot file, which carries no rating.
 * @param {Shot} entry
 * @param {ShotLog & Partial<Pick<Shot, 'notes' | 'rating'>>} parsed
 * @returns {Shot}
 */
export function mergeLoadedShot(entry, parsed) {
  return {
    ...entry,
    ...parsed,
    volume: entry.volume ?? parsed.volume,
    rating: entry.rating ?? parsed.rating ?? null,
    incomplete: entry.incomplete ?? parsed.incomplete,
    loaded: true,
  };
}
