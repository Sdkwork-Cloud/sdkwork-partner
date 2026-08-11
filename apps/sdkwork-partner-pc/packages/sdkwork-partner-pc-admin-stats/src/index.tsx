import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw, Search, TrendingUp, UsersRound, WalletCards } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PartnerStatItem, StatSnapshotItem, StatsOverviewItem } from '@sdkwork/partner-backend-sdk';
import {
  BottomPagination,
  errorMessage,
  formatDateTime,
  formatDecimal,
  InlineError,
  inputClass,
  PageShell,
  PartnerPickerField,
  secondaryButtonClass,
  TableState,
} from '@sdkwork/partner-pc-admin-core/ui';
import { statsService } from './services/statsService';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';
import { rankPartners, TopPartners } from './components/top-partners';
import { TrendChart, type TrendSeries } from './components/trend-chart';

export function StatsAdmin() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [overview, setOverview] = useState<StatsOverviewItem | null>(null);
  const [snapshots, setSnapshots] = useState<StatSnapshotItem[]>([]);
  const [snapshotsTotal, setSnapshotsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [partnerId, setPartnerId] = useState('');
  const [partnerStats, setPartnerStats] = useState<PartnerStatItem | null>(null);
  const [periodTypeFilter, setPeriodTypeFilter] = useState('');
  const [trendSnapshots, setTrendSnapshots] = useState<StatSnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const [overviewResult, snapshotPage, trendPage] = await Promise.all([
        // Panels degrade independently; one failing surface must not blank the page.
        statsService.overview().catch(() => null),
        statsService.snapshots({
          page,
          pageSize,
          periodType: (periodTypeFilter || undefined) as 'DAY' | 'MONTH',
        }).catch(() => null),
        // Monthly snapshots drive the trend chart and partner ranking.
        statsService.snapshots({ page: 1, pageSize: 200, periodType: 'MONTH' }).catch(() => null),
      ]);
      if (!guard.isCurrent(seq)) return;
      setOverview(overviewResult);
      setSnapshots(snapshotPage?.items ?? []);
      setSnapshotsTotal(Number(snapshotPage?.pageInfo.totalItems ?? 0));
      setTrendSnapshots(trendPage?.items ?? []);
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.stats.errors.loadFailed', { defaultValue: 'Failed to load stats.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  }, [page, pageSize, periodTypeFilter, guard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Latest 12 monthly buckets with per-month aggregate values. */
  const trend = useMemo(() => {
    const buckets = new Map<string, { joinFee: number; commission: number; revenue: number }>();
    for (const snapshot of trendSnapshots) {
      if (snapshot.periodType !== 'MONTH') continue;
      const month = snapshot.periodStart.slice(0, 7);
      const bucket = buckets.get(month) ?? { joinFee: 0, commission: 0, revenue: 0 };
      bucket.joinFee += Number(snapshot.joinFeeTotal) || 0;
      bucket.commission += Number(snapshot.commissionEarned) || 0;
      bucket.revenue += Number(snapshot.revenueBase) || 0;
      buckets.set(month, bucket);
    }
    const months = [...buckets.keys()].sort().slice(-12);
    const series: TrendSeries[] = [
      { key: 'joinFee', label: t('admin.partner.stats.trend.joinFee', { defaultValue: 'Join fees' }), color: '#6366f1', values: months.map((m) => buckets.get(m)!.joinFee) },
      { key: 'commission', label: t('admin.partner.stats.trend.commission', { defaultValue: 'Commission' }), color: '#10b981', values: months.map((m) => buckets.get(m)!.commission) },
      { key: 'revenue', label: t('admin.partner.stats.trend.revenue', { defaultValue: 'Revenue base' }), color: '#f59e0b', values: months.map((m) => buckets.get(m)!.revenue) },
    ];
    return { labels: months, series };
  }, [trendSnapshots, t]);

  const ranking = useMemo(() => rankPartners(trendSnapshots), [trendSnapshots]);

  const queryPartner = async (targetPartnerId: string) => {
    const id = targetPartnerId.trim();
    if (!id) return;
    const seq = guard.next();
    setError(null);
    try {
      const stats = await statsService.retrieve(id);
      if (!guard.isCurrent(seq)) return;
      setPartnerStats(stats);
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.stats.errors.partnerFailed', { defaultValue: 'Failed to load partner stats.' })));
    }
  };

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('admin.partner.stats.title', { defaultValue: 'Performance statistics' })}
          </h2>
          <div className="flex items-center gap-2">
            <select
              aria-label={t('admin.partner.stats.snapshots.periodFilter', { defaultValue: 'Period' })}
              className={`${inputClass} h-9 w-36`}
              value={periodTypeFilter}
              onChange={(event) => {
                setPeriodTypeFilter(event.currentTarget.value);
                setPage(1);
              }}
            >
              <option value="">{t('admin.partner.stats.snapshots.allPeriods', { defaultValue: 'All periods' })}</option>
              <option value="DAY">{t('admin.partner.stats.snapshots.day', { defaultValue: 'Daily' })}</option>
              <option value="MONTH">{t('admin.partner.stats.snapshots.month', { defaultValue: 'Monthly' })}</option>
            </select>
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('common.actions.refresh', { defaultValue: 'Refresh' })}
            </button>
          </div>
        </div>
        <InlineError message={error} />
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<UsersRound className="h-5 w-5 text-indigo-500" />}
            label={t('admin.partner.stats.overview.partners', { defaultValue: 'Partners' })}
            value={overview?.totalPartners ?? '-'}
            detail={t('admin.partner.stats.overview.active', { defaultValue: '{{count}} active', count: overview?.activePartners ?? '-' })}
          />
          <StatCard
            icon={<WalletCards className="h-5 w-5 text-emerald-500" />}
            label={t('admin.partner.stats.overview.joinFee', { defaultValue: 'Total join fees' })}
            value={formatDecimal(overview?.totalJoinFee)}
          />
          <StatCard
            icon={<BarChart3 className="h-5 w-5 text-amber-500" />}
            label={t('admin.partner.stats.overview.commission', { defaultValue: 'Total commission issued' })}
            value={formatDecimal(overview?.totalCommission)}
          />
          <StatCard
            icon={<WalletCards className="h-5 w-5 text-red-500" />}
            label={t('admin.partner.stats.overview.pendingWithdrawals', { defaultValue: 'Pending withdrawals' })}
            value={overview?.pendingWithdrawalCount ?? '-'}
            detail={t('admin.partner.stats.overview.pendingAmount', { defaultValue: '{{amount}} total', amount: formatDecimal(overview?.pendingWithdrawalAmount) })}
          />
        </div>
        <div className="grid shrink-0 gap-3 lg:grid-cols-2">
          <div className="shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#171717]">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              {t('admin.partner.stats.trend.title', { defaultValue: 'Monthly trend' })}
            </h3>
            {trend.labels.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {t('admin.partner.stats.trend.empty', { defaultValue: 'No monthly snapshots yet.' })}
              </p>
            ) : (
              <TrendChart labels={trend.labels} series={trend.series} />
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#171717]">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <BarChart3 className="h-4 w-4 text-amber-500" />
              {t('admin.partner.stats.ranking.title', { defaultValue: 'Partner ranking by commission' })}
            </h3>
            <TopPartners rows={ranking} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#171717]">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
            {t('admin.partner.stats.partner.title', { defaultValue: 'Single partner statistics' })}
          </h3>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void queryPartner(partnerId);
            }}
          >
            <PartnerPickerField
              name="partnerId"
              placeholder={t('admin.partner.stats.partner.idPlaceholder', { defaultValue: 'Select partner…' })}
              onChange={(ids) => {
                setPartnerId(ids);
                void queryPartner(ids);
              }}
            />
            <button type="submit" className={secondaryButtonClass} disabled={!partnerId.trim()}>
              <Search className="h-4 w-4" />
              {t('admin.partner.stats.partner.query', { defaultValue: 'Query' })}
            </button>
          </form>
          {partnerStats ? (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <StatItem label={t('admin.partner.stats.partner.joinFee', { defaultValue: 'Join fees' })} value={formatDecimal(partnerStats.totalJoinFee)} />
              <StatItem label={t('admin.partner.stats.partner.commission', { defaultValue: 'Commission earned' })} value={formatDecimal(partnerStats.totalCommission)} />
              <StatItem label={t('admin.partner.stats.partner.available', { defaultValue: 'Available balance' })} value={formatDecimal(partnerStats.availableBalance)} />
              <StatItem label={t('admin.partner.stats.partner.withdrawing', { defaultValue: 'Frozen (withdrawing)' })} value={formatDecimal(partnerStats.withdrawingAmount)} />
              <StatItem label={t('admin.partner.stats.partner.withdrawn', { defaultValue: 'Withdrawn' })} value={formatDecimal(partnerStats.withdrawnAmount)} />
              <StatItem label={t('admin.partner.stats.partner.customers', { defaultValue: 'Bound customers' })} value={partnerStats.customerCount} />
              <StatItem label={t('admin.partner.stats.partner.downstream', { defaultValue: 'Downstream partners' })} value={partnerStats.downstreamPartnerCount} />
            </dl>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 dark:border-white/10 dark:text-white">
            {t('admin.partner.stats.snapshots.title', { defaultValue: 'Period snapshots' })}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('admin.partner.stats.snapshots.partner', { defaultValue: 'Partner' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.stats.snapshots.period', { defaultValue: 'Period' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.stats.snapshots.joinFee', { defaultValue: 'Join fees' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.stats.snapshots.customers', { defaultValue: 'Customers' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.stats.snapshots.revenue', { defaultValue: 'Revenue base' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.stats.snapshots.commission', { defaultValue: 'Commission' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.stats.snapshots.downstream', { defaultValue: 'Downstream' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {snapshots.length === 0 ? (
                  <TableState loading={loading} empty={t('admin.partner.stats.snapshots.empty', { defaultValue: 'No snapshots yet.' })} colSpan={7} />
                ) : (
                  snapshots.map((snapshot) => (
                    <tr key={snapshot.id} className="text-slate-700 dark:text-slate-200">
                      <td className="px-4 py-3 font-mono text-xs">#{snapshot.partnerId}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{snapshot.periodType}</span>
                        <span className="block text-xs text-slate-500">
                          {formatDateTime(snapshot.periodStart)} - {formatDateTime(snapshot.periodEnd)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(snapshot.joinFeeTotal)}</td>
                      <td className="px-4 py-3">{snapshot.customerCount}</td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(snapshot.revenueBase)}</td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(snapshot.commissionEarned)}</td>
                      <td className="px-4 py-3">{snapshot.downstreamPartnerCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <BottomPagination
            page={page}
            pageSize={pageSize}
            total={snapshotsTotal}
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </div>
      </div>
    </PageShell>
  );
}

function StatCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#171717]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-50 dark:bg-white/5">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className="block truncate font-mono text-lg font-bold text-slate-900 dark:text-white">{value}</span>
        {detail ? <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{detail}</span> : null}
      </span>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-white/10">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}
