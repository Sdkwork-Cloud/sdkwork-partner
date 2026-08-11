import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, WalletCards } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { JoinFeePaymentItem } from '@sdkwork/partner-backend-sdk';
import {
  BottomPagination,
  errorMessage,
  formatDateTime,
  formatDecimal,
  InlineError,
  inputClass,
  toolbarSelectClass,
  PageShell,
  PartnerPickerField,
  secondaryButtonClass,
  selectClass,
  TableState,
} from '@sdkwork/partner-pc-admin-core/ui';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';
import { partnerService } from '../services/partnerService';

/** Global join-fee payment register across every partner. */
export function JoinFeePaymentsPage() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [items, setItems] = useState<JoinFeePaymentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [partnerIdFilter, setPartnerIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const result = await partnerService.joinFeePayments.listAll({
        page: String(page),
        pageSize: String(pageSize),
        partnerId: partnerIdFilter || undefined,
        status: statusFilter || undefined,
      });
      if (!guard.isCurrent(seq)) return;
      setItems(result.items);
      setTotal(Number(result.pageInfo.totalItems));
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.joinFees.errors.loadFailed', { defaultValue: 'Failed to load join fee payments.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  }, [page, pageSize, partnerIdFilter, statusFilter, guard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <WalletCards className="h-4 w-4 text-emerald-500" />
            {t('admin.partner.joinFees.title', { defaultValue: 'Join fee payments' })}
          </h2>
          <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]">
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.joinFees.filter.partnerId', { defaultValue: 'Partner' })}
              <div className="w-44">
                <PartnerPickerField
                  name="partnerIdFilter"
                  placeholder={t('admin.partner.picker.partner.select', { defaultValue: 'Select partner(s)…' })}
                  onChange={(ids) => {
                    setPartnerIdFilter(ids);
                    setPage(1);
                  }}
                />
              </div>
            </label>
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.joinFees.filter.status', { defaultValue: 'Status' })}
              <select className={`${toolbarSelectClass} w-32`} value={statusFilter} onChange={(event) => {
                setStatusFilter(event.currentTarget.value);
                setPage(1);
              }}>
                <option value="">{t('admin.partner.joinFees.filter.allStatus', { defaultValue: 'All statuses' })}</option>
                <option value="PAID">{t('admin.partner.joinFee.status.paid', { defaultValue: 'Paid' })}</option>
                <option value="REFUNDED">{t('admin.partner.joinFees.status.refunded', { defaultValue: 'Refunded' })}</option>
              </select>
            </label>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {t('common.actions.refresh', { defaultValue: 'Refresh' })}
              </button>
            </div>
          </div>
        </div>
        <InlineError message={error} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('admin.partner.joinFees.table.partner', { defaultValue: 'Partner' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.joinFees.table.amount', { defaultValue: 'Amount' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.joinFees.table.currency', { defaultValue: 'Currency' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.joinFees.table.method', { defaultValue: 'Method' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.joinFees.table.status', { defaultValue: 'Status' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.joinFees.table.paidAt', { defaultValue: 'Paid at' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.joinFees.table.remark', { defaultValue: 'Remark' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {items.length === 0 ? (
                  <TableState loading={loading} empty={t('admin.partner.joinFees.empty', { defaultValue: 'No join fee payments recorded.' })} colSpan={7} />
                ) : (
                  items.map((payment) => (
                    <tr key={payment.id} className="text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-mono text-xs">#{payment.partnerId}</td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(payment.amount)}</td>
                      <td className="px-4 py-3 text-xs">{payment.currency}</td>
                      <td className="px-4 py-3 text-xs">{payment.paymentMethod || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex min-w-16 justify-center rounded-full px-2 py-1 text-xs font-semibold ${payment.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                          {t(`admin.partner.joinFees.status.${payment.status.toLowerCase()}`, { defaultValue: payment.status })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(payment.paidAt ?? payment.createdAt)}</td>
                      <td className="max-w-48 truncate px-4 py-3 text-xs text-slate-500">{payment.remark || '-'}</td>
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
      </div>
    </PageShell>
  );
}
