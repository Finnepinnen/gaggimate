# Improvements

Loose ends and code patterns worth fixing. Paths are relative to `web/src/`; line numbers are from
the audit on 2026-11-06 and will drift, so search for the quoted symbol if a line doesn't match.

## Unfinished

- **Final-weight overlays are never shown** —
  `pages/ShotAnalyzer/components/shotChart/compare/compareChartConfig.js` and
  `single/createShotChartConfigs.js` wire up `finalWeightCalloutLine` / `finalWeightBadgeOverlay`
  (`helpers/overlayPlugins.js`) and look for `final_weight_callout_meta` / `final_weight`
  annotations, but no chart model creates them. Either finish the feature or remove the
  plugins.

## Bugs

- **Leftover timers (low)** — timeouts in `pages/ProfileList/index.jsx:119,125` and
  `pages/Settings/tabs/BluetoothTab.jsx:233` set state after unmount (a no-op in Preact, but
  untidy). `pages/ShotAnalyzer/components/library/LibraryDropdown.jsx:220,363` schedules every
  "export all" download up front with no way to cancel it.

## Data and state

- **Shot history fetched and parsed in five places** — `index.bin`/`recent.bin` in
  `pages/ShotHistory/index.jsx:63`, `pages/ShotAnalyzer/services/LibraryService.js:233`,
  `components/PumpFlowCalibration/api.js:31`, `pages/Home/cards/RecentShotsCard.jsx:64`,
  `pages/Home/cards/ProfileCard.jsx:185`; `.slog` with `padStart(6, '0')` in
  `ShotHistory/index.jsx:302`, `LibraryService.js:388`, `PumpFlowCalibration/api.js:49`. 404
  handling and `cache: 'no-store'` differ, so some views can show a stale index.
  `PumpFlowCalibration/api.js:13` redefines `SHOT_FLAG_DELETED` although `parseBinaryIndex.js`
  already exposes `deleted`. Create one `historyApi.js` (`fetchIndex`, `fetchRecent`, `fetchShot`,
  shared `fetchJson`/`fetchBinary` with `res.ok` checks — a local `fetchJson` already lives in
  `pages/Settings/tabs/BluetoothTab.jsx:65`).

- **Two settings caches** — `prefetchSettings`/`updateSettingsCache` in
  `services/ApiService.js:400-438`, and `useQuery('settings-cache', ...)` (preact-fetching) in
  `pages/Home/useDashboardState.js:31-37`, which is never invalidated after a save, has no `res.ok`
  check, and has options silently ignored (hence a `@ts-expect-error`).
  `pages/Settings/tabs/SystemTab.jsx:277` fetches `/api/settings` directly. Keep the ApiService
  cache only; `invalidateSettingsCache` (`ApiService.js:435`) exists but is unused — call it after
  saves.

- **Whole `machine` signal replaced on every `evt:status`** — `services/ApiService.js:286,305`
  rebuilds the object (and copies `capabilities`) each frame, so derived computeds
  (`pages/Home/useDashboardState.js:9-10`, `pages/Settings/tabs/MachineTab.jsx:19`) change identity
  every tick, and ~29 render-time reads of `machine.value.*` (e.g. `SystemTab.jsx:271-273`,
  `BluetoothTab.jsx:95-96`, `HeaterCoordinationSection.jsx:13`, `ProfileList/index.jsx:684`,
  `DashboardSettings/index.jsx:86,94`) re-render whole settings pages several times a second. Keep
  unchanged sub-objects by reference (or split into `status`/`capabilities`/`scale` signals) and
  export shared computeds: `connected = computed(...)` is copied in 5 files (`services/hooks.js:15`,
  `pages/ShotHistory/index.jsx:37`, `pages/ProfileEdit/index.jsx:34`, …), `pressureAvailable` in 3.

