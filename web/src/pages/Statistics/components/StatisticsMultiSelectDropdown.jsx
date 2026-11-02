import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons/faThumbtack';
import { AnalyzerControl } from '../../ShotAnalyzer/components/AnalyzerControl.jsx';
import { cx } from '../../../utils/cx.js';
import { DropdownPanel } from './statisticsSurfaces.jsx';
import { Trans, useLingui } from '@lingui/react/macro';

/**
 * @typedef {import('../types').MultiSelectItem} MultiSelectItem
 * @typedef {'neutral' | 'primary' | 'secondary'} AccentTone
 * @typedef {{ shiftKey?: boolean, metaKey?: boolean, ctrlKey?: boolean }} SelectionModifiers
 * @typedef {{
 *   pointerId: number,
 *   startItemId: string,
 *   startX: number,
 *   startY: number,
 *   paintSelect: boolean,
 *   active: boolean,
 *   timer: number | null,
 *   visitedIds: Set<string>,
 *   onMove: ((event: PointerEvent) => void) | null,
 *   onUp: ((event: PointerEvent) => void) | null,
 *   onCancel: ((event: PointerEvent) => void) | null,
 * }} TouchPaintState
 */

const LONG_PRESS_MS = 220;
const MOVE_CANCEL_PX = 10;

// Reusable multiselect dropdown with desktop modifiers and touch "paint" selection.
function getBrowserWindow() {
  return globalThis.window;
}

function getBrowserDocument() {
  return globalThis.document;
}

/** @param {unknown} value */
function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

/**
 * @param {MultiSelectItem[]} items
 * @param {Set<string>} nextSet
 * @returns {string[]} Selected ids in item order
 */
function buildOrderedSelection(items, nextSet) {
  /** @type {string[]} */
  const ordered = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const item of items || []) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    if (nextSet.has(item.id)) ordered.push(item.id);
  }
  return ordered;
}

