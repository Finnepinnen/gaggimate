/** Coordinates file-import side effects and summarizes outcomes for the library UI. */

import { indexedDBService } from '../../services/IndexedDBService';
import { notesService } from '../../services/NotesService';
import { cleanName } from '../../utils/analyzerUtils';
import { useCallback } from 'preact/hooks';
import { t } from '@lingui/core/macro';

/** @typedef {import('../types').LibraryItem} LibraryItem */
/** @typedef {import('../types').ImportMode} ImportMode */
/** @typedef {import('../types').ImportSlot} ImportSlot */
/** @typedef {import('../types').ImportTargetType} ImportTargetType */
/** @typedef {import('../types').OnShotSelect} OnShotSelect */
/** @typedef {import('../types').OnCompareShotToggle} OnCompareShotToggle */
/** @typedef {import('../types').OnProfileLoad} OnProfileLoad */
/** @typedef {import('../../types').AnalyzerShot} AnalyzerShot */
/** @typedef {import('../../types').AnalyzerProfile} AnalyzerProfile */

/**
 * @typedef {object} ImportOutcome
 * @property {number} appliedImportCount
 * @property {number} mismatchedImportCount
 * @property {boolean} blockedSecondaryProfileImport
 */

/** @returns {ImportOutcome} */
function createImportOutcome() {
  return {
    appliedImportCount: 0,
    mismatchedImportCount: 0,
    blockedSecondaryProfileImport: false,
  };
}

/**
 * @param {ImportOutcome} target
 * @param {ImportOutcome} source
 */
function mergeImportOutcome(target, source) {
  target.appliedImportCount += source.appliedImportCount;
  target.mismatchedImportCount += source.mismatchedImportCount;
  target.blockedSecondaryProfileImport =
    target.blockedSecondaryProfileImport || source.blockedSecondaryProfileImport;
}

/**
 * @param {object} options
 * @param {any} options.data Parsed shot JSON (unvalidated).
 * @param {File} options.file
 * @param {ImportMode} options.importMode
 * @returns {Promise<AnalyzerShot>}
 */
async function buildImportedShot({ data, file, importMode }) {
  const source = importMode === 'browser' ? 'browser' : 'temp';
  const storageKey = file.name;
  /** @type {import('../../types').AnalyzerNotes | null} */
  let notesWithId = null;
  const importedNotes = data.notes;
  const shotData = { ...data };
  delete shotData.notes;

  /** @type {AnalyzerShot} */
  const shot = {
    ...shotData,
    id: String(shotData.id ?? storageKey),
    name: file.name,
    storageKey,
    data: shotData,
    source,
  };
  if (source === 'browser') await indexedDBService.saveShot(shot);

  if (importedNotes && typeof importedNotes === 'object') {
    notesWithId = {
      ...notesService.getDefaults(storageKey),
      ...importedNotes,
      id: storageKey,
    };
    await notesService.saveNotes(storageKey, source, notesWithId);
  }

  return notesWithId ? { ...shot, notes: notesWithId } : shot;
}

/**
 * @param {Omit<ImportAnalyzerFileOptions, 'secondaryShot' | 'onCompareProfileLoad' | 'onProfileLoad'>} options
 * @returns {Promise<ImportOutcome>}
 */
async function importShotFile({
  data,
  file,
  targetType,
  slot,
  importMode,
  currentShot,
  compareMode,
  onCompareShotToggle,
  onShotSelect,
}) {
  const outcome = createImportOutcome();
  if (targetType === 'profile') {
    outcome.mismatchedImportCount += 1;
    return outcome;
  }

  const importedShot = await buildImportedShot({ data, file, importMode });
  if (slot === 'secondary' && currentShot) {
    await onCompareShotToggle?.(importedShot, true);
  } else {
    onShotSelect?.({
      item: importedShot,
      name: file.name,
      preserveCompare: compareMode,
    });
  }
  outcome.appliedImportCount += 1;
  return outcome;
}

/**
 * @param {Omit<ImportAnalyzerFileOptions, 'compareMode' | 'onCompareShotToggle' | 'onShotSelect'>} options
 * @returns {Promise<ImportOutcome>}
 */
