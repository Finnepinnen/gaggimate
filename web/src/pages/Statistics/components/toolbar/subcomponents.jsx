import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightLong } from '@fortawesome/free-solid-svg-icons/faArrowRightLong';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons/faCalendarDays';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faUndo } from '@fortawesome/free-solid-svg-icons/faUndo';
// Render-only sub-components for StatisticsToolbar: dropdown trigger buttons, profile/shot menu items, and search help trigger
import { SourceMarker } from '../../../ShotAnalyzer/components/SourceMarker';
import { StatisticsSearchHelp } from '../StatisticsSearchHelp';
import { StatisticsMultiSelectDropdown } from '../StatisticsMultiSelectDropdown';
import { DropdownPanel } from '../statisticsSurfaces.jsx';
import { AnalyzerControl } from '../../../ShotAnalyzer/components/AnalyzerControl.jsx';
import { cx } from '../../../../utils/cx.js';
import {
  SOURCE_OPTIONS,
  MODE_OPTIONS,
  DATE_BASIS_OPTIONS,
  WARNING_ORANGE_TEXT_STYLE,
  WARNING_ORANGE_TEXT_MUTED_STYLE,
} from './constants';
import { getDateBasisOptionTitle } from './helpers';
import { Trans, useLingui } from '@lingui/react/macro';
import { i18n } from '../../../../i18n.js';

/**
 * @typedef {import('../../types').StatisticsSourceSelection} StatisticsSourceSelection
 * @typedef {import('../../types').StatisticsMode} StatisticsMode
 * @typedef {import('../../types').DateBasisMode} DateBasisMode
 * @typedef {import('../../types').StatisticsQueryIssue} StatisticsQueryIssue
 * @typedef {import('../../types').ProfileSelectionItem} ProfileSelectionItem
 * @typedef {import('../../types').ShotSelectionItem} ShotSelectionItem
 * @typedef {import('./helpers').DateRangeDisplay} DateRangeDisplay
 * @typedef {typeof SOURCE_OPTIONS[number]} SourceOption
 * @typedef {typeof MODE_OPTIONS[number]} ModeOption
 * @typedef {(value: boolean) => void} BooleanSetter
 * @typedef {{ isBusy: boolean, toolbarControlClass: string }} ToolbarControlProps
 * @typedef {ToolbarControlProps & { busyDropdownClass: string }} ToolbarDropdownProps
 * @typedef {ToolbarDropdownProps & {
 *   mode: StatisticsMode,
 *   onModeChange: (mode: StatisticsMode) => void,
 *   currentModeOption: ModeOption,
 * }} ModeSelectionDropdownProps
 * @typedef {ToolbarControlProps & {
 *   mode: StatisticsMode,
 *   profileSelectionItems: ProfileSelectionItem[],
 *   selectedProfileNames: string[],
 *   onSelectedProfileNamesChange: (names: string[]) => void,
 *   onProfilePinToggle: (item: ProfileSelectionItem) => void,
 *   shotSelectionItems: ShotSelectionItem[],
 *   selectedShotKeys: string[],
 *   onSelectedShotKeysChange: (keys: string[]) => void,
 *   onShotPinToggle: (item: ShotSelectionItem) => void,
 * }} SelectionDropdownsProps
 * @typedef {ToolbarDropdownProps & {
 *   currentShotSourceOption: SourceOption,
 *   currentProfileSourceOption: SourceOption,
 *   shotSource: StatisticsSourceSelection,
 *   onShotSourceChange: (source: StatisticsSourceSelection) => void,
 *   profileSource: StatisticsSourceSelection,
 *   onProfileSourceChange: (source: StatisticsSourceSelection) => void,
 * }} SourceSelectionDropdownProps
 * @typedef {ToolbarDropdownProps & {
 *   hasDateFilter: boolean,
 *   showDateRangeLabelInTrigger: boolean,
 *   dateRangeDisplay: DateRangeDisplay,
 *   dateFromLocal: string,
 *   onDateFromChange: (value: string) => void,
 *   dateToLocal: string,
 *   onDateToChange: (value: string) => void,
 * }} DateRangeDropdownProps
 * @typedef {ToolbarControlProps & {
 *   showAdvancedSearch: boolean,
 *   setShowAdvancedSearch: BooleanSetter,
 *   setShowDslSelectionPreview: BooleanSetter,
 *   dslInputRef: import('preact').Ref<HTMLDivElement>,
 *   query: string,
 *   onQueryChange: (query: string) => void,
 * }} AdvancedSearchControlsProps
 */

/**
 * Small badge styled like the toolbar's run button, for inline hints.
 *
 * @param {object} props
 * @param {import('preact').ComponentChildren} [props.children]
 */
