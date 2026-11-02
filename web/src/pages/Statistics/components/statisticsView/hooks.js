// Custom hooks for StatisticsView state management: metadata, filters, compare, detail section, and bulk selection
import { useState, useEffect, useRef, useMemo, useCallback } from 'preact/hooks';
import { libraryService } from '../../../ShotAnalyzer/services/LibraryService';
import {
  cleanName,
  isProfilePinned,
  isShotPinned,
  getShotPinBucketKey,
} from '../../../ShotAnalyzer/utils/analyzerUtils';
import { computeStatistics } from '../../services/StatisticsService';
import {
  parseStatisticsQuery,
  buildShotCandidatePredicate,
  resolveShotEffectiveTimestampMs,
} from '../../utils/statisticsSearchDsl';
import {
  getAvailableProfileNames,
  getShotSelectionKey,
  buildDateBasisWarningState,
  buildBaseFilterState,
  buildCandidateFilterState,
  buildShotSelectionItem,
  getCanonicalShotProfilePinKeyFromMap,
  formatDateTimeLocalInputValue,
  getPreferredStatisticsDetailSection,
  normalizeStatisticsDetailSection,
  resolveStatisticsDetailSectionChoice,
  parseDateInputMs,
  matchesPinnedShotMetaWithPins,
  getProfilePinDisabledReasonText,
  getShotPinDisabledReasonText,
} from './helpers';
import {
  runStatisticsAnalysis,
  buildStatisticsCompareEntries,
  getBuiltProfileCount,
  getBuiltDateRange,
} from './analysis';
import { t } from '@lingui/core/macro';

/**
 * @typedef {import('../../types').DateBasisMode} DateBasisMode
 * @typedef {import('../../types').StatisticsMode} StatisticsMode
 * @typedef {import('../../types').StatisticsSourceSelection} StatisticsSourceSelection
 * @typedef {import('../../types').StatisticsDetailSection} StatisticsDetailSection
 * @typedef {import('../../types').StatisticsShotMeta} StatisticsShotMeta
 * @typedef {import('../../types').StatisticsProfileMeta} StatisticsProfileMeta
 * @typedef {import('../../types').StatisticsEntry} StatisticsEntry
 * @typedef {import('../../types').StatisticsResult} StatisticsResult
 * @typedef {import('../../types').StatisticsRunRequest} StatisticsRunRequest
 * @typedef {import('../../types').StatisticsProgress} StatisticsProgress
 * @typedef {import('../../types').PinnedShotsByProfile} PinnedShotsByProfile
 * @typedef {import('../../types').ProfileSelectionItem} ProfileSelectionItem
 * @typedef {import('../../types').ShotSelectionItem} ShotSelectionItem
 * @typedef {import('../../types').ShotMetaPredicate} ShotMetaPredicate
 * @typedef {import('./helpers').ShotKeyToCanonicalProfile} ShotKeyToCanonicalProfile
 */
/**
 * @template S
 * @typedef {import('../../types').SetState<S>} SetState
 */
/**
 * @template T
 * @typedef {import('preact/hooks').MutableRef<T>} MutableRef
 */

/**
 * Loads the shot and profile lists for the selected sources and keeps the selection valid.
 *
 * @param {object} args
 * @param {import('../../../../services/ApiService.js').default} args.apiService
 * @param {StatisticsSourceSelection} args.shotSource
 * @param {StatisticsSourceSelection} args.profileSource
 * @param {string} args.initialProfileName
 * @param {SetState<string[]>} args.setSelectedProfileNames
 * @param {SetState<string[]>} args.setSelectedShotKeys
 */
