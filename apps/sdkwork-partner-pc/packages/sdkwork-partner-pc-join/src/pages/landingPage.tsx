import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Handshake,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parseNumber } from '@sdkwork/utils';
import type { PartnerJoinLevelItem, PartnerJoinProgramItem } from '@sdkwork/partner-app-sdk';
import { fetchProgram, toMessage } from '../services/partnerJoinService';
import { localizeBenefit, localizeLevelName } from '../catalogLocale';

const DEFAULT_PROFIT_MARGIN_RATIO = 40;

/** Format a decimal ratio/money string (e.g. "20.00") into a readable display. */
function formatDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const number = typeof value === 'number' ? value : parseNumber(String(value));
  if (number === null) return String(value);
  return number.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Public partner program landing (marketing copy). Parent owns routing. */
export function LandingPage({ onApply }: { onApply?: () => void }) {
  const { t, i18n } = useTranslation();
  const [program, setProgram] = useState<PartnerJoinProgramItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProgram(await fetchProgram());
    } catch (cause) {
      setError(toMessage(cause, t('partnerJoin.landing.errors.loadFailed', { defaultValue: 'Failed to load the partner program.' })));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const profitMarginRatio = useMemo(
    () => (program ? (parseNumber(program.rules.profitMarginRatio) ?? DEFAULT_PROFIT_MARGIN_RATIO) : DEFAULT_PROFIT_MARGIN_RATIO),
    [program],
  );
  const amount = parseNumber(monthlyAmount) ?? 0;
  const amountValid = monthlyAmount.trim() !== '' && amount > 0;

  const estimatedMonthly = (level: PartnerJoinLevelItem): number | null => {
    if (!amountValid) return null;
    const ratio = parseNumber(level.customerRevenueRatio) ?? 0;
    return amount * (ratio / 100) * (profitMarginRatio / 100);
  };

  const levels = program?.levels ?? [];
  const activeLevels = levels.filter((level) => level.status === 'ACTIVE');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto scroll-smooth">
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 px-6 py-20 text-white sm:py-24">
        {/* Layered background: gradient mesh + grid + glow orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.22),transparent_60%)]" />
          <div className="absolute left-1/2 top-0 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.25),transparent_70%)] blur-3xl" />
          <div className="absolute right-[8%] top-1/4 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl dark:bg-orange-500/10" />
          <div className="absolute left-[6%] top-1/3 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,#000_60%,transparent_100%)]" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-4xl">
          <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-medium text-indigo-200 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            {t('partnerJoin.common.title', { defaultValue: 'Partner Join Program' })}
          </p>
          <h2 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {t('partnerJoin.landing.hero.title', { defaultValue: 'Join the partner program and share AI growth' })}
            <span className="mt-2 block bg-gradient-to-r from-indigo-400 via-sky-400 to-orange-400 bg-clip-text text-transparent">
              {t('partnerJoin.landing.hero.titleAccent', { defaultValue: '10%–30% customer revenue share' })}
            </span>
          </h2>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {t('partnerJoin.landing.hero.subtitle', {
              defaultValue: 'Compensation is based on customer spending and join fees — the higher the level, the bigger the share. Compliant and transparent, with no multi-level headcount rewards.',
            })}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onApply}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              {t('partnerJoin.landing.hero.apply', { defaultValue: 'Apply now' })}
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#join-process"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 backdrop-blur-sm transition hover:bg-white/10"
            >
              {t('partnerJoin.landing.hero.learn', { defaultValue: 'How it works' })}
            </a>
          </div>

          {/* Trust strip */}
          <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: '7', key: 'partnerJoin.landing.hero.statLevels', fallback: 'Partner levels' },
              { value: '10–30%', key: 'partnerJoin.landing.hero.statShare', fallback: 'Revenue share pool' },
              { value: '8–20%', key: 'partnerJoin.landing.hero.statJoinFeeShare', fallback: 'Join fee share pool' },
              { value: '¥5,999', key: 'partnerJoin.landing.hero.statJoinFeeFrom', fallback: 'Join fee from' },
            ].map((stat) => (
              <div key={stat.key} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                <dd className="font-mono text-xl font-bold text-white">{stat.value}</dd>
                <dt className="mt-0.5 text-xs text-slate-400">{t(stat.key, { defaultValue: stat.fallback })}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl space-y-12 px-6 py-12 sm:py-16">
        {/* Levels */}
        <section aria-labelledby="partner-join-levels-title">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
              <Handshake className="h-5 w-5" />
            </span>
            <div>
              <h3 id="partner-join-levels-title" className="text-xl font-bold text-slate-900 dark:text-white">
                {t('partnerJoin.landing.levels.title', { defaultValue: 'Levels & benefits' })}
              </h3>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {t('partnerJoin.landing.levels.subtitle', { defaultValue: 'Pick the level that fits you; benefits grow with the level' })}
              </p>
            </div>
          </div>
          {loading ? (
            <p className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('partnerJoin.common.loading', { defaultValue: 'Loading…' })}
            </p>
          ) : error ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-10 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
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
          ) : activeLevels.length === 0 ? (
            <p className="mt-6 rounded-xl border border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10">
              {t('partnerJoin.landing.levels.empty', { defaultValue: 'No levels available yet' })}
            </p>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {activeLevels.map((level) => (
                <article
                  key={level.levelNo}
                  className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 dark:border-white/10 dark:bg-[#171717] dark:hover:border-indigo-500/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-white">{localizeLevelName(level.name, i18n.language)}</span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                      L{level.levelNo}
                    </span>
                  </div>
                  <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                    ¥{formatDecimal(level.joinFee)}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      {t('partnerJoin.landing.levels.joinFeeLabel', { defaultValue: 'join fee' })}
                    </span>
                  </p>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-xs text-slate-500 dark:text-slate-400">
                        {t('partnerJoin.landing.levels.customerRatio', { defaultValue: 'Customer revenue share' })}
                      </dt>
                      <dd className="font-mono font-semibold text-indigo-600 dark:text-indigo-300">{formatDecimal(level.customerRevenueRatio)}%</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-xs text-slate-500 dark:text-slate-400">
                        {t('partnerJoin.landing.levels.joinFeeRatio', { defaultValue: 'Join fee share' })}
                      </dt>
                      <dd className="font-mono text-slate-700 dark:text-slate-200">{formatDecimal(level.joinFeeCommissionRatio)}%</dd>
                    </div>
                  </dl>
                  {level.benefits.length > 0 ? (
                    <div className="mt-auto border-t border-slate-100 pt-3 dark:border-white/5">
                      <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t('partnerJoin.landing.levels.benefits', { defaultValue: 'Benefits' })}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {level.benefits
                          .slice()
                          .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
                          .map((benefit) => {
                            const display = localizeBenefit(benefit, i18n.language);
                            return (
                              <span
                                key={benefit.code}
                                title={display.value}
                                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"
                              >
                                <BadgeCheck className="h-3 w-3" />
                                {display.name}
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Earnings calculator */}
        <section
          aria-labelledby="partner-join-calculator-title"
          className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-6 sm:p-8 dark:border-white/10 dark:from-white/[0.03] dark:to-indigo-500/[0.04]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
              <Calculator className="h-5 w-5" />
            </span>
            <div>
              <h3 id="partner-join-calculator-title" className="text-xl font-bold text-slate-900 dark:text-white">
                {t('partnerJoin.landing.calculator.title', { defaultValue: 'Earnings calculator' })}
              </h3>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {t('partnerJoin.landing.calculator.subtitle', { defaultValue: 'Enter an expected monthly spending volume to estimate earnings per level' })}
              </p>
            </div>
          </div>
          <label className="mt-6 grid max-w-xs gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('partnerJoin.landing.calculator.monthlyAmount', { defaultValue: 'Monthly spending (CNY)' })}
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
              <input
                type="number"
                min="0"
                step="1000"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-7 pr-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-[#171717] dark:text-white"
                placeholder={t('partnerJoin.landing.calculator.monthlyAmountPlaceholder', { defaultValue: 'e.g. 100000' })}
                value={monthlyAmount}
                onChange={(event) => setMonthlyAmount(event.currentTarget.value)}
              />
            </div>
          </label>
          {amountValid && activeLevels.length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeLevels.map((level) => {
                const estimate = estimatedMonthly(level);
                return (
                  <div
                    key={level.levelNo}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition duration-200 hover:border-indigo-300 dark:border-white/10 dark:bg-[#171717] dark:hover:border-indigo-500/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                        <TrendingUp className="h-4 w-4 text-indigo-500" />
                        {localizeLevelName(level.name, i18n.language)}
                      </span>
                      <span className="font-mono text-xs text-slate-400">L{level.levelNo}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {t('partnerJoin.landing.calculator.estimate', { defaultValue: 'Estimated monthly earnings' })}
                    </p>
                    <p className="font-mono text-2xl font-bold text-indigo-600 dark:text-indigo-300">
                      ¥{estimate === null ? '-' : formatDecimal(estimate)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-slate-400" />
              {t('partnerJoin.landing.calculator.empty', { defaultValue: 'Enter a monthly spending volume to see estimated earnings per level' })}
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            {t('partnerJoin.landing.calculator.footnote', {
              defaultValue: 'Illustrative basis: profit-based share = monthly spending × customer revenue share ratio × platform profit margin; the actual level and settlement rules are decided by the review.',
            })}
          </p>
        </section>

        {/* Process */}
        <section id="join-process" aria-labelledby="partner-join-process-title">
          <h3 id="partner-join-process-title" className="text-xl font-bold text-slate-900 dark:text-white">
            {t('partnerJoin.landing.process.title', { defaultValue: 'How to join' })}
          </h3>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((step) => (
              <li
                key={step}
                className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#171717]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 font-mono text-sm font-bold text-white shadow-md shadow-indigo-500/20">
                  {step}
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                  {t(`partnerJoin.landing.process.step${step}.title`, { defaultValue: `Step ${step}` })}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {t(`partnerJoin.landing.process.step${step}.description`, { defaultValue: '' })}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section aria-labelledby="partner-join-faq-title">
          <h3 id="partner-join-faq-title" className="text-xl font-bold text-slate-900 dark:text-white">
            {t('partnerJoin.landing.faq.title', { defaultValue: 'FAQ' })}
          </h3>
          <div className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:divide-white/10 dark:border-white/10 dark:bg-[#171717]">
            {[1, 2, 3, 4].map((index) => {
              const open = openFaq === index;
              return (
                <div key={index}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : index)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/[0.03]"
                  >
                    {t(`partnerJoin.landing.faq.q${index}`, { defaultValue: `Question ${index}` })}
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open ? (
                    <p className="px-5 pb-5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      {t(`partnerJoin.landing.faq.a${index}`, { defaultValue: '' })}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* Compliance */}
        <section
          aria-labelledby="partner-join-compliance-title"
          className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 dark:border-emerald-500/20 dark:bg-emerald-500/10"
        >
          <h3 id="partner-join-compliance-title" className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            {t('partnerJoin.landing.compliance.title', { defaultValue: 'Compliance statement' })}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-emerald-700 dark:text-emerald-300/90">
            {t('partnerJoin.landing.compliance.text', {
              defaultValue: 'Partner compensation is based solely on customer revenue share and join fee share from real business activity; multi-level headcount-based rewards are strictly prohibited.',
            })}
          </p>
        </section>
      </div>
    </div>
  );
}
