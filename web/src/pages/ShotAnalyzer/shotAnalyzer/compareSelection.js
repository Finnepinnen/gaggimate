/** Coordinates secondary-shot loading, retries, and automatic profile matching. */

import { libraryService } from '../services/LibraryService';
import { cleanName, getShotIdentityKey, getShotStorageKey } from '../utils/analyzerUtils';
import {
  buildShotWithMetadata,
  getNextDirectionalSelection,
  hasLoadedShotPayload,
  loadPreferredAutoMatchedProfile,
} from './shotSelection';

/** @typedef {import('../types').AnalyzerShot} AnalyzerShot */
/** @typedef {import('../types').CompareResultEntry} CompareResultEntry */
/** @typedef {import('../types').CompareShotEntry} CompareShotEntry */
/** @typedef {import('../types').LibrarySource} LibrarySource */
/** @typedef {import('../types').PendingShotSelection} PendingShotSelection */
/** @typedef {import('../types').ShotSelectionRequest} ShotSelectionRequest */
/** @typedef {import('./shotSelection').MatchedProfile} MatchedProfile */
/**
 * @template T
 * @typedef {import('preact/hooks').Dispatch<import('preact/hooks').StateUpdater<T>>} SetState
 */
/**
 * @template T
 * @typedef {{ current: T }} Ref
 */
/**
 * @typedef {{ status: 'loaded' } | { status: 'aborted' } | { status: 'retry', nextRequest: ShotSelectionRequest | null }} CompareLoadResult
 */

/**
 * Every named option the compare helpers below take; each picks the fields it uses.
 * @typedef {object} CompareSelectionOptions
 * @property {ShotSelectionRequest} activeRequest
 * @property {() => void} clearPendingState
 * @property {Ref<number>} compareLoadIdRef
 * @property {Ref<number>} compareSelectionRequestIdRef
 * @property {Ref<AnalyzerShot | null>} currentShotRef
 * @property {LibrarySource} importMode
 * @property {AnalyzerShot} item
 * @property {number} loadId
 * @property {string | number} loadKey
 * @property {Ref<PendingShotSelection | null>} pendingPrimarySelectionRef
 * @property {number} requestId
 * @property {ShotSelectionRequest} selectionRequest
 * @property {SetState<boolean>} setCompareIsSearchingProfile
 * @property {SetState<string[]>} setComparePendingKeys
 * @property {SetState<CompareResultEntry[]>} setCompareResults
 * @property {SetState<CompareShotEntry[]>} setCompareShots
 * @property {SetState<PendingShotSelection | null>} setPendingCompareSelection
 * @property {string} shotKey
 * @property {AnalyzerShot} shotWithMetadata
 * @property {string} targetShotKey
 */

/**
 * @param {Pick<CompareSelectionOptions, 'compareLoadIdRef' | 'setCompareShots' | 'setComparePendingKeys' | 'setCompareResults' | 'setCompareIsSearchingProfile'>} options
 */
export function clearCompareSelectionState({
  compareLoadIdRef,
  setCompareShots,
  setComparePendingKeys,
  setCompareResults,
  setCompareIsSearchingProfile,
}) {
  compareLoadIdRef.current += 1;
  setCompareShots([]);
  setComparePendingKeys([]);
  setCompareResults([]);
  setCompareIsSearchingProfile(false);
}

/**
 * @param {Pick<CompareSelectionOptions, 'shotKey' | 'shotWithMetadata' | 'item' | 'loadKey'>} options
 * @returns {CompareShotEntry}
 */
function createCompareShotEntry({ shotKey, shotWithMetadata, item, loadKey }) {
  const matchedProfileName = shotWithMetadata.profile
    ? cleanName(shotWithMetadata.profile)
    : 'No Profile Loaded';

  return {
    key: shotKey,
    shot: shotWithMetadata,
    shotName: shotWithMetadata.name || item.name || String(loadKey),
    profile: null,
    profileName: matchedProfileName,
    profileSelectionMode: 'none',
  };
}

/**
 * @param {SetState<CompareShotEntry[]>} setCompareShots
 * @param {string} shotKey
 * @param {MatchedProfile} matchedProfile
 */
function applyMatchedCompareProfile(setCompareShots, shotKey, matchedProfile) {
  setCompareShots(currentEntries =>
    currentEntries.map(entry =>
      entry.key === shotKey
        ? {
            ...entry,
            profile: matchedProfile.profile || null,
            profileName: matchedProfile.profileName,
            profileSelectionMode: matchedProfile.profile ? 'auto' : 'none',
          }
        : entry,
    ),
  );
}

