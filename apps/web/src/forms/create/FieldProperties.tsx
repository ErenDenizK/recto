/**
 * Properties of the selected created field (Edit fields): a Base UI popover opened from
 * the button next to the selection, with Enter or a double click. Every change is one
 * history entry ("Edit Name", "Rename Name"); text inputs commit on Enter or when they
 * lose focus, toggles and pickers at once.
 *
 * Name: unique among the document's created fields and without periods (both refused
 * here, as the model does); a name a field of the original PDF already uses is allowed
 * with a note, since the export resolves it by the document's form merge policy.
 * Signature fields say that this app does not sign.
 *
 * The popover is the one recipe (`ui/Popover`, system-audit-2026-10 §3.6): its title row with
 * ✕, then label-above fields; toggles are `ui/Checkbox`, pickers `ui/Select`, alignment
 * `ui/Segmented`, the border and background colours `ui/Swatch` rings, and the field's acts
 * S buttons (§3.3).
 */
import { Popover } from '@base-ui/react/popover';
import {
  type CreatedField,
  type FieldAlign,
  type FieldColor,
  type FieldPatch,
  fieldNameProblem,
  findFormField,
  MAX_FIELD_FONT_SIZE,
  type Rect,
} from '@pdf-editor/document-model';
import { type ReactElement, useId, useState } from 'react';

import { m } from '../../i18n';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Icon } from '../../ui/Icon';
import { PopoverHeader, PopoverPopup } from '../../ui/Popover';
import { Segmented } from '../../ui/Segmented';
import { Select } from '../../ui/Select';
import { NO_FILL, Swatch } from '../../ui/Swatch';
import { SwatchGroup } from '../../ui/SwatchGroup';
import { useCreateStore } from './create-store';
import styles from './CreatedFields.module.css';
import {
  addRadioButtonNear,
  deleteField,
  duplicateField,
  kindName,
  removeRadioButtonAt,
  sourceRootNames,
  updateField,
} from './field-actions';

const FONT_SIZES = [6, 8, 9, 10, 11, 12, 14, 16, 18, 24] as const;

function colorName(key: FieldColor): string {
  switch (key) {
    case 'none':
      return m.forms_color_none();
    case 'black':
      return m.forms_color_black();
    case 'gray':
      return m.forms_color_gray();
    case 'blue':
      return m.forms_color_blue();
    case 'red':
      return m.forms_color_red();
    case 'white':
      return m.forms_color_white();
    case 'light-gray':
      return m.forms_color_light_gray();
    case 'light-blue':
      return m.forms_color_light_blue();
    default:
      return m.forms_color_light_yellow();
  }
}

/** The colour keys offered for borders and for backgrounds. */
const BORDER_COLORS: readonly FieldColor[] = ['none', 'black', 'gray', 'blue', 'red'];
const BACKGROUND_COLORS: readonly FieldColor[] = [
  'none',
  'white',
  'light-gray',
  'light-blue',
  'light-yellow',
];

export function FieldProperties({
  field,
  widget,
  bounds,
  trigger,
}: {
  readonly field: CreatedField;
  readonly widget: number;
  /** The page's visible box (user space), for added radio buttons. */
  readonly bounds: Rect;
  readonly trigger: ReactElement;
}) {
  const open = useCreateStore((s) => s.propertiesOpen);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => useCreateStore.getState().setPropertiesOpen(next)}
    >
      <Popover.Trigger render={trigger} />
      <PopoverPopup
        side="right"
        align="start"
        // Beside the field, or under it when neither side has the room (a field at the edge).
        collisionAvoidance={{ fallbackAxisSide: 'end' }}
        className={styles.popup}
        data-field-properties={field.name}
      >
        <PopoverHeader title={m.forms_create_properties_title({ kind: kindName(field.kind) })} />
        <div className={styles.body}>
          <Body field={field} widget={widget} bounds={bounds} />
        </div>
      </PopoverPopup>
    </Popover.Root>
  );
}

