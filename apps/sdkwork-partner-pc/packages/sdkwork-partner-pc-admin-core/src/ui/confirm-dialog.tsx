import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from './classes';

/** Destructive/confirmation dialog. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  tone = 'danger',
  isBusy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const confirmClass = tone === 'danger' ? dangerButtonClass : primaryButtonClass;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onCancel();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#171717]">
        <div className="p-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
          <button type="button" className={secondaryButtonClass} onClick={onCancel} disabled={isBusy}>
            {t('common.actions.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button type="button" className={`${confirmClass} h-9 px-3 text-sm`} onClick={onConfirm} disabled={isBusy}>
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
