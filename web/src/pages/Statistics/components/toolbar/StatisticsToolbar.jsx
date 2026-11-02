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
  const dslInputRef = useRef(null);
  const toolbarContainerRef = useRef(null);
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
  const selectedShotPreviewItems = (selectedShotKeys || [])
    .map(id => shotSelectionItemMap.get(id))
    .filter(Boolean);
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
