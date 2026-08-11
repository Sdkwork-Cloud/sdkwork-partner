import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EntityPickerField } from './entity-picker-field';
import { UserPickerDialog, type UserPickerSelection } from './user-picker-dialog';

/**
 * Form field that opens the searchable IAM user picker dialog.
 *
 * - Single-select (default): hidden input `name` carries the chosen user id.
 * - Multi-select (`multiple`): hidden input `name` carries comma-separated ids.
 */
export function UserPickerField({
  name,
  multiple = false,
  initialValue,
  required,
  disabled,
  placeholder,
  onChange,
}: {
  /** Hidden input name carrying the selected user id(s). */
  name: string;
  /** Multi-select mode (hidden input becomes comma-separated ids). */
  multiple?: boolean;
  /** Current bound id(s) for edit echo (single: id; multiple: comma-separated). */
  initialValue?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Optional callback fired with the selected id(s) whenever they change. */
  onChange?: (ids: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <EntityPickerField
      name={name}
      multiple={multiple}
      initialValue={initialValue}
      required={required}
      disabled={disabled}
      placeholder={placeholder ?? t('admin.partner.picker.selectUsers', { defaultValue: 'Select user(s)…' })}
      icon={UserRound}
      onChange={onChange}
      renderDialog={({ open, selection, onClose, onConfirm }) => (
        <UserPickerDialog
          open={open}
          multiple={multiple}
          initialSelection={selection as UserPickerSelection[]}
          title={t('admin.partner.picker.title', { defaultValue: 'Select IAM users' })}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    />
  );
}