export function useStatisticsMetadataState({
  apiService,
  shotSource,
  profileSource,
  initialProfileName,
  setSelectedProfileNames,
  setSelectedShotKeys,
}) {
  const [rawShotCandidates, setRawShotCandidates] = useState(
    /** @type {StatisticsShotMeta[]} */ ([]),
  );
  const [rawProfiles, setRawProfiles] = useState(/** @type {StatisticsProfileMeta[]} */ ([]));
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [metadataError, setMetadataError] = useState(/** @type {string | null} */ (null));
  const [metadataReloadNonce, setMetadataReloadNonce] = useState(0);
  const metaLoadIdRef = useRef(0);
  const initialProfilePresetAppliedRef = useRef(false);
  const gmPrefillRetryCountRef = useRef(0);

  useEffect(() => {
    libraryService.setApiService(apiService);
  }, [apiService]);

  useEffect(() => {
    const loadId = ++metaLoadIdRef.current;
    let cancelled = false;

    async function loadMetadata() {
      setMetadataLoading(true);
      setMetadataLoaded(false);
      setMetadataError(null);

      try {
        const [shotList, profileList] = await Promise.all([
          libraryService.getAllShots(shotSource),
          libraryService.getAllProfiles(profileSource),
        ]);

        if (cancelled || loadId !== metaLoadIdRef.current) return;

        setRawShotCandidates(Array.isArray(shotList) ? shotList : []);
        setRawProfiles(Array.isArray(profileList) ? profileList : []);
      } catch {
        if (cancelled || loadId !== metaLoadIdRef.current) return;
        setRawShotCandidates([]);
        setRawProfiles([]);
        setMetadataError(t`Failed to load shots/profiles for filtering.`);
      } finally {
        if (!cancelled && loadId === metaLoadIdRef.current) {
          setMetadataLoading(false);
          setMetadataLoaded(true);
        }
      }
    }

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [shotSource, profileSource, apiService, metadataReloadNonce]);

  useEffect(() => {
    gmPrefillRetryCountRef.current = 0;
  }, [profileSource, initialProfileName]);

  const availableProfiles = useMemo(() => getAvailableProfileNames(rawProfiles), [rawProfiles]);
  const normalizedAvailableProfilesMap = useMemo(() => {
    /** @type {Map<string, string>} */
    const map = new Map();
    for (const name of availableProfiles) {
      const normalized = cleanName(name).toLowerCase();
      if (normalized && !map.has(normalized)) {
        map.set(normalized, name);
      }
    }
    return map;
  }, [availableProfiles]);

  const rawShotKeyOrder = useMemo(
    () => (rawShotCandidates || []).map(getShotSelectionKey).filter(Boolean),
    [rawShotCandidates],
  );

  const shotKeyToCanonicalProfile = useMemo(() => {
    /** @type {ShotKeyToCanonicalProfile} */
    const map = new Map();
    for (const shot of rawShotCandidates || []) {
      const key = getShotSelectionKey(shot);
      if (!key) continue;
      const normalized = cleanName(shot?.profile || shot?.profileName || '').toLowerCase();
      const canonical = normalizedAvailableProfilesMap.get(normalized) || null;
      map.set(key, canonical);
    }
    return map;
  }, [rawShotCandidates, normalizedAvailableProfilesMap]);

  useEffect(() => {
    if (!metadataLoaded) return;

    /** @type {Map<string, string>} */
    const normalizedAvailableProfiles = new Map();
    for (const name of availableProfiles) {
      const normalized = cleanName(name).toLowerCase();
      if (normalized && !normalizedAvailableProfiles.has(normalized)) {
        normalizedAvailableProfiles.set(normalized, name);
      }
    }

    setSelectedProfileNames(prev => {
      /** @type {string[]} */
      const next = [];
      /** @type {Set<string>} */
      const seen = new Set();
      for (const name of prev) {
        const normalized = cleanName(name).toLowerCase();
        const canonical = normalizedAvailableProfiles.get(normalized);
        if (!canonical || seen.has(canonical)) continue;
        seen.add(canonical);
        next.push(canonical);
      }
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });

    const validShotKeys = new Set(
      (rawShotCandidates || []).map(getShotSelectionKey).filter(Boolean),
    );
    setSelectedShotKeys(prev => {
      const next = prev.filter(id => validShotKeys.has(id));
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });
  }, [
    availableProfiles,
    rawShotCandidates,
    metadataLoaded,
    setSelectedProfileNames,
    setSelectedShotKeys,
  ]);

  useEffect(() => {
    if (!metadataLoaded || initialProfilePresetAppliedRef.current) return;
    if (!initialProfileName) {
      initialProfilePresetAppliedRef.current = true;
      return;
    }

    const target = cleanName(initialProfileName).toLowerCase();
    if (!target) return;

    const canonical = availableProfiles.find(name => cleanName(name).toLowerCase() === target);
    if (!canonical) return;

    initialProfilePresetAppliedRef.current = true;
    setSelectedProfileNames([canonical]);
  }, [availableProfiles, initialProfileName, metadataLoaded, setSelectedProfileNames]);

  useEffect(() => {
    if (profileSource !== 'gaggimate') return;
    if (!initialProfileName) return;
    if (!metadataLoaded || metadataLoading || metadataError) return;
    if (initialProfilePresetAppliedRef.current) return;
    if ((availableProfiles || []).length > 0) return;
    if (gmPrefillRetryCountRef.current >= 3) return;

    const timer = setTimeout(() => {
      gmPrefillRetryCountRef.current += 1;
      setMetadataReloadNonce(value => value + 1);
    }, 450);

    return () => clearTimeout(timer);
  }, [
    profileSource,
    initialProfileName,
    metadataLoaded,
    metadataLoading,
    metadataError,
    availableProfiles,
  ]);

  return {
    rawShotCandidates,
    rawProfiles,
    metadataLoading,
    metadataLoaded,
    metadataError,
    rawShotKeyOrder,
    shotKeyToCanonicalProfile,
    availableProfiles,
  };
}

/**
 * Derives filter state, selectable items and selection handlers from the loaded metadata.
 *
 * @param {object} args
 * @param {StatisticsShotMeta[]} args.rawShotCandidates
 * @param {string[]} args.availableProfiles
 * @param {string[]} args.rawShotKeyOrder
 * @param {ShotKeyToCanonicalProfile} args.shotKeyToCanonicalProfile
 * @param {string[]} args.pinnedProfiles
 * @param {PinnedShotsByProfile} args.pinnedShotsByProfile
 * @param {StatisticsMode} args.mode
 * @param {string[]} args.selectedProfileNames
 * @param {SetState<string[]>} args.setSelectedProfileNames
 * @param {string[]} args.selectedShotKeys
 * @param {SetState<string[]>} args.setSelectedShotKeys
 * @param {string} args.query
 * @param {string} args.dateFromLocal
 * @param {string} args.dateToLocal
 * @param {DateBasisMode} args.dateBasisMode
 */
export function useStatisticsSelectionModel({
  rawShotCandidates,
  availableProfiles,
  rawShotKeyOrder,
  shotKeyToCanonicalProfile,
  pinnedProfiles,
  pinnedShotsByProfile,
  mode,
  selectedProfileNames,
  setSelectedProfileNames,
  selectedShotKeys,
  setSelectedShotKeys,
  query,
  dateFromLocal,
  dateToLocal,
  dateBasisMode,
}) {
  const matchesPinnedShotMeta = useCallback(
    /** @type {ShotMetaPredicate} */
    shotMeta =>
      matchesPinnedShotMetaWithPins(shotMeta, {
        shotKeyToCanonicalProfile,
        pinnedShotsByProfile,
        pinnedProfiles,
      }),
    [shotKeyToCanonicalProfile, pinnedShotsByProfile, pinnedProfiles],
  );

  const getProfilePinDisabledReason = useCallback(
    /** @param {string} profileName */
    profileName => getProfilePinDisabledReasonText(profileName, pinnedProfiles),
    [pinnedProfiles],
  );

  const getShotPinDisabledReason = useCallback(
    /** @param {StatisticsShotMeta} shotMeta */
    shotMeta =>
      getShotPinDisabledReasonText(shotMeta, shotKeyToCanonicalProfile, pinnedShotsByProfile),
    [shotKeyToCanonicalProfile, pinnedShotsByProfile],
  );

  const dateBasisWarningState = useMemo(
    () => buildDateBasisWarningState(rawShotCandidates),
    [rawShotCandidates],
  );
  const parsedDslQuery = useMemo(() => parseStatisticsQuery(query), [query]);
  const compiledDslFilter = useMemo(
    () =>
      buildShotCandidatePredicate(parsedDslQuery, {
        dateBasisMode,
        matchesPinnedShot: matchesPinnedShotMeta,
      }),
    [parsedDslQuery, dateBasisMode, matchesPinnedShotMeta],
  );
  const visualDateFrom = useMemo(() => parseDateInputMs(dateFromLocal, 'start'), [dateFromLocal]);
  const visualDateTo = useMemo(() => parseDateInputMs(dateToLocal, 'end'), [dateToLocal]);

  const baseFilterState = useMemo(
    () =>
      buildBaseFilterState({
        compiledDslFilter,
        visualDateFrom,
        visualDateTo,
        dateBasisMode,
        rawShotCandidates,
      }),
    [compiledDslFilter, dateBasisMode, rawShotCandidates, visualDateFrom, visualDateTo],
  );

  const hasBaseParseErrors = baseFilterState.parseErrors.length > 0;
  const selectionScopeShots = useMemo(
    () => (hasBaseParseErrors ? rawShotCandidates || [] : baseFilterState.filteredShots),
    [hasBaseParseErrors, rawShotCandidates, baseFilterState.filteredShots],
  );
  const selectionScopeShotKeys = useMemo(
    () => (selectionScopeShots || []).map(getShotSelectionKey).filter(Boolean),
    [selectionScopeShots],
  );
  const selectionScopeShotKeySet = useMemo(
    () => new Set(selectionScopeShotKeys),
    [selectionScopeShotKeys],
  );

  const profilesPresentInBaseFilteredShots = useMemo(() => {
    /** @type {Set<string>} */
    const set = new Set();
    for (const shot of selectionScopeShots || []) {
      const key = getShotSelectionKey(shot);
      if (!key) continue;
      const canonical = shotKeyToCanonicalProfile.get(key);
      if (canonical) set.add(canonical);
    }
    return set;
  }, [selectionScopeShots, shotKeyToCanonicalProfile]);

  const baseCanonicalProfileToShotKeys = useMemo(() => {
    /** @type {Map<string, string[]>} */
    const map = new Map();
    for (const shot of selectionScopeShots || []) {
      const key = getShotSelectionKey(shot);
      if (!key) continue;
      const canonical = shotKeyToCanonicalProfile.get(key);
      if (!canonical) continue;
      if (!map.has(canonical)) map.set(canonical, []);
      map.get(canonical).push(key);
    }
    return map;
  }, [selectionScopeShots, shotKeyToCanonicalProfile]);

  const visibleProfileSelectionItems = useMemo(
    () =>
      availableProfiles
        .filter(name => profilesPresentInBaseFilteredShots.has(name))
        .map(
          /** @returns {ProfileSelectionItem} */
          name => ({
            id: name,
            primary: name,
            searchText: name,
            isPinned: isProfilePinned(name, pinnedProfiles),
            pinDisabledReason: getProfilePinDisabledReason(name),
          }),
        ),
    [
      availableProfiles,
      profilesPresentInBaseFilteredShots,
      pinnedProfiles,
      getProfilePinDisabledReason,
    ],
  );

  const visibleProfileIdSet = useMemo(
    () => new Set(visibleProfileSelectionItems.map(item => item.id)),
    [visibleProfileSelectionItems],
  );

  const baseShotSelectionItems = useMemo(
    () =>
      (selectionScopeShots || [])
        .map(shot => {
          const baseItem = buildShotSelectionItem(shot, dateBasisMode);
          const pinBucketKey =
            getCanonicalShotProfilePinKeyFromMap(shot, shotKeyToCanonicalProfile) ||
            getShotPinBucketKey(shot);
          return {
            ...baseItem,
            shotMeta: shot,
            pinBucketKey,
            isPinned: isShotPinned(shot, pinBucketKey, pinnedShotsByProfile),
            pinDisabledReason: getShotPinDisabledReason(shot),
          };
        })
        .filter(item => item.id),
    [
      selectionScopeShots,
      dateBasisMode,
      pinnedShotsByProfile,
      shotKeyToCanonicalProfile,
      getShotPinDisabledReason,
    ],
  );

  const selectedProfileNormalizedSet = useMemo(
    () =>
      new Set(
        (selectedProfileNames || []).map(name => cleanName(name).toLowerCase()).filter(Boolean),
      ),
    [selectedProfileNames],
  );

  const byProfileEligibleShots = useMemo(() => {
    if (selectedProfileNormalizedSet.size === 0) return [];
    return (selectionScopeShots || []).filter(shot => {
      const key = getShotSelectionKey(shot);
      if (!key) return false;
      const canonical = shotKeyToCanonicalProfile.get(key);
      if (!canonical) return false;
      return selectedProfileNormalizedSet.has(cleanName(canonical).toLowerCase());
    });
  }, [selectedProfileNormalizedSet, selectionScopeShots, shotKeyToCanonicalProfile]);

  const byProfileEligibleShotKeys = useMemo(
    () => byProfileEligibleShots.map(getShotSelectionKey).filter(Boolean),
    [byProfileEligibleShots],
  );
  const byProfileEligibleShotKeySet = useMemo(
    () => new Set(byProfileEligibleShotKeys),
    [byProfileEligibleShotKeys],
  );

  const byProfileShotSelectionItems = useMemo(
    () =>
      byProfileEligibleShots
        .map(shot => {
          const baseItem = buildShotSelectionItem(shot, dateBasisMode);
          const pinBucketKey =
            getCanonicalShotProfilePinKeyFromMap(shot, shotKeyToCanonicalProfile) ||
            getShotPinBucketKey(shot);
          return {
            ...baseItem,
            shotMeta: shot,
            pinBucketKey,
            isPinned: isShotPinned(shot, pinBucketKey, pinnedShotsByProfile),
            pinDisabledReason: getShotPinDisabledReason(shot),
          };
        })
        .filter(item => item.id),
    [
      byProfileEligibleShots,
      dateBasisMode,
      pinnedShotsByProfile,
      shotKeyToCanonicalProfile,
      getShotPinDisabledReason,
    ],
  );

  const selectedShotKeySet = useMemo(() => new Set(selectedShotKeys || []), [selectedShotKeys]);

  const derivedProfilesFromSelectedShots = useMemo(() => {
    /** @type {Set<string>} */
    const selectedProfileSet = new Set();
    for (const shot of selectionScopeShots || []) {
      const key = getShotSelectionKey(shot);
      if (!key || !selectedShotKeySet.has(key)) continue;
      const canonical = shotKeyToCanonicalProfile.get(key);
      if (canonical) selectedProfileSet.add(canonical);
    }
    return visibleProfileSelectionItems
      .map(item => item.id)
      .filter(profileName => selectedProfileSet.has(profileName));
  }, [
    selectionScopeShots,
    selectedShotKeySet,
    shotKeyToCanonicalProfile,
    visibleProfileSelectionItems,
  ]);

  const profileSelectionItems = visibleProfileSelectionItems;
  const shotSelectionItems =
    mode === 'profile' ? byProfileShotSelectionItems : baseShotSelectionItems;
  const displayedProfileSelection =
    mode === 'shots' ? derivedProfilesFromSelectedShots : selectedProfileNames;

  const candidateFilterState = useMemo(
    () =>
      buildCandidateFilterState({
        baseFilterState,
        mode,
        selectedProfileNames,
        selectedShotKeys,
        shotKeyToCanonicalProfile,
      }),
    [baseFilterState, mode, selectedProfileNames, selectedShotKeys, shotKeyToCanonicalProfile],
  );

  const dateInputPreviewRange = useMemo(() => {
    if (dateFromLocal || dateToLocal) {
      return { fromLocal: '', toLocal: '' };
    }

    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const shot of candidateFilterState.filteredShots || []) {
      const ts = resolveShotEffectiveTimestampMs(shot, dateBasisMode);
      if (!Number.isFinite(ts)) continue;
      if (ts < minTs) minTs = ts;
      if (ts > maxTs) maxTs = ts;
    }

    if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) {
      return { fromLocal: '', toLocal: '' };
    }

    return {
      fromLocal: formatDateTimeLocalInputValue(minTs),
      toLocal: formatDateTimeLocalInputValue(maxTs),
    };
  }, [candidateFilterState.filteredShots, dateBasisMode, dateFromLocal, dateToLocal]);

  /** @param {Set<string>} nextSet */
  const orderShotSelection = nextSet => rawShotKeyOrder.filter(key => nextSet.has(key));

  /** @param {string[]} nextProfileNames */
  const handleProfileSelectionChange = nextProfileNames => {
    const nextProfiles = Array.isArray(nextProfileNames) ? nextProfileNames : [];
    setSelectedProfileNames(nextProfiles);

    const nextProfileSet = new Set(
      nextProfiles.map(name => cleanName(name).toLowerCase()).filter(Boolean),
    );
    const nextShotKeys =
      nextProfileSet.size === 0
        ? []
        : (selectionScopeShots || [])
            .map(shot => {
              const key = getShotSelectionKey(shot);
              if (!key) return null;
              const canonical = shotKeyToCanonicalProfile.get(key);
              if (!canonical) return null;
              return nextProfileSet.has(cleanName(canonical).toLowerCase()) ? key : null;
            })
            .filter(Boolean);
    setSelectedShotKeys(nextShotKeys);
  };

  /** @param {string[]} nextShotKeys */
  const handleByProfileShotSelectionChange = nextShotKeys => {
    setSelectedShotKeys(Array.isArray(nextShotKeys) ? nextShotKeys : []);
  };

  /** @param {string[]} nextShotKeys */
  const handleShotSelectionChange = nextShotKeys => {
    setSelectedShotKeys(Array.isArray(nextShotKeys) ? nextShotKeys : []);
  };

  /** @param {string[]} nextProfileNames */
  const handleByShotsProfileSelectionChange = nextProfileNames => {
    if (hasBaseParseErrors) return;

    const nextProfiles = new Set((nextProfileNames || []).filter(Boolean));
    const currentProfiles = new Set(derivedProfilesFromSelectedShots);
    const nextShotSet = new Set(selectedShotKeys);

    for (const profileName of currentProfiles) {
      if (nextProfiles.has(profileName)) continue;
      const profileShotKeys = baseCanonicalProfileToShotKeys.get(profileName) || [];
      for (const shotKey of profileShotKeys) nextShotSet.delete(shotKey);
    }

    for (const profileName of nextProfiles) {
      if (currentProfiles.has(profileName)) continue;
      const profileShotKeys = baseCanonicalProfileToShotKeys.get(profileName) || [];
      for (const shotKey of profileShotKeys) nextShotSet.add(shotKey);
    }

    setSelectedShotKeys(orderShotSelection(nextShotSet));
  };

  return {
    dateBasisWarningState,
    candidateFilterState,
    hasBaseParseErrors,
    selectionScopeShotKeySet,
    visibleProfileIdSet,
    byProfileEligibleShotKeys,
    byProfileEligibleShotKeySet,
    profileSelectionItems,
    shotSelectionItems,
    displayedProfileSelection,
    derivedProfilesFromSelectedShots,
    baseCanonicalProfileToShotKeys,
    dateInputPreviewRange,
    handleProfileSelectionChange,
    handleByProfileShotSelectionChange,
    handleShotSelectionChange,
    handleByShotsProfileSelectionChange,
  };
}

