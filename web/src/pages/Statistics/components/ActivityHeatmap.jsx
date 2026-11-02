// GitHub-style activity heatmap: rolling 12-month view of daily shot counts with streak tracking
import { useState, useMemo, useRef, useEffect } from 'preact/hooks';
import { getDayStartLocalMs, getIsoWeekStartLocalMs, formatDateLocal } from '../utils/trendBuckets';
import { CardTitle } from '../../../components/CardTitle';
import { msg } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';

/**
 * @typedef {{ dayMs: number, count: number, week: number, dow: number }} HeatmapCell
 * @typedef {{ cell: HeatmapCell, x: number, y: number, onLeft: boolean }} HeatmapTooltip
 */

const DAY_LABELS = [
  { dow: 0, label: msg({ message: 'M', context: 'weekday initial: Monday' }) },
  { dow: 2, label: msg({ message: 'W', context: 'weekday initial: Wednesday' }) },
  { dow: 4, label: msg({ message: 'F', context: 'weekday initial: Friday' }) },
];
const MS_PER_DAY = 86400000;

/** @type {Intl.DateTimeFormatOptions} */
const TOOLTIP_DATE_OPTIONS = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
/** @type {Intl.DateTimeFormatOptions} */
const MONTH_LABEL_OPTIONS = { month: 'short', year: '2-digit' };

const SHOT_COLOR = 'var(--statistics-trend-shots-brown, #8B5E3C)';
const FUTURE_FILL = 'fill-base-content/[0.03]';
const EMPTY_FILL = 'fill-base-content/[0.06]';
const SHOT_FILL_OPACITY = [0.4, 0.6, 0.8, 1];

/**
 * @param {Map<number, number>} dayMap - Local day start ms to shot count
 * @param {number} startMs
 * @param {number} todayMs
 */
