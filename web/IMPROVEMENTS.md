# Improvements

Possible bugs, dead code and loose types found while adding types for `noImplicitAny` and
`strict`. None of these have been fixed yet; each needs a quick check in the running app before changing behaviour.
Paths are relative to `web/src/`.

## Likely bugs

- **Phase number concatenated as a string** —
  `pages/Statistics/services/StatisticsService.js:415`. `AnalyzedPhase.number` is the sample
  `phaseNumber` key, which is a string for phases that ran, so `phase.number + 1` gives `"01"`
  instead of `1`. Only visible in the fallback `Phase N` label when a phase has no
  `displayName` or `name`.
- **`cleanName` can throw on a numeric id** —
  `pages/ShotAnalyzer/components/library/LibraryRow.jsx:36` and
  `pages/ShotAnalyzer/components/useShotNotesState.js:40`. The fallback chain ends in
  `item.id`, which can be a number, and `cleanName` calls `.replace`. Only reachable for a
  non-GaggiMate shot with an empty `name` and `storageKey`.
- **Hidden axes may still get unit labels** —
  `pages/ShotAnalyzer/components/shotChart/helpers/axisPlugins.js:413`. Checks
  `scale.display === false`, but Chart.js keeps the flag at `scale.options.display`, so the
  check probably never matches.
- **`aria-pressed` gets `0`/`1` instead of `true`/`false`** —
  `pages/ProfileEdit/StandardProfileForm.jsx:322` and `pages/ProfileEdit/ExtendedPhase.jsx:197`.
  `aria-pressed={phase.valve}` passes the numeric valve flag; it should be `Boolean(phase.valve)`
  (the sibling button already uses `!phase.valve`).
- **Gaggiuino importer produces incomplete profiles** — `pages/ProfileList/utils.js`
  (`parseJsonProfile`, around line 160). Imported phases have no `phase` field, the profile has
  no `description`, and the transition `type` comes from
  `curve.toLowerCase().replace('_', '-')` without checking it is a valid `TransitionType`
  (`replace` also only replaces the first underscore). It can also produce an undefined
  `label` (no `name`), put an undefined `restriction` into `pump.pressure`/`flow`, and give a
  `NaN` `duration` when there is no `stopConditions.time` — `stopConditions` is read before the
  `|| {}` fallback a few lines later (line 156).
- **`shotName` can be a number** — `pages/Statistics/components/statisticsView/helpers.js:259`.
  `entry.shotData.name || entry.meta?.id` falls back to a numeric id, while the compare views
  expect a string.
- **Water level can show `NaN%`** — `pages/Home/useDashboardState.js:76`. If the `tof`
  capability arrives before a status frame carrying `tofDistance`, `waterLevelPercent` is `NaN`;
  `utils/metricDefinitions.js:150` then renders it.
- **Phase editor mutates props** — `pages/ProfileEdit/ExtendedPhase.jsx:38`. `onTargetChange`
  writes into the `targets` array from props in place (the copy is shallow).
- **History chart range becomes `NaN`** — `pages/ShotHistory/HistoryChart.jsx:87`. A missing
  temperature makes `Math.min`/`Math.max` over the values `NaN`.
- **Unrated shots get `rating: undefined`** — `pages/ShotHistory/index.jsx:321`.
  `parseBinaryShot` never sets `rating`, so `h.rating ?? parsed.rating` falls back to
  `undefined` instead of `null` (`Shot.rating` is typed `number | null`).
- **Unstable library sort without timestamps** — `pages/ShotAnalyzer/services/LibraryService.js`
  (`b.timestamp - a.timestamp`, line 289). Items without a timestamp give `NaN`, so their
  order is undefined.
- **Shot id can be missing** — `pages/Statistics/components/statisticsView/analysis.js:64`.
  `getStatisticsShotId` returns `undefined` for a browser shot with no storage key, name or id,
  although it is typed `string | number`.
- **One id cancelled as both a frame and a timer** —
  `pages/ShotAnalyzer/components/shotChart/compare/CompareChartCanvas.jsx:116` and `:264`.
  Hover cleanup calls `cancelAnimationFrame` and `clearTimeout` with the same id, which could
  cancel an unrelated timer that happens to share it.

## Dead or ineffective code

- **Compare stop-annotation filter never matches** —
  `pages/ShotAnalyzer/components/shotChart/compare/compareChartConfig.js:951`. Filters keys
  starting with `phase_exit_` and `brew_mode`, but the chart model creates `phase_stop_N` and
  `shot_end_stop`. Turning stop annotations off therefore doesn't remove them (they happen to be
  created with `display: false`).