/**
 * Keeps profile/shot selections inside the current filter scope as mode and filters change.
 *
 * @param {object} args
 * @param {StatisticsMode} args.mode
 * @param {boolean} args.metadataLoaded
 * @param {boolean} args.hasBaseParseErrors
 * @param {Set<string>} args.visibleProfileIdSet
 * @param {StatisticsSourceSelection} args.shotSource
 * @param {StatisticsSourceSelection} args.profileSource
 * @param {string[]} args.selectedProfileNames
 * @param {string[]} args.byProfileEligibleShotKeys
 * @param {Set<string>} args.byProfileEligibleShotKeySet
 * @param {Set<string>} args.selectionScopeShotKeySet
 * @param {SetState<string[]>} args.setSelectedProfileNames
 * @param {SetState<string[]>} args.setSelectedShotKeys
 */
export function useStatisticsSelectionSync({
  mode,
  metadataLoaded,
  hasBaseParseErrors,
  visibleProfileIdSet,
  shotSource,
  profileSource,
  selectedProfileNames,
  byProfileEligibleShotKeys,
  byProfileEligibleShotKeySet,
  selectionScopeShotKeySet,
  setSelectedProfileNames,
  setSelectedShotKeys,
}) {
  const profileModeShotSeedSignatureRef = useRef('');

  useEffect(() => {
    if (mode !== 'profile') {
      profileModeShotSeedSignatureRef.current = '';
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'profile' || !metadataLoaded || hasBaseParseErrors) return;

    setSelectedProfileNames(prev => {
      const next = (prev || []).filter(name => visibleProfileIdSet.has(name));
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });
  }, [mode, metadataLoaded, hasBaseParseErrors, visibleProfileIdSet, setSelectedProfileNames]);

  useEffect(() => {
    if (mode !== 'profile' || !metadataLoaded || hasBaseParseErrors) return;

    const signature = JSON.stringify({
      mode,
      shotSource,
      profileSource,
      profiles: [...selectedProfileNames].sort((a, b) => a.localeCompare(b)),
    });
    const shouldSeedAll = profileModeShotSeedSignatureRef.current !== signature;
    profileModeShotSeedSignatureRef.current = signature;

    setSelectedShotKeys(prev => {
      if (shouldSeedAll) return [...byProfileEligibleShotKeys];
      const next = (prev || []).filter(id => byProfileEligibleShotKeySet.has(id));
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });
  }, [
    mode,
    metadataLoaded,
    hasBaseParseErrors,
    shotSource,
    profileSource,
    selectedProfileNames,
    byProfileEligibleShotKeys,
    byProfileEligibleShotKeySet,
    setSelectedShotKeys,
  ]);

  useEffect(() => {
    if (mode !== 'shots' || !metadataLoaded || hasBaseParseErrors) return;

    setSelectedShotKeys(prev => {
      const next = (prev || []).filter(id => selectionScopeShotKeySet.has(id));
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });
  }, [mode, metadataLoaded, hasBaseParseErrors, selectionScopeShotKeySet, setSelectedShotKeys]);
}

