/** Coordinates analyzer state, loading, matching, and compare workflows. */

import { useState, useEffect, useContext, useRef, useCallback } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { Trans } from '@lingui/react/macro';
import { LibraryPanel } from '../components/LibraryPanel';
import { EmptyState } from '../components/EmptyState.jsx';
import { useAnalyzerMobileSubpageNavigation } from '../components/useAnalyzerMobileSubpageNavigation';
import { libraryService } from '../services/LibraryService';
import { notesService } from '../services/NotesService';
import { ApiServiceContext } from '../../../services/ApiService';
import {
  getDefaultColumns,
  cleanName,
  ANALYZER_DB_KEYS,
  getProfileDisplayLabel,
  getShotDisplayName,
  getShotIdentityKey,
  loadFromStorage,
  normalizeCompareTargetDisplayMode,
  saveToStorage,
} from '../utils/analyzerUtils';
import { ActiveAnalysisView } from './ActiveAnalysisView';
import { clearCompareSelectionState, executeCompareSelectionLoad } from './compareSelection';
import {
  PROFILE_AUTO_MATCH_INITIAL_DELAY_MS,
  PROFILE_AUTO_MATCH_MAX_ATTEMPTS,
  PROFILE_AUTO_MATCH_RETRY_DELAY_MS,
  analyzeShot,
  findPreferredProfileMatch,
  getNextDirectionalSelection,
  getShotSelectionProfileName,
  hasLoadedShotPayload,
  loadPreferredAutoMatchedProfile,
  loadShotSelection,
  normalizeMatchedProfileSource,
  normalizeSelectionRequest,
  shouldAutoScrollAnalyzerOnSelection,
} from './shotSelection';
import {
  buildShotAnalyzerViewModel,
  persistStatisticsInitialContext,
} from './shotAnalyzerViewModel';
import { useDesktopShotDetailsHeight } from './useDesktopShotDetailsHeight';

/** @typedef {import('../types').AnalyzerProfile} AnalyzerProfile */
/** @typedef {import('../types').AnalyzerShot} AnalyzerShot */
/** @typedef {import('../types').CompareResultEntry} CompareResultEntry */
/** @typedef {import('../types').CompareShotEntry} CompareShotEntry */
/** @typedef {import('../types').LibrarySource} LibrarySource */
/** @typedef {import('../types').PendingShotSelection} PendingShotSelection */
/** @typedef {import('../types').ProfileSelectionMode} ProfileSelectionMode */
/** @typedef {import('../types').ShotAnalysisResult} ShotAnalysisResult */
/** @typedef {import('../types').ShotSelectionRequest} ShotSelectionRequest */
/** @typedef {AnalyzerShot | Partial<ShotSelectionRequest>} ShotSelectionInput Bare shot or (partial) selection request */
/** @typedef {{ preserveCompare?: boolean, requestSelectionScroll?: boolean }} PrimaryShotLoadOptions */

