import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { notesService } from '../services/NotesService';
import { cleanName, detectDoseFromProfileName, getShotStorageKey } from '../utils/analyzerUtils';

/** @typedef {import('../types').AnalyzerShot} AnalyzerShot */
/** @typedef {import('../types').AnalyzerNotes} AnalyzerNotes */
/** @typedef {'rating' | 'beanType' | 'doseIn' | 'doseOut' | 'ratio' | 'grindSetting' | 'balanceTaste' | 'notes'} NotesField */

let notesStateOriginCounter = 0;

/**
 * @param {AnalyzerShot | null | undefined} shot
 * @returns {string}
 */
export function getShotNotesKey(shot) {
  return String(getShotStorageKey(shot) || '');
}

/** @param {number | null | undefined} timestamp Unix epoch seconds */
export function getShotDateTimeLabel(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * @param {AnalyzerShot | null | undefined} currentShot
 * @param {string} [currentShotName]
 * @returns {string}
 */
export function getAnalyzerShotDisplayName(currentShot, currentShotName = '') {
  if (!currentShot) return t`No Shot Loaded`;
  if (currentShot.source === 'gaggimate') return `#${currentShot.id || currentShotName || '-'}`;
  return cleanName(
    currentShotName || currentShot.name || currentShot.storageKey || currentShot.id || '-',
  );
}

/**
 * @param {string | undefined} doseIn
 * @param {string | undefined} doseOut
 */
function calculateRatio(doseIn, doseOut) {
  if (doseIn && doseOut && Number.parseFloat(doseIn) > 0 && Number.parseFloat(doseOut) > 0) {
    return (Number.parseFloat(doseOut) / Number.parseFloat(doseIn)).toFixed(2);
  }
  return '';
}

/**
 * @param {object} options
 * @param {AnalyzerNotes} options.loaded
 * @param {AnalyzerShot} options.currentShot
 */
function hydrateLoadedShotNotes({ loaded, currentShot }) {
  const nextNotes = { ...loaded };
  let autoSave = false;

  if (!nextNotes.doseIn && currentShot.profile) {
    const extractedDose = detectDoseFromProfileName(currentShot.profile);
    if (extractedDose !== null) {
      nextNotes.doseIn = String(extractedDose);
      autoSave = true;
    }
  }

  if (!nextNotes.doseOut && currentShot.volume) {
    nextNotes.doseOut = currentShot.volume.toFixed(1);
    autoSave = true;
  }

  if (nextNotes.doseIn && nextNotes.doseOut) {
    nextNotes.ratio = calculateRatio(nextNotes.doseIn, nextNotes.doseOut);
  }

  return { nextNotes, autoSave };
}

/**
 * @param {AnalyzerNotes} notes
 * @param {NotesField} field
 * @param {string | number} value
 * @returns {AnalyzerNotes}
 */
function updateNotesValue(notes, field, value) {
  const updated = { ...notes, [field]: value };
  if (field === 'doseIn' || field === 'doseOut') {
    const dIn = field === 'doseIn' ? /** @type {string} */ (value) : notes.doseIn;
    const dOut = field === 'doseOut' ? /** @type {string} */ (value) : notes.doseOut;
    updated.ratio = calculateRatio(dIn, dOut);
  } else if (field === 'ratio') {
    if (updated.doseOut) {
      updated.doseIn = (
        Number.parseFloat(updated.doseOut) / Number.parseFloat(/** @type {string} */ (value))
      ).toFixed(1);
    } else if (updated.doseIn) {
      updated.doseOut = (
        Number.parseFloat(updated.doseIn) * Number.parseFloat(/** @type {string} */ (value))
      ).toFixed(1);
    }
  }
  return updated;
}

/**
 * @param {object} [options]
 * @param {AnalyzerShot | null} [options.currentShot]
 * @param {boolean} [options.isSelectionPending]
 */
export function useShotNotesState({ currentShot, isSelectionPending = false } = {}) {
  const [notes, setNotes] = useState(notesService.getDefaults(null));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const notesRef = useRef(notes);
  const localUpdateVersionRef = useRef(0);
  /** @type {import('preact/hooks').MutableRef<string | null>} */
  const originIdRef = useRef(null);
  /** @type {import('preact/hooks').MutableRef<ReturnType<typeof setTimeout> | null>} */
  const saveTimerRef = useRef(null);

  if (!originIdRef.current) {
    notesStateOriginCounter += 1;
    originIdRef.current = `shot-notes-state-${notesStateOriginCounter}`;
  }

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const publishNotes = useCallback(
    /** @param {AnalyzerNotes} notesToPublish */
    notesToPublish => {
      if (!currentShot) return;
      notesService.publishNotesUpdate(
        getShotNotesKey(currentShot),
        currentShot.source,
        notesToPublish,
        originIdRef.current,
      );
    },
    [currentShot],
  );

  useEffect(() => {
    if (!currentShot) {
      setLoading(false);
      setNotes(notesService.getDefaults(null));
      return undefined;
    }

    let cancelled = false;
    const notesKey = getShotNotesKey(currentShot);
    const loadStartedAtVersion = localUpdateVersionRef.current;
    const inlineNotes =
      currentShot.notes && typeof currentShot.notes === 'object'
        ? { ...notesService.getDefaults(notesKey), ...currentShot.notes, id: notesKey }
        : null;
    const unsubscribeNotes = notesService.subscribeNotes(
      notesKey,
      currentShot.source,
      /**
       * @param {AnalyzerNotes} nextNotes
       * @param {{ originId?: string | null }} [meta]
       */
      (nextNotes, meta = {}) => {
        if (meta.originId === originIdRef.current) return;
        localUpdateVersionRef.current += 1;
        notesRef.current = nextNotes;
        setNotes(nextNotes);
      },
    );

    setLoading(true);
    if (inlineNotes) {
      notesRef.current = inlineNotes;
      setNotes(inlineNotes);
    }

    notesService
      .loadNotes(notesKey, currentShot.source)
      .then(loaded => {
        if (cancelled) return;
        if (localUpdateVersionRef.current !== loadStartedAtVersion) return;
        const persistedNotes = inlineNotes ? { ...loaded, ...inlineNotes, id: notesKey } : loaded;
        const { nextNotes, autoSave } = hydrateLoadedShotNotes({
          loaded: persistedNotes,
          currentShot,
        });

        notesRef.current = nextNotes;
        setNotes(nextNotes);

        if (autoSave && currentShot.source !== 'temp') {
          notesService.saveNotes(notesKey, currentShot.source, nextNotes);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribeNotes();
    };
  }, [
    currentShot,
    currentShot?.id,
    currentShot?.name,
    currentShot?.source,
    currentShot?.storageKey,
  ]);

  const handleInputChange = useCallback(
    /**
     * @param {NotesField} field
     * @param {string | number} value
     */
    (field, value) => {
      setNotes(prev => {
        const updated = updateNotesValue(prev, field, value);
        localUpdateVersionRef.current += 1;
        notesRef.current = updated;
        publishNotes(updated);
        return updated;
      });
    },
    [publishNotes],
  );

  const saveNotes = useCallback(
    async (notesToSave = notesRef.current) => {
      if (!currentShot) return;
      setSaving(true);
      try {
        await notesService.saveNotes(getShotNotesKey(currentShot), currentShot.source, notesToSave);
      } catch (error) {
        console.error('Failed to save notes:', error);
      } finally {
        setSaving(false);
      }
    },
    [currentShot],
  );

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const flushSave = useCallback(() => {
    clearSaveTimer();
    saveNotes();
  }, [clearSaveTimer, saveNotes]);

  const scheduleSave = useCallback(() => {
    clearSaveTimer();
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      saveNotes();
    }, 650);
  }, [clearSaveTimer, saveNotes]);

  const handleFieldChange = useCallback(
    /**
     * @param {NotesField} field
     * @param {string | number} value
     */
    (field, value) => {
      handleInputChange(field, value);
      scheduleSave();
    },
    [handleInputChange, scheduleSave],
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) flushSave();
    },
    [currentShot, flushSave],
  );

  const updateAndSave = useCallback(
    /**
     * @param {NotesField} field
     * @param {string | number} value
     */
    async (field, value) => {
      const updated = updateNotesValue(notesRef.current, field, value);
      localUpdateVersionRef.current += 1;
      notesRef.current = updated;
      setNotes(updated);
      publishNotes(updated);
      await saveNotes(updated);
    },
    [publishNotes, saveNotes],
  );

  useEffect(() => {
    if (!isSelectionPending) return;
    setLoading(true);
  }, [isSelectionPending]);

  return {
    notes,
    saving,
    loading,
    handleInputChange,
    handleFieldChange,
    saveNotes,
    flushSave,
    updateAndSave,
  };
}