/**
 * Runs the analysis for each new run request and stores the computed statistics.
 *
 * @param {object} args
 * @param {StatisticsRunRequest | null} args.runRequest
 * @param {MutableRef<number>} args.analyzeLoadIdRef
 * @param {MutableRef<StatisticsEntry[] | null>} args.entriesRef
 * @param {SetState<boolean>} args.setLoading
 * @param {SetState<string | null>} args.setError
 * @param {SetState<StatisticsResult | null>} args.setResult
 * @param {SetState<StatisticsProgress>} args.setProgress
 */
export function useStatisticsRunExecution({
  runRequest,
  analyzeLoadIdRef,
  entriesRef,
  setLoading,
  setError,
  setResult,
  setProgress,
}) {
  useEffect(() => {
    if (!runRequest) return;

    const loadId = ++analyzeLoadIdRef.current;
    let cancelled = false;

    async function loadAndAnalyze() {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress({ current: 0, total: 0 });

      try {
        const entries = await runStatisticsAnalysis({
          isCurrentRun: () => !cancelled && loadId === analyzeLoadIdRef.current,
          onProgress: setProgress,
          runRequest,
        });
        if (!entries) return;

        entriesRef.current = entries;
        setResult(computeStatistics(entries));
      } catch {
        if (cancelled || loadId !== analyzeLoadIdRef.current) return;
        setError(t`Failed to load statistics. Please try again.`);
      } finally {
        if (!cancelled && loadId === analyzeLoadIdRef.current) {
          setLoading(false);
        }
      }
    }

    loadAndAnalyze();

    return () => {
      cancelled = true;
    };
  }, [runRequest, analyzeLoadIdRef, entriesRef, setError, setLoading, setProgress, setResult]);
}

