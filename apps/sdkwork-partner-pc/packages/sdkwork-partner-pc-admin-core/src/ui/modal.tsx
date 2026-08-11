import type { FormEvent, ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { primaryButtonClass, secondaryButtonClass } from './classes';

/** Form modal with header, scrollable body, and footer actions. */
export function Modal({
  title,
  description,
  busy,
  submitLabel,
  size = 'md',
  children,
  onSubmit,
  onClose,
}: {
  title: string;
  description?: string;
  busy: boolean;
  submitLabel: string;
  /** 弹窗宽度档位：md 默认 768px，xl 用于左右分栏等宽表单场景 */
  size?: 'md' | 'xl';
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const sizeClass = size === 'xl' ? 'max-w-7xl' : 'max-w-3xl';
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className={`flex w-full ${sizeClass} max-h-[90vh] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#171717]`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
          </div>
          <button
            type="button"
            aria-label={t('common.actions.close', { defaultValue: 'Close' })}
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
          <button type="button" className={secondaryButtonClass} onClick={onClose} disabled={busy}>
            {t('common.actions.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button type="submit" className={primaryButtonClass} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}
