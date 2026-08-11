import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowRightLeft, RefreshCw, UserRoundPlus, UserRoundX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CustomerBindingItem } from '@sdkwork/partner-backend-sdk';
import {
  BottomPagination,
  ConfirmDialog,
  errorMessage,
  Field,
  formatDateTime,
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
} from '@sdkwork/partner-pc-admin-core/ui';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';
import { partnerService } from '../services/partnerService';
import { PartnerPickerField, UserPickerField } from '@sdkwork/partner-pc-admin-core/ui';

/** Global customer-binding management: every bound customer across partners. */
export function CustomersPage() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [items, setItems] = useState<CustomerBindingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [partnerIdFilter, setPartnerIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showBind, setShowBind] = useState(false);
  const [unbindTarget, setUnbindTarget] = useState<CustomerBindingItem | null>(null);
  const [transferTarget, setTransferTarget] = useState<CustomerBindingItem | null>(null);

  const load = useCallback(async () => {
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const result = await partnerService.customerBindings.listAll({
        page: String(page),
        pageSize: String(pageSize),
        q: appliedQuery || undefined,
        partnerId: partnerIdFilter || undefined,
        status: statusFilter || undefined,
      });
      if (!guard.isCurrent(seq)) return;
      setItems(result.items);
      setTotal(Number(result.pageInfo.totalItems));
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.customers.errors.loadFailed', { defaultValue: 'Failed to load customers.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  }, [page, pageSize, appliedQuery, partnerIdFilter, statusFilter, guard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const bindCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      await partnerService.customerBindings.create({
        partnerId: String(form.get('partnerId') ?? '').trim(),
        customerUserId: String(form.get('customerUserId') ?? '').trim(),
      });
      setShowBind(false);
      setNotice(t('admin.partner.customers.notice.bound', { defaultValue: 'Customer bound.' }));
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.customers.errors.bindFailed', { defaultValue: 'Failed to bind customer.' })));
    } finally {
      setBusy(false);
    }
  };

  const unbind = async () => {
    if (!unbindTarget) return;
    setBusy(true);
    setError(null);
    try {
      await partnerService.customerBindings.delete(unbindTarget.id);
      setNotice(t('admin.partner.customers.notice.unbound', { defaultValue: 'Customer unbound.' }));
      setUnbindTarget(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.customers.errors.unbindFailed', { defaultValue: 'Failed to unbind customer.' })));
    } finally {
      setBusy(false);
    }
  };

  /** Transfer an active binding to another partner (unbind + rebind). */
  const transfer = async (event: FormEvent<HTMLFormElement>) => {
    if (!transferTarget) return;
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const newPartnerId = String(form.get('newPartnerId') ?? '').trim();
      if (!newPartnerId) {
        setError(t('admin.partner.customers.errors.transferPartnerRequired', { defaultValue: 'A target partner ID is required.' }));
        return;
      }
      await partnerService.customerBindings.delete(transferTarget.id);
      try {
        await partnerService.customerBindings.create({
          partnerId: newPartnerId,
          customerUserId: transferTarget.customerUserId,
        });
      } catch (cause) {
        // The unbind already committed; surface the partial state so the
        // operator can rebind the customer to the target partner manually.
        setError(errorMessage(
          cause,
          t('admin.partner.customers.errors.transferRebindFailed', {
            defaultValue: 'The customer was unbound, but binding to partner #{{partner}} failed. Please bind it manually.',
            partner: newPartnerId,
          }),
        ));
        setTransferTarget(null);
        await load();
        return;
      }
      setNotice(t('admin.partner.customers.notice.transferred', {
        defaultValue: 'Customer #{{customer}} transferred to partner #{{partner}}.',
        customer: transferTarget.customerUserId,
        partner: newPartnerId,
      }));
      setTransferTarget(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.customers.errors.transferFailed', { defaultValue: 'Failed to transfer the customer.' })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]">
          <form
            className="flex shrink-0 items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedQuery(query.trim());
              setPage(1);
            }}
          >
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.customers.filter.keyword', { defaultValue: 'Keyword' })}
              <input
                className={`${toolbarInputClass} w-40`}
                placeholder={t('admin.partner.customers.search.placeholder', { defaultValue: 'Search customer ID or partner ID' })}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </label>
          </form>
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('admin.partner.customers.filter.partnerId', { defaultValue: 'Partner ID' })}
            <input
              className={`${toolbarInputClass} w-28`}
              placeholder={t('admin.partner.customers.filter.partnerId', { defaultValue: 'Partner ID' })}
              value={partnerIdFilter}
              onChange={(event) => {
                setPartnerIdFilter(event.currentTarget.value.replace(/\D/g, ''));
                setPage(1);
              }}
            />
          </label>
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('admin.partner.customers.filter.status', { defaultValue: 'Status' })}
            <select className={`${toolbarSelectClass} w-32`} value={statusFilter} onChange={(event) => {
              setStatusFilter(event.currentTarget.value);
              setPage(1);
            }}>
              <option value="">{t('admin.partner.customers.filter.allStatus', { defaultValue: 'All statuses' })}</option>
              <option value="ACTIVE">{t('admin.partner.customers.status.active', { defaultValue: 'Active' })}</option>
              <option value="UNBOUND">{t('admin.partner.customers.status.unbound', { defaultValue: 'Unbound' })}</option>
            </select>
          </label>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('common.actions.refresh', { defaultValue: 'Refresh' })}
            </button>
            <button type="button" className={primaryButtonClass} onClick={() => setShowBind(true)}>
              <UserRoundPlus className="h-4 w-4" />
              {t('admin.partner.customers.actions.bind', { defaultValue: 'Bind customer' })}
            </button>
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
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('admin.partner.customers.table.customer', { defaultValue: 'Customer' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.customers.table.partner', { defaultValue: 'Partner' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.customers.table.bindingType', { defaultValue: 'Binding type' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.customers.table.status', { defaultValue: 'Status' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.customers.table.boundAt', { defaultValue: 'Bound at' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.customers.table.boundBy', { defaultValue: 'Bound by' })}</th>
                  <th className="px-4 py-3 text-right">{t('admin.partner.customers.table.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {items.length === 0 ? (
                  <TableState loading={loading} empty={t('admin.partner.customers.empty', { defaultValue: 'No customer bindings yet.' })} colSpan={7} />
                ) : (
                  items.map((binding) => (
                    <tr key={binding.id} className="text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-mono text-xs">#{binding.customerUserId}</td>
                      <td className="px-4 py-3 font-mono text-xs">#{binding.partnerId}</td>
                      <td className="px-4 py-3 text-xs">{binding.bindingType}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex min-w-16 justify-center rounded-full px-2 py-1 text-xs font-semibold ${binding.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                          {t(`admin.partner.customers.status.${binding.status.toLowerCase()}`, { defaultValue: binding.status })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(binding.boundAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs">#{binding.boundBy}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {binding.status === 'ACTIVE' ? (
                            <>
                              <button
                                type="button"
                                className={secondaryButtonClass}
                                title={t('admin.partner.customers.actions.transfer', { defaultValue: 'Transfer to partner' })}
                                onClick={() => setTransferTarget(binding)}
                              >
                                <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
                              </button>
                              <button
                                type="button"
                                className={secondaryButtonClass}
                                title={t('admin.partner.customers.actions.unbind', { defaultValue: 'Unbind' })}
                                onClick={() => setUnbindTarget(binding)}
                              >
                                <UserRoundX className="h-4 w-4 text-red-500" />
                              </button>
                            </>
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
        </div>
      </div>

      {showBind ? (
        <Modal
          title={t('admin.partner.customers.bind.title', { defaultValue: 'Bind customer to partner' })}
          busy={busy}
          submitLabel={t('admin.partner.customers.actions.bind', { defaultValue: 'Bind customer' })}
          onSubmit={bindCustomer}
          onClose={() => setShowBind(false)}
        >
          <div className="grid gap-4">
            <Field label={t('admin.partner.customers.bind.partnerId', { defaultValue: 'Partner' })} required>
              <PartnerPickerField name="partnerId" required />
            </Field>
            <Field label={t('admin.partner.customers.bind.customerUserId', { defaultValue: 'Customer (IAM user)' })} required>
              <UserPickerField name="customerUserId" required />
            </Field>
          </div>
        </Modal>
      ) : null}
      {unbindTarget ? (
        <ConfirmDialog
          title={t('admin.partner.customers.unbind.title', { defaultValue: 'Unbind customer' })}
          description={t('admin.partner.customers.unbind.description', {
            defaultValue: 'Unbind customer #{{customer}} from partner #{{partner}}?',
            customer: unbindTarget.customerUserId,
            partner: unbindTarget.partnerId,
          })}
          confirmLabel={t('admin.partner.customers.actions.unbind', { defaultValue: 'Unbind' })}
          isBusy={busy}
          onCancel={() => setUnbindTarget(null)}
          onConfirm={() => void unbind()}
        />
      ) : null}
      {transferTarget ? (
        <Modal
          title={t('admin.partner.customers.transfer.title', { defaultValue: 'Transfer customer to partner' })}
          description={t('admin.partner.customers.transfer.description', {
            defaultValue: 'Customer #{{customer}} is currently bound to partner #{{partner}}.',
            customer: transferTarget.customerUserId,
            partner: transferTarget.partnerId,
          })}
          busy={busy}
          submitLabel={t('admin.partner.customers.actions.transfer', { defaultValue: 'Transfer to partner' })}
          onSubmit={transfer}
          onClose={() => setTransferTarget(null)}
        >
          <div className="grid gap-4">
            <Field label={t('admin.partner.customers.transfer.newPartnerId', { defaultValue: 'Target partner' })} required hint={t('admin.partner.customers.transfer.hint', { defaultValue: 'The customer is unbound from the current partner and bound to the new one.' })}>
              <PartnerPickerField name="newPartnerId" required />
            </Field>
          </div>
        </Modal>
      ) : null}
    </PageShell>
  );
}
