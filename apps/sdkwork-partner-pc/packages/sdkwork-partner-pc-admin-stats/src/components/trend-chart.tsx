import { useMemo } from 'react';

/** A single series rendered in the trend chart. */
export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

/**
 * Lightweight multi-series bar chart rendered with SVG (no chart dependency).
 * Each bucket renders one group of bars; values are normalized to the
 * dataset maximum.
 */
export function TrendChart({ labels, series, height = 180 }: { labels: string[]; series: TrendSeries[]; height?: number }) {
  const { max, ticks } = useMemo(() => {
    const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
    const rawTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.ceil(maxValue * ratio));
    return { max: maxValue, ticks: [...new Set(rawTicks)] };
  }, [series]);

  const groupWidth = labels.length > 0 ? 100 / labels.length : 100;
  const barWidth = Math.min(14, groupWidth / (series.length + 1.5));
  const plotHeight = height - 28;

  return (
    <div className="min-w-0">
      <svg
        viewBox={`0 0 ${Math.max(320, labels.length * (series.length + 2) * 12)} ${height}`}
        className="w-full"
        role="img"
        aria-label="trend chart"
      >
        {/* grid lines + y labels */}
        {ticks.map((tick, index) => {
          const y = plotHeight - (plotHeight * tick) / max;
          return (
            <g key={`tick-${index}`}>
              <line x1={0} x2="100%" y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeDasharray="4 4" />
              <text x={2} y={y - 3} className="fill-slate-400 text-[9px] dark:fill-slate-500" fontSize={9}>
                {formatTick(tick)}
              </text>
            </g>
          );
        })}
        {labels.map((label, bucketIndex) => {
          const groupX = (bucketIndex * groupWidth) + (groupWidth - series.length * barWidth - (series.length - 1) * 2) / 2;
          return (
            <g key={label}>
              {series.map((s, seriesIndex) => {
                const value = s.values[bucketIndex] ?? 0;
                const barHeight = (value / max) * plotHeight;
                const x = groupX + seriesIndex * (barWidth + 2);
                const y = plotHeight - barHeight;
                return (
                  <rect
                    key={`${label}-${s.key}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, value > 0 ? 2 : 0)}
                    rx={2}
                    fill={s.color}
                    opacity={0.85}
                  >
                    <title>{`${s.label}: ${formatTick(value)}`}</title>
                  </rect>
                );
              })}
              <text x={groupX + (series.length * (barWidth + 2)) / 2} y={plotHeight + 12} className="fill-slate-400 text-[9px] dark:fill-slate-500" fontSize={9} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatTick(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}w`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}