/**
 * @param {number} loadId
 * @param {Ref<number>} compareLoadIdRef
 * @returns {boolean}
 */
function isCurrentCompareLoad(loadId, compareLoadIdRef) {
  return loadId === compareLoadIdRef.current;
}

/**
 * @param {Pick<CompareSelectionOptions, 'setPendingCompareSelection' | 'setComparePendingKeys' | 'setCompareIsSearchingProfile'>} options
 */
function clearComparePendingSelectionState({
  setPendingCompareSelection,
  setComparePendingKeys,
  setCompareIsSearchingProfile,
}) {
  setPendingCompareSelection(null);
  setComparePendingKeys([]);
  setCompareIsSearchingProfile(false);
}

/**
 * @param {ShotSelectionRequest} selectionRequest
 * @param {SetState<PendingShotSelection | null>} setPendingCompareSelection
 * @param {SetState<string[]>} setComparePendingKeys
 */
function applyPendingCompareSelectionState(
  selectionRequest,
  setPendingCompareSelection,
  setComparePendingKeys,
) {
  const nextShotKey = getShotIdentityKey(selectionRequest?.item);
  setPendingCompareSelection({
    shot: selectionRequest.item,
    name: selectionRequest.name,
  });
  setComparePendingKeys(nextShotKey ? [nextShotKey] : []);
}

/**
 * @param {ShotSelectionRequest} selectionRequest
 * @param {number} loadId
 * @returns {ShotSelectionRequest | null}
 */
function getDirectionalCompareSelectionRequest(selectionRequest, loadId) {
  const nextSelection = getNextDirectionalSelection(selectionRequest);
  if (!nextSelection) return null;
  return {
    ...nextSelection,
    loadId,
  };
}

/**
 * @param {Ref<PendingShotSelection | null>} pendingPrimarySelectionRef
 * @param {Ref<AnalyzerShot | null>} currentShotRef
 * @returns {string}
 */
function getActivePrimaryShotKey(pendingPrimarySelectionRef, currentShotRef) {
  const activePrimaryShot = pendingPrimarySelectionRef.current?.shot || currentShotRef.current;
  return activePrimaryShot ? getShotIdentityKey(activePrimaryShot) : '';
}

/**
 * @param {Pick<CompareSelectionOptions, 'requestId' | 'compareSelectionRequestIdRef' | 'loadId' | 'compareLoadIdRef'>} options
 * @returns {boolean}
 */
function shouldAbortCompareLoad({
  requestId,
  compareSelectionRequestIdRef,
  loadId,
  compareLoadIdRef,
}) {
  return (
    requestId !== compareSelectionRequestIdRef.current ||
    !isCurrentCompareLoad(loadId, compareLoadIdRef)
  );
}

/**
 * @param {Pick<CompareSelectionOptions, 'selectionRequest' | 'loadId' | 'setPendingCompareSelection' | 'setComparePendingKeys' | 'clearPendingState'>} options
 * @returns {ShotSelectionRequest | null}
 */
function advanceCompareSelectionAfterFailure({
  selectionRequest,
  loadId,
  setPendingCompareSelection,
  setComparePendingKeys,
  clearPendingState,
}) {
  const nextSelection = getDirectionalCompareSelectionRequest(selectionRequest, loadId);
  if (!nextSelection) {
    clearPendingState();
    return null;
  }

  applyPendingCompareSelectionState(
    nextSelection,
    setPendingCompareSelection,
    setComparePendingKeys,
  );
  return nextSelection;
}

/**
 * @param {Pick<CompareSelectionOptions, 'targetShotKey' | 'shotWithMetadata' | 'item' | 'loadKey' | 'setCompareShots' | 'setPendingCompareSelection' | 'setComparePendingKeys'>} options
 */
function commitLoadedCompareSelection({
  targetShotKey,
  shotWithMetadata,
  item,
  loadKey,
  setCompareShots,
  setPendingCompareSelection,
  setComparePendingKeys,
}) {
  setCompareShots([
    createCompareShotEntry({ shotKey: targetShotKey, shotWithMetadata, item, loadKey }),
  ]);
  setPendingCompareSelection(null);
  setComparePendingKeys([]);
}

/**
 * @param {Pick<CompareSelectionOptions, 'requestId' | 'compareSelectionRequestIdRef' | 'item' | 'setCompareIsSearchingProfile'>} options
 */
