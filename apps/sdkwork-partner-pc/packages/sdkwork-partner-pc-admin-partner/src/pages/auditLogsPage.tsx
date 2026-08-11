import { useCallback, useEffect, useState } from 'react';
import { FileJson, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AuditLogItem } from '@sdkwork/partner-backend-sdk';
import {
  BottomPagination,
  errorMessage,
  Field,
  formatDateTime,
  InlineError,
  inputClass,
  toolbarInputClass,
  toolbarSelectClass,
  Modal,
  PageShell,
  secondaryButtonClass,
  selectClass,
  TableState,
  UserPickerField,
} from '@sdkwork/partner-pc-admin-core/ui';
import { partnerService } from '../services/partnerService';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';

/** Known audit actions surfaced for filtering (mirrors repository insert points). */
const AUDIT_ACTIONS = [
  'create_partner',
  'update_partner',
  'bind_customer',
  'unbind_customer',
  'create_join_fee_payment',
  'create_level',
  'update_level',
  'delete_level',
  'update_commission_config',
  'create_manual_commission_event',
  'run_commission_settlement',
  'create_ledger_adjustment',
  'create_withdrawal',
  'pay_withdrawal',
] as const;

const TARGET_TYPES = [
  'partner_partner',
  'partner_level',
  'partner_withdrawal',
  'partner_commission_config',
  'partner_commission_event',
  'partner_commission_settlement',
  'partner_customer_binding',
  'partner_join_fee_payment',
  'acct_ledger_entry',
] as const;

export function AuditLogsPage() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [targetIdFilter, setTargetIdFilter] = useState('');
  const [operatorIdFilter, setOperatorIdFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditLogItem | null>(null);

  const load = useCallback(async () => {
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const result = await partnerService.auditLogs.list({
        page: String(page),
        pageSize: String(pageSize),
        action: actionFilter || undefined,
        targetType: targetTypeFilter || undefined,
        targetId: targetIdFilter || undefined,
        operatorId: operatorIdFilter || undefined,
      });
      if (!guard.isCurrent(seq)) return;
      setItems(result.items);
      setTotal(Number(result.pageInfo.totalItems));
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.audit.errors.loadFailed', { defaultValue: 'Failed to load audit logs.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  }, [page, pageSize, actionFilter, targetTypeFilter, targetIdFilter, operatorIdFilter, guard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('admin.partner.audit.title', { defaultValue: 'Operation audit log' })}
          </h2>
          <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]">
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.audit.filter.action', { defaultValue: 'Action' })}
              <select className={`${toolbarSelectClass} w-40`} value={actionFilter} onChange={(event) => {
                setActionFilter(event.currentTarget.value);
                setPage(1);
              }}>
                <option value="">{t('admin.partner.audit.filter.allActions', { defaultValue: 'All actions' })}</option>
                {AUDIT_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.audit.filter.targetType', { defaultValue: 'Target type' })}
              <select className={`${toolbarSelectClass} w-32`} value={targetTypeFilter} onChange={(event) => {
                setTargetTypeFilter(event.currentTarget.value);
                setPage(1);
              }}>
                <option value="">{t('admin.partner.audit.filter.allTargets', { defaultValue: 'All targets' })}</option>
                {TARGET_TYPES.map((target) => (
                  <option key={target} value={target}>
                    {target}
                  </option>
                ))}
              </select>
            </label>
            {/* Target IDs span mixed entity kinds (partners, levels, bindings,
                withdrawals, …), so a single entity picker cannot serve them;
                exact numeric filtering stays as a text input. */}
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.audit.filter.targetId', { defaultValue: 'Target ID' })}
              <input
                className={`${toolbarInputClass} w-28`}
                placeholder={t('admin.partner.audit.filter.targetId', { defaultValue: 'Target ID' })}
                value={targetIdFilter}
                onChange={(event) => {
                  setTargetIdFilter(event.currentTarget.value.replace(/\D/g, ''));
                  setPage(1);
                }}
              />
            </label>
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.audit.filter.operatorId', { defaultValue: 'Operator' })}
              <div className="w-44">
                <UserPickerField
                  name="operatorIdFilter"
                  placeholder={t('admin.partner.picker.selectUsers', { defaultValue: 'Select user(s)…' })}
                  onChange={(ids) => {
                    setOperatorIdFilter(ids);
                    setPage(1);
                  }}
                />
              </div>
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
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('admin.partner.audit.table.action', { defaultValue: 'Action' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.audit.table.target', { defaultValue: 'Target' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.audit.table.operator', { defaultValue: 'Operator' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.audit.table.createdAt', { defaultValue: 'Time' })}</th>
                  <th className="px-4 py-3 text-right">{t('admin.partner.audit.table.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {items.length === 0 ? (
                  <TableState loading={loading} empty={t('admin.partner.audit.empty', { defaultValue: 'No audit records yet.' })} colSpan={5} />
                ) : (
                  items.map((log) => (
                    <tr key={log.id} className="text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <span className="block font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{log.action}</span>
                        {log.requestId ? <span className="block font-mono text-[11px] text-slate-400">{log.requestId}</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{log.targetType || '-'}</span>
                        <span className="ml-2 font-mono text-xs text-slate-500">{log.targetId ?? ''}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        #{log.operatorId}
                        {log.operatorType ? <span className="ml-1 text-slate-400">({log.operatorType})</span> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button type="button" className={secondaryButtonClass} title={t('admin.partner.audit.actions.detail', { defaultValue: 'View payload' })} onClick={() => setDetail(log)}>
                            <FileJson className="h-4 w-4" />
                          </button>
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

      {detail ? (
        <Modal
          title={t('admin.partner.audit.detail.title', { defaultValue: 'Audit record details' })}
          description={`${detail.action} · #${detail.id}`}
          busy={false}
          submitLabel={t('common.actions.close', { defaultValue: 'Close' })}
          onSubmit={(event) => {
            event.preventDefault();
            setDetail(null);
          }}
          onClose={() => setDetail(null)}
        >
          <div className="grid gap-3">
            <Field label={t('admin.partner.audit.detail.payload', { defaultValue: 'Payload' })}>
              <pre className="max-h-80 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 dark:border-white/10 dark:bg-black/40 dark:text-slate-200">
                {formatPayload(detail.payload)}
              </pre>
            </Field>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('admin.partner.audit.table.operator', { defaultValue: 'Operator' })}</dt>
                <dd className="mt-0.5 font-mono text-xs">#{detail.operatorId}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('admin.partner.audit.table.createdAt', { defaultValue: 'Time' })}</dt>
                <dd className="mt-0.5 text-xs">{formatDateTime(detail.createdAt)}</dd>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </PageShell>
  );
}

function formatPayload(payload: string): string {
  if (!payload || payload === '{}') return payload || '{}';
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}
