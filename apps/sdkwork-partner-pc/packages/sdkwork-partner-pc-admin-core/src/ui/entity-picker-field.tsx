import { useState, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { secondaryButtonClass } from './classes';
import type { PickerSelection } from './entity-picker-dialog';

/**
 * Domain-neutral picker form field kernel.
 *
 * Owns the trigger affordance (open-button when empty, removable selection
 * chips when populated), the hidden `name` input carrying the chosen id(s),
 * and the dialog wiring. The concrete entity field injects the icon, the
 * placeholder copy, and the dialog element.
 */
export function EntityPickerField({
  name,
  multiple = false,
  initialValue,
  required,
  disabled,
  placeholder,
  icon: Icon,
  onChange,
  renderDialog,
}: {
  /** Hidden input name carrying the selected id(s). */
  name: string;
  /** Multi-select mode (hidden input becomes comma-separated ids). */
  multiple?: boolean;
  /** Current bound id(s) for edit echo (single: id; multiple: comma-separated). */
  initialValue?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Entity icon shown on the empty-state trigger button. */
  icon: LucideIcon;
  /** Optional callback fired with the selected id(s) whenever they change (controlled hosts). */
  onChange?: (ids: string) => void;
  /** Renders the concrete picker dialog bound to this field's state. */
  renderDialog: (state: {
    open: boolean;
    selection: PickerSelection[];
    onClose: () => void;
    onConfirm: (selection: PickerSelection[]) => void;
  }) => ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<PickerSelection[]>(() =>
    initialValue
      ? initialValue
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .map((id) => ({ id, label: `#${id}` }))
      : [],
  );

  const ids = selection.map((item) => item.id).join(',');

  const applySelection = (next: PickerSelection[]) => {
    setSelection(next);
    onChange?.(next.map((item) => item.id).join(','));
  };

  return (
    <div>
      {selection.length === 0 ? (
        <button
          type="button"
          className={`${secondaryButtonClass} h-9 w-full justify-start`}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <Icon className="h-4 w-4 text-slate-400" />
          <span className="truncate text-slate-500">{placeholder}</span>
        </button>
      ) : (
        <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
          {selection.map((item) => (
            <span
              key={item.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"
            >
              <span className="min-w-0 truncate">{item.label}</span>
              {!disabled ? (
                <button
                  type="button"
                  aria-label={t('common.actions.remove', { defaultValue: 'Remove' })}
                  className="rounded-full p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-200"
                  onClick={() =>
                    applySelection(selection.filter((entry) => entry.id !== item.id))
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
          {!disabled ? (
            <button
              type="button"
              className="ml-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              onClick={() => setOpen(true)}
            >
              {t('admin.partner.picker.selectMore', { defaultValue: 'Select' })}
            </button>
          ) : null}
        </div>
      )}
      <input type="hidden" name={name} value={ids} required={required} />
      {renderDialog({
        open,
        selection,
        onClose: () => setOpen(false),
        onConfirm: (next) => {
          setSelection(next);
          onChange?.(next.map((item) => item.id).join(','));
          setOpen(false);
        },
      })}
    </div>
  );
}
