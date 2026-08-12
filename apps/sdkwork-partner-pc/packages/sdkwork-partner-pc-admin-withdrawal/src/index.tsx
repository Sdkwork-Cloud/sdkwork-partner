import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Banknote, Check, Download, Plus, RefreshCw, WalletCards, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PartnerStatItem, WithdrawalItem } from '@sdkwork/partner-backend-sdk';
import { getPartnerBackendClient, useRequestGuard } from '@sdkwork/partner-pc-admin-core';
import {
  BottomPagination,
  ConfirmDialog,
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
  PartnerPickerField,
  primaryButtonClass,
  secondaryButtonClass,
  selectClass,
  TableState,
  textAreaClass,
  Tooltip,
} from '@sdkwork/partner-pc-admin-core/ui';
import { WithdrawalStatusBadge } from './components/status';
import { withdrawalService } from './services/withdrawalService';

const WITHDRAWAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'] as const;

export function WithdrawalAdmin() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [items, setItems] = useState<WithdrawalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ withdrawal: WithdrawalItem; approve: boolean } | null>(null);
  const [reviewBalance, setReviewBalance] = useState<PartnerStatItem | null>(null);
  const [payTarget, setPayTarget] = useState<WithdrawalItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchTarget, setBatchTarget] = useState<{ approve: boolean } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  /** Open the review dialog and load the partner's available balance for context. */
  const openReview = async (withdrawal: WithdrawalItem, approve: boolean) => {
    setReviewTarget({ withdrawal, approve });
    setReviewBalance(null);
    try {
      const stats = await getPartnerBackendClient().partners.stats.retrieve(withdrawal.partnerId);
      setReviewBalance(stats);
    } catch {
      // Balance is contextual; a failure must not block review.
    }
  };

  const load = useCallback(async () => {
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const result = await withdrawalService.list({
        page,
        pageSize,
        status: (statusFilter || undefined) as WithdrawalItem['status'],
      });
      if (!guard.isCurrent(seq)) return;
      setItems(result.items);
      setTotal(Number(result.pageInfo.totalItems));
      setSelectedIds(new Set());
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.withdrawal.errors.loadFailed', { defaultValue: 'Failed to load withdrawals.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  }, [page, pageSize, statusFilter, guard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageAmountTotal = useMemo(
    () => items.reduce((sum, withdrawal) => sum + (Number(withdrawal.amount) || 0), 0),
    [items],
  );

  /** Withdrawals selectable for batch review (pending only). */
  const selectableIds = useMemo(
    () => new Set(items.filter((withdrawal) => withdrawal.status === 'PENDING').map((withdrawal) => withdrawal.id)),
    [items],
  );

  const allPageSelected = useMemo(
    () => selectableIds.size > 0 && [...selectableIds].every((id) => selectedIds.has(id)),
    [selectableIds, selectedIds],
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        for (const id of selectableIds) next.delete(id);
      } else {
        for (const id of selectableIds) next.add(id);
      }
      return next;
    });
  };

  const batchSelectedAmount = useMemo(
    () =>
      items
        .filter((withdrawal) => selectedIds.has(withdrawal.id))
        .reduce((sum, withdrawal) => sum + (Number(withdrawal.amount) || 0), 0),
    [items, selectedIds],
  );

  const submitBatchReview = async (event: FormEvent<HTMLFormElement>) => {
    if (!batchTarget) return;
    event.preventDefault();
    setBusy(true);
    setError(null);
    setBatchError(null);
    try {
      const form = new FormData(event.currentTarget);
      const reviewRemark = String(form.get('reviewRemark') ?? '').trim();
      if (!batchTarget.approve && !reviewRemark) {
        setBatchError(t('admin.partner.withdrawal.errors.rejectRemarkRequired', { defaultValue: 'A remark is required when rejecting a withdrawal.' }));
        return;
      }
      const ids = [...selectedIds];
      let processed = 0;
      for (const id of ids) {
        try {
          await withdrawalService.review(id, {
            approve: batchTarget.approve,
            reviewRemark: reviewRemark || undefined,
          });
          processed += 1;
        } catch (cause) {
          // Continue reporting the partial result; remaining items are skipped.
          setBatchError(errorMessage(cause, t('admin.partner.withdrawal.errors.reviewFailed', { defaultValue: 'Failed to review the withdrawal.' })));
          break;
        }
      }
      if (processed === ids.length) {
        setBatchTarget(null);
        setNotice(t('admin.partner.withdrawal.notice.batchReviewed', {
          defaultValue: '{{count}} withdrawals reviewed.',
          count: processed,
        }));
      } else {
        setBatchError(t('admin.partner.withdrawal.errors.batchPartial', {
          defaultValue: 'Processed {{processed}} of {{total}}; a withdrawal failed and the rest were skipped.',
          processed,
          total: ids.length,
        }));
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const exportWithdrawals = async () => {
    setExporting(true);
    setError(null);
    try {
      const page = await withdrawalService.list({
        page: 1,
        pageSize: 200,
        status: (statusFilter || undefined) as WithdrawalItem['status'],
      });
      exportCsv('withdrawals', page.items.map((withdrawal) => ({
        id: withdrawal.id,
        partnerId: withdrawal.partnerId,
        amount: withdrawal.amount,
        status: withdrawal.status,
        reviewRemark: withdrawal.reviewRemark,
        createdAt: withdrawal.createdAt,
        paidAt: withdrawal.paidAt ?? '',
      })));
      setNotice(t('admin.partner.withdrawal.notice.exported', {
        defaultValue: 'Exported {{count}} withdrawals.',
        count: page.items.length,
      }));
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.withdrawal.errors.exportFailed', { defaultValue: 'Failed to export withdrawals.' })));
    } finally {
      setExporting(false);
    }
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    if (!reviewTarget) return;
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const reviewRemark = String(form.get('reviewRemark') ?? '').trim();
      // Rejections must carry a reason for the partner and the audit trail.
      if (!reviewTarget.approve && !reviewRemark) {
        setError(t('admin.partner.withdrawal.errors.rejectRemarkRequired', { defaultValue: 'A remark is required when rejecting a withdrawal.' }));
        return;
      }
      await withdrawalService.review(reviewTarget.withdrawal.id, {
        approve: reviewTarget.approve,
        reviewRemark: reviewRemark || undefined,
      });
      setReviewTarget(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.withdrawal.errors.reviewFailed', { defaultValue: 'Failed to review the withdrawal.' })));
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    if (!payTarget) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawalService.pay(payTarget.id, { remark: t('admin.partner.withdrawal.pay.remark', { defaultValue: 'Paid offline' }) });
      setPayTarget(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.withdrawal.errors.payFailed', { defaultValue: 'Failed to mark the withdrawal as paid.' })));
    } finally {
      setBusy(false);
    }
  };

  const createWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      await withdrawalService.create({
        partnerId: String(form.get('partnerId') ?? '').trim(),
        amount: String(form.get('amount') ?? '').trim(),
        remark: optional(form, 'remark'),
      });
      setShowCreate(false);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.withdrawal.errors.createFailed', { defaultValue: 'Failed to create the withdrawal.' })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('admin.partner.withdrawal.title', { defaultValue: 'Withdrawal management' })}
          </h2>
          <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]">
            {selectedIds.size > 0 ? (
              <>
                <span className="inline-flex h-8 shrink-0 items-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {t('admin.partner.withdrawal.batch.selected', { defaultValue: '{{count}} selected · {{amount}}', count: selectedIds.size, amount: formatDecimal(batchSelectedAmount) })}
                </span>
                <button type="button" className={secondaryButtonClass} onClick={() => setBatchTarget({ approve: true })}>
                  <Check className="h-4 w-4 text-emerald-600" />
                  {t('admin.partner.withdrawal.actions.approve', { defaultValue: 'Approve' })}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setBatchTarget({ approve: false })}>
                  <X className="h-4 w-4 text-red-500" />
                  {t('admin.partner.withdrawal.actions.reject', { defaultValue: 'Reject' })}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setSelectedIds(new Set())}>
                  {t('common.actions.clear', { defaultValue: 'Clear' })}
                </button>
              </>
            ) : null}
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.withdrawal.filter.status', { defaultValue: 'Status' })}
              <select className={`${toolbarSelectClass} w-32`} value={statusFilter} onChange={(event) => {
                setStatusFilter(event.currentTarget.value);
                setPage(1);
              }}>
                <option value="">{t('admin.partner.withdrawal.filter.allStatus', { defaultValue: 'All statuses' })}</option>
                {WITHDRAWAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`admin.partner.withdrawal.status.${status.toLowerCase()}`, { defaultValue: status })}
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
                disabled={items.length === 0 || exporting}
                onClick={() => void exportWithdrawals()}
              >
                <Download className="h-4 w-4" />
                {exporting
                  ? t('admin.partner.withdrawal.actions.exporting', { defaultValue: 'Exporting…' })
                  : t('admin.partner.withdrawal.actions.export', { defaultValue: 'Export' })}
              </button>
              <button type="button" className={primaryButtonClass} onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                {t('admin.partner.withdrawal.actions.new', { defaultValue: 'Create for partner' })}
              </button>
            </div>
          </div>
        </div>
        <InlineError message={error} />
        {notice ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="min-w-0 flex-1">{notice}</span>
            <button type="button" className="text-xs font-medium underline-offset-2 hover:underline" onClick={() => setNotice(null)}>
              {t('common.actions.dismiss', { defaultValue: 'Dismiss' })}
            </button>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={t('admin.partner.withdrawal.batch.selectPage', { defaultValue: 'Select page' })}
                      className="h-4 w-4 accent-indigo-600"
                      checked={allPageSelected}
                      disabled={selectableIds.size === 0}
                      onChange={togglePageSelection}
                    />
                  </th>
                  <th className="px-4 py-3">{t('admin.partner.withdrawal.table.partner', { defaultValue: 'Partner' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.withdrawal.table.amount', { defaultValue: 'Amount' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.withdrawal.table.status', { defaultValue: 'Status' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.withdrawal.table.reviewRemark', { defaultValue: 'Review remark' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.withdrawal.table.createdAt', { defaultValue: 'Applied' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.withdrawal.table.paidAt', { defaultValue: 'Paid' })}</th>
                  <th className="px-4 py-3 text-right">{t('admin.partner.withdrawal.table.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {items.length === 0 ? (
                  <TableState loading={loading} empty={t('admin.partner.withdrawal.empty', { defaultValue: 'No withdrawal requests.' })} colSpan={8} />
                ) : (
                  items.map((withdrawal) => (
                    <tr key={withdrawal.id} className={`text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-white/[0.03] ${selectedIds.has(withdrawal.id) ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={t('admin.partner.withdrawal.batch.select', { defaultValue: 'Select' })}
                          className="h-4 w-4 accent-indigo-600"
                          checked={selectedIds.has(withdrawal.id)}
                          disabled={withdrawal.status !== 'PENDING'}
                          onChange={() => toggleSelection(withdrawal.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">#{withdrawal.partnerId}</td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(withdrawal.amount)}</td>
                      <td className="px-4 py-3"><WithdrawalStatusBadge status={withdrawal.status} /></td>
                      <td className="max-w-48 truncate px-4 py-3 text-xs text-slate-500">{withdrawal.reviewRemark || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(withdrawal.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(withdrawal.paidAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {withdrawal.status === 'PENDING' ? (
                            <>
                              <Tooltip content={t('admin.partner.withdrawal.actions.approve', { defaultValue: 'Approve' })}>
                                <button
                                  type="button"
                                  className={secondaryButtonClass}
                                  onClick={() => void openReview(withdrawal, true)}
                                >
                                  <Check className="h-4 w-4 text-emerald-600" />
                                </button>
                              </Tooltip>
                              <Tooltip content={t('admin.partner.withdrawal.actions.reject', { defaultValue: 'Reject' })}>
                                <button
                                  type="button"
                                  className={secondaryButtonClass}
                                  onClick={() => void openReview(withdrawal, false)}
                                >
                                  <X className="h-4 w-4 text-red-500" />
                                </button>
                              </Tooltip>
                            </>
                          ) : null}
                          {withdrawal.status === 'APPROVED' ? (
                            <Tooltip content={t('admin.partner.withdrawal.actions.markPaid', { defaultValue: 'Mark as paid' })}>
                              <button
                                type="button"
                                className={secondaryButtonClass}
                                onClick={() => setPayTarget(withdrawal)}
                              >
                                <Banknote className="h-4 w-4 text-emerald-600" />
                              </button>
                            </Tooltip>
                          ) : null}
                        </div>
                      </td>
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
          {items.length > 0 ? (
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2.5 text-sm dark:border-white/10">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('admin.partner.withdrawal.summary.pageAmount', { defaultValue: 'Page total' })}
              </span>
              <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                {pageAmountTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {reviewTarget ? (
        <Modal
          title={
            reviewTarget.approve
              ? t('admin.partner.withdrawal.review.approveTitle', { defaultValue: 'Approve withdrawal' })
              : t('admin.partner.withdrawal.review.rejectTitle', { defaultValue: 'Reject withdrawal' })
          }
          description={t('admin.partner.withdrawal.review.description', {
            defaultValue: 'Partner #{{id}}, amount {{amount}}.',
            id: reviewTarget.withdrawal.partnerId,
            amount: formatDecimal(reviewTarget.withdrawal.amount),
          })}
          busy={busy}
          submitLabel={
            reviewTarget.approve
              ? t('admin.partner.withdrawal.actions.approve', { defaultValue: 'Approve' })
              : t('admin.partner.withdrawal.actions.reject', { defaultValue: 'Reject' })
          }
          onSubmit={submitReview}
          onClose={() => setReviewTarget(null)}
        >
          <div className="grid gap-4">
            {reviewBalance ? (
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5">
                <WalletCards className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('admin.partner.withdrawal.review.availableBalance', { defaultValue: 'Partner available balance' })}
                </span>
                <span className="ml-auto font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  {formatDecimal(reviewBalance.availableBalance)}
                </span>
              </div>
            ) : null}
            <Field label={t('admin.partner.withdrawal.review.remark', { defaultValue: 'Review remark' })} hint={t('admin.partner.withdrawal.review.remarkHint', { defaultValue: 'Optional; recorded on the withdrawal.' })}>
              <textarea name="reviewRemark" className={textAreaClass} />
            </Field>
          </div>
        </Modal>
      ) : null}
      {payTarget ? (
        <ConfirmDialog
          title={t('admin.partner.withdrawal.pay.title', { defaultValue: 'Mark as paid' })}
          description={t('admin.partner.withdrawal.pay.description', {
            defaultValue: 'Confirm {{amount}} was paid to partner #{{id}} offline?',
            amount: formatDecimal(payTarget.amount),
            id: payTarget.partnerId,
          })}
          confirmLabel={t('admin.partner.withdrawal.actions.markPaid', { defaultValue: 'Mark as paid' })}
          isBusy={busy}
          onCancel={() => setPayTarget(null)}
          onConfirm={() => void markPaid()}
        />
      ) : null}
      {batchTarget ? (
        <Modal
          title={
            batchTarget.approve
              ? t('admin.partner.withdrawal.batch.approveTitle', { defaultValue: 'Batch approve withdrawals' })
              : t('admin.partner.withdrawal.batch.rejectTitle', { defaultValue: 'Batch reject withdrawals' })
          }
          description={t('admin.partner.withdrawal.batch.description', {
            defaultValue: 'Apply to {{count}} selected withdrawals, {{amount}} in total.',
            count: selectedIds.size,
            amount: formatDecimal(batchSelectedAmount),
          })}
          busy={busy}
          submitLabel={
            batchTarget.approve
              ? t('admin.partner.withdrawal.actions.approve', { defaultValue: 'Approve' })
              : t('admin.partner.withdrawal.actions.reject', { defaultValue: 'Reject' })
          }
          onSubmit={submitBatchReview}
          onClose={() => setBatchTarget(null)}
        >
          <div className="grid gap-4">
            <InlineError message={batchError} />
            <Field
              label={t('admin.partner.withdrawal.review.remark', { defaultValue: 'Review remark' })}
              hint={t('admin.partner.withdrawal.batch.remarkHint', {
                defaultValue: 'Required for rejections; applied to every selected withdrawal.',
              })}
            >
              <textarea name="reviewRemark" className={textAreaClass} />
            </Field>
          </div>
        </Modal>
      ) : null}
      {showCreate ? (
        <Modal
          title={t('admin.partner.withdrawal.create.title', { defaultValue: 'Create withdrawal for partner' })}
          busy={busy}
          submitLabel={t('admin.partner.withdrawal.create.action', { defaultValue: 'Create withdrawal' })}
          onSubmit={createWithdrawal}
          onClose={() => setShowCreate(false)}
        >
          <div className="grid gap-4">
            <Field label={t('admin.partner.withdrawal.create.partnerId', { defaultValue: 'Partner' })} required>
              <PartnerPickerField name="partnerId" required />
            </Field>
            <Field label={t('admin.partner.withdrawal.create.amount', { defaultValue: 'Amount' })} required hint={t('admin.partner.withdrawal.create.amountHint', { defaultValue: 'Must not exceed the available balance or fall below the minimum.' })}>
              <input name="amount" type="number" min="0" step="0.01" className={inputClass} required />
            </Field>
            <Field label={t('admin.partner.withdrawal.create.remark', { defaultValue: 'Remark' })}>
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
