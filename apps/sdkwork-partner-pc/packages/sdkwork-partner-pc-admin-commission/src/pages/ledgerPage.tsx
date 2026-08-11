import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LedgerEntryItem } from '@sdkwork/partner-backend-sdk';
import {
  BottomPagination,
  errorMessage,
  Field,
  formatDateTime,
  formatDecimal,
  InlineError,
  inputClass,
  toolbarSelectClass,
  selectClass,
  Modal,
  PageShell,
  PartnerPickerField,
  primaryButtonClass,
  secondaryButtonClass,
  TableState,
  textAreaClass,
} from '@sdkwork/partner-pc-admin-core/ui';
import { commissionService } from '../services/commissionService';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';

const ENTRY_TYPES: Record<string, string> = {
  JOIN_FEE_PAYMENT: 'Join fee payment',
  JOIN_FEE_COMMISSION: 'Join fee commission',
  REVENUE_COMMISSION: 'Revenue commission',
  WITHDRAWAL_APPLY: 'Withdrawal apply',
  WITHDRAWAL_REJECT: 'Withdrawal reject',
  WITHDRAWAL_PAID: 'Withdrawal paid',
  MANUAL_ADJUST: 'Manual adjust',
};

const ENTRY_TYPE_KEYS = Object.keys(ENTRY_TYPES);

export function LedgerPage() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [appliedPartnerId, setAppliedPartnerId] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState('');
  const [items, setItems] = useState<LedgerEntryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);

  const load = useCallback(
    async (targetPage: number) => {
      if (!appliedPartnerId) {
        setItems([]);
        setTotal(0);
        return;
      }
      const seq = guard.next();
      setLoading(true);
      setError(null);
      try {
        const result = await commissionService.ledger.list(appliedPartnerId, {
          page: targetPage,
          pageSize,
          entryType: entryTypeFilter || undefined,
        });
        if (!guard.isCurrent(seq)) return;
        setItems(result.items);
        setTotal(Number(result.pageInfo.totalItems));
        setPage(targetPage);
      } catch (cause) {
        setError(errorMessage(cause, t('admin.partner.ledger.errors.loadFailed', { defaultValue: 'Failed to load ledger entries.' })));
      } finally {
        if (guard.isCurrent(seq)) setLoading(false);
      }
    },
    [appliedPartnerId, pageSize, entryTypeFilter, guard, t],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const adjust = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      await commissionService.ledger.createAdjustment({
        partnerId: appliedPartnerId,
        amount: String(form.get('amount') ?? '').trim(),
        remark: String(form.get('remark') ?? '').trim(),
      });
      setShowAdjust(false);
      await load(page);
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.ledger.errors.adjustFailed', { defaultValue: 'Failed to adjust the ledger.' })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('admin.partner.ledger.title', { defaultValue: 'Revenue ledger' })}
          </h2>
          <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]">
            <form
              className="flex shrink-0 items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void load(1);
              }}
            >
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('admin.partner.ledger.partnerIdPlaceholder', { defaultValue: 'Select partner…' })}
                <PartnerPickerField
                  name="partnerId"
                  placeholder={t('admin.partner.ledger.partnerIdPlaceholder', { defaultValue: 'Select partner…' })}
                  onChange={(ids) => {
                    // The [load] effect reacts to appliedPartnerId changes,
                    // so a single setState triggers exactly one query.
                    setAppliedPartnerId(ids);
                  }}
                />
              </label>
              <button type="submit" className={secondaryButtonClass} disabled={!appliedPartnerId.trim()}>
                <Search className="h-4 w-4" />
                {t('admin.partner.ledger.actions.query', { defaultValue: 'Query' })}
              </button>
            </form>
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.ledger.filter.type', { defaultValue: 'Entry type' })}
              <select className={`${toolbarSelectClass} w-40`} value={entryTypeFilter} onChange={(event) => {
                setEntryTypeFilter(event.currentTarget.value);
                setPage(1);
              }} disabled={!appliedPartnerId}>
                <option value="">{t('admin.partner.ledger.filter.allTypes', { defaultValue: 'All entry types' })}</option>
                {ENTRY_TYPE_KEYS.map((type) => (
                  <option key={type} value={type}>
                    {t(`admin.partner.ledger.type.${type.toLowerCase()}`, { defaultValue: ENTRY_TYPES[type] })}
                  </option>
                ))}
              </select>
            </label>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                className={primaryButtonClass}
                disabled={!appliedPartnerId}
                onClick={() => setShowAdjust(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {t('admin.partner.ledger.actions.adjust', { defaultValue: 'Manual adjustment' })}
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => void load(page)} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {t('common.actions.refresh', { defaultValue: 'Refresh' })}
              </button>
            </div>
          </div>
        </div>
        <InlineError message={error} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('admin.partner.ledger.table.type', { defaultValue: 'Type' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.ledger.table.direction', { defaultValue: 'Direction' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.ledger.table.amount', { defaultValue: 'Amount' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.ledger.table.balance', { defaultValue: 'Balance after' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.ledger.table.ref', { defaultValue: 'Reference' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.ledger.table.createdAt', { defaultValue: 'Created' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.ledger.table.remark', { defaultValue: 'Remark' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {!appliedPartnerId ? (
                  <TableState loading={false} empty={t('admin.partner.ledger.emptyQuery', { defaultValue: 'Enter a partner ID to view its ledger.' })} colSpan={7} />
                ) : items.length === 0 ? (
                  <TableState loading={loading} empty={t('admin.partner.ledger.empty', { defaultValue: 'No ledger entries.' })} colSpan={7} />
                ) : (
                  items.map((entry) => (
                    <tr key={entry.id} className="text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3">{t(`admin.partner.ledger.type.${entry.entryType.toLowerCase()}`, { defaultValue: ENTRY_TYPES[entry.entryType] ?? entry.entryType })}</td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-xs font-semibold ${entry.direction === 'IN' ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
                          {entry.direction === 'IN' ? '+' : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(entry.amount)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{formatDecimal(entry.balanceAfter)}</td>
                      <td className="px-4 py-3">
                        <span className="block font-mono text-xs text-slate-500">{entry.refType || '-'}</span>
                        <span className="block font-mono text-[11px] text-slate-400">{entry.refId ?? ''}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(entry.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{entry.remark || '-'}</td>
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
            onPageChange={(next) => void load(next)}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </div>
      </div>

      {showAdjust ? (
        <Modal
          title={t('admin.partner.ledger.adjust.title', { defaultValue: 'Manual ledger adjustment' })}
          description={t('admin.partner.ledger.adjust.description', {
            defaultValue: 'Partner #{{id}}. Positive credits, negative debits.',
            id: appliedPartnerId,
          })}
          busy={busy}
          submitLabel={t('admin.partner.ledger.adjust.action', { defaultValue: 'Apply adjustment' })}
          onSubmit={adjust}
          onClose={() => setShowAdjust(false)}
        >
          <div className="grid gap-4">
            <Field label={t('admin.partner.ledger.adjust.amount', { defaultValue: 'Amount' })} required hint={t('admin.partner.ledger.adjust.amountHint', { defaultValue: 'Positive credits the balance, negative debits it.' })}>
              <input name="amount" type="number" step="0.01" className={inputClass} required />
            </Field>
            <Field label={t('admin.partner.ledger.adjust.remark', { defaultValue: 'Reason' })} required>
              <textarea name="remark" className={textAreaClass} required />
            </Field>
          </div>
        </Modal>
      ) : null}
    </PageShell>
  );
}