export function ShotAnalyzer() {
  const apiService = useContext(ApiServiceContext);
  const { params } = useRoute();
  // --- State ---
  const [currentShot, setCurrentShot] = useState(/** @type {AnalyzerShot | null} */ (null));
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(
    /** @type {AnalyzerProfile | null} */ (null),
  );
  const [currentShotName, setCurrentShotName] = useState('No Shot Loaded');
  const [currentProfileName, setCurrentProfileName] = useState('No Profile Loaded');
  const [currentProfileSelectionMode, setCurrentProfileSelectionMode] = useState(
    /** @type {ProfileSelectionMode} */ ('none'),
  );
  const [pendingPrimarySelection, setPendingPrimarySelection] = useState(
    /** @type {PendingShotSelection | null} */ (null),
  );
  const [pendingCompareSelection, setPendingCompareSelection] = useState(
    /** @type {PendingShotSelection | null} */ (null),
  );

  const [importMode, setImportMode] = useState(/** @type {'temp' | 'browser'} */ ('temp'));

  const [isMatchingProfile, setIsMatchingProfile] = useState(false);
  const [isSearchingProfile, setIsSearchingProfile] = useState(false);

  const [activeColumns, setActiveColumns] = useState(
    /** @returns {Set<string>} */ () => {
      const userStandard = loadFromStorage(ANALYZER_DB_KEYS.USER_STANDARD);
      return userStandard ? new Set(userStandard) : getDefaultColumns();
    },
  );

  const [analysisResults, setAnalysisResults] = useState(
    /** @type {ShotAnalysisResult | null} */ (null),
  );
  const [compareMode, setCompareMode] = useState(false);
  const [compareShots, setCompareShots] = useState(/** @type {CompareShotEntry[]} */ ([]));
  const [comparePendingKeys, setComparePendingKeys] = useState(/** @type {string[]} */ ([]));
  const [compareResults, setCompareResults] = useState(/** @type {CompareResultEntry[]} */ ([]));
  const [compareTargetDisplayMode, setCompareTargetDisplayMode] = useState(() =>
    normalizeCompareTargetDisplayMode(
      loadFromStorage(ANALYZER_DB_KEYS.COMPARE_TARGET_DISPLAY_MODE),
    ),
  );
  const [compareIsSearchingProfile, setCompareIsSearchingProfile] = useState(false);
  const [pendingMobileAnalysisScroll, setPendingMobileAnalysisScroll] = useState(false);
  const [pendingDesktopLibraryScroll, setPendingDesktopLibraryScroll] = useState(false);
  const analysisSectionRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const libraryPanelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const shotDetailsColumnRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const profileMatchIdRef = useRef(0);
  const compareProfileMatchIdRef = useRef(0);
  const analysisIdRef = useRef(0);
  const profileSearchTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const compareLoadIdRef = useRef(0);
  const primarySelectionTimerRef = useRef(
    /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  );
  const compareSelectionTimerRef = useRef(
    /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  );
  const primarySelectionRequestIdRef = useRef(0);
  const compareSelectionRequestIdRef = useRef(0);
  const primarySelectionAbortRef = useRef(
    /** @type {{ requestId: number, controller: AbortController | null } | null} */ (null),
  );
  const handledDeepLinkKeyRef = useRef('');
  const clearPendingPrimarySelectionRef = useRef(/** @type {(() => void) | null} */ (null));
  const handleShotSelectRef = useRef(
    /** @type {((request: ShotSelectionInput) => number | undefined) | null} */ (null),
  );
  const currentShotRef = useRef(currentShot);
  const compareShotsRef = useRef(compareShots);
  const pendingPrimarySelectionRef = useRef(pendingPrimarySelection);
  const pendingCompareSelectionRef = useRef(pendingCompareSelection);

  useEffect(() => {
    currentShotRef.current = currentShot;
  }, [currentShot]);

  useEffect(() => {
    compareShotsRef.current = compareShots;
  }, [compareShots]);

  useEffect(() => {
    pendingPrimarySelectionRef.current = pendingPrimarySelection;
  }, [pendingPrimarySelection]);

  useEffect(() => {
    pendingCompareSelectionRef.current = pendingCompareSelection;
  }, [pendingCompareSelection]);

  const updateCurrentShot = useCallback(
    /** @param {AnalyzerShot | null} nextShot */
    nextShot => {
      currentShotRef.current = nextShot;
      setCurrentShot(nextShot);
    },
    [],
  );

  const updatePendingPrimarySelection = useCallback(
    /** @param {PendingShotSelection | null} nextSelection */
    nextSelection => {
      pendingPrimarySelectionRef.current = nextSelection;
      setPendingPrimarySelection(nextSelection);
    },
    [],
  );

  const clearPrimarySelectionTimer = useCallback(() => {
    if (primarySelectionTimerRef.current) {
      clearTimeout(primarySelectionTimerRef.current);
      primarySelectionTimerRef.current = null;
    }
  }, []);

  const clearCompareSelectionTimer = useCallback(() => {
    if (compareSelectionTimerRef.current) {
      clearTimeout(compareSelectionTimerRef.current);
      compareSelectionTimerRef.current = null;
    }
  }, []);

  const abortPrimarySelectionLoad = useCallback(
    /** @param {number} [requestId] Only abort this request */
    requestId => {
      const activeRequest = primarySelectionAbortRef.current;
      if (!activeRequest) return false;
      if (requestId != null && activeRequest.requestId !== requestId) return false;

      primarySelectionAbortRef.current = null;
      activeRequest.controller?.abort();
      return true;
    },
    [],
  );

  const cancelPrimaryProfileSearch = useCallback(() => {
    if (profileSearchTimerRef.current) {
      clearTimeout(profileSearchTimerRef.current);
      profileSearchTimerRef.current = null;
    }
    profileMatchIdRef.current += 1;
    setIsMatchingProfile(false);
    setIsSearchingProfile(false);
  }, []);

  const cancelCompareProfileSearch = useCallback(() => {
    compareLoadIdRef.current += 1;
    compareProfileMatchIdRef.current += 1;
    setCompareIsSearchingProfile(false);
  }, []);

  const clearPendingPrimarySelection = useCallback(() => {
    clearPrimarySelectionTimer();
    abortPrimarySelectionLoad();
    primarySelectionRequestIdRef.current += 1;
    updatePendingPrimarySelection(null);
    setLoading(false);
  }, [abortPrimarySelectionLoad, clearPrimarySelectionTimer, updatePendingPrimarySelection]);

  const clearPendingCompareSelection = useCallback(() => {
    clearCompareSelectionTimer();
    compareSelectionRequestIdRef.current += 1;
    setPendingCompareSelection(null);
    setComparePendingKeys([]);
    setCompareIsSearchingProfile(false);
  }, [clearCompareSelectionTimer]);

  const resetCompareState = useCallback(
    ({ disableMode = false } = {}) => {
      clearPendingCompareSelection();
      compareLoadIdRef.current += 1;
      setCompareShots([]);
      setComparePendingKeys([]);
      setCompareResults([]);
      setCompareIsSearchingProfile(false);
      if (disableMode) setCompareMode(false);
    },
    [clearPendingCompareSelection],
  );

  /**
   * @param {number} attempt
   * @param {(attempt: number) => void} callback
   * @returns {boolean} Whether a retry was scheduled
   */
  const scheduleProfileAutoMatchRetry = (attempt, callback) => {
    if (attempt + 1 >= PROFILE_AUTO_MATCH_MAX_ATTEMPTS) return false;
    profileSearchTimerRef.current = setTimeout(() => {
      callback(attempt + 1);
    }, PROFILE_AUTO_MATCH_RETRY_DELAY_MS);
    return true;
  };

  // Cleanup pending profile search on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      abortPrimarySelectionLoad();
    };
    globalThis.addEventListener?.('beforeunload', handleBeforeUnload);

    return () => {
      globalThis.removeEventListener?.('beforeunload', handleBeforeUnload);
      primarySelectionRequestIdRef.current += 1;
      abortPrimarySelectionLoad();
      if (profileSearchTimerRef.current) clearTimeout(profileSearchTimerRef.current);
      if (primarySelectionTimerRef.current) clearTimeout(primarySelectionTimerRef.current);
      if (compareSelectionTimerRef.current) clearTimeout(compareSelectionTimerRef.current);
    };
  }, [abortPrimarySelectionLoad]);

  // --- Effects ---
  useEffect(() => {
    if (apiService) {
      libraryService.setApiService(apiService);
      notesService.setApiService(apiService);
    }
  }, [apiService]);

  useEffect(() => {
    saveToStorage(
      ANALYZER_DB_KEYS.COMPARE_TARGET_DISPLAY_MODE,
      normalizeCompareTargetDisplayMode(compareTargetDisplayMode),
    );
  }, [compareTargetDisplayMode]);

  // --- Analysis Logic ---
  const performAnalysis = useCallback(() => {
    if (!currentShot) return;

    try {
      setAnalysisResults(analyzeShot(currentShot, currentProfile));
    } catch (e) {
      console.error('Analysis failed:', e);
      setAnalysisResults(null);
    }
  }, [currentProfile, currentShot]);

  useEffect(() => {
    if (!currentShot) {
      setAnalysisResults(null);
      return;
    }
    const id = ++analysisIdRef.current;
    // Defer analysis to next tick to allow UI update
    setTimeout(() => {
      if (id !== analysisIdRef.current) return; // stale
      performAnalysis();
    }, 0);
  }, [currentShot, currentProfile, performAnalysis]);

  useEffect(() => {
    if (!pendingMobileAnalysisScroll || !currentShot) return;
    if (!globalThis.window) return;

    const timer = globalThis.window.setTimeout(() => {
      analysisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingMobileAnalysisScroll(false);
    }, 90);

    return () => globalThis.window?.clearTimeout(timer);
  }, [pendingMobileAnalysisScroll, currentShot]);

  useEffect(() => {
    if (!pendingDesktopLibraryScroll || !currentShot) return;
    if (!globalThis.window) return;

    const timer = globalThis.window?.setTimeout(() => {
      libraryPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingDesktopLibraryScroll(false);
    }, 350);

    return () => globalThis.window?.clearTimeout(timer);
  }, [pendingDesktopLibraryScroll, currentShot]);

  useEffect(() => {
    if (compareShots.length === 0) {
      setCompareResults([]);
      return;
    }

    const nextResults = compareShots.reduce((acc, entry) => {
      try {
        acc.push({
          key: entry.key,
          results: analyzeShot(entry.shot, entry.profile),
        });
      } catch (error) {
        console.error(`Compare analysis failed for ${entry.key}:`, error);
      }
      return acc;
    }, /** @type {CompareResultEntry[]} */ ([]));

    setCompareResults(nextResults);
  }, [compareShots]);

  // --- Data Handlers ---
  const normalizePrimarySelectionRequest = useCallback(
    /** @param {ShotSelectionInput} request */
    request =>
      normalizeSelectionRequest(request, importMode, {
        preserveCompare: false,
        requestSelectionScroll: false,
      }),
    [importMode],
  );

  const normalizeCompareSelectionRequest = useCallback(
    /** @param {ShotSelectionInput} request */
    request => normalizeSelectionRequest(request, importMode),
    [importMode],
  );

  const commitPrimaryShotLoad = useCallback(
    /**
     * @param {AnalyzerShot} shotData
     * @param {string} name
     * @param {PrimaryShotLoadOptions} [options]
     */
    (shotData, name, { preserveCompare = false, requestSelectionScroll = false } = {}) => {
      const shotWithMetadata = {
        ...shotData,
        source: shotData.source || importMode,
      };
      const nextShotKey = getShotIdentityKey(shotWithMetadata);
      const previousShot = currentShotRef.current;
      const currentShotKey = previousShot ? getShotIdentityKey(previousShot) : '';

      clearPrimarySelectionTimer();
      updatePendingPrimarySelection(null);

      if (!preserveCompare && currentShotKey && nextShotKey && currentShotKey !== nextShotKey) {
        resetCompareState();
      }

      updateCurrentShot(shotWithMetadata);
      setCurrentShotName(name);

      cancelPrimaryProfileSearch();

      // Reset profile for new shot (prevents stale profile from previous shot)
      setCurrentProfile(null);
      setCurrentProfileName(getShotSelectionProfileName(shotWithMetadata));
      setCurrentProfileSelectionMode('none');

      if (shotWithMetadata.profile) {
        const matchId = ++profileMatchIdRef.current;
        setIsMatchingProfile(true);
        setIsSearchingProfile(true);

        const attemptProfileAutoMatch = async (attempt = 0) => {
          profileSearchTimerRef.current = null;
          try {
            const allProfiles = await libraryService.getAllProfiles('both');

            if (matchId !== profileMatchIdRef.current) return; // stale

            if (allProfiles.length === 0) {
              if (scheduleProfileAutoMatchRetry(attempt, attemptProfileAutoMatch)) {
                return;
              }
              return;
            }

            const preferredMatch = findPreferredProfileMatch(
              allProfiles,
              shotWithMetadata.profile,
              shotWithMetadata.source,
              shotWithMetadata.profileId,
            );

            if (!preferredMatch) {
              return;
            }

            const matchedProfile = await loadPreferredAutoMatchedProfile(
              shotWithMetadata,
              allProfiles,
            );

            if (matchId !== profileMatchIdRef.current) return; // stale

            if (matchedProfile) {
              // Keep the matched name visible while searching, but only promote the
              // profile to currentProfile after the full payload has been loaded.
              // This prevents the analyzer from re-running against a partial list item
              // that may not contain the phase data required for profile comparison.
              setCurrentProfile(matchedProfile.profile);
              setCurrentProfileName(matchedProfile.profileName);
              setCurrentProfileSelectionMode('auto');
              return;
            }
          } catch (e) {
            if (matchId !== profileMatchIdRef.current) return;
            if (scheduleProfileAutoMatchRetry(attempt, attemptProfileAutoMatch)) {
              return;
            }
            console.warn('Profile auto-match failed:', e);
          } finally {
            if (matchId === profileMatchIdRef.current && !profileSearchTimerRef.current) {
              setIsMatchingProfile(false);
              setIsSearchingProfile(false);
            }
          }
        };

        // Debounce: wait for rapid navigation to settle before searching
        profileSearchTimerRef.current = setTimeout(() => {
          attemptProfileAutoMatch(0);
        }, PROFILE_AUTO_MATCH_INITIAL_DELAY_MS);
      } else {
        // Shot has no profile field — clear search states immediately
        profileMatchIdRef.current += 1;
        setIsMatchingProfile(false);
        setIsSearchingProfile(false);
      }

      if (requestSelectionScroll) {
        if (shouldAutoScrollAnalyzerOnSelection()) {
          setPendingMobileAnalysisScroll(true);
        } else {
          setPendingDesktopLibraryScroll(true);
        }
      }

      setLoading(false);
    },
    [
      cancelPrimaryProfileSearch,
      clearPrimarySelectionTimer,
      importMode,
      resetCompareState,
      updateCurrentShot,
      updatePendingPrimarySelection,
    ],
  );

  const tryLoadPrimarySelection = useCallback(
    /**
     * @param {number} requestId
     * @param {ShotSelectionRequest} selectionRequest
     * @param {AbortSignal | undefined} signal
     * @returns {Promise<boolean>} Whether a shot was committed
     */
    async (requestId, selectionRequest, signal) => {
      if (requestId !== primarySelectionRequestIdRef.current) return false;

      const { item, name, preserveCompare } = selectionRequest;
      const targetShotKey = getShotIdentityKey(item);
      const activeCompareShot =
        pendingCompareSelectionRef.current?.shot || compareShotsRef.current[0]?.shot || null;
      const activeCompareShotKey = activeCompareShot ? getShotIdentityKey(activeCompareShot) : '';

      if (!targetShotKey) {
        updatePendingPrimarySelection(null);
        setLoading(false);
        return false;
      }

      if (preserveCompare && activeCompareShotKey && targetShotKey === activeCompareShotKey) {
        const nextSelection = getNextDirectionalSelection(selectionRequest);
        if (nextSelection) {
          updatePendingPrimarySelection({
            shot: nextSelection.item,
            name: nextSelection.name,
          });
          return tryLoadPrimarySelection(requestId, nextSelection, signal);
        }

        abortPrimarySelectionLoad(requestId);
        updatePendingPrimarySelection(null);
        setLoading(false);
        return false;
      }

      try {
        setLoading(true);
        const { shotWithMetadata, shotName } = await loadShotSelection({
          item,
          importMode,
          signal,
        });
        if (requestId !== primarySelectionRequestIdRef.current) return false;

        abortPrimarySelectionLoad(requestId);
        commitPrimaryShotLoad(shotWithMetadata, name || shotName, selectionRequest);
        return true;
      } catch (error) {
        if (requestId !== primarySelectionRequestIdRef.current) return false;
        if (error?.name === 'AbortError') {
          abortPrimarySelectionLoad(requestId);
          updatePendingPrimarySelection(null);
          setLoading(false);
          return false;
        }

        console.warn('Failed to load shot:', error);

        const nextSelection = getNextDirectionalSelection(selectionRequest);
        if (nextSelection) {
          updatePendingPrimarySelection({
            shot: nextSelection.item,
            name: nextSelection.name,
          });
          return tryLoadPrimarySelection(requestId, nextSelection, signal);
        }

        abortPrimarySelectionLoad(requestId);
        updatePendingPrimarySelection(null);
        setLoading(false);
        return false;
      }
    },
    [abortPrimarySelectionLoad, commitPrimaryShotLoad, importMode, updatePendingPrimarySelection],
  );

  const launchPrimarySelectionLoad = useCallback(
    /**
     * @param {number} requestId
     * @param {ShotSelectionRequest} selectionRequest
     * @param {AbortSignal | undefined} signal
     */
    (requestId, selectionRequest, signal) => {
      tryLoadPrimarySelection(requestId, selectionRequest, signal).catch(error => {
        console.error('Primary selection load failed:', error);
      });
    },
    [tryLoadPrimarySelection],
  );

  const handleShotSelect = useCallback(
    /**
     * @param {ShotSelectionInput} request
     * @returns {number | undefined} Request id when a load was started
     */
    request => {
      const selectionRequest = normalizePrimarySelectionRequest(request);
      if (!selectionRequest?.item) return;

      const targetShotKey = getShotIdentityKey(selectionRequest.item);
      const currentCommittedShot = currentShotRef.current;
      const currentShotKey = currentCommittedShot ? getShotIdentityKey(currentCommittedShot) : '';

      if (!targetShotKey) return;

      if (targetShotKey === currentShotKey) {
        clearPrimarySelectionTimer();
        abortPrimarySelectionLoad();
        primarySelectionRequestIdRef.current += 1;
        updatePendingPrimarySelection(null);
        setLoading(false);
        return;
      }

      abortPrimarySelectionLoad();
      const requestId = ++primarySelectionRequestIdRef.current;
      clearPrimarySelectionTimer();
      updatePendingPrimarySelection({
        shot: selectionRequest.item,
        name: selectionRequest.name,
      });
      const controller =
        typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
      primarySelectionAbortRef.current = { requestId, controller };
      const signal = controller?.signal;

      if (
        hasLoadedShotPayload(selectionRequest.item) ||
        !currentCommittedShot ||
        selectionRequest.debounceMs <= 0
      ) {
        launchPrimarySelectionLoad(requestId, selectionRequest, signal);
        return requestId;
      }

      primarySelectionTimerRef.current = setTimeout(() => {
        primarySelectionTimerRef.current = null;
        launchPrimarySelectionLoad(requestId, selectionRequest, signal);
      }, selectionRequest.debounceMs);
      return requestId;
    },
    [
      abortPrimarySelectionLoad,
      clearPrimarySelectionTimer,
      launchPrimarySelectionLoad,
      normalizePrimarySelectionRequest,
      updatePendingPrimarySelection,
    ],
  );

  clearPendingPrimarySelectionRef.current = clearPendingPrimarySelection;
  handleShotSelectRef.current = handleShotSelect;

  useEffect(() => {
    if (!params.source || !params.id) {
      handledDeepLinkKeyRef.current = '';
      return undefined;
    }
    if (!apiService) return undefined;

    let serviceSource = params.source;
    if (params.source === 'internal') serviceSource = 'gaggimate';
    if (params.source === 'external') serviceSource = 'browser';

    const deepLinkKey = `${serviceSource}:${params.id}`;
    if (handledDeepLinkKeyRef.current === deepLinkKey) return undefined;
    handledDeepLinkKeyRef.current = deepLinkKey;

    const requestId = handleShotSelectRef.current({
      item: {
        id: params.id,
        source: /** @type {LibrarySource} */ (serviceSource),
      },
      name: params.id,
      debounceMs: 0,
    });

    return () => {
      if (requestId == null || requestId !== primarySelectionRequestIdRef.current) return;
      clearPendingPrimarySelectionRef.current();
    };
  }, [apiService, params.id, params.source]);

  /**
   * @param {AnalyzerProfile} data
   * @param {string} name
   * @param {LibrarySource} source
   */
  const handleProfileLoad = (data, name, source) => {
    cancelPrimaryProfileSearch();
    const nextProfile = normalizeMatchedProfileSource(data, source);
    setCurrentProfile(nextProfile);
    setCurrentProfileName(getProfileDisplayLabel(data, name));
    setCurrentProfileSelectionMode('manual');
  };

  const handleRetryProfileSearch = async () => {
    if (!currentShot?.profile) return;

    cancelPrimaryProfileSearch();

    const shotWithMetadata = currentShot;
    const matchId = ++profileMatchIdRef.current;
    setIsMatchingProfile(true);
    setIsSearchingProfile(true);

    const attemptProfileAutoMatch = async (attempt = 0) => {
      profileSearchTimerRef.current = null;

      try {
        const allProfiles = await libraryService.getAllProfiles('both');

        if (matchId !== profileMatchIdRef.current) return;

        if (allProfiles.length === 0) {
          if (scheduleProfileAutoMatchRetry(attempt, attemptProfileAutoMatch)) {
            return;
          }
          return;
        }

        const preferredMatch = findPreferredProfileMatch(
          allProfiles,
          shotWithMetadata.profile,
          shotWithMetadata.source,
          shotWithMetadata.profileId,
        );

        if (!preferredMatch) {
          return;
        }

        const matchedProfile = await loadPreferredAutoMatchedProfile(shotWithMetadata, allProfiles);

        if (matchId !== profileMatchIdRef.current) return;

        if (matchedProfile) {
          setCurrentProfile(matchedProfile.profile);
          setCurrentProfileName(matchedProfile.profileName);
          setCurrentProfileSelectionMode('auto');
        }
      } catch (error) {
        if (matchId !== profileMatchIdRef.current) return;
        if (scheduleProfileAutoMatchRetry(attempt, attemptProfileAutoMatch)) {
          return;
        }
        console.warn('Profile retry auto-match failed:', error);
      } finally {
        if (matchId === profileMatchIdRef.current && !profileSearchTimerRef.current) {
          setIsMatchingProfile(false);
          setIsSearchingProfile(false);
        }
      }
    };

    attemptProfileAutoMatch(0);
  };

  const handleProfileUnload = useCallback(() => {
    cancelPrimaryProfileSearch();
    setCurrentProfile(null);
    setCurrentProfileName('No Profile Loaded');
    setCurrentProfileSelectionMode('none');
  }, [cancelPrimaryProfileSearch]);

  const handleCompareModeToggle = () => {
    if (compareMode) {
      resetCompareState();
      setCompareMode(false);
      return;
    }

    setCompareMode(true);
  };

  const tryLoadCompareSelection = useCallback(
    /**
     * @param {number} requestId
     * @param {ShotSelectionRequest} selectionRequest
     */
    (requestId, selectionRequest) =>
      executeCompareSelectionLoad({
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
      }),
    [importMode],
  );

  const launchCompareSelectionLoad = useCallback(
    /**
     * @param {number} requestId
     * @param {ShotSelectionRequest} selectionRequest
     */
    (requestId, selectionRequest) => {
      tryLoadCompareSelection(requestId, selectionRequest)
        .then(didLoadCompareShot => {
          if (didLoadCompareShot && shouldAutoScrollAnalyzerOnSelection()) {
            setPendingMobileAnalysisScroll(true);
          }
        })
        .catch(error => {
          console.error('Compare selection load failed:', error);
        });
    },
    [tryLoadCompareSelection],
  );

  const handleCompareShotToggle = useCallback(
    /**
     * @param {ShotSelectionInput} request
     * @param {boolean} checked
     */
    (request, checked) => {
      if (!checked) {
        clearPendingCompareSelection();
        clearCompareSelectionState({
          compareLoadIdRef,
          setCompareShots,
          setComparePendingKeys,
          setCompareResults,
          setCompareIsSearchingProfile,
        });
        return;
      }

      const selectionRequest = normalizeCompareSelectionRequest(request);
      const currentPrimaryShot = pendingPrimarySelectionRef.current?.shot || currentShotRef.current;
      const currentPrimaryShotKey = currentPrimaryShot
        ? getShotIdentityKey(currentPrimaryShot)
        : '';

      if (!selectionRequest?.item || !currentPrimaryShotKey) return;
      if (!compareMode) setCompareMode(true);

      const shotKey = getShotIdentityKey(selectionRequest.item);
      const currentCompareShot =
        pendingCompareSelectionRef.current?.shot || compareShotsRef.current[0]?.shot;
      const currentCompareShotKey = currentCompareShot
        ? getShotIdentityKey(currentCompareShot)
        : '';

      if (!shotKey || shotKey === currentCompareShotKey) return;
      if (shotKey === currentPrimaryShotKey && !selectionRequest.direction) return;

      const requestId = ++compareSelectionRequestIdRef.current;
      const loadId = ++compareLoadIdRef.current;
      clearCompareSelectionTimer();
      setPendingCompareSelection({
        shot: selectionRequest.item,
        name: selectionRequest.name,
      });
      setComparePendingKeys([shotKey]);
      setCompareIsSearchingProfile(false);

      const nextSelectionRequest = {
        ...selectionRequest,
        loadId,
      };

      if (
        hasLoadedShotPayload(selectionRequest.item) ||
        !compareShotsRef.current[0]?.shot ||
        selectionRequest.debounceMs <= 0
      ) {
        launchCompareSelectionLoad(requestId, nextSelectionRequest);
        return;
      }

      compareSelectionTimerRef.current = setTimeout(() => {
        compareSelectionTimerRef.current = null;
        launchCompareSelectionLoad(requestId, nextSelectionRequest);
      }, selectionRequest.debounceMs);
    },
    [
      clearCompareSelectionTimer,
      clearPendingCompareSelection,
      compareMode,
      launchCompareSelectionLoad,
      normalizeCompareSelectionRequest,
    ],
  );

  /**
   * @param {AnalyzerProfile} data
   * @param {string} name
   * @param {LibrarySource} source
   */
  const handleCompareProfileLoad = (data, name, source) => {
    cancelCompareProfileSearch();
    const nextProfile = normalizeMatchedProfileSource(data, source);
    setCompareShots(currentEntries =>
      currentEntries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              profile: nextProfile,
              profileName: getProfileDisplayLabel(data, name),
              profileSelectionMode: 'manual',
            }
          : entry,
      ),
    );
  };

  const handleCompareProfileUnload = () => {
    cancelCompareProfileSearch();
    setCompareShots(currentEntries =>
      currentEntries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              profile: null,
              profileName: entry.shot?.profile
                ? cleanName(entry.shot.profile)
                : 'No Profile Loaded',
              profileSelectionMode: 'none',
            }
          : entry,
      ),
    );
  };

  const handleRetryCompareProfileSearch = async () => {
    const secondaryEntry = compareShots[0];
    if (!secondaryEntry?.shot?.profile) return;

    cancelCompareProfileSearch();
    const matchId = ++compareProfileMatchIdRef.current;
    setCompareIsSearchingProfile(true);

    try {
      const allProfiles = await libraryService.getAllProfiles('both');
      if (matchId !== compareProfileMatchIdRef.current) return;

      const matchedProfile = await loadPreferredAutoMatchedProfile(
        secondaryEntry.shot,
        allProfiles,
      );
      if (matchId !== compareProfileMatchIdRef.current) return;

      if (matchedProfile) {
        setCompareShots(currentEntries =>
          currentEntries.map(entry =>
            entry.key === secondaryEntry.key
              ? {
                  ...entry,
                  profile: matchedProfile.profile,
                  profileName: matchedProfile.profileName,
                  profileSelectionMode: 'auto',
                }
              : entry,
          ),
        );
      }
    } catch (error) {
      if (matchId !== compareProfileMatchIdRef.current) return;
      console.warn('Compare profile retry auto-match failed:', error);
    } finally {
      if (matchId === compareProfileMatchIdRef.current) {
        setCompareIsSearchingProfile(false);
      }
    }
  };

  const handleSwapCompareSlots = () => {
    const secondaryEntry = compareShots[0];
    if (!currentShot || !secondaryEntry?.shot) return;

    clearPendingPrimarySelection();
    clearPendingCompareSelection();
    compareLoadIdRef.current += 1;
    compareProfileMatchIdRef.current += 1;

    const previousPrimaryShot = currentShot;
    const previousPrimaryShotName = currentShotName;
    const previousPrimaryProfile = currentProfile;
    const previousPrimaryProfileName = currentProfileName;
    const previousPrimaryProfileSelectionMode = currentProfileSelectionMode;

    updateCurrentShot(secondaryEntry.shot);
    setCurrentShotName(secondaryEntry.shotName || getShotDisplayName(secondaryEntry.shot));
    setCurrentProfile(secondaryEntry.profile || null);
    setCurrentProfileName(secondaryEntry.profileName || 'No Profile Loaded');
    setCurrentProfileSelectionMode(secondaryEntry.profileSelectionMode || 'none');

    setCompareShots([
      {
        key: getShotIdentityKey(previousPrimaryShot),
        shot: previousPrimaryShot,
        shotName: previousPrimaryShotName,
        profile: previousPrimaryProfile,
        profileName: previousPrimaryProfileName,
        profileSelectionMode: previousPrimaryProfileSelectionMode,
      },
    ]);
    setCompareResults([]);
    setComparePendingKeys([]);
    setCompareIsSearchingProfile(false);
  };

  const {
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
  } = buildShotAnalyzerViewModel({
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
  });
  const mobileSubpageNavigation = useAnalyzerMobileSubpageNavigation({
    analysisEnabled: Boolean(currentShot && analysisResults),
    notesEnabled: Boolean(currentShot && isCompareActive),
    viewKey: `${chartMountKey}|${compareDetailsKey}`,
  });
  const { singleDesktopDetailsHeight, singleDesktopChartStyle } = useDesktopShotDetailsHeight({
    analysisResults,
    chartMountKey,
    currentShot,
    isCompareActive,
    shotDetailsColumnRef,
  });

  return (
    <div className='shot-analyzer-page pb-20'>
      {/* Header */}
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='grow text-2xl font-bold sm:text-3xl'>
          <Trans>Deep Dive Shot Analyzer</Trans>
        </h2>
      </div>

      <div className='w-full'>
        {/* Library Panel (Always visible) */}
        <div ref={libraryPanelRef} className='mt-4'>
          <LibraryPanel
            currentShot={currentShot}
            currentProfile={currentProfile}
            currentShotName={currentShotName}
            currentProfileName={currentProfileName}
            pendingPrimarySelection={pendingPrimarySelection}
            onShotSelect={handleShotSelect}
            onProfileLoad={handleProfileLoad}
            onShotUnload={() => {
              clearPendingPrimarySelection();
              clearPendingCompareSelection();
              resetCompareState({ disableMode: true });
              cancelPrimaryProfileSearch();
              updateCurrentShot(null);
              setCurrentShotName('No Shot Loaded');
              setCurrentProfile(null);
              setCurrentProfileName('No Profile Loaded');
              setCurrentProfileSelectionMode('none');
              setAnalysisResults(null);
            }}
            onProfileUnload={handleProfileUnload}
            onShowStats={
              /** @param {Parameters<typeof persistStatisticsInitialContext>[0]['context']} context */
              context =>
                persistStatisticsInitialContext({
                  context: {
                    ...context,
                    preferredDetailSection: compareMode ? 'compare' : null,
                  },
                  currentProfile,
                  currentProfileName,
                  currentShot,
                })
            }
            statsHref={statsHref}
            importMode={importMode}
            onImportModeChange={setImportMode}
            compareMode={compareMode}
            compareHasSecondaryShot={compareHasSecondaryShot}
            compareSelectedCount={compareSelectedCount}
            compareSelectionKeys={compareSelectionKeys}
            comparePendingKeys={comparePendingKeys}
            compareSecondaryShotKey={displayCompareSecondaryShotKey}
            secondaryShot={compareSecondaryShot?.shot || null}
            secondaryProfile={compareSecondaryProfile}
            secondaryShotName={compareSecondaryShot?.shotName || 'No Shot Loaded'}
            secondaryProfileName={compareSecondaryShot?.profileName || 'No Profile Loaded'}
            pendingCompareSelection={pendingCompareSelection}
            secondaryStatsHref={compareSecondaryStatsHref}
            onCompareModeToggle={handleCompareModeToggle}
            onCompareShotToggle={handleCompareShotToggle}
            onCompareProfileLoad={handleCompareProfileLoad}
            onCompareProfileUnload={handleCompareProfileUnload}
            onCompareSwap={handleSwapCompareSlots}
            onRetryProfileSearch={handleRetryProfileSearch}
            onRetryCompareProfileSearch={handleRetryCompareProfileSearch}
            // @ts-expect-error the library panel does not accept isMatchingProfile; the prop is ignored
            isMatchingProfile={isMatchingProfile}
            isSearchingProfile={isSearchingProfile}
            compareIsSearchingProfile={compareIsSearchingProfile}
          />
        </div>

        {currentShot ? (
          <ActiveAnalysisView
            activeColumns={activeColumns}
            analysisResults={analysisResults}
            analysisSectionRef={analysisSectionRef}
            chartMountKey={chartMountKey}
            compareCollectionWithAccents={compareCollectionWithAccents}
            compareTargetDisplayMode={compareTargetDisplayMode}
            currentShot={currentShot}
            currentProfile={currentProfile}
            handleSwapCompareSlots={handleSwapCompareSlots}
            isCompareActive={isCompareActive}
            mobileSubpageNavigation={mobileSubpageNavigation}
            setActiveColumns={setActiveColumns}
            setCompareTargetDisplayMode={setCompareTargetDisplayMode}
            shotDetailsColumnRef={shotDetailsColumnRef}
            shotDetailsEntries={shotDetailsEntries}
            singleDesktopChartStyle={singleDesktopChartStyle}
            singleDesktopDetailsHeight={singleDesktopDetailsHeight}
          />
        ) : (
          <div className='mt-6'>
            <EmptyState loading={loading} />
          </div>
        )}
      </div>
    </div>
  );
}
