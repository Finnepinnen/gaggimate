import { Fragment } from 'preact';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans, useLingui } from '@lingui/react/macro';
import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowRightArrowLeft';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { COMPARE_TARGET_DISPLAY_MODES } from '../../../utils/analyzerUtils';
import { AnalyzerControl } from '../../AnalyzerControl.jsx';
import { cx } from '../../../../../utils/cx.js';

/**
 * @typedef {object} CompareShotLegendItem
 * @property {string} label
 * @property {string | null} [color]
 * @property {string | null} [badgeColor]
 * @property {number} [lineWidth]
 * @property {number[]} [dash]
 * @property {number} [shotNumber]
 */

/** @typedef {{ value: string, label: string }} CompareSelectOption */

/**
 * @param {object} props
 * @param {CompareShotLegendItem[]} props.compareShotLegendItems
 * @param {(() => void) | null} [props.onCompareSwap]
 */
function CompareShotLegend({ compareShotLegendItems, onCompareSwap }) {
  const { t } = useLingui();
  return (
    <div className='flex min-w-0 flex-wrap items-center gap-2.5'>
      {compareShotLegendItems.map((item, index) => {
        const shotNumber = item.shotNumber || '';
        return (
          <Fragment key={item.label}>
            <div className='text-base-content/70 inline-flex min-w-0 items-center gap-1 text-xs font-normal'>
              <span
                className={[
                  'analyzer-compare-shot-badge inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs leading-none font-semibold tabular-nums',
                  item.shotNumber === 2 ? 'analyzer-compare-shot-badge--striped' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--analyzer-compare-shot-color': item.badgeColor || item.color }}
                aria-label={t`Shot ${shotNumber}`}
              >
                {item.shotNumber}
              </span>
              <span className='truncate'>{item.label}</span>
            </div>
            {index === 0 && compareShotLegendItems.length > 1 && onCompareSwap ? (
              <AnalyzerControl
                type='button'
                onClick={onCompareSwap}
                className='h-7 min-h-0 w-7 rounded-lg p-0 text-sm'
                title={t`Swap shot 1 and shot 2`}
                aria-label={t`Swap shot 1 and shot 2`}
              >
                <FontAwesomeIcon icon={faArrowRightArrowLeft} className='text-sm' />
              </AnalyzerControl>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} [props.compareAnnotationsEnabled]
 * @param {(() => void) | null} [props.onCompareAnnotationsToggle]
 * @param {boolean} [props.showCompareAnnotationToggle]
 */
function CompareAnnotationToggle({
  compareAnnotationsEnabled,
  onCompareAnnotationsToggle,
  showCompareAnnotationToggle,
}) {
  const { t } = useLingui();
  if (showCompareAnnotationToggle && onCompareAnnotationsToggle) {
    return (
      <AnalyzerControl
        type='button'
        variant='text'
        onClick={onCompareAnnotationsToggle}
        className={cx(
          'h-6 min-h-0 px-2 text-xs font-medium',
          compareAnnotationsEnabled
            ? 'bg-base-content/8 text-base-content/80'
            : 'text-base-content/55',
        )}
        aria-pressed={compareAnnotationsEnabled}
        title={
          compareAnnotationsEnabled ? t`Hide compare annotations` : t`Show compare annotations`
        }
      >
        <Trans>Annotations</Trans>
      </AnalyzerControl>
    );
  }

  return null;
}

/**
 * @param {object} props
 * @param {((value: string) => void) | null} [props.onChange]
 * @param {CompareSelectOption[]} props.options
 * @param {string} props.title
 * @param {string} [props.value]
 * @param {string} [props.widthClass]
 */
export function CompareSelect({ onChange, options, title, value, widthClass }) {
  if (onChange && options.length > 0) {
    return (
      <div className='relative flex h-5 min-h-0 items-center'>
        <AnalyzerControl
          as='select'
          variant='surface'
          size='compact'
          value={value}
          onChange={
            /** @param {import('preact').JSX.TargetedEvent<HTMLSelectElement, Event>} event */
            event => onChange(event.currentTarget.value)
          }
          className={cx(
            'appearance-none rounded-md border-0 bg-transparent px-2.5 pr-6 text-xs font-medium shadow-none outline-none',
            widthClass,
          )}
          title={title}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </AnalyzerControl>
        <span className='text-base-content/60 pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs'>
          <FontAwesomeIcon icon={faChevronDown} />
        </span>
      </div>
    );
  }

  return null;
}

/**
 * @param {object} props
 * @param {string} [props.compareTargetDisplayMode]
 * @param {((mode: string) => void) | null} [props.onCompareTargetDisplayModeChange]
 */
export function CompareTargetSelect({
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
}) {
  const { t } = useLingui();
  return (
    <CompareSelect
      onChange={onCompareTargetDisplayModeChange}
      options={[
        { value: COMPARE_TARGET_DISPLAY_MODES.NONE, label: t`No Targets` },
        { value: COMPARE_TARGET_DISPLAY_MODES.PER_SHOT, label: t`Per Shot` },
        { value: COMPARE_TARGET_DISPLAY_MODES.MAIN_SHOT_ONLY, label: t`Main Shot` },
      ]}
      title={t`Target display mode`}
      value={compareTargetDisplayMode}
      widthClass='w-[7rem] max-w-[7rem]'
    />
  );
}

/**
 * @param {object} props
 * @param {string} [props.compareAlignmentMode]
 * @param {CompareSelectOption[]} props.compareAlignmentOptions
 * @param {boolean} [props.compareAnnotationsEnabled]
 * @param {CompareShotLegendItem[]} props.compareShotLegendItems
 * @param {string} [props.compareTargetDisplayMode]
 * @param {((mode: string) => void) | null} [props.onCompareAlignmentModeChange]
 * @param {(() => void) | null} [props.onCompareAnnotationsToggle]
 * @param {(() => void) | null} [props.onCompareSwap]
 * @param {((mode: string) => void) | null} [props.onCompareTargetDisplayModeChange]
 * @param {unknown} [props.shouldShowCompareControls] Truthy to render.
 * @param {boolean} [props.showCompareAnnotationToggle]
 */
export function CompareControlsRow({
  compareAlignmentMode,
  compareAlignmentOptions,
  compareAnnotationsEnabled,
  compareShotLegendItems,
  compareTargetDisplayMode,
  onCompareAlignmentModeChange,
  onCompareAnnotationsToggle,
  onCompareSwap,
  onCompareTargetDisplayModeChange,
  shouldShowCompareControls,
  showCompareAnnotationToggle,
}) {
  const { t } = useLingui();
  if (shouldShowCompareControls) {
    return (
      <div className='mt-2 mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1'>
        <CompareShotLegend
          compareShotLegendItems={compareShotLegendItems}
          onCompareSwap={onCompareSwap}
        />

        <div className='flex items-center gap-2'>
          <CompareAnnotationToggle
            compareAnnotationsEnabled={compareAnnotationsEnabled}
            onCompareAnnotationsToggle={onCompareAnnotationsToggle}
            showCompareAnnotationToggle={showCompareAnnotationToggle}
          />

          <CompareSelect
            onChange={onCompareAlignmentModeChange}
            options={compareAlignmentOptions}
            title={t`Compare alignment`}
            value={compareAlignmentMode}
            widthClass='w-[9rem] max-w-[9rem]'
          />

          <CompareTargetSelect
            compareTargetDisplayMode={compareTargetDisplayMode}
            onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
          />
        </div>
      </div>
    );
  }

  return null;
}
