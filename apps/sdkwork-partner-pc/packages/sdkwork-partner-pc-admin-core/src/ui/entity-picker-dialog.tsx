import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Search, X } from 'lucide-react';
import { inputClass, primaryButtonClass, secondaryButtonClass } from './classes';

/** A selection entry echoed back from the dialog. */
export interface PickerSelection {
  id: string;
  label: string;
}

/**
 * All copy strings rendered by the dialog. The concrete entity picker owns
 * the i18n source, keeping this kernel domain-neutral and reusable.
 */
export interface EntityPickerStrings {
  title: string;
  singleHint: string;
  multiHint: string;
  unavailable: string;
  searchPlaceholder: string;
  typeToSearch: string;
  searching: string;
  noResults: string;
  selectedCount: (count: number) => string;
  cancel: string;
  confirm: string;
  closeAria: string;
  removeAria: string;
}

/**
 * Domain-neutral searchable picker dialog kernel.
 *
 * Owns the shared interaction (debounced search with stale-response guard,
 * single-select radio / multi-select checkbox rows, removable selection
 * chips, confirm footer) while every entity-specific concern — search
 * source, option rendering, copy strings — is injected by the caller. This
 * keeps entity pickers (IAM users, partners, …) thin and decoupled.
 */
export function EntityPickerDialog<T>({
  open,
  multiple = false,
  initialSelection = [],
  available,
  search,
  toSelection,
  renderOptionContent,
  strings,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** Single-select or multi-select mode. */
  multiple?: boolean;
  initialSelection?: PickerSelection[];
  /** False renders the unavailable state (no host-injected search source). */
  available: boolean;
  /** Keyword search over the entity source. */
  search: (keyword: string) => Promise<T[]>;
  /** Maps a searched item to its stable selection identity + display label. */
  toSelection: (item: T) => PickerSelection;
  /** Optional custom option body rendered beside the select indicator. */
  renderOptionContent?: (item: T, checked: boolean) => ReactNode;
  strings: EntityPickerStrings;
  onClose: () => void;
  onConfirm: (selection: PickerSelection[]) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [options, setOptions] = useState<T[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PickerSelection[]>([]);
  const seqRef = useRef(0);

  // Reset state each time the dialog opens.
  useEffect(() => {
    if (open) {
      setKeyword('');
      setOptions([]);
      setSelected(initialSelection);
    }
  }, [open, initialSelection]);

  // Debounced keyword search.
  useEffect(() => {
    if (!open || keyword.trim().length === 0) {
      setOptions([]);
      return;
    }
    const seq = ++seqRef.current;
    setSearching(true);
    const timer = setTimeout(() => {
      void search(keyword.trim())
        .then((items) => {
          if (seq !== seqRef.current) return;
          setOptions(items);
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          setOptions([]);
        })
        .finally(() => {
          if (seq === seqRef.current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, open, search]);

  if (!open) return null;

  const toggle = (item: T) => {
    const entry = toSelection(item);
    if (!multiple) {
      setSelected([entry]);
      return;
    }
    setSelected((current) => {
      const exists = current.some((candidate) => candidate.id === entry.id);
      return exists
        ? current.filter((candidate) => candidate.id !== entry.id)
        : [...current, entry];
    });
  };

  const isSelected = (id: string) => selected.some((candidate) => candidate.id === id);
  const removeSelection = (id: string) => setSelected((current) => current.filter((candidate) => candidate.id !== id));

  // Rendered through a portal so the dialog always overlays the whole
  // document regardless of the host form/modal stacking context (nested
  // fixed layers, overflow clipping, or backdrop-filter ancestors).
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#171717]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{strings.title}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {multiple ? strings.multiHint : strings.singleHint}
            </p>
          </div>
          <button
            type="button"
            aria-label={strings.closeAria}
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
          {!available ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              {strings.unavailable}
            </p>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  className={`${inputClass} pl-9`}
                  placeholder={strings.searchPlaceholder}
                  value={keyword}
                  onChange={(event) => setKeyword(event.currentTarget.value)}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200 dark:border-white/10">
                {keyword.trim() === '' ? (
                  <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                    <Search className="h-4 w-4" />
                    {strings.typeToSearch}
                  </p>
                ) : searching ? (
                  <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {strings.searching}
                  </p>
                ) : options.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">{strings.noResults}</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {options.map((item) => {
                      const entry = toSelection(item);
                      const checked = isSelected(entry.id);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                            checked
                              ? 'bg-indigo-50 dark:bg-indigo-500/10'
                              : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                          }`}
                          onClick={() => toggle(item)}
                        >
                          {multiple ? (
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                checked
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-white/20'
                              }`}
                            >
                              {checked ? <Check className="h-3 w-3" /> : null}
                            </span>
                          ) : (
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                checked
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-white/20'
                              }`}
                            >
                              {checked ? <Check className="h-3 w-3" /> : null}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            {renderOptionContent ? (
                              renderOptionContent(item, checked)
                            ) : (
                              <span className="block truncate">{entry.label}</span>
                            )}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-slate-400">#{entry.id}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {selected.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                      <button
                        type="button"
                        aria-label={strings.removeAria}
                        className="rounded-full p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-200"
                        onClick={() => removeSelection(item.id)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {selected.length > 0 ? strings.selectedCount(selected.length) : ''}
          </span>
          <div className="flex gap-2">
            <button type="button" className={secondaryButtonClass} onClick={onClose}>
              {strings.cancel}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={selected.length === 0}
              onClick={() => onConfirm(selected)}
            >
              {strings.confirm}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
