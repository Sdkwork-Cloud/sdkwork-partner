import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Loader2, XCircle, RotateCcw, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PartnerJoinApplicationItem } from '@sdkwork/partner-app-sdk';
import { listMyApplications, toMessage } from '../services/partnerJoinService';

type ApplicationStatus = PartnerJoinApplicationItem['status'];

interface TimelineStep {
  key: string;
  done: boolean;
  active: boolean;
  comment?: string;
  hint?: string;
}

/** Build the progress timeline steps for one application. */
export function applicationTimelineSteps(application: PartnerJoinApplicationItem): TimelineStep[] {
  const steps: TimelineStep[] = [{ key: 'submitted', done: true, active: false }];
  switch (application.status) {
    case 'SUBMITTED':
      steps.push({ key: 'reviewing', done: false, active: true });
      break;
    case 'APPROVED':
      steps.push({
        key: 'approved',
        done: true,
        active: false,
        comment: application.reviewComment || undefined,
        hint: 'approvedHint',
      });
      break;
    case 'REJECTED':
      steps.push({
        key: 'rejected',
        done: false,
        active: false,
        comment: application.reviewComment || undefined,
      });
      break;
    case 'CANCELLED':
      steps.push({ key: 'cancelled', done: false, active: false });
      break;
  }
  return steps;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MyApplicationPage({ onNavigate }: { onNavigate?: (section: 'apply' | 'status') => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<PartnerJoinApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listMyApplications({ page: 1, pageSize: 20 });
      setItems(page.items);
    } catch (cause) {
      setError(toMessage(cause, t('partnerJoin.status.errors.loadFailed', { defaultValue: 'Failed to load applications.' })));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t('partnerJoin.common.loading', { defaultValue: 'Loading…' })}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-5 overflow-auto px-6 py-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('partnerJoin.status.title', { defaultValue: 'My applications' })}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('partnerJoin.status.subtitle', { defaultValue: 'Track the review progress and results of your applications' })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('partnerJoin.common.actions.retry', { defaultValue: 'Retry' })}
        </button>
      </header>
      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium hover:bg-red-100 dark:border-red-500/30 dark:hover:bg-red-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('partnerJoin.common.actions.retry', { defaultValue: 'Retry' })}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 px-6 py-16 text-center dark:border-white/15">
          <Clock className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('partnerJoin.status.empty', { defaultValue: 'No application yet' })}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('partnerJoin.status.emptyHint', { defaultValue: 'Join the partner program and share AI growth.' })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('apply')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            {t('partnerJoin.status.emptyApply', { defaultValue: 'Apply now' })}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {items.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onReapply={() => onNavigate?.('apply')}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicationCard({
  application,
  onReapply,
}: {
  application: PartnerJoinApplicationItem;
  onReapply: () => void;
}) {
  const { t } = useTranslation();
  const steps = applicationTimelineSteps(application);

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#171717]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {application.subjectName || application.contactName}
        </p>
        <StatusPill status={application.status} />
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0">
            {t('partnerJoin.status.applicationId', { defaultValue: 'Application ID' })}：
          </dt>
          <dd className="truncate font-mono">{application.id}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0">
            {t('partnerJoin.status.level', { defaultValue: 'Target level' })}：
          </dt>
          <dd className="font-mono">L{application.targetLevelNo}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0">
            {t('partnerJoin.status.contact', { defaultValue: 'Contact' })}：
          </dt>
          <dd className="truncate">{application.contactPhone} · {application.contactEmail}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0">
            {t('partnerJoin.status.inviteCode', { defaultValue: 'Invite code' })}：
          </dt>
          <dd className="truncate font-mono">{application.inviteCode || '-'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0">
            {t('partnerJoin.status.createdAt', { defaultValue: 'Submitted at' })}：
          </dt>
          <dd>{formatDateTime(application.createdAt)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0">
            {t('partnerJoin.status.reviewedAt', { defaultValue: 'Reviewed at' })}：
          </dt>
          <dd>{formatDateTime(application.reviewedAt)}</dd>
        </div>
      </dl>
      <ol className="mt-4 space-y-0">
        {steps.map((step, index) => (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                className={`absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5 ${
                  step.done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-white/10'
                }`}
              />
            ) : null}
            {step.done ? (
              <CheckCircle2 className="relative z-10 mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            ) : step.active ? (
              <Loader2 className="relative z-10 mt-0.5 h-5 w-5 shrink-0 animate-spin text-indigo-500" />
            ) : (
              <XCircle className="relative z-10 mt-0.5 h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
            )}
            <div className="min-w-0">
              <p
                className={`text-sm font-medium ${
                  step.done || step.active
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t(`partnerJoin.status.timeline.${step.key}`, { defaultValue: step.key })}
              </p>
              {step.hint ? (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {t('partnerJoin.status.timeline.approvedHint', {
                    defaultValue: 'The join fee is pending — operations will contact you',
                  })}
                </p>
              ) : null}
              {step.comment ? (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {step.key === 'approved'
                    ? t('partnerJoin.status.reviewComment', { defaultValue: 'Review comment' })
                    : t('partnerJoin.status.timeline.rejectedReason', {
                        defaultValue: 'Reason: {{reason}}',
                        reason: step.comment,
                      })}
                  ：{step.comment}
                </p>
              ) : null}
              {application.status === 'REJECTED' ? (
                <button
                  type="button"
                  onClick={onReapply}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('partnerJoin.common.actions.reapply', { defaultValue: 'Reapply after edits' })}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </li>
  );
}

function StatusPill({ status }: { status: ApplicationStatus }) {
  const { t } = useTranslation();
  const map: Record<ApplicationStatus, { key: string; fallback: string; className: string }> = {
    SUBMITTED: {
      key: 'partnerJoin.common.status.submitted',
      fallback: 'Submitted',
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    },
    APPROVED: {
      key: 'partnerJoin.common.status.approved',
      fallback: 'Approved',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    },
    REJECTED: {
      key: 'partnerJoin.common.status.rejected',
      fallback: 'Rejected',
      className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
    },
    CANCELLED: {
      key: 'partnerJoin.common.status.cancelled',
      fallback: 'Cancelled',
      className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300',
    },
  };
  const entry = map[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${entry.className}`}>
      {t(entry.key, { defaultValue: entry.fallback })}
    </span>
  );
}
