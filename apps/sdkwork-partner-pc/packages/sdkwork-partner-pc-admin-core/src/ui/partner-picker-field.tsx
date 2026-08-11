import { Handshake } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EntityPickerField } from './entity-picker-field';
import { PartnerPickerDialog, type PartnerPickerSelection } from './partner-picker-dialog';

/**
 * Form field that opens the searchable partner picker dialog.
 *
 * - Single-select (default): hidden input `name` carries the chosen partner id.
 * - Multi-select (`multiple`): hidden input `name` carries comma-separated ids.
 */
export function PartnerPickerField({
  name,
  multiple = false,
  initialValue,
  required,
  disabled,
  placeholder,
  onChange,
}: {
  /** Hidden input name carrying the selected partner id(s). */
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
      placeholder={placeholder ?? t('admin.partner.picker.partner.select', { defaultValue: 'Select partner(s)…' })}
      icon={Handshake}
      onChange={onChange}
      renderDialog={({ open, selection, onClose, onConfirm }) => (
        <PartnerPickerDialog
          open={open}
          multiple={multiple}
          initialSelection={selection as PartnerPickerSelection[]}
          title={t('admin.partner.picker.partner.title', { defaultValue: 'Select partners' })}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    />
  );
}
