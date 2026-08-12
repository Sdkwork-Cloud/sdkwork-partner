import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CommissionConfigItem } from '@sdkwork/partner-backend-sdk';
import {
  errorMessage,
  Field,
  InlineError,
  inputClass,
  PageShell,
  primaryButtonClass,
  secondaryButtonClass,
} from '@sdkwork/partner-pc-admin-core/ui';
import { commissionService } from '../services/commissionService';

export function ConfigPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<CommissionConfigItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConfig(await commissionService.commissionConfig.retrieve());
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.config.errors.loadFailed', { defaultValue: 'Failed to load commission config.' })));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await commissionService.commissionConfig.update({
        enabled: config.enabled,
        usageSettlementEnabled: config.usageSettlementEnabled,
        rechargeEnabled: config.rechargeEnabled,
        maxCommissionDepth: config.maxCommissionDepth,
        currency: config.currency || 'CNY',
        minWithdrawalAmount: config.minWithdrawalAmount,
        profitMarginRatio: config.profitMarginRatio || '40.00',
      });
      setSaved(true);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.config.errors.saveFailed', { defaultValue: 'Failed to save commission config.' })));
    } finally {
      setBusy(false);
    }
  };

  const update = (patch: Partial<CommissionConfigItem>) => {
    setConfig((current) => (current ? { ...current, ...patch } : current));
  };

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('admin.partner.config.title', { defaultValue: 'Global commission configuration' })}
          </h2>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common.actions.refresh', { defaultValue: 'Refresh' })}
          </button>
        </div>
        <InlineError message={error} />
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">{t('admin.partner.config.loading', { defaultValue: 'Loading…' })}</p>
        ) : config ? (
          <div className="grid max-w-2xl gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#171717]">
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleRow
                label={t('admin.partner.config.enabled', { defaultValue: 'Enable commission settlement' })}
                checked={config.enabled}
                onChange={(checked) => update({ enabled: checked })}
              />
              <ToggleRow
                label={t('admin.partner.config.usageSettlement', { defaultValue: 'Commission on usage settlement revenue' })}
                checked={config.usageSettlementEnabled}
                onChange={(checked) => update({ usageSettlementEnabled: checked })}
              />
              <ToggleRow
                label={t('admin.partner.config.recharge', { defaultValue: 'Commission on recharge revenue' })}
                checked={config.rechargeEnabled}
                onChange={(checked) => update({ rechargeEnabled: checked })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('admin.partner.config.maxDepth', { defaultValue: 'Max commission depth' })} hint={t('admin.partner.config.maxDepthHint', { defaultValue: '0 = unlimited' })}>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={config.maxCommissionDepth}
                  onChange={(event) => update({ maxCommissionDepth: event.currentTarget.value })}
                />
              </Field>
              <Field label={t('admin.partner.config.currency', { defaultValue: 'Currency' })}>
                <input className={inputClass} value={config.currency} onChange={(event) => update({ currency: event.currentTarget.value })} />
              </Field>
              <Field label={t('admin.partner.config.minWithdrawal', { defaultValue: 'Min withdrawal amount' })}>
                <input className={inputClass} value={config.minWithdrawalAmount} onChange={(event) => update({ minWithdrawalAmount: event.currentTarget.value })} />
              </Field>
            </div>
            <Field
              label={t('admin.partner.config.profitMargin', { defaultValue: 'Platform profit margin (%)' })}
              hint={t('admin.partner.config.profitMarginHint', {
                defaultValue: 'Profit-based rebate: the customer revenue commission base is revenue × margin (e.g. 30% pool on a 40% margin pays at most 12% of revenue). Join-fee commissions use the full join fee.',
              })}
            >
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className={inputClass}
                value={config.profitMarginRatio}
                onChange={(event) => update({ profitMarginRatio: event.currentTarget.value })}
              />
            </Field>
            <div className="flex items-center gap-3">
              <button type="button" className={primaryButtonClass} onClick={() => void save()} disabled={busy}>
                <Save className="h-4 w-4" />
                {t('common.actions.save', { defaultValue: 'Save' })}
              </button>
              {saved ? (
                <span className="text-sm text-emerald-600 dark:text-emerald-300">
                  {t('admin.partner.config.saved', { defaultValue: 'Configuration saved.' })}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-200">
      <span>{label}</span>
      <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
    </label>
  );
}
