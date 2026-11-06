import { getShotDisplayName, getShotIdentityKey } from '../utils/analyzerUtils';
import { buildStatisticsProfileHref } from '../../Statistics/utils/statisticsRoute';
import { buildShotDetailsEntries, getCompareDetailsKey } from './ActiveAnalysisView';

/** @typedef {import('../types').AnalysisCompareEntry} AnalysisCompareEntry */
/** @typedef {import('../types').AnalyzerProfile} AnalyzerProfile */
/** @typedef {import('../types').AnalyzerShot} AnalyzerShot */
/** @typedef {import('../types').CompareResultEntry} CompareResultEntry */
/** @typedef {import('../types').CompareShotEntry} CompareShotEntry */
/** @typedef {import('../types').PendingShotSelection} PendingShotSelection */
/** @typedef {import('../types').ShotAnalysisResult} ShotAnalysisResult */

/**
 * Builds the derived chart, compare, details, and statistics navigation state.
 * @param {object} options
 * @param {ShotAnalysisResult | null} options.analysisResults
 * @param {boolean} options.compareMode
 * @param {string[]} options.comparePendingKeys
 * @param {CompareResultEntry[]} options.compareResults
 * @param {CompareShotEntry[]} options.compareShots
 * @param {AnalyzerProfile | null} options.currentProfile
 * @param {string} options.currentProfileName
 * @param {AnalyzerShot | null} options.currentShot
 * @param {string} options.currentShotName
 * @param {PendingShotSelection | null} options.pendingCompareSelection
 * @param {PendingShotSelection | null} options.pendingPrimarySelection
 */
export function buildShotAnalyzerViewModel({
  analysisResults,
  compareMode,
  comparePendingKeys,
  compareResults,
  compareShots,
  currentProfile,
  currentProfileName,
  currentShot,
  currentShotName,
  pendingCompareSelection,
  pendingPrimarySelection,
}) {
  const displayCurrentShot = pendingPrimarySelection?.shot || currentShot;
  const statsHref = buildStatisticsProfileHref({
    source: currentProfile?.source,
    profileName: currentProfileName,
  });

  const currentShotKey = currentShot ? getShotIdentityKey(currentShot) : '';
  const displayCurrentShotKey = displayCurrentShot ? getShotIdentityKey(displayCurrentShot) : '';
  const compareSelectionKeys = new Set(comparePendingKeys);
  compareShots.forEach(entry => compareSelectionKeys.add(entry.key));
  if (compareMode && displayCurrentShotKey) compareSelectionKeys.add(displayCurrentShotKey);

  const compareSelectedCount = compareSelectionKeys.size;
  const compareHasSecondaryShot = compareShots.length > 0 || Boolean(pendingCompareSelection);
  const compareSecondaryShot = compareShots[0] || null;
  const displayCompareSecondaryShot =
    pendingCompareSelection?.shot || compareSecondaryShot?.shot || null;
  const displayCompareSecondaryShotKey = displayCompareSecondaryShot
    ? getShotIdentityKey(displayCompareSecondaryShot)
    : '';
  const compareSecondaryProfile = compareSecondaryShot?.profile || null;
  const compareSecondaryStatsHref = buildStatisticsProfileHref({
    source: compareSecondaryProfile?.source,
    profileName: compareSecondaryShot?.profileName,
  });
  /** @type {AnalysisCompareEntry | null} */
  const referenceCompareEntry =
    currentShot && analysisResults
      ? {
          key: currentShotKey,
          shot: currentShot,
          shotName: currentShotName,
          label: getShotDisplayName(currentShot),
          profile: currentProfile,
          profileName: currentProfileName,
          results: analysisResults,
          isReference: true,
        }
      : null;
  const compareEntryByKey = new Map(compareResults.map(entry => [entry.key, entry.results]));
  /** @type {AnalysisCompareEntry[]} */
  const compareCollection = referenceCompareEntry
    ? [
        referenceCompareEntry,
        ...compareShots
          .map(entry => ({
            key: entry.key,
            shot: entry.shot,
            shotName: entry.shotName,
            label: getShotDisplayName(entry.shot),
            profile: entry.profile,
            profileName: entry.profileName,
            results: compareEntryByKey.get(entry.key) || null,
            isReference: false,
          }))
          .filter(entry => entry.results),
      ]
    : [];
  const compareCollectionWithAccents = compareCollection.map((entry, index) => ({
    ...entry,
    accentColor: 'var(--color-primary)',
    accentStrength: index === 0 ? 1 : 0.7,
  }));
  const isCompareActive =
    compareMode && compareHasSecondaryShot && compareCollectionWithAccents.length > 1;
  const shotDetailsEntries = buildShotDetailsEntries({
    isCompareActive,
    compareCollectionWithAccents,
    referenceCompareEntry,
  });
  const chartMountKey = [
    isCompareActive ? 'compare' : 'single',
    currentShot?.storageKey || currentShot?.id || currentShotName || 'shot',
  ].join(':');
  const compareDetailsKey = getCompareDetailsKey(isCompareActive, shotDetailsEntries);

  return {
    chartMountKey,
    compareCollectionWithAccents,
    compareDetailsKey,
    compareHasSecondaryShot,
    compareSecondaryProfile,
    compareSecondaryShot,
    compareSecondaryStatsHref,
    compareSelectedCount,
    compareSelectionKeys,
    displayCompareSecondaryShotKey,
    isCompareActive,
    shotDetailsEntries,
    statsHref,
  };
}

/**
 * @param {object} options
 * @param {{
 *   shotSource?: string,
 *   profileSource?: string,
 *   profileName?: string,
 *   preferredDetailSection?: string | null,
 * }} [options.context]
 * @param {AnalyzerProfile | null} options.currentProfile
 * @param {string} options.currentProfileName
 * @param {AnalyzerShot | null} options.currentShot
 */
export function persistStatisticsInitialContext({
  context = {},
  currentProfile,
  currentProfileName,
  currentShot,
}) {
  const {
    shotSource = currentShot?.source || 'both',
    profileSource = currentProfile?.source || 'both',
    profileName = currentProfileName,
    preferredDetailSection = null,
  } = context;
  /** @type {{ profileName: string, shotSource: string, profileSource: string, source: string, preferredDetailSection?: string }} */
  const statsInitialContext = {
    profileName,
    shotSource,
    profileSource,
    source: profileSource,
  };
  if (preferredDetailSection) {
    statsInitialContext.preferredDetailSection = preferredDetailSection;
  }
  try {
    sessionStorage.setItem('statsInitialContext', JSON.stringify(statsInitialContext));
  } catch (error) {
    // Blocked storage: Statistics then just opens without the preselection.
    console.warn('Failed to store statistics context:', error);
  }
}
