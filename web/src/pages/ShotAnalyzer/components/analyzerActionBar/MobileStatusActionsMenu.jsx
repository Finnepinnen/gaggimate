/** Owns the viewport-positioned mobile import and mode actions menu. */

import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans, useLingui } from '@lingui/react/macro';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons/faEllipsisVertical';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faLaptopFile } from '@fortawesome/free-solid-svg-icons/faLaptopFile';
import { analyzerUiColors } from '../../utils/analyzerUtils';
import { ActionBarButton } from './ActionBarButtons.jsx';

const MOBILE_STATUS_ACTIONS_MENU_WIDTH = 224;

/** @typedef {(event: import('preact').JSX.TargetedMouseEvent<HTMLElement>) => void} MenuClickHandler */

/**
 * @param {Element | null} anchorElement
 * @returns {import('../types').MenuPosition}
 */
function getMobileStatusActionsMenuPosition(anchorElement) {
  if (!anchorElement || !globalThis.window) return { top: 0, left: 12, width: 224 };

  const rect = anchorElement.getBoundingClientRect();
  const viewportWidth = globalThis.window.innerWidth || 0;
  const width = Math.min(MOBILE_STATUS_ACTIONS_MENU_WIDTH, Math.max(0, viewportWidth - 24));
  const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - width - 12));

  return {
    top: rect.bottom + 8,
    left,
    width,
  };
}

/**
 * @param {object} props
 * @param {() => void} props.closeMenu
 * @param {MenuClickHandler} props.handleImportClick
 * @param {MenuClickHandler} props.handleModeToggle
 * @param {boolean} props.isBrowserImportMode
 * @param {boolean} props.isImporting
 * @param {string} props.menuItemClasses
 * @param {import('../types').MenuPosition} props.menuPosition
 * @param {import('preact').Ref<HTMLDivElement>} props.menuRef
 * @param {boolean} props.showImportModeToggle
 */
function MobileStatusActionsMenuPortal({
  closeMenu,
  handleImportClick,
  handleModeToggle,
  isBrowserImportMode,
  isImporting,
  menuItemClasses,
  menuPosition,
  menuRef,
  showImportModeToggle,
}) {
  return createPortal(
    <div
      ref={menuRef}
      role='menu'
      className='bg-base-100/95 border-base-content/10 text-base-content fixed z-[10000] rounded-xl border p-1.5 shadow-xl backdrop-blur-md'
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        width: `${menuPosition.width}px`,
      }}
    >
      <button
        type='button'
        role='menuitem'
        className={menuItemClasses}
        onClick={event => {
          handleImportClick(event);
          closeMenu();
        }}
        disabled={isImporting}
      >
        <FontAwesomeIcon
          icon={isImporting ? faCircleNotch : faFileImport}
          spin={isImporting}
          className='w-4 text-sm'
        />
        <span>{isImporting ? <Trans>Importing</Trans> : <Trans>Import</Trans>}</span>
      </button>

      {showImportModeToggle ? (
        <button
          type='button'
          role='menuitem'
          className={menuItemClasses}
          style={isBrowserImportMode ? { color: analyzerUiColors.sourceBadgeWebText } : undefined}
          onClick={event => {
            handleModeToggle(event);
          }}
        >
          <FontAwesomeIcon
            icon={isBrowserImportMode ? faLaptopFile : faEye}
            className='w-4 text-sm'
          />
          <span>
            {isBrowserImportMode ? <Trans>Save to Browser</Trans> : <Trans>View temporarily</Trans>}
          </span>
        </button>
      ) : null}
    </div>,
    document.body,
  );
}

/**
 * @param {object} props
 * @param {MenuClickHandler} props.handleImportClick
 * @param {MenuClickHandler} props.handleModeToggle
 * @param {import('../types').ImportMode} props.importMode
 * @param {boolean} props.isImporting
 * @param {boolean} props.showImportModeToggle
 */
export function MobileStatusActionsMenu({
  handleImportClick,
  handleModeToggle,
  importMode,
  isImporting,
  showImportModeToggle,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 12, width: 224 });
  /** @type {import('preact').RefObject<HTMLElement>} */
  const buttonRef = useRef(null);
  /** @type {import('preact').RefObject<HTMLDivElement>} */
  const menuRef = useRef(null);
  const isBrowserImportMode = importMode === 'browser';

  const closeMenu = useCallback(() => setIsOpen(false), []);

  const updateMenuPosition = useCallback(() => {
    setMenuPosition(getMobileStatusActionsMenuPosition(buttonRef.current));
  }, []);

  /** @param {Event} event */
  const toggleMenu = event => {
    event.preventDefault();
    event.stopPropagation();
    updateMenuPosition();
    setIsOpen(current => !current);
  };

  useEffect(() => {
    if (!isOpen) return;

    /** @param {PointerEvent} event */
    const handlePointerDown = event => {
      const target = /** @type {Node | null} */ (event.target);
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    /** @param {KeyboardEvent} event */
    const handleKeyDown = event => {
      if (event.key === 'Escape') closeMenu();
    };
    const handleResize = () => updateMenuPosition();
    const handleScroll = () => closeMenu();

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('resize', handleResize);
    globalThis.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('resize', handleResize);
      globalThis.removeEventListener('scroll', handleScroll, true);
    };
  }, [closeMenu, isOpen, updateMenuPosition]);

  const menuItemClasses =
    'text-base-content/80 hover:bg-base-content/5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45';
  const { t } = useLingui();

  return (
    <div className='ml-auto sm:hidden'>
      <ActionBarButton
        controlRef={buttonRef}
        type='button'
        className='px-2.5 sm:hidden'
        onClick={toggleMenu}
        aria-label={t`Open status actions menu`}
        aria-expanded={isOpen}
        aria-haspopup='menu'
        title={t`More actions`}
      >
        <FontAwesomeIcon icon={faEllipsisVertical} className='text-sm' />
      </ActionBarButton>

      {isOpen ? (
        <MobileStatusActionsMenuPortal
          closeMenu={closeMenu}
          handleImportClick={handleImportClick}
          handleModeToggle={handleModeToggle}
          isBrowserImportMode={isBrowserImportMode}
          isImporting={isImporting}
          menuItemClasses={menuItemClasses}
          menuPosition={menuPosition}
          menuRef={menuRef}
          showImportModeToggle={showImportModeToggle}
        />
      ) : null}
    </div>
  );
}
