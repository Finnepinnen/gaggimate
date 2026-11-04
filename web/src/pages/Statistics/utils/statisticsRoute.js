// Shared route helpers keep Analyzer/ProfileList -> Statistics deep links consistent.

/**
 * @typedef {import('../types').StatisticsSource} StatisticsSource
 * @typedef {import('../types').StatisticsSourceSelection} StatisticsSourceSelection
 */

/** @type {StatisticsSource[]} */
export const VALID_STATISTICS_SOURCES = ['gaggimate', 'browser'];
/** @type {string[]} */
export const VALID_STATISTICS_SOURCE_SELECTIONS = ['gaggimate', 'browser', 'both'];

/** @type {Record<string, StatisticsSource>} */
const SOURCE_ALIAS_TO_SOURCE = {
  internal: 'gaggimate',
  gm: 'gaggimate',
  gaggimate: 'gaggimate',
  external: 'browser',
  web: 'browser',
  browser: 'browser',
};

/** @type {Record<string, 'internal' | 'external'>} */
const SOURCE_TO_ALIAS = {
  gaggimate: 'internal',
  browser: 'external',
};

/** @type {Record<string, StatisticsSource>} */
export const STATISTICS_SOURCE_FALLBACK = {
  gaggimate: 'browser',
  browser: 'gaggimate',
};

const INVALID_PROFILE_NAMES = new Set(['no profile loaded']);

/**
 * @param {string | null | undefined} alias
 * @returns {StatisticsSource | null}
 */
export function mapStatisticsSourceAliasToSource(alias) {
  const normalized = String(alias || '')
    .trim()
    .toLowerCase();
  return SOURCE_ALIAS_TO_SOURCE[normalized] || null;
}

/**
 * @param {string | null | undefined} source
 * @returns {'internal' | 'external' | null}
 */
export function mapSourceToStatisticsAlias(source) {
  const normalized = String(source || '')
    .trim()
    .toLowerCase();
  return SOURCE_TO_ALIAS[normalized] || null;
}

/**
 * @template {StatisticsSourceSelection | ''} [F='both']
 * @param {unknown} source
 * @param {F} [fallback]
 * @returns {StatisticsSourceSelection | F}
 */
export function normalizeStatisticsSourceSelection(source, fallback = /** @type {F} */ ('both')) {
  const normalized = String(source || '')
    .trim()
    .toLowerCase();
  return VALID_STATISTICS_SOURCE_SELECTIONS.includes(normalized)
    ? /** @type {StatisticsSourceSelection} */ (normalized)
    : fallback;
}

/**
 * @param {{ source?: string | null, profileName?: string | null }} args
 */
export function buildStatisticsProfileHref({ source, profileName }) {
  const alias = mapSourceToStatisticsAlias(source);
  const trimmedName = String(profileName || '').trim();
  if (!alias || !trimmedName) return '/statistics';
  if (INVALID_PROFILE_NAMES.has(trimmedName.toLowerCase())) return '/statistics';
  return `/statistics/${alias}/${encodeURIComponent(trimmedName)}`;
}

/**
 * @param {Record<string, string> | null | undefined} params
 * @returns {{ source: StatisticsSource, profileName: string } | null}
 */
export function parseStatisticsProfileRouteParams(params) {
  const source = mapStatisticsSourceAliasToSource(params?.sourceAlias);
  const rawProfileParam = params?.profileName;
  if (!source || !rawProfileParam) return null;

  let decodedName = String(rawProfileParam);
  try {
    decodedName = decodeURIComponent(decodedName);
  } catch {
    // Keep the raw segment to avoid breaking the page on malformed URLs.
  }

  decodedName = decodedName.trim();
  if (!decodedName || INVALID_PROFILE_NAMES.has(decodedName.toLowerCase())) return null;

  return {
    source,
    profileName: decodedName,
  };
}