- **Final-weight overlays are never shown** — same file, lines 250 and 266. Look for annotation
  keys ending in `final_weight_callout_meta` / `final_weight`, which the model never produces.
- **Unsupported `clip: false` on annotation labels** — `components/OverviewChart.jsx:178` and
  `:212`, `components/ExtendedProfileChart.jsx:358`. chartjs-plugin-annotation's label options
  have no `clip`, so it's ignored.
- **Legend `borderDash` branch never runs** — `components/ExtendedProfileChart.jsx:229`. The
  `generateLabels` code copies `dataset.borderDash`, but these datasets only set
  `segment.borderDash` (lines 47 and 58).
- **Unused arguments to `createPhaseSeparatorAnnotation`** —
  `pages/ShotAnalyzer/components/shotChart/model/phaseAnnotations.js:273`. Callers pass
  `colors` and `visibility`, which it ignores (currently silenced with `@ts-expect-error`).
- **`phase.key` fallback is dead** — `pages/ShotAnalyzer/components/analysisTable/AnalysisTable.jsx`.
  `AnalyzedPhase` never has a `key`.
- **Title icons never have a `label`** —
  `pages/ShotAnalyzer/components/shotChart/compare/CompareMetricContent.jsx:394`.
  `key={item.key || item.label}` only ever uses `item.key`. Harmless.
- **Leftover `any` cast** —
  `pages/ShotAnalyzer/components/shotChart/compare/CompareChartCanvas.jsx:253`.
  `$compareTooltipShowDifference` is now declared on `Chart`, so the cast can go.

## Fragile, but fine today

- **Duotone icons would break `Path2D`** —
  `pages/ShotAnalyzer/components/shotChart/helpers/canvasDrawing.js:32`. A duotone Font Awesome
  icon has an array path; only solid icons are used now.
- **`resolveTooltipRows` needs optional-looking callbacks** —
  `pages/ShotAnalyzer/components/shotChart/tooltip/tooltipModel.js:398`. Single mode crashes if
  `getHoverWaterValuesAtX` or `tooltipColorByLabel` is omitted; all current callers pass both.
- **Phase overview assumes a shot** —
  `pages/ShotAnalyzer/components/shotChart/model/phaseAnnotations.js` (`buildPhaseOverviewRows`, line 901).
  Casts `shotData` to non-null in the results branch; it would throw if results came without a
  shot and a phase had no name (as it did before).

## Types that are looser or stricter than reality

Fixed with local casts during the `strict` pass; worth correcting at the source.

- **`ApiServiceContext` is typed `ApiService | null`** — `services/ApiService.js:346`. Every page
  is rendered under the provider, so 12 call sites cast it. Typing the context (or
  `useApiService`) as non-null would remove those casts.
- **`connectError.address` should allow `null`** — `services/machineTypes.js:156`. The Bluetooth
  tab gets `address: null` after a failed scan.
- **`activeWarnings` should narrow its result** — `utils/warnings.js:112`. It filters on
  `w.icon` but isn't a type predicate, so callers cast `w.icon`.
- **`TotalStats.weight` can be undefined** — `pages/ShotAnalyzer/services/analyzer/shotAnalysis.js:286`.
  Undefined when no sample has `v`; widening it surfaces errors in `StatisticsService`.
- **`getDefaults(null)` returns notes with `id: null`** —
  `pages/ShotAnalyzer/services/NotesService.js:66`. Used as the placeholder while no shot is
  loaded, but `AnalyzerNotes.id` is typed `string`.
- **Library rows are assumed to always have an id or name** — `getShotStorageKey`,
  `getLibraryProfileDeleteKey`, `shotSelection`'s `profileId` and the `LibraryPanel` delete
  confirmation cast instead of handling a missing one.

## Styling

- **Conflicting text colours on analyzer and toolbar controls.** Several controls get one text
  colour from their `AnalyzerControl` tone and another from their own classes, so the result
  depends on CSS order. Examples: the Statistics mode trigger
  (`text-base-content/70 hover:text-primary` vs `text-primary-content`), the reset button (`hover:text-primary` vs
  `hover:text-base-content`), the compact neutral buttons (`/70` vs `/65`) and the source trigger.
- **`ScrollBtn` buttons have no `type`** —
  `pages/ShotAnalyzer/components/analysisTable/AnalysisTableChrome.jsx`. Fine outside a form,
  but `type='button'` would make that explicit.