/** @param {string | undefined} label */
function getSingularLabel(label) {
  const normalized = String(label ?? '')
    .trim()
    .toLowerCase();
  if (normalized.endsWith('ies')) return `${normalized.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|sses|oes)$/.test(normalized)) return normalized.slice(0, -2);
  if (normalized.endsWith('s')) return normalized.slice(0, -1);
  return normalized || 'item';
}

/**
 * @param {AccentTone} accentTone
 * @param {boolean} [hasSelection]
 */
function getAccentTriggerClasses(accentTone, hasSelection = false) {
  if (accentTone === 'secondary') {
    return 'bg-secondary text-secondary-content hover:bg-secondary/92';
  }
  if (accentTone === 'primary') {
    return 'bg-primary text-primary-content hover:bg-primary/92';
  }
  return hasSelection
    ? 'bg-base-content/10 text-base-content hover:bg-base-content/14'
    : 'bg-base-content/4 text-base-content/70 hover:bg-base-content/7 hover:text-base-content';
}

/**
 * @param {AccentTone} accentTone
 * @param {boolean} selected
 */
function getAccentCircleClasses(accentTone, selected) {
  if (!selected) return 'border-base-content/20 bg-base-100/40';
  if (accentTone === 'secondary') return 'border-secondary/70 bg-secondary/20';
  if (accentTone === 'primary') return 'border-primary/70 bg-primary/20';
  return 'border-base-content/45 bg-base-content/10';
}

/**
 * @param {AccentTone} accentTone
 * @param {boolean} isSelected
 */
function getAccentSelectionDotClasses(accentTone, isSelected) {
  if (!isSelected) return 'bg-transparent opacity-0';
  if (accentTone === 'secondary') return 'bg-secondary';
  if (accentTone === 'primary') return 'bg-primary';
  return 'bg-base-content';
}

/**
 * @template {MultiSelectItem} I
 * @param {object} props
 * @param {I} props.item
 * @param {number} props.index
 * @param {boolean} props.isSelected
 * @param {AccentTone} props.accentTone
 * @param {string} props.singularLabel
 * @param {((item: I) => void) | undefined} props.onTogglePin
 * @param {(itemId: string, index: number, event: import('preact').JSX.TargetedMouseEvent<HTMLButtonElement>) => void} props.onRowClick
 * @param {(event: import('preact').JSX.TargetedPointerEvent<HTMLButtonElement>, itemId: string) => void} props.onCirclePointerDown
 * @param {(itemId: string, index: number, event: import('preact').JSX.TargetedMouseEvent<HTMLButtonElement>) => void} props.onCircleClick
 */
function StatisticsMultiSelectRow({
  item,
  index,
  isSelected,
  accentTone,
  singularLabel,
  onTogglePin,
  onRowClick,
  onCirclePointerDown,
  onCircleClick,
}) {
  const { t } = useLingui();
  const itemName = item.primary || item.id;
  return (
    <div
      data-stat-multi-item-id={item.id}
      className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
        isSelected ? 'bg-base-content/6' : 'hover:bg-base-content/4'
      }`}
    >
      <button
        type='button'
        aria-label={isSelected ? t`Deselect ${itemName}` : t`Select ${itemName}`}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${getAccentCircleClasses(accentTone, isSelected)}`}
        onClick={event => onCircleClick(item.id, index, event)}
        onPointerDown={event => {
          event.stopPropagation();
          onCirclePointerDown(event, item.id);
        }}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full transition-opacity ${getAccentSelectionDotClasses(accentTone, isSelected)}`}
        />
      </button>

      <button
        type='button'
        className='min-w-0 flex-1 text-left'
        aria-pressed={isSelected}
        onClick={event => onRowClick(item.id, index, event)}
      >
        <div className='min-w-0'>
          <div className='truncate text-xs font-semibold'>{item.primary || item.id}</div>
          {item.secondary ? (
            <div className='truncate text-[10px] opacity-65'>{item.secondary}</div>
          ) : null}
        </div>
      </button>

      {onTogglePin ? (
        <AnalyzerControl
          type='button'
          tone={item.isPinned ? 'primary' : 'subtle'}
          className={cx(
            'h-5 w-5 shrink-0 bg-transparent p-0 text-[11px]',
            item.isPinned && 'text-primary hover:text-primary',
            !item.isPinned && item.pinDisabledReason && 'cursor-not-allowed opacity-35',
          )}
          aria-label={item.isPinned ? t`Unpin ${itemName}` : t`Pin ${itemName}`}
          aria-disabled={!item.isPinned && !!item.pinDisabledReason}
          title={
            item.pinDisabledReason ||
            (item.isPinned ? t`Unpin ${singularLabel}` : t`Pin ${singularLabel}`)
          }
          onClick={
            /** @param {MouseEvent} event */
            event => {
              event.stopPropagation();
              if (!item.isPinned && item.pinDisabledReason) return;
              onTogglePin(item);
            }
          }
        >
          <FontAwesomeIcon icon={faThumbtack} />
        </AnalyzerControl>
      ) : null}
    </div>
  );
}

/**
 * @template {MultiSelectItem} I
 * @param {object} props
 * @param {string} props.label
 * @param {string} [props.itemLabel] - Singular item name; derived from `label` when omitted
 * @param {I[]} props.items
 * @param {string[]} props.selectedIds
 * @param {(nextIds: string[]) => void} props.onChange
 * @param {(item: I) => void} [props.onTogglePin]
 * @param {boolean} [props.disabled]
 * @param {AccentTone} [props.accentTone]
 * @param {string} [props.emptyText]
 * @param {number} [props.maxVisibleItems]
 * @param {string} [props.triggerClassName]
 * @param {string} [props.rootClassName]
 */