function finalizeCompareSelectionAttempt({
  requestId,
  compareSelectionRequestIdRef,
  item,
  setCompareIsSearchingProfile,
}) {
  if (requestId === compareSelectionRequestIdRef.current && !item?.profile) {
    setCompareIsSearchingProfile(false);
  }
}

/**
 * @param {Pick<CompareSelectionOptions, 'setPendingCompareSelection' | 'setComparePendingKeys' | 'setCompareIsSearchingProfile'>} options
 * @returns {() => void}
 */
function createComparePendingStateClearer({
  setPendingCompareSelection,
  setComparePendingKeys,
  setCompareIsSearchingProfile,
}) {
  return () =>
    clearComparePendingSelectionState({
      setPendingCompareSelection,
      setComparePendingKeys,
      setCompareIsSearchingProfile,
    });
}

/**
 * @param {Pick<CompareSelectionOptions, 'activeRequest' | 'pendingPrimarySelectionRef' | 'currentShotRef'>} options
 * @returns {{ shouldSkip: boolean, targetShotKey: string }}
 */
function getSkippableCompareSelection({
  activeRequest,
  pendingPrimarySelectionRef,
  currentShotRef,
}) {
  const { item } = activeRequest;
  const targetShotKey = getShotIdentityKey(item);
  const activePrimaryShotKey = getActivePrimaryShotKey(pendingPrimarySelectionRef, currentShotRef);

  return {
    shouldSkip: Boolean(activePrimaryShotKey && targetShotKey === activePrimaryShotKey),
    targetShotKey,
  };
}

/**
 * @param {Pick<CompareSelectionOptions, 'activeRequest' | 'loadId' | 'setPendingCompareSelection' | 'setComparePendingKeys' | 'clearPendingState'>} options
 * @returns {ShotSelectionRequest | null}
 */
function getNextCompareSelection({
  activeRequest,
  loadId,
  setPendingCompareSelection,
  setComparePendingKeys,
  clearPendingState,
}) {
  return advanceCompareSelectionAfterFailure({
    selectionRequest: activeRequest,
    loadId,
    setPendingCompareSelection,
    setComparePendingKeys,
    clearPendingState,
  });
}

/**
 * @param {Pick<CompareSelectionOptions, 'activeRequest' | 'clearPendingState' | 'compareLoadIdRef' | 'compareSelectionRequestIdRef' | 'importMode' | 'requestId' | 'setCompareIsSearchingProfile' | 'setComparePendingKeys' | 'setCompareShots' | 'setPendingCompareSelection' | 'targetShotKey'>} options
 * @returns {Promise<CompareLoadResult>}
 */
async function tryLoadActiveCompareSelection({
  activeRequest,
  clearPendingState,
  compareLoadIdRef,
  compareSelectionRequestIdRef,
  importMode,
  requestId,
  setCompareIsSearchingProfile,
  setComparePendingKeys,
  setCompareShots,
  setPendingCompareSelection,
  targetShotKey,
}) {
  const { item, loadId } = activeRequest;

  try {
    const { shotWithMetadata, loadKey } = await loadCompareShotSelection({ item, importMode });
    if (
      shouldAbortCompareLoad({
        requestId,
        compareSelectionRequestIdRef,
        loadId,
        compareLoadIdRef,
      })
    ) {
      return { status: 'aborted' };
    }

    commitLoadedCompareSelection({
      targetShotKey,
      shotWithMetadata,
      item,
      loadKey,
      setCompareShots,
      setPendingCompareSelection,
      setComparePendingKeys,
    });

    await tryAutoMatchCompareShotProfile({
      loadId,
      compareLoadIdRef,
      shotKey: targetShotKey,
      shotWithMetadata,
      setCompareIsSearchingProfile,
      setCompareShots,
    });

    return { status: 'loaded' };
  } catch (error) {
    if (
      shouldAbortCompareLoad({
        requestId,
        compareSelectionRequestIdRef,
        loadId,
        compareLoadIdRef,
      })
    ) {
      return { status: 'aborted' };
    }

    console.warn('Failed to load compare shot:', error);

    return {
      status: 'retry',
      nextRequest: getNextCompareSelection({
        activeRequest,
        loadId,
        setPendingCompareSelection,
        setComparePendingKeys,
        clearPendingState,
      }),
    };
  } finally {
    finalizeCompareSelectionAttempt({
      requestId,
      compareSelectionRequestIdRef,
      item,
      setCompareIsSearchingProfile,
    });
  }
}

