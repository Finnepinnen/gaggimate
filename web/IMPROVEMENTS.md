# Improvements

Possible bugs and dead code found while adding types for `noImplicitAny`. None of these
have been fixed yet; each needs a quick check in the running app before changing behaviour.
Paths are relative to `web/src/`.

## Likely bugs

- **Phase number concatenated as a string** —
  `pages/Statistics/services/StatisticsService.js:408`. `AnalyzedPhase.number` is the sample
  `phaseNumber` key, which is a string for phases that ran, so `phase.number + 1` gives `"01"`
  instead of `1`. Only visible in the fallback `Phase N` label when a phase has no
  `displayName` or `name`.
- **`cleanName` can throw on a numeric id** —
  `pages/ShotAnalyzer/components/library/LibraryRow.jsx:36` and
  `pages/ShotAnalyzer/components/useShotNotesState.js:40`. The fallback chain ends in
  `item.id`, which can be a number, and `cleanName` calls `.replace`. Only reachable for a
  non-GaggiMate shot with an empty `name` and `storageKey`.
- **Hidden axes may still get unit labels** —
  `pages/ShotAnalyzer/components/shotChart/helpers/axisPlugins.js:412`. Checks
  `scale.display === false`, but Chart.js keeps the flag at `scale.options.display`, so the
  check probably never matches.
- **`aria-pressed` gets `0`/`1` instead of `true`/`false`** —
  `pages/ProfileEdit/StandardProfileForm.jsx:322` and `pages/ProfileEdit/ExtendedPhase.jsx:194`.
  `aria-pressed={phase.valve}` passes the numeric valve flag; it should be `Boolean(phase.valve)`
  (the sibling button already uses `!phase.valve`).
- **Gaggiuino importer produces incomplete profiles** — `pages/ProfileList/utils.js`
  (`parseJsonProfile`, around line 155). Imported phases have no `phase` field, the profile has
  no `description`, and the transition `type` comes from
  `curve.toLowerCase().replace('_', '-')` without checking it is a valid `TransitionType`
  (`replace` also only replaces the first underscore).
- **`shotName` can be a number** — `pages/Statistics/components/statisticsView/helpers.js:251`.
  `entry.shotData.name || entry.meta?.id` falls back to a numeric id, while the compare views
  expect a string.

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
  `pages/ShotAnalyzer/components/shotChart/model/phaseAnnotations.js:272`. Callers pass
  `colors` and `visibility`, which it ignores (currently silenced with `@ts-expect-error`).
- **`parsed.rating` is always undefined** — `pages/ShotHistory/index.jsx:316`.
  `parseBinaryShot` never sets `rating`, so `h.rating ?? parsed.rating` only ever uses the index
  rating. Harmless.
- **`phase.key` fallback is dead** — `pages/ShotAnalyzer/components/analysisTable/AnalysisTable.jsx`.
  `AnalyzedPhase` never has a `key`.
- **Title icons never have a `label`** —
  `pages/ShotAnalyzer/components/shotChart/compare/CompareMetricContent.jsx:394`.
  `key={item.key || item.label}` only ever uses `item.key`. Harmless.

## Fragile, but fine today

- **Duotone icons would break `Path2D`** —
  `pages/ShotAnalyzer/components/shotChart/helpers/canvasDrawing.js:32`. A duotone Font Awesome
  icon has an array path; only solid icons are used now.
- **`resolveTooltipRows` needs optional-looking callbacks** —
  `pages/ShotAnalyzer/components/shotChart/tooltip/tooltipModel.js:392`. Single mode crashes if
  `getHoverWaterValuesAtX` or `tooltipColorByLabel` is omitted; all current callers pass both.

## Styling

- **Conflicting text colours on analyzer and toolbar controls.** Several controls get one text
  colour from their `AnalyzerControl` tone and another from their own classes, so the result
  depends on CSS order. Examples: the Statistics mode trigger (`text-base-content/70
hover:text-primary` vs `text-primary-content`), the reset button (`hover:text-primary` vs
  `hover:text-base-content`), the compact neutral buttons (`/70` vs `/65`) and the source trigger.
- **`ScrollBtn` buttons have no `type`** —
  `pages/ShotAnalyzer/components/analysisTable/AnalysisTableChrome.jsx`. Fine outside a form,
  but `type='button'` would make that explicit.
