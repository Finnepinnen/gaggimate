# Improvements

Dead code and loose types found while adding types for `noImplicitAny` and `strict`. Each
needs a quick check in the running app before changing behaviour.
Paths are relative to `web/src/`.

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
