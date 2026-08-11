import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Bottom pagination bar: range label, page size select, prev/next. */
export function BottomPagination({
  page,
  pageSize,
  total,
  disabled,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = total > 0 ? Math.min(page * pageSize, total) : 0;
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300 md:flex-row md:items-center md:justify-between">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {t('admin.partner.common.pagination.showing', {
          defaultValue: 'Showing',
        })}
        <span className="ml-2 font-mono text-slate-700 dark:text-slate-200">
          {start} - {end} / {total}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>{t('admin.partner.common.pagination.pageSize', { defaultValue: 'Page size' })}</span>
          <select
            value={pageSize}
            disabled={disabled}
            onChange={(event) => onPageSizeChange(Number(event.currentTarget.value))}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#202020] dark:text-slate-200"
          >
            {[10, 20, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <span className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
          {t('admin.partner.common.pagination.page', { defaultValue: 'Page' })} {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || disabled}
          aria-label={t('admin.partner.common.pagination.previous', { defaultValue: 'Previous page' })}
          title={t('admin.partner.common.pagination.previous', { defaultValue: 'Previous page' })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount || disabled}
          aria-label={t('admin.partner.common.pagination.next', { defaultValue: 'Next page' })}
          title={t('admin.partner.common.pagination.next', { defaultValue: 'Next page' })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
