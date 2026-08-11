import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Edit3, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PartnerLevelItem } from '@sdkwork/partner-backend-sdk';
import {
  BottomPagination,
  ConfirmDialog,
  errorMessage,
  Field,
  formatDecimal,
  InlineError,
  inputClass,
  Modal,
  PageShell,
  primaryButtonClass,
  secondaryButtonClass,
  selectClass,
  TableState,
} from '@sdkwork/partner-pc-admin-core/ui';
import { LevelStatusBadge } from '../components/status';
import { commissionService } from '../services/commissionService';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';

export function LevelsPage() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [items, setItems] = useState<PartnerLevelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PartnerLevelItem | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<PartnerLevelItem | null>(null);
  /** levelNo -> number of partners currently using the level. */
  const [levelUsage, setLevelUsage] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const result = await commissionService.levels.list();
      if (!guard.isCurrent(seq)) return;
      setItems(result.items);
      // Lightweight per-level usage counts (one pageSize=1 query per level).
      const usage: Record<number, number> = {};
      await Promise.all(
        result.items.map(async (level) => {
          try {
            const page = await commissionService.partnersCount(level.levelNo);
            usage[level.levelNo] = Number(page.pageInfo.totalItems);
          } catch {
            usage[level.levelNo] = 0;
          }
        }),
      );
      if (!guard.isCurrent(seq)) return;
      setLevelUsage(usage);
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.levels.errors.loadFailed', { defaultValue: 'Failed to load levels.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  }, [guard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name') ?? '').trim();
      const customerRevenueRatio = String(form.get('customerRevenueRatio') ?? '').trim();
      const joinFeeCommissionRatio = String(form.get('joinFeeCommissionRatio') ?? '').trim();
      const joinFee = String(form.get('joinFee') ?? '').trim();
      const sortOrder = String(form.get('sortOrder') ?? '').trim();
      // Ratios must stay within 0-100% and the join fee must be non-negative;
      // the commission engine rejects invalid ratios downstream but a clear
      // form error is better UX than a backend problem.
      if (!isPercentValid(customerRevenueRatio) || !isPercentValid(joinFeeCommissionRatio)) {
        setError(t('admin.partner.levels.errors.ratioInvalid', { defaultValue: 'Ratios must be between 0 and 100.' }));
        return;
      }
      const joinFeeNumber = Number(joinFee);
      if (!Number.isFinite(joinFeeNumber) || joinFeeNumber < 0) {
        setError(t('admin.partner.levels.errors.joinFeeInvalid', { defaultValue: 'The join fee must be a non-negative number.' }));
        return;
      }
      if (editing) {
        await commissionService.levels.update(editing.id, {
          name,
          customerRevenueRatio,
          joinFeeCommissionRatio,
          joinFee,
          status: (String(form.get('status') ?? editing.status) || 'ACTIVE') as 'ACTIVE' | 'DISABLED',
          sortOrder: sortOrder ? Number(sortOrder) : undefined,
        });
      } else {
        await commissionService.levels.create({
          levelNo: Number(form.get('levelNo') ?? 1),
          name,
          customerRevenueRatio,
          joinFeeCommissionRatio,
          joinFee,
          sortOrder: sortOrder ? Number(sortOrder) : undefined,
        });
      }
      setEditing(undefined);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.levels.errors.saveFailed', { defaultValue: 'Failed to save level.' })));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (level: PartnerLevelItem) => {
    setBusy(true);
    setError(null);
    try {
      await commissionService.levels.update(level.id, {
        name: level.name,
        customerRevenueRatio: level.customerRevenueRatio,
        joinFeeCommissionRatio: level.joinFeeCommissionRatio,
        joinFee: level.joinFee,
        status: level.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
        sortOrder: level.sortOrder,
      });
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.levels.errors.toggleFailed', { defaultValue: 'Failed to toggle level.' })));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      await commissionService.levels.delete(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.levels.errors.deleteFailed', { defaultValue: 'Failed to delete level. It may still be referenced by partners.' })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('admin.partner.levels.title', { defaultValue: 'Levels & commission ratios' })}
          </h2>
          <div className="flex gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('common.actions.refresh', { defaultValue: 'Refresh' })}
            </button>
            <button type="button" className={primaryButtonClass} onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" />
              {t('admin.partner.levels.actions.new', { defaultValue: 'New level' })}
            </button>
          </div>
        </div>
        <InlineError message={error} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.levelNo', { defaultValue: 'Level' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.name', { defaultValue: 'Name' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.revenueRatio', { defaultValue: 'Revenue ratio' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.joinFeeRatio', { defaultValue: 'Join fee ratio' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.joinFee', { defaultValue: 'Join fee' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.sortOrder', { defaultValue: 'Sort' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.partners', { defaultValue: 'Partners' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.status', { defaultValue: 'Status' })}</th>
                  <th className="px-4 py-3 text-right">{t('admin.partner.levels.table.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {items.length === 0 ? (
                  <TableState loading={loading} empty={t('admin.partner.levels.empty', { defaultValue: 'No levels configured.' })} colSpan={9} />
                ) : (
                  items.map((level) => (
                    <tr key={level.id} className="text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-mono text-xs">L{level.levelNo}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{level.name}</td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(level.customerRevenueRatio)}%</td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(level.joinFeeCommissionRatio)}%</td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(level.joinFee)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{level.sortOrder}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {levelUsage[level.levelNo] ?? '-'}
                        </span>
                        {levelUsage[level.levelNo] > 0 ? (
                          <span className="ml-1 text-[11px] text-slate-400">
                            {t('admin.partner.levels.usageHint', { defaultValue: 'in use' })}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3"><LevelStatusBadge status={level.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" className={secondaryButtonClass} title={t('common.actions.edit', { defaultValue: 'Edit' })} onClick={() => setEditing(level)}>
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={secondaryButtonClass}
                            title={level.status === 'ACTIVE' ? t('admin.partner.levels.actions.disable', { defaultValue: 'Disable' }) : t('admin.partner.levels.actions.enable', { defaultValue: 'Enable' })}
                            onClick={() => void toggle(level)}
                          >
                            {level.status === 'ACTIVE' ? t('admin.partner.levels.actions.disable', { defaultValue: 'Disable' }) : t('admin.partner.levels.actions.enable', { defaultValue: 'Enable' })}
                          </button>
                          <button type="button" className={secondaryButtonClass} title={t('common.actions.delete', { defaultValue: 'Delete' })} onClick={() => setDeleteTarget(level)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing !== undefined ? (
        <LevelModal level={editing} busy={busy} onSubmit={submit} onClose={() => setEditing(undefined)} />
      ) : null}
      {deleteTarget ? (
        <ConfirmDialog
          title={t('admin.partner.levels.delete.title', { defaultValue: 'Delete level' })}
          description={t('admin.partner.levels.delete.description', {
            defaultValue: 'Delete level {{name}}? Levels referenced by partners cannot be deleted.',
            name: deleteTarget.name,
          })}
          confirmLabel={t('common.actions.delete', { defaultValue: 'Delete' })}
          isBusy={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </PageShell>
  );
}

/** Validates a percentage string is within [0, 100]. */
function isPercentValid(value: string): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100;
}

function LevelModal({  level,
  busy,
  onSubmit,
  onClose,
}: {
  level: PartnerLevelItem | null;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      title={
        level
          ? t('admin.partner.levels.form.editTitle', { defaultValue: 'Edit level' })
          : t('admin.partner.levels.form.createTitle', { defaultValue: 'New level' })
      }
      busy={busy}
      submitLabel={
        level
          ? t('common.actions.saveChanges', { defaultValue: 'Save changes' })
          : t('admin.partner.levels.form.createAction', { defaultValue: 'Create level' })
      }
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!level ? (
          <Field label={t('admin.partner.levels.form.levelNo', { defaultValue: 'Level number' })} required>
            <input name="levelNo" type="number" min={1} className={inputClass} defaultValue={1} required />
          </Field>
        ) : null}
        <Field label={t('admin.partner.levels.form.name', { defaultValue: 'Name' })} required>
          <input name="name" className={inputClass} defaultValue={level?.name ?? ''} required />
        </Field>
        <Field label={t('admin.partner.levels.form.revenueRatio', { defaultValue: 'Customer revenue ratio (%)' })} required>
          <input name="customerRevenueRatio" type="number" min="0" step="0.01" className={inputClass} defaultValue={level?.customerRevenueRatio ?? '20.00'} required />
        </Field>
        <Field label={t('admin.partner.levels.form.joinFeeRatio', { defaultValue: 'Join fee commission ratio (%)' })} required>
          <input name="joinFeeCommissionRatio" type="number" min="0" step="0.01" className={inputClass} defaultValue={level?.joinFeeCommissionRatio ?? '10.00'} required />
        </Field>
        <Field label={t('admin.partner.levels.form.joinFee', { defaultValue: 'Join fee amount' })} required>
          <input name="joinFee" type="number" min="0" step="0.01" className={inputClass} defaultValue={level?.joinFee ?? '10000.00'} required />
        </Field>
        <Field label={t('admin.partner.levels.form.sortOrder', { defaultValue: 'Sort order' })} hint={t('admin.partner.levels.form.sortHint', { defaultValue: 'Smaller values appear first.' })}>
          <input name="sortOrder" type="number" className={inputClass} defaultValue={level?.sortOrder ?? 0} />
        </Field>
        {level ? (
          <Field label={t('admin.partner.levels.form.status', { defaultValue: 'Status' })}>
            <select name="status" className={selectClass} defaultValue={level.status}>
              <option value="ACTIVE">{t('admin.partner.status.active', { defaultValue: 'Active' })}</option>
              <option value="DISABLED">{t('admin.partner.status.disabled', { defaultValue: 'Disabled' })}</option>
            </select>
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}
