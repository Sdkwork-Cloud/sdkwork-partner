import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Edit3,
  Gift,
  History,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LevelBenefitItem, PartnerLevelItem } from '@sdkwork/partner-backend-sdk';
import {
  BottomPagination,
  ConfirmDialog,
  errorMessage,
  exportCsv,
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
  Tooltip,
} from '@sdkwork/partner-pc-admin-core/ui';
import { LevelStatusBadge } from '../components/status';
import { commissionService } from '../services/commissionService';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';
import { localizeBenefit, localizeLevelName, normalizeCatalogLocale } from '@sdkwork/partner-pc-admin-core/catalogLocale';

export function LevelsPage() {
  const { t, i18n } = useTranslation();
  const guard = useRequestGuard();
  const [items, setItems] = useState<PartnerLevelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PartnerLevelItem | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<PartnerLevelItem | null>(null);
  /** Level whose benefit (权益) ladder is open in the manage dialog. */
  const [benefitsTarget, setBenefitsTarget] = useState<PartnerLevelItem | null>(null);
  /** Confirmation for restoring the commercial default level catalog. */
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  /** Human-readable result of the last restore operation. */
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
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
      const benefits = parseBenefits(String(form.get('benefits') ?? ''));
      if (benefits === null) {
        setError(t('admin.partner.levels.errors.benefitsInvalid', { defaultValue: 'Invalid benefit data.' }));
        return;
      }
      if (benefits.some((benefit) => !benefit.name.trim())) {
        setError(t('admin.partner.levels.errors.benefitNameRequired', { defaultValue: 'Every benefit needs a name.' }));
        return;
      }
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
      if (!editing) {
        const levelNo = Number(form.get('levelNo') ?? 0);
        if (items.some((level) => level.levelNo === levelNo)) {
          setError(t('admin.partner.levels.errors.levelNoTaken', { defaultValue: 'This level number is already in use.' }));
          return;
        }
      }
      if (editing) {
        await commissionService.levels.update(editing.id, {
          name,
          customerRevenueRatio,
          joinFeeCommissionRatio,
          joinFee,
          status: (String(form.get('status') ?? editing.status) || 'ACTIVE') as 'ACTIVE' | 'DISABLED',
          sortOrder: sortOrder ? Number(sortOrder) : undefined,
          benefits,
        });
      } else {
        await commissionService.levels.create({
          levelNo: Number(form.get('levelNo') ?? 1),
          name,
          customerRevenueRatio,
          joinFeeCommissionRatio,
          joinFee,
          sortOrder: sortOrder ? Number(sortOrder) : undefined,
          benefits,
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
        benefits: level.benefits,
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

  const restoreDefaults = async () => {
    setBusy(true);
    setError(null);
    setRestoreConfirm(false);
    try {
      const result = await commissionService.levels.restoreDefaults('fill');
      setRestoreNotice(
        t('admin.partner.levels.restore.result', {
          defaultValue: 'Restored {{restored}} default level(s); {{skipped}} already configured level(s) kept.',
          restored: result.restored,
          skipped: result.skipped,
        }),
      );
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.levels.errors.restoreFailed', { defaultValue: 'Failed to restore default levels.' })));
    } finally {
      setBusy(false);
    }
  };

  const exportLevels = () => {
    exportCsv(t('admin.partner.levels.export.filename', { defaultValue: 'partner-levels' }), items.map((level) => ({
      [t('admin.partner.levels.table.levelNo', { defaultValue: 'Level' })]: `L${level.levelNo}`,
      [t('admin.partner.levels.table.name', { defaultValue: 'Name' })]: localizeLevelName(level.name, i18n.language),
      [t('admin.partner.levels.table.revenueRatio', { defaultValue: 'Revenue ratio' })]: `${formatDecimal(level.customerRevenueRatio)}%`,
      [t('admin.partner.levels.table.joinFeeRatio', { defaultValue: 'Join fee ratio' })]: `${formatDecimal(level.joinFeeCommissionRatio)}%`,
      [t('admin.partner.levels.table.joinFee', { defaultValue: 'Join fee' })]: formatDecimal(level.joinFee),
      [t('admin.partner.levels.table.benefits', { defaultValue: 'Benefits' })]: level.benefits.length,
      [t('admin.partner.levels.table.partners', { defaultValue: 'Partners' })]: levelUsage[level.levelNo] ?? 0,
      [t('admin.partner.levels.table.status', { defaultValue: 'Status' })]: level.status,
    })));
  };

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('admin.partner.levels.title', { defaultValue: 'Levels & commission ratios' })}
          </h2>
          <div className="flex gap-2">
            <button type="button" className={secondaryButtonClass} onClick={exportLevels} disabled={items.length === 0}>
              <Download className="h-4 w-4" />
              {t('admin.partner.levels.actions.export', { defaultValue: 'Export' })}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setRestoreConfirm(true)} disabled={busy}>
              <History className="h-4 w-4" />
              {t('admin.partner.levels.actions.restoreDefaults', { defaultValue: 'Restore defaults' })}
            </button>
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
        {restoreNotice ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {restoreNotice}
          </p>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#111] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.levelNo', { defaultValue: 'Level' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.name', { defaultValue: 'Name' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.revenueRatio', { defaultValue: 'Revenue ratio' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.joinFeeRatio', { defaultValue: 'Join fee ratio' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.joinFee', { defaultValue: 'Join fee' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.benefits', { defaultValue: 'Benefits' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.sortOrder', { defaultValue: 'Sort' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.partners', { defaultValue: 'Partners' })}</th>
                  <th className="px-4 py-3">{t('admin.partner.levels.table.status', { defaultValue: 'Status' })}</th>
                  <th className="px-4 py-3 text-right">{t('admin.partner.levels.table.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {items.length === 0 ? (
                  <TableState loading={loading} empty={t('admin.partner.levels.empty', { defaultValue: 'No levels configured.' })} colSpan={10} />
                ) : (
                  items.map((level) => (
                    <tr key={level.id} className="text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-mono text-xs">L{level.levelNo}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {localizeLevelName(level.name, i18n.language)}
                      </td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(level.customerRevenueRatio)}%</td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(level.joinFeeCommissionRatio)}%</td>
                      <td className="px-4 py-3 font-mono">{formatDecimal(level.joinFee)}</td>
                      <td className="px-4 py-3">
                        {level.benefits.length === 0 ? (
                          <span className="text-xs text-slate-400">
                            {t('admin.partner.levels.benefitsEmpty', { defaultValue: 'None' })}
                          </span>
                        ) : (
                          <Tooltip
                            content={level.benefits
                              .map((benefit) => {
                                const display = localizeBenefit(benefit, i18n.language);
                                const separator = normalizeCatalogLocale(i18n.language) === 'zh-CN' ? '：' : ': ';
                                return `${display.name}${display.value ? `${separator}${display.value}` : ''}`;
                              })
                              .join('  ·  ')}
                          >
                            <span className="inline-flex cursor-default items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                              {t('admin.partner.levels.benefitsCount', { defaultValue: '{{count}}', count: level.benefits.length })}
                            </span>
                          </Tooltip>
                        )}
                      </td>
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
                          <Tooltip content={t('admin.partner.levels.actions.benefits', { defaultValue: 'Benefits' })}>
                            <button type="button" className={secondaryButtonClass} onClick={() => setBenefitsTarget(level)}>
                              <Gift className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                            </button>
                          </Tooltip>
                          <Tooltip content={t('common.actions.edit', { defaultValue: 'Edit' })}>
                            <button type="button" className={secondaryButtonClass} onClick={() => setEditing(level)}>
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          <button
                            type="button"
                            className={secondaryButtonClass}
                            title={level.status === 'ACTIVE' ? t('admin.partner.levels.actions.disable', { defaultValue: 'Disable' }) : t('admin.partner.levels.actions.enable', { defaultValue: 'Enable' })}
                            onClick={() => void toggle(level)}
                          >
                            {level.status === 'ACTIVE' ? t('admin.partner.levels.actions.disable', { defaultValue: 'Disable' }) : t('admin.partner.levels.actions.enable', { defaultValue: 'Enable' })}
                          </button>
                          <Tooltip content={t('common.actions.delete', { defaultValue: 'Delete' })}>
                            <button type="button" className={secondaryButtonClass} onClick={() => setDeleteTarget(level)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </button>
                          </Tooltip>
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
      {benefitsTarget ? (
        <LevelBenefitsModal
          level={benefitsTarget}
          busy={busy}
          onClose={() => setBenefitsTarget(null)}
          onSaved={() => void load()}
        />
      ) : null}
      {deleteTarget ? (
        <ConfirmDialog
          title={t('admin.partner.levels.delete.title', { defaultValue: 'Delete level' })}
          description={t('admin.partner.levels.delete.description', {
            defaultValue: 'Delete level {{name}}? Levels referenced by partners cannot be deleted.',
            name: localizeLevelName(deleteTarget.name, i18n.language),
          })}
          confirmLabel={t('common.actions.delete', { defaultValue: 'Delete' })}
          isBusy={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void remove()}
        />
      ) : null}
      {restoreConfirm ? (
        <ConfirmDialog
          title={t('admin.partner.levels.restore.title', { defaultValue: 'Restore default levels' })}
          description={t('admin.partner.levels.restore.description', {
            defaultValue: 'Restore the commercial seven-tier default catalog (Agent → Regional Distributor)? Missing or deleted default levels are restored with the default ratios, join fees, and benefits. Levels you have already configured are kept as they are.',
          })}
          confirmLabel={t('admin.partner.levels.restore.confirm', { defaultValue: 'Restore defaults' })}
          isBusy={busy}
          onCancel={() => setRestoreConfirm(false)}
          onConfirm={() => void restoreDefaults()}
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

/**
 * Parses the benefits JSON injected by the level modal; returns `null` when
 * the payload is not a valid benefit array.
 */
function parseBenefits(raw: string): LevelBenefitItem[] | null {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      return {
        code: typeof item.code === 'string' ? item.code : '',
        name: typeof item.name === 'string' ? item.name : '',
        value: typeof item.value === 'string' ? item.value : '',
        sort: typeof item.sort === 'number' ? Math.max(0, item.sort) : 0,
      };
    });
  } catch {
    return null;
  }
}

function LevelModal({
  level,
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
  const [benefits, setBenefits] = useState<LevelBenefitItem[]>(() =>
    (level?.benefits ?? []).map((benefit) => ({
      code: benefit.code,
      name: benefit.name,
      value: benefit.value ?? '',
      sort: benefit.sort ?? 0,
    })),
  );

  const updateBenefit = (index: number, patch: Partial<LevelBenefitItem>) => {
    setBenefits((current) => current.map((benefit, i) => (i === index ? { ...benefit, ...patch } : benefit)));
  };

  const addBenefit = () => {
    setBenefits((current) => [
      ...current,
      { code: `benefit_${current.length + 1}`, name: '', value: '', sort: current.length + 1 },
    ]);
  };

  const removeBenefit = (index: number) => {
    setBenefits((current) =>
      current.filter((_, i) => i !== index).map((benefit, i) => ({ ...benefit, sort: i + 1 })),
    );
  };

  // Injects the benefit ladder into the form before the parent submit
  // handler reads the FormData, keeping the modal self-contained.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'benefits';
    hidden.value = JSON.stringify(benefits);
    form.appendChild(hidden);
    onSubmit(event);
  };

  return (
    <Modal
      title={
        level
          ? t('admin.partner.levels.form.editTitle', { defaultValue: 'Edit level' })
          : t('admin.partner.levels.form.createTitle', { defaultValue: 'New level' })
      }
      busy={busy}
      size="xl"
      submitLabel={
        level
          ? t('common.actions.saveChanges', { defaultValue: 'Save changes' })
          : t('admin.partner.levels.form.createAction', { defaultValue: 'Create level' })
      }
      onSubmit={handleSubmit}
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
          <input name="joinFee" type="number" min="0" step="0.01" className={inputClass} defaultValue={level?.joinFee ?? '5999.00'} required />
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

      <div className="mt-5 rounded-md border border-slate-200 p-3 dark:border-white/10">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('admin.partner.levels.form.benefits', { defaultValue: 'Level benefits' })}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('admin.partner.levels.form.benefitsHint', {
                defaultValue: 'Plan the entitlements granted to partners of this level, e.g. commission pool, leads, dedicated services.',
              })}
            </p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={addBenefit}>
            <Plus className="h-4 w-4" />
            {t('admin.partner.levels.actions.addBenefit', { defaultValue: 'Add benefit' })}
          </button>
        </div>
        {benefits.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-400">
            {t('admin.partner.levels.benefitsEmpty', { defaultValue: 'No benefits configured' })}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  placeholder={t('admin.partner.levels.form.benefitName', { defaultValue: 'Benefit name' })}
                  value={benefit.name}
                  onChange={(event) => updateBenefit(index, { name: event.currentTarget.value })}
                />
                <input
                  className={inputClass}
                  placeholder={t('admin.partner.levels.form.benefitValue', { defaultValue: 'Benefit value' })}
                  value={benefit.value}
                  onChange={(event) => updateBenefit(index, { value: event.currentTarget.value })}
                />
                <input
                  type="number"
                  min={0}
                  className={`${inputClass} w-20 shrink-0`}
                  placeholder={t('admin.partner.levels.form.sortOrder', { defaultValue: 'Sort' })}
                  value={benefit.sort}
                  onChange={(event) =>
                    updateBenefit(index, { sort: Math.max(0, Number(event.currentTarget.value) || 0) })
                  }
                />
                <button
                  type="button"
                  className={secondaryButtonClass}
                  title={t('admin.partner.levels.actions.removeBenefit', { defaultValue: 'Remove' })}
                  onClick={() => removeBenefit(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Standalone benefit (权益) management dialog for one partner level.
 *
 * Opened from the level table actions (Gift button) so operators can review
 * the full entitlement ladder of a level and manage it with full CRUD:
 * add / edit / remove benefits and reorder them. Saving persists through the
 * level update API, preserving the level's other fields unchanged.
 */
function LevelBenefitsModal({
  level,
  busy,
  onClose,
  onSaved,
}: {
  level: PartnerLevelItem;
  busy: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [benefits, setBenefits] = useState<LevelBenefitItem[]>(() =>
    (level.benefits ?? []).map((benefit) => ({
      code: benefit.code,
      name: benefit.name,
      value: benefit.value ?? '',
      sort: benefit.sort ?? 0,
    })),
  );
  /** Row index being edited; -1 = adding a new benefit, null = none. */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ name: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const startAdd = () => {
    setEditingIndex(-1);
    setDraft({ name: '', value: '' });
    setError(null);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setDraft({ name: benefits[index].name, value: benefits[index].value ?? '' });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraft(null);
    setError(null);
  };

  const commitDraft = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError(t('admin.partner.levels.benefitsModal.nameRequired', { defaultValue: 'Benefit name is required.' }));
      return;
    }
    const value = draft.value.trim();
    if (editingIndex === -1) {
      setBenefits((current) => [
        ...current,
        { code: `benefit_${current.length + 1}`, name, value, sort: current.length + 1 },
      ]);
    } else if (editingIndex !== null) {
      setBenefits((current) =>
        current.map((benefit, index) => (index === editingIndex ? { ...benefit, name, value } : benefit)),
      );
    }
    cancelEdit();
    setSaved(false);
  };

  const removeBenefit = (index: number) => {
    setBenefits((current) =>
      current.filter((_, i) => i !== index).map((benefit, i) => ({ ...benefit, sort: i + 1 })),
    );
    if (editingIndex === index) cancelEdit();
    setSaved(false);
  };

  const moveBenefit = (index: number, direction: -1 | 1) => {
    setBenefits((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered.map((benefit, i) => ({ ...benefit, sort: i + 1 }));
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await commissionService.levels.update(level.id, {
        name: level.name,
        customerRevenueRatio: level.customerRevenueRatio,
        joinFeeCommissionRatio: level.joinFeeCommissionRatio,
        joinFee: level.joinFee,
        status: level.status,
        sortOrder: level.sortOrder,
        benefits,
      });
      setSaved(true);
      onSaved();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.levels.errors.saveFailed', { defaultValue: 'Failed to save level.' })));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save();
  };

  return (
    <Modal
      title={t('admin.partner.levels.benefitsModal.title', {
        defaultValue: '{{name}} · Level benefits',
        name: localizeLevelName(level.name, i18n.language),
      })}
      description={t('admin.partner.levels.benefitsModal.description', {
        defaultValue: 'Review and manage the entitlement ladder granted to partners of this level.',
      })}
      busy={busy || saving}
      submitLabel={t('admin.partner.levels.benefitsModal.save', { defaultValue: 'Save benefits' })}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <InlineError message={error} />
      {saved ? (
        <p className="mb-2 text-sm text-emerald-600 dark:text-emerald-300">
          {t('admin.partner.levels.benefitsModal.saved', { defaultValue: 'Benefits saved.' })}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {benefits.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            {t('admin.partner.levels.benefitsEmpty', { defaultValue: 'No benefits configured' })}
          </p>
        ) : (
          benefits.map((benefit, index) => {
            const display = localizeBenefit(benefit, i18n.language);
            return editingIndex === index ? (
              <div key={index} className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/60 p-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                <input
                  className={inputClass}
                  autoFocus
                  placeholder={t('admin.partner.levels.form.benefitName', { defaultValue: 'Benefit name' })}
                  value={draft?.name ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...(current ?? { name: '', value: '' }), name: event.currentTarget.value }))}
                />
                <input
                  className={inputClass}
                  placeholder={t('admin.partner.levels.form.benefitValue', { defaultValue: 'Benefit value' })}
                  value={draft?.value ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...(current ?? { name: '', value: '' }), value: event.currentTarget.value }))}
                />
                <button type="button" className={secondaryButtonClass} onClick={commitDraft}>
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                </button>
                <button type="button" className={secondaryButtonClass} onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div key={index} className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 dark:border-white/10">
                <span className="w-6 shrink-0 text-center font-mono text-xs text-slate-400">{benefit.sort}</span>
                <BenefitCategoryBadge code={benefit.code} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100" title={display.name}>
                  {display.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400" title={display.value}>
                  {display.value || '—'}
                </span>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  title={t('admin.partner.levels.actions.moveUp', { defaultValue: 'Move up' })}
                  disabled={index === 0}
                  onClick={() => moveBenefit(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  title={t('admin.partner.levels.actions.moveDown', { defaultValue: 'Move down' })}
                  disabled={index === benefits.length - 1}
                  onClick={() => moveBenefit(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <Tooltip content={t('admin.partner.levels.actions.editBenefit', { defaultValue: 'Edit benefit' })}>
                  <button type="button" className={secondaryButtonClass} onClick={() => startEdit(index)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </Tooltip>
                <Tooltip content={t('common.actions.delete', { defaultValue: 'Delete' })}>
                  <button type="button" className={secondaryButtonClass} onClick={() => removeBenefit(index)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </Tooltip>
              </div>
            );
          })
        )}
      </div>
      <div className="mt-3">
        <button type="button" className={secondaryButtonClass} onClick={startAdd} disabled={editingIndex !== null}>
          <Plus className="h-4 w-4" />
          {t('admin.partner.levels.actions.addBenefit', { defaultValue: 'Add benefit' })}
        </button>
      </div>
    </Modal>
  );
}

/** Benefit category, derived from the benefit code naming convention. */
type BenefitCategory = 'commission' | 'growth' | 'operation' | 'market' | 'strategy';

const CATEGORY_CODES: Record<BenefitCategory, readonly string[]> = {
  commission: ['commission_pool'],
  growth: ['onboarding_training', 'advanced_training', 'performance_rank', 'certification'],
  market: ['annual_rebate', 'quarterly_incentive', 'co_marketing', 'co_branding', 'trade_show'],
  strategy: ['joint_solution', 'rnd_access', 'equity_plan', 'summit_host', 'custom_sla'],
  operation: [
    'referral_link', 'marketing_kit', 'online_support', 'leads_monthly', 'tech_sla',
    'account_manager', 'region_protection', 'custom_solution', 'priority_settlement',
    'city_exclusive', 'leads_priority', 'dedicated_api', 'annual_summit',
    'express_settlement', 'province_exclusive', 'presales_consultant',
    'solution_architect', 'private_deploy', 'channel_conference', 'region_exclusive',
    'region_allowance',
  ],
};

const CATEGORY_STYLES: Record<BenefitCategory, string> = {
  commission: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
  growth: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  operation: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  market: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  strategy: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
};

function benefitCategory(code: string): BenefitCategory {
  const known = (Object.keys(CATEGORY_CODES) as BenefitCategory[]).find((category) =>
    CATEGORY_CODES[category].includes(code),
  );
  return known ?? 'operation';
}

function BenefitCategoryBadge({ code }: { code: string }) {
  const { t } = useTranslation();
  const category = benefitCategory(code);
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_STYLES[category]}`}
      title={t(`admin.partner.levels.benefitsModal.category.${category}`, { defaultValue: category })}
    >
      {t(`admin.partner.levels.benefitsModal.category.${category}`, { defaultValue: category })}
    </span>
  );
}
