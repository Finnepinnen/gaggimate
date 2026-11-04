# Improvements

Loose types and loose ends found while adding types for `noImplicitAny` and `strict`.
Paths are relative to `web/src/`.

## Unfinished

- **Final-weight overlays are never shown** —
  `pages/ShotAnalyzer/components/shotChart/compare/compareChartConfig.js` and
  `single/createShotChartConfigs.js` wire up `finalWeightCalloutLine` / `finalWeightBadgeOverlay`
  (`helpers/overlayPlugins.js`) and look for `final_weight_callout_meta` / `final_weight`
  annotations, but no chart model creates them. Either finish the feature or remove the
  plugins.

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
