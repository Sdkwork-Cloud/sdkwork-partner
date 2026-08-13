import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, CheckCircle2, Download, Edit3, Loader2, Plus, RefreshCw, RotateCcw, Search, Settings2, UserPlus, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  AdminPartnerCreateRequest,
  AdminPartnerUpdateRequest,
  CustomerBindingItem,
  JoinFeePaymentItem,
  LedgerEntryItem,
  PartnerItem,
  PartnerLevelItem,
  PartnerStatItem,
  PartnersListParams,
} from '@sdkwork/partner-backend-sdk';
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
  primaryButtonClass,
  secondaryButtonClass,
  Section,
  selectClass,
  SidePanel,
  TableState,
  textAreaClass,
  Tooltip,
} from '@sdkwork/partner-pc-admin-core/ui';
import { PartnerStatusBadge, JoinFeeStatusBadge } from '../components/status';
import { partnerService } from '../services/partnerService';
import { useRequestGuard, getPartnerUserSearchPort, type PartnerUserOption } from '@sdkwork/partner-pc-admin-core';
import { PartnerPickerField, UserPickerField } from '@sdkwork/partner-pc-admin-core/ui';
import { localizeLevelName } from '@sdkwork/partner-pc-admin-core/catalogLocale';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const PARTNER_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED'] as const;

