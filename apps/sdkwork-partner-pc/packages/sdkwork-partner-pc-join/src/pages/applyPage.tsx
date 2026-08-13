import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Loader2, RotateCcw, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parseNumber } from '@sdkwork/utils';
import type { PartnerJoinApplicationItem, PartnerJoinProgramItem } from '@sdkwork/partner-app-sdk';
import {
  fetchProgram,
  isActiveApplicationConflict,
  submitApplication,
  toMessage,
  validateInviteCode,
} from '../services/partnerJoinService';
import { localizeLevelName } from '../catalogLocale';

export type ApplicantType = 'INDIVIDUAL' | 'ORGANIZATION';

export interface ApplyFormValues {
  applicantType: ApplicantType;
  subjectName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  targetLevelNo: string;
  inviteCode: string;
  businessIntro: string;
}

export type ApplyField =
  | 'subjectName'
  | 'contactName'
  | 'contactPhone'
  | 'contactEmail'
  | 'targetLevelNo'
  | 'businessIntro';

type InviteState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'valid'; name: string; levelNo: number | null }
  | { status: 'invalid' }
  | { status: 'failed' };

const PHONE_PATTERN = /^[0-9+\-\s()]{6,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BUSINESS_INTRO_MAX = 2000;

/** Client-side form validation; returns i18n keys per invalid field. */
export function validateApplicationForm(
  values: ApplyFormValues,
): Partial<Record<ApplyField, string>> {
  const errors: Partial<Record<ApplyField, string>> = {};
  if (values.applicantType === 'ORGANIZATION' && values.subjectName.trim() === '') {
    errors.subjectName = 'partnerJoin.apply.errors.subjectNameRequired';
  }
  if (values.contactName.trim() === '') {
    errors.contactName = 'partnerJoin.apply.errors.contactNameRequired';
  }
  const phone = values.contactPhone.trim();
  if (phone === '') {
    errors.contactPhone = 'partnerJoin.apply.errors.contactPhoneRequired';
  } else if (!PHONE_PATTERN.test(phone)) {
    errors.contactPhone = 'partnerJoin.apply.errors.contactPhoneInvalid';
  }
  const email = values.contactEmail.trim();
  if (email === '') {
    errors.contactEmail = 'partnerJoin.apply.errors.contactEmailRequired';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.contactEmail = 'partnerJoin.apply.errors.contactEmailInvalid';
  }
  if (values.targetLevelNo === '') {
    errors.targetLevelNo = 'partnerJoin.apply.errors.targetLevelRequired';
  }
  if (values.businessIntro.trim().length > BUSINESS_INTRO_MAX) {
    errors.businessIntro = 'partnerJoin.apply.errors.businessIntroTooLong';
  }
  return errors;
}

export function ApplyPage({ onNavigate }: { onNavigate?: (section: 'apply' | 'status') => void }) {
  const { t, i18n } = useTranslation();
  const [program, setProgram] = useState<PartnerJoinProgramItem | null>(null);
  const [values, setValues] = useState<ApplyFormValues>({
    applicantType: 'INDIVIDUAL',
    subjectName: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    targetLevelNo: '',
    inviteCode: '',
    businessIntro: '',
  });
  const [errors, setErrors] = useState<Partial<Record<ApplyField, string>>>({});
  const [invite, setInvite] = useState<InviteState>({ status: 'idle' });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [submitted, setSubmitted] = useState<PartnerJoinApplicationItem | null>(null);

  const loadProgram = useCallback(async () => {
    try {
      setProgram(await fetchProgram());
    } catch {
      // Level names are a display nicety; the numeric select still works.
    }
  }, []);

  useEffect(() => {
    void loadProgram();
  }, [loadProgram]);

  const levelNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const level of program?.levels ?? []) {
      names.set(level.levelNo, localizeLevelName(level.name, i18n.language));
    }
    return names;
  }, [program, i18n.language]);

  const setField = <K extends keyof ApplyFormValues>(key: K, value: ApplyFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (key !== 'inviteCode') {
      setErrors((current) => {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key as ApplyField];
        return next;
      });
    }
  };

  // Debounced invite-code validation (blur/change). Non-empty invalid codes
  // surface an inline error; valid codes show the inviter name and level.
  useEffect(() => {
    const code = values.inviteCode.trim();
    if (code === '') {
      setInvite({ status: 'idle' });
      return;
    }
    setInvite({ status: 'checking' });
    const timer = setTimeout(() => {
      validateInviteCode(code)
        .then((result) => {
          setInvite(
            result.valid
              ? { status: 'valid', name: result.partnerName ?? '', levelNo: result.levelNo ?? null }
              : { status: 'invalid' },
          );
        })
        .catch(() => setInvite({ status: 'failed' }));
    }, 400);
    return () => clearTimeout(timer);
  }, [values.inviteCode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setConflict(false);
    const nextErrors = validateApplicationForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setBusy(true);
    try {
      const application = await submitApplication({
        applicantType: values.applicantType,
        subjectName:
          values.applicantType === 'ORGANIZATION'
            ? values.subjectName.trim()
            : values.subjectName.trim() || undefined,
        contactName: values.contactName.trim(),
        contactPhone: values.contactPhone.trim(),
        contactEmail: values.contactEmail.trim(),
        targetLevelNo: parseNumber(values.targetLevelNo) ?? 1,
        inviteCode: values.inviteCode.trim() || undefined,
        businessIntro: values.businessIntro.trim() || undefined,
      });
      setSubmitted(application);
    } catch (cause) {
      if (isActiveApplicationConflict(cause)) {
        setConflict(true);
      } else {
        setSubmitError(toMessage(cause, t('partnerJoin.apply.errors.submitFailed', { defaultValue: 'Submission failed. Please try again later.' })));
      }
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('partnerJoin.apply.success.title', { defaultValue: 'Application submitted' })}
        </h2>
        <p className="max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
          {t('partnerJoin.apply.success.message', {
            defaultValue: 'Application ID {{id}} — operations will review within 3-5 business days.',
            id: submitted.id,
          })}
        </p>
        <button
          type="button"
          onClick={() => onNavigate?.('status')}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          {t('partnerJoin.apply.success.viewProgress', { defaultValue: 'View progress' })}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (conflict) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
        <RotateCcw className="h-14 w-14 text-amber-500" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('partnerJoin.apply.conflict.title', { defaultValue: 'An application is already in progress' })}
        </h2>
        <p className="max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
          {t('partnerJoin.apply.conflict.message', {
            defaultValue: 'You already submitted an application that is still under review. You can view its progress.',
          })}
        </p>
        <button
          type="button"
          onClick={() => onNavigate?.('status')}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          {t('partnerJoin.apply.conflict.viewProgress', { defaultValue: 'View progress' })}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-[#171717] dark:text-white';
  const errorText = (field: ApplyField): string | null =>
    errors[field] ? t(errors[field]!, { defaultValue: errors[field]! }) : null;
  const fieldErrorClass = (field: ApplyField): string => (errors[field] ? ' border-red-400 focus:border-red-500 focus:ring-red-500/20' : '');

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-5 overflow-auto px-6 py-8">
      <header>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('partnerJoin.apply.title', { defaultValue: 'Apply to join the partner program' })}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('partnerJoin.apply.subtitle', {
            defaultValue: 'After you submit, operations will review within 3-5 business days.',
          })}
        </p>
      </header>
      {submitError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {submitError}
        </p>
      ) : null}
      <form onSubmit={submit} noValidate className="grid gap-4">
        <fieldset className="grid gap-1.5">
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('partnerJoin.apply.applicantType.label', { defaultValue: 'Applicant type' })}
          </legend>
          <div className="inline-flex w-fit rounded-lg border border-slate-300 p-1 dark:border-white/10">
            {(['INDIVIDUAL', 'ORGANIZATION'] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={values.applicantType === type}
                onClick={() => setField('applicantType', type)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  values.applicantType === type
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                {t(
                  type === 'INDIVIDUAL'
                    ? 'partnerJoin.apply.applicantType.individual'
                    : 'partnerJoin.apply.applicantType.organization',
                  { defaultValue: type === 'INDIVIDUAL' ? 'Individual' : 'Organization' },
                )}
              </button>
            ))}
          </div>
        </fieldset>
        {values.applicantType === 'ORGANIZATION' ? (
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('partnerJoin.apply.subjectName', { defaultValue: 'Subject name' })}
            <span className="text-xs font-normal text-red-500">*</span>
            <input
              className={`${inputClass}${fieldErrorClass('subjectName')}`}
              value={values.subjectName}
              onChange={(event) => setField('subjectName', event.currentTarget.value)}
              aria-invalid={Boolean(errors.subjectName)}
            />
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              {t('partnerJoin.apply.subjectNameHint', {
                defaultValue: 'Individuals may fill in their name; organizations must fill in the company name.',
              })}
            </span>
            {errorText('subjectName') ? (
              <span className="text-xs font-normal text-red-600 dark:text-red-300">{errorText('subjectName')}</span>
            ) : null}
          </label>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('partnerJoin.apply.contactName', { defaultValue: 'Contact name' })}
            <span className="text-xs font-normal text-red-500">*</span>
            <input
              className={`${inputClass}${fieldErrorClass('contactName')}`}
              value={values.contactName}
              onChange={(event) => setField('contactName', event.currentTarget.value)}
              aria-invalid={Boolean(errors.contactName)}
            />
            {errorText('contactName') ? (
              <span className="text-xs font-normal text-red-600 dark:text-red-300">{errorText('contactName')}</span>
            ) : null}
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('partnerJoin.apply.contactPhone', { defaultValue: 'Contact phone' })}
            <span className="text-xs font-normal text-red-500">*</span>
            <input
              className={`${inputClass}${fieldErrorClass('contactPhone')}`}
              value={values.contactPhone}
              onChange={(event) => setField('contactPhone', event.currentTarget.value)}
              aria-invalid={Boolean(errors.contactPhone)}
            />
            {errorText('contactPhone') ? (
              <span className="text-xs font-normal text-red-600 dark:text-red-300">{errorText('contactPhone')}</span>
            ) : null}
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
            {t('partnerJoin.apply.contactEmail', { defaultValue: 'Contact email' })}
            <span className="text-xs font-normal text-red-500">*</span>
            <input
              type="email"
              className={`${inputClass}${fieldErrorClass('contactEmail')}`}
              value={values.contactEmail}
              onChange={(event) => setField('contactEmail', event.currentTarget.value)}
              aria-invalid={Boolean(errors.contactEmail)}
            />
            {errorText('contactEmail') ? (
              <span className="text-xs font-normal text-red-600 dark:text-red-300">{errorText('contactEmail')}</span>
            ) : null}
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
            {t('partnerJoin.apply.targetLevel', { defaultValue: 'Target level' })}
            <span className="text-xs font-normal text-red-500">*</span>
            <select
              className={`${inputClass}${fieldErrorClass('targetLevelNo')}`}
              value={values.targetLevelNo}
              onChange={(event) => setField('targetLevelNo', event.currentTarget.value)}
              aria-invalid={Boolean(errors.targetLevelNo)}
            >
              <option value="">
                {t('partnerJoin.apply.targetLevelPlaceholder', { defaultValue: 'Please select…' })}
              </option>
              {[1, 2, 3, 4, 5, 6, 7].map((levelNo) => (
                <option key={levelNo} value={levelNo}>
                  {levelNames.get(levelNo) ?? `L${levelNo}`}（L{levelNo}）
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              {t('partnerJoin.apply.targetLevelHint', { defaultValue: 'The final level is decided by the review' })}
            </span>
            {errorText('targetLevelNo') ? (
              <span className="text-xs font-normal text-red-600 dark:text-red-300">{errorText('targetLevelNo')}</span>
            ) : null}
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
            {t('partnerJoin.apply.inviteCode', { defaultValue: 'Invite code' })}
            <input
              className={inputClass}
              value={values.inviteCode}
              onChange={(event) => setField('inviteCode', event.currentTarget.value)}
              placeholder={t('partnerJoin.apply.inviteCodeHint', { defaultValue: 'Optional invite code' })}
            />
            {invite.status === 'checking' ? (
              <span className="flex items-center gap-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('partnerJoin.apply.inviteCode.checking', { defaultValue: 'Checking…' })}
              </span>
            ) : invite.status === 'valid' ? (
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-300">
                {t('partnerJoin.apply.inviteCode.valid', {
                  defaultValue: 'Inviter: {{name}} (L{{level}})',
                  name: invite.name,
                  level: invite.levelNo ?? '-',
                })}
              </span>
            ) : invite.status === 'invalid' ? (
              <span className="text-xs font-normal text-red-600 dark:text-red-300">
                {t('partnerJoin.apply.inviteCode.invalid', { defaultValue: 'Invalid invite code' })}
              </span>
            ) : invite.status === 'failed' ? (
              <span className="text-xs font-normal text-red-600 dark:text-red-300">
                {t('partnerJoin.apply.inviteCode.failed', { defaultValue: 'Invite code validation failed' })}
              </span>
            ) : null}
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
            {t('partnerJoin.apply.businessIntro', { defaultValue: 'Business introduction' })}
            <textarea
              rows={4}
              className={`${inputClass} resize-y${fieldErrorClass('businessIntro')}`}
              value={values.businessIntro}
              onChange={(event) => setField('businessIntro', event.currentTarget.value)}
              aria-invalid={Boolean(errors.businessIntro)}
            />
            <span className="flex items-center justify-between gap-2 text-xs font-normal">
              <span className="text-slate-500 dark:text-slate-400">
                {t('partnerJoin.apply.businessIntroHint', {
                  defaultValue: 'Optional: describe your business resources and promotion capabilities (up to 2000 characters)',
                })}
              </span>
              <span className="font-mono text-slate-400">
                {t('partnerJoin.apply.businessIntroCount', { defaultValue: '{{count}}/2000', count: values.businessIntro.length })}
              </span>
            </span>
            {errorText('businessIntro') ? (
              <span className="text-xs font-normal text-red-600 dark:text-red-300">{errorText('businessIntro')}</span>
            ) : null}
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy
            ? t('partnerJoin.apply.submitting', { defaultValue: 'Submitting…' })
            : t('partnerJoin.apply.submit', { defaultValue: 'Submit application' })}
        </button>
      </form>
    </div>
  );
}
