import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getPartnerUserSearchPort, type PartnerUserOption } from '../user-search';
import { EntityPickerDialog, type PickerSelection } from './entity-picker-dialog';

/** A user selection entry echoed back from the picker. */
export interface UserPickerSelection extends PickerSelection {}

/**
 * Searchable IAM user picker dialog (public component, reusable).
 *
 * Thin adapter over the domain-neutral `EntityPickerDialog` kernel: the
 * search source is the host-injected `PartnerUserSearchPort` (IAM user
 * directory) and the copy strings come from the `admin.partner.picker.*`
 * i18n keys. `multiple` configures single-select (default) or multi-select.
 */
export function UserPickerDialog({
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
  initialSelection?: UserPickerSelection[];
  title: string;
  onClose: () => void;
  onConfirm: (selection: UserPickerSelection[]) => void;
}) {
  const { t } = useTranslation();
  const searchPort = useMemo(() => getPartnerUserSearchPort(), []);
  const search = useMemo(
    () => (keyword: string) => (searchPort ? searchPort(keyword) : Promise.resolve([])),
    [searchPort],
  );

  return (
    <EntityPickerDialog<PartnerUserOption>
      open={open}
      multiple={multiple}
      initialSelection={initialSelection}
      available={searchPort !== null}
      search={search}
      toSelection={(option) => ({ id: option.id, label: option.label })}
      strings={{
        title,
        singleHint: t('admin.partner.picker.singleHint', { defaultValue: 'Select a user.' }),
        multiHint: t('admin.partner.picker.multiHint', { defaultValue: 'Select one or more users.' }),
        unavailable: t('admin.partner.picker.unavailable', { defaultValue: 'User search is unavailable in this environment.' }),
        searchPlaceholder: t('admin.partner.picker.searchPlaceholder', { defaultValue: 'Search username or display name' }),
        typeToSearch: t('admin.partner.picker.typeToSearch', { defaultValue: 'Type to search users.' }),
        searching: t('admin.partner.picker.searching', { defaultValue: 'Searching…' }),
        noResults: t('admin.partner.picker.noResults', { defaultValue: 'No users match.' }),
        selectedCount: (count) => t('admin.partner.picker.selectedCount', { defaultValue: '{{count}} selected', count }),
        cancel: t('common.actions.cancel', { defaultValue: 'Cancel' }),
        confirm: t('common.actions.confirm', { defaultValue: 'Confirm' }),
        closeAria: t('common.actions.close', { defaultValue: 'Close' }),
        removeAria: t('common.actions.remove', { defaultValue: 'Remove' }),
      }}
      onClose={onClose}
      onConfirm={(selection) => onConfirm(selection as UserPickerSelection[])}
    />
  );
}