/** A text input that commits on Enter and on blur; Esc restores the stored value. */
function CommitInput({
  id,
  value,
  onCommit,
  validate,
  describedBy,
  type = 'text',
  inputMode,
  min,
  max,
  placeholder,
}: {
  readonly id: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly validate?: (value: string) => string | undefined;
  readonly describedBy?: string;
  readonly type?: 'text' | 'number';
  readonly inputMode?: 'numeric';
  readonly min?: number;
  readonly max?: number;
  readonly placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | undefined>(undefined);
  const errorId = `${id}-error`;
  const commit = () => {
    const problem = validate?.(draft);
    setError(problem);
    if (problem === undefined && draft !== value) onCommit(draft);
  };
  return (
    <>
      <input
        id={id}
        className={styles.input}
        type={type}
        inputMode={inputMode}
        min={min}
        max={max}
        placeholder={placeholder}
        value={draft}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={
          [error ? errorId : undefined, describedBy].filter(Boolean).join(' ') || undefined
        }
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(validate?.(e.target.value));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            if (draft !== value || error) {
              e.preventDefault();
              setDraft(value);
              setError(undefined);
            }
          }
        }}
      />
      {error ? (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

function Check({
  label,
  checked,
  onChange,
  disabled,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}) {
  return (
    <Checkbox label={label} checked={checked} disabled={disabled} onCheckedChange={onChange} />
  );
}

function Swatches({
  label,
  keys,
  value,
  onChange,
}: {
  readonly label: string;
  readonly keys: readonly FieldColor[];
  readonly value: FieldColor;
  readonly onChange: (key: FieldColor) => void;
}) {
  const labelId = useId();
  return (
    <div className={styles.row}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <SwatchGroup
        label={label}
        value={swatchOf(value)}
        onValueChange={(next) => onChange(keys.find((key) => swatchOf(key) === next) ?? 'none')}
      >
        {keys.map((key) => (
          <Swatch key={key} value={swatchOf(key)} name={colorName(key)} />
        ))}
      </SwatchGroup>
    </div>
  );
}

/** The model's palette (document colours, not design tokens), as swatch values. */
const FIELD_COLOURS: Readonly<Record<FieldColor, string>> = {
  none: NO_FILL,
  black: '#000000',
  gray: '#808080',
  blue: '#2952BF',
  red: '#CC1A1A',
  white: '#FFFFFF',
  'light-gray': '#EDEDED',
  'light-blue': '#DEEBFF',
  'light-yellow': '#FFFAD1',
};

function swatchOf(key: FieldColor): string {
  return FIELD_COLOURS[key];
}

function Body({
  field,
  widget,
  bounds,
}: {
  readonly field: CreatedField;
  readonly widget: number;
  readonly bounds: Rect;
}) {
  const base = useId();
  const id = (part: string) => `${base}-${part}`;
  const ws = useWorkspaceStore((s) => s.workspace);
  const located = findFormField(ws, field.id);
  const siblings = located ? (ws.documents[located.document]?.fields ?? []) : [];
  const sourceNames = located ? sourceRootNames(ws, located.document) : new Set<string>();
  const set = (patch: FieldPatch) => updateField(field.id, patch);
  const textual = field.kind === 'text' || field.kind === 'dropdown' || field.kind === 'listbox';
  const aligned = textual || field.kind === 'button';
  const nameNote = sourceNames.has(field.name) ? id('name-note') : undefined;

  const validateName = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (trimmed === '') return m.forms_prop_name_empty();
    const problem = fieldNameProblem(trimmed);
    if (problem !== undefined && trimmed.includes('.')) return m.forms_prop_name_period();
    if (problem !== undefined) return m.forms_prop_name_invalid();
    if (siblings.some((f) => f.id !== field.id && f.name === trimmed)) {
      return m.forms_prop_name_taken();
    }
    return undefined;
  };

  const exportValue = field.widgets[widget]?.exportValue ?? '';
  const options = field.options ?? [];
  const valueChoices =
    field.kind === 'radio' ? field.widgets.map((w) => w.exportValue ?? '') : options;

  return (
    <>
      <div className={styles.row}>
        <label className={styles.label} htmlFor={id('name')}>
          {m.forms_prop_name()}
        </label>
        <CommitInput
          id={id('name')}
          value={field.name}
          validate={validateName}
          {...(nameNote ? { describedBy: nameNote } : {})}
          onCommit={(value) => set({ name: value.trim() })}
        />
        {nameNote ? (
          <span id={nameNote} className={styles.warning}>
            {m.forms_prop_name_source()}
          </span>
        ) : null}
      </div>
      <div className={styles.row}>
        <label className={styles.label} htmlFor={id('tooltip')}>
          {m.forms_prop_tooltip()}
        </label>
        <CommitInput
          id={id('tooltip')}
          value={field.tooltip ?? ''}
          onCommit={(value) => set({ tooltip: value.trim() === '' ? undefined : value.trim() })}
        />
      </div>

      {field.kind === 'text' ? (
        <>
          <div className={styles.checks}>
            <Check
              label={m.forms_prop_multiline()}
              checked={field.multiline === true}
              disabled={field.comb === true}
              onChange={(on) => set({ multiline: on ? true : undefined })}
            />
            <Check
              label={m.forms_prop_comb()}
              checked={field.comb === true}
              disabled={field.multiline === true}
              onChange={(on) =>
                set(on ? { comb: true, maxLength: field.maxLength ?? 10 } : { comb: undefined })
              }
            />
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor={id('max')}>
              {m.forms_prop_max_length()}
            </label>
            <CommitInput
              id={id('max')}
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              placeholder={m.forms_prop_none()}
              value={field.maxLength === undefined ? '' : String(field.maxLength)}
              validate={(v) =>
                v.trim() === '' || (/^\d+$/.test(v.trim()) && Number(v) >= 1)
                  ? field.comb && v.trim() === ''
                    ? m.forms_prop_comb_needs_length()
                    : undefined
                  : m.forms_prop_max_length_invalid()
              }
              onCommit={(v) => set({ maxLength: v.trim() === '' ? undefined : Number(v) })}
            />
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor={id('default')}>
              {m.forms_prop_default()}
            </label>
            <CommitInput
              id={id('default')}
              value={typeof field.defaultValue === 'string' ? field.defaultValue : ''}
              validate={(v) =>
                field.maxLength !== undefined && v.length > field.maxLength
                  ? m.forms_prop_max_length_invalid()
                  : undefined
              }
              onCommit={(v) => set({ defaultValue: v === '' ? undefined : v })}
            />
          </div>
        </>
      ) : null}

      {field.kind === 'checkbox' ? (
        <div className={styles.checks}>
          <Check
            label={m.forms_prop_default_checked()}
            checked={field.defaultValue === true}
            onChange={(on) => set({ defaultValue: on ? true : undefined })}
          />
        </div>
      ) : null}

      {field.kind === 'radio' ? (
        <div className={styles.row}>
          <label className={styles.label} htmlFor={id('export')}>
            {m.forms_prop_export_value()}
          </label>
          <CommitInput
            id={id('export')}
            value={exportValue}
            validate={(v) =>
              v.trim() === ''
                ? m.forms_prop_name_empty()
                : field.widgets.some((w, i) => i !== widget && w.exportValue === v.trim())
                  ? m.forms_prop_export_taken()
                  : undefined
            }
            onCommit={(v) => {
              const next = v.trim();
              const value = field.value === exportValue ? next : field.value;
              const defaultValue = field.defaultValue === exportValue ? next : field.defaultValue;
              set({
                widgets: field.widgets.map((w, i) =>
                  i === widget ? { ...w, exportValue: next } : w,
                ),
                value,
                defaultValue,
              });
            }}
          />
          <div className={styles.inline}>
            <Button
              size="sm"
              icon={<Icon name="plus" />}
              onClick={() => addRadioButtonNear(field.id, widget, bounds)}
            >
              {m.forms_prop_add_button()}
            </Button>
            <Button
              size="sm"
              icon={<Icon name="x" />}
              disabled={field.widgets.length < 2}
              onClick={() => removeRadioButtonAt(field.id, widget)}
            >
              {m.forms_prop_remove_button()}
            </Button>
          </div>
        </div>
      ) : null}

      {field.kind === 'dropdown' || field.kind === 'listbox' ? (
        <>
          <OptionsEditor
            id={id('options')}
            options={options}
            onCommit={(next) => set({ options: next })}
          />
          <div className={styles.checks}>
            {field.kind === 'dropdown' ? (
              <Check
                label={m.forms_prop_editable()}
                checked={field.editable === true}
                onChange={(on) => set({ editable: on ? true : undefined })}
              />
            ) : (
              <Check
                label={m.forms_prop_multi_select()}
                checked={field.multiSelect === true}
                onChange={(on) => set({ multiSelect: on ? true : undefined })}
              />
            )}
          </div>
        </>
      ) : null}

      {field.kind === 'dropdown' || field.kind === 'listbox' || field.kind === 'radio' ? (
        <div className={styles.row}>
          <label className={styles.label} htmlFor={id('default-choice')}>
            {m.forms_prop_default()}
          </label>
          <Select<string>
            id={id('default-choice')}
            block
            label={m.forms_prop_default()}
            value={
              typeof field.defaultValue === 'string'
                ? field.defaultValue
                : typeof field.defaultValue === 'object'
                  ? (field.defaultValue[0] ?? '')
                  : ''
            }
            onValueChange={(v) => {
              set({
                defaultValue:
                  v === '' ? undefined : field.kind === 'listbox' && field.multiSelect ? [v] : v,
              });
            }}
            options={[
              { value: '', label: m.forms_prop_none() },
              ...valueChoices.map((o) => ({ value: o, label: o })),
            ]}
          />
        </div>
      ) : null}

      {field.kind === 'button' ? (
        <div className={styles.row}>
          <label className={styles.label} htmlFor={id('label')}>
            {m.forms_prop_label()}
          </label>
          <CommitInput
            id={id('label')}
            value={field.label ?? ''}
            onCommit={(v) => set({ label: v })}
          />
          <span className={styles.note}>{m.forms_prop_button_note()}</span>
        </div>
      ) : null}

      {field.kind === 'signature' ? (
        <p className={styles.note} role="note">
          {m.forms_signature_placeholder_note()}
        </p>
      ) : null}

      {textual || field.kind === 'button' ? (
        <div className={styles.row}>
          <label className={styles.label} htmlFor={id('size')}>
            {m.forms_prop_font_size()}
          </label>
          <Select<string>
            id={id('size')}
            block
            label={m.forms_prop_font_size()}
            value={field.fontSize === 'auto' ? 'auto' : String(field.fontSize)}
            onValueChange={(v) =>
              set({
                fontSize: v === 'auto' ? 'auto' : Math.min(MAX_FIELD_FONT_SIZE, Number(v)),
              })
            }
            options={[
              { value: 'auto', label: m.forms_prop_auto() },
              ...[
                ...new Set([...FONT_SIZES, ...(field.fontSize === 'auto' ? [] : [field.fontSize])]),
              ]
                .sort((a, b) => a - b)
                .map((size) => ({ value: String(size), label: String(size) })),
            ]}
          />
        </div>
      ) : null}

      {aligned ? <AlignPicker value={field.align} onChange={(align) => set({ align })} /> : null}

      <Swatches
        label={m.forms_prop_border()}
        keys={BORDER_COLORS}
        value={field.border}
        onChange={(border) => set({ border })}
      />
      <Swatches
        label={m.forms_prop_background()}
        keys={BACKGROUND_COLORS}
        value={field.background}
        onChange={(background) => set({ background })}
      />

      <div className={styles.checks}>
        {field.kind !== 'button' ? (
          <Check
            label={m.forms_required()}
            checked={field.required}
            onChange={(required) => set({ required })}
          />
        ) : null}
        <Check
          label={m.forms_read_only_tag()}
          checked={field.readOnly}
          onChange={(readOnly) => set({ readOnly })}
        />
      </div>

      <div className={styles.actions}>
        <Button
          size="sm"
          variant="quiet"
          icon={<Icon name="copy" />}
          onClick={() => duplicateField(field.id, bounds)}
        >
          {m.forms_prop_duplicate()}
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon={<Icon name="trash" />}
          onClick={() => {
            useCreateStore.getState().setPropertiesOpen(false);
            deleteField(field.id);
          }}
        >
          {m.forms_prop_delete()}
        </Button>
      </div>
    </>
  );
}

function AlignPicker({
  value,
  onChange,
}: {
  readonly value: FieldAlign;
  readonly onChange: (align: FieldAlign) => void;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.label} aria-hidden="true">
        {m.forms_prop_align()}
      </span>
      <Segmented<FieldAlign>
        label={m.forms_prop_align()}
        value={value}
        onValueChange={onChange}
        options={[
          { value: 'left', label: m.forms_align_left() },
          { value: 'center', label: m.forms_align_center() },
          { value: 'right', label: m.forms_align_right() },
        ]}
      />
    </div>
  );
}

/** Options one per line; empty lines are dropped; at least one option, no duplicates. */
function OptionsEditor({
  id,
  options,
  onCommit,
}: {
  readonly id: string;
  readonly options: readonly string[];
  readonly onCommit: (options: string[]) => void;
}) {
  const [draft, setDraft] = useState(options.join('\n'));
  const [error, setError] = useState<string | undefined>(undefined);
  const parse = (text: string) => [
    ...new Set(
      text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== ''),
    ),
  ];
  const commit = () => {
    const next = parse(draft);
    if (next.length === 0) {
      setError(m.forms_prop_options_empty());
      return;
    }
    setError(undefined);
    if (next.join('\n') !== options.join('\n')) onCommit(next);
  };
  return (
    <div className={styles.row}>
      <label className={styles.label} htmlFor={id}>
        {m.forms_prop_options()}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        value={draft}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
      />
      {error ? (
        <span id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