export function PartnersPage() {
  const { t, i18n } = useTranslation();
  const guard = useRequestGuard();
  const [items, setItems] = useState<PartnerItem[]>([]);
  const [levels, setLevels] = useState<PartnerLevelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // Draft filter form values (edited before the query is applied).
  const [draftQuery, setDraftQuery] = useState('');
  const [draftStatus, setDraftStatus] = useState<string>('');
  const [draftLevel, setDraftLevel] = useState<string>('');
  const [draftJoinFee, setDraftJoinFee] = useState<string>('');
  const [draftCreatedFrom, setDraftCreatedFrom] = useState('');
  const [draftCreatedTo, setDraftCreatedTo] = useState('');
  // Applied filter values (drive the list query).
  const [appliedQuery, setAppliedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [joinFeeStatusFilter, setJoinFeeStatusFilter] = useState<string>('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<PartnerItem | null | undefined>(undefined);
  const [selected, setSelected] = useState<PartnerItem | null>(null);
  const [closeTarget, setCloseTarget] = useState<PartnerItem | null>(null);
  const [bindTarget, setBindTarget] = useState<PartnerItem | null>(null);

  const load = useCallback(async () => {
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const params: PartnersListParams = {
        page,
        pageSize,
        q: appliedQuery || undefined,
        status: (statusFilter || undefined) as PartnersListParams['status'],
        levelNo: levelFilter ? Number(levelFilter) : undefined,
        createdFrom: createdFrom ? new Date(`${createdFrom}T00:00:00`).toISOString() : undefined,
        createdTo: createdTo ? new Date(`${createdTo}T23:59:59`).toISOString() : undefined,
        joinFeeStatus: (joinFeeStatusFilter || undefined) as 'PAID' | 'UNPAID',
      };
      const [pageResult, levelResult] = await Promise.all([
        partnerService.partners.list(params),
        partnerService.levels.list(),
      ]);
      if (!guard.isCurrent(seq)) return;
      setItems(pageResult.items);
      setTotal(Number(pageResult.pageInfo.totalItems));
      setLevels(levelResult.items);
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.partners.errors.loadFailed', { defaultValue: 'Failed to load partners.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  }, [page, pageSize, appliedQuery, statusFilter, levelFilter, joinFeeStatusFilter, createdFrom, createdTo, guard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      if (editing) {
        await partnerService.partners.update(editing.id, partnerUpdateInput(form, editing));
        setNotice(t('admin.partner.partners.notice.updated', { defaultValue: 'Partner updated.' }));
      } else {
        await partnerService.partners.create(partnerCreateInput(form));
        setNotice(t('admin.partner.partners.notice.created', { defaultValue: 'Partner created.' }));
      }
      setEditing(undefined);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.partners.errors.saveFailed', { defaultValue: 'Failed to save partner.' })));
    } finally {
      setBusy(false);
    }
  };

  const closePartner = async () => {
    if (!closeTarget) return;
    setBusy(true);
    setError(null);
    try {
      await partnerService.partners.update(closeTarget.id, {
        name: closeTarget.name,
        levelNo: closeTarget.levelNo,
        status: 'CLOSED',
      });
      setNotice(t('admin.partner.partners.notice.closed', { defaultValue: 'Partner closed.' }));
      setSelected((current) => (current?.id === closeTarget.id ? null : current));
      setCloseTarget(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.partners.errors.closeFailed', { defaultValue: 'Failed to close partner.' })));
    } finally {
      setBusy(false);
    }
  };

  const bindUserAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bindTarget) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const userAccountId = String(form.get('userAccountId') ?? '').trim();
      if (!userAccountId) return;
      await partnerService.partners.bindUserAccount(bindTarget.id, { userAccountId });
      setNotice(t('admin.partner.partners.notice.boundUser', { defaultValue: 'IAM user account bound.' }));
      setSelected((current) =>
        current?.id === bindTarget.id ? { ...current, userAccountId } : current,
      );
      setBindTarget(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.partners.errors.bindUserFailed', { defaultValue: 'Failed to bind IAM user account.' })));
    } finally {
      setBusy(false);
    }
  };

  const exportPartners = async () => {
    setExporting(true);
    setError(null);
    try {
      const page = await partnerService.partners.list({
        page: 1,
        pageSize: 200,
        q: appliedQuery || undefined,
        status: (statusFilter || undefined) as PartnersListParams['status'],
        levelNo: levelFilter ? Number(levelFilter) : undefined,
        joinFeeStatus: (joinFeeStatusFilter || undefined) as 'PAID' | 'UNPAID',
        createdFrom: createdFrom ? new Date(`${createdFrom}T00:00:00`).toISOString() : undefined,
        createdTo: createdTo ? new Date(`${createdTo}T23:59:59`).toISOString() : undefined,
      });
      exportCsv('partners', page.items.map((partner) => ({
        id: partner.id,
        name: partner.name,
        levelNo: partner.levelNo,
        parentPartnerId: partner.parentPartnerId ?? '',
        contactName: partner.contactName,
        phone: partner.phone,
        email: partner.email,
        status: partner.status,
        joinFeeAmount: partner.joinFeeAmount,
        joinFeeStatus: partner.joinFeeStatus,
        userAccountId: partner.userAccountId ?? '',
        createdAt: partner.createdAt,
      })));
      setNotice(t('admin.partner.partners.notice.exported', {
        defaultValue: 'Exported {{count}} partners.',
        count: page.items.length,
      }));
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.partners.errors.exportFailed', { defaultValue: 'Failed to export partners.' })));
    } finally {
      setExporting(false);
    }
  };

  const filteredTotal = total;
  const listFiltered = appliedQuery !== '' || statusFilter !== '' || levelFilter !== '' || joinFeeStatusFilter !== '' || createdFrom !== '' || createdTo !== '';

  /** Apply the draft filter form and reload from page 1. */
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // ISO date strings compare lexicographically; reject inverted ranges
    // before they produce an empty result with no explanation.
    if (draftCreatedFrom && draftCreatedTo && draftCreatedFrom > draftCreatedTo) {
      setError(t('admin.partner.partners.errors.dateRangeInvalid', {
        defaultValue: 'The created-from date must not be later than the created-to date.',
      }));
      return;
    }
    setAppliedQuery(draftQuery.trim());
    setStatusFilter(draftStatus);
    setLevelFilter(draftLevel);
    setJoinFeeStatusFilter(draftJoinFee);
    setCreatedFrom(draftCreatedFrom);
    setCreatedTo(draftCreatedTo);
    setPage(1);
  };

  /** Clear every filter and reload the full list. */
  const resetFilters = () => {
    setDraftQuery('');
    setDraftStatus('');
    setDraftLevel('');
    setDraftJoinFee('');
    setDraftCreatedFrom('');
    setDraftCreatedTo('');
    setAppliedQuery('');
    setStatusFilter('');
    setLevelFilter('');
    setJoinFeeStatusFilter('');
    setCreatedFrom('');
    setCreatedTo('');
    setPage(1);
  };

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* 查询过滤表单（单行） */}
        <form
          onSubmit={applyFilters}
          className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]"
        >
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('admin.partner.partners.filter.keyword', { defaultValue: 'Keyword' })}
            <input
              className={`${toolbarInputClass} w-44`}
              placeholder={t('admin.partner.partners.search.placeholder', { defaultValue: 'Search by name or contact' })}
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.currentTarget.value)}
            />
          </label>
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('admin.partner.partners.filter.status', { defaultValue: 'Status' })}
            <select className={`${toolbarSelectClass} w-32`} value={draftStatus} onChange={(event) => setDraftStatus(event.currentTarget.value)}>
              <option value="">{t('admin.partner.partners.filter.allStatus', { defaultValue: 'All statuses' })}</option>
              {PARTNER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`admin.partner.status.${status.toLowerCase()}`, { defaultValue: status })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('admin.partner.partners.filter.level', { defaultValue: 'Level' })}
            <select className={`${toolbarSelectClass} w-32`} value={draftLevel} onChange={(event) => setDraftLevel(event.currentTarget.value)}>
              <option value="">{t('admin.partner.partners.filter.allLevels', { defaultValue: 'All levels' })}</option>
              {levels.map((level) => (
                <option key={level.id} value={level.levelNo}>
                  {localizeLevelName(level.name, i18n.language)} ({level.levelNo})
                </option>
              ))}
            </select>
          </label>
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('admin.partner.partners.filter.joinFeeStatus', { defaultValue: 'Join fee status' })}
            <select className={`${toolbarSelectClass} w-32`} value={draftJoinFee} onChange={(event) => setDraftJoinFee(event.currentTarget.value)}>
              <option value="">{t('admin.partner.partners.filter.allJoinFee', { defaultValue: 'All join fee statuses' })}</option>
              <option value="PAID">{t('admin.partner.joinFee.status.paid', { defaultValue: 'Paid' })}</option>
              <option value="UNPAID">{t('admin.partner.joinFee.status.unpaid', { defaultValue: 'Unpaid' })}</option>
            </select>
          </label>
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('admin.partner.partners.filter.createdRange', { defaultValue: 'Created period' })}
            <input
              type="date"
              aria-label={t('admin.partner.partners.filter.createdFrom', { defaultValue: 'Created from' })}
              className={`${toolbarInputClass} w-36`}
              value={draftCreatedFrom}
              onChange={(event) => setDraftCreatedFrom(event.currentTarget.value)}
            />
            <span className="shrink-0 text-slate-400">-</span>
            <input
              type="date"
              aria-label={t('admin.partner.partners.filter.createdTo', { defaultValue: 'Created to' })}
              className={`${toolbarInputClass} w-36`}
              value={draftCreatedTo}
              onChange={(event) => setDraftCreatedTo(event.currentTarget.value)}
            />
          </label>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('admin.partner.partners.title', { defaultValue: 'Partners' })}
              <span className="ml-1 font-mono">({total})</span>
            </span>
            <button type="submit" className={primaryButtonClass}>
              <Search className="h-4 w-4" />
              {t('common.actions.search', { defaultValue: 'Search' })}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />
              {t('common.actions.reset', { defaultValue: 'Reset' })}
            </button>
            <button type="button" className={primaryButtonClass} onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" />
              {t('admin.partner.partners.actions.new', { defaultValue: 'New partner' })}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={items.length === 0 || exporting}
              onClick={() => void exportPartners()}
            >
              <Download className="h-4 w-4" />
              {exporting
                ? t('admin.partner.partners.actions.exporting', { defaultValue: 'Exporting…' })
                : t('admin.partner.partners.actions.export', { defaultValue: 'Export' })}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('common.actions.refresh', { defaultValue: 'Refresh' })}
            </button>
            {listFiltered ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t('admin.partner.partners.filter.active', { defaultValue: 'Filters applied' })}
              </span>
            ) : null}
          </div>
        </form>
        <InlineError message={error} />
        {notice ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{notice}</span>
            <button
              type="button"
              className="text-xs font-medium underline-offset-2 hover:underline"
              onClick={() => setNotice(null)}
            >
              {t('common.actions.dismiss', { defaultValue: 'Dismiss' })}
            </button>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('admin.partner.partners.table.name', { defaultValue: 'Partner' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.partners.table.level', { defaultValue: 'Level' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.partners.table.parent', { defaultValue: 'Parent' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.partners.table.contact', { defaultValue: 'Contact' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.partners.table.joinFee', { defaultValue: 'Join fee' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.partners.table.status', { defaultValue: 'Status' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.partners.table.createdAt', { defaultValue: 'Created' })}</th>
                  <th className="px-4 py-3 text-right">{t('admin.partner.partners.table.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {items.length === 0 ? (
                  <TableState
                    loading={loading}
                    empty={t(
                      listFiltered
                        ? 'admin.partner.partners.filter.empty'
                        : 'admin.partner.partners.empty',
                      { defaultValue: listFiltered ? 'No partners match the filters.' : 'No partners yet.' },
                    )}
                    colSpan={8}
                  />
                ) : (
                  items.map((partner) => (
                    <tr key={partner.id} className="text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <button type="button" className="text-left" onClick={() => setSelected(partner)}>
                          <span className="block font-semibold text-slate-900 dark:text-white">{partner.name}</span>
                          <span className="block font-mono text-xs text-slate-500">#{partner.id}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{partner.levelNo}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {partner.parentPartnerId ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        {partner.contactName || partner.phone || partner.email ? (
                          <span className="block">{partner.contactName || '-'}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono">{formatDecimal(partner.joinFeeAmount)}</span>{' '}
                        <JoinFeeStatusBadge status={partner.joinFeeStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <PartnerStatusBadge status={partner.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(partner.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Tooltip content={t('common.actions.edit', { defaultValue: 'Edit' })}>
                            <button type="button" className={secondaryButtonClass} onClick={() => setEditing(partner)}>
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          <Tooltip content={t('admin.partner.partners.actions.detail', { defaultValue: 'Details' })}>
                            <button type="button" className={secondaryButtonClass} onClick={() => setSelected(partner)}>
                              <Settings2 className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          {partner.status !== 'CLOSED' ? (
                            <Tooltip content={t(partner.userAccountId ? 'admin.partner.partners.actions.changeUser' : 'admin.partner.partners.actions.bindUser', { defaultValue: partner.userAccountId ? 'Change user' : 'Bind user' })}>
                              <button
                                type="button"
                                className={secondaryButtonClass}
                                onClick={() => setBindTarget(partner)}
                              >
                                <UserPlus className="h-4 w-4" />
                              </button>
                            </Tooltip>
                          ) : null}
                          {partner.status !== 'CLOSED' ? (
                            <Tooltip content={t('admin.partner.partners.actions.close', { defaultValue: 'Close' })}>
                              <button
                                type="button"
                                className={secondaryButtonClass}
                                onClick={() => setCloseTarget(partner)}
                              >
                                <XCircle className="h-4 w-4 text-red-500" />
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
            total={filteredTotal}
            disabled={loading}
            onPageChange={(next) => setPage(next)}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </div>
      </div>

      {editing !== undefined ? (
        <PartnerModal
          partner={editing}
          levels={levels}
          busy={busy}
          onSubmit={submit}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
      {selected ? (
        <PartnerDetailPanel
          partner={selected}
          onChanged={(updated) => {
            setSelected(updated);
            setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
          }}
          onClose={() => setSelected(null)}
        />
      ) : null}
      {closeTarget ? (
        <ConfirmDialog
          title={t('admin.partner.partners.close.title', { defaultValue: 'Close partner' })}
          description={t('admin.partner.partners.close.description', {
            defaultValue: 'Close {{name}}? Closed partners cannot be reopened and their relations are kept for audit.',
            name: closeTarget.name,
          })}
          confirmLabel={t('admin.partner.partners.actions.close', { defaultValue: 'Close partner' })}
          isBusy={busy}
          onCancel={() => setCloseTarget(null)}
          onConfirm={() => void closePartner()}
        />
      ) : null}
      {bindTarget ? (
        <BindUserModal
          partner={bindTarget}
          busy={busy}
          onSubmit={bindUserAccount}
          onClose={() => setBindTarget(null)}
        />
      ) : null}
    </PageShell>
  );
}

function PartnerModal({
  partner,
  levels,
  busy,
  onSubmit,
  onClose,
}: {
  partner: PartnerItem | null;
  levels: PartnerLevelItem[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Modal
      title={
        partner
          ? t('admin.partner.partners.form.editTitle', { defaultValue: 'Edit partner' })
          : t('admin.partner.partners.form.createTitle', { defaultValue: 'New partner' })
      }
      busy={busy}
      submitLabel={
        partner
          ? t('common.actions.saveChanges', { defaultValue: 'Save changes' })
          : t('admin.partner.partners.form.createAction', { defaultValue: 'Create partner' })
      }
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.partner.partners.form.name', { defaultValue: 'Name' })} required>
          <input name="name" className={inputClass} defaultValue={partner?.name ?? ''} required />
        </Field>
        <Field label={t('admin.partner.partners.form.level', { defaultValue: 'Level' })} required hint={levels.length === 0 ? t('admin.partner.partners.form.noLevelsHint', { defaultValue: 'Create a level first; the backend rejects unknown levels.' }) : undefined}>
          <select name="levelNo" className={selectClass} defaultValue={partner?.levelNo ?? levels[0]?.levelNo ?? 1} required>
            {levels.map((level) => (
              <option key={level.id} value={level.levelNo}>
                {localizeLevelName(level.name, i18n.language)} (L{level.levelNo})
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.partner.partners.form.parentPartnerId', { defaultValue: 'Parent partner' })} hint={t('admin.partner.partners.form.parentHint', { defaultValue: 'Leave empty for a top-level partner.' })}>
          <PartnerPickerField name="parentPartnerId" initialValue={partner?.parentPartnerId ?? undefined} placeholder={t('admin.partner.partners.form.parentPlaceholder', { defaultValue: 'Select parent partner…' })} />
        </Field>
        <Field label={t('admin.partner.partners.form.userAccountId', { defaultValue: 'IAM user account ID' })} hint={t('admin.partner.partners.form.userAccountOptionalHint', { defaultValue: 'Optional: bind the IAM user account when creating or editing.' })}>
          <UserPickerField name="userAccountId" initialValue={partner?.userAccountId ?? undefined} />
        </Field>
        <Field label={t('admin.partner.partners.form.contactName', { defaultValue: 'Contact name' })}>
          <input name="contactName" className={inputClass} defaultValue={partner?.contactName ?? ''} />
        </Field>
        <Field label={t('admin.partner.partners.form.phone', { defaultValue: 'Phone' })}>
          <input name="phone" className={inputClass} defaultValue={partner?.phone ?? ''} />
        </Field>
        <Field label={t('admin.partner.partners.form.email', { defaultValue: 'Email' })}>
          <input name="email" type="email" className={inputClass} defaultValue={partner?.email ?? ''} />
        </Field>
        {partner ? (
          <Field
            label={t('admin.partner.partners.form.status', { defaultValue: 'Status' })}
            hint={partner.status === 'CLOSED' ? t('admin.partner.partners.form.closedLockHint', { defaultValue: 'Closed partners cannot be reactivated.' }) : undefined}
          >
            <select name="status" className={selectClass} defaultValue={partner.status} disabled={partner.status === 'CLOSED'}>
              {PARTNER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`admin.partner.status.${status.toLowerCase()}`, { defaultValue: status })}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className="sm:col-span-2">
          <Field label={t('admin.partner.partners.form.remark', { defaultValue: 'Remark' })}>
            <textarea name="remark" className={textAreaClass} defaultValue={partner?.remark ?? ''} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function BindUserModal({
  partner,
  busy,
  onSubmit,
  onClose,
}: {
  partner: PartnerItem;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const searchPort = useMemo(() => getPartnerUserSearchPort(), []);
  const search = useMemo(
    () => (keyword: string) => (searchPort ? searchPort(keyword) : Promise.resolve([])),
    [searchPort],
  );
  const [keyword, setKeyword] = useState('');
  const [options, setOptions] = useState<PartnerUserOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PartnerUserOption | null>(null);
  const seqRef = useRef(0);

  // Debounced keyword search with a stale-response guard (same interaction
  // as the entity picker dialog, rendered inline so no second dialog opens).
  useEffect(() => {
    if (keyword.trim().length === 0) {
      setOptions([]);
      return;
    }
    const seq = ++seqRef.current;
    setSearching(true);
    const timer = setTimeout(() => {
      void search(keyword.trim())
        .then((items) => {
          if (seq !== seqRef.current) return;
          setOptions(items);
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          setOptions([]);
        })
        .finally(() => {
          if (seq === seqRef.current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, search]);

  return (
    <Modal
      title={t('admin.partner.partners.bindUser.title', { defaultValue: 'Bind IAM user' })}
      busy={busy}
      submitLabel={t('admin.partner.partners.actions.bindUser', { defaultValue: 'Bind user' })}
      submitDisabled={selected === null}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('admin.partner.partners.bindUser.description', {
            defaultValue: 'Bind an IAM user account to partner {{name}} (replaces any existing binding).',
            name: partner.name,
          })}
        </p>
        {searchPort === null ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            {t('admin.partner.picker.unavailable', { defaultValue: 'User search is unavailable in this environment.' })}
          </p>
        ) : (
          <>
            <Field label={t('admin.partner.partners.form.userAccountId', { defaultValue: 'IAM user account' })} required>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  className={`${inputClass} pl-9`}
                  placeholder={t('admin.partner.picker.searchPlaceholder', { defaultValue: 'Search username or display name' })}
                  value={keyword}
                  onChange={(event) => setKeyword(event.currentTarget.value)}
                />
              </div>
            </Field>
            <div className="max-h-72 min-h-36 overflow-auto rounded-md border border-slate-200 dark:border-white/10">
              {keyword.trim() === '' ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Search className="h-4 w-4" />
                  {t('admin.partner.picker.typeToSearch', { defaultValue: 'Type to search users.' })}
                </p>
              ) : searching ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('admin.partner.picker.searching', { defaultValue: 'Searching…' })}
                </p>
              ) : options.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  {t('admin.partner.picker.noResults', { defaultValue: 'No users match.' })}
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {options.map((option) => {
                    const checked = selected?.id === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                          checked ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                        }`}
                        onClick={() => setSelected(option)}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            checked
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 dark:border-white/20'
                          }`}
                        >
                          {checked ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        <span className="shrink-0 font-mono text-xs text-slate-400">#{option.id}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {selected ? (
              <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-indigo-200 bg-indigo-50 py-0.5 pl-2.5 pr-2 text-xs font-medium text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                <span className="min-w-0 truncate">{selected.label}</span>
                <span className="shrink-0 font-mono text-[10px] text-indigo-400">#{selected.id}</span>
              </span>
            ) : null}
          </>
        )}
        <input type="hidden" name="userAccountId" value={selected?.id ?? ''} />
      </div>
    </Modal>
  );
}

function PartnerDetailPanel({
  partner,
  onChanged,
  onClose,
}: {
  partner: PartnerItem;
  onChanged: (partner: PartnerItem) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [bindings, setBindings] = useState<CustomerBindingItem[]>([]);
  const [bindingsTotal, setBindingsTotal] = useState(0);
  const [joinFeePayments, setJoinFeePayments] = useState<JoinFeePaymentItem[]>([]);
  const [joinFeeTotal, setJoinFeeTotal] = useState(0);
  const [partnerStats, setPartnerStats] = useState<PartnerStatItem | null>(null);
  const [recentLedger, setRecentLedger] = useState<LedgerEntryItem[]>([]);
  const [joinFeeAmount, setJoinFeeAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Idempotency token for the join-fee submission intent (see recordJoinFee).
  const joinFeeIdempotencyKey = useRef<string | null>(null);

  const loadRelations = useCallback(async () => {
    const seq = guard.next();
    setError(null);
    try {
      const [bindingPage, feePage, stats, ledgerPage] = await Promise.all([
        partnerService.customerBindings.list({ page: 1, pageSize: 50, partnerId: partner.id }),
        partnerService.joinFeePayments.list({ page: 1, pageSize: 50, partnerId: partner.id }),
        partnerService.stats.retrieve(partner.id),
        partnerService.ledger.list(partner.id, { page: 1, pageSize: 5 }),
      ]);
      if (!guard.isCurrent(seq)) return;
      setBindings(bindingPage.items);
      setBindingsTotal(Number(bindingPage.pageInfo.totalItems));
      setJoinFeePayments(feePage.items);
      setJoinFeeTotal(Number(feePage.pageInfo.totalItems));
      setPartnerStats(stats);
      setRecentLedger(ledgerPage.items);
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.partners.errors.loadDetailsFailed', { defaultValue: 'Failed to load partner details.' })));
    }
  }, [partner.id, guard, t]);

  useEffect(() => {
    void loadRelations();
  }, [loadRelations]);

  const bindCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const customerUserId = String(form.get('customerUserId') ?? '').trim();
      if (!customerUserId) return;
      await partnerService.customerBindings.create({ partnerId: partner.id, customerUserId });
      await loadRelations();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.partners.errors.bindFailed', { defaultValue: 'Failed to bind customer.' })));
    } finally {
      setBusy(false);
    }
  };

  const unbindCustomer = async (binding: CustomerBindingItem) => {
    setBusy(true);
    setError(null);
    try {
      await partnerService.customerBindings.delete(binding.id);
      await loadRelations();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.partners.errors.unbindFailed', { defaultValue: 'Failed to unbind customer.' })));
    } finally {
      setBusy(false);
    }
  };

  const recordJoinFee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    // Idempotency token: kept for the lifetime of one submission intent so a
    // retry after a network failure replays server-side instead of creating a
    // duplicate payment (and duplicate ancestor commission). The token is
    // regenerated once the submission succeeds or the amount changes.
    joinFeeIdempotencyKey.current ??= crypto.randomUUID();
    try {
      const form = new FormData(event.currentTarget);
      const amount = String(form.get('amount') ?? '').trim();
      if (!amount) return;
      await partnerService.joinFeePayments.create(partner.id, {
        amount,
        idempotencyKey: joinFeeIdempotencyKey.current,
      });
      joinFeeIdempotencyKey.current = null;
      setJoinFeeAmount('');
      await loadRelations();
      const refreshed = await partnerService.partners.retrieve(partner.id);
      onChanged(refreshed);
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.partners.errors.joinFeeFailed', { defaultValue: 'Failed to record join fee.' })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SidePanel
      title={partner.name}
      subtitle={t('admin.partner.partners.detail.subtitle', { defaultValue: 'Partner #{{id}} · Level {{level}}', id: partner.id, level: partner.levelNo })}
      onClose={onClose}
    >
      <div className="grid gap-6">
        <InlineError message={error} />
        {partnerStats ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label={t('admin.partner.partners.summary.available', { defaultValue: 'Available balance' })}
              value={formatDecimal(partnerStats.availableBalance)}
            />
            <SummaryCard
              label={t('admin.partner.partners.summary.commission', { defaultValue: 'Commission earned' })}
              value={formatDecimal(partnerStats.totalCommission)}
            />
            <SummaryCard
              label={t('admin.partner.partners.summary.joinFee', { defaultValue: 'Join fees' })}
              value={formatDecimal(partnerStats.totalJoinFee)}
            />
            <SummaryCard
              label={t('admin.partner.partners.summary.customers', { defaultValue: 'Bound customers' })}
              value={partnerStats.customerCount}
            />
          </div>
        ) : null}
        <Section title={t('admin.partner.partners.detail.basic', { defaultValue: 'Basic information' })}>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <InfoRow label={t('admin.partner.partners.form.name', { defaultValue: 'Name' })} value={partner.name} />
            <InfoRow label={t('admin.partner.partners.form.userAccountId', { defaultValue: 'IAM user account' })} value={partner.userAccountId ?? t('admin.partner.partners.detail.userAccountEmpty', { defaultValue: 'Not bound' })} mono />
            <InfoRow label={t('admin.partner.partners.form.parentPartnerId', { defaultValue: 'Parent partner' })} value={partner.parentPartnerId ?? '-'} mono />
            <InfoRow label={t('admin.partner.partners.form.contactName', { defaultValue: 'Contact name' })} value={partner.contactName || '-'} />
            <InfoRow label={t('admin.partner.partners.form.phone', { defaultValue: 'Phone' })} value={partner.phone || '-'} />
            <InfoRow label={t('admin.partner.partners.form.email', { defaultValue: 'Email' })} value={partner.email || '-'} />
            <InfoRow label={t('admin.partner.partners.table.joinFee', { defaultValue: 'Join fee' })} value={`${formatDecimal(partner.joinFeeAmount)}`} />
            <InfoRow label={t('admin.partner.partners.table.status', { defaultValue: 'Status' })} value={<PartnerStatusBadge status={partner.status} />} />
            <InfoRow label={t('admin.partner.partners.detail.joinedAt', { defaultValue: 'Joined' })} value={formatDateTime(partner.joinedAt)} />
            <InfoRow label={t('admin.partner.partners.form.remark', { defaultValue: 'Remark' })} value={partner.remark || '-'} />
          </dl>
        </Section>
        <Section
          title={t('admin.partner.partners.detail.customers', { defaultValue: 'Bound customers' })}
          action={<span className="text-xs text-slate-500">{bindingsTotal}</span>}
        >
          <form className="mb-3 flex items-center gap-2" onSubmit={bindCustomer}>
            <div className="min-w-0 flex-1">
              <UserPickerField
                name="customerUserId"
                placeholder={t('admin.partner.partners.detail.customerIdPlaceholder', { defaultValue: 'Search IAM user' })}
                required
              />
            </div>
            <button type="submit" className={`${primaryButtonClass} shrink-0`} disabled={busy}>
              <UserPlus className="h-4 w-4" />
              {t('admin.partner.partners.actions.bind', { defaultValue: 'Bind' })}
            </button>
          </form>
          {bindings.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              {t('admin.partner.partners.detail.customersEmpty', { defaultValue: 'No customers bound.' })}
            </p>
          ) : (
            <div className="grid gap-1.5">
              {bindings.map((binding) => (
                <div key={binding.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
                  <span className="font-mono text-xs">{binding.customerUserId}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{formatDateTime(binding.boundAt)}</span>
                    <button
                      type="button"
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-300"
                      disabled={busy}
                      onClick={() => void unbindCustomer(binding)}
                    >
                      {t('admin.partner.partners.actions.unbind', { defaultValue: 'Unbind' })}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section
          title={t('admin.partner.partners.detail.joinFeeTitle', { defaultValue: 'Join fee payments' })}
          action={<span className="text-xs text-slate-500">{joinFeeTotal}</span>}
        >
          <form className="mb-3 flex gap-2" onSubmit={recordJoinFee}>
            <input
              name="amount"
              className={inputClass}
              placeholder={t('admin.partner.partners.detail.joinFeePlaceholder', { defaultValue: 'Amount (e.g. 10000)' })}
              value={joinFeeAmount}
              onChange={(event) => {
                setJoinFeeAmount(event.currentTarget.value);
                // A new amount is a new submission intent: reset the token so
                // the next submit is a fresh (non-replay) payment.
                joinFeeIdempotencyKey.current = null;
              }}
              required
            />
            <button type="submit" className={primaryButtonClass} disabled={busy}>
              {t('admin.partner.partners.actions.recordJoinFee', { defaultValue: 'Record payment' })}
            </button>
          </form>
          {joinFeePayments.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              {t('admin.partner.partners.detail.joinFeeEmpty', { defaultValue: 'No join fee payments recorded.' })}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">{t('admin.partner.partners.detail.amount', { defaultValue: 'Amount' })}</th>
                  <th className="px-2 py-1.5">{t('admin.partner.partners.detail.paidAt', { defaultValue: 'Paid at' })}</th>
                  <th className="px-2 py-1.5">{t('admin.partner.partners.detail.remark', { defaultValue: 'Remark' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {joinFeePayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-2 py-1.5 font-mono">{formatDecimal(payment.amount)}</td>
                    <td className="px-2 py-1.5 text-xs text-slate-500">{formatDateTime(payment.paidAt ?? payment.createdAt)}</td>
                    <td className="px-2 py-1.5 text-xs text-slate-500">{payment.remark || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
        <Section
          title={t('admin.partner.partners.detail.recentLedger', { defaultValue: 'Recent ledger entries' })}
        >
          {recentLedger.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              {t('admin.partner.partners.detail.recentLedgerEmpty', { defaultValue: 'No ledger entries yet.' })}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">{t('admin.partner.partners.detail.ledgerType', { defaultValue: 'Type' })}</th>
                  <th className="px-2 py-1.5">{t('admin.partner.partners.detail.amount', { defaultValue: 'Amount' })}</th>
                  <th className="px-2 py-1.5">{t('admin.partner.partners.detail.ledgerBalance', { defaultValue: 'Balance' })}</th>
                  <th className="px-2 py-1.5">{t('admin.partner.partners.detail.paidAt', { defaultValue: 'Paid at' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {recentLedger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-2 py-1.5 text-xs">{entry.entryType}</td>
                    <td className="px-2 py-1.5 font-mono">
                      <span className={entry.direction === 'IN' ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>
                        {entry.direction === 'IN' ? '+' : '-'}
                        {formatDecimal(entry.amount)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs text-slate-500">{formatDecimal(entry.balanceAfter)}</td>
                    <td className="px-2 py-1.5 text-xs text-slate-500">{formatDateTime(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </SidePanel>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] items-center gap-2">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`min-w-0 truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2.5 dark:border-white/10">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}


function partnerCreateInput(form: FormData): AdminPartnerCreateRequest {
  const parentPartnerId = String(form.get('parentPartnerId') ?? '').trim();
  const userAccountId = String(form.get('userAccountId') ?? '').trim();
  return {
    name: String(form.get('name') ?? '').trim(),
    levelNo: Number(form.get('levelNo') ?? 1),
    userAccountId: userAccountId || undefined,
    parentPartnerId: parentPartnerId || null,
    contactName: optional(form, 'contactName'),
    phone: optional(form, 'phone'),
    email: optional(form, 'email'),
    remark: optional(form, 'remark'),
  };
}

function partnerUpdateInput(form: FormData, partner: PartnerItem): AdminPartnerUpdateRequest {
  const parentPartnerId = String(form.get('parentPartnerId') ?? '').trim();
  const userAccountId = String(form.get('userAccountId') ?? '').trim();
  return {
    name: String(form.get('name') ?? '').trim(),
    levelNo: Number(form.get('levelNo') ?? partner.levelNo),
    status: (String(form.get('status') ?? partner.status) || partner.status) as AdminPartnerUpdateRequest['status'],
    parentPartnerId: parentPartnerId || null,
    userAccountId: userAccountId || null,
    contactName: optional(form, 'contactName'),
    phone: optional(form, 'phone'),
    email: optional(form, 'email'),
    remark: optional(form, 'remark'),
  };
}

function optional(form: FormData, key: string): string | undefined {
  const value = String(form.get(key) ?? '').trim();
  return value || undefined;
}
