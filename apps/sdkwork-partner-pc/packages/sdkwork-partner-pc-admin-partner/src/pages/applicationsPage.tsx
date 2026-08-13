import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardList, Loader2, RefreshCw, Search, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  AdminPartnerApplicationItem,
  PartnerLevelItem,
  PartnersApi,
} from '@sdkwork/partner-backend-sdk';
import {
  BottomPagination,
  errorMessage,
  Field,
  formatDateTime,
  formatDecimal,
  InlineError,
  inputClass,
  Modal,
  PageShell,
  primaryButtonClass,
  secondaryButtonClass,
  selectClass,
  TableState,
  textAreaClass,
  toolbarInputClass,
  toolbarSelectClass,
} from '@sdkwork/partner-pc-admin-core/ui';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';
import { ApplicationStatusBadge } from '../components/status';
import { partnerService } from '../services/partnerService';
import { localizeLevelName } from '@sdkwork/partner-pc-admin-core/catalogLocale';

const APPLICATION_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

type ApplicationsListParams = NonNullable<Parameters<PartnersApi['applications']['list']>[0]>;

const STATUS_LABELS: Record<string, { key: string; fallback: string }> = {
  SUBMITTED: { key: 'admin.partner.application.status.submitted', fallback: 'Submitted' },
  APPROVED: { key: 'admin.partner.application.status.approved', fallback: 'Approved' },
  REJECTED: { key: 'admin.partner.application.status.rejected', fallback: 'Rejected' },
  CANCELLED: { key: 'admin.partner.application.status.cancelled', fallback: 'Cancelled' },
};

