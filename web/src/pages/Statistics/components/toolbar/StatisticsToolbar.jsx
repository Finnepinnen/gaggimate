// Main StatisticsToolbar component: orchestrates source/mode/date controls, profile/shot selectors, run button, and search help
import { useState, useRef } from 'preact/hooks';
import '../StatisticsToolbar.css';
import { SOURCE_OPTIONS, MODE_OPTIONS } from './constants';
import {
  formatShotCountLabel,
  formatProfileCountLabel,
  formatCollapsedDateRangeText,
  getDateRangeDisplay,
  getCandidateSummary,
  getToolbarMessages,
} from './helpers';
import {
  useAdvancedSearchSync,
  useDslPreviewOutsideDismiss,
  useToolbarCollapseBehavior,
  useToolbarDropdownBehavior,
} from './hooks';
import {
  ToolbarBusyOverlay,
  CollapsedToolbarStrip,
  ExpandedToolbarControls,
  DateBasisWarning,
  ToolbarNotice,
  SelectionHint,
  DslSelectionPreview,
} from './subcomponents';

export { RunButtonBadge } from './subcomponents';

/**
 * @typedef {import('../../types').StatisticsSourceSelection} StatisticsSourceSelection
 * @typedef {import('../../types').StatisticsMode} StatisticsMode
 * @typedef {import('../../types').StatisticsDetailSection} StatisticsDetailSection
 * @typedef {import('../../types').DateBasisMode} DateBasisMode
 * @typedef {import('../../types').StatisticsQueryIssue} StatisticsQueryIssue
 * @typedef {import('../../types').ProfileSelectionItem} ProfileSelectionItem
 * @typedef {import('../../types').ShotSelectionItem} ShotSelectionItem
 */

/**
 * @param {object} props
 * @param {StatisticsSourceSelection} props.shotSource
 * @param {(source: StatisticsSourceSelection) => void} props.onShotSourceChange
 * @param {StatisticsSourceSelection} props.profileSource
 * @param {(source: StatisticsSourceSelection) => void} props.onProfileSourceChange
 * @param {StatisticsMode} props.mode
 * @param {(mode: StatisticsMode) => void} props.onModeChange
 * @param {(options?: { preferredDetailSection?: StatisticsDetailSection | null }) => void} props.onGo
 * @param {boolean} [props.startLoading]
 * @param {boolean} [props.loading]
 * @param {boolean} [props.metadataLoading]
 * @param {boolean} [props.canGo]
 * @param {ProfileSelectionItem[]} props.profileSelectionItems
 * @param {string[]} props.selectedProfileNames
 * @param {(names: string[]) => void} props.onSelectedProfileNamesChange
 * @param {(item: ProfileSelectionItem) => void} props.onProfilePinToggle
 * @param {ShotSelectionItem[]} props.shotSelectionItems
 * @param {string[]} props.selectedShotKeys
 * @param {(keys: string[]) => void} props.onSelectedShotKeysChange
 * @param {(item: ShotSelectionItem) => void} props.onShotPinToggle
 * @param {string} props.query
 * @param {(query: string) => void} props.onQueryChange
 * @param {string} props.dateFromLocal
 * @param {string} [props.dateFromPreviewLocal]
 * @param {(value: string) => void} props.onDateFromChange
 * @param {string} props.dateToLocal
 * @param {string} [props.dateToPreviewLocal]
 * @param {(value: string) => void} props.onDateToChange
 * @param {DateBasisMode} props.dateBasisMode
 * @param {(mode: DateBasisMode) => void} props.onDateBasisModeChange
 * @param {boolean} [props.showDateBasisWarning]
 * @param {string | null} [props.dateBasisWarningMessage]
 * @param {number | null} props.candidateCount - null while unknown
 * @param {StatisticsQueryIssue[]} [props.parseErrors]
 * @param {StatisticsQueryIssue[]} [props.parseWarnings]
 * @param {() => void} props.onClearFilters
 * @param {string | null} [props.metadataError]
 * @param {string | null} [props.selectionHint]
 * @param {boolean} [props.hasBuiltStatistics]
 * @param {number} [props.builtShotCount]
 * @param {number} [props.builtProfileCount]
 * @param {number | null} [props.builtDateRangeStartMs]
 * @param {number | null} [props.builtDateRangeEndMs]
 */