export function StatisticsMultiSelectDropdown({
  label,
  itemLabel,
  items,
  selectedIds,
  onChange,
  onTogglePin,
  disabled = false,
  accentTone = 'neutral',
  emptyText,
  maxVisibleItems = 12,
  triggerClassName = 'h-11 min-h-0',
  rootClassName = '',
}) {
  const { t } = useLingui();
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const listRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const anchorIndexRef = useRef(-1);
  const suppressRowClickRef = useRef(false);
  const touchStateRef = useRef(/** @type {TouchPaintState | null} */ (null));
  const latestSelectedSetRef = useRef(/** @type {Set<string>} */ (new Set()));
  const onChangeRef = useRef(onChange);

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  onChangeRef.current = onChange;
  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  latestSelectedSetRef.current = selectedSet;
  const normalizedSearchTerm = normalizeSearchText(searchTerm);

  const filteredItems = useMemo(() => {
    let nextItems = items || [];

    if (showPinnedOnly) {
      nextItems = nextItems.filter(item => item?.isPinned);
    }

    if (!normalizedSearchTerm) return nextItems;
    return nextItems.filter(item => {
      const haystack = normalizeSearchText(
        `${item?.primary || ''} ${item?.secondary || ''} ${item?.searchText || ''}`,
      );
      return haystack.includes(normalizedSearchTerm);
    });
  }, [items, normalizedSearchTerm, showPinnedOnly]);

  /** @param {Set<string>} nextSet */
  const commitSelection = nextSet => {
    latestSelectedSetRef.current = new Set(nextSet);
    const next = buildOrderedSelection(items || [], nextSet);
    onChangeRef.current?.(next);
  };

  /**
   * @param {string} id
   * @param {number} index
   */
  const setSingleSelection = (id, index) => {
    /** @type {Set<string>} */
    const nextSet = new Set();
    nextSet.add(id);
    commitSelection(nextSet);
    anchorIndexRef.current = index;
  };

  /**
   * @param {string} id
   * @param {number} index
   */
  const toggleAdditiveSelection = (id, index) => {
    const nextSet = new Set(selectedSet);
    if (nextSet.has(id)) nextSet.delete(id);
    else nextSet.add(id);
    commitSelection(nextSet);
    anchorIndexRef.current = index;
  };

  /**
   * @param {number} index
   * @param {boolean} additive
   */
  const applyRangeSelection = (index, additive) => {
    if (!Number.isInteger(index) || index < 0 || index >= filteredItems.length) return;
    const anchorIndex = anchorIndexRef.current;
    if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= filteredItems.length) {
      const id = filteredItems[index]?.id;
      if (id) setSingleSelection(id, index);
      return;
    }

    const start = Math.min(anchorIndex, index);
    const end = Math.max(anchorIndex, index);
    const rangeIds = filteredItems
      .slice(start, end + 1)
      .map(item => item.id)
      .filter(Boolean);

    /** @type {Set<string>} */
    const nextSet = additive ? new Set(selectedSet) : new Set();
    rangeIds.forEach(id => nextSet.add(id));
    commitSelection(nextSet);
  };

  /**
   * @param {string} itemId
   * @param {number} index
   * @param {SelectionModifiers | undefined} event
   * @param {{ circleOnlyToggle?: boolean }} [options]
   */
  const handleItemInteraction = (itemId, index, event, { circleOnlyToggle = false } = {}) => {
    if (!itemId || disabled) return;

    if (suppressRowClickRef.current) {
      suppressRowClickRef.current = false;
      return;
    }

    const isShift = !!event?.shiftKey;
    const isMetaOrCtrl = !!event?.metaKey || !!event?.ctrlKey;

    if (isShift) {
      applyRangeSelection(index, isMetaOrCtrl || circleOnlyToggle);
      anchorIndexRef.current = index;
      return;
    }

    if (circleOnlyToggle || isMetaOrCtrl) {
      toggleAdditiveSelection(itemId, index);
      return;
    }

    setSingleSelection(itemId, index);
  };

  /**
   * @param {string} itemId
   * @param {boolean} shouldSelect
   */
  const applyPaintToId = (itemId, shouldSelect) => {
    if (!itemId) return;
    const nextSet = new Set(latestSelectedSetRef.current);
    if (shouldSelect) nextSet.add(itemId);
    else nextSet.delete(itemId);
    commitSelection(nextSet);
  };

  const cleanupTouchState = () => {
    const state = touchStateRef.current;
    if (!state) return;

    if (state.timer) {
      clearTimeout(state.timer);
    }

    const browserWindow = getBrowserWindow();
    if (browserWindow) {
      browserWindow.removeEventListener('pointermove', state.onMove);
      browserWindow.removeEventListener('pointerup', state.onUp);
      browserWindow.removeEventListener('pointercancel', state.onCancel);
    }

    touchStateRef.current = null;
  };

  /** @param {TouchPaintState} state */
  const beginPaintMode = state => {
    if (!touchStateRef.current || touchStateRef.current.pointerId !== state.pointerId) return;
    touchStateRef.current.active = true;
    touchStateRef.current.timer = null;
    // Apply the start item immediately once long-press mode is confirmed.
    applyPaintToId(state.startItemId, state.paintSelect);
    touchStateRef.current.visitedIds.add(state.startItemId);
    suppressRowClickRef.current = true;
  };

  /**
   * @param {PointerEvent} event
   * @param {string} itemId
   */
  const handleCirclePointerDown = (event, itemId) => {
    if (disabled || !itemId) return;
    const pointerType = event.pointerType || 'mouse';
    if (pointerType === 'mouse') return;

    const startX = event.clientX;
    const startY = event.clientY;
    const paintSelect = !selectedSet.has(itemId);

    /** @type {TouchPaintState} */
    const state = {
      pointerId: event.pointerId,
      startItemId: itemId,
      startX,
      startY,
      paintSelect,
      active: false,
      timer: null,
      visitedIds: new Set(),
      onMove: null,
      onUp: null,
      onCancel: null,
    };

    /** @param {PointerEvent} moveEvent */
    const onMove = moveEvent => {
      const current = touchStateRef.current;
      if (!current || moveEvent.pointerId !== current.pointerId) return;

      if (!current.active) {
        const dx = moveEvent.clientX - current.startX;
        const dy = moveEvent.clientY - current.startY;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          cleanupTouchState();
        }
        return;
      }

      const el = getBrowserDocument()?.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const row = el?.closest?.('[data-stat-multi-item-id]');
      const hitId = row?.getAttribute?.('data-stat-multi-item-id');
      if (!hitId || current.visitedIds.has(hitId)) return;
      current.visitedIds.add(hitId);
      applyPaintToId(hitId, current.paintSelect);
    };

    /** @param {PointerEvent} endEvent */
    const endGesture = endEvent => {
      const current = touchStateRef.current;
      if (!current || endEvent.pointerId !== current.pointerId) return;
      if (current.active) suppressRowClickRef.current = true;
      cleanupTouchState();
    };

    state.onMove = onMove;
    state.onUp = endGesture;
    state.onCancel = endGesture;
    // Long-press turns the selection circle into a touch-friendly "paint"
    // gesture so users can sweep across many rows without modifier keys.
    state.timer = getBrowserWindow()?.setTimeout(() => beginPaintMode(state), LONG_PRESS_MS);

    touchStateRef.current = state;

    const browserWindow = getBrowserWindow();
    if (browserWindow) {
      browserWindow.addEventListener('pointermove', onMove, { passive: true });
      browserWindow.addEventListener('pointerup', endGesture, { passive: true });
      browserWindow.addEventListener('pointercancel', endGesture, { passive: true });
    }
  };

  useEffect(() => () => cleanupTouchState(), []);

  useEffect(() => {
    if (!open) return;

    /** @param {PointerEvent} event */
    const handleDocumentPointerDown = event => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(/** @type {Node | null} */ (event.target))) {
        setOpen(false);
      }
    };

    /** @param {KeyboardEvent} event */
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus?.();
      }
    };

    const browserDocument = getBrowserDocument();
    browserDocument?.addEventListener('pointerdown', handleDocumentPointerDown);
    browserDocument?.addEventListener('keydown', handleKeyDown);
    return () => {
      browserDocument?.removeEventListener('pointerdown', handleDocumentPointerDown);
      browserDocument?.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    // Pinned-only is a transient drill-down inside the open menu, not a
    // persistent filter preference for later openings.
    setShowPinnedOnly(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = getBrowserWindow()?.setTimeout(() => {
      listRef.current?.querySelector?.('input')?.focus?.();
    }, 0);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  // Prune stale selections when the available items change (e.g. after a source switch).
  // The latest callback is read from a ref so this effect only tracks data changes.
  useEffect(() => {
    const validIds = new Set((items || []).map(item => item.id).filter(Boolean));
    const pruned = (selectedIds || []).filter(id => validIds.has(id));
    if (pruned.length !== (selectedIds || []).length) {
      onChangeRef.current?.(pruned);
    }
  }, [items, selectedIds]);

  const selectedCount = selectedSet.size;
  const triggerText = selectedCount > 0 ? `${label} (${selectedCount})` : emptyText || t`Select...`;
  const labelLower = String(label ?? '').toLowerCase();
  const pinnedToggleLabel = showPinnedOnly
    ? t`Show all ${labelLower}`
    : t`Show pinned only ${labelLower}`;
  const panelMaxHeight = Math.max(8, Number(maxVisibleItems) || 12) * 36;
  const singularLabel = itemLabel || getSingularLabel(label);

  return (
    <div ref={rootRef} className={`relative ${rootClassName}`.trim()}>
      <AnalyzerControl
        controlRef={triggerRef}
        type='button'
        variant='surface'
        data-statistics-multiselect-trigger
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup='menu'
        onClick={() => setOpen(v => !v)}
        className={cx(
          'inline-flex max-w-[15rem] min-w-[8.5rem] items-center justify-between gap-1 rounded-lg px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40',
          triggerClassName,
          getAccentTriggerClasses(accentTone, selectedCount > 0),
        )}
      >
        <span className='truncate text-left'>{triggerText}</span>
        <span className='text-[10px] opacity-65'>
          <FontAwesomeIcon
            icon={faChevronDown}
            className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </span>
      </AnalyzerControl>

      {open && (
        <DropdownPanel
          panelRef={listRef}
          className='absolute top-full left-0 mt-2 w-[min(92vw,28rem)]'
        >
          <div className='border-base-content/8 border-b p-2'>
            <div className='flex items-center gap-2'>
              <input
                type='text'
                value={searchTerm}
                onInput={e => setSearchTerm(e.currentTarget.value)}
                placeholder={t`Search ${labelLower}...`}
                className='input input-sm border-base-content/10 bg-base-100/70 h-8 min-h-0 w-full flex-1 text-xs'
              />
              {onTogglePin ? (
                <AnalyzerControl
                  type='button'
                  tone={showPinnedOnly ? 'primary' : 'subtle'}
                  className={cx(
                    'h-8 w-8 shrink-0 bg-transparent text-xs',
                    showPinnedOnly && 'text-primary hover:text-primary',
                  )}
                  aria-label={pinnedToggleLabel}
                  title={pinnedToggleLabel}
                  onClick={() => setShowPinnedOnly(value => !value)}
                >
                  <FontAwesomeIcon icon={faThumbtack} />
                </AnalyzerControl>
              ) : null}
            </div>
          </div>

          <div
            className='overscroll-contain p-1'
            style={{ maxHeight: `${panelMaxHeight}px`, overflowY: 'auto' }}
          >
            {filteredItems.length === 0 ? (
              <div className='px-2 py-3 text-xs opacity-60'>
                {showPinnedOnly ? t`No pinned items found.` : t`No items found.`}
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = selectedSet.has(item.id);
                return (
                  <StatisticsMultiSelectRow
                    key={item.id}
                    item={item}
                    index={index}
                    isSelected={isSelected}
                    accentTone={accentTone}
                    singularLabel={singularLabel}
                    onTogglePin={onTogglePin}
                    onRowClick={handleItemInteraction}
                    onCirclePointerDown={handleCirclePointerDown}
                    onCircleClick={(itemId, itemIndex, event) => {
                      event.stopPropagation();
                      handleItemInteraction(itemId, itemIndex, event, {
                        circleOnlyToggle: true,
                      });
                    }}
                  />
                );
              })
            )}
          </div>

          <div className='border-base-content/8 flex items-center justify-between border-t px-2 py-1.5 text-[10px] opacity-60'>
            <span>
              <Trans>Shift = Range</Trans>
            </span>
            <span>
              <Trans>Cmd/Ctrl = Add</Trans>
            </span>
          </div>
        </DropdownPanel>
      )}
    </div>
  );
}
