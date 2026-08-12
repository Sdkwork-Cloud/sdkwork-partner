import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight, Download, Play, Plus, RefreshCw, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CommissionEventItem, SettlementItem } from '@sdkwork/partner-backend-sdk';
import {
  BottomPagination,
  errorMessage,
  exportCsv,
  Field,
  formatDateTime,
  formatDecimal,
  InlineError,
  inputClass,
  toolbarInputClass,
  toolbarSelectClass,
  Modal,
  PageShell,
  primaryButtonClass,
  secondaryButtonClass,
  selectClass,
  TableState,
  textAreaClass,
  Tooltip,
  UserPickerField,
} from '@sdkwork/partner-pc-admin-core/ui';
import { EventStatusBadge } from '../components/status';
import { commissionService } from '../services/commissionService';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';

const EVENT_SOURCES = ['USAGE_SETTLEMENT', 'RECHARGE', 'MANUAL'] as const;
const EVENT_STATUSES = ['PENDING', 'SETTLED', 'SKIPPED', 'FAILED'] as const;

export function EventsPage() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [items, setItems] = useState<CommissionEventItem[]>([]);
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [settlementsTotal, setSettlementsTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ processed: string; settled: string; skipped: string; failed: string } | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [expandedSettlement, setExpandedSettlement] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => items.filter((event) => event.status === 'PENDING').length,
    [items],
  );

  const load = useCallback(async () => {
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const [eventPage, settlementPage] = await Promise.all([
        // The events list is primary; a settlement query failure must not
        // blank the whole page.
        commissionService.commissionEvents.list({
          page,
          pageSize,
          status: (statusFilter || undefined) as CommissionEventItem['status'],
          sourceType: (sourceFilter || undefined) as CommissionEventItem['sourceType'],
        }).catch(() => null),
        commissionService.settlements.list({ page: 1, pageSize: 20 }).catch(() => null),
      ]);
      if (!guard.isCurrent(seq)) return;
      setItems(eventPage?.items ?? []);
      setTotal(Number(eventPage?.pageInfo.totalItems ?? 0));
      setSettlements(settlementPage?.items ?? []);
      setSettlementsTotal(Number(settlementPage?.pageInfo.totalItems ?? 0));
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.events.errors.loadFailed', { defaultValue: 'Failed to load revenue events.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  }, [page, pageSize, statusFilter, sourceFilter, guard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSettlement = async () => {
    setBusy(true);
    setError(null);
    setRunResult(null);
    try {
      const result = await commissionService.settlements.run({ limit: '100' });
      setRunResult(result);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.events.errors.runFailed', { defaultValue: 'Failed to run settlement.' })));
    } finally {
      setBusy(false);
    }
  };

  const createManualEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      await commissionService.commissionEvents.create({
        sourceRef: String(form.get('sourceRef') ?? '').trim(),
        customerUserId: String(form.get('customerUserId') ?? '').trim(),
        baseAmount: String(form.get('baseAmount') ?? '').trim(),
        remark: optional(form, 'remark'),
      });
      setShowManual(false);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.events.errors.createFailed', { defaultValue: 'Failed to create revenue event.' })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('admin.partner.events.title', { defaultValue: 'Revenue events & settlement' })}
          </h2>
          <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]">
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.events.filter.source', { defaultValue: 'Source' })}
              <select className={`${toolbarSelectClass} w-32`} value={sourceFilter} onChange={(event) => {
                setSourceFilter(event.currentTarget.value);
                setPage(1);
              }}>
                <option value="">{t('admin.partner.events.filter.allSources', { defaultValue: 'All sources' })}</option>
                {EVENT_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {t(`admin.partner.events.source.${source.toLowerCase()}`, { defaultValue: source })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.events.filter.status', { defaultValue: 'Status' })}
              <select className={`${toolbarSelectClass} w-32`} value={statusFilter} onChange={(event) => {
                setStatusFilter(event.currentTarget.value);
                setPage(1);
              }}>
                <option value="">{t('admin.partner.events.filter.allStatus', { defaultValue: 'All statuses' })}</option>
                {EVENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`admin.partner.event.status.${status.toLowerCase()}`, { defaultValue: status })}
                  </option>
                ))}
              </select>
            </label>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {t('common.actions.refresh', { defaultValue: 'Refresh' })}
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={items.length === 0}
                onClick={() =>
                  exportCsv('commission-events', items.map((event) => ({
                    id: event.id,
                    sourceType: event.sourceType,
                    sourceRef: event.sourceRef,
                    customerUserId: event.customerUserId,
                    baseAmount: event.baseAmount,
                    status: event.status,
                    eventAt: event.eventAt,
                    remark: event.remark,
                  })))
                }
              >
                <Download className="h-4 w-4" />
                {t('admin.partner.events.actions.export', { defaultValue: 'Export' })}
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => void runSettlement()} disabled={busy}>
                <Play className="h-4 w-4" />
                {t('admin.partner.events.actions.runSettlement', { defaultValue: 'Run settlement' })}
              </button>
              <button type="button" className={primaryButtonClass} onClick={() => setShowManual(true)}>
                <Plus className="h-4 w-4" />
                {t('admin.partner.events.actions.manualEvent', { defaultValue: 'Manual event' })}
              </button>
            </div>
          </div>
        </div>
        <InlineError message={error} />
        {pendingCount > 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <Zap className="h-4 w-4 shrink-0" />
            {t('admin.partner.events.pendingSummary', {
              defaultValue: '{{count}} pending events on this page — run settlement to distribute commissions.',
              count: pendingCount,
            })}
          </div>
        ) : null}
        {runResult ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Zap className="h-4 w-4" />
            {t('admin.partner.events.runResult', {
              defaultValue: 'Settlement done: processed {{processed}}, settled {{settled}}, skipped {{skipped}}, failed {{failed}}',
              processed: runResult.processed,
              settled: runResult.settled,
              skipped: runResult.skipped,
              failed: runResult.failed,
            })}
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('admin.partner.events.table.source', { defaultValue: 'Source' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.events.table.customer', { defaultValue: 'Customer' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.events.table.baseAmount', { defaultValue: 'Base amount' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.events.table.eventAt', { defaultValue: 'Event time' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.events.table.status', { defaultValue: 'Status' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.events.table.remark', { defaultValue: 'Remark' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {items.length === 0 ? (
                  <TableState loading={loading} empty={t('admin.partner.events.empty', { defaultValue: 'No revenue events yet.' })} colSpan={6} />
                ) : (
                  items.map((event) => (
                    <tr key={event.id} className="text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <span className="font-medium">{t(`admin.partner.events.source.${event.sourceType.toLowerCase()}`, { defaultValue: event.sourceType })}</span>
                        <span className="block font-mono text-xs text-slate-500">{event.sourceRef}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{event.customerUserId}</td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(event.baseAmount)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(event.eventAt)}</td>
                      <td className="px-4 py-3"><EventStatusBadge status={event.status} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{event.remark || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <BottomPagination
            page={page}
            pageSize={pageSize}
            total={total}
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </div>
        {settlements.length > 0 ? (
          <div className="max-h-72 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 dark:border-white/10 dark:text-white">
              {t('admin.partner.events.settlements.title', { defaultValue: 'Recent settlements' })}
              <span className="text-xs font-normal text-slate-500">({settlementsTotal})</span>
            </div>
            <div className="max-h-56 overflow-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                  <tr>
                    <th className="w-10 px-4 py-2.5" />
                    <th className="px-4 py-2.5">{t('admin.partner.events.settlements.baseAmount', { defaultValue: 'Base' })}</th>
                    <th className="px-4 py-2.5">{t('admin.partner.events.settlements.distributed', { defaultValue: 'Distributed' })}</th>
                    <th className="px-4 py-2.5">{t('admin.partner.events.settlements.receivers', { defaultValue: 'Receivers' })}</th>
                    <th className="px-4 py-2.5">{t('admin.partner.events.settlements.status', { defaultValue: 'Status' })}</th>
                    <th className="px-4 py-2.5">{t('admin.partner.events.settlements.computedAt', { defaultValue: 'Computed' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {settlements.map((settlement) => {
                    const isExpanded = expandedSettlement === settlement.id;
                    return (
                      <FragmentRow key={settlement.id}>
                        <tr className="text-slate-700 dark:text-slate-200">
                          <td className="px-4 py-2.5">
                            {settlement.distributions.length > 0 ? (
                              <Tooltip content={t('admin.partner.events.settlements.toggle', { defaultValue: 'View distribution detail' })}>
                                <button
                                  type="button"
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                                  onClick={() => setExpandedSettlement(isExpanded ? null : settlement.id)}
                                >
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              </Tooltip>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 font-mono">{formatDecimal(settlement.baseAmount)}</td>
                          <td className="px-4 py-2.5 font-mono">{formatDecimal(settlement.distributedAmount)}</td>
                          <td className="px-4 py-2.5">{settlement.receiverCount}</td>
                          <td className="px-4 py-2.5"><EventStatusBadge status={settlement.status} /></td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{formatDateTime(settlement.computedAt)}</td>
                        </tr>
                        {isExpanded ? (
                          <tr className="bg-slate-50/60 dark:bg-white/[0.02]">
                            <td colSpan={6} className="px-6 py-3">
                              {settlement.distributions.length === 0 ? (
                                <p className="py-2 text-center text-xs text-slate-500">
                                  {t('admin.partner.events.settlements.noDistributions', { defaultValue: 'No distributions.' })}
                                </p>
                              ) : (
                                <table className="w-full text-left text-xs">
                                  <thead className="text-[10px] uppercase text-slate-400">
                                    <tr>
                                      <th className="px-2 py-1">{t('admin.partner.events.settlements.receiver', { defaultValue: 'Receiver' })}</th>
                                      <th className="px-2 py-1">{t('admin.partner.events.settlements.offset', { defaultValue: 'Level offset' })}</th>
                                      <th className="px-2 py-1">{t('admin.partner.events.settlements.ratio', { defaultValue: 'Ratio' })}</th>
                                      <th className="px-2 py-1 text-right">{t('admin.partner.events.settlements.amount', { defaultValue: 'Amount' })}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {settlement.distributions.map((distribution) => (
                                      <tr key={distribution.id}>
                                        <td className="px-2 py-1 font-mono">#{distribution.receiverPartnerId}</td>
                                        <td className="px-2 py-1">{distribution.levelOffset}</td>
                                        <td className="px-2 py-1 font-mono">{formatDecimal(distribution.ratio)}%</td>
                                        <td className="px-2 py-1 text-right font-mono">{formatDecimal(distribution.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </FragmentRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {showManual ? (
        <Modal
          title={t('admin.partner.events.manual.title', { defaultValue: 'Record manual revenue event' })}
          busy={busy}
          submitLabel={t('admin.partner.events.manual.action', { defaultValue: 'Record event' })}
          onSubmit={createManualEvent}
          onClose={() => setShowManual(false)}
        >
          <div className="grid gap-4">
            <Field label={t('admin.partner.events.manual.sourceRef', { defaultValue: 'Source reference' })} required hint={t('admin.partner.events.manual.sourceRefHint', { defaultValue: 'Unique per source type.' })}>
              <input name="sourceRef" className={inputClass} required />
            </Field>
            <Field label={t('admin.partner.events.manual.customerUserId', { defaultValue: 'Customer (IAM user)' })} required>
              <UserPickerField name="customerUserId" required />
            </Field>
            <Field label={t('admin.partner.events.manual.baseAmount', { defaultValue: 'Commissionable base amount' })} required>
              <input name="baseAmount" type="number" min="0" step="0.01" className={inputClass} required />
            </Field>
            <Field label={t('admin.partner.events.manual.remark', { defaultValue: 'Remark' })}>
              <textarea name="remark" className={textAreaClass} />
            </Field>
          </div>
        </Modal>
      ) : null}
    </PageShell>
  );
}

function optional(form: FormData, key: string): string | undefined {
  const value = String(form.get(key) ?? '').trim();
  return value || undefined;
}

/** Fragment wrapper allowing a row pair (main + expanded detail) in a table body. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