- **Duplicated formatters with clashing signatures** — `formatDuration`
  (`pages/Statistics/components/SummaryCards.jsx:10` takes seconds,
  `pages/ShotAnalyzer/utils/formatting.js:112` takes samples), `formatShotDateTime`
  (`pages/Statistics/components/statisticsView/helpers.js:160` vs
  `pages/Home/cards/RecentShotsCard.jsx:46`), `formatTimestamp`, `formatMetricValue`,
  `isFiniteNumber`. 13 separate `toLocale*` call sites; only `RecentShotsCard.jsx:108` honours
  `clock24hSignal`, `pages/Statistics/components/toolbar/helpers.js:38` hardcodes `hour12: false`.
  `(duration / 1000).toFixed(1)` appears 7×, and there are 46 inline `Math.min(Math.max(...))` plus
  several local `clamp` helpers. Create `utils/format.js` (date/time honouring the 24h setting,
  duration, weight, number) and `utils/math.js` (`clamp`).

- **Shot-notes defaults and requests duplicated** — the default notes object is copied 3× in
  `pages/ShotHistory/ShotNotesCard.jsx` (:33, :77, :126), plus `NotesService.js:29` and
  `LibraryService.js:46`; the `req:history:notes:get/save` logic exists in both `ShotNotesCard.jsx`
  and `NotesService.js`. `ShotNotesCard` should use `NotesService`.

- **Mixed state approaches** — ~259 `useState` vs 4 `useSignal`; hidden mutable module state in
  `services/hooks.js:21-41` (retry timers) and `index.jsx:57` (`let apiService`).
  `utils/dashboardManager.js` builds 18 module signals with ~15 hand-copied get/set/try-storage
  pairs (30 storage calls) — a `persistedSignal(key, default)` helper would remove most of it. Two
  ID generators coexist (`randomId` in `ApiService.js:17` and `uuidv4`).

- **Storage keys scattered** — prefixes are mixed (`gaggimate.*` in `i18n.js:14`/`index.jsx:58`,
  `gaggimate-daisyui-theme` in `utils/themeManager.js:3`, bare `dashboard*`, `visualizer_*`).
  `'statsInitialContext'` is a raw sessionStorage key in `pages/Statistics/index.jsx:17`,
  `pages/ShotAnalyzer/components/library/LibraryPanel.jsx:242`, `shotAnalyzerViewModel.js:168`,
  and the context object itself is built twice (`library/libraryDisplay.js:217`,
  `shotAnalyzerViewModel.js:151`). A safe helper exists in `pages/ShotAnalyzer/utils/storage.js`
  (`saveToStorage`/`loadFromStorage`) — move it to `utils/` with a key registry and use it
  everywhere. (Changing existing keys needs a migration or users lose settings.)

- **Minor leaks** — `utils/themeManager.js:69` adds a `matchMedia` listener that's never removed.

## Styling

- **Chart colours: four strategies, one palette copied by hand** — good:
  `pages/ShotAnalyzer/components/shotChart/helpers/chartTheme.js:17` (`readCssColorVar`,
  `getShotChartColors`), though `SingleShotChart.jsx:150` caches it in a ref and doesn't refresh on
  theme switch. Copy: `pages/Statistics/components/TrendChart.jsx:106` (own `resolveCssColorVar`,
  hex fallbacks at :35-72, :214-216). Hardcoded: `components/OverviewChart.jsx:164-272` and
  `pages/ShotHistory/HistoryChart.jsx:107-231` (~28 hex/rgba, no theme lookup; annotation labels
  fixed white on `rgba(22,33,50,.75)`). `#F0561D`, `#0066CC`, `#63993D` are repeated in 4 JS files
  and in `style.css:176-198`. Move `chartTheme.js` to `utils/`, use it for every chart, and
  re-read colours when the theme changes.

- **Raw Tailwind palette instead of daisyUI tokens** — ~80 uses in 9 files (`text-gray-*`,
  `text-yellow-*`, `bg-yellow-100 text-yellow-800`, `text-white`, `bg-blue-500/5`), e.g.
  `pages/ShotHistory/ShotNotesCard.jsx:200,215-219,398`, `pages/ShotHistory/HistoryCard.jsx:199,240,283`,
  `pages/ShotAnalyzer/components/library/StatusBar.jsx:54,150`,
  `pages/Settings/tabs/MachineTab.jsx:348`, `pages/ShotAnalyzer/utils/constants.js:118-180`. They
  don't adapt to the four themes (`text-gray-300` rating stars are nearly invisible on light).
  Replace with `base-content/NN`, `warning`, `info`, etc.

