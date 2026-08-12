import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@sdkwork/partner-pc-admin-core/ui';

type Tone = ComponentProps<typeof StatusBadge>['tone'];

/** Partner lifecycle status: PENDING / ACTIVE / SUSPENDED / CLOSED. */
export function PartnerStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { key: string; fallback: string; tone: Tone }> = {
    PENDING: { key: 'admin.partner.status.pending', fallback: 'Pending', tone: 'amber' },
    ACTIVE: { key: 'admin.partner.status.active', fallback: 'Active', tone: 'emerald' },
    SUSPENDED: { key: 'admin.partner.status.suspended', fallback: 'Suspended', tone: 'blue' },
    CLOSED: { key: 'admin.partner.status.closed', fallback: 'Closed', tone: 'slate' },
  };
  const entry = map[status] ?? { key: 'admin.partner.status.unknown', fallback: status, tone: 'slate' as Tone };
  return <StatusBadge label={t(entry.key, { defaultValue: entry.fallback })} tone={entry.tone} />;
}

/** Partner level status: ACTIVE / DISABLED. */
export function LevelStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === 'ACTIVE') {
    return <StatusBadge label={t('admin.partner.status.active', { defaultValue: 'Active' })} tone="emerald" />;
  }
  return (
    <StatusBadge
      label={t('admin.partner.status.disabled', { defaultValue: 'Disabled' })}
      tone="slate"
    />
  );
}

/** Partner join application status: SUBMITTED / APPROVED / REJECTED / CANCELLED. */
export function ApplicationStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { key: string; fallback: string; tone: Tone }> = {
    SUBMITTED: { key: 'admin.partner.application.status.submitted', fallback: 'Submitted', tone: 'amber' },
    APPROVED: { key: 'admin.partner.application.status.approved', fallback: 'Approved', tone: 'emerald' },
    REJECTED: { key: 'admin.partner.application.status.rejected', fallback: 'Rejected', tone: 'red' },
    CANCELLED: { key: 'admin.partner.application.status.cancelled', fallback: 'Cancelled', tone: 'slate' },
  };
  const entry = map[status] ?? { key: 'admin.partner.application.status.unknown', fallback: status, tone: 'slate' as Tone };
  return <StatusBadge label={t(entry.key, { defaultValue: entry.fallback })} tone={entry.tone} />;
}

/** Withdrawal status: PENDING / APPROVED / REJECTED / PAID. */
export function WithdrawalStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { key: string; fallback: string; tone: Tone }> = {
    PENDING: { key: 'admin.partner.withdrawal.status.pending', fallback: 'Pending', tone: 'amber' },
    APPROVED: { key: 'admin.partner.withdrawal.status.approved', fallback: 'Approved', tone: 'blue' },
    REJECTED: { key: 'admin.partner.withdrawal.status.rejected', fallback: 'Rejected', tone: 'red' },
    PAID: { key: 'admin.partner.withdrawal.status.paid', fallback: 'Paid', tone: 'emerald' },
  };
  const entry = map[status] ?? { key: 'admin.partner.withdrawal.status.unknown', fallback: status, tone: 'slate' as Tone };
  return <StatusBadge label={t(entry.key, { defaultValue: entry.fallback })} tone={entry.tone} />;
}

/** Commission event status: PENDING / SETTLED / SKIPPED / FAILED. */
export function EventStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { key: string; fallback: string; tone: Tone }> = {
    PENDING: { key: 'admin.partner.event.status.pending', fallback: 'Pending', tone: 'amber' },
    SETTLED: { key: 'admin.partner.event.status.settled', fallback: 'Settled', tone: 'emerald' },
    SKIPPED: { key: 'admin.partner.event.status.skipped', fallback: 'Skipped', tone: 'slate' },
    FAILED: { key: 'admin.partner.event.status.failed', fallback: 'Failed', tone: 'red' },
  };
  const entry = map[status] ?? { key: 'admin.partner.event.status.unknown', fallback: status, tone: 'slate' as Tone };
  return <StatusBadge label={t(entry.key, { defaultValue: entry.fallback })} tone={entry.tone} />;
}

/** Join fee status: UNPAID / PAID. */
export function JoinFeeStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === 'PAID') {
    return <StatusBadge label={t('admin.partner.joinFee.status.paid', { defaultValue: 'Paid' })} tone="emerald" />;
  }
  return (
    <StatusBadge
      label={t('admin.partner.joinFee.status.unpaid', { defaultValue: 'Unpaid' })}
      tone="amber"
    />
  );
}