function computeStreaks(dayMap, startMs, todayMs) {
  const totalDaysToToday = Math.round((todayMs - startMs) / MS_PER_DAY) + 1;
  let longest = 0;
  let streak = 0;

  const cursor = new Date(startMs);
  for (let i = 0; i < totalDaysToToday; i++) {
    if ((dayMap.get(cursor.getTime()) || 0) > 0) {
      streak++;
      if (streak > longest) longest = streak;
    } else {
      streak = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // Current streak: count back from today until the first gap.
  let current = 0;
  const back = new Date(todayMs);
  if ((dayMap.get(back.getTime()) || 0) === 0) {
    back.setDate(back.getDate() - 1);
  }
  for (let i = 0; i < totalDaysToToday; i++) {
    if ((dayMap.get(back.getTime()) || 0) > 0) {
      current++;
    } else {
      break;
    }
    back.setDate(back.getDate() - 1);
  }

  return { longest, current };
}

/** @param {import('../types').TrendEntry[]} trends */
function buildHeatmapData(trends) {
  /** @type {Map<number, number>} */
  const dayMap = new Map();
  let earliestAllTime = Infinity;
  for (const entry of trends) {
    if (!entry.timestamp) continue;
    const dayMs = getDayStartLocalMs(entry.timestamp);
    if (dayMs == null) continue;
    dayMap.set(dayMs, (dayMap.get(dayMs) || 0) + 1);
    if (dayMs < earliestAllTime) earliestAllTime = dayMs;
  }

  if (dayMap.size === 0) return null;

  // Date.now() is always a finite timestamp, so the day/week starts below are never null.
  const todayMs = /** @type {number} */ (getDayStartLocalMs(Date.now()));

  const endDate = new Date(todayMs);
  const endDow = (endDate.getDay() + 6) % 7;
  endDate.setDate(endDate.getDate() + (6 - endDow)); // forward to Sunday of current week
  const endMs = endDate.getTime();

  // GitHub-style rolling window: one year back, Monday-aligned via shared utility.
  const startDate = new Date(todayMs);
  startDate.setFullYear(startDate.getFullYear() - 1);
  const startMs = /** @type {number} */ (getIsoWeekStartLocalMs(startDate.getTime()));

  const totalDays = Math.round((endMs - startMs) / MS_PER_DAY) + 1;
  const weeks = Math.ceil(totalDays / 7);

  let totalShots = 0;
  let daysWithShots = 0;
  let earliestShot = null;

  /** @type {HeatmapCell[]} */
  const cells = [];
  const cursor = new Date(startMs);
  for (let i = 0; i < totalDays; i++) {
    const dayMs = cursor.getTime();
    const count = dayMap.get(dayMs) || 0;
    cells.push({ dayMs, count, week: Math.floor(i / 7), dow: i % 7 });
    if (dayMs <= todayMs && count > 0) {
      totalShots += count;
      daysWithShots++;
      if (earliestShot == null) earliestShot = dayMs;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  /** @type {{ week: number, label: string }[]} */
  const monthLabels = [];
  let lastMonth = -1;
  const weekCursor = new Date(startMs);
  for (let w = 0; w < weeks; w++) {
    const month = weekCursor.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        week: w,
        label: formatDateLocal(weekCursor.getTime(), MONTH_LABEL_OPTIONS),
      });
      lastMonth = month;
    }
    weekCursor.setDate(weekCursor.getDate() + 7);
  }

  const daysFromFirst =
    earliestShot != null ? Math.round((todayMs - earliestShot) / MS_PER_DAY) + 1 : 0;
  const dailyAvg = daysFromFirst > 0 ? totalShots / daysFromFirst : 0;

  // Streaks deliberately run over the full history, not just visible year.
  const streaks = computeStreaks(dayMap, earliestAllTime, todayMs);
  return {
    cells,
    monthLabels,
    weeks,
    todayMs,
    stats: {
      totalShots,
      daysWithShots,
      dailyAvg,
      longestStreak: streaks.longest,
      currentStreak: streaks.current,
    },
  };
}

/** @param {{ trends: import('../types').TrendEntry[] }} props */
export function ActivityHeatmap({ trends }) {
  const { i18n } = useLingui();
  const [tooltip, setTooltip] = useState(/** @type {HeatmapTooltip | null} */ (null));
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [containerWidth, setContainerWidth] = useState(0);

  const data = useMemo(() => buildHeatmapData(trends || []), [trends]);
  const tooltipOpen = Boolean(tooltip);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!tooltipOpen) return;
    const dismiss = () => setTooltip(null);
    /** @param {PointerEvent} e */
    const onPointerDown = e => {
      if (!containerRef.current?.contains(/** @type {Node | null} */ (e.target))) setTooltip(null);
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [tooltipOpen]);

  if (!data || data.stats.totalShots === 0) return null;

  const { weeks } = data;
  const dailyAvg = data.stats.dailyAvg.toFixed(1);
  const daysWithShots = data.stats.daysWithShots;
  const labelWidth = 20;
  const availableWidth = containerWidth > 0 ? containerWidth - labelWidth : 0;
  const cellGap = 2;
  const cellSize =
    availableWidth > 0 ? Math.max(8, Math.floor(availableWidth / weeks - cellGap)) : 11;
  const step = cellSize + cellGap;
  const topPadding = 16;
  const svgWidth = labelWidth + weeks * step;
  const svgHeight = topPadding + 7 * step;

  return (
    <div ref={containerRef}>
      <CardTitle className='mb-2 px-0.5 py-1'>
        <Trans>Activity Heatmap</Trans>
      </CardTitle>
      <div className='overflow-x-auto'>
        <svg
          width={svgWidth}
          height={svgHeight + 4}
          className='block'
          style={{ minWidth: svgWidth }}
        >
          {data.monthLabels.map((m, i) => (
            <text
              key={i}
              x={labelWidth + m.week * step}
              y={10}
              style={{ fontSize: '10px', fill: 'var(--statistics-trend-axis-tick, #888)' }}
            >
              {m.label}
            </text>
          ))}

          {DAY_LABELS.map(({ dow, label }) => (
            <text
              key={dow}
              x={0}
              y={topPadding + dow * step + cellSize - 1}
              style={{ fontSize: '10px', fill: 'var(--statistics-trend-shots-brown, #8B5E3C)' }}
            >
              {i18n._(label)}
            </text>
          ))}

          {data.cells.map((cell, i) => {
            const x = labelWidth + cell.week * step;
            const y = topPadding + cell.dow * step;
            const isFuture = cell.dayMs > data.todayMs;
            const hasShots = !isFuture && cell.count > 0;
            /**
             * @param {PointerEvent} e
             * @returns {HeatmapTooltip}
             */
            const makeTooltip = e => ({
              cell,
              x: e.clientX,
              y: e.clientY,
              onLeft: e.clientX > window.innerWidth / 2,
            });
            /** @param {PointerEvent} e */
            const handleHover = e => {
              if (isFuture || e.pointerType !== 'mouse') return;
              setTooltip(makeTooltip(e));
            };

            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                className={hasShots ? undefined : isFuture ? FUTURE_FILL : EMPTY_FILL}
                style={{
                  cursor: isFuture ? 'default' : 'pointer',
                  ...(hasShots && {
                    fill: SHOT_COLOR,
                    fillOpacity:
                      SHOT_FILL_OPACITY[Math.min(cell.count, SHOT_FILL_OPACITY.length) - 1],
                  }),
                }}
                onPointerEnter={handleHover}
                onPointerMove={handleHover}
                onPointerLeave={e => {
                  if (e.pointerType !== 'mouse') return;
                  setTooltip(null);
                }}
                onPointerUp={e => {
                  // Touch/pen have no hover: tap to show, tap the same cell again to hide.
                  if (isFuture || e.pointerType === 'mouse') return;
                  setTooltip(prev =>
                    prev && prev.cell.dayMs === cell.dayMs ? null : makeTooltip(e),
                  );
                }}
              />
            );
          })}
        </svg>
      </div>

      <div className='mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs'>
        <span className='opacity-60'>
          <Trans>
            Daily average: <span className='text-base-content font-bold'>{dailyAvg} shots</span>
          </Trans>
        </span>
        <span className='opacity-60'>
          <Trans>
            Days active: <span className='text-base-content font-bold'>{daysWithShots}</span>
          </Trans>
        </span>
        <span className='opacity-60'>
          <Trans>Longest streak:</Trans>{' '}
          <span className='text-base-content font-bold'>
            <Plural value={data.stats.longestStreak} one='# day' other='# days' />
          </span>
        </span>
        <span className='opacity-60'>
          <Trans>Current streak:</Trans>{' '}
          <span className='text-base-content font-bold'>
            <Plural value={data.stats.currentStreak} one='# day' other='# days' />
          </span>
        </span>
      </div>

      {tooltip && (
        <div
          className='bg-base-300 text-base-content pointer-events-none fixed z-50 rounded-md px-2.5 py-1.5 text-xs shadow-lg'
          style={{
            ...(tooltip.onLeft
              ? { right: window.innerWidth - tooltip.x + 12 }
              : { left: tooltip.x + 12 }),
            top: tooltip.y > 48 ? tooltip.y - 36 : tooltip.y + 16,
          }}
        >
          <div className='font-semibold'>
            <Plural value={tooltip.cell.count} one='# shot' other='# shots' />
          </div>
          <div className='opacity-60'>
            {formatDateLocal(tooltip.cell.dayMs, TOOLTIP_DATE_OPTIONS)}
          </div>
        </div>
      )}
    </div>
  );
}
