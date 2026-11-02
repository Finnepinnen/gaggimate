import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { analyzerUiColors } from '../../utils/analyzerUtils';

/** @typedef {import('../types').ImportMode} ImportMode */

/** @param {ImportMode} nextMode */
function getModeHintCopy(nextMode) {
  return nextMode === 'browser'
    ? t`Save to Browser. Imported shots and profiles will now be saved to the browser library.`
    : t`View temporarily. Imported shots and profiles will now open temporarily in the analyzer.`;
}

/**
 * @param {object} props
 * @param {string} props.modeHint
 * @param {import('preact').JSX.CSSProperties | undefined} props.modeHintBadgeStyle
 * @param {{ top: number, left: number }} props.modeHintPosition
 * @param {ImportMode} props.modeHintVariant
 */
export function ModeHintPortal({
  modeHint,
  modeHintBadgeStyle,
  modeHintPosition,
  modeHintVariant,
}) {
  if (!modeHint) return null;

  return createPortal(
    <div
      className='border-base-content/10 bg-base-100/95 pointer-events-none fixed z-[10000] rounded-xl border px-3 py-2 shadow-xl backdrop-blur-sm'
      style={{
        top: `${modeHintPosition.top}px`,
        left: `${modeHintPosition.left}px`,
        width: 'min(22rem, calc(100vw - 2rem))',
      }}
    >
      <div className='text-base-content/80 flex items-center gap-2 text-xs leading-5'>
        <span
          className='inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium'
          style={modeHintBadgeStyle}
        >
          {modeHintVariant === 'browser' ? (
            <Trans context='import mode badge'>SAVE</Trans>
          ) : (
            <Trans context='import mode badge'>VIEW</Trans>
          )}
        </span>
        <span className='min-w-0'>{modeHint}</span>
      </div>
    </div>,
    document.body,
  );
}

/**
 * @param {object} options
 * @param {ImportMode} options.importMode
 * @param {(mode: ImportMode) => void} [options.onImportModeChange]
 */
export function useAnalyzerActionBarModeHint({ importMode, onImportModeChange }) {
  /** @type {import('preact').RefObject<HTMLElement>} */
  const modeButtonRef = useRef(null);
  /** @type {import('preact/hooks').MutableRef<HTMLElement | null>} */
  const modeHintAnchorRef = useRef(null);
  /** @type {import('preact/hooks').MutableRef<DOMRect | null>} */
  const modeHintAnchorRectRef = useRef(null);
  /** @type {import('preact/hooks').MutableRef<ReturnType<typeof setTimeout> | null>} */
  const modeHintTimerRef = useRef(null);
  /** @type {import('preact/hooks').MutableRef<ReturnType<typeof setTimeout> | null>} */
  const modeHintDismissArmTimerRef = useRef(null);
  const modeHintDismissReadyRef = useRef(false);
  const [modeHint, setModeHint] = useState('');
  const [modeHintVariant, setModeHintVariant] = useState(/** @type {ImportMode} */ ('temp'));
  const [modeHintPosition, setModeHintPosition] = useState({ top: 0, left: 12 });

  const clearModeHintTimers = useCallback(() => {
    if (modeHintTimerRef.current) {
      globalThis.clearTimeout(modeHintTimerRef.current);
      modeHintTimerRef.current = null;
    }
    if (modeHintDismissArmTimerRef.current) {
      globalThis.clearTimeout(modeHintDismissArmTimerRef.current);
      modeHintDismissArmTimerRef.current = null;
    }
  }, []);

  const updateModeHintPosition = useCallback(() => {
    const anchorElement = modeHintAnchorRef.current || modeButtonRef.current;
    const rect = anchorElement?.isConnected
      ? anchorElement.getBoundingClientRect()
      : modeHintAnchorRectRef.current;
    if (!rect) return;
    const viewportWidth = globalThis.innerWidth || 0;
    const hintWidth = Math.min(352, Math.max(0, viewportWidth - 32));
    const maxLeft = Math.max(12, viewportWidth - hintWidth - 12);
    setModeHintPosition({
      top: rect.bottom + 10,
      left: Math.min(Math.max(12, rect.left), maxLeft),
    });
  }, []);

  const showModeHint = useCallback(
    /** @param {ImportMode} nextMode */
    nextMode => {
      const browserMode = nextMode === 'browser';
      setModeHintVariant(browserMode ? 'browser' : 'temp');
      setModeHint(getModeHintCopy(nextMode));
      updateModeHintPosition();
      clearModeHintTimers();
      modeHintDismissReadyRef.current = false;
      modeHintDismissArmTimerRef.current = globalThis.setTimeout(() => {
        modeHintDismissReadyRef.current = true;
      }, 180);
      modeHintTimerRef.current = globalThis.setTimeout(() => {
        setModeHint('');
      }, 4200);
    },
    [clearModeHintTimers, updateModeHintPosition],
  );

  const handleModeToggle = useCallback(
    /** @param {import('preact').JSX.TargetedMouseEvent<HTMLElement>} event */
    event => {
      event.preventDefault();
      event.stopPropagation();
      if (!onImportModeChange) return;
      modeHintAnchorRef.current = event.currentTarget;
      modeHintAnchorRectRef.current = event.currentTarget.getBoundingClientRect();
      /** @type {ImportMode} */
      const nextMode = importMode === 'browser' ? 'temp' : 'browser';
      onImportModeChange(nextMode);
      showModeHint(nextMode);
    },
    [importMode, onImportModeChange, showModeHint],
  );

  useEffect(() => {
    return () => {
      clearModeHintTimers();
    };
  }, [clearModeHintTimers]);

  useEffect(() => {
    if (!modeHint) return;
    updateModeHintPosition();
    const handleViewportChange = () => updateModeHintPosition();
    globalThis.addEventListener('resize', handleViewportChange);
    globalThis.addEventListener('scroll', handleViewportChange, true);
    return () => {
      globalThis.removeEventListener('resize', handleViewportChange);
      globalThis.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [modeHint, updateModeHintPosition]);

  useEffect(() => {
    if (!modeHint) return;
    const dismissHint = () => {
      if (!modeHintDismissReadyRef.current) return;
      setModeHint('');
    };
    document.addEventListener('pointerdown', dismissHint, true);
    return () => {
      document.removeEventListener('pointerdown', dismissHint, true);
    };
  }, [modeHint]);

  return {
    modeButtonRef,
    modeHint,
    modeHintVariant,
    modeHintPosition,
    modeHintBadgeStyle:
      modeHintVariant === 'browser'
        ? {
            backgroundColor: analyzerUiColors.sourceBadgeWebBg,
            borderColor: analyzerUiColors.sourceBadgeWebBorder,
            color: analyzerUiColors.sourceBadgeWebText,
          }
        : undefined,
    handleModeToggle,
  };
}