/**
 * Picks the detail section for a finished run and derives what the result view shows.
 *
 * @param {object} args
 * @param {StatisticsResult | null} args.result
 * @param {StatisticsRunRequest | null} args.runRequest
 * @param {StatisticsDetailSection} args.statisticsDetailSection
 * @param {SetState<StatisticsDetailSection>} args.setStatisticsDetailSection
 * @param {MutableRef<string | null>} args.initializedDetailSectionRunIdRef
 * @param {MutableRef<StatisticsEntry[] | null>} args.entriesRef
 * @param {boolean} args.preparingRun
 * @param {boolean} args.loading
 * @param {string | null} args.error
 * @param {string | null} args.metadataError
 */
export function useStatisticsResultViewState({
  result,
  runRequest,
  statisticsDetailSection,
  setStatisticsDetailSection,
  initializedDetailSectionRunIdRef,
  entriesRef,
  preparingRun,
  loading,
  error,
  metadataError,
}) {
  useEffect(() => {
    if (!result || !runRequest?.id) return;
    if (initializedDetailSectionRunIdRef.current === runRequest.id) return;

    const hasCompareStatistics = Array.isArray(entriesRef.current) && entriesRef.current.length > 0;
    const hasProfileGroups = Array.isArray(result.profileGroups) && result.profileGroups.length > 0;
    const hasPhaseStats = Array.isArray(result.phaseStats) && result.phaseStats.length > 0;
    const hasMetricStats = Boolean(result.metrics && Object.keys(result.metrics).length > 0);
    const hasTrendStats = Array.isArray(result.trends) && result.trends.length > 1;
    const defaultSection = getPreferredStatisticsDetailSection({
      runMode: runRequest.mode,
      hasCompareStatistics,
      hasMetricStatistics: hasMetricStats,
      hasTrendStatistics: hasTrendStats,
    });
    const preferredRunSection = normalizeStatisticsDetailSection(runRequest.preferredDetailSection);
    const nextSection = resolveStatisticsDetailSectionChoice({
      candidate:
        preferredRunSection ||
        normalizeStatisticsDetailSection(statisticsDetailSection) ||
        defaultSection,
      hasCompareStatistics,
      hasMetricStatistics: hasMetricStats,
      hasTrendStatistics: hasTrendStats,
      hasProfileGroupStatistics: hasProfileGroups,
      hasPhaseStatistics: hasPhaseStats,
    });

    setStatisticsDetailSection(nextSection);
    initializedDetailSectionRunIdRef.current = runRequest.id;
  }, [
    entriesRef,
    initializedDetailSectionRunIdRef,
    result,
    runRequest,
    setStatisticsDetailSection,
    statisticsDetailSection,
  ]);

  const hasProfileGroupStatistics = result?.profileGroups?.length > 0;
  const hasPhaseStatistics = result?.phaseStats?.length > 0;
  const hasMetricStatistics = Boolean(result?.metrics && Object.keys(result.metrics).length > 0);
  const hasTrendStatistics = Array.isArray(result?.trends) && result.trends.length > 1;
  const hasStatisticsCompare = Array.isArray(entriesRef.current) && entriesRef.current.length > 0;
  const fallbackStatisticsDetailSection = getPreferredStatisticsDetailSection({
    runMode: runRequest?.mode,
    hasCompareStatistics: hasStatisticsCompare,
    hasMetricStatistics,
    hasTrendStatistics,
  });
  const preferredRunSection = normalizeStatisticsDetailSection(runRequest?.preferredDetailSection);
  const detailSectionCandidate =
    initializedDetailSectionRunIdRef.current === runRequest?.id
      ? statisticsDetailSection
      : preferredRunSection ||
        normalizeStatisticsDetailSection(statisticsDetailSection) ||
        fallbackStatisticsDetailSection;
  const resolvedStatisticsDetailSection = resolveStatisticsDetailSectionChoice({
    candidate: detailSectionCandidate,
    hasCompareStatistics: hasStatisticsCompare,
    hasMetricStatistics,
    hasTrendStatistics,
    hasProfileGroupStatistics,
    hasPhaseStatistics,
  });
  const statisticsCompareEntries = useMemo(
    () => buildStatisticsCompareEntries(result, runRequest, entriesRef),
    [entriesRef, result, runRequest],
  );
  const shouldHidePhaseExitReasons = statisticsCompareEntries.length > 2;
  const builtShotCount = Number.isFinite(result?.summary?.totalShots)
    ? result.summary.totalShots
    : 0;
  const builtProfileCount = useMemo(
    () => getBuiltProfileCount(entriesRef),
    // entriesRef.current changes with each run, so result/runRequest invalidate the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entriesRef, result, runRequest],
  );
  const builtDateRange = useMemo(
    () => getBuiltDateRange(entriesRef, runRequest?.dateBasisMode || 'auto'),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see builtProfileCount
    [entriesRef, result, runRequest],
  );
  const shouldShowEmptyStatisticsState =
    !preparingRun && !loading && !result && !error && !metadataError;

  return {
    hasProfileGroupStatistics,
    hasPhaseStatistics,
    hasMetricStatistics,
    hasTrendStatistics,
    resolvedStatisticsDetailSection,
    statisticsCompareEntries,
    shouldHidePhaseExitReasons,
    builtShotCount,
    builtProfileCount,
    builtDateRange,
    shouldShowEmptyStatisticsState,
  };
}