export function RunButtonBadge({ children }) {
  return (
    <span className='bg-success text-success-content hover:bg-success/92 hover:text-success-content inline-flex h-5 w-5 items-center justify-center rounded-md'>
      {children}
    </span>
  );
}

/**
 * Full-height button in the toolbar's top row. Extra props go to the button.
 *
 * @param {{ className?: string, children?: import('preact').ComponentChildren } & Record<string, any>} props
 */
function ToolbarButton({ className, children, ...props }) {
  return (
    <AnalyzerControl
      {...props}
      variant='surface'
      className={cx(
        'btn btn-md inline-flex h-10 min-h-10 justify-center rounded-lg border-none px-0 shadow-none disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      {children}
    </AnalyzerControl>
  );
}

/**
 * Small neutral text control. Renders a button unless `as` says otherwise.
 *
 * @param {{ active?: boolean, className?: string } & Record<string, any>} props
 */
function CompactNeutralButton({ active = false, className, children, ...props }) {
  return (
    <AnalyzerControl
      {...props}
      variant='text'
      className={cx(
        'hover:text-base-content h-9 min-h-0 rounded-lg bg-transparent px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'text-base-content' : 'text-base-content/65',
        className,
      )}
    >
      {children}
    </AnalyzerControl>
  );
}

/**
 * Item button in a toolbar dropdown menu.
 *
 * @param {{ tone?: 'neutral' | 'primary', active?: boolean, className?: string } & Record<string, any>} props
 */
function MenuItemButton({ tone = 'neutral', active = false, className, children, ...buttonProps }) {
  let toneClasses;
  if (tone === 'primary') {
    toneClasses = active
      ? 'bg-primary text-primary-content hover:bg-primary/92'
      : 'text-primary hover:bg-primary/12';
  } else {
    toneClasses = active
      ? 'text-base-content hover:bg-base-content/5'
      : 'text-base-content/75 hover:bg-base-content/5 hover:text-base-content';
  }
  return (
    <button {...buttonProps} className={cx(className, toneClasses)}>
      {children}
    </button>
  );
}

/**
 * Row of joined segment buttons.
 *
 * @param {object} props
 * @param {string} [props.className]
 * @param {import('preact').ComponentChildren} [props.children]
 */
function SegmentGroup({ className, children }) {
  return (
    <div
      className={cx(
        'bg-base-content/4 divide-base-content/10 inline-flex divide-x overflow-hidden rounded-lg',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Compact button inside a SegmentGroup.
 *
 * @param {{ active?: boolean, activeTone?: 'secondary' | 'neutral' } & Record<string, any>} props
 */
function SegmentButton({ active = false, activeTone = 'neutral', children, ...buttonProps }) {
  let stateClasses = 'bg-base-100/50 text-base-content/75 hover:bg-base-200/70';
  if (active) {
    stateClasses =
      activeTone === 'secondary'
        ? 'bg-secondary text-secondary-content'
        : 'bg-base-content/10 text-base-content';
  }
  return (
    <button
      {...buttonProps}
      className={cx(
        'flex h-9 min-h-0 items-center justify-center border-0 px-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        stateClasses,
      )}
    >
      {children}
    </button>
  );
}

/** @param {SourceOption | undefined} option */
function renderCompactSourceSummary(option) {
  if (!option) return null;
  if (option.value === 'both') {
    return (
      <span className='inline-flex items-center gap-0.5'>
        <SourceMarker source='gaggimate' variant='compact' />
        <SourceMarker source='browser' variant='compact' />
      </span>
    );
  }

  return <SourceMarker source={option.value} variant='compact' />;
}

/** @param {{ shotOption: SourceOption, profileOption: SourceOption }} options */
function renderCombinedSourceSummary({ shotOption, profileOption }) {
  return (
    <span className='inline-flex min-w-0 items-center gap-1.5'>
      <span className='inline-flex min-w-0 items-center gap-1.5'>
        <span className='shrink-0'>{renderCompactSourceSummary(shotOption)}</span>
        <span className='text-base-content/70 min-w-0 truncate text-[11px] font-semibold'>
          <Trans>Shots</Trans>
        </span>
      </span>
      <span className='text-base-content/35 shrink-0'>·</span>
      <span className='inline-flex min-w-0 items-center gap-1.5'>
        <span className='shrink-0'>{renderCompactSourceSummary(profileOption)}</span>
        <span className='text-base-content/70 min-w-0 truncate text-[11px] font-semibold'>
          <Trans>Profiles</Trans>
        </span>
      </span>
    </span>
  );
}

/** @param {SourceOption | undefined} option */
function renderSourceOptionContent(option) {
  if (!option) return null;
  if (option.value === 'both') {
    return <span>{i18n._(option.label)}</span>;
  }

  return (
    <span className='inline-flex items-center gap-2'>
      <SourceMarker source={option.value} variant='compact' />
      {/* `any`: i18n._ takes a plain id or a descriptor, but its overloads reject the union. */}
      <span>{i18n._(/** @type {any} */ (option.label))}</span>
    </span>
  );
}

/** @param {{ visible: boolean }} props */
export function ToolbarBusyOverlay({ visible }) {
  if (!visible) return null;

  return (
    <div className='pointer-events-none absolute inset-0 z-30 flex items-center justify-center'>
      <span className='loading loading-spinner loading-md text-base-content/35' />
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.collapsedShotCountLabel
 * @param {string} props.collapsedProfileCountLabel
 * @param {string | number} props.collapsedDateRangeText
 * @param {() => void} props.onExpand
 */
export function CollapsedToolbarStrip({
  collapsedShotCountLabel,
  collapsedProfileCountLabel,
  collapsedDateRangeText,
  onExpand,
}) {
  const { t } = useLingui();
  return (
    <button
      type='button'
      onClick={onExpand}
      className='text-base-content/70 hover:bg-base-content/4 hover:text-base-content -mx-1.5 -my-1.5 flex h-6 min-h-0 w-[calc(100%+0.75rem)] cursor-pointer items-center rounded-lg bg-transparent px-2 text-[10px] font-semibold transition-colors duration-150 sm:-mx-2 sm:-my-2 sm:w-[calc(100%+1rem)]'
      aria-label={t`Expand statistics toolbar`}
      title={t`Expand statistics toolbar`}
    >
      <div className='flex h-6 w-full min-w-0 items-center gap-2 px-2'>
        <div className='flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left'>
          <span className='shrink-0'>{collapsedShotCountLabel}</span>
          <span className='text-base-content/25 shrink-0' aria-hidden='true'>
            ·
          </span>
          <span className='shrink-0'>{collapsedProfileCountLabel}</span>
          <span className='text-base-content/25 shrink-0' aria-hidden='true'>
            ·
          </span>
          <span className='min-w-0 truncate'>{collapsedDateRangeText}</span>
        </div>
        <span className='text-base-content/55 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[10px]'>
          <FontAwesomeIcon icon={faPlus} />
        </span>
      </div>
    </button>
  );
}

/** @param {ModeSelectionDropdownProps} props */
export function ModeSelectionDropdown({
  mode,
  onModeChange,
  isBusy,
  currentModeOption,
  toolbarControlClass,
  busyDropdownClass,
}) {
  const { t } = useLingui();
  return (
    <details
      className={`dropdown max-w-full ${toolbarControlClass} ${busyDropdownClass}`.trim()}
      data-close-on-outside
    >
      <AnalyzerControl
        as='summary'
        variant='surface'
        className={cx(
          'btn btn-md bg-primary text-primary-content hover:bg-primary/92 h-10 min-h-10 w-[7rem] list-none justify-between rounded-lg border-none px-2 text-sm font-semibold shadow-none [&::-webkit-details-marker]:hidden',
          isBusy && 'pointer-events-none opacity-40',
        )}
        aria-label={t`Select statistics mode`}
        title={t`Select statistics mode`}
      >
        <span className='truncate'>{i18n._(currentModeOption.label)}</span>
        <FontAwesomeIcon icon={faChevronDown} className='-ml-0.5 text-[10px] opacity-70' />
      </AnalyzerControl>

      <DropdownPanel className='dropdown-content mt-2 w-40 p-1.5'>
        <div className='grid gap-1'>
          {MODE_OPTIONS.map(opt => (
            <MenuItemButton
              key={opt.value}
              type='button'
              tone='primary'
              active={mode === opt.value}
              className='flex h-9 min-h-0 items-center justify-between rounded-lg px-3 text-xs font-semibold transition-colors'
              onClick={
                /** @param {import('preact').JSX.TargetedMouseEvent<HTMLButtonElement>} e */
                e => {
                  onModeChange(opt.value);
                  closeParentDetails(e.currentTarget);
                }
              }
              disabled={isBusy}
            >
              <span>{i18n._(opt.label)}</span>
              {mode === opt.value && (
                <span className='text-[10px] opacity-70'>
                  <Trans context='selected menu item'>Active</Trans>
                </span>
              )}
            </MenuItemButton>
          ))}
        </div>
      </DropdownPanel>
    </details>
  );
}

/** @param {Element} target */
function closeParentDetails(target) {
  const details = target.closest('details');
  if (details) details.open = false;
}

/** @param {SelectionDropdownsProps} props */
export function SelectionDropdowns({
  mode,
  profileSelectionItems,
  selectedProfileNames,
  onSelectedProfileNamesChange,
  onProfilePinToggle,
  shotSelectionItems,
  selectedShotKeys,
  onSelectedShotKeysChange,
  onShotPinToggle,
  isBusy,
  toolbarControlClass,
}) {
  const { t } = useLingui();
  const profileDropdown = (
    <StatisticsMultiSelectDropdown
      label={t`Profiles`}
      itemLabel={t`profile`}
      items={profileSelectionItems}
      selectedIds={selectedProfileNames}
      onChange={onSelectedProfileNamesChange}
      onTogglePin={onProfilePinToggle}
      disabled={isBusy}
      accentTone='primary'
      emptyText={t`Select Profiles...`}
      triggerClassName='btn btn-md h-10 min-h-10 border-none shadow-none'
      rootClassName={toolbarControlClass}
    />
  );
  const shotDropdown = (
    <StatisticsMultiSelectDropdown
      label={t`Shots`}
      itemLabel={t`shot`}
      items={shotSelectionItems}
      selectedIds={selectedShotKeys}
      onChange={onSelectedShotKeysChange}
      onTogglePin={onShotPinToggle}
      disabled={isBusy}
      accentTone='primary'
      emptyText={t`Select Shots...`}
      triggerClassName='btn btn-md h-10 min-h-10 border-none shadow-none'
      rootClassName={toolbarControlClass}
    />
  );

  if (mode === 'profile') {
    return (
      <>
        {profileDropdown}
        {shotDropdown}
      </>
    );
  }

  if (mode === 'shots') {
    return (
      <>
        {shotDropdown}
        {profileDropdown}
      </>
    );
  }

  return null;
}

/** @param {SourceSelectionDropdownProps} props */
export function SourceSelectionDropdown({
  currentShotSourceOption,
  currentProfileSourceOption,
  shotSource,
  onShotSourceChange,
  profileSource,
  onProfileSourceChange,
  isBusy,
  toolbarControlClass,
  busyDropdownClass,
}) {
  const { t } = useLingui();
  const sourceGroups = [
    {
      key: 'shots',
      label: t`Shots`,
      value: shotSource,
      onChange: onShotSourceChange,
    },
    {
      key: 'profiles',
      label: t`Profiles`,
      value: profileSource,
      onChange: onProfileSourceChange,
    },
  ];

  return (
    <details
      className={`dropdown max-w-full ${toolbarControlClass} ${busyDropdownClass}`.trim()}
      data-close-on-outside
    >
      <AnalyzerControl
        as='summary'
        variant='surface'
        className={cx(
          'text-base-content/70 hover:text-base-content flex h-9 min-h-0 w-[15rem] max-w-full list-none items-center justify-between gap-2 rounded-lg bg-transparent px-2 text-xs font-bold [&::-webkit-details-marker]:hidden',
          isBusy && 'pointer-events-none opacity-40',
        )}
        aria-label={t`Select shot and profile sources`}
        title={t`Select shot and profile sources`}
      >
        <span className='min-w-0 flex-1 truncate text-left'>
          {renderCombinedSourceSummary({
            shotOption: currentShotSourceOption,
            profileOption: currentProfileSourceOption,
          })}
        </span>
        <FontAwesomeIcon icon={faChevronDown} className='-ml-0.5 text-[10px] opacity-70' />
      </AnalyzerControl>

      <DropdownPanel className='dropdown-content mt-2 w-[min(92vw,18rem)] p-2'>
        <div className='grid gap-2'>
          {sourceGroups.map(group => (
            <div key={group.key} className='grid gap-1.5'>
              <div className='text-base-content/55 px-1 text-xs font-medium'>{group.label}</div>
              <div className='grid grid-cols-3 gap-1'>
                {SOURCE_OPTIONS.map(opt => (
                  <MenuItemButton
                    key={`${group.key}-${opt.value}`}
                    type='button'
                    active={group.value === opt.value}
                    className='flex h-9 min-h-0 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors'
                    onClick={() => {
                      group.onChange(opt.value);
                    }}
                    disabled={isBusy}
                  >
                    {renderSourceOptionContent(opt)}
                  </MenuItemButton>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DropdownPanel>
    </details>
  );
}

/** @param {DateRangeDropdownProps} props */
export function DateRangeDropdown({
  hasDateFilter,
  showDateRangeLabelInTrigger,
  dateRangeDisplay,
  dateFromLocal,
  onDateFromChange,
  dateToLocal,
  onDateToChange,
  isBusy,
  toolbarControlClass,
  busyDropdownClass,
}) {
  const { t } = useLingui();
  const dateModeText = dateRangeDisplay.isAuto
    ? t`Using auto range from current shot selection.`
    : t`Manual date filter is active.`;

  return (
    <details
      className={`dropdown ${toolbarControlClass} ${busyDropdownClass}`.trim()}
      data-close-on-outside
    >
      <AnalyzerControl
        as='summary'
        variant='surface'
        className={cx(
          'flex h-9 min-h-0 w-[11.25rem] list-none items-center gap-1.5 rounded-lg bg-transparent px-2 text-left text-xs sm:w-[12.5rem] md:w-[15rem] [&::-webkit-details-marker]:hidden',
          hasDateFilter ? 'text-base-content' : 'text-base-content/70 hover:text-base-content',
          busyDropdownClass,
        )}
        aria-label={t`Edit date range filter`}
        title={t`Edit date range filter`}
      >
        <FontAwesomeIcon
          icon={faCalendarDays}
          className={`shrink-0 ${hasDateFilter ? 'text-base-content/70' : 'text-base-content/45'}`}
        />
        {showDateRangeLabelInTrigger && (
          <>
            <span className='shrink-0 font-semibold tracking-wide'>{dateRangeDisplay.label}</span>
            <span className='text-base-content/35 shrink-0'>·</span>
          </>
        )}
        <span className='min-w-0 flex-1 truncate'>
          {dateRangeDisplay.fromText || t`No dates`}
          {dateRangeDisplay.toText && (
            <>
              <span className='text-base-content/35 mx-1.5 inline-block align-middle'>
                <FontAwesomeIcon icon={faArrowRightLong} className='text-[9px]' />
              </span>
              {dateRangeDisplay.toText}
            </>
          )}
        </span>
        <FontAwesomeIcon icon={faChevronDown} className='-ml-0.5 shrink-0 text-[9px] opacity-50' />
      </AnalyzerControl>

      <DropdownPanel className='dropdown-content mt-2 w-[min(92vw,26rem)] p-3'>
        <div className='grid gap-2'>
          <label className='text-base-content/75 flex items-center gap-2 text-[11px] font-semibold'>
            <span className='w-10 shrink-0'>
              <Trans context='date range start'>From</Trans>
            </span>
            <input
              type='date'
              value={dateFromLocal}
              onInput={
                /** @param {import('preact').JSX.TargetedEvent<HTMLInputElement, Event>} e */
                e => onDateFromChange(e.currentTarget.value)
              }
              className='analyzer-statistics-datetime input border-base-content/10 bg-base-100/50 h-9 min-h-0 w-full text-xs'
              disabled={isBusy}
              aria-label={t`Start date`}
              title={t`Start date`}
            />
          </label>

          <label className='text-base-content/75 flex items-center gap-2 text-[11px] font-semibold'>
            <span className='w-10 shrink-0'>
              <Trans context='date range end'>To</Trans>
            </span>
            <input
              type='date'
              value={dateToLocal}
              onInput={
                /** @param {import('preact').JSX.TargetedEvent<HTMLInputElement, Event>} e */
                e => onDateToChange(e.currentTarget.value)
              }
              className='analyzer-statistics-datetime input border-base-content/10 bg-base-100/50 h-9 min-h-0 w-full text-xs'
              disabled={isBusy}
              aria-label={t`End date`}
              title={t`End date`}
            />
          </label>
        </div>

        <div className='mt-3 flex items-center justify-between gap-2'>
          <div className='text-base-content/55 text-[10px]'>{dateModeText}</div>
          <CompactNeutralButton
            type='button'
            onClick={() => {
              onDateFromChange('');
              onDateToChange('');
            }}
            disabled={isBusy || (!dateFromLocal && !dateToLocal)}
            title={t`Clear date filter`}
          >
            <Trans>Clear Date Filter</Trans>
          </CompactNeutralButton>
        </div>
      </DropdownPanel>
    </details>
  );
}

/** @param {AdvancedSearchControlsProps} props */
export function AdvancedSearchControls({
  showAdvancedSearch,
  setShowAdvancedSearch,
  setShowDslSelectionPreview,
  dslInputRef,
  query,
  onQueryChange,
  isBusy,
  toolbarControlClass,
}) {
  const { t } = useLingui();
  const searchLayoutClass = showAdvancedSearch
    ? 'basis-full flex-wrap md:ml-auto md:flex-1 md:basis-auto md:flex-nowrap'
    : 'ml-auto';

  return (
    <div
      className={`flex min-w-0 items-center justify-end gap-2 ${searchLayoutClass} ${toolbarControlClass}`.trim()}
    >
      {showAdvancedSearch && (
        <div
          ref={dslInputRef}
          className={`min-w-0 basis-full md:max-w-[38rem] md:min-w-[16rem] md:flex-1 ${toolbarControlClass}`.trim()}
        >
          <input
            type='text'
            value={query}
            onInput={
              /** @param {import('preact').JSX.TargetedEvent<HTMLInputElement, Event>} e */
              e => {
                setShowDslSelectionPreview(!!String(e.currentTarget.value || '').trim());
                onQueryChange(e.currentTarget.value);
              }
            }
            onFocus={() => setShowDslSelectionPreview(true)}
            onClick={() => setShowDslSelectionPreview(true)}
            placeholder='name:"325"; profile:3_0_25; date:>h-7d;'
            className='input border-base-content/10 bg-base-100/50 h-9 min-h-0 w-full text-xs'
            disabled={isBusy}
          />
        </div>
      )}

      {showAdvancedSearch && (
        <div className={toolbarControlClass}>
          <StatisticsSearchHelp />
        </div>
      )}

      <CompactNeutralButton
        as='label'
        active={showAdvancedSearch}
        title={t`Toggle advanced search`}
        className={cx('gap-2', isBusy && 'pointer-events-none opacity-40', toolbarControlClass)}
      >
        <input
          type='checkbox'
          checked={showAdvancedSearch}
          disabled={isBusy}
          aria-label={t`Toggle advanced search`}
          className='toggle toggle-primary toggle-xs'
          onChange={
            /** @param {import('preact').JSX.TargetedEvent<HTMLInputElement, Event>} event */
            event => {
              const next = event.currentTarget.checked;
              setShowAdvancedSearch(next);
              if (!next) setShowDslSelectionPreview(false);
            }
          }
        />
        <span>
          <Trans>Advanced</Trans>
        </span>
      </CompactNeutralButton>
    </div>
  );
}

/**
 * @param {Omit<ModeSelectionDropdownProps, 'toolbarControlClass'>
 *   & SelectionDropdownsProps
 *   & SourceSelectionDropdownProps
 *   & DateRangeDropdownProps
 *   & AdvancedSearchControlsProps
 *   & {
 *     useBlankCollapseLayer: boolean,
 *     toolbarPassiveLayerClass: string,
 *     setIsCollapsedStripExpanded: BooleanSetter,
 *     onClearFilters: () => void,
 *     resetAriaCount: string,
 *     candidateLabel: string,
 *     onGo: () => void,
 *     canExecute: boolean,
 *   }} props
 */
export function ExpandedToolbarControls({
  useBlankCollapseLayer,
  toolbarPassiveLayerClass,
  toolbarControlClass,
  busyDropdownClass,
  setIsCollapsedStripExpanded,
  mode,
  onModeChange,
  isBusy,
  currentModeOption,
  profileSelectionItems,
  selectedProfileNames,
  onSelectedProfileNamesChange,
  onProfilePinToggle,
  shotSelectionItems,
  selectedShotKeys,
  onSelectedShotKeysChange,
  onShotPinToggle,
  onClearFilters,
  resetAriaCount,
  candidateLabel,
  onGo,
  canExecute,
  setShowDslSelectionPreview,
  currentShotSourceOption,
  currentProfileSourceOption,
  shotSource,
  onShotSourceChange,
  profileSource,
  onProfileSourceChange,
  hasDateFilter,
  showDateRangeLabelInTrigger,
  dateRangeDisplay,
  dateFromLocal,
  onDateFromChange,
  dateToLocal,
  onDateToChange,
  showAdvancedSearch,
  setShowAdvancedSearch,
  dslInputRef,
  query,
  onQueryChange,
}) {
  const { t } = useLingui();
  return (
    <div className={`relative z-10 flex flex-col gap-1.5 ${toolbarPassiveLayerClass}`}>
      {useBlankCollapseLayer ? (
        <button
          type='button'
          className='pointer-events-auto absolute inset-0 z-0 rounded-xl bg-transparent'
          onClick={() => setIsCollapsedStripExpanded(false)}
          tabIndex={-1}
          aria-label={t`Collapse statistics toolbar`}
          title={t`Collapse statistics toolbar`}
        />
      ) : null}

      <div
        className={`relative z-20 flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 ${toolbarPassiveLayerClass}`.trim()}
      >
        <ModeSelectionDropdown
          mode={mode}
          onModeChange={onModeChange}
          isBusy={isBusy}
          currentModeOption={currentModeOption}
          toolbarControlClass={toolbarControlClass}
          busyDropdownClass={busyDropdownClass}
        />

        <SelectionDropdowns
          mode={mode}
          profileSelectionItems={profileSelectionItems}
          selectedProfileNames={selectedProfileNames}
          onSelectedProfileNamesChange={onSelectedProfileNamesChange}
          onProfilePinToggle={onProfilePinToggle}
          shotSelectionItems={shotSelectionItems}
          selectedShotKeys={selectedShotKeys}
          onSelectedShotKeysChange={onSelectedShotKeysChange}
          onShotPinToggle={onShotPinToggle}
          isBusy={isBusy}
          toolbarControlClass={toolbarControlClass}
        />

        <div className={`ml-auto flex items-center gap-2 ${toolbarControlClass}`.trim()}>
          <ToolbarButton
            type='button'
            onClick={onClearFilters}
            className={cx(
              'bg-base-content/4 text-base-content/70 hover:bg-base-content/7 hover:text-base-content w-12 flex-col items-center gap-0.5',
              toolbarControlClass,
            )}
            disabled={isBusy}
            aria-label={t`Clear filters and selections (${resetAriaCount})`}
            title={t`Clear filters and selections (${resetAriaCount})`}
          >
            <FontAwesomeIcon icon={faUndo} className='text-lg leading-none' />
            <span className='text-[10px] leading-none font-semibold tabular-nums'>
              {candidateLabel}
            </span>
          </ToolbarButton>

          <ToolbarButton
            type='button'
            onClick={() => {
              setShowDslSelectionPreview(false);
              onGo();
            }}
            disabled={!canExecute}
            className={cx(
              'bg-success text-success-content hover:bg-success/92 hover:text-success-content w-[6rem] items-center',
              toolbarControlClass,
            )}
            aria-label={t`Play statistics`}
            title={t`Play statistics`}
          >
            <FontAwesomeIcon icon={faPlay} className='text-[1.35rem]' />
          </ToolbarButton>
        </div>
      </div>

      <div
        className={`relative z-10 flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 pt-0.5 ${toolbarPassiveLayerClass}`.trim()}
      >
        <SourceSelectionDropdown
          currentShotSourceOption={currentShotSourceOption}
          currentProfileSourceOption={currentProfileSourceOption}
          shotSource={shotSource}
          onShotSourceChange={onShotSourceChange}
          profileSource={profileSource}
          onProfileSourceChange={onProfileSourceChange}
          isBusy={isBusy}
          toolbarControlClass={toolbarControlClass}
          busyDropdownClass={busyDropdownClass}
        />

        <DateRangeDropdown
          hasDateFilter={hasDateFilter}
          showDateRangeLabelInTrigger={showDateRangeLabelInTrigger}
          dateRangeDisplay={dateRangeDisplay}
          dateFromLocal={dateFromLocal}
          onDateFromChange={onDateFromChange}
          dateToLocal={dateToLocal}
          onDateToChange={onDateToChange}
          isBusy={isBusy}
          toolbarControlClass={toolbarControlClass}
          busyDropdownClass={busyDropdownClass}
        />

        <AdvancedSearchControls
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
          setShowDslSelectionPreview={setShowDslSelectionPreview}
          dslInputRef={dslInputRef}
          query={query}
          onQueryChange={onQueryChange}
          isBusy={isBusy}
          toolbarControlClass={toolbarControlClass}
        />
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string | null} props.dateBasisWarningMessage
 * @param {DateBasisMode} props.dateBasisMode
 * @param {(mode: DateBasisMode) => void} props.onDateBasisModeChange
 * @param {boolean} props.isBusy
 * @param {string} props.toolbarPassiveLayerClass
 * @param {string} props.toolbarControlClass
 */
export function DateBasisWarning({
  visible,
  dateBasisWarningMessage,
  dateBasisMode,
  onDateBasisModeChange,
  isBusy,
  toolbarPassiveLayerClass,
  toolbarControlClass,
}) {
  const { t } = useLingui();
  if (!visible) return null;

  return (
    <div
      className={`flex w-full min-w-0 flex-wrap items-center gap-2 rounded-lg border px-2 py-2 ${toolbarPassiveLayerClass}`.trim()}
      style={{
        borderColor: 'color-mix(in srgb, var(--analyzer-warning-orange) 28%, transparent)',
        background: 'color-mix(in srgb, var(--analyzer-warning-orange) 9%, transparent)',
      }}
    >
      <div
        className='min-w-[14rem] flex-1 text-[11px] leading-relaxed'
        style={WARNING_ORANGE_TEXT_MUTED_STYLE}
      >
        <span className='font-semibold' style={WARNING_ORANGE_TEXT_STYLE}>
          <Trans>Date Basis:</Trans>
        </span>{' '}
        <span className='text-base-content/80'>
          {dateBasisWarningMessage ||
            t`Some shots have no shot timestamp. Choose how date handling should treat them.`}
        </span>
      </div>
      <SegmentGroup className={toolbarControlClass}>
        {DATE_BASIS_OPTIONS.map(opt => (
          <SegmentButton
            key={opt.value}
            type='button'
            active={dateBasisMode === opt.value}
            activeTone={opt.value === 'auto' ? 'secondary' : 'neutral'}
            onClick={() => onDateBasisModeChange(opt.value)}
            disabled={isBusy}
            title={getDateBasisOptionTitle(opt.value)}
          >
            {i18n._(opt.label)}
          </SegmentButton>
        ))}
      </SegmentGroup>
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string | null} props.noticeMessage
 * @param {'error' | 'warning'} props.noticeTone
 * @param {StatisticsQueryIssue[]} props.parseErrors
 * @param {StatisticsQueryIssue[]} props.parseWarnings
 * @param {string | null} props.topError
 * @param {string} props.toolbarPassiveLayerClass
 */
export function ToolbarNotice({
  visible,
  noticeMessage,
  noticeTone,
  parseErrors,
  parseWarnings,
  topError,
  toolbarPassiveLayerClass,
}) {
  const { t } = useLingui();
  if (!visible || !noticeMessage) return null;

  const moreErrorCount = parseErrors.length - 1;
  const moreWarningCount = parseWarnings.length - 1;
  const messageClass = noticeTone === 'error' ? 'text-error font-semibold' : 'font-semibold';
  const messageStyle = noticeTone === 'error' ? undefined : WARNING_ORANGE_TEXT_STYLE;

  return (
    <div
      className={`flex min-h-5 items-center gap-2 px-1 text-[11px] ${toolbarPassiveLayerClass}`.trim()}
    >
      <span className={messageClass} style={messageStyle}>
        {noticeMessage}
      </span>
      {parseErrors.length > 1 && (
        <span className='text-error/70'>{t`+${moreErrorCount} more`}</span>
      )}
      {topError ? null : (
        <>
          {parseWarnings.length > 1 && (
            <span style={WARNING_ORANGE_TEXT_MUTED_STYLE}>{t`+${moreWarningCount} more`}</span>
          )}
        </>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string | null} props.selectionHint
 * @param {string} props.toolbarPassiveLayerClass
 */
export function SelectionHint({ visible, selectionHint, toolbarPassiveLayerClass }) {
  if (!visible || !selectionHint) return null;

  return (
    <div
      className={`px-1 text-[11px] font-semibold ${toolbarPassiveLayerClass}`.trim()}
      style={{ color: 'var(--analyzer-warning-orange)' }}
    >
      {selectionHint}
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {{ id: string, primary: string }[]} props.profilePreviewItems
 * @param {ShotSelectionItem[]} props.shotPreviewItems
 * @param {string} props.toolbarPassiveLayerClass
 */
export function DslSelectionPreview({
  visible,
  profilePreviewItems,
  shotPreviewItems,
  toolbarPassiveLayerClass,
}) {
  const { t } = useLingui();
  if (!visible) return null;
  const profilePreviewCount = profilePreviewItems.length;
  const shotPreviewCount = shotPreviewItems.length;

  return (
    <div
      className={`bg-base-100/55 border-base-content/10 flex w-full min-w-0 flex-col gap-3 rounded-lg border p-3 shadow-sm ${toolbarPassiveLayerClass}`.trim()}
    >
      {profilePreviewItems.length > 0 && (
        <div className='min-w-0 space-y-2'>
          <div className='text-secondary text-xs font-medium'>
            <Trans>Profiles ({profilePreviewCount})</Trans>
          </div>
          <div className='max-h-24 overflow-auto'>
            <div className='flex flex-wrap gap-1.5'>
              {profilePreviewItems.map(item => (
                <span
                  key={item.id}
                  className='border-secondary/20 bg-secondary/12 text-secondary inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[11px] font-semibold'
                >
                  {item.primary}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {shotPreviewItems.length > 0 && (
        <div className='min-w-0 space-y-2'>
          <div className='text-primary text-xs font-medium'>
            <Trans>Shots ({shotPreviewCount})</Trans>
          </div>
          <div className='border-base-content/8 bg-base-100/40 max-h-40 overflow-auto rounded-md border'>
            <div className='divide-base-content/8 divide-y'>
              {shotPreviewItems.map(item => {
                const shotId = item.shotId;
                return (
                  <div key={item.id} className='flex min-w-0 flex-col gap-0.5 px-2.5 py-2'>
                    <div className='text-base-content/85 truncate text-[11px] font-semibold'>
                      {item.fileStem || item.primary}
                    </div>
                    {(item.shotId || item.secondary) && (
                      <div className='text-base-content/55 truncate text-[10px]'>
                        {item.shotId ? t`ID: ${shotId}` : ''}
                        {item.shotId && item.secondary ? ' • ' : ''}
                        {item.secondary || ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
