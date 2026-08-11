import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { inputClass } from './classes';

/** Search input with submit button and clear affordance. */
export function SearchBox({
  value,
  placeholder,
  onChange,
  onSubmit,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}) {
  const { t } = useTranslation();
  const clearable = value.trim() !== '';
  return (
    <form
      className="relative w-full sm:w-72"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value.trim());
      }}
    >
      <input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className={`${inputClass} pr-20`}
      />
      {clearable ? (
        <button
          type="button"
          title={t('common.actions.clear', { defaultValue: 'Clear' })}
          aria-label={t('common.actions.clear', { defaultValue: 'Clear' })}
          className="absolute right-11 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
          onClick={() => {
            onChange('');
            onSubmit('');
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <button
        type="submit"
        title={t('common.actions.search', { defaultValue: 'Search' })}
        aria-label={t('common.actions.search', { defaultValue: 'Search' })}
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white transition hover:bg-indigo-700"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}