- **Tailwind class strings as JS constants that should be components** — state→class maps are fine
  (literal, scanner sees them: `components/PumpFlowCalibration/LogPanel.jsx:7`,
  `library/LibraryRow.jsx:22-25`, `shotChart/MobileChartScrubber.jsx:3`,
  `analysisTable/analysisTableModel.js:18`). Should become components:
  `pages/ShotAnalyzer/components/analysisTable/AnalysisTable.jsx:80-86` (7 typography/divider class
  variables, used 19× and passed as props into `AnalysisTableChrome.jsx`) → small
  `<TableHeaderText>`/`<SubText>` components; `pages/Home/Adjuster.jsx:13` (`const btn = 'btn
btn-ghost btn-sm … rounded-full p-0'`) and `components/Navigation.jsx:190` → an `IconButton`.
  `pages/ShotAnalyzer/utils/constants.js:118+` (`groupColors`) mixes classes like
  `text-[var(--analyzer-pressure-text)]` (25 arbitrary `var()` classes overall) with raw CSS values —
  register the `--analyzer-*` colours in `@theme` so they become `text-analyzer-pressure`. Style
  objects as constants: `pages/Statistics/components/toolbar/constants.js:35-39`,
  `statisticsSurfaces.jsx:3`.

- **Repeated class recipes** — `'mb-2 block text-sm font-medium'` 55× in 8 files (17 in
  `StandardProfileForm`, 13 in `ExtendedPhase`) although `SettingsFormField` exists (94 uses, but
  `mb-1` — already drifted); `'grid grid-cols-1 gap-4 md:grid-cols-2'` 22×; `'toggle
toggle-primary'` 9×; `'bg-base-200 rounded-lg p-4'` 7×; `'btn btn-sm …'` ~47×; section eyebrow
  `'text-base-content/70 text-[0.6rem] … uppercase'` 9×; 73 arbitrary font sizes (`text-[10px]`
  24×, `text-[11px]` 16×, `text-[0.6rem]` 10×). Extract `FormLabel`/`FormField`, `FieldGrid`,
  `SectionEyebrow` components and add `--text-2xs` etc. to `@theme`.

- **A second CSS system (~1,900 lines of BEM)** — `pages/ShotAnalyzer/components/shotChart/styles/*.css`
  (1,841 lines), `library/LibrarySection.css` (211), `ShotAnalyzer.css` (91). Mostly plain
  utilities (71× `display`, 54× `gap`, 44× `font-size`) with off-scale values (`0.45rem` gap,
  `0.83rem` text, `font-weight: 650`, `0.6rem` radius); `color-mix(var(--color-base-content) 78%)`
  instead of `text-base-content/78`; `#dc2626` fallback in `tooltipContent.css`. No dead selectors
  found — the cost is drift from the design scale. Migrate to Tailwind incrementally when touching
  these components.

- **`color-mix` fallback block mostly dead and incomplete** — `style.css:619-770` hand-lists
  `.bg-{color}\/N` selectors; 57 of 72 are unused, while used classes such as `bg-primary/14`,
  `/18`, `/24`, `/92` (`library/LibraryRow.jsx:22-25`) are missing. Unused variables:
  `--analyzer-hover-tooltip-{bg,border,shadow,text}`, `--analyzer-weight-det-{anchor,text}`.
  Generate the list from actual usage, or drop the block if the supported browsers no longer need
  it.

