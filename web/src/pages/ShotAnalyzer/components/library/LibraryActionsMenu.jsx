import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useLingui } from '@lingui/react/macro';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons/faEllipsisVertical';
import {
  getAnalyzerIconButtonClasses,
  getAnalyzerTextButtonClasses,
} from '../analyzerControlStyles';

/**
 * @typedef {object} LibraryAction
 * @property {string} label
 * @property {import('@fortawesome/fontawesome-svg-core').IconDefinition} icon
 * @property {import('../analyzerControlStyles').AnalyzerControlTone} [tone]
 * @property {string} [href] Renders the action as a link.
 * @property {() => void} [onSelect]
 */

const MENU_WIDTH = 176;
const MENU_GAP = 8;
const VIEWPORT_MARGIN = 12;

/**
 * @param {Element | null} anchor
 * @param {number} actionCount
 * @param {'top' | 'bottom'} preferredPlacement
 * @returns {import('../types').MenuPosition}
 */
function getMenuPosition(anchor, actionCount, preferredPlacement) {
  if (!anchor) return { top: VIEWPORT_MARGIN, left: VIEWPORT_MARGIN, width: MENU_WIDTH };

  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(MENU_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
  const estimatedHeight = actionCount * 36 + 8;
  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_MARGIN;
  let openAbove = preferredPlacement === 'top';

  if (openAbove && spaceAbove < estimatedHeight && spaceBelow > spaceAbove) openAbove = false;
  if (!openAbove && spaceBelow < estimatedHeight && spaceAbove > spaceBelow) openAbove = true;

  const desiredTop = openAbove ? rect.top - estimatedHeight - MENU_GAP : rect.bottom + MENU_GAP;
  const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - estimatedHeight - VIEWPORT_MARGIN);

  return {
    top: Math.min(Math.max(VIEWPORT_MARGIN, desiredTop), maxTop),
    left: Math.min(
      Math.max(VIEWPORT_MARGIN, rect.right - width),
      Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN),
    ),
    width,
  };
}

/**
 * @param {object} props
 * @param {LibraryAction[]} props.actions
 * @param {string} props.ariaLabel
 * @param {string} [props.buttonClassName]
 * @param {'top' | 'bottom'} [props.placement]
 */
export function LibraryActionsMenu({ actions, ariaLabel, buttonClassName, placement = 'bottom' }) {
  const { t } = useLingui();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({
    top: VIEWPORT_MARGIN,
    left: VIEWPORT_MARGIN,
    width: MENU_WIDTH,
  });
  /** @type {import('preact').RefObject<HTMLDetailsElement>} */
  const detailsRef = useRef(null);
  /** @type {import('preact').RefObject<HTMLDivElement>} */
  const menuRef = useRef(null);

  const closeMenu = useCallback(() => {
    if (detailsRef.current) detailsRef.current.open = false;
  }, []);

  const updateMenuPosition = useCallback(() => {
    setMenuPosition(getMenuPosition(detailsRef.current, actions.length, placement));
  }, [actions.length, placement]);

  useEffect(() => {
    if (!isOpen) return;

    /** @param {PointerEvent} event */
    const handlePointerDown = event => {
      const target = /** @type {Node | null} */ (event.target);
      if (detailsRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };
    /** @param {KeyboardEvent} event */
    const handleKeyDown = event => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [closeMenu, isOpen, updateMenuPosition]);

  /**
   * @param {Event} event
   * @param {(() => void) | undefined} onSelect
   */
  const handleAction = (event, onSelect) => {
    event.stopPropagation();
    closeMenu();
    onSelect?.();
  };

  const menu = (
    <div
      ref={menuRef}
      role='menu'
      tabIndex={-1}
      data-library-actions-menu='true'
      className='app-card-surface fixed z-[10000] rounded-xl p-1.5 shadow-xl'
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        width: `${menuPosition.width}px`,
      }}
    >
      <div className='grid gap-1'>
        {actions.map(action => {
          const content = (
            <>
              <FontAwesomeIcon icon={action.icon} className='w-4' />
              <span>{action.label}</span>
            </>
          );
          const className = getAnalyzerTextButtonClasses({
            tone: action.tone,
            className: 'w-full gap-2 px-2.5 py-2 text-left text-xs font-medium',
          });

          return action.href ? (
            <a
              key={action.label}
              href={action.href}
              role='menuitem'
              className={className}
              onClick={event => handleAction(event, action.onSelect)}
            >
              {content}
            </a>
          ) : (
            <button
              key={action.label}
              type='button'
              role='menuitem'
              className={className}
              onClick={event => handleAction(event, action.onSelect)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <details
      ref={detailsRef}
      onToggle={
        /** @param {import('preact').JSX.TargetedEvent<HTMLDetailsElement, Event>} event */ event => {
          const open = event.currentTarget.open;
          if (open) updateMenuPosition();
          setIsOpen(open);
        }
      }
    >
      <summary
        onClick={event => event.stopPropagation()}
        className={getAnalyzerIconButtonClasses({
          tone: 'subtle',
          className: `cursor-pointer list-none ${buttonClassName} [&::-webkit-details-marker]:hidden`,
        })}
        aria-label={ariaLabel}
        title={t`More actions`}
      >
        <FontAwesomeIcon icon={faEllipsisVertical} size='sm' />
      </summary>

      {isOpen ? createPortal(menu, document.body) : null}
    </details>
  );
}
