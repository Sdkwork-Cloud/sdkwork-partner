import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Right-hand detail drawer. */
export function SidePanel({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/30 backdrop-blur-[1px]">
      <button type="button" aria-label={t('common.actions.close', { defaultValue: 'Close' })} className="min-w-0 flex-1" onClick={onClose} />
      <aside className="flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#171717]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900 dark:text-white">{title}</h2>
            {subtitle ? <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
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
      </aside>
    </div>
  );
}
