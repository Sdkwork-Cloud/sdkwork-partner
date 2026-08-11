import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StatSnapshotItem } from '@sdkwork/partner-backend-sdk';
import { formatDecimal } from '@sdkwork/partner-pc-admin-core/ui';

/** Aggregated per-partner totals from monthly snapshots, ranked by commission. */
export interface PartnerRankRow {
  partnerId: string;
  commissionEarned: number;
  joinFeeTotal: number;
  customerCount: number;
  downstreamPartnerCount: number;
}

/**
 * Aggregates monthly snapshots per partner and ranks by commission earned.
 * The partner with the highest commission in the selected period wins.
 */
export function rankPartners(snapshots: StatSnapshotItem[]): PartnerRankRow[] {
  const byPartner = new Map<string, PartnerRankRow>();
  for (const snapshot of snapshots) {
    const row = byPartner.get(snapshot.partnerId) ?? {
      partnerId: snapshot.partnerId,
      commissionEarned: 0,
      joinFeeTotal: 0,
      customerCount: 0,
      downstreamPartnerCount: 0,
    };
    row.commissionEarned += Number(snapshot.commissionEarned) || 0;
    row.joinFeeTotal += Number(snapshot.joinFeeTotal) || 0;
    row.customerCount += Number(snapshot.customerCount) || 0;
    row.downstreamPartnerCount = Math.max(row.downstreamPartnerCount, Number(snapshot.downstreamPartnerCount) || 0);
    byPartner.set(snapshot.partnerId, row);
  }
  return [...byPartner.values()].sort((a, b) => b.commissionEarned - a.commissionEarned);
}

/** Top-N partner leaderboard by commission earned. */
export function TopPartners({ rows, limit = 10 }: { rows: PartnerRankRow[]; limit?: number }) {
  const { t } = useTranslation();
  const top = rows.slice(0, limit);
  if (top.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        {t('admin.partner.stats.ranking.empty', { defaultValue: 'No snapshot data yet.' })}
      </p>
    );
  }
  const max = Math.max(1, ...top.map((row) => row.commissionEarned));
  return (
    <div className="grid gap-1.5">
      {top.map((row, index) => (
        <div key={row.partnerId} className="flex items-center gap-3">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              index === 0
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                : index === 1
                  ? 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                  : index === 2
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'
            }`}
          >
            {index === 0 ? <Trophy className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">
              #{row.partnerId}
            </span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              {t('admin.partner.stats.ranking.customers', { defaultValue: '{{count}} customers', count: row.customerCount })} ·{' '}
              {t('admin.partner.stats.ranking.downstream', { defaultValue: '{{count}} downstream', count: row.downstreamPartnerCount })}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(row.commissionEarned / max) * 100}%` }} />
            </span>
          </span>
          <span className="w-24 shrink-0 text-right font-mono text-xs font-semibold text-slate-900 dark:text-white">
            {formatDecimal(row.commissionEarned)}
          </span>
        </div>
      ))}
    </div>
  );
}
