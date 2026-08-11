import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Clock3,
  HandCoins,
  Plus,
  RefreshCw,
  Sparkles,
  UsersRound,
  WalletCards,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CommissionEventItem, PartnerItem, StatsOverviewItem, WithdrawalItem } from '@sdkwork/partner-backend-sdk';
import {
  errorMessage,
  formatDateTime,
  formatDecimal,
  InlineError,
  PageShell,
  primaryButtonClass,
  secondaryButtonClass,
} from '@sdkwork/partner-pc-admin-core/ui';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';
import { partnerService } from '../services/partnerService';

/**
 * Partner Center workspace: one-screen operations overview with pending-work
 * to-dos, quick actions, and recent activity.
 */
export function PartnerHomePage() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [overview, setOverview] = useState<StatsOverviewItem | null>(null);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalItem[]>([]);
  const [pendingWithdrawalsTotal, setPendingWithdrawalsTotal] = useState(0);
  const [pendingEvents, setPendingEvents] = useState<CommissionEventItem[]>([]);
  const [pendingEventsTotal, setPendingEventsTotal] = useState(0);
  const [unpaidPartners, setUnpaidPartners] = useState(0);
  const [recentPartners, setRecentPartners] = useState<PartnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const [overviewResult, withdrawalPage, eventPage, unpaidPage, partnerPage] = await Promise.all([
        // Each panel degrades independently: one failing surface must not
        // blank the whole workspace.
        partnerService.stats.overview().catch(() => null),
        partnerService.withdrawals.list({ page: 1, pageSize: 5, status: 'PENDING' }).catch(() => null),
        partnerService.commissionEvents.list({ page: 1, pageSize: 5, status: 'PENDING' }).catch(() => null),
        partnerService.partners.list({ page: 1, pageSize: 1, joinFeeStatus: 'UNPAID' }).catch(() => null),
        partnerService.partners.list({ page: 1, pageSize: 5 }).catch(() => null),
      ]);
      if (!guard.isCurrent(seq)) return;
      setOverview(overviewResult);
      setPendingWithdrawals(withdrawalPage?.items ?? []);
      setPendingWithdrawalsTotal(Number(withdrawalPage?.pageInfo.totalItems ?? 0));
      setPendingEvents(eventPage?.items ?? []);
      setPendingEventsTotal(Number(eventPage?.pageInfo.totalItems ?? 0));
      setUnpaidPartners(Number(unpaidPage?.pageInfo.totalItems ?? 0));
      setRecentPartners(partnerPage?.items ?? []);
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.home.errors.loadFailed', { defaultValue: 'Failed to load the workspace.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  }, [guard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const todoCount = useMemo(
    () => pendingWithdrawalsTotal + pendingEventsTotal + unpaidPartners,
    [pendingWithdrawalsTotal, pendingEventsTotal, unpaidPartners],
  );

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              {t('admin.partner.home.title', { defaultValue: 'Partner Center workspace' })}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t('admin.partner.home.subtitle', { defaultValue: 'Pending work, key metrics, and recent activity at a glance.' })}
            </p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common.actions.refresh', { defaultValue: 'Refresh' })}
          </button>
        </div>
        <InlineError message={error} />

        {/* Key metrics */}
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<UsersRound className="h-5 w-5 text-indigo-500" />}
            label={t('admin.partner.home.metrics.partners', { defaultValue: 'Partners' })}
            value={overview?.totalPartners ?? '-'}
            detail={t('admin.partner.home.metrics.active', { defaultValue: '{{count}} active', count: overview?.activePartners ?? '-' })}
          />
          <MetricCard
            icon={<WalletCards className="h-5 w-5 text-emerald-500" />}
            label={t('admin.partner.home.metrics.commission', { defaultValue: 'Commission issued' })}
            value={formatDecimal(overview?.totalCommission)}
          />
          <MetricCard
            icon={<HandCoins className="h-5 w-5 text-amber-500" />}
            label={t('admin.partner.home.metrics.pendingWithdrawals', { defaultValue: 'Pending withdrawals' })}
            value={overview?.pendingWithdrawalCount ?? '-'}
            detail={t('admin.partner.home.metrics.pendingAmount', { defaultValue: '{{amount}}', amount: formatDecimal(overview?.pendingWithdrawalAmount) })}
          />
          <MetricCard
            icon={<Zap className="h-5 w-5 text-red-500" />}
            label={t('admin.partner.home.metrics.toDos', { defaultValue: 'Open to-dos' })}
            value={String(todoCount)}
            detail={t('admin.partner.home.metrics.toDosDetail', {
              defaultValue: '{{withdrawals}} withdrawals · {{events}} events · {{unpaid}} unpaid fees',
              withdrawals: pendingWithdrawalsTotal,
              events: pendingEventsTotal,
              unpaid: unpaidPartners,
            })}
          />
        </div>

        <div className="grid shrink-0 gap-3 lg:grid-cols-3">
          {/* Quick actions */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#171717]">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              {t('admin.partner.home.quick.title', { defaultValue: 'Quick actions' })}
            </h3>
            <div className="grid gap-2">
              <QuickLink href="/admin/partner/partners" label={t('admin.partner.home.quick.newPartner', { defaultValue: 'New partner' })} icon={<Plus className="h-4 w-4" />} />
              <QuickLink href="/admin/partner/withdrawals" label={t('admin.partner.home.quick.withdrawals', { defaultValue: 'Review withdrawals' })} icon={<WalletCards className="h-4 w-4" />} />
              <QuickLink href="/admin/partner/events" label={t('admin.partner.home.quick.settlement', { defaultValue: 'Run settlement' })} icon={<Zap className="h-4 w-4" />} />
              <QuickLink href="/admin/partner/ledger" label={t('admin.partner.home.quick.adjust', { defaultValue: 'Manual ledger adjustment' })} icon={<BarChart3 className="h-4 w-4" />} />
            </div>
          </div>

          {/* Pending withdrawals */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#171717]">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Clock3 className="h-4 w-4 text-amber-500" />
              {t('admin.partner.home.pending.title', { defaultValue: 'Pending reviews' })}
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                {todoCount}
              </span>
            </h3>
            {loading ? (
              <p className="py-6 text-center text-sm text-slate-500">{t('admin.partner.home.loading', { defaultValue: 'Loading…' })}</p>
            ) : (
              <div className="grid gap-1.5">
                {pendingWithdrawalsTotal > 0 ? (
                  <a href="/admin/partner/withdrawals" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm hover:bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5 dark:hover:bg-amber-500/10">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-amber-800 dark:text-amber-200">
                        {t('admin.partner.home.pending.withdrawals', { defaultValue: '{{count}} withdrawals awaiting review', count: pendingWithdrawalsTotal })}
                      </span>
                      {pendingWithdrawals[0] ? (
                        <span className="block text-xs text-amber-600 dark:text-amber-300/70">
                          {t('admin.partner.home.pending.latest', {
                            defaultValue: 'Latest: #{{partner}} {{amount}}',
                            partner: pendingWithdrawals[0]!.partnerId,
                            amount: formatDecimal(pendingWithdrawals[0]!.amount),
                          })}
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-amber-500" />
                  </a>
                ) : null}
                {pendingEventsTotal > 0 ? (
                  <a href="/admin/partner/events" className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-sm hover:bg-indigo-50 dark:border-indigo-500/20 dark:bg-indigo-500/5 dark:hover:bg-indigo-500/10">
                    <Zap className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-indigo-800 dark:text-indigo-200">
                        {t('admin.partner.home.pending.events', { defaultValue: '{{count}} events awaiting settlement', count: pendingEventsTotal })}
                      </span>
                      {pendingEvents[0] ? (
                        <span className="block text-xs text-indigo-600 dark:text-indigo-300/70">
                          {t('admin.partner.home.pending.latestEvent', {
                            defaultValue: 'Latest: {{source}} {{amount}}',
                            source: pendingEvents[0]!.sourceType,
                            amount: formatDecimal(pendingEvents[0]!.baseAmount),
                          })}
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-indigo-500" />
                  </a>
                ) : null}
                {unpaidPartners > 0 ? (
                  <a href="/admin/partner/partners" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm hover:bg-red-50 dark:border-red-500/20 dark:bg-red-500/5 dark:hover:bg-red-500/10">
                    <HandCoins className="h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-red-800 dark:text-red-200">
                        {t('admin.partner.home.pending.unpaidFees', { defaultValue: '{{count}} partners with unpaid join fees', count: unpaidPartners })}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-red-500" />
                  </a>
                ) : null}
                {todoCount === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    {t('admin.partner.home.pending.none', { defaultValue: 'Nothing pending — all caught up.' })}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Recent partners */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#171717]">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              {t('admin.partner.home.recent.title', { defaultValue: 'Recently created partners' })}
            </h3>
            {loading ? (
              <p className="py-6 text-center text-sm text-slate-500">{t('admin.partner.home.loading', { defaultValue: 'Loading…' })}</p>
            ) : recentPartners.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                {t('admin.partner.home.recent.empty', { defaultValue: 'No partners yet.' })}
              </p>
            ) : (
              <div className="grid gap-1.5">
                {recentPartners.map((partner) => (
                  <a key={partner.id} href="/admin/partner/partners" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{partner.name}</span>
                      <span className="block font-mono text-[11px] text-slate-400">#{partner.id}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{formatDateTime(partner.createdAt)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
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

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a href={href} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-white/10 dark:text-slate-200 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10">
      <span className="text-indigo-500">{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
    </a>
  );
}