/** Partner join application review queue (approve / reject with reason). */
export function ApplicationsPage() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [items, setItems] = useState<AdminPartnerApplicationItem[]>([]);
  const [levels, setLevels] = useState<PartnerLevelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('SUBMITTED');
  const [applicantTypeFilter, setApplicantTypeFilter] = useState<string>('');
  const [draftQuery, setDraftQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<AdminPartnerApplicationItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminPartnerApplicationItem | null>(null);

  const load = useCallback(async () => {
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const params: ApplicationsListParams = {
        page,
        pageSize,
        q: appliedQuery || undefined,
        status: (statusFilter || undefined) as ApplicationsListParams['status'],
        applicantType: (applicantTypeFilter || undefined) as ApplicationsListParams['applicantType'],
      };
      const [pageResult, levelResult] = await Promise.all([
        partnerService.applications.list(params),
        partnerService.levels.list(),
      ]);
      if (!guard.isCurrent(seq)) return;
      setItems(pageResult.items);
      setTotal(Number(pageResult.pageInfo.totalItems));
      setLevels(levelResult.items);
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.applications.errors.loadFailed', { defaultValue: 'Failed to load applications.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  }, [page, pageSize, appliedQuery, statusFilter, applicantTypeFilter, guard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const applyQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedQuery(draftQuery.trim());
    setPage(1);
  };

  const approve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!approveTarget) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      await partnerService.applications.approve(approveTarget.id, {
        levelNo: Number(form.get('levelNo') ?? approveTarget.targetLevelNo),
        remark: String(form.get('remark') ?? '').trim() || undefined,
      });
      setNotice(t('admin.partner.applications.notice.approved', { defaultValue: 'Application approved. Partner record created (PENDING). Register the join fee under Join Fees and activate the partner to go live.' }));
      setApproveTarget(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.applications.errors.approveFailed', { defaultValue: 'Failed to approve the application.' })));
    } finally {
      setBusy(false);
    }
  };

  const reject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rejectTarget) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const reason = String(form.get('reason') ?? '').trim();
      if (!reason) return;
      await partnerService.applications.reject(rejectTarget.id, { reason });
      setNotice(t('admin.partner.applications.notice.rejected', { defaultValue: 'Application rejected.' }));
      setRejectTarget(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.applications.errors.rejectFailed', { defaultValue: 'Failed to reject the application.' })));
    } finally {
      setBusy(false);
    }
  };

  const listFiltered = appliedQuery !== '' || applicantTypeFilter !== '';

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <ClipboardList className="h-4 w-4 text-indigo-500" />
              {t('admin.partner.applications.title', { defaultValue: 'Join applications' })}
              <span className="font-mono text-xs font-normal text-slate-500">({total})</span>
            </h2>
            <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]">
              <form onSubmit={applyQuery} className="flex shrink-0 items-center gap-1.5">
                <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('admin.partner.applications.filter.keyword', { defaultValue: 'Keyword' })}
                  <input
                    className={`${toolbarInputClass} w-44`}
                    placeholder={t('admin.partner.applications.search.placeholder', { defaultValue: 'Search by subject, contact, or ID' })}
                    value={draftQuery}
                    onChange={(event) => setDraftQuery(event.currentTarget.value)}
                  />
                </label>
                <button type="submit" className={primaryButtonClass}>
                  <Search className="h-4 w-4" />
                  {t('common.actions.search', { defaultValue: 'Search' })}
                </button>
              </form>
              <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('admin.partner.applications.filter.applicantType', { defaultValue: 'Applicant type' })}
                <select
                  className={`${toolbarSelectClass} w-32`}
                  value={applicantTypeFilter}
                  onChange={(event) => {
                    setApplicantTypeFilter(event.currentTarget.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t('admin.partner.applications.filter.allTypes', { defaultValue: 'All types' })}</option>
                  <option value="INDIVIDUAL">{t('admin.partner.applications.applicantType.individual', { defaultValue: 'Individual' })}</option>
                  <option value="ORGANIZATION">{t('admin.partner.applications.applicantType.organization', { defaultValue: 'Organization' })}</option>
                </select>
              </label>
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {t('common.actions.refresh', { defaultValue: 'Refresh' })}
              </button>
            </div>
          </div>
          {/* Status filter tabs */}
          <div role="tablist" aria-label={t('admin.partner.applications.filter.status', { defaultValue: 'Status' })} className="flex flex-wrap gap-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === ''}
              onClick={() => setStatus('')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                statusFilter === ''
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-[#171717] dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              {t('admin.partner.applications.filter.allStatus', { defaultValue: 'All statuses' })}
            </button>
            {APPLICATION_STATUSES.map((status) => {
              const label = STATUS_LABELS[status];
              return (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === status}
                  onClick={() => setStatus(status)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-[#171717] dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  {t(label.key, { defaultValue: label.fallback })}
                </button>
              );
            })}
          </div>
        </div>
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
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('admin.partner.applications.table.applicant', { defaultValue: 'Applicant' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.applications.table.type', { defaultValue: 'Type' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.applications.table.level', { defaultValue: 'Target level' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.applications.table.inviteCode', { defaultValue: 'Invite code' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.applications.table.inviter', { defaultValue: 'Inviter' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.applications.table.status', { defaultValue: 'Status' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.applications.table.createdAt', { defaultValue: 'Submitted at' })}</th>
                  <th className="px-4 py-3 text-right">{t('admin.partner.applications.table.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {items.length === 0 ? (
                  <TableState
                    loading={loading}
                    empty={t(
                      listFiltered
                        ? 'admin.partner.applications.filter.empty'
                        : 'admin.partner.applications.empty',
                      { defaultValue: listFiltered ? 'No applications match the filters.' : 'No applications yet.' },
                    )}
                    colSpan={8}
                  />
                ) : (
                  items.map((application) => (
                    <tr key={application.id} className="text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <span className="block font-semibold text-slate-900 dark:text-white">
                          {application.subjectName || application.contactName}
                        </span>
                        <span className="block font-mono text-xs text-slate-500">
                          #{application.id} · {application.contactName} · {application.contactPhone}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {t(
                          application.applicantType === 'ORGANIZATION'
                            ? 'admin.partner.applications.applicantType.organization'
                            : 'admin.partner.applications.applicantType.individual',
                          { defaultValue: application.applicantType },
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">L{application.targetLevelNo}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{application.inviteCode || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {application.inviterPartnerName ? (
                          <span>
                            {application.inviterPartnerName}
                            {application.inviterLevelNo ? (
                              <span className="ml-1 font-mono text-slate-400">L{application.inviterLevelNo}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ApplicationStatusBadge status={application.status} />
                        {application.status === 'SUBMITTED' && application.businessIntro ? (
                          <p className="mt-1 max-w-56 truncate text-xs text-slate-400" title={application.businessIntro}>
                            {application.businessIntro}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(application.createdAt)}</td>
                      <td className="px-4 py-3">
                        {application.status === 'SUBMITTED' ? (
                          <div className="flex justify-end gap-1">
                            <button type="button" className={primaryButtonClass} onClick={() => setApproveTarget(application)}>
                              <CheckCircle2 className="h-4 w-4" />
                              {t('admin.partner.applications.actions.approve', { defaultValue: 'Approve' })}
                            </button>
                            <button type="button" className={secondaryButtonClass} onClick={() => setRejectTarget(application)}>
                              <XCircle className="h-4 w-4 text-red-500" />
                              {t('admin.partner.applications.actions.reject', { defaultValue: 'Reject' })}
                            </button>
                          </div>
                        ) : (
                          <p className="text-right text-xs text-slate-400">{application.reviewComment || '-'}</p>
                        )}
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
            onPageChange={(next) => setPage(next)}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </div>
      </div>

      {approveTarget ? (
        <ApproveDialog
          application={approveTarget}
          levels={levels}
          busy={busy}
          onSubmit={approve}
          onClose={() => setApproveTarget(null)}
        />
      ) : null}
      {rejectTarget ? (
        <RejectDialog
          application={rejectTarget}
          busy={busy}
          onSubmit={reject}
          onClose={() => setRejectTarget(null)}
        />
      ) : null}
    </PageShell>
  );
}

function ApproveDialog({
  application,
  levels,
  busy,
  onSubmit,
  onClose,
}: {
  application: AdminPartnerApplicationItem;
  levels: PartnerLevelItem[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [levelNo, setLevelNo] = useState(
    levels.some((level) => level.levelNo === application.targetLevelNo)
      ? application.targetLevelNo
      : (levels[0]?.levelNo ?? application.targetLevelNo),
  );
  const selectedLevel = useMemo(
    () => levels.find((level) => level.levelNo === levelNo) ?? null,
    [levels, levelNo],
  );
  return (
    <Modal
      title={t('admin.partner.applications.approve.title', { defaultValue: 'Approve application' })}
      description={t('admin.partner.applications.approve.description', {
        defaultValue: 'Approve the application of {{name}}? A partner record will be created at the selected level.',
        name: application.subjectName || application.contactName,
      })}
      busy={busy}
      submitLabel={t('admin.partner.applications.approve.submit', { defaultValue: 'Confirm approval' })}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <div className="grid gap-4">
        {application.inviterPartnerName ? (
          <div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-sm dark:border-indigo-500/20 dark:bg-indigo-500/10">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-300">
              {t('admin.partner.applications.approve.inviter', { defaultValue: 'Inviter (recommendation)' })}
            </span>
            <span className="ml-2 text-slate-700 dark:text-slate-200">
              {application.inviterPartnerName}
              {application.inviterLevelNo ? (
                <span className="ml-1 font-mono text-slate-400">L{application.inviterLevelNo}</span>
              ) : null}
            </span>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('admin.partner.applications.approve.inviterHint', { defaultValue: 'Approving links the new partner under this inviter; the join-fee commission chain starts from them.' })}
            </p>
          </div>
        ) : null}
        <Field label={t('admin.partner.applications.approve.level', { defaultValue: 'Granted level' })} required hint={t('admin.partner.applications.approve.levelHint', { defaultValue: 'The level assigned to the partner on approval.' })}>
          <select name="levelNo" className={selectClass} value={levelNo} onChange={(event) => setLevelNo(Number(event.currentTarget.value))} required>
            {levels.map((level) => (
              <option key={level.id} value={level.levelNo}>
                {localizeLevelName(level.name, i18n.language)} (L{level.levelNo})
              </option>
            ))}
          </select>
        </Field>
        {selectedLevel ? (
          <dl className="grid gap-1.5 rounded-md border border-slate-200 px-3 py-2.5 text-sm dark:border-white/10">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                {t('admin.partner.applications.approve.joinFee', { defaultValue: 'Join fee' })}
              </dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-white">
                ¥{formatDecimal(selectedLevel.joinFee)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                {t('admin.partner.applications.approve.customerRatio', { defaultValue: 'Customer revenue share' })}
              </dt>
              <dd className="font-mono text-slate-700 dark:text-slate-200">
                {formatDecimal(selectedLevel.customerRevenueRatio)}%
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                {t('admin.partner.applications.approve.joinFeeRatio', { defaultValue: 'Join fee share' })}
              </dt>
              <dd className="font-mono text-slate-700 dark:text-slate-200">
                {formatDecimal(selectedLevel.joinFeeCommissionRatio)}%
              </dd>
            </div>
          </dl>
        ) : null}
        <Field label={t('admin.partner.applications.approve.remark', { defaultValue: 'Remark' })} hint={t('admin.partner.applications.approve.remarkHint', { defaultValue: 'Optional note recorded on the application.' })}>
          <textarea name="remark" rows={3} className={textAreaClass} />
        </Field>
      </div>
    </Modal>
  );
}

function RejectDialog({
  application,
  busy,
  onSubmit,
  onClose,
}: {
  application: AdminPartnerApplicationItem;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  return (
    <Modal
      title={t('admin.partner.applications.reject.title', { defaultValue: 'Reject application' })}
      description={t('admin.partner.applications.reject.description', {
        defaultValue: 'Reject the application of {{name}}. A rejection reason is required and visible to the applicant.',
        name: application.subjectName || application.contactName,
      })}
      busy={busy}
      submitLabel={t('admin.partner.applications.reject.submit', { defaultValue: 'Confirm rejection' })}
      submitDisabled={reason.trim() === ''}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <Field label={t('admin.partner.applications.reject.reason', { defaultValue: 'Rejection reason' })} required hint={t('admin.partner.applications.reject.reasonHint', { defaultValue: 'Required: shown to the applicant as the rejection reason.' })}>
          <textarea
            name="reason"
            rows={4}
            className={textAreaClass}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            required
          />
        </Field>
      </div>
    </Modal>
  );
}
