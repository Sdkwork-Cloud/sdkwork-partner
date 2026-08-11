import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@sdkwork/partner-pc-admin-core/ui';

type Tone = ComponentProps<typeof StatusBadge>['tone'];

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
