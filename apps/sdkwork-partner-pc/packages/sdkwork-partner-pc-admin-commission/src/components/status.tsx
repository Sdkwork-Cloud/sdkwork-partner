import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@sdkwork/partner-pc-admin-core/ui';

type Tone = ComponentProps<typeof StatusBadge>['tone'];

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