- **Inline styles that could be Tailwind** — 106 `style={{}}`, mostly dynamic (fine). Static ones:
  `components/EmptyState.jsx:25` (`text-base-content`), `AnalyzerControl.jsx:127` (`size-3.5`),
  `MetricsGrid.jsx:162` (`flex-1`), `LibraryDropdown.jsx:125` (`z-40`), font sizes in
  `AnalysisTable.jsx:156`, `AnalysisTableCells.jsx:48`, `AnalysisTableChrome.jsx:89`,
  `ActivityHeatmap.jsx:227,238`.

- **Three ways to join classes** — `utils/cx.js` (13 files, 37 calls) vs 28 hand-written
  `[...].filter(Boolean).join(' ')` (6 in `MobileMetricPager.jsx`, 7 in `StaticTooltipContent.jsx`,
  `CompareShotCharts.jsx:339`) vs 183 template-literal classNames (23 with `cond ? 'x' : ''`,
  leaving stray spaces). Standardise on `cx`.

- Dynamic class names are OK: the only one, `components/Card.jsx:37` (`col-span-${n}`), is
  safelisted by `@source inline(...)` in `style.css:487`.

## Structure

- **Shared code depends on pages, pages depend on each other** — `utils/panelDefinitions.js:1-6`
  imports 6 cards from `pages/Home/cards`; `components/Navigation.jsx:12`,
  `app/MachineSetup.jsx:16`, `app/ConnectionGate.jsx:3` import `GmLogoIcon` from
  `pages/ShotAnalyzer/components/SourceMarker.jsx`; `components/PumpFlowCalibration/api.js:4-5`
  imports the ShotHistory parsers. ~22 cross-page imports: Statistics uses ShotAnalyzer's
  `AnalyzerControl` (4×), `analyzerUtils` (4×), `LibraryService` (3×), `CompareShotCharts`; Home
  and ShotAnalyzer import `ShotHistory/parseBinary*`. Move `parseBinaryShot`/`parseBinaryIndex`,
  `LibraryService`, `AnalyzerControl` and the logo icon to a shared place (e.g. `src/shot/`,
  `src/components/`).

- **God components** — ~12 files over 800 lines, 39 over 500.
  - `pages/ProfileList/index.jsx` (1166): `ProfileCard` inline (~96-600), `SimpleContent`/`SimpleStep`
    (~602-680), 7 raw `apiService.request` handlers (~928-1040), SortableJS wiring (~829-925),
    FileReader import (~1000) → `ProfileCard.jsx`, `useProfileActions.js`,
    `useSortableProfiles.js`, `profileImportExport.js`.
  - `pages/ShotAnalyzer/shotAnalyzer/ShotAnalyzer.jsx` (1161): 21 `useState`, 12 `useEffect`, 21
    `useCallback` → `useCompareSession` (compare state ~96-104), `useAnalyzerShotLoader`
    (loading/matching), scroll flags into the existing mobile-navigation hook.
  - `pages/Statistics/components/toolbar/subcomponents.jsx` (1107): 20 components; generic
    `ToolbarButton`, `SegmentGroup`, `MenuItemButton` (~101-210) belong in shared UI; 5 exports are
    only used in this file.
  - `pages/ShotAnalyzer/components/shotChart/single/useShotChartReplayExport.js` (1088) mixes
    Chart.js frame mutation (~136-205) with export-format state.
  - `pages/Settings/index.jsx` (735): ~190 lines of form serialisation (~108-296) →
    `settingsForm.js`.

- **Theme picker duplicated** — hardcoded `<option>` lists in `app/AppSettings.jsx:57-61` and
  `pages/Settings/tabs/GeneralTab.jsx:494-498` differ ("Coffee" translated in only one, "Nord" in
  neither). Build both from `themeManager.getAvailableThemes()` (currently unused) with
  translated labels.

- **No shared outside-click hook** — ~12 hand-written listeners: `app/MachineSwitcher.jsx:46`,
  `pages/ProfileList/index.jsx:228`, `pages/Settings/index.jsx:351`,
  `pages/Statistics/components/StatisticsMultiSelectDropdown.jsx:508`,
  `pages/Statistics/components/toolbar/hooks.js:74,137,241`, `LibraryActionsMenu.jsx:100`,
  `MobileStatusActionsMenu.jsx:167`. Add `hooks/useClickOutside.js`.