export function StatisticsToolbar({
  shotSource,
  onShotSourceChange,
  profileSource,
  onProfileSourceChange,
  mode,
  onModeChange,
  onGo,
  startLoading = false,
  loading = false,
  metadataLoading = false,
  canGo = true,
  profileSelectionItems,
  selectedProfileNames,
  onSelectedProfileNamesChange,
  onProfilePinToggle,
  shotSelectionItems,
  selectedShotKeys,
  onSelectedShotKeysChange,
  onShotPinToggle,
  query,
  onQueryChange,
  dateFromLocal,
  dateFromPreviewLocal = '',
  onDateFromChange,
  dateToLocal,
  dateToPreviewLocal = '',
  onDateToChange,
  dateBasisMode,
  onDateBasisModeChange,
  showDateBasisWarning = false,
  dateBasisWarningMessage = null,
  candidateCount,
  parseErrors = [],
  parseWarnings = [],
  onClearFilters,
  metadataError = null,
  selectionHint = null,
  hasBuiltStatistics = false,
  builtShotCount = 0,
  builtProfileCount = 0,
  builtDateRangeStartMs = null,
  builtDateRangeEndMs = null,
}) {
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(() => !!query);
  const [showDslSelectionPreview, setShowDslSelectionPreview] = useState(
    () => !!String(query || '').trim(),
  );
  const dslInputRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const toolbarContainerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [isCollapsedStripExpanded, setIsCollapsedStripExpanded] = useState(false);

  const isBusy = startLoading || loading || metadataLoading;
  const showBusyOverlay = startLoading || metadataLoading;
  const canExecute = canGo && !isBusy;
  const { topError, noticeMessage, noticeTone } = getToolbarMessages({
    parseErrors,
    parseWarnings,
    metadataError,
  });
  const hasDateFilter = Boolean(dateFromLocal || dateToLocal);
  const dateRangeDisplay = getDateRangeDisplay({
    dateFromLocal,
    dateToLocal,
    dateFromPreviewLocal,
    dateToPreviewLocal,
  });
  const showDateRangeLabelInTrigger = !dateRangeDisplay.isAuto;
  const { candidateLabel, resetAriaCount } = getCandidateSummary({
    metadataLoading,
    candidateCount,
  });
  const currentShotSourceOption =
    SOURCE_OPTIONS.find(opt => opt.value === shotSource) || SOURCE_OPTIONS[0];
  const currentProfileSourceOption =
    SOURCE_OPTIONS.find(opt => opt.value === profileSource) || SOURCE_OPTIONS[0];
  const currentModeOption = MODE_OPTIONS.find(opt => opt.value === mode) || MODE_OPTIONS[0];
  const hasDslQuery = !!String(query || '').trim();
  const shotSelectionItemMap = new Map((shotSelectionItems || []).map(item => [item.id, item]));
  const selectedShotPreviewItems = /** @type {ShotSelectionItem[]} */ (
    (selectedShotKeys || []).map(id => shotSelectionItemMap.get(id)).filter(Boolean)
  );
  const selectedProfilePreviewItems = (selectedProfileNames || [])
    .filter(Boolean)
    .map(name => ({ id: name, primary: name }));
  const profilePreviewItems =
    selectedProfilePreviewItems.length > 0
      ? selectedProfilePreviewItems
      : (profileSelectionItems || []).map(item => ({
          id: item.id,
          primary: item.primary || item.id,
        }));
  const shotPreviewItems =
    selectedShotPreviewItems.length > 0 ? selectedShotPreviewItems : shotSelectionItems || [];
  const shouldShowDslSelectionPreview =
    showAdvancedSearch &&
    hasDslQuery &&
    showDslSelectionPreview &&
    (profilePreviewItems.length > 0 || shotPreviewItems.length > 0);
  const shouldCollapseToolbar = Boolean(hasBuiltStatistics);
  const isToolbarExpanded = !shouldCollapseToolbar || isCollapsedStripExpanded;
  const shouldShowSelectionHint = topError || metadataError ? false : isToolbarExpanded;
  const useBlankCollapseLayer = shouldCollapseToolbar && isToolbarExpanded;
  const toolbarPassiveLayerClass = useBlankCollapseLayer ? 'pointer-events-none' : '';
  const toolbarControlClass = useBlankCollapseLayer ? 'pointer-events-auto' : '';
  const busyDropdownClass = isBusy ? 'pointer-events-none opacity-40' : '';
  const collapsedShotCountLabel = formatShotCountLabel(builtShotCount);
  const collapsedProfileCountLabel = formatProfileCountLabel(builtProfileCount);
  const collapsedDateRangeText = formatCollapsedDateRangeText(
    builtDateRangeStartMs,
    builtDateRangeEndMs,
  );
  useAdvancedSearchSync({
    query,
    parseErrorsLength: parseErrors.length,
    parseWarningsLength: parseWarnings.length,
    showAdvancedSearch,
    setShowAdvancedSearch,
    setShowDslSelectionPreview,
  });
  useDslPreviewOutsideDismiss({
    shouldShowDslSelectionPreview,
    isToolbarExpanded,
    dslInputRef,
    setShowDslSelectionPreview,
  });
  useToolbarCollapseBehavior({
    isToolbarExpanded,
    isBusy,
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setShowDslSelectionPreview,
    setIsCollapsedStripExpanded,
  });
  useToolbarDropdownBehavior({ toolbarContainerRef, isToolbarExpanded });

  return (
    <div
      ref={toolbarContainerRef}
      className='relative isolate z-[90] flex w-full min-w-0 flex-col gap-1.5 overflow-visible'
    >
      <ToolbarBusyOverlay visible={showBusyOverlay} />
      {shouldCollapseToolbar && !isToolbarExpanded ? (
        <CollapsedToolbarStrip
          collapsedShotCountLabel={collapsedShotCountLabel}
          collapsedProfileCountLabel={collapsedProfileCountLabel}
          collapsedDateRangeText={collapsedDateRangeText}
          onExpand={() => setIsCollapsedStripExpanded(true)}
        />
      ) : (
        <ExpandedToolbarControls
          useBlankCollapseLayer={useBlankCollapseLayer}
          toolbarPassiveLayerClass={toolbarPassiveLayerClass}
          toolbarControlClass={toolbarControlClass}
          busyDropdownClass={busyDropdownClass}
          setIsCollapsedStripExpanded={setIsCollapsedStripExpanded}
          mode={mode}
          onModeChange={onModeChange}
          isBusy={isBusy}
          currentModeOption={currentModeOption}
          profileSelectionItems={profileSelectionItems}
          selectedProfileNames={selectedProfileNames}
          onSelectedProfileNamesChange={onSelectedProfileNamesChange}
          onProfilePinToggle={onProfilePinToggle}
          shotSelectionItems={shotSelectionItems}
          selectedShotKeys={selectedShotKeys}
          onSelectedShotKeysChange={onSelectedShotKeysChange}
          onShotPinToggle={onShotPinToggle}
          onClearFilters={onClearFilters}
          resetAriaCount={resetAriaCount}
          candidateLabel={candidateLabel}
          onGo={onGo}
          canExecute={canExecute}
          setShowDslSelectionPreview={setShowDslSelectionPreview}
          currentShotSourceOption={currentShotSourceOption}
          currentProfileSourceOption={currentProfileSourceOption}
          shotSource={shotSource}
          onShotSourceChange={onShotSourceChange}
          profileSource={profileSource}
          onProfileSourceChange={onProfileSourceChange}
          hasDateFilter={hasDateFilter}
          showDateRangeLabelInTrigger={showDateRangeLabelInTrigger}
          dateRangeDisplay={dateRangeDisplay}
          dateFromLocal={dateFromLocal}
          onDateFromChange={onDateFromChange}
          dateToLocal={dateToLocal}
          onDateToChange={onDateToChange}
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
          dslInputRef={dslInputRef}
          query={query}
          onQueryChange={onQueryChange}
        />
      )}

      <DateBasisWarning
        visible={isToolbarExpanded && showDateBasisWarning}
        dateBasisWarningMessage={dateBasisWarningMessage}
        dateBasisMode={dateBasisMode}
        onDateBasisModeChange={onDateBasisModeChange}
        isBusy={isBusy}
        toolbarPassiveLayerClass={toolbarPassiveLayerClass}
        toolbarControlClass={toolbarControlClass}
      />

      <ToolbarNotice
        visible={isToolbarExpanded}
        noticeMessage={noticeMessage}
        noticeTone={noticeTone}
        parseErrors={parseErrors}
        parseWarnings={parseWarnings}
        topError={topError}
        toolbarPassiveLayerClass={toolbarPassiveLayerClass}
      />

      <SelectionHint
        visible={shouldShowSelectionHint}
        selectionHint={selectionHint}
        toolbarPassiveLayerClass={toolbarPassiveLayerClass}
      />

      <DslSelectionPreview
        visible={isToolbarExpanded && shouldShowDslSelectionPreview}
        profilePreviewItems={profilePreviewItems}
        shotPreviewItems={shotPreviewItems}
        toolbarPassiveLayerClass={toolbarPassiveLayerClass}
      />
    </div>
  );
}