async function importProfileFile({
  data,
  file,
  targetType,
  slot,
  importMode,
  currentShot,
  secondaryShot,
  onCompareProfileLoad,
  onProfileLoad,
}) {
  const outcome = createImportOutcome();
  if (targetType === 'shot') {
    outcome.mismatchedImportCount += 1;
    return outcome;
  }

  const profileName = data.label || cleanName(file.name);
  const profileData = data.label ? data : { ...data, label: profileName };
  /** @type {AnalyzerProfile} */
  const profile = {
    ...profileData,
    data: profileData,
    fileName: file.name,
    source: importMode === 'browser' ? 'browser' : 'temp',
  };
  if (importMode === 'browser') await indexedDBService.saveProfile(profile);

  if (slot !== 'secondary') {
    onProfileLoad(profileData, profileName, profile.source);
    outcome.appliedImportCount += 1;
    return outcome;
  }

  if (secondaryShot) {
    onCompareProfileLoad?.(profileData, profileName, profile.source);
    outcome.appliedImportCount += 1;
  } else if (currentShot) {
    outcome.blockedSecondaryProfileImport = true;
  } else {
    onProfileLoad(profileData, profileName, profile.source);
    outcome.appliedImportCount += 1;
  }

  return outcome;
}

/**
 * @typedef {object} ImportAnalyzerFileOptions
 * @property {any} data Parsed JSON content of the file (unvalidated).
 * @property {File} file
 * @property {ImportTargetType} targetType
 * @property {ImportSlot} slot
 * @property {ImportMode} importMode
 * @property {LibraryItem | null | undefined} currentShot
 * @property {LibraryItem | null | undefined} secondaryShot
 * @property {boolean} compareMode
 * @property {OnCompareShotToggle} [onCompareShotToggle]
 * @property {OnShotSelect} [onShotSelect]
 * @property {OnProfileLoad} [onCompareProfileLoad]
 * @property {OnProfileLoad} onProfileLoad
 */

/**
 * @param {ImportAnalyzerFileOptions} options
 * @returns {Promise<ImportOutcome>}
 */
async function importAnalyzerFile({ file, data, ...options }) {
  if (data.samples) return importShotFile({ file, data, ...options });
  if (data.phases) return importProfileFile({ file, data, ...options });
  return createImportOutcome();
}

/**
 * @param {object} options
 * @param {ImportOutcome} options.outcome
 * @param {ImportTargetType} options.targetType
 */
function showImportOutcomeAlerts({ outcome, targetType }) {
  if (outcome.appliedImportCount > 0) return;

  if (outcome.blockedSecondaryProfileImport) {
    alert(t`Load a secondary shot before importing a secondary profile.`);
    return;
  }

  if (outcome.mismatchedImportCount > 0) {
    alert(
      targetType === 'shot'
        ? t`Only shot files can be imported in the shot field.`
        : t`Only profile files can be imported in the profile field.`,
    );
  }
}

/**
 * @param {object} options
 * @param {LibraryItem | null | undefined} options.currentShot
 * @param {LibraryItem | null | undefined} options.secondaryShot
 * @param {ImportMode} options.importMode
 * @param {boolean} options.compareMode
 * @param {OnShotSelect} [options.onShotSelect]
 * @param {OnProfileLoad} options.onProfileLoad
 * @param {OnCompareShotToggle} [options.onCompareShotToggle]
 * @param {OnProfileLoad} [options.onCompareProfileLoad]
 * @param {() => unknown} options.refreshLibraries
 * @param {(importing: boolean) => void} options.setImporting
 * @returns {import('../types').LibraryImportHandler}
 */
export function useLibraryPanelImportHandler({
  currentShot,
  secondaryShot,
  importMode,
  compareMode,
  onShotSelect,
  onProfileLoad,
  onCompareShotToggle,
  onCompareProfileLoad,
  refreshLibraries,
  setImporting,
}) {
  return useCallback(
    /**
     * @param {File[] | FileList} files
     * @param {import('../types').ImportOptions} [options]
     */
    async (files, { targetType = 'any', slot = 'primary' } = {}) => {
      setImporting(true);

      setTimeout(async () => {
        const outcome = createImportOutcome();

        try {
          for (const file of Array.from(files)) {
            const text = await file.text();
            const data = JSON.parse(text);
            const fileOutcome = await importAnalyzerFile({
              data,
              file,
              targetType,
              slot,
              importMode,
              currentShot,
              secondaryShot,
              compareMode,
              onCompareShotToggle,
              onShotSelect,
              onCompareProfileLoad,
              onProfileLoad,
            });
            mergeImportOutcome(outcome, fileOutcome);
          }

          showImportOutcomeAlerts({ outcome, targetType });
        } catch (error) {
          console.error('Import error:', error);
          alert(t`Import failed. Please check the file format.`);
        } finally {
          setImporting(false);
          refreshLibraries();
        }
      }, 50);
    },
    [
      compareMode,
      currentShot,
      importMode,
      onCompareProfileLoad,
      onCompareShotToggle,
      onProfileLoad,
      onShotSelect,
      refreshLibraries,
      secondaryShot,
      setImporting,
    ],
  );
}