- **Magic strings without constants** — `'No Shot Loaded'`/`'No Profile Loaded'` appear 27× as
  sentinels (e.g. `ShotAnalyzer.jsx:68-69`, `LibraryPanel.jsx:113-119`,
  `statisticsView/helpers.js:65`); it works because `library/libraryDisplay.js:37` translates only
  for display, but it's fragile — use `null` or the existing (unused) `NO_PROFILE_LOADED` constant
  (`statisticsView/constants.js:5`). `'/statistics'` defaults in 5+ places although
  `statisticsRoute.js` exists; `/analyzer/internal/${id}` built in `HistoryCard.jsx:219` and
  `RecentShotsCard.jsx:106`. `'evt:status'` in 3 files and `req:profiles:*` in ~20 call sites —
  consider a small `services/messages.js` or typed wrappers on ApiService (`profiles.list()`, …).

- **Re-export shims next to real folders (ShotAnalyzer, Statistics)** — 12 files of ≤15 lines,
  e.g. `pages/ShotAnalyzer/components/LibraryPanel.jsx` (2 lines) next to `library/LibraryPanel.jsx`,
  same for `AnalysisTable`, `AnalyzerActionBar`, `ShotDetailsPanel`; in `shotChart/`,
  `ShotChartControls.jsx`, `CompareShotCharts.jsx`, `ShotChartExternalTooltip.jsx` exist as shims
  and in subfolders, and `helpers.js` sits next to `helpers/`; Statistics has 1-line
  `StatisticsView.jsx`/`StatisticsToolbar.jsx`. ShotAnalyzer also has a nested `shotAnalyzer/`
  folder beside `components/`, `services/`, `utils/`. Point imports at the real files and delete
  the shims.

- **File naming split ~50/50** — ~105 PascalCase vs ~104 camelCase files; some component `.jsx`
  files are camelCase (`statisticsUi.jsx`, `statisticsSurfaces.jsx`, `subcomponents.jsx`,
  `chartReplayControls.jsx`). Convention to adopt: PascalCase for files exporting components,
  camelCase for everything else.

- **Dead exports** — unused anywhere (including `test/`, `e2e/`): `warningLabel`
  (`utils/warnings.js:94`), `getAvailableThemes` (`utils/themeManager.js:46`, see theme picker),
  `invalidateSettingsCache`
  (`services/ApiService.js:435`, see settings caches), `BATCH_SIZE`/`NO_PROFILE_LOADED`
  (`statisticsView/constants.js:2,5`), `BREW_BY_TIME_TEXT`/`BREW_BY_WEIGHT_TEXT`
  (`shotChart/constants.js:10-11`), `getSamplesThroughLastNonExtended` (`weightRate.js:115`),
  `VALID_STATISTICS_SOURCES` (`statisticsRoute.js:9`). ~40 more exports are only used in their own
  file (10 in `statisticsView/analysis.js`) — drop the `export`.

- **Single-use "shared" components** — `TabBar` (Settings), `ConfirmButton` (ProfileList),
  `VisualizerUploadModal` (ShotHistory), `ProcessProfileChart`, `SkeletonBlock` (Home) live in
  `components/` but have one user. Low priority; move next to their page if touching them.

- **Algorithm doc inside src** — `pages/ShotAnalyzer/docs/PhaseEndStop_Algorithm_English.md` is not
  bundled and currently matches the code (`getRegressionWeightRate`,
  `LAST_PHASE_OVERSHOOT_MAX_G`), but has an empty `##` heading and will drift unnoticed. Move it to
  a JSDoc block in `services/analyzer/phaseAnalysis.js` or to `web/docs/`.

- **Minor i18n gaps** — `'Nord'`/`'Coffee'` theme
  options (see theme picker). Check that `components/EmptyState.jsx:131` (nested bold spans in
  `<Trans>`) extracts with placeholders. Otherwise coverage is good, and type checking is on for all
  files via `checkJs` + `strict` in `jsconfig.json`.
