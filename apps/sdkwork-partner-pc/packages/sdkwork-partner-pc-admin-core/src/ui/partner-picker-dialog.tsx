import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getPartnerSearchPort, type PartnerSearchOption } from '../partner-search';
import { EntityPickerDialog, type PickerSelection } from './entity-picker-dialog';

/** A partner selection entry echoed back from the picker. */
export interface PartnerPickerSelection extends PickerSelection {}

/**
 * Searchable partner picker dialog (public component, reusable).
 *
 * Thin adapter over the domain-neutral `EntityPickerDialog` kernel: the
 * search source is the host-injected `PartnerSearchPort` (partner directory)
 * and the copy strings come from the `admin.partner.picker.partner.*` i18n
 * keys. `multiple` configures single-select (default) or multi-select.
 */
export function PartnerPickerDialog({
  open,
  multiple = false,
  initialSelection = [],
  title,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** Single-select or multi-select mode. */
  multiple?: boolean;
  initialSelection?: PartnerPickerSelection[];
  title: string;
  onClose: () => void;
  onConfirm: (selection: PartnerPickerSelection[]) => void;
}) {
  const { t } = useTranslation();
  const searchPort = useMemo(() => getPartnerSearchPort(), []);
  const search = useMemo(
    () => (keyword: string) => (searchPort ? searchPort(keyword) : Promise.resolve([])),
    [searchPort],
  );

  return (
    <EntityPickerDialog<PartnerSearchOption>
      open={open}
      multiple={multiple}
      initialSelection={initialSelection}
      available={searchPort !== null}
      search={search}
      toSelection={(option) => ({ id: option.id, label: option.name })}
      renderOptionContent={(option) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{option.name}</span>
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400">
            L{option.levelNo}
          </span>
        </span>
      )}
      strings={{
        title,
        singleHint: t('admin.partner.picker.partner.singleHint', { defaultValue: 'Select a partner.' }),
        multiHint: t('admin.partner.picker.partner.multiHint', { defaultValue: 'Select one or more partners.' }),
        unavailable: t('admin.partner.picker.partner.unavailable', { defaultValue: 'Partner search is unavailable in this environment.' }),
        searchPlaceholder: t('admin.partner.picker.partner.searchPlaceholder', { defaultValue: 'Search partner name or ID' }),
        typeToSearch: t('admin.partner.picker.partner.typeToSearch', { defaultValue: 'Type to search partners.' }),
        searching: t('admin.partner.picker.partner.searching', { defaultValue: 'Searching…' }),
        noResults: t('admin.partner.picker.partner.noResults', { defaultValue: 'No partners match.' }),
        selectedCount: (count) => t('admin.partner.picker.partner.selectedCount', { defaultValue: '{{count}} selected', count }),
        cancel: t('common.actions.cancel', { defaultValue: 'Cancel' }),
        confirm: t('common.actions.confirm', { defaultValue: 'Confirm' }),
        closeAria: t('common.actions.close', { defaultValue: 'Close' }),
        removeAria: t('common.actions.remove', { defaultValue: 'Remove' }),
      }}
      onClose={onClose}
      onConfirm={(selection) => onConfirm(selection as PartnerPickerSelection[])}
    />
  );
}
