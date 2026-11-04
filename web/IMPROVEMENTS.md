# Improvements

Loose ends found while adding types for `noImplicitAny` and `strict`.
Paths are relative to `web/src/`.

## Unfinished

- **Final-weight overlays are never shown** —
  `pages/ShotAnalyzer/components/shotChart/compare/compareChartConfig.js` and
  `single/createShotChartConfigs.js` wire up `finalWeightCalloutLine` / `finalWeightBadgeOverlay`
  (`helpers/overlayPlugins.js`) and look for `final_weight_callout_meta` / `final_weight`
  annotations, but no chart model creates them. Either finish the feature or remove the
  plugins.
