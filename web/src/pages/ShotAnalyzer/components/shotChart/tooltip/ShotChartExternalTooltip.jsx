import { createHiddenExternalTooltipLayout } from './tooltipState';
import { FloatingTooltipContent } from './FloatingTooltipContent';
import { StaticCompactTooltipContent, StaticTooltipContent } from './StaticTooltipContent';

/** @typedef {import('./tooltipTypes').ExternalTooltipState} ExternalTooltipState */
/** @typedef {import('./tooltipTypes').ExternalTooltipLayout} ExternalTooltipLayout */
/** @typedef {import('./tooltipTypes').CompactTooltipVariant} CompactTooltipVariant */

/** @type {Record<string, string>} */
const COMPACT_TOOLTIP_VARIANT_CLASS = {
  comparePreview: 'shot-chart-tooltip--static-compact-compare-preview',
  singleLine: 'shot-chart-tooltip--static-compact-single-line',
  singlePaged: 'shot-chart-tooltip--static-compact-single-paged',
  statisticsCompact: 'shot-chart-tooltip--static-compact-statistics',
  titleOnly: 'shot-chart-tooltip--static-compact-title-only',
};

/**
 * @param {boolean} isCompactStatic
 * @param {CompactTooltipVariant} staticCompactVariant
 */
function getCompactTooltipVariantClass(isCompactStatic, staticCompactVariant) {
  if (!isCompactStatic) return '';
  return COMPACT_TOOLTIP_VARIANT_CLASS[staticCompactVariant] || '';
}

/**
 * @param {object} options
 * @param {boolean} options.isStatic
 * @param {boolean} options.shouldShowEmptyContent
 * @param {ExternalTooltipState} options.state
 */
function getStaticTooltipStateClass({ isStatic, shouldShowEmptyContent, state }) {
  if (shouldShowEmptyContent) return 'shot-chart-tooltip--static-empty-content';
  if (isStatic && !state.visible) return 'shot-chart-tooltip--static-empty';
  return '';
}

/**
 * @param {object} options
 * @param {boolean} options.isCompactStatic
 * @param {boolean} options.isFullDisplay
 * @param {boolean} options.isStatic
 * @param {boolean} options.isTitleOnly
 * @param {boolean} options.shouldShowEmptyContent
 * @param {ExternalTooltipState} options.state
 * @param {CompactTooltipVariant} options.staticCompactVariant
 */
function getTooltipClassName({
  isCompactStatic,
  isFullDisplay,
  isStatic,
  isTitleOnly,
  shouldShowEmptyContent,
  state,
  staticCompactVariant,
}) {
  return [
    'shot-chart-tooltip',
    isFullDisplay ? 'shot-chart-tooltip--fullscreen' : '',
    isTitleOnly ? 'shot-chart-tooltip--title-only' : '',
    isStatic ? 'shot-chart-tooltip--static' : '',
    isCompactStatic ? 'shot-chart-tooltip--static-compact' : '',
    getCompactTooltipVariantClass(isCompactStatic, staticCompactVariant),
    getStaticTooltipStateClass({ isStatic, shouldShowEmptyContent, state }),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * @param {object} options
 * @param {boolean} options.isStatic
 * @param {ExternalTooltipLayout} options.layout
 * @returns {import('preact').JSX.CSSProperties | undefined}
 */
function getTooltipStyle({ isStatic, layout }) {
  if (isStatic) return undefined;
  return {
    left: `${layout.x}px`,
    top: `${layout.y}px`,
    visibility: layout.visible ? 'visible' : 'hidden',
  };
}

/** @param {ExternalTooltipState} state */
function hasTooltipContent(state) {
  return state.titleLines.length > 0 || state.phaseSummaries.length > 0 || state.rows.length > 0;
}

/**
 * @param {object} props
 * @param {import('preact').Ref<HTMLDivElement>} [props.tooltipRef]
 * @param {ExternalTooltipState} props.state
 * @param {ExternalTooltipLayout} [props.layout]
 * @param {boolean} [props.isFullDisplay]
 * @param {boolean} [props.isStatic]
 * @param {boolean} [props.isCompactStatic]
 * @param {CompactTooltipVariant} [props.staticCompactVariant]
 * @param {import('./tooltipTypes').TooltipMetricContext | null} [props.staticMetricContext]
 * @param {import('preact').ComponentChildren} [props.emptyContent]
 */
export function ShotChartExternalTooltip({
  tooltipRef,
  state,
  layout = createHiddenExternalTooltipLayout(),
  isFullDisplay = false,
  isStatic = false,
  isCompactStatic = false,
  staticCompactVariant = 'default',
  staticMetricContext = null,
  emptyContent = null,
}) {
  if (!state.visible && !isStatic) return null;
  const hasVisibleContent = state.visible && hasTooltipContent(state);
  const isTitleOnly = state.visible && state.titleLines.length > 0 && state.rows.length === 0;
  const shouldShowEmptyContent = isStatic && !hasVisibleContent && Boolean(emptyContent);
  const shouldShowStaticContent = isStatic && hasVisibleContent;
  const style = getTooltipStyle({ isStatic, layout });

  return (
    <div
      ref={tooltipRef}
      // Build tooltip modifiers via array join so formatting cannot remove the class separators.
      className={getTooltipClassName({
        isCompactStatic,
        isFullDisplay,
        isStatic,
        isTitleOnly,
        shouldShowEmptyContent,
        state,
        staticCompactVariant,
      })}
      style={style}
    >
      {shouldShowEmptyContent ? emptyContent : null}
      {shouldShowStaticContent && isCompactStatic ? (
        <StaticCompactTooltipContent
          metricContext={staticMetricContext}
          state={state}
          variant={staticCompactVariant}
        />
      ) : null}
      {shouldShowStaticContent && !isCompactStatic ? <StaticTooltipContent state={state} /> : null}
      {shouldShowStaticContent ? null : <FloatingTooltipContent state={state} />}
    </div>
  );
}