/**
 * Loads the compare shot of `selectionRequest`, advancing through its list snapshot on failure.
 * @param {Pick<CompareSelectionOptions, 'requestId' | 'selectionRequest' | 'importMode' | 'compareSelectionRequestIdRef' | 'compareLoadIdRef' | 'pendingPrimarySelectionRef' | 'currentShotRef' | 'setPendingCompareSelection' | 'setComparePendingKeys' | 'setCompareIsSearchingProfile' | 'setCompareShots'>} options
 * @returns {Promise<boolean>}
 */
export async function executeCompareSelectionLoad({
  requestId,
  selectionRequest,
  importMode,
  compareSelectionRequestIdRef,
  compareLoadIdRef,
  pendingPrimarySelectionRef,
  currentShotRef,
  setPendingCompareSelection,
  setComparePendingKeys,
  setCompareIsSearchingProfile,
  setCompareShots,
}) {
  const clearPendingState = createComparePendingStateClearer({
    setPendingCompareSelection,
    setComparePendingKeys,
    setCompareIsSearchingProfile,
  });

  let activeRequest = selectionRequest;

  while (activeRequest) {
    const { loadId } = activeRequest;
    const { shouldSkip, targetShotKey } = getSkippableCompareSelection({
      activeRequest,
      pendingPrimarySelectionRef,
      currentShotRef,
    });

    if (!targetShotKey) {
      clearPendingState();
      return false;
    }

    if (shouldSkip) {
      activeRequest = getNextCompareSelection({
        activeRequest,
        loadId,
        setPendingCompareSelection,
        setComparePendingKeys,
        clearPendingState,
      });
      if (!activeRequest) return false;
      continue;
    }

    const loadResult = await tryLoadActiveCompareSelection({
      activeRequest,
      clearPendingState,
      compareLoadIdRef,
      compareSelectionRequestIdRef,
      importMode,
      requestId,
      setCompareIsSearchingProfile,
      setComparePendingKeys,
      setCompareShots,
      setPendingCompareSelection,
      targetShotKey,
    });

    if (loadResult.status === 'loaded') return true;
    if (loadResult.status === 'aborted') return false;

    activeRequest = loadResult.nextRequest;
    if (!activeRequest) return false;
  }

  clearPendingState();
  return false;
}

/**
 * @param {Pick<CompareSelectionOptions, 'item' | 'importMode'>} options
 * @returns {Promise<{ loadKey: string | number, shotWithMetadata: AnalyzerShot }>}
 */
async function loadCompareShotSelection({ item, importMode }) {
  const loadKey = getShotStorageKey(item);
  const loadedShot = hasLoadedShotPayload(item)
    ? item
    : await libraryService.loadShot(loadKey, item.source);
  const shotWithMetadata = buildShotWithMetadata({
    item,
    loadedShot,
    importMode,
    loadKey,
  });

  return {
    loadKey,
    shotWithMetadata,
  };
}

/**
 * @param {Pick<CompareSelectionOptions, 'loadId' | 'compareLoadIdRef' | 'shotKey' | 'shotWithMetadata' | 'setCompareIsSearchingProfile' | 'setCompareShots'>} options
 */
async function tryAutoMatchCompareShotProfile({
  loadId,
  compareLoadIdRef,
  shotKey,
  shotWithMetadata,
  setCompareIsSearchingProfile,
  setCompareShots,
}) {
  if (!shotWithMetadata.profile) {
    return;
  }

  try {
    setCompareIsSearchingProfile(true);
    const allProfiles = await libraryService.getAllProfiles('both');
    if (!isCurrentCompareLoad(loadId, compareLoadIdRef)) return;

    const matchedProfile = await loadPreferredAutoMatchedProfile(shotWithMetadata, allProfiles);
    if (!isCurrentCompareLoad(loadId, compareLoadIdRef)) return;

    if (matchedProfile) {
      applyMatchedCompareProfile(setCompareShots, shotKey, matchedProfile);
    }
  } catch (profileError) {
    if (!isCurrentCompareLoad(loadId, compareLoadIdRef)) return;
    console.warn('Compare profile auto-match failed:', profileError);
  } finally {
    if (isCurrentCompareLoad(loadId, compareLoadIdRef)) {
      setCompareIsSearchingProfile(false);
    }
  }
}
